use axum::{routing::get, Router};

#[tokio::main]
async fn main() {
    // setup logging (view SQL queries or errors in terminal)
    tracing_subscriber::fmt::init();
}

// create empty web app and run 'root' if "/" homepage is visited
let app = Router::new().route("/", get(root));