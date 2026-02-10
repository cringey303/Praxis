use axum::{
    extract::Path,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde_json::Value;

// Proxy endpoint for ip-api.com
pub async fn get_geoip(Path(ip): Path<String>) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Validate IP address format to prevent misuse (basic check)
    if ip.parse::<std::net::IpAddr>().is_err() {
        return Err((StatusCode::BAD_REQUEST, "Invalid IP address".to_string()));
    }

    let url = format!(
        "http://ip-api.com/json/{}?fields=city,regionName,status",
        ip
    );

    // Use reqwest to fetch data from ip-api.com
    // standard reqwest client can handle http
    let resp = reqwest::get(&url).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch GeoIP: {}", e),
        )
    })?;

    if !resp.status().is_success() {
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("Upstream error: {}", resp.status()),
        ));
    }

    let data: Value = resp.json().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to parse GeoIP response: {}", e),
        )
    })?;

    Ok(Json(data))
}
