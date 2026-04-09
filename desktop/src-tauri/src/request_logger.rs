use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use std::time::Instant;

/// Logs all incoming requests with relevant security information.
pub async fn request_logging_middleware(request: Request<Body>, next: Next) -> Response {
    let method = request.method().to_string();
    let path = request.uri().path().to_string();
    let start = Instant::now();

    // Extract request metadata for logging
    let client_type = identify_client(&request);
    let content_type = request
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-");

    // Log request
    tracing::info!(
        method = %method,
        path = %path,
        client_type = %client_type,
        content_type = %content_type,
        "Request received"
    );

    let response = next.run(request).await;

    // Log response
    let duration = start.elapsed();
    let status = response.status();

    tracing::info!(
        status = %status.as_u16(),
        duration_ms = %duration.as_millis(),
        client_type = %client_type,
        "Request completed"
    );

    // Log suspicious activity
    if matches!(status, StatusCode::FORBIDDEN | StatusCode::TOO_MANY_REQUESTS) {
        tracing::warn!(
            status = %status.as_u16(),
            path = %path,
            client_type = %client_type,
            "Request rejected"
        );
    }

    response
}

/// Identifies the type of client making the request.
fn identify_client(request: &Request<Body>) -> &'static str {
    if request.headers().get("x-yt2pp-desktop").is_some() {
        return "desktop";
    }

    if request.headers().get("x-yt2pp-cep").is_some() {
        return "cep";
    }

    if request.headers().get("x-yt2pp-extension-id").is_some() {
        return "extension";
    }

    // Check origin for WebSocket connections
    if let Some(origin) = request.headers().get("origin") {
        if let Ok(origin_str) = origin.to_str() {
            if origin_str.starts_with("chrome-extension://")
                || origin_str.starts_with("moz-extension://")
            {
                return "extension";
            }
            if origin_str.starts_with("tauri://") || origin_str.starts_with("http://tauri.localhost") || origin_str.starts_with("https://tauri.localhost") {
                return "desktop";
            }
        }
    }

    "unknown"
}
