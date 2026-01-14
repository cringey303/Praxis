use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .connect(&database_url)
        .await
        .expect("Failed to connect to DB");

    // Change 'lucas' to your actual username if different
    let username = "lucas";

    let result = sqlx::query("UPDATE users SET role = 'admin' WHERE username = $1")
        .bind(username)
        .execute(&pool)
        .await
        .expect("Failed to update user");

    if result.rows_affected() == 0 {
        println!(
            "⚠️  No user found with username '{}'. Please check the username.",
            username
        );
    } else {
        println!(
            "✅ User '{}' has been successfully promoted to admin!",
            username
        );
    }
}
