use axum::{
    body::Body,
    http::{
        header::{
            ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS,
            ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_MAX_AGE, ORIGIN,
        },
        HeaderName, HeaderValue, Method, Request, StatusCode,
    },
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

const DEFAULT_EXTENSION_IDS: &str =
    "noloogahcbofnjjkpbeandcgoldejcic,aidffebbdmdjibggcfkeihnljgambjjd";
const TRUSTED_WEB_ORIGINS: &[&str] = &["https://www.youtube.com"];
const TRUSTED_WEB_ORIGIN_PATHS: &[&str] = &["/handle-video-url"];
const TRUSTED_TAURI_ORIGINS: &[&str] = &[
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
];

fn trusted_extension_origins() -> Vec<String> {
    std::env::var("YT2PP_EXTENSION_IDS")
        .unwrap_or_else(|_| DEFAULT_EXTENSION_IDS.to_string())
        .split(',')
        .filter_map(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(format!("chrome-extension://{}", trimmed))
            }
        })
        .collect()
}

fn is_desktop_request(request: &Request<Body>) -> bool {
    request
        .headers()
        .get("x-yt2pp-desktop")
        .and_then(|value| value.to_str().ok())
        .map(|value| value == "1")
        .unwrap_or(false)
}

fn is_cep_request(request: &Request<Body>) -> bool {
    request
        .headers()
        .get("x-yt2pp-cep")
        .and_then(|value| value.to_str().ok())
        .map(|value| value == "1")
        .unwrap_or(false)
}

pub fn is_allowed_socket_origin(origin: &str) -> bool {
    let normalized = origin.trim();
    trusted_extension_origins()
        .iter()
        .any(|candidate| candidate == normalized)
        || TRUSTED_WEB_ORIGINS.contains(&normalized)
        || TRUSTED_TAURI_ORIGINS.contains(&normalized)
}

fn is_allowed_request_origin(origin: &str, path: &str) -> bool {
    let normalized = origin.trim();
    if trusted_extension_origins()
        .iter()
        .any(|candidate| candidate == normalized)
    {
        return true;
    }

    if TRUSTED_TAURI_ORIGINS.contains(&normalized) {
        return true;
    }

    TRUSTED_WEB_ORIGIN_PATHS.contains(&path) && TRUSTED_WEB_ORIGINS.contains(&normalized)
}

fn apply_cors_headers(
    response: &mut Response,
    origin: Option<HeaderValue>,
    desktop_request: bool,
    cep_request: bool,
    request_headers: HeaderValue,
) {
    if let Some(origin) = origin {
        response
            .headers_mut()
            .insert(ACCESS_CONTROL_ALLOW_ORIGIN, origin);
    } else if desktop_request || cep_request {
        response
            .headers_mut()
            .insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    }

    response.headers_mut().insert(
        ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET,POST,DELETE,OPTIONS"),
    );
    response
        .headers_mut()
        .insert(ACCESS_CONTROL_ALLOW_HEADERS, request_headers);
    response
        .headers_mut()
        .insert(ACCESS_CONTROL_MAX_AGE, HeaderValue::from_static("600"));
    response.headers_mut().insert(
        HeaderName::from_static("access-control-allow-private-network"),
        HeaderValue::from_static("true"),
    );
}

fn error_response(
    status: StatusCode,
    message: &str,
    origin: Option<HeaderValue>,
    desktop_request: bool,
    cep_request: bool,
    request_headers: HeaderValue,
) -> Response {
    let mut response = (status, axum::Json(json!({ "error": message }))).into_response();
    apply_cors_headers(
        &mut response,
        origin,
        desktop_request,
        cep_request,
        request_headers,
    );
    response
}

pub async fn enforce_request_origin(request: Request<Body>, next: Next) -> Response {
    let desktop_request = is_desktop_request(&request);
    let cep_request = is_cep_request(&request);
    let origin_header = request.headers().get(ORIGIN).cloned();
    let request_headers = request
        .headers()
        .get("access-control-request-headers")
        .cloned()
        .unwrap_or_else(|| HeaderValue::from_static("Content-Type"));
    let origin = request
        .headers()
        .get(ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let path = request.uri().path().to_string();

    if request.method() == Method::OPTIONS {
        if !desktop_request && !cep_request {
            if let Some(origin) = origin {
                if !is_allowed_request_origin(origin, &path) {
                    return error_response(
                        StatusCode::FORBIDDEN,
                        "Origin not allowed",
                        origin_header,
                        desktop_request,
                        cep_request,
                        request_headers,
                    );
                }
            }
        }

        let mut response = StatusCode::NO_CONTENT.into_response();
        apply_cors_headers(
            &mut response,
            origin_header,
            desktop_request,
            cep_request,
            request_headers,
        );
        return response;
    }

    if matches!(request.method(), &Method::POST | &Method::DELETE)
        && origin.is_none()
        && !desktop_request
        && !cep_request
    {
        return error_response(
            StatusCode::FORBIDDEN,
            "Origin required",
            origin_header,
            desktop_request,
            cep_request,
            request_headers,
        );
    }

    if let Some(origin) = origin {
        if !is_allowed_request_origin(origin, &path) && !desktop_request && !cep_request {
            return error_response(
                StatusCode::FORBIDDEN,
                "Origin not allowed",
                origin_header,
                desktop_request,
                cep_request,
                request_headers,
            );
        }
    }

    let mut response = next.run(request).await;
    apply_cors_headers(
        &mut response,
        origin_header,
        desktop_request,
        cep_request,
        request_headers,
    );
    response
}
