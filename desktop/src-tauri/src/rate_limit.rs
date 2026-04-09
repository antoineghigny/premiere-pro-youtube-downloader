use std::{
    collections::HashMap,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant},
};

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::utils::{rate_limit_window_secs, rate_limit_max_requests};

/// Tracks request counts per client
#[derive(Debug, Default)]
pub struct RateLimiter {
    requests: HashMap<String, RateLimitEntry>,
    total_requests: AtomicU64,
    total_rejected: AtomicU64,
}

#[derive(Debug)]
struct RateLimitEntry {
    count: u64,
    window_start: Instant,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            requests: HashMap::new(),
            total_requests: AtomicU64::new(0),
            total_rejected: AtomicU64::new(0),
        }
    }

    /// Check if a request from the given client_id should be allowed.
    /// Returns Ok if allowed, Err if rate limited.
    pub fn check(&mut self, client_id: &str) -> Result<(), ()> {
        self.total_requests.fetch_add(1, Ordering::Relaxed);

        let window_secs = rate_limit_window_secs();
        let max_requests = rate_limit_max_requests();

        let now = Instant::now();
        let entry = self.requests.entry(client_id.to_string()).or_insert_with(|| {
            RateLimitEntry {
                count: 0,
                window_start: now,
            }
        });

        // Reset window if expired
        if now.duration_since(entry.window_start) > Duration::from_secs(window_secs) {
            entry.count = 0;
            entry.window_start = now;
        }

        entry.count += 1;

        if entry.count > max_requests {
            self.total_rejected.fetch_add(1, Ordering::Relaxed);
            return Err(());
        }

        Ok(())
    }

    /// Clean up expired entries. Should be called periodically.
    pub fn cleanup(&mut self) {
        let window_secs = rate_limit_window_secs();
        let now = Instant::now();
        self.requests.retain(|_, entry| {
            now.duration_since(entry.window_start) < Duration::from_secs(window_secs)
        });
    }
}

/// Extracts a client identifier from the request.
/// Uses X-Forwarded-For header if present (for reverse proxy scenarios),
/// otherwise falls back to connection IP or a combination of headers.
fn extract_client_id<B>(request: &Request<B>) -> String {
    // First check for X-Forwarded-For header
    if let Some(forwarded) = request.headers().get("x-forwarded-for") {
        if let Ok(forwarded_str) = forwarded.to_str() {
            // Take the first IP in the chain (original client)
            if let Some(client_ip) = forwarded_str.split(',').next() {
                return format!("ip:{}", client_ip.trim());
            }
        }
    }

    // Fall back to extension ID if present (for browser extension requests)
    if let Some(extension_id) = request.headers().get("x-yt2pp-extension-id") {
        if let Ok(id) = extension_id.to_str() {
            return format!("ext:{}", id);
        }
    }

    // Fall back to desktop token if present
    if let Some(token) = request.headers().get("x-yt2pp-desktop-token") {
        if let Ok(t) = token.to_str() {
            // Use first 8 characters as identifier to avoid leaking full token
            let truncated = t.chars().take(8).collect::<String>();
            return format!("desktop:{}", truncated);
        }
    }

    // Fall back to CEP token if present
    if let Some(token) = request.headers().get("x-yt2pp-cep-token") {
        if let Ok(t) = token.to_str() {
            let truncated = t.chars().take(8).collect::<String>();
            return format!("cep:{}", truncated);
        }
    }

    // Default: use the Origin header as a pseudo-identifier
    if let Some(origin) = request.headers().get("origin") {
        if let Ok(o) = origin.to_str() {
            return format!("origin:{}", o);
        }
    }

    // Fallback for unidentifiable requests
    "unknown".to_string()
}

pub async fn rate_limit_middleware(
    State(limiter): State<std::sync::Arc<tokio::sync::Mutex<RateLimiter>>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let client_id = extract_client_id(&request);

    // Check rate limit
    {
        let mut limiter_guard = limiter.lock().await;
        if limiter_guard.check(&client_id).is_err() {
            let retry_after = rate_limit_window_secs();
            tracing::warn!(
                client_id = %client_id,
                "Rate limit exceeded"
            );
            return (
                StatusCode::TOO_MANY_REQUESTS,
                axum::Json(serde_json::json!({
                    "error": "Rate limit exceeded. Please wait before making more requests.",
                    "retryAfter": retry_after
                })),
            )
                .into_response();
        }
    }

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_limiter_allows_within_limit() {
        let mut limiter = RateLimiter::new();
        let max = rate_limit_max_requests();
        for _ in 0..max {
            assert!(limiter.check("test_client").is_ok());
        }
        // Next request should fail
        assert!(limiter.check("test_client").is_err());
    }

    #[test]
    fn rate_limiter_tracks_different_clients_separately() {
        let mut limiter = RateLimiter::new();
        let max = rate_limit_max_requests();
        for _ in 0..max {
            assert!(limiter.check("client_a").is_ok());
        }
        // client_b should still be allowed
        assert!(limiter.check("client_b").is_ok());
    }
}
