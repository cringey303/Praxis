use axum::{
    Router,
    http::{Method, header},
    routing::{get, post},
};
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use time::Duration;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tower_sessions::{Expiry, SessionManagerLayer, cookie::SameSite};
use tower_sessions_sqlx_store::PostgresStore;

mod auth;
mod user;

#[tokio::main]
async fn main() {
    // load env variables
    dotenv().ok();
    // setup logging (view SQL queries or errors in terminal)
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                // Default filter if RUST_LOG is not set
                "api=debug,tower_http=debug,tower_sessions=debug,sqlx=info".into()
            }),
        )
        .init();

    // --- Connect to Database --- //
    // get database url saved in .env
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // a pool is a group of open connections to the database
    let pool = PgPoolOptions::new()
        .max_connections(5) // only 5 during development
        .connect(&database_url) // connect to Docker/Postgres
        .await
        .expect("Failed to connect to DB");

    // --- Setup Session --- //
    let session_store = PostgresStore::new(pool.clone());
    session_store
        .migrate()
        .await
        .expect("Failed to migrate session store");
    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(false) // set to true in production (requires https)
        .with_same_site(SameSite::Lax)
        .with_expiry(Expiry::OnInactivity(Duration::days(1)));
    let cors = CorsLayer::new()
        .allow_origin(
            "http://localhost:3000"
                .parse::<axum::http::HeaderValue>()
                .unwrap(),
        )
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT])
        .allow_credentials(true);

    // create empty web app and run mapped fns if routes are visited
    let app = Router::new()
        .route("/", get(root))
        .route("/auth/signup", post(auth::signup)) // map /auth/signup to fn signup in auth module
        .route("/auth/login", post(auth::login)) // map /auth/login to fn login in auth module
        .route("/auth/google/login", get(auth::google_login)) // when user clicks login with google
        .route("/auth/google/callback", get(auth::google_callback)) // where google redirects to after login
        .route("/auth/logout", post(auth::logout))
        .route("/user/me", get(user::get_me))
        .route("/user/profile", post(user::update_profile))
        .route("/user/all", get(user::get_all))
        .route("/user/:id", axum::routing::delete(user::delete_user))
        .layer(session_layer)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(pool); // injecting the DB pool

    //define route
    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));

    //start server
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(e) => {
            if e.kind() == std::io::ErrorKind::AddrInUse {
                eprintln!("Error: Port 8080 is already in use.");
                eprintln!("You can identify the conflicting process with: lsof -i :8080");
                std::process::exit(1);
            } else {
                panic!("Failed to bind to address: {}", e);
            }
        }
    };
    //get requests and send it to app
    axum::serve(listener, app).await.unwrap();
}

async fn root() -> &'static str {
    "Hey, it's Praxis API!!!!"
}
