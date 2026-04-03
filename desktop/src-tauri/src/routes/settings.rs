use axum::{extract::State, Json};
use serde_json::json;

use crate::{models::settings::AppSettings, server::AppState};

pub async fn get_settings(State(state): State<AppState>) -> Json<serde_json::Value> {
    let settings = state.settings.get().await;
    Json(json!({ "settings": settings }))
}

pub async fn save_settings(
    State(state): State<AppState>,
    Json(settings): Json<AppSettings>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let saved = state.settings.save(settings).await.map_err(|message| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": message })),
        )
    })?;
    Ok(Json(json!({ "success": true, "settings": saved })))
}
