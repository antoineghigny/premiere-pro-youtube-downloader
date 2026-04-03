use axum::{extract::State, Json};
use serde_json::json;

use chrono::Utc;
use uuid::Uuid;

use crate::{
    models::{
        download::DownloadRequest,
        history::{DownloadStatus, HistoryEntry},
    },
    server::AppState,
    services::downloader,
};

pub async fn handle_video_url(
    State(state): State<AppState>,
    Json(mut request): Json<DownloadRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let video_url = request.video_url.trim().to_string();
    if video_url.is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": "No video URL" })),
        ));
    }
    let normalized_scheme = video_url.to_ascii_lowercase();
    if !normalized_scheme.starts_with("http://") && !normalized_scheme.starts_with("https://") {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": "A valid http(s) URL is required" })),
        ));
    }
    if matches!(
        request.download_type,
        crate::models::download::DownloadType::Clip
    ) {
        match (request.clip_in, request.clip_out) {
            (Some(start), Some(end)) if end > start => {}
            _ => {
                return Err((
                    axum::http::StatusCode::BAD_REQUEST,
                    Json(
                        json!({ "error": "clipIn and clipOut are required and clipOut must be greater than clipIn" }),
                    ),
                ));
            }
        }
    }
    request.video_url = video_url.clone();

    let resolved_info = downloader::fetch_video_info(&state, &video_url)
        .await
        .map_err(|message| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({ "error": message })),
            )
        })?;

    let request_id = request
        .request_id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let started_at = Utc::now();

    state
        .history
        .upsert_by_request_id(&request_id, |existing| HistoryEntry {
            id: existing
                .as_ref()
                .map(|entry| entry.id)
                .unwrap_or_else(Uuid::new_v4),
            request_id: request_id.clone(),
            url: video_url.clone(),
            title: resolved_info.title.clone(),
            thumbnail: resolved_info.thumbnail.clone(),
            download_type: request.download_type.clone(),
            output_path: String::new(),
            status: DownloadStatus::Queued,
            started_at,
            completed_at: None,
            file_size: None,
            settings: request.clone(),
        })
        .await
        .map_err(|message| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": message })),
            )
        })?;

    let download_state = state.clone();
    let request_clone = request.clone();
    let request_id_clone = request_id.clone();
    let info_clone = resolved_info.clone();

    tokio::spawn(async move {
        if let Err(message) = downloader::process_download(
            download_state.clone(),
            request_clone.clone(),
            request_id_clone.clone(),
            info_clone.clone(),
        )
        .await
        {
            download_state.emit_failed(&request_id_clone, message.clone());
            let _ = download_state
                .history
                .upsert_by_request_id(&request_id_clone, |existing| HistoryEntry {
                    id: existing
                        .as_ref()
                        .map(|entry| entry.id)
                        .unwrap_or_else(Uuid::new_v4),
                    request_id: request_id_clone.clone(),
                    url: request_clone.video_url.clone(),
                    title: existing
                        .as_ref()
                        .map(|entry| entry.title.clone())
                        .unwrap_or_else(|| info_clone.title.clone()),
                    thumbnail: existing
                        .and_then(|entry| entry.thumbnail)
                        .or_else(|| info_clone.thumbnail.clone()),
                    download_type: request_clone.download_type.clone(),
                    output_path: String::new(),
                    status: DownloadStatus::Failed,
                    started_at,
                    completed_at: Some(Utc::now()),
                    file_size: None,
                    settings: request_clone,
                })
                .await;
        }
    });

    Ok(Json(json!({
        "success": true,
        "requestId": request_id
    })))
}

pub async fn active_downloads(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({ "items": state.active_downloads() }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn handle_video_url_rejects_empty_urls() {
        let temp_dir = tempdir().expect("temp dir");
        let state = AppState::for_tests(temp_dir.path()).expect("state");
        let request = DownloadRequest {
            video_url: "   ".to_string(),
            ..DownloadRequest::default()
        };

        let result = handle_video_url(State(state), Json(request)).await;

        assert!(matches!(
            result,
            Err((axum::http::StatusCode::BAD_REQUEST, _))
        ));
    }

    #[tokio::test]
    async fn handle_video_url_rejects_invalid_clip_ranges() {
        let temp_dir = tempdir().expect("temp dir");
        let state = AppState::for_tests(temp_dir.path()).expect("state");
        let request = DownloadRequest {
            video_url: "https://example.com/video".to_string(),
            download_type: crate::models::download::DownloadType::Clip,
            clip_in: Some(12.0),
            clip_out: Some(4.0),
            ..DownloadRequest::default()
        };

        let result = handle_video_url(State(state), Json(request)).await;

        assert!(matches!(
            result,
            Err((axum::http::StatusCode::BAD_REQUEST, _))
        ));
    }

    #[tokio::test]
    async fn handle_video_url_rejects_non_http_inputs() {
        let temp_dir = tempdir().expect("temp dir");
        let state = AppState::for_tests(temp_dir.path()).expect("state");
        let request = DownloadRequest {
            video_url: "YT2Premiere Desktop Download manager for desktop, Chrome, and Premiere"
                .to_string(),
            ..DownloadRequest::default()
        };

        let result = handle_video_url(State(state), Json(request)).await;

        assert!(matches!(
            result,
            Err((axum::http::StatusCode::BAD_REQUEST, _))
        ));
    }

    #[tokio::test]
    async fn active_downloads_returns_emitted_runtime_state() {
        let temp_dir = tempdir().expect("temp dir");
        let state = AppState::for_tests(temp_dir.path()).expect("state");
        state.emit_progress(
            "request-1",
            crate::models::download::DownloadStage::Downloading,
            Some("42.0%".to_string()),
            Some("2.0 MB/s".to_string()),
            Some("00:10".to_string()),
            Some("Downloading".to_string()),
            false,
        );

        let Json(payload) = active_downloads(State(state)).await;
        let items = payload["items"].as_array().expect("active downloads array");

        assert_eq!(items.len(), 1);
        assert_eq!(items[0]["requestId"], "request-1");
        assert_eq!(items[0]["stage"], "downloading");
        assert_eq!(items[0]["percentage"], "42.0%");
    }
}
