use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use sqlx::PgPool;
use tower_sessions::Session;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub new_password: String,
}

pub async fn reset_user_password(
    State(pool): State<PgPool>,
    session: Session,
    Path(target_user_id): Path<Uuid>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 1. Check if logged in
    let user_id: Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    // 2. Check if admin
    let requester = sqlx::query!("SELECT role FROM users WHERE id = $1", user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match requester {
        Some(u) if u.role == "admin" => {
            // Proceed
        }
        _ => return Err((StatusCode::FORBIDDEN, "Admins only".to_string())),
    }

    // 3. Validate new password
    if payload.new_password.len() < 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Password must be at least 6 characters".to_string(),
        ));
    }

    // 4. Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(payload.new_password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .to_string();

    // 5. Update password in database
    // We need to check if local_auths exists for this user. If not, we might need to create it?
    // For now, let's assume we are resetting existing passwords or allowing setting one if it exists.
    // If the user is OAuth only, they might not have a local_auth record.
    // Let's try UPDATE first.
    let result = sqlx::query!(
        "UPDATE local_auths SET password_hash = $1 WHERE user_id = $2",
        password_hash,
        target_user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        // If no rows affected, maybe the user doesn't have a local_auth record yet (OAuth only).
        // Check if user exists first to give better error.
        let user_exists = sqlx::query!("SELECT id FROM users WHERE id = $1", target_user_id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if user_exists.is_none() {
            return Err((StatusCode::NOT_FOUND, "User not found".to_string()));
        }

        // If user exists but no local_auth, we should probably CREATE one.
        // But we need an email. We can try to fetch it from the user logic or just say "User has no email login setup".
        // For simplicity in this first version, let's error if they don't have local_auth.
        // OR we could try to INSERT if we had the email.
        return Err((
            StatusCode::BAD_REQUEST,
            "User does not have email login set up. Cannot reset password.".to_string(),
        ));
    }

    // 6. Log the action (verify logging works)
    tracing::info!(
        "Admin {} reset password for user {}",
        user_id,
        target_user_id
    );

    Ok((StatusCode::OK, "Password reset successfully".to_string()))
}

#[derive(Deserialize)]
pub struct ListUsersRequest {
    pub start: Option<i64>,
    pub limit: Option<i64>,
    pub search: Option<String>,
}

#[derive(serde::Serialize)]
pub struct UserSummary {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub email: Option<String>,
    pub role: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn list_users(
    State(pool): State<PgPool>,
    session: Session,
    axum::extract::Query(query): axum::extract::Query<ListUsersRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 1. Check if logged in & admin
    let user_id: Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    let requester = sqlx::query!("SELECT role FROM users WHERE id = $1", user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match requester {
        Some(u) if u.role == "admin" => {}
        _ => return Err((StatusCode::FORBIDDEN, "Admins only".to_string())),
    }

    // 2. Build Query
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.start.unwrap_or(0).max(0);
    let search_term = query.search.unwrap_or_default().to_lowercase();
    let search_pattern = format!("%{}%", search_term);

    // We join users with local_auths to get email.
    // OAuth users might not have local_auths, so LEFT JOIN.
    // Note: This query assumes one local_auth per user, which is true for now.
    // If we support multiple emails, this might need adjustment (GROUP BY or array_agg).

    let users = sqlx::query_as!(
        UserSummary,
        r#"
        SELECT 
            u.id, 
            u.username, 
            u.display_name, 
            u.role, 
            u.created_at,
            l.email
        FROM users u
        LEFT JOIN local_auths l ON u.id = l.user_id
        WHERE 
            ($1 = '' OR 
             u.username ILIKE $2 OR 
             u.display_name ILIKE $2 OR 
             l.email ILIKE $2)
        ORDER BY u.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
        search_term,    // Used to check if empty
        search_pattern, // Used for ILIKE
        limit,
        offset
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(users))
}
