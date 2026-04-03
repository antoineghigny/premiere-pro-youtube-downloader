use axum::{extract::State, Json};
use serde_json::json;

use crate::{
    server::AppState,
    utils::{backend_instance_kind, APP_FINGERPRINT, BACKEND_API_VERSION, BACKEND_TRANSPORT},
};

pub async fn root(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "app": APP_FINGERPRINT,
        "apiVersion": BACKEND_API_VERSION,
        "transport": BACKEND_TRANSPORT,
        "instanceKind": backend_instance_kind(),
        "version": env!("CARGO_PKG_VERSION"),
        "port": state.server_port(),
        "pid": std::process::id(),
    }))
}

pub async fn root_post() -> Json<serde_json::Value> {
    Json(json!({ "success": true }))
}

pub async fn get_version() -> Json<serde_json::Value> {
    Json(json!({ "version": env!("CARGO_PKG_VERSION") }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn root_exposes_backend_fingerprint() {
        let temp_dir = tempdir().expect("temp dir");
        let state = crate::server::AppState::for_tests(temp_dir.path()).expect("state");

        let Json(payload) = root(State(state)).await;

        assert_eq!(payload["app"], APP_FINGERPRINT);
        assert_eq!(payload["apiVersion"], BACKEND_API_VERSION);
        assert_eq!(payload["transport"], BACKEND_TRANSPORT);
        assert_eq!(payload["instanceKind"], backend_instance_kind());
        assert_eq!(payload["port"], 3001);
        assert_eq!(payload["version"], env!("CARGO_PKG_VERSION"));
    }
}
