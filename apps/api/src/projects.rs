use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_sessions::Session;

#[derive(Serialize)]
pub struct ProjectWithOwner {
    pub id: uuid::Uuid,
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub owner_id: uuid::Uuid,
    pub owner_name: String,
    pub owner_username: String,
    pub owner_avatar: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
}

/// List all projects with owner info (newest first)
pub async fn list(
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let projects = sqlx::query_as!(
        ProjectWithOwner,
        r#"
        SELECT
            p.id,
            p.title,
            p.description,
            p.image_url,
            p.status,
            p.created_at,
            p.owner_id,
            u.display_name as owner_name,
            u.username as owner_username,
            u.avatar_url as owner_avatar
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        ORDER BY p.created_at DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(projects))
}

/// Create a new project (requires login)
pub async fn create(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get logged in user ID
    let user_id: uuid::Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    // Validate title is not empty
    if payload.title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Title cannot be empty".to_string()));
    }

    // Create project
    let project = sqlx::query!(
        r#"
        INSERT INTO projects (owner_id, title, description, image_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
        "#,
        user_id,
        payload.title,
        payload.description,
        payload.image_url
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": project.id,
            "created_at": project.created_at
        })),
    ))
}
