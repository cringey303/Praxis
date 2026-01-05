use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use serde::Deserialize;
use sqlx::PgPool;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};

// request structure we get from the frontend
#[derive(Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub username: String,
    pub display_name: String,
}

/*
* Inputs: 
* Gets .with_state from main.rs
* parses request and stores in payload
* 
* Returns:
* success: Ok(impl IntoResponse
* OR an error tuple: Err((StatusCode, String))
*/
pub async fn signup_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<SignupRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> { 

    // check if email already exists
    let email_exists = sqlx::query!("SELECT user_id FROM local_auths WHERE email = $1", payload.email)
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

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, "User created successfully"))
}
