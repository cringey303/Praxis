use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_sessions::Session;
use axum::{extract::{State, Path}, http::StatusCode, response::IntoResponse,Json};

#[derive(Serialize)]
pub struct PostWithAuthor {
    pub id: uuid::Uuid,
    pub content: String,
    pub image_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub author_id: uuid::Uuid,
    pub author_name: String,
    pub author_username: String,
    pub author_avatar: Option<String>,
}

#[derive(Deserialize)]
pub struct CreatePostRequest {
    pub content: String,
    pub image_url: Option<String>,
}

/// List all posts with author info (newest first)
pub async fn list(
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let posts = sqlx::query_as!(
        PostWithAuthor,
        r#"
        SELECT
            p.id,
            p.content,
            p.image_url,
            p.created_at,
            p.author_id,
            u.display_name as author_name,
            u.username as author_username,
            u.avatar_url as author_avatar
        FROM posts p
        JOIN users u ON p.author_id = u.id
        ORDER BY p.created_at DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(posts))
}

pub async fn list_by_user(
    State(pool): State<PgPool>,
    Path(username): Path<String>
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let posts = sqlx::query_as!(
        PostWithAuthor,
        r#"
        SELECT
            p.id,
            p.content,
            p.image_url,
            p.created_at,
            p.author_id,
            u.display_name as author_name,
            u.username as author_username,
            u.avatar_url as author_avatar
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE u.username = $1
        ORDER BY p.created_at DESC
        "#,
        username
    )
    .fetch_all(&pool)
    .await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(posts))
}


/// Create a new post (requires login)
pub async fn create(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<CreatePostRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get logged in user ID
    let user_id: uuid::Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    // Validate content is not empty
    if payload.content.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Content cannot be empty".to_string()));
    }

    // Create post
    let post = sqlx::query!(
        r#"
        INSERT INTO posts (author_id, content, image_url)
        VALUES ($1, $2, $3)
        RETURNING id, created_at
        "#,
        user_id,
        payload.content,
        payload.image_url
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": post.id,
            "created_at": post.created_at
        })),
    ))
}
