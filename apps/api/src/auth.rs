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

// pub async fn signup_handler(
//     State(pool): State<PgPool>,
//     Json(payload): Json<SignupRequest>,
// ) -> Result<impl IntoResponse, (StatusCode, String)> {

//     // check if email already exists
//     let email_exists = sqlx::query!("SELECT id FROM local_auths WHERE email = $1", payload.email)
//     .fetch_optional(&pool)
//     .await
//     .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

//     if email_exists.is_some() {
//         return Err((StatusCode::CONFLICT, "Email already exists".to_string()));
//     }


// }