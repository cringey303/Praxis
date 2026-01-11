use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_sessions::Session;
use uuid::Uuid;

#[derive(Serialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub display_name: Option<String>,
}

pub async fn get_me(
    State(pool): State<PgPool>,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 1. Get user_id from session
    let user_id: Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    // 2. Fetch user details and email (from local_auths if it exists)
    // using LEFT JOIN because a user might be OAuth-only (though current logic implies local_auths always has email for Google too, but let's be safe or just specific)
    // Actually, in auth.rs google_callback adds to local_auths, so we can assume local_auths exists for now, or use LEFT JOIN to be safe.

    let user = sqlx::query!(
        r#"
        SELECT u.id, u.username, u.display_name, u.avatar_url, l.email as "email?"
        FROM users u
        LEFT JOIN local_auths l ON u.id = l.user_id
        WHERE u.id = $1
        "#,
        user_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match user {
        Some(u) => Ok(Json(UserProfile {
            id: u.id,
            username: u.username,
            display_name: u.display_name,
            email: u.email,
            avatar_url: u.avatar_url,
        })),
        None => Err((StatusCode::NOT_FOUND, "User not found".to_string())),
    }
}

pub async fn update_profile(
    State(pool): State<PgPool>,
    session: Session,
    headers: axum::http::HeaderMap,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    tracing::info!("update_profile: Headers: {:?}", headers);
    // 1. Get user_id from session
    let user_id: Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    // 2. Build Query dynamically or check fields
    // For simplicity, we can do separate updates or a COALESCE.
    // However, if username is changing, we must check uniqueness.

    if let Some(new_username) = &payload.username {
        // Check if username is taken by ANOTHER user
        let exists = sqlx::query!(
            "SELECT id FROM users WHERE username = $1 AND id != $2",
            new_username,
            user_id
        )
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if exists.is_some() {
            return Err((StatusCode::CONFLICT, "Username already taken".to_string()));
        }
    }

    // 3. Update User
    // We use COALESCE to keep existing value if the new one is NULL (though our input is Option, SQL expects values)
    // Actually simpler logic: retrieve current, merge in Rust, update. OR use dynamic query.
    // Let's use a simple UPDATE that updates non-null fields.
    // But since SQLx query! macros desire static SQL, common trick is `COALESCE($1, username)` where $1 is the Option.

    sqlx::query!(
        r#"
        UPDATE users
        SET 
            username = COALESCE($1, username),
            display_name = COALESCE($2, display_name)
        WHERE id = $3
        "#,
        payload.username,
        payload.display_name,
        user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!("Profile updated successfully for user_id: {}", user_id);

    // Check if session ID persists
    if let Ok(Some(check_id)) = session.get::<Uuid>("user_id").await {
        tracing::info!(
            "update_profile POST-UPDATE: Session still contains user_id: {}",
            check_id
        );
    } else {
        tracing::warn!("update_profile POST-UPDATE: Session LOST user_id!");
    }

    Ok((StatusCode::OK, "Profile updated successfully"))
}

pub async fn get_all(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<UserProfile>>, (StatusCode, String)> {
    let users = sqlx::query!(
        r#"
        SELECT u.id, u.username, u.display_name, u.avatar_url, l.email as "email?"
        FROM users u
        LEFT JOIN local_auths l ON u.id = l.user_id
        ORDER BY u.created_at DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let profiles = users
        .into_iter()
        .map(|u| UserProfile {
            id: u.id,
            username: u.username,
            display_name: u.display_name,
            email: u.email,
            avatar_url: u.avatar_url,
        })
        .collect();

    Ok(Json(profiles))
}
