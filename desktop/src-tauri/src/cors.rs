use axum::{
    body::Body,
    extract::State,
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

use crate::server::AppState;

const DEFAULT_EXTENSION_IDS: &str = "noloogahcbofnjjkpbeandcgoldejcic,aidffebbdmdjibggcfkeihnljgambjjd";
const TRUSTED_TAURI_ORIGINS: &[&str] = &[
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
];
const DESKTOP_AUTH_HEADER: &str = "x-yt2pp-desktop-token";
const CEP_AUTH_HEADER: &str = "x-yt2pp-cep-token";
const EXTENSION_ID_HEADER: &str = "x-yt2pp-extension-id";

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
        || TRUSTED_TAURI_ORIGINS.contains(&normalized)
}

fn is_allowed_request_origin(origin: &str) -> bool {
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

    false
}

fn trusted_extension_ids() -> Vec<String> {
    std::env::var("YT2PP_EXTENSION_IDS")
        .unwrap_or_else(|_| DEFAULT_EXTENSION_IDS.to_string())
        .split(',')
        .filter_map(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .collect()
}

fn is_trusted_extension_id(extension_id: &str) -> bool {
    let normalized = extension_id.trim();
    !normalized.is_empty()
        && trusted_extension_ids()
            .iter()
            .any(|candidate| candidate == normalized)
}

fn has_valid_token(request: &Request<Body>, header_name: &str, expected: &str) -> bool {
    request
        .headers()
        .get(header_name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value == expected)
        .unwrap_or(false)
}

fn trusted_extension_request(request: &Request<Body>) -> bool {
    request
        .headers()
        .get(EXTENSION_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(is_trusted_extension_id)
        .unwrap_or(false)
}

fn apply_cors_headers(
    response: &mut Response,
    origin: Option<HeaderValue>,
    _desktop_request: bool,
    _cep_request: bool,
    request_headers: HeaderValue,
) {
    if let Some(origin) = origin {
        response
            .headers_mut()
            .insert(ACCESS_CONTROL_ALLOW_ORIGIN, origin);
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

pub async fn enforce_request_origin(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let desktop_request = is_desktop_request(&request);
    let cep_request = is_cep_request(&request);
    let extension_request = trusted_extension_request(&request);
    let desktop_authenticated =
        desktop_request && has_valid_token(&request, DESKTOP_AUTH_HEADER, state.auth.desktop_token());
    let cep_authenticated =
        cep_request && has_valid_token(&request, CEP_AUTH_HEADER, state.auth.cep_token());
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

    if request.method() == Method::OPTIONS {
        if desktop_request && !desktop_authenticated {
            return error_response(
                StatusCode::FORBIDDEN,
                "Desktop authentication failed",
                origin_header,
                desktop_request,
                cep_request,
                request_headers,
            );
        }

        if cep_request && !cep_authenticated {
            return error_response(
                StatusCode::FORBIDDEN,
                "Premiere panel authentication failed",
                origin_header,
                desktop_request,
                cep_request,
                request_headers,
            );
        }

        if !desktop_request && !cep_request && !extension_request {
            let Some(origin) = origin else {
                return error_response(
                    StatusCode::FORBIDDEN,
                    "Origin required",
                    origin_header,
                    desktop_request,
                    cep_request,
                    request_headers,
                );
            };

            if !is_allowed_request_origin(origin) {
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

    if desktop_request && !desktop_authenticated {
        return error_response(
            StatusCode::FORBIDDEN,
            "Desktop authentication failed",
            origin_header,
            desktop_request,
            cep_request,
            request_headers,
        );
    }

    if cep_request && !cep_authenticated {
        return error_response(
            StatusCode::FORBIDDEN,
            "Premiere panel authentication failed",
            origin_header,
            desktop_request,
            cep_request,
            request_headers,
        );
    }

    if !desktop_request && !cep_request {
        if let Some(origin) = origin {
            if !is_allowed_request_origin(origin) {
                return error_response(
                    StatusCode::FORBIDDEN,
                    "Origin not allowed",
                    origin_header,
                    desktop_request,
                    cep_request,
                    request_headers,
                );
            }
        } else if !extension_request {
            return error_response(
                StatusCode::FORBIDDEN,
                "Origin required",
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;

    #[test]
    fn request_origins_exclude_youtube_pages() {
        assert!(!is_allowed_request_origin("https://www.youtube.com"));
        assert!(!is_allowed_socket_origin("https://www.youtube.com"));
    }

    #[test]
    fn desktop_token_must_match_expected_value() {
        let request = Request::builder()
            .header(DESKTOP_AUTH_HEADER, "expected-token")
            .body(Body::empty())
            .expect("request");

        assert!(has_valid_token(
            &request,
            DESKTOP_AUTH_HEADER,
            "expected-token"
        ));
        assert!(!has_valid_token(
            &request,
            DESKTOP_AUTH_HEADER,
            "different-token"
        ));
    }
}
