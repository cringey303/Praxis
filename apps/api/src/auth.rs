use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    Json,
};
use oauth2::{
    basic::BasicClient, AuthUrl, ClientId, ClientSecret, CsrfToken, RedirectUrl, Scope,
    TokenResponse, TokenUrl,
};
use serde::Deserialize;
use sqlx::PgPool;
use tower_sessions::Session;
use uuid::Uuid;

// request structure we get from the frontend
#[derive(Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub username: String,
    pub display_name: String,
}

pub const RESERVED_USERNAMES: &[&str] = &[
    "login",
    "signup",
    "dashboard",
    "settings",
    "api",
    "profile",
    "logout",
    "manifest.json",
    "robots.txt",
    "sitemap.xml",
    "admin",
    "user",
    "static",
    "public",
    "assets",
    "help",
    "about",
    "contact",
    "terms",
    "privacy",
];

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct GoogleUser {
    pub email: String,
    pub name: String,
    pub picture: String,
}

#[derive(Debug, Deserialize)]
pub struct GithubUser {
    pub email: Option<String>,
    pub name: Option<String>,
    pub login: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuthRequest {
    pub code: String,
    pub state: String,
}

/*
* Function: signup
* Description: takes SignupRequest and stores in DB
* Inputs:
* Gets .with_state from main.rs
* parses request and stores in payload
*
* Returns:
* success: Ok(impl IntoResponse
* OR an error tuple: Err((StatusCode, String))
*/
pub async fn signup(
    State(pool): State<PgPool>,
    session: Session,
    headers: axum::http::HeaderMap,
    Json(payload): Json<SignupRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // check if email already exists
    let email_exists = sqlx::query!(
        "SELECT user_id FROM local_auths WHERE email = $1",
        payload.email
    )
    .fetch_optional(&pool) // returns Some(row) if found, None if not
    .await
    // convert crashes/errors into an HTTP 500 error string
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // is_some(): if row found, email is taken and return HTTP 409 conflict error
    if email_exists.is_some() {
        return Err((StatusCode::CONFLICT, "Email already exists".to_string()));
    }

    // Sanitize inputs
    // We do NOT use ammonia::clean here because it HTML-encodes entities (e.g. & -> &amp;),
    // which leads to double encoding issues. React keeps us safe.
    let safe_username = payload.username.to_lowercase();
    let safe_display_name = &payload.display_name;

    if RESERVED_USERNAMES.contains(&safe_username.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "Username is reserved".to_string()));
    }

    // create random salt string
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        // combine password + salt and run math
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        // convert to string to save in DB
        .to_string();

    // Generate Verification Token
    let verification_token = Uuid::new_v4().to_string();

    // start SQL transaction to insert `users` and `local_auths` tables
    // Transaction ensures everything or nothing is executed
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create User
    let user_id = sqlx::query!(
        // `RETURNING id` is a Postgres feature that returns the UUID it just generated
        "INSERT INTO users (username, display_name) VALUES ($1, $2) RETURNING id",
        safe_username,
        safe_display_name
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .id;

    // Create Local Auth
    sqlx::query!(
        "INSERT INTO local_auths (user_id, email, password_hash, verification_token) VALUES ($1, $2, $3, $4)",
        user_id,
        payload.email,
        password_hash,
        verification_token
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Mock Email Sending (SMTP integration pending domain setup)
    let frontend_url =
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    println!("--------------------------------------------------");
    println!("EMAIL SENT TO: {}", payload.email);
    println!("SUBJECT: Verify your email");
    println!("BODY: Please click this link to verify your email:");
    println!("{}/verify-email?token={}", frontend_url, verification_token);
    println!("--------------------------------------------------");

    // Log the user in
    session
        .insert("user_id", user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create Active Session
    if let Some(session_id) = session.id() {
        // Default expiry (e.g., 24h from now, or whatever session manager uses)
        // ideally match session store config. For now using 24 hours.
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);

        // This is async but not critical path for response success, but good to await
        crate::session::create_session(
            &pool,
            user_id,
            session_id.to_string(),
            &headers,
            expires_at,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to track session: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;
    }

    tracing::info!("Signup successful for user_id: {}", user_id);

    Ok((
        StatusCode::CREATED,
        "User created successfully. Please verify your email.".to_string(),
    ))
}

#[derive(Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

pub async fn verify_email(
    State(pool): State<PgPool>,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = sqlx::query!(
        "UPDATE local_auths SET verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING user_id",
        payload.token
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match result {
        Some(_) => Ok((StatusCode::OK, "Email verified successfully".to_string())),
        None => Err((
            StatusCode::BAD_REQUEST,
            "Invalid or expired verification token".to_string(),
        )),
    }
}

#[derive(Deserialize)]
pub struct ResendVerificationRequest {
    pub email: String,
}

pub async fn resend_verification(
    State(pool): State<PgPool>,
    Json(payload): Json<ResendVerificationRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Check if user exists and is not verified
    let row = sqlx::query!(
        "SELECT verified FROM local_auths WHERE email = $1",
        payload.email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(record) = row {
        if record.verified.unwrap_or(false) {
            return Err((
                StatusCode::BAD_REQUEST,
                "Email already verified".to_string(),
            ));
        }

        // Generate new token
        let verification_token = Uuid::new_v4().to_string();

        // Update DB
        sqlx::query!(
            "UPDATE local_auths SET verification_token = $1 WHERE email = $2",
            verification_token,
            payload.email
        )
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // Mock Email Sending (SMTP integration pending domain setup)
        let frontend_url =
            std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        println!("--------------------------------------------------");
        println!("RESEND: Verification email to: {}", payload.email);
        println!("{}/verify-email?token={}", frontend_url, verification_token);
        println!("--------------------------------------------------");

        Ok((StatusCode::OK, "Verification email sent".to_string()))
    } else {
        // Return OK even if email not found to prevent enumeration, or Bad Request?
        // For now, let's be honest for UX (or Bad Request if typical auth)
        // Better security practice: "If that email exists, we sent a link."
        Ok((
            StatusCode::OK,
            "If that email exists, we sent a verification link.".to_string(),
        ))
    }
}
pub async fn login(
    State(pool): State<PgPool>,
    session: Session,
    headers: axum::http::HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // find user by email
    let user = sqlx::query!(
        "SELECT user_id, password_hash FROM local_auths WHERE email = $1",
        payload.email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // if user not found, return error
    let user = match user {
        Some(u) => u,
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Invalid email or password".to_string(),
            ));
        }
    };

    // parse hash from DB
    let parsed_hash = match PasswordHash::new(&user.password_hash) {
        Ok(hash) => hash,
        Err(e) => {
            tracing::error!("Corrupted password hash for user {}: {}", user.user_id, e);
            return Err((
                StatusCode::UNAUTHORIZED,
                "Invalid email or password".to_string(),
            ));
        }
    };

    // verify password
    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|e| {
            tracing::warn!("Failed login attempt for user {}: {}", user.user_id, e);
            (
                StatusCode::UNAUTHORIZED,
                "Invalid email or password".to_string(),
            )
        })?;

    // Check if user has 2FA enabled
    let has_2fa = crate::totp::has_2fa_enabled(&pool, user.user_id).await?;

    if has_2fa {
        // Store pending 2FA verification in session
        session
            .insert("pending_2fa_user_id", user.user_id)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        tracing::info!("2FA required for user_id: {}", user.user_id);

        return Ok(Json(serde_json::json!({
            "requires_2fa": true,
            "message": "2FA verification required"
        })));
    }
    // No 2FA - complete login directly
    session
        .insert("user_id", user.user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create Active Session
    if let Some(session_id) = session.id() {
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);
        crate::session::create_session(
            &pool,
            user.user_id,
            session_id.to_string(),
            &headers,
            expires_at,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to track session: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;
    }

    tracing::info!("Login successful for user_id: {}", user.user_id);

    // return success
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Login successful"
    })))
}

