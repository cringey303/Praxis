use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
};
use oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, RedirectUrl, Scope, TokenResponse, TokenUrl,
    basic::BasicClient,
};
use serde::Deserialize;
use sqlx::PgPool;
use tower_sessions::Session;

// request structure we get from the frontend
#[derive(Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub username: String,
    pub display_name: String,
}

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

    // create random salt string
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        // combine password + salt and run math
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        // convert to string to save in DB
        .to_string();

    // start SQL transaction to insert `users` and `local_auths` tables
    // Transaction ensures everything or nothing is executed
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_id = sqlx::query!(
        // `RETURNING id` is a Postgres feature that returns the UUID it just generated
        "INSERT INTO users (username, display_name) VALUES ($1, $2) RETURNING id",
        payload.username,
        payload.display_name
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .id;

    sqlx::query!(
        "INSERT INTO local_auths (user_id, email, password_hash) VALUES ($1, $2, $3)",
        user_id,
        payload.email,
        password_hash
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, "User created successfully"))
}

/*
* Function: login
* Description: takes LoginRequest and stores in DB
* Inputs:
* Gets .with_state from main.rs
* parses request and stores in payload
*
* Returns:
* success: Ok(impl IntoResponse
* OR an error tuple: Err((StatusCode, String))
*/
pub async fn login(
    State(pool): State<PgPool>,
    session: Session,
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
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // verify password
    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                "Invalid email or password".to_string(),
            )
        })?;

    // Set Session
    session
        .insert("user_id", user.user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // return success
    Ok((StatusCode::OK, "Login successful"))
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
            google_user.email.split('@').next().unwrap_or("user"),
            google_user.name
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .id;

        // insert into local_auths with dummy password
        // TODO: handle null password_hash
        sqlx::query!(
            "INSERT INTO local_auths (user_id, email, password_hash) VALUES ($1, $2, $3)",
            new_user_id,
            google_user.email,
            "$argon2id$v=19$m=19456,t=2,p=1$dummy$dummy"
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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

    let frontend_url =
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    Ok(Redirect::to(&frontend_url))
}
