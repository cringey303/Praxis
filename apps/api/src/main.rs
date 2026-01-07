use axum::{routing::{get, post}, Router};
use std::net::SocketAddr;
use tower_http::cors::{CorsLayer, Any};
use sqlx::postgres::PgPoolOptions;
use dotenvy::dotenv;
use tower_sessions::{SessionManagerLayer, Expiry};
use tower_sessions_sqlx_store::PostgresStore;
use time::Duration;

mod auth;

#[tokio::main]
async fn main() {
    // load env variables
    dotenv().ok();
    // setup logging (view SQL queries or errors in terminal)
    tracing_subscriber::fmt::init();

    // --- Connect to Database --- //
    // get database url saved in .env
    let database_url = std::env::var("DATABASE_URL")
    .expect("DATABASE_URL must be set");

    // a pool is a group of open connections to the database
    let pool = PgPoolOptions::new()
        .max_connections(5) // only 5 during development
        .connect(&database_url) // connect to Docker/Postgres
        .await
        .expect("Failed to connect to DB");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // create empty web app and run 'root' if "/" homepage is visited
    let app = Router::new()
        .route("/", get(root))
        .route("/auth/signup", post(auth::signup_handler)) // map /auth/signup to fn signup_handler in auth module
        .route("/auth/login", post(auth::login_handler)) // map /auth/login to fn login_handler in auth module
        .layer(cors)
        .with_state(pool); // injecting the DB pool

    //define route
    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));

    //start server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    //get requests and send it to app
    axum::serve(listener, app).await.unwrap();
}

async fn root() -> &'static str {
    "Hey, it's Praxis API!!!!"
}