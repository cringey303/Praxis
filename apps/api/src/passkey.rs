use argon2::{
    password_hash::{PasswordHash, PasswordVerifier},
    Argon2,
};
use axum::{
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use base64::Engine;
use oauth2::url::Url;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::net::SocketAddr;
use tower_sessions::Session;
use uuid::Uuid;
use webauthn_rs::prelude::*;

// WebAuthn configuration builder
fn create_webauthn() -> Result<Webauthn, WebauthnError> {
    let rp_origin =
        std::env::var("WEBAUTHN_RP_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".to_string());

    let rp_origin_url = Url::parse(&rp_origin).expect("Invalid WEBAUTHN_RP_ORIGIN");

    // If WEBAUTHN_RP_ID is set, use it. Otherwise, try to derive it from the origin.
    let rp_id = std::env::var("WEBAUTHN_RP_ID").unwrap_or_else(|_| {
        rp_origin_url
            .domain()
            .expect("WEBAUTHN_RP_ORIGIN must have a domain")
            .to_string()
    });

    let builder = WebauthnBuilder::new(&rp_id, &rp_origin_url)?.rp_name("Praxis");

    builder.build()
}

// Response types
#[derive(Serialize)]
pub struct PasskeyInfo {
    pub id: Uuid,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize)]
pub struct FinishRegistrationRequest {
    pub credential: RegisterPublicKeyCredential,
    pub name: Option<String>,
}

#[derive(Deserialize)]
pub struct FinishAuthRequest {
    pub credential: PublicKeyCredential,
}

#[derive(Deserialize)]
pub struct StartRegistrationRequest {
    pub password: Option<String>,
}

// Start passkey registration (user must be logged in)
pub async fn start_registration(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<StartRegistrationRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let user = sqlx::query!(
        "SELECT username, display_name FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Verify Password if user has one
    let auth = sqlx::query!(
        "SELECT password_hash FROM local_auths WHERE user_id = $1",
        user_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(auth_rec) = auth {
        // User has a local_auth record (email/password or email verified)
        // If they have a password hash, we must verify it.
        if !auth_rec.password_hash.is_empty() {
            let password = payload
                .password
                .ok_or((StatusCode::UNAUTHORIZED, "Password required".to_string()))?;

            let parsed_hash = PasswordHash::new(&auth_rec.password_hash).map_err(|e| {
                tracing::error!("Corrupted password hash for user {}: {}", user_id, e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Account password data is invalid. Please reset your password to fix this issue.".to_string(),
                )
            })?;

            Argon2::default()
                .verify_password(password.as_bytes(), &parsed_hash)
                .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid password".to_string()))?;
        }
    }

    // Get existing passkeys to exclude from registration
    let existing: Vec<Passkey> = get_user_passkeys(&pool, user_id).await?;

    let webauthn =
        create_webauthn().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let exclude_credentials: Option<Vec<CredentialID>> = if existing.is_empty() {
        None
    } else {
        Some(existing.iter().map(|p| p.cred_id().clone()).collect())
    };

    let (ccr, reg_state) = webauthn
        .start_passkey_registration(
            user_id,
            &user.username,
            &user.display_name,
            exclude_credentials,
        )
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Store state in session
    let state_json = serde_json::to_string(&reg_state)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    session
        .insert("passkey_reg_state", state_json)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ccr))
}

// Finish passkey registration
pub async fn finish_registration(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<FinishRegistrationRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let state_json: String = session
        .get("passkey_reg_state")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((
            StatusCode::BAD_REQUEST,
            "No registration in progress".to_string(),
        ))?;

    let reg_state: PasskeyRegistration = serde_json::from_str(&state_json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let webauthn =
        create_webauthn().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let passkey = webauthn
        .finish_passkey_registration(&payload.credential, &reg_state)
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                format!("Registration failed: {}", e),
            )
        })?;

    // Serialize the entire passkey for storage
    let passkey_json = serde_json::to_vec(&passkey)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let cred_id_bytes = passkey.cred_id().to_vec();
    let name = payload.name.unwrap_or_else(|| "Passkey".to_string());

    sqlx::query!(
        r#"INSERT INTO passkey_credentials (user_id, credential_id, public_key, name) VALUES ($1, $2, $3, $4)"#,
        user_id,
        cred_id_bytes,
        passkey_json,
        name
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    session.remove::<String>("passkey_reg_state").await.ok();

    Ok(Json(serde_json::json!({ "success": true })))
}