// google oauth handling
fn oauth_client() -> BasicClient {
    // read from .env
    let client_id = std::env::var("GOOGLE_CLIENT_ID").expect("GOOGLE_CLIENT_ID must be set");
    let client_secret =
        std::env::var("GOOGLE_CLIENT_SECRET").expect("GOOGLE_CLIENT_SECRET must be set");
    let redirect_url = std::env::var("GOOGLE_REDIRECT_URL").expect("Missing GOOGLE_REDIRECT_URL");

    let auth_url = AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
        .expect("Missing GOOGLE_AUTH_URL");

    let token_url = TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
        .expect("Missing GOOGLE_TOKEN_URL");

    BasicClient::new(
        ClientId::new(client_id),
        Some(ClientSecret::new(client_secret)),
        auth_url,
        Some(token_url),
    )
    .set_redirect_uri(RedirectUrl::new(redirect_url).expect("Missing GOOGLE_REDIRECT_URL"))
}

pub async fn google_login() -> impl IntoResponse {
    let client = oauth_client();

    // generate random csrf token and create auth URL
    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        // get email and profile info
        .add_scope(Scope::new("email".to_string()))
        .add_scope(Scope::new("profile".to_string()))
        .url();

    Redirect::to(auth_url.as_str())
}

// google oauth callback
pub async fn google_callback(
    State(pool): State<PgPool>,
    session: Session,
    headers: axum::http::HeaderMap,
    Query(query): Query<AuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let client = oauth_client();

    // exchange code for token
    let token = client
        .exchange_code(oauth2::AuthorizationCode::new(query.code))
        .request_async(oauth2::reqwest::async_http_client)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // get user info by token
    let client = reqwest::Client::new();
    let google_user: GoogleUser = client
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(token.access_token().secret())
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // find user by email to see if they already exist
    let user = sqlx::query!(
        "SELECT user_id, password_hash FROM local_auths WHERE email = $1",
        google_user.email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_id = if let Some(u) = user {
        // user exists, log them in
        u.user_id
    } else {
        // if user not found, create new user
        let mut tx = pool
            .begin()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let new_user_id = sqlx::query!(
            "INSERT INTO users (username, display_name) VALUES ($1, $2) RETURNING id",
            google_user
                .email
                .split('@')
                .next()
                .unwrap_or("user")
                .to_lowercase(),
            google_user.name
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .id;

        // No local_auth record for OAuth users - they can set a password later

        tx.commit()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        new_user_id
    };

    // Set Session
    session
        .insert("user_id", user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create Active Session
    if let Some(session_id) = session.id() {
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);
        crate::session::create_session(
            &pool,
            user_id,
            session_id.to_string(),
            &headers,
            expires_at,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to track session: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;
    }

    let frontend_url =
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let frontend_url = frontend_url
        .split(',')
        .next()
        .unwrap_or("http://localhost:3000")
        .trim();
    Ok(Redirect::to(&format!("{}/dashboard", frontend_url)))
}

// github oauth handling
fn github_oauth_client() -> BasicClient {
    // read from .env
    let client_id = std::env::var("GITHUB_CLIENT_ID").expect("GITHUB_CLIENT_ID must be set");
    let client_secret =
        std::env::var("GITHUB_CLIENT_SECRET").expect("GITHUB_CLIENT_SECRET must be set");
    let redirect_url = std::env::var("GITHUB_REDIRECT_URL").expect("Missing GITHUB_REDIRECT_URL");

    let auth_url = AuthUrl::new("https://github.com/login/oauth/authorize".to_string())
        .expect("Invalid GITHUB_AUTH_URL");

    let token_url = TokenUrl::new("https://github.com/login/oauth/access_token".to_string())
        .expect("Invalid GITHUB_TOKEN_URL");

    BasicClient::new(
        ClientId::new(client_id),
        Some(ClientSecret::new(client_secret)),
        auth_url,
        Some(token_url),
    )
    .set_redirect_uri(RedirectUrl::new(redirect_url).expect("Invalid GITHUB_REDIRECT_URL"))
}

pub async fn github_login() -> impl IntoResponse {
    let client = github_oauth_client();

    // generate random csrf token and create auth URL
    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        // Request user:email scope to ensure we get the email
        .add_scope(Scope::new("user:email".to_string()))
        .url();

    Redirect::to(auth_url.as_str())
}

pub async fn github_callback(
    State(pool): State<PgPool>,
    session: Session,
    headers: axum::http::HeaderMap,
    Query(query): Query<AuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let client = github_oauth_client();

    // exchange code for token
    let token = client
        .exchange_code(oauth2::AuthorizationCode::new(query.code))
        .request_async(async_http_client_logging)
        .await
        .map_err(|e| {
            tracing::error!("Failed to exchange code for token: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    // get user info from GitHub
    let http_client = reqwest::Client::new();
    let user_resp = http_client
        .get("https://api.github.com/user")
        .header("User-Agent", "praxis-app")
        .bearer_auth(token.access_token().secret())
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch user info from GitHub: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

    let user_text = user_resp.text().await.map_err(|e| {
        tracing::error!("Failed to get text from response: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    tracing::info!("GITHUB USER RESPONSE (Before Parse): {}", user_text);

    let github_user: GithubUser = serde_json::from_str(&user_text).map_err(|e| {
        tracing::error!(
            "Failed to parse GitHub user: {}. RAW RESPONSE: {}",
            e,
            user_text
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!(
                "Failed to parse server response: {}. RAW RESPONSE: {}",
                e, user_text
            ),
        )
    })?;

    // GitHub doesn't always return the email in the public profile, we might need to fetch it separately
    // But since we asked for user:email scope, let's try to get it from the user endpoint or a separate emails endpoint if needed.
    // Assume if it's not null it's there.
    // If it is null, call /user/emails.
    // For this implementation, let's add a quick fetch for emails if null.

    let email = if let Some(e) = github_user.email {
        e
    } else {
        #[derive(Deserialize)]
        struct GithubEmail {
            email: String,
            primary: bool,
            verified: bool,
        }

        let emails: Vec<GithubEmail> = http_client
            .get("https://api.github.com/user/emails")
            .header("User-Agent", "praxis-app")
            .bearer_auth(token.access_token().secret())
            .send()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .json()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // find primary verified email, or just first one
        emails
            .iter()
            .find(|e| e.primary && e.verified)
            .or_else(|| emails.first()) // fallback to any email?
            .map(|e| e.email.clone())
            .ok_or((
                StatusCode::BAD_REQUEST,
                "No email found for GitHub user".to_string(),
            ))?
    };

    // find user by email to see if they already exist
    let user = sqlx::query!(
        "SELECT user_id, password_hash FROM local_auths WHERE email = $1",
        email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_id = if let Some(u) = user {
        // user exists, log them in
        u.user_id
    } else {
        // if user not found, create new user
        let mut tx = pool
            .begin()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let display_name = github_user
            .name
            .unwrap_or_else(|| github_user.login.clone());

        let new_user_id = sqlx::query!(
            "INSERT INTO users (username, display_name) VALUES ($1, $2) RETURNING id",
            github_user.login.to_lowercase(), // use github username (lowercase)
            display_name
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .id;

        // No local_auth record for OAuth users - they can set a password later

        tx.commit()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        new_user_id
    };

    // Set Session
    session
        .insert("user_id", user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create Active Session
    if let Some(session_id) = session.id() {
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);
        crate::session::create_session(
            &pool,
            user_id,
            session_id.to_string(),
            &headers,
            expires_at,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to track session: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;
    }

    let frontend_url =
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let frontend_url = frontend_url
        .split(',')
        .next()
        .unwrap_or("http://localhost:3000")
        .trim();
    Ok(Redirect::to(&format!("{}/dashboard", frontend_url)))
}

pub async fn logout(session: Session) -> impl IntoResponse {
    let _ = session.delete().await;
    Ok::<_, (StatusCode, String)>((StatusCode::OK, "Logged out successfully".to_string()))
}

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

pub async fn change_password(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get user_id from session
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Get current password hash
    let user = sqlx::query!(
        "SELECT password_hash FROM local_auths WHERE user_id = $1",
        user_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    // Verify current password
    let parsed_hash = PasswordHash::new(&user.password_hash).map_err(|e| {
        tracing::error!("Corrupted password hash for user {}: {}", user_id, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Password verification failed".to_string(),
        )
    })?;

    Argon2::default()
        .verify_password(payload.current_password.as_bytes(), &parsed_hash)
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                "Current password is incorrect".to_string(),
            )
        })?;

    // Validate new password (minimum length)
    if payload.new_password.len() < 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            "New password must be at least 6 characters".to_string(),
        ));
    }

    // Check if new password is the same as current password
    if payload.new_password == payload.current_password {
        return Err((
            StatusCode::BAD_REQUEST,
            "New password cannot be the same as current password".to_string(),
        ));
    }

    // Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let new_password_hash = Argon2::default()
        .hash_password(payload.new_password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .to_string();

    // Update password in database
    sqlx::query!(
        "UPDATE local_auths SET password_hash = $1 WHERE user_id = $2",
        new_password_hash,
        user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!("Password changed for user_id: {}", user_id);

    Ok((StatusCode::OK, "Password changed successfully".to_string()))
}

#[derive(Deserialize)]
pub struct SetPasswordRequest {
    pub email: String,
    pub new_password: String,
}

/// Set password for OAuth-only users (creates local_auth record)
pub async fn set_password(
    State(pool): State<PgPool>,
    session: Session,
    Json(payload): Json<SetPasswordRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get user_id from session
    let user_id: Uuid = session
        .get("user_id")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    // Check if user already has a password
    let existing = sqlx::query!(
        "SELECT user_id FROM local_auths WHERE user_id = $1",
        user_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Password already set. Use change-password instead.".to_string(),
        ));
    }

    // Check email isn't already used
    let email_exists = sqlx::query!(
        "SELECT user_id FROM local_auths WHERE email = $1",
        payload.email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if email_exists.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Email already in use".to_string()));
    }

    // Validate new password
    if payload.new_password.len() < 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Password must be at least 6 characters".to_string(),
        ));
    }

    // Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(payload.new_password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .to_string();

    // Create local_auth record
    sqlx::query!(
        "INSERT INTO local_auths (user_id, email, password_hash) VALUES ($1, $2, $3)",
        user_id,
        payload.email,
        password_hash
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!("Password set for OAuth user_id: {}", user_id);

    Ok((StatusCode::OK, "Password set successfully".to_string()))
}

async fn async_http_client_logging(
    request: oauth2::HttpRequest,
) -> Result<oauth2::HttpResponse, reqwest::Error> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()?;

    let url = request.url.to_string();
    tracing::error!("OAUTH2 TOKEN REQUEST URL: {}", url);

    let mut request_builder = client
        .request(request.method.clone(), request.url.clone())
        .body(request.body.clone());

    for (name, value) in &request.headers {
        request_builder = request_builder.header(name, value);
    }

    let request = request_builder.build().map_err(|e| {
        tracing::error!("Failed to build request: {}", e);
        e
    })?;
    let response = client.execute(request).await?;

    let status = response.status();
    let headers = response.headers().clone();
    let body = response.bytes().await?;

    tracing::error!("OAUTH2 TOKEN RESPONSE STATUS: {}", status);
    let body_text = String::from_utf8_lossy(&body);
    tracing::error!("OAUTH2 TOKEN RESPONSE BODY: {}", body_text);

    Ok(oauth2::HttpResponse {
        status_code: status,
        headers,
        body: body.to_vec(),
    })
}
