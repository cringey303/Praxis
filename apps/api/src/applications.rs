use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_sessions::Session;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ApplyRequest {
    pub message: String,
    pub links: Vec<String>,
}

#[derive(Serialize)]
pub struct ApplyResponse {
    pub id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn apply(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    session: Session,
    Json(payload): Json<ApplyRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id: Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    if payload.message.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Message cannot be empty".to_string()));
    }

    let result = sqlx::query!(
        r#"
        INSERT INTO applications (project_id, applicant_id, message, links)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
        "#,
        project_id,
        user_id,
        payload.message,
        &payload.links
    )
    .fetch_one(&pool)
    .await;

    match result {
        Ok(row) => Ok((
            StatusCode::CREATED,
            Json(ApplyResponse {
                id: row.id,
                created_at: row.created_at,
            }),
        )),
        Err(sqlx::Error::Database(db_err)) if db_err.constraint() == Some("applications_project_id_applicant_id_key") => {
            Err((StatusCode::CONFLICT, "You have already applied to this project".to_string()))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
