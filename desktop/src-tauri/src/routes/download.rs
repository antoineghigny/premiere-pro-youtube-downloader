use axum::{extract::State, Json};
use serde_json::json;

use chrono::Utc;
use uuid::Uuid;

use crate::{
    models::{
        download::DownloadRequest,
        history::{DownloadStatus, HistoryEntry},
        settings::AppSettings,
    },
    server::AppState,
    services::downloader,
};

fn normalize_text(value: Option<&str>) -> String {
    value.unwrap_or_default().trim().to_ascii_lowercase()
}

fn normalize_bool(value: Option<bool>) -> bool {
    value.unwrap_or(false)
}

fn normalize_clip_time(value: Option<f64>) -> Option<i64> {
    value.map(|seconds| (seconds * 1000.0).round() as i64)
}

fn normalize_recorded_download_dir(
    request: &DownloadRequest,
    settings: &AppSettings,
    output_path: Option<&str>,
) -> String {
    if let Some(download_path) = request.download_path.as_deref() {
        let normalized = download_path.trim();
        if !normalized.is_empty() {
            return normalized.to_ascii_lowercase();
        }
    }

    if let Some(output_path) = output_path {
        let normalized_output_path = output_path.trim();
        if !normalized_output_path.is_empty() {
            if let Some(parent) = std::path::Path::new(normalized_output_path).parent() {
                return parent.to_string_lossy().to_ascii_lowercase();
            }
        }
    }

    downloader::resolve_download_dir(request, settings)
        .to_string_lossy()
        .to_ascii_lowercase()
}

fn request_signature(
    request: &DownloadRequest,
    settings: &AppSettings,
    output_path: Option<&str>,
) -> String {
    let resolved_download_dir = normalize_recorded_download_dir(request, settings, output_path);

    [
        request.video_url.trim().to_ascii_lowercase(),
        format!("{:?}", request.download_type).to_ascii_lowercase(),
        normalize_bool(Some(request.audio_only)).to_string(),
        normalize_bool(Some(request.download_mp3)).to_string(),
        normalize_clip_time(request.clip_in)
            .map(|value| value.to_string())
            .unwrap_or_default(),
        normalize_clip_time(request.clip_out)
            .map(|value| value.to_string())
            .unwrap_or_default(),
        resolved_download_dir,
        normalize_bool(request.video_only).to_string(),
        normalize_text(request.resolution.as_deref()),
        normalize_text(request.ffmpeg.output_format.as_deref()),
        normalize_text(request.ffmpeg.video_codec.as_deref()),
        normalize_text(request.ffmpeg.audio_codec.as_deref()),
        normalize_text(request.ffmpeg.resolution.as_deref()),
        normalize_text(request.ffmpeg.video_bitrate.as_deref()),
        normalize_text(request.ffmpeg.audio_bitrate.as_deref()),
        normalize_text(request.ffmpeg.frame_rate.as_deref()),
        normalize_bool(request.ffmpeg.thumbnail).to_string(),
        normalize_bool(request.ffmpeg.subtitles).to_string(),
        normalize_text(request.ffmpeg.subtitle_lang.as_deref()),
        normalize_bool(request.import_to_premiere).to_string(),
        normalize_bool(request.ffmpeg.import_to_premiere).to_string(),
    ]
    .join("|")
}

