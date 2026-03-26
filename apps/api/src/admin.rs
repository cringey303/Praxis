use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_sessions::Session;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub new_password: String,
}

#[derive(Deserialize)]
pub struct AuditLogQuery {
    pub limit: Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub action: String,
    pub details: Option<String>,
    pub actor_user_id: Option<Uuid>,
    pub actor_username: Option<String>,
    pub target_user_id: Option<Uuid>,
    pub target_username: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct SecurityAnalytics {
    pub total_users: i64,
    pub admin_users: i64,
    pub users_with_password: i64,
    pub active_sessions_24h: i64,
    pub unique_active_ips_24h: i64,
    pub password_resets_7d: i64,
}

async fn require_admin(session: &Session, pool: &PgPool) -> Result<Uuid, (StatusCode, String)> {
    let user_id: Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    let requester = sqlx::query!("SELECT role FROM users WHERE id = $1", user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match requester {
        Some(u) if u.role == "admin" => Ok(user_id),
        _ => Err((StatusCode::FORBIDDEN, "Admins only".to_string())),
    }
}

async fn session_context(
    session: &Session,
    pool: &PgPool,
) -> Result<(Option<String>, Option<String>), (StatusCode, String)> {
    let Some(session_id) = session.id().map(|id| id.to_string()) else {
        return Ok((None, None));
    };

    let row = sqlx::query!(
        "SELECT ip_address, user_agent FROM active_sessions WHERE session_id = $1",
        session_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(row
        .map(|r| (r.ip_address, r.user_agent))
        .unwrap_or((None, None)))
}

async fn insert_audit_log(
    pool: &PgPool,
    action: &str,
    details: Option<&str>,
    actor_user_id: Option<Uuid>,
    target_user_id: Option<Uuid>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> Result<(), (StatusCode, String)> {
    sqlx::query(
        r#"
        INSERT INTO audit_logs (action, details, actor_user_id, target_user_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(action)
    .bind(details)
    .bind(actor_user_id)
    .bind(target_user_id)
    .bind(ip_address)
    .bind(user_agent)
    .execute(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(())
}

pub async fn list_audit_logs(
    State(pool): State<PgPool>,
    session: Session,
    Query(query): Query<AuditLogQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    require_admin(&session, &pool).await?;

    let limit = query.limit.unwrap_or(100).clamp(1, 500);

    let logs = sqlx::query_as::<_, AuditLogEntry>(
        r#"
        SELECT
            al.id,
            al.action,
            al.details,
            al.actor_user_id,
            actor.username AS actor_username,
            al.target_user_id,
            target.username AS target_username,
            al.ip_address,
            al.user_agent,
            al.created_at
        FROM audit_logs al
        LEFT JOIN users actor ON actor.id = al.actor_user_id
        LEFT JOIN users target ON target.id = al.target_user_id
        ORDER BY al.created_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(logs))
}

pub async fn get_security_analytics(
    State(pool): State<PgPool>,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    require_admin(&session, &pool).await?;

    let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM users")
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let admin_users: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM users WHERE role = 'admin'")
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let users_with_password: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM local_auths")
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let active_sessions_24h: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM active_sessions WHERE last_active_at >= NOW() - INTERVAL '24 hours'",
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let unique_active_ips_24h: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT ip_address)::bigint FROM active_sessions WHERE last_active_at >= NOW() - INTERVAL '24 hours' AND ip_address IS NOT NULL",
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let password_resets_7d: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM audit_logs WHERE action = 'admin.password_reset' AND created_at >= NOW() - INTERVAL '7 days'",
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(SecurityAnalytics {
        total_users,
        admin_users,
        users_with_password,
        active_sessions_24h,
        unique_active_ips_24h,
        password_resets_7d,
    }))
}

pub async fn reset_user_password(
    State(pool): State<PgPool>,
    session: Session,
    Path(target_user_id): Path<Uuid>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let admin_user_id = require_admin(&session, &pool).await?;

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
        admin_user_id,
        target_user_id
    );

    let (ip_address, user_agent) = session_context(&session, &pool).await?;
    insert_audit_log(
        &pool,
        "admin.password_reset",
        Some("Admin reset user password"),
        Some(admin_user_id),
        Some(target_user_id),
        ip_address.as_deref(),
        user_agent.as_deref(),
    )
    .await?;

    Ok((StatusCode::OK, "Password reset successfully".to_string()))
}
