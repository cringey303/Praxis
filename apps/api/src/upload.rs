use axum::{
    http::StatusCode,
    response::{IntoResponse, Json},
};
use axum_extra::extract::Multipart;
use serde_json::json;
use std::path::Path;
use uuid::Uuid;

use crate::r2::{create_r2_client, upload_to_r2};

pub async fn upload_image(mut multipart: Multipart) -> impl IntoResponse {
    let mut image_url = None;

    // Get bucket name from environment
    let bucket_name = match std::env::var("R2_BUCKET_NAME") {
        Ok(name) => name,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "R2_BUCKET_NAME not configured",
            )
                .into_response();
        }
    };

    // Create R2 client
    let client = create_r2_client();

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

            // Upload to R2
            match upload_to_r2(
                &client,
                &bucket_name,
                &new_filename,
                data.to_vec(),
                &content_type,
            )
            .await
            {
                Ok(url) => {
                    image_url = Some(url);
                }
                Err(e) => {
                    eprintln!("Failed to upload to R2: {:?}", e);
                    return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to upload file")
                        .into_response();
                }
            }
        }
    }

    if let Some(url) = image_url {
        Json(json!({ "url": url })).into_response()
    } else {
        (StatusCode::BAD_REQUEST, "No file uploaded").into_response()
    }
}
