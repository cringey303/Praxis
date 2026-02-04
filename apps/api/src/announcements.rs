use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_sessions::Session;

#[derive(Serialize)]
pub struct Announcement {
    pub id: uuid::Uuid,
    pub content: String,
    pub author_id: uuid::Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct AnnouncementWithAuthor {
    pub id: uuid::Uuid,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub author_name: String,
    pub author_avatar: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateAnnouncementRequest {
    pub content: String,
}

pub async fn get_latest(
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let announcement = sqlx::query_as!(
        Announcement,
        r#"
        SELECT id, content, author_id, created_at
        FROM announcements
        ORDER BY created_at DESC
        LIMIT 1
        "#
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(announcement))
}

/// Get last 10 announcements with author info
pub async fn get_recent(
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let announcements = sqlx::query_as!(
        AnnouncementWithAuthor,
        r#"
        SELECT 
            a.id,
            a.content,
            a.created_at,
            u.display_name as author_name,
            u.avatar_url as author_avatar
        FROM announcements a
        JOIN users u ON a.author_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 10
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(announcements))
}

/// Get all announcements with author info
pub async fn get_all(
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let announcements = sqlx::query_as!(
        AnnouncementWithAuthor,
        r#"
        SELECT 
            a.id,
            a.content,
            a.created_at,
            u.display_name as author_name,
            u.avatar_url as author_avatar
        FROM announcements a
        JOIN users u ON a.author_id = u.id
        ORDER BY a.created_at DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(announcements))
}

pub async fn create(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<CreateAnnouncementRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 1. Get logged in user ID
    let user_id: uuid::Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    // 2. Check if user is admin
    let user = sqlx::query!("SELECT role FROM users WHERE id = $1", user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let role = match user {
        Some(u) => u.role,
        None => return Err((StatusCode::UNAUTHORIZED, "User not found".to_string())),
    };

    if role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admins only".to_string()));
    }

    // 3. Create Announcement
    sqlx::query!(
        "INSERT INTO announcements (content, author_id) VALUES ($1, $2)",
        payload.content,
        user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, "Announcement created"))
}
