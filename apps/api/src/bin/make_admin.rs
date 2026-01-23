use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;

// run with 'cargo run --bin make_admin'

#[tokio::main]
async fn main() {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: cargo run --bin make_admin -- <username>");
        return;
    }
    let username = &args[1];

    let pool = PgPoolOptions::new()
        .connect(&database_url)
        .await
        .expect("Failed to connect to DB");

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
