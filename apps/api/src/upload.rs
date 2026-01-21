use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use axum_extra::extract::Multipart;
use serde_json::json;
use sqlx::PgPool;
use std::path::Path;
use tokio::fs;
use uuid::Uuid;

pub async fn upload_image(
    State(_pool): State<PgPool>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut image_url = None;

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();
        let file_name = field.file_name().unwrap_or("").to_string();
        let content_type = field.content_type().unwrap_or("").to_string();

        if name == "file" {
            // Validate content type
            if !content_type.starts_with("image/") {
                return (StatusCode::BAD_REQUEST, "Invalid file type").into_response();
            }

            let data = match field.bytes().await {
                Ok(data) => data,
                Err(_) => {
                    return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read file")
                        .into_response();
                }
            };

            // Generate unique filename
            let ext = Path::new(&file_name)
                .extension()
                .and_then(std::ffi::OsStr::to_str)
                .unwrap_or("jpg");
            let new_filename = format!("{}.{}", Uuid::new_v4(), ext);
            let filepath = format!("uploads/{}", new_filename);

            // Save file
            if let Err(e) = fs::write(&filepath, data).await {
                eprintln!("Failed to save file: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to save file").into_response();
            }

            // Return the public URL
            // Assuming the server is running on localhost:8080 or the client knows the base URL
            // We return the relative path, the frontend can prepend the API base URL
            image_url = Some(format!("/uploads/{}", new_filename));
        }
    }

    if let Some(url) = image_url {
        Json(json!({ "url": url })).into_response()
    } else {
        (StatusCode::BAD_REQUEST, "No file uploaded").into_response()
    }
}
