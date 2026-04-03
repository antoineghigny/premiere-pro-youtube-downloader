use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{server::AppState, services::downloader};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfoRequest {
    pub video_url: String,
}

pub async fn video_info(
    State(state): State<AppState>,
    Json(payload): Json<VideoInfoRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let info = downloader::fetch_video_info(&state, &payload.video_url)
        .await
        .map_err(|message| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({ "error": message })),
            )
        })?;
    Ok(Json(json!({ "info": info })))
}
