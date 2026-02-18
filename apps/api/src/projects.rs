use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_sessions::Session;

#[derive(Serialize)]
pub struct ProjectWithOwner {
    pub id: uuid::Uuid,
    pub slug: String,
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

/// Generate a URL slug from a title
fn slugify(title: &str) -> String {
    let slug = title.to_lowercase();
    let slug = slug
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>();
    // Collapse consecutive dashes and trim
    let slug = slug
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    slug
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
            p.slug,
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

/// Get a single project by owner username + slug
pub async fn get_by_slug(
    State(pool): State<PgPool>,
    Path((username, slug)): Path<(String, String)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let project = sqlx::query_as!(
        ProjectWithOwner,
        r#"
        SELECT
            p.id,
            p.slug,
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
        WHERE u.username = $1 AND p.slug = $2
        "#,
        username,
        slug,
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match project {
        Some(p) => Ok(Json(p)),
        None => Err((StatusCode::NOT_FOUND, "Project not found".to_string())),
    }
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

    // Generate slug and ensure uniqueness per owner
    let base_slug = slugify(&payload.title);
    let slug = find_unique_slug(&pool, user_id, &base_slug).await?;

    // Create project
    let project = sqlx::query!(
        r#"
        INSERT INTO projects (owner_id, title, slug, description, image_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, slug, created_at
        "#,
        user_id,
        payload.title,
        slug,
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
            "slug": project.slug,
            "created_at": project.created_at
        })),
    ))
}

/// Find a unique slug for a given owner by appending -2, -3, etc. on conflict
async fn find_unique_slug(
    pool: &PgPool,
    owner_id: uuid::Uuid,
    base: &str,
) -> Result<String, (StatusCode, String)> {
    let mut candidate = base.to_string();
    let mut counter = 2u32;
    loop {
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM projects WHERE owner_id = $1 AND slug = $2)",
            owner_id,
            candidate,
        )
        .fetch_one(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if !exists.unwrap_or(false) {
            return Ok(candidate);
        }
        candidate = format!("{}-{}", base, counter);
        counter += 1;
    }
}
