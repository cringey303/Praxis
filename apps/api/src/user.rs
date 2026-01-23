use crate::auth::RESERVED_USERNAMES;
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
    pub banner_url: Option<String>,
    pub avatar_original_url: Option<String>,
    pub banner_original_url: Option<String>,
    pub avatar_crop_x: Option<f64>,
    pub avatar_crop_y: Option<f64>,
    pub avatar_zoom: Option<f64>,
    pub banner_crop_x: Option<f64>,
    pub banner_crop_y: Option<f64>,
    pub banner_zoom: Option<f64>,
    pub verified: Option<bool>,
    pub pronouns: Option<String>,
}

#[derive(Serialize)]
pub struct PublicUserProfile {
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
    pub banner_url: Option<String>,
    pub avatar_original_url: Option<String>,
    pub banner_original_url: Option<String>,
    pub avatar_crop_x: Option<f64>,
    pub avatar_crop_y: Option<f64>,
    pub avatar_zoom: Option<f64>,
    pub banner_crop_x: Option<f64>,
    pub banner_crop_y: Option<f64>,
    pub banner_zoom: Option<f64>,
    pub pronouns: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
    pub avatar_url: Option<String>,
    pub banner_url: Option<String>,
    pub avatar_original_url: Option<String>,
    pub banner_original_url: Option<String>,
    pub avatar_crop_x: Option<f64>,
    pub avatar_crop_y: Option<f64>,
    pub avatar_zoom: Option<f64>,
    pub banner_crop_x: Option<f64>,
    pub banner_crop_y: Option<f64>,
    pub banner_zoom: Option<f64>,
    pub pronouns: Option<String>,
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
        SELECT 
            u.id, u.username, u.display_name, u.avatar_url, u.role, u.bio, u.location, u.website, u.banner_url,
            u.avatar_original_url, u.banner_original_url,
            u.avatar_crop_x, u.avatar_crop_y, u.avatar_zoom,
            u.banner_crop_x, u.banner_crop_y, u.banner_zoom,
            l.email as "email?", l.verified as "verified?",
            u.pronouns
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
            banner_url: u.banner_url,
            avatar_original_url: u.avatar_original_url,
            banner_original_url: u.banner_original_url,
            avatar_crop_x: u.avatar_crop_x,
            avatar_crop_y: u.avatar_crop_y,
            avatar_zoom: u.avatar_zoom,
            banner_crop_x: u.banner_crop_x,
            banner_crop_y: u.banner_crop_y,
            banner_zoom: u.banner_zoom,
            verified: u.verified,
            pronouns: u.pronouns,
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
    tracing::info!("update_profile: Payload: {:?}", payload);
    // 1. Get user_id from session
    let user_id: Uuid = match session.get("user_id").await {
        Ok(Some(id)) => id,
        Ok(None) => return Err((StatusCode::UNAUTHORIZED, "Not logged in".to_string())),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    // 2. Build Query dynamically or check fields
    // For simplicity, we can do separate updates or a COALESCE.
    // However, if username is changing, we must check uniqueness.

    let safe_username = payload.username.clone().map(|u| u.to_lowercase());

    if let Some(new_username) = &safe_username {
        // check if username is reserved
        if RESERVED_USERNAMES.contains(&new_username.as_str()) {
            return Err((StatusCode::BAD_REQUEST, "Username is reserved".to_string()));
        }

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
    // Sanitize inputs
    // We do NOT use ammonia::clean here because it HTML-encodes entities (e.g. & -> &amp;),
    // which causes double-encoding issues when displayed in the frontend.
    // React handles XSS protection by default when rendering.
    // If we wanted to strip HTML tags, we should use a different approach,
    // but for now we trust the frontend/DB to handle plain text.
    let safe_bio = payload
        .bio
        .as_ref()
        // remove newlines in bio
        .map(|s| s.replace('\n', " ").replace('\r', " "));
    let safe_display_name = payload.display_name.as_ref();
    let safe_location = payload.location.as_ref();
    let safe_pronouns = payload.pronouns.as_ref();

    let safe_website = if let Some(website) = &payload.website {
        if !website.trim().is_empty() {
            // Check if website is reachable
            let url_string = if website.starts_with("http") {
                website.clone()
            } else {
                format!("https://{}", website)
            };

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(3))
                .build()
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            // Try HEAD request first, fall back to GET? no, just HEAD for now to be fast
            // Actually many sites block HEAD, so maybe GET with range or just accept that "some exist but fail"
            // Let's try HEAD.
            let resp = client.head(&url_string).send().await;

            // If HEAD fails, try GET (some servers block HEAD)
            let exists = if resp.is_ok() {
                true
            } else {
                client.get(&url_string).send().await.is_ok()
            };

            if !exists {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Website could not be reached".to_string(),
                ));
            }
            Some(website.clone())
        } else {
            Some(website.clone())
        }
    } else {
        None
    };
    // We just verified reachability above in `safe_website`, so we don't need to do it again.
    // However, `safe_website` right now holds the result.
    // The previous code block was a bit messy with duplication.
    // Let's just use `safe_website` which is Option<String>.

    // Convert Option<String> to Option<&str> for the query
    let safe_website = safe_website.as_deref();

    sqlx::query!(
        r#"
        UPDATE users
        SET 
            username = COALESCE($1, username),
            display_name = COALESCE($2, display_name),
            bio = COALESCE($3, bio),
            location = COALESCE($4, location),
            website = COALESCE($5, website),
            avatar_url = COALESCE($6, avatar_url),
            banner_url = COALESCE($7, banner_url),
            avatar_original_url = COALESCE($8, avatar_original_url),
            banner_original_url = COALESCE($9, banner_original_url),
            avatar_crop_x = COALESCE($10, avatar_crop_x),
            avatar_crop_y = COALESCE($11, avatar_crop_y),
            avatar_zoom = COALESCE($12, avatar_zoom),
            banner_crop_x = COALESCE($13, banner_crop_x),
            banner_crop_y = COALESCE($14, banner_crop_y),
            banner_zoom = COALESCE($15, banner_zoom),
            pronouns = COALESCE($17, pronouns)
        WHERE id = $16
        "#,
        safe_username, // Username usually strict validation, but assuming alphanumeric elsewhere
        safe_display_name,
        safe_bio,
        safe_location,
        safe_website,
        payload.avatar_url,
        payload.banner_url,
        payload.avatar_original_url,
        payload.banner_original_url,
        payload.avatar_crop_x,
        payload.avatar_crop_y,
        payload.avatar_zoom,
        payload.banner_crop_x,
        payload.banner_crop_y,
        payload.banner_zoom,
        user_id,
        safe_pronouns
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
        SELECT 
            u.id, u.username, u.display_name, u.avatar_url, u.role, u.bio, u.location, u.website, u.banner_url,
            u.avatar_original_url, u.banner_original_url,
            u.avatar_crop_x, u.avatar_crop_y, u.avatar_zoom,
            u.banner_crop_x, u.banner_crop_y, u.banner_zoom,
            l.email as "email?", l.verified as "verified?",
            u.pronouns
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
            banner_url: u.banner_url,
            avatar_original_url: u.avatar_original_url,
            banner_original_url: u.banner_original_url,
            avatar_crop_x: u.avatar_crop_x,
            avatar_crop_y: u.avatar_crop_y,
            avatar_zoom: u.avatar_zoom,
            banner_crop_x: u.banner_crop_x,
            banner_crop_y: u.banner_crop_y,
            banner_zoom: u.banner_zoom,
            verified: u.verified,
            pronouns: u.pronouns,
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
        SELECT username, display_name, avatar_url, bio, location, website, banner_url, avatar_original_url, banner_original_url,
        avatar_crop_x, avatar_crop_y, avatar_zoom, banner_crop_x, banner_crop_y, banner_zoom, pronouns
        FROM users
        WHERE username = $1
        "#,
        username.to_lowercase()
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
            banner_url: u.banner_url,
            avatar_original_url: u.avatar_original_url,
            banner_original_url: u.banner_original_url,
            avatar_crop_x: u.avatar_crop_x,
            avatar_crop_y: u.avatar_crop_y,
            avatar_zoom: u.avatar_zoom,
            banner_crop_x: u.banner_crop_x,
            banner_crop_y: u.banner_crop_y,
            banner_zoom: u.banner_zoom,
            pronouns: u.pronouns,
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
        banner_url: None,
        avatar_original_url: None,
        banner_original_url: None,
        avatar_crop_x: None,
        avatar_crop_y: None,
        avatar_zoom: None,
        banner_crop_x: None,
        banner_crop_y: None,
        banner_zoom: None,
        verified: Some(false),
        pronouns: None,
    }))
}
