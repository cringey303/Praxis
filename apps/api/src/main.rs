use axum::{
    http::{header, Method},
    routing::{delete, get, post},
    Router,
};
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use time::Duration;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tower_sessions::{cookie::SameSite, Expiry, SessionManagerLayer};
use tower_sessions_sqlx_store::PostgresStore;

mod admin;
mod announcements;
mod auth;
mod feed;
mod passkey;
mod posts;
mod projects;
mod r2;
mod session;
mod totp;
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
        // Auth Routes
        .route("/auth/signup", post(auth::signup))
        .route("/auth/login", post(auth::login))
        .route("/auth/verify-email", post(auth::verify_email))
        .route("/auth/resend-verification", post(auth::resend_verification))
        .route("/auth/change-password", post(auth::change_password))
        .route("/auth/set-password", post(auth::set_password))
        .route("/auth/forgot-password", post(auth::forgot_password))
        .route("/auth/reset-password", post(auth::reset_password))
        // OAuth
        .route("/auth/google", get(auth::google_login))
        .route("/auth/google/callback", get(auth::google_callback))
        .route("/auth/github", get(auth::github_login))
        .route("/auth/github/callback", get(auth::github_callback))
        .route("/auth/logout", post(auth::logout))
        // Linked Accounts
        .route("/auth/linked-accounts", get(auth::list_linked_accounts))
        .route(
            "/auth/linked-accounts/:provider",
            delete(auth::unlink_account),
        )
        // Admin Routes
        .route(
            "/admin/users/:id/reset-password",
            post(admin::reset_user_password),
        )
        // Session Management
        .route(
            "/auth/sessions",
            get(session::list_sessions).delete(session::revoke_all_other_sessions),
        )
        .route("/auth/sessions/:id", delete(session::revoke_session))
        .route("/user/me", get(user::get_me))
        .route("/user/profile", post(user::update_profile))
        .route("/user/profile/:username", get(user::get_public_profile))
        .route("/user/all", get(user::get_all))
        .route("/user/test", post(user::create_test_user))
        .route("/user/:id", axum::routing::delete(user::delete_user))
        .route("/upload", post(upload::upload_image))
        .route("/announcement", get(announcements::get_latest))
        .route("/announcement", post(announcements::create))
        .route("/announcements/recent", get(announcements::get_recent))
        .route("/announcements", get(announcements::get_all))
        .route("/posts", get(posts::list).post(posts::create))
        .route("/projects", get(projects::list).post(projects::create))
        .route("/feed", get(feed::get_feed))
        // Passkeys
        .route(
            "/auth/passkey/register/start",
            post(passkey::start_registration),
        )
        .route(
            "/auth/passkey/register/finish",
            post(passkey::finish_registration),
        )
        .route(
            "/auth/passkey/auth/start",
            post(passkey::start_authentication),
        )
        .route(
            "/auth/passkey/auth/finish",
            post(passkey::finish_authentication),
        )
        .route("/auth/passkey/list", get(passkey::list_passkeys))
        .route("/auth/passkey/:id", delete(passkey::delete_passkey))
        // TOTP 2FA
        .route("/auth/totp/setup", post(totp::setup_totp))
        .route("/auth/totp/enable", post(totp::enable_totp))
        .route("/auth/totp/disable", post(totp::disable_totp))
        .route("/auth/totp/verify", post(totp::verify_totp))
        .route("/auth/totp/status", get(totp::get_totp_status))
        .route(
            "/auth/totp/backup-codes",
            post(totp::regenerate_backup_codes),
        )
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
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

async fn root() -> &'static str {
    "Hey, it's Praxis API!!!!"
}
