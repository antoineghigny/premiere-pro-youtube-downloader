pub mod download;
pub mod folder_picker;
pub mod health;
pub mod history;
pub mod integrations;
pub mod premiere;
pub mod settings;
pub mod video_info;

use axum::http::StatusCode;

pub async fn options_ok() -> StatusCode {
    StatusCode::NO_CONTENT
}
