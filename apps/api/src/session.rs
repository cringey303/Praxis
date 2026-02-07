use axum::{
    extract::{ConnectInfo, Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::net::SocketAddr;
use tower_sessions::Session;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ActiveSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub session_id: String,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub last_active_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub is_current: Option<bool>, // Computed field for UI
}

// Internal helper to create a session record
pub async fn create_session(
    pool: &PgPool,
    user_id: Uuid,
    session_id: String,
    headers: &HeaderMap,
    ip_address: Option<String>,
    expires_at: DateTime<Utc>,
) -> Result<(), String> {
    let user_agent = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Try to get IP from X-Forwarded-For (if behind proxy) or fallback
    // Note: In a real deployment, you'd want to be careful about trusting headers
    // For now we'll just take the first value if present
    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        .or(ip_address);

    sqlx::query!(
        r#"
        INSERT INTO active_sessions (user_id, session_id, user_agent, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (session_id) DO UPDATE 
        SET last_active_at = NOW(), user_agent = $3, ip_address = $4, expires_at = $5
        "#,
        user_id,
        session_id,
        user_agent,
        ip_address,
        expires_at
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// List all sessions for the current user
pub async fn list_sessions(
    State(pool): State<PgPool>,
    session: Session,
    headers: HeaderMap,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let current_session_id = session.id().map(|id| id.to_string()).unwrap_or_default();

    let mut sessions = sqlx::query_as!(
        ActiveSession,
        r#"
        SELECT 
            id, user_id, session_id, user_agent, ip_address, 
            last_active_at, expires_at, created_at,
            (session_id = $2) as "is_current?" 
        FROM active_sessions 
        WHERE user_id = $1 
        ORDER BY last_active_at DESC
        "#,
        user_id,
        current_session_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // If current session is not in the list (e.g. old session or first time tracking), add it
    let current_exists = sessions.iter().any(|s| s.session_id == current_session_id);

    if !current_exists && !current_session_id.is_empty() {
        let expires_at = Utc::now() + chrono::Duration::hours(24);
        // Backfill current session
        create_session(
            &pool,
            user_id,
            current_session_id.clone(),
            &headers,
            Some(addr.ip().to_string()),
            expires_at,
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

        // Fetch again to include the new session
        sessions = sqlx::query_as!(
            ActiveSession,
            r#"
            SELECT 
                id, user_id, session_id, user_agent, ip_address, 
                last_active_at, expires_at, created_at,
                (session_id = $2) as "is_current?" 
            FROM active_sessions 
            WHERE user_id = $1 
            ORDER BY last_active_at DESC
            "#,
            user_id,
            current_session_id
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(Json(sessions))
}

// Revoke a specific session
pub async fn revoke_session(
    State(pool): State<PgPool>,
    session: Session,
    Path(session_db_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // 1. Get the session_id string from the DB ID
    let target_session = sqlx::query!(
        "SELECT session_id FROM active_sessions WHERE id = $1 AND user_id = $2",
        session_db_id,
        user_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Session not found".to_string()))?;

    // 2. Remove from active_sessions table
    sqlx::query!("DELETE FROM active_sessions WHERE id = $1", session_db_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query!(
        "DELETE FROM tower_sessions.session WHERE id = $1",
        target_session.session_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

// Revoke all OTHER sessions
pub async fn revoke_all_other_sessions(
    State(pool): State<PgPool>,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let current_session_id = session.id().map(|id| id.to_string()).ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Current session ID unknown".to_string(),
    ))?;

    // 1. Get all other session IDs
    let other_sessions = sqlx::query!(
        "SELECT session_id FROM active_sessions WHERE user_id = $1 AND session_id != $2",
        user_id,
        current_session_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. Delete from active_sessions
    sqlx::query!(
        "DELETE FROM active_sessions WHERE user_id = $1 AND session_id != $2",
        user_id,
        current_session_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for s in other_sessions {
        sqlx::query!(
            "DELETE FROM tower_sessions.session WHERE id = $1",
            s.session_id
        )
        .execute(&pool)
        .await
        .ok(); // Ignore errors if already gone
    }

    Ok(StatusCode::OK)
}
