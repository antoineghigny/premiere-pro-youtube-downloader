use std::path::PathBuf;

use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{server::AppState, services::premiere};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevealFileRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterCepRequest {
    pub port: u16,
}

pub async fn premiere_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    let status = premiere::premiere_status(&state).await;
    Json(json!(status))
}

pub async fn register_cep(
    State(state): State<AppState>,
    Json(payload): Json<RegisterCepRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    if payload.port == 0 {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": "CEP port is required" })),
        ));
    }

    state.register_cep_port(payload.port);
    Ok(Json(json!({ "success": true, "port": payload.port })))
}

pub async fn reveal_file(
    State(_state): State<AppState>,
    Json(payload): Json<RevealFileRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    premiere::reveal_file(&PathBuf::from(payload.path))
        .await
        .map_err(|message| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({ "error": message })),
            )
        })?;
    Ok(Json(json!({ "success": true })))
}
