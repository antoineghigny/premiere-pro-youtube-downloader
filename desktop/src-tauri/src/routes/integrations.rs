use axum::{extract::State, Json};
use serde_json::json;

use crate::{server::AppState, services::integrations};

pub async fn integration_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "status": integrations::integration_status(&state)
    }))
}

pub async fn install_premiere(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    integrations::install_premiere_panel(&state)
        .map(|result| Json(json!(result)))
        .map_err(|message| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({ "error": message })),
            )
        })
}

pub async fn open_browser_setup(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    integrations::open_browser_setup(&state)
        .map(|result| Json(json!(result)))
        .map_err(|message| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({ "error": message })),
            )
        })
}
