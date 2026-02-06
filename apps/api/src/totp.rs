use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use totp_rs::{Algorithm, Secret, TOTP};
use tower_sessions::Session;
use uuid::Uuid;

const TOTP_ISSUER: &str = "Praxis";

// Response types
#[derive(Serialize)]
pub struct TotpSetupResponse {
    pub secret: String,
    pub qr_code_url: String,
}

#[derive(Serialize)]
pub struct BackupCodesResponse {
    pub codes: Vec<String>,
}

#[derive(Deserialize)]
pub struct EnableTotpRequest {
    pub code: String,
}

#[derive(Deserialize)]
pub struct VerifyTotpRequest {
    pub code: String,
}

#[derive(Deserialize)]
pub struct DisableTotpRequest {
    pub code: String, // Require current TOTP code to disable
}

// Setup TOTP - generates secret and returns QR code URL
pub async fn setup_totp(
    State(pool): State<PgPool>,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Get user email for TOTP label
    let user = sqlx::query!(
        r#"SELECT u.username, la.email as "email?" FROM users u LEFT JOIN local_auths la ON u.id = la.user_id WHERE u.id = $1"#,
        user_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let account_name = user.email.unwrap_or_else(|| user.username.clone());

    // Generate a new secret
    let secret = Secret::generate_secret();
    let secret_base32 = secret.to_encoded().to_string();

    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret
            .to_bytes()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        Some(TOTP_ISSUER.to_string()),
        account_name.clone(),
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let qr_code = totp
        .get_qr_base64()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Store the secret (not enabled yet)
    sqlx::query!(
        r#"
        INSERT INTO totp_secrets (user_id, secret, enabled)
        VALUES ($1, $2, false)
        ON CONFLICT (user_id) DO UPDATE SET secret = $2, enabled = false
        "#,
        user_id,
        secret_base32
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(TotpSetupResponse {
        secret: secret_base32,
        qr_code_url: format!("data:image/png;base64,{}", qr_code),
    }))
}

// Enable TOTP - verifies code and enables 2FA
pub async fn enable_totp(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<EnableTotpRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Get the stored secret
    let totp_record = sqlx::query!(
        "SELECT secret FROM totp_secrets WHERE user_id = $1",
        user_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::BAD_REQUEST, "TOTP not set up".to_string()))?;

    // Verify the code
    let secret = Secret::Encoded(totp_record.secret)
        .to_bytes()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret, None, String::new())
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !totp
        .check_current(&payload.code)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        return Err((StatusCode::BAD_REQUEST, "Invalid code".to_string()));
    }

    // Enable TOTP
    sqlx::query!(
        "UPDATE totp_secrets SET enabled = true WHERE user_id = $1",
        user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Generate backup codes
    let backup_codes = generate_backup_codes(&pool, user_id).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "backup_codes": backup_codes
    })))
}

// Disable TOTP
pub async fn disable_totp(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<DisableTotpRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Verify current code before disabling
    if !verify_totp_code(&pool, user_id, &payload.code).await? {
        return Err((StatusCode::BAD_REQUEST, "Invalid code".to_string()));
    }

    // Delete TOTP secret and backup codes
    sqlx::query!("DELETE FROM totp_secrets WHERE user_id = $1", user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query!("DELETE FROM backup_codes WHERE user_id = $1", user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// Verify TOTP code (used during login)
pub async fn verify_totp(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<VerifyTotpRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get pending 2FA user ID from session
    let pending_user_id: Uuid = session
        .get("pending_2fa_user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::BAD_REQUEST, "No 2FA pending".to_string()))?;

    // Try TOTP code first
    let is_valid = verify_totp_code(&pool, pending_user_id, &payload.code).await?;

    // If not valid as TOTP, try as backup code
    let is_valid = if is_valid {
        true
    } else {
        verify_and_consume_backup_code(&pool, pending_user_id, &payload.code).await?
    };

    if !is_valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid code".to_string()));
    }

    // Complete login
    session
        .insert("user_id", pending_user_id.to_string())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    session.remove::<String>("pending_2fa_user_id").await.ok();

    Ok(Json(serde_json::json!({ "success": true })))
}

// Get TOTP status
pub async fn get_totp_status(
    State(pool): State<PgPool>,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let enabled = sqlx::query_scalar!(
        "SELECT enabled FROM totp_secrets WHERE user_id = $1",
        user_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .flatten()
    .unwrap_or(false);

    Ok(Json(serde_json::json!({ "enabled": enabled })))
}

// Regenerate backup codes
pub async fn regenerate_backup_codes(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<VerifyTotpRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Verify current TOTP code
    if !verify_totp_code(&pool, user_id, &payload.code).await? {
        return Err((StatusCode::BAD_REQUEST, "Invalid code".to_string()));
    }

    let codes = generate_backup_codes(&pool, user_id).await?;

    Ok(Json(BackupCodesResponse { codes }))
}

// Helper: Generate backup codes
async fn generate_backup_codes(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<String>, (StatusCode, String)> {
    // Delete existing codes
    sqlx::query!("DELETE FROM backup_codes WHERE user_id = $1", user_id)
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Generate 10 new codes
    let mut codes = Vec::new();
    let argon2 = Argon2::default();

    for _ in 0..10 {
        let code: String = (0..8)
            .map(|_| {
                let idx = rand::random::<u8>() % 36;
                if idx < 10 {
                    (b'0' + idx) as char
                } else {
                    (b'A' + idx - 10) as char
                }
            })
            .collect();

        let salt = SaltString::generate(&mut OsRng);
        let code_hash = argon2
            .hash_password(code.as_bytes(), &salt)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .to_string();

        sqlx::query!(
            "INSERT INTO backup_codes (user_id, code_hash) VALUES ($1, $2)",
            user_id,
            code_hash
        )
        .execute(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        codes.push(code);
    }

    Ok(codes)
}

// Helper: Verify TOTP code
async fn verify_totp_code(
    pool: &PgPool,
    user_id: Uuid,
    code: &str,
) -> Result<bool, (StatusCode, String)> {
    let totp_record = sqlx::query!(
        "SELECT secret, enabled FROM totp_secrets WHERE user_id = $1",
        user_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(record) = totp_record else {
        return Ok(false);
    };

    if !record.enabled.unwrap_or(false) {
        return Ok(false);
    }

    let secret = Secret::Encoded(record.secret)
        .to_bytes()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret, None, String::new())
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    totp.check_current(code)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

// Helper: Verify and consume backup code
async fn verify_and_consume_backup_code(
    pool: &PgPool,
    user_id: Uuid,
    code: &str,
) -> Result<bool, (StatusCode, String)> {
    let backup_codes = sqlx::query!(
        "SELECT id, code_hash FROM backup_codes WHERE user_id = $1 AND used = false",
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for bc in backup_codes {
        let parsed_hash = PasswordHash::new(&bc.code_hash)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if Argon2::default()
            .verify_password(code.as_bytes(), &parsed_hash)
            .is_ok()
        {
            // Mark as used
            sqlx::query!("UPDATE backup_codes SET used = true WHERE id = $1", bc.id)
                .execute(pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            return Ok(true);
        }
    }

    Ok(false)
}

// Check if user has 2FA enabled (for login flow)
pub async fn has_2fa_enabled(pool: &PgPool, user_id: Uuid) -> Result<bool, (StatusCode, String)> {
    let enabled = sqlx::query_scalar!(
        "SELECT enabled FROM totp_secrets WHERE user_id = $1",
        user_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .flatten()
    .unwrap_or(false);

    Ok(enabled)
}
