use axum::{
    extract::{Json, Path, State},
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
    pub role: String,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
}

#[derive(Serialize)]
pub struct PublicUserProfile {
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
}

pub async fn get_me(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    session: Session,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    tracing::info!("get_me: Headers: {:?}", headers);
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
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.role, u.bio, u.location, u.website, l.email as "email?"
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
            role: u.role,
            bio: u.bio,
            location: u.location,
            website: u.website,
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
            display_name = COALESCE($2, display_name),
            bio = COALESCE($3, bio),
            location = COALESCE($4, location),
            website = COALESCE($5, website)
        WHERE id = $6
        "#,
        payload.username,
        payload.display_name,
        payload.bio,
        payload.location,
        payload.website,
        user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!("Profile updated successfully for user_id: {}", user_id);

    // Check if session ID persists (in memory)
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
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.role, u.bio, u.location, u.website, l.email as "email?"
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
            role: u.role,
            bio: u.bio,
            location: u.location,
            website: u.website,
        })
        .collect();

    Ok(Json(profiles))
}

pub async fn delete_user(
    State(pool): State<PgPool>,
    session: Session,
    Path(target_user_id): Path<Uuid>,
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
            // Proceed to delete
        }
        _ => return Err((StatusCode::FORBIDDEN, "Admins only".to_string())),
    }

    // 3. Delete user
    sqlx::query!("DELETE FROM users WHERE id = $1", target_user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_public_profile(
    Path(username): Path<String>,
    State(pool): State<PgPool>,
) -> Result<Json<PublicUserProfile>, (StatusCode, String)> {
    let user = sqlx::query!(
        r#"
        SELECT username, display_name, avatar_url, bio, location, website
        FROM users
        WHERE username = $1
        "#,
        username
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match user {
        Some(u) => Ok(Json(PublicUserProfile {
            username: u.username,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            bio: u.bio,
            location: u.location,
            website: u.website,
        })),
        None => Err((StatusCode::NOT_FOUND, "User not found".to_string())),
    }
}

pub async fn create_test_user(
    State(pool): State<PgPool>,
    session: Session,
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

    // 3. Create Test User
    let random_id = Uuid::new_v4();
    let username = format!("test_user_{}", &random_id.to_string()[..8]);
    let display_name = format!("Test User {}", &random_id.to_string()[..4]);
    let email = format!("{}@example.com", username);

    // Insert into users
    let new_user_id = sqlx::query!(
        r#"
        INSERT INTO users (username, display_name, role)
        VALUES ($1, $2, 'user')
        RETURNING id
        "#,
        username,
        display_name
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .id;

    // Insert into local_auths (with dummy password hash)
    sqlx::query!(
        r#"
        INSERT INTO local_auths (user_id, email, password_hash)
        VALUES ($1, $2, $3)
        "#,
        new_user_id,
        email,
        "dummy_hash_for_test_user"
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(UserProfile {
        id: new_user_id,
        username,
        display_name,
        email: Some(email),
        avatar_url: None,
        role: "user".to_string(),
        bio: None,
        location: None,
        website: None,
    }))
}
