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

fn is_allowed_cep_port(port: u16) -> bool {
    matches!(port, 3000 | 3021 | 3022 | 3023 | 3024 | 3025)
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
    if !is_allowed_cep_port(payload.port) {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": "CEP port is not allowed" })),
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
