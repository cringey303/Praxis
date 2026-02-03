use axum::{
    http::{header, Method},
    routing::{get, post},
    Router,
};
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use time::Duration;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tower_sessions::{cookie::SameSite, Expiry, SessionManagerLayer};
use tower_sessions_sqlx_store::PostgresStore;

mod announcements;
mod auth;
mod r2;
mod upload;
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

    // R2 cloud storage is used instead of local filesystem

    // --- Connect to Database --- //
    // get database url saved in .env
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // a pool is a group of open connections to the database
    let pool = PgPoolOptions::new()
        .max_connections(5) // only 5 during development
        .connect(&database_url) // connect to Docker/Postgres
        .await
        .expect("Failed to connect to DB");

    // --- Run Migrations --- //
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // --- Setup Session --- //
    let session_store = PostgresStore::new(pool.clone());
    session_store
        .migrate()
        .await
        .expect("Failed to migrate session store");

    // Secure cookie setting: Use true in production (requires HTTPS), false in dev
    let is_production = std::env::var("RAILWAY_ENVIRONMENT").is_ok()
        || std::env::var("RAILWAY_PUBLIC_DOMAIN").is_ok();

    // If we use SameSite::None, we MUST use Secure=true, otherwise browsers reject it.
    // So we force secure=true in production.
    let secure_cookies = is_production;
    let same_site = if is_production {
        SameSite::None
    } else {
        SameSite::Lax
    };

    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(secure_cookies)
        .with_same_site(same_site)
        .with_expiry(Expiry::OnInactivity(Duration::days(1)));

    // CORS Setup: Allow Frontend URL(s)
    let frontend_urls_env =
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());

    let frontend_urls: Vec<_> = frontend_urls_env
        .split(',')
        .map(|url| {
            url.trim()
                .parse::<axum::http::HeaderValue>()
                .expect("Invalid FRONTEND_URL")
        })
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(frontend_urls)
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
        .route("/auth/github/login", get(auth::github_login))
        .route("/auth/github/callback", get(auth::github_callback))
        .route("/auth/verify", post(auth::verify_email))
        .route("/auth/resend-verification", post(auth::resend_verification))
        .route("/auth/change-password", post(auth::change_password))
        .route("/auth/logout", post(auth::logout))
        .route("/user/me", get(user::get_me))
        .route("/user/profile", post(user::update_profile))
        .route("/user/profile/:username", get(user::get_public_profile))
        .route("/user/all", get(user::get_all))
        .route("/user/test", post(user::create_test_user))
        .route("/user/:id", axum::routing::delete(user::delete_user))
        .route("/upload", post(upload::upload_image))
        .route("/announcement", get(announcements::get_latest))
        .route("/announcement", post(announcements::create))
        // Images are now served directly from Cloudflare R2
        .layer(session_layer)
        .layer(cors)
        .layer(tower_http::limit::RequestBodyLimitLayer::new(
            10 * 1024 * 1024,
        )) // 10MB limit
        .layer(TraceLayer::new_for_http())
        .with_state(pool);

    // BIND to 0.0.0.0 for Docker/Railway support
    // Allow PORT env var or default to 8080
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let port_num = port.parse::<u16>().expect("Invalid PORT");
    let addr = SocketAddr::from(([0, 0, 0, 0], port_num));

    //start server
    println!("Listening on {}", addr);
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(e) => {
            if e.kind() == std::io::ErrorKind::AddrInUse {
                eprintln!("Error: Port {} is already in use.", port_num);
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
