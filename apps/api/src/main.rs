use axum::{routing::get, Router};
use std::net::SocketAddr;
use tower_http::cors::{CorsLayer, Any};

#[tokio::main]
async fn main() {
    // setup logging (view SQL queries or errors in terminal)
    tracing_subscriber::fmt::init();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // create empty web app and run 'root' if "/" homepage is visited
    let app = Router::new()
        .route("/", get(root))
        .layer(cors);

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