async fn find_duplicate_download(
    state: &AppState,
    request: &DownloadRequest,
    settings: &AppSettings,
) -> Option<HistoryEntry> {
    let signature = request_signature(request, settings, None);
    let history = state.history.list_page(1, 500).await;

    history.items.into_iter().find(|entry| {
        if matches!(entry.status, DownloadStatus::Failed | DownloadStatus::Interrupted) {
            return false;
        }

        if matches!(entry.status, DownloadStatus::Complete) {
            if entry.output_path.trim().is_empty() || !std::path::Path::new(&entry.output_path).exists() {
                return false;
            }
        }

        request_signature(&entry.settings, settings, Some(&entry.output_path)) == signature
    })
}

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
    let settings = state.settings.get().await;
    let resolved_download_dir = downloader::resolve_download_dir(&request, &settings);
    request.download_path = Some(resolved_download_dir.to_string_lossy().to_string());

    if let Some(existing) = find_duplicate_download(&state, &request, &settings).await {
        return Err((
            axum::http::StatusCode::CONFLICT,
            Json(json!({
                "error": match existing.status {
                    DownloadStatus::Complete => "This download already exists in history",
                    DownloadStatus::Queued => "This download is already queued",
                    DownloadStatus::Running => "This download is already running",
                    _ => "This download already exists",
                },
                "duplicate": true,
                "requestId": existing.request_id,
                "status": existing.status,
            })),
        ));
    }

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
    use crate::models::{download::DownloadType, ffmpeg_options::FFmpegOptions};
    use tempfile::tempdir;
    use uuid::Uuid;

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

    #[tokio::test]
    async fn request_signature_distinguishes_clip_variants_and_formats() {
        let settings = AppSettings::default();
        let base = DownloadRequest {
            video_url: "https://example.com/video".to_string(),
            download_type: DownloadType::Clip,
            clip_in: Some(10.0),
            clip_out: Some(20.0),
            ffmpeg: FFmpegOptions {
                output_format: Some("mp4".to_string()),
                ..FFmpegOptions::default()
            },
            ..DownloadRequest::default()
        };

        let mut different_clip = base.clone();
        different_clip.clip_out = Some(21.0);

        let mut different_format = base.clone();
        different_format.ffmpeg.output_format = Some("mov".to_string());

        assert_ne!(
            request_signature(&base, &settings, None),
            request_signature(&different_clip, &settings, None)
        );
        assert_ne!(
            request_signature(&base, &settings, None),
            request_signature(&different_format, &settings, None)
        );
    }

    #[tokio::test]
    async fn request_signature_prefers_recorded_output_folder_for_history_entries() {
        let settings = AppSettings {
            download_path: "C:\\current-downloads".to_string(),
            ..AppSettings::default()
        };
        let request = DownloadRequest {
            video_url: "https://example.com/video".to_string(),
            download_type: DownloadType::Full,
            ..DownloadRequest::default()
        };

        let current_signature = request_signature(&request, &settings, None);
        let historical_signature = request_signature(
            &request,
            &settings,
            Some("D:\\archive\\2026-04-02\\video.mp4"),
        );

        assert_ne!(current_signature, historical_signature);
        assert!(historical_signature.contains("d:\\archive\\2026-04-02"));
    }

    #[tokio::test]
    async fn handle_video_url_rejects_exact_duplicate_downloads_before_queueing() {
        let temp_dir = tempdir().expect("temp dir");
        let state = AppState::for_tests(temp_dir.path()).expect("state");
        let request = DownloadRequest {
            video_url: "https://example.com/video".to_string(),
            download_type: DownloadType::Full,
            request_id: Some("existing-request".to_string()),
            ffmpeg: FFmpegOptions {
                output_format: Some("mp4".to_string()),
                ..FFmpegOptions::default()
            },
            ..DownloadRequest::default()
        };

        state
            .history
            .upsert_by_request_id("existing-request", |_| HistoryEntry {
                id: Uuid::new_v4(),
                request_id: "existing-request".to_string(),
                url: request.video_url.clone(),
                title: "Existing".to_string(),
                thumbnail: None,
                download_type: DownloadType::Full,
                output_path: String::new(),
                status: DownloadStatus::Running,
                started_at: Utc::now(),
                completed_at: None,
                file_size: None,
                settings: request.clone(),
            })
            .await
            .expect("seed history");

        let result = handle_video_url(State(state), Json(request)).await;

        assert!(matches!(
            result,
            Err((axum::http::StatusCode::CONFLICT, _))
        ));
    }
}
