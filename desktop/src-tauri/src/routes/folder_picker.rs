use std::path::PathBuf;

use axum::Json;
use serde::Deserialize;
use serde_json::json;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PickFolderRequest {
    pub title: String,
    pub initial_path: String,
}

pub async fn pick_folder(
    Json(payload): Json<PickFolderRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let mut dialog = rfd::FileDialog::new();
    if !payload.title.trim().is_empty() {
        dialog = dialog.set_title(payload.title);
    }
    if !payload.initial_path.trim().is_empty() {
        dialog = dialog.set_directory(PathBuf::from(payload.initial_path));
    }

    match dialog.pick_folder() {
        Some(path) => Ok(Json(json!({
            "success": true,
            "cancelled": false,
            "path": path.to_string_lossy().to_string()
        }))),
        None => Ok(Json(json!({
            "success": false,
            "cancelled": true
        }))),
    }
}