// Start passkey authentication (passwordless login)
pub async fn start_authentication(
    State(pool): State<PgPool>,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get all passkeys for discoverable auth
    let all_passkeys: Vec<Passkey> = sqlx::query!("SELECT public_key FROM passkey_credentials")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .into_iter()
        .filter_map(|row| serde_json::from_slice(&row.public_key).ok())
        .collect();

    if all_passkeys.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "No passkeys registered".to_string(),
        ));
    }

    let webauthn =
        create_webauthn().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Use start_passkey_authentication with all known passkeys
    let (rcr, auth_state) = webauthn
        .start_passkey_authentication(&all_passkeys)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let state_json = serde_json::to_string(&auth_state)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    session
        .insert("passkey_auth_state", state_json)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rcr))
}

// Finish passkey authentication
pub async fn finish_authentication(
    State(pool): State<PgPool>,
    session: Session,
    headers: HeaderMap,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<FinishAuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let state_json: String = session
        .get("passkey_auth_state")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((
            StatusCode::BAD_REQUEST,
            "No authentication in progress".to_string(),
        ))?;

    let auth_state: PasskeyAuthentication = serde_json::from_str(&state_json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Look up the credential using the raw bytes
    // The ID from webauthn-rs might be the raw bytes OR the base64url string bytes depending on how it was deserialized
    // The logs showed it was the base64url string bytes
    let cred_id_raw: Vec<u8> = payload.credential.id.clone().into();

    // Try to treat it as a base64url string first (because that's what we saw in the logs)
    let cred_id_bytes = if let Ok(s) = String::from_utf8(cred_id_raw.clone()) {
        if let Ok(decoded) = base64::prelude::BASE64_URL_SAFE_NO_PAD.decode(&s) {
            tracing::info!(
                "Decoded credential ID from Base64URL: {}",
                hex::encode(&decoded)
            );
            decoded
        } else {
            // Try standard base64url safe
            if let Ok(decoded) = base64::prelude::BASE64_URL_SAFE.decode(&s) {
                tracing::info!(
                    "Decoded credential ID from Base64URL (padded): {}",
                    hex::encode(&decoded)
                );
                decoded
            } else {
                tracing::warn!("Could not base64 decode credential ID, using raw bytes");
                cred_id_raw
            }
        }
    } else {
        cred_id_raw
    };

    tracing::info!(
        "Authenticating with credential ID (hex used for query): {}",
        hex::encode(&cred_id_bytes)
    );

    let stored = sqlx::query!(
        "SELECT id, user_id, public_key FROM passkey_credentials WHERE credential_id = $1",
        cred_id_bytes
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if stored.is_none() {
        tracing::error!("Credential not found: {}", hex::encode(&cred_id_bytes));
        return Err((StatusCode::UNAUTHORIZED, "Unknown credential".to_string()));
    }

    let stored = stored.unwrap();

    let mut passkey: Passkey = serde_json::from_slice(&stored.public_key)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let webauthn =
        create_webauthn().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let auth_result = webauthn
        .finish_passkey_authentication(&payload.credential, &auth_state)
        .map_err(|e| {
            (
                StatusCode::UNAUTHORIZED,
                format!("Authentication failed: {}", e),
            )
        })?;

    // Update the passkey with new counter
    passkey.update_credential(&auth_result);
    let updated_passkey = serde_json::to_vec(&passkey)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query!(
        "UPDATE passkey_credentials SET public_key = $1, last_used_at = NOW() WHERE id = $2",
        updated_passkey,
        stored.id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Set user session
    session
        .insert("user_id", stored.user_id.to_string())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    session.remove::<String>("passkey_auth_state").await.ok();

    // Create Active Session
    session
        .save()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(session_id) = session.id() {
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);
        crate::session::create_session(
            &pool,
            stored.user_id,
            session_id.to_string(),
            &headers,
            Some(addr.ip().to_string()),
            expires_at,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to track session after passkey auth: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "user_id": stored.user_id
    })))
}

// List user's passkeys
pub async fn list_passkeys(
    State(pool): State<PgPool>,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let passkeys = sqlx::query_as!(
        PasskeyInfo,
        r#"SELECT id, name, created_at as "created_at!", last_used_at FROM passkey_credentials WHERE user_id = $1 ORDER BY created_at DESC"#,
        user_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(passkeys))
}

// Delete a passkey
pub async fn delete_passkey(
    State(pool): State<PgPool>,
    session: Session,
    axum::extract::Path(passkey_id): axum::extract::Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let result = sqlx::query!(
        "DELETE FROM passkey_credentials WHERE id = $1 AND user_id = $2",
        passkey_id,
        user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Passkey not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

// Helper to get user's passkeys
async fn get_user_passkeys(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<Passkey>, (StatusCode, String)> {
    let rows = sqlx::query!(
        "SELECT public_key FROM passkey_credentials WHERE user_id = $1",
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let passkeys: Vec<Passkey> = rows
        .into_iter()
        .filter_map(|row| serde_json::from_slice(&row.public_key).ok())
        .collect();

    Ok(passkeys)
}
