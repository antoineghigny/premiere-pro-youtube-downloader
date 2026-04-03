use std::{
    path::{Path, PathBuf},
    process::Stdio,
};

use chrono::{Local, Utc};
use directories::UserDirs;
use serde::Deserialize;
use serde_json::Value;
use tokio::{
    fs,
    io::{AsyncBufRead, AsyncBufReadExt, AsyncRead, AsyncReadExt, BufReader},
    process::Command,
    sync::mpsc,
    time::{timeout, Duration as TokioDuration},
};
use uuid::Uuid;

use crate::{
    models::{
        download::{DownloadRequest, DownloadStage, DownloadType, VideoInfo},
        history::{DownloadStatus, HistoryEntry},
        settings::AppSettings,
    },
    server::AppState,
    services::{ffmpeg, premiere},
    utils::{file_size, format_clip_time, sanitize_title},
};

#[derive(Debug, Deserialize)]
struct YtDlpProgressUpdate {
    #[serde(default)]
    percent: Option<String>,
    #[serde(default)]
    speed: Option<String>,
    #[serde(default)]
    eta: Option<String>,
}

#[derive(Clone, Copy)]
enum YtDlpStream {
    Stdout,
    Stderr,
}

fn parse_progress_line(line: &str) -> Option<YtDlpProgressUpdate> {
    let payload = line.trim().strip_prefix("download:").unwrap_or(line.trim());

    if payload.starts_with('{') {
        return serde_json::from_str::<YtDlpProgressUpdate>(payload).ok();
    }

    let mut parts = payload.splitn(4, '|').map(str::trim);
    let percent = parts.next()?;
    let speed = parts.next()?;
    let eta = parts.next()?;
    let _ = parts.next();

    Some(YtDlpProgressUpdate {
        percent: (!percent.is_empty()).then(|| percent.to_string()),
        speed: (!speed.is_empty()).then(|| speed.to_string()),
        eta: (!eta.is_empty()).then(|| eta.to_string()),
    })
}

async fn read_lossy_line<R>(reader: &mut R, context: &str) -> Result<Option<String>, String>
where
    R: AsyncBufRead + Unpin,
{
    let mut buffer = Vec::new();
    let bytes_read = reader
        .read_until(b'\n', &mut buffer)
        .await
        .map_err(|error| format!("Could not read {}: {}", context, error))?;

    if bytes_read == 0 {
        return Ok(None);
    }

    while matches!(buffer.last(), Some(b'\n' | b'\r')) {
        buffer.pop();
    }

    Ok(Some(String::from_utf8_lossy(&buffer).into_owned()))
}

async fn read_lossy_string<R>(reader: &mut R, context: &str) -> Result<String, String>
where
    R: AsyncRead + Unpin,
{
    let mut buffer = Vec::new();
    reader
        .read_to_end(&mut buffer)
        .await
        .map_err(|error| format!("Could not read {}: {}", context, error))?;

    Ok(String::from_utf8_lossy(&buffer).into_owned())
}

fn build_format_selector(request: &DownloadRequest, settings: &AppSettings) -> String {
    let resolution = request
        .ffmpeg
        .resolution
        .clone()
        .or_else(|| request.resolution.clone())
        .unwrap_or_else(|| settings.resolution.clone());
    let ceiling = match resolution.as_str() {
        "highest" => 4320,
        _ => resolution.parse::<u32>().unwrap_or(1080),
    };

    if matches!(request.download_type, DownloadType::Audio) || request.audio_only {
        return "bestaudio/best".to_string();
    }

    if request.video_only.unwrap_or(settings.video_only) {
        return format!(
            "bestvideo*[height<=?{ceiling}][ext=mp4]/bestvideo*[height<=?{ceiling}]/best[height<=?{ceiling}][ext=mp4]/best[height<=?{ceiling}]/best"
        );
    }

    format!("bestvideo*[height<=?{ceiling}]+bestaudio/best[height<=?{ceiling}]/best")
}

pub(crate) fn resolve_download_dir(request: &DownloadRequest, settings: &AppSettings) -> PathBuf {
    if let Some(download_path) = request.download_path.as_deref() {
        if !download_path.trim().is_empty() {
            return PathBuf::from(download_path.trim());
        }
    }

    if matches!(request.download_type, DownloadType::Audio)
        && !settings.audio_download_path.trim().is_empty()
    {
        return PathBuf::from(settings.audio_download_path.trim());
    }

    if !settings.download_path.trim().is_empty() {
        return PathBuf::from(settings.download_path.trim());
    }

    let fallback_root = UserDirs::new()
        .and_then(|dirs| dirs.download_dir().map(Path::to_path_buf))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    fallback_root
        .join("YT2Premiere")
        .join(Local::now().format("%Y-%m-%d").to_string())
}

fn extract_video_info(payload: &Value, fallback_url: &str) -> VideoInfo {
    VideoInfo {
        id: payload
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        title: payload
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or(fallback_url)
            .to_string(),
        thumbnail: payload
            .get("thumbnail")
            .and_then(Value::as_str)
            .map(str::to_string),
        duration: payload.get("duration").and_then(Value::as_f64),
        channel: payload
            .get("channel")
            .or_else(|| payload.get("uploader"))
            .and_then(Value::as_str)
            .map(str::to_string),
        webpage_url: payload
            .get("webpage_url")
            .and_then(Value::as_str)
            .map(str::to_string),
    }
}

pub async fn fetch_video_info(state: &AppState, video_url: &str) -> Result<VideoInfo, String> {
    let mut child = Command::new(&state.tools.yt_dlp)
        .args([
            "--encoding",
            "utf-8",
            "--dump-single-json",
            "--skip-download",
            "--no-playlist",
            "--no-warnings",
            "--ignore-config",
            "--socket-timeout",
            "30",
            video_url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start yt-dlp for video info: {}", error))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Could not capture yt-dlp metadata stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Could not capture yt-dlp metadata stderr".to_string())?;

    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        read_lossy_string(&mut reader, "yt-dlp metadata stdout")
            .await
            .unwrap_or_default()
    });
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        read_lossy_string(&mut reader, "yt-dlp metadata stderr")
            .await
            .unwrap_or_default()
    });

    let status = match timeout(TokioDuration::from_secs(45), child.wait()).await {
        Ok(result) => {
            result.map_err(|error| format!("Could not wait for yt-dlp video info: {}", error))?
        }
        Err(_) => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err("yt-dlp metadata lookup timed out".to_string());
        }
    };
    let stdout = stdout_task.await.unwrap_or_default();
    let stderr = stderr_task.await.unwrap_or_default();

    if !status.success() {
        return Err(if stderr.trim().is_empty() {
            "yt-dlp could not resolve the requested URL".to_string()
        } else {
            stderr.trim().to_string()
        });
    }

    let payload: Value = serde_json::from_str(&stdout)
        .map_err(|error| format!("Could not parse yt-dlp metadata: {}", error))?;
    Ok(extract_video_info(&payload, video_url))
}

async fn run_download(
    state: &AppState,
    request: &DownloadRequest,
    settings: &AppSettings,
    request_id: &str,
    download_dir: &Path,
) -> Result<(PathBuf, PathBuf), String> {
    let temp_dir = download_dir.join(format!(".yt2pp-{}", request_id));
    fs::create_dir_all(&temp_dir).await.map_err(|error| {
        format!(
            "Could not create the temporary download directory: {}",
            error
        )
    })?;

    let output_template = temp_dir.join("source.%(ext)s");
    let mut args = vec![
        "--encoding".to_string(),
        "utf-8".to_string(),
        "--newline".to_string(),
        "--no-playlist".to_string(),
        "--no-warnings".to_string(),
        "--ignore-config".to_string(),
        "--progress".to_string(),
        "--progress-template".to_string(),
        "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_str)s".to_string(),
        "--print".to_string(),
        "after_move:[YT2PP_FILE]%(filepath)s".to_string(),
        "-o".to_string(),
        output_template.to_string_lossy().to_string(),
        "-f".to_string(),
        build_format_selector(request, settings),
    ];

    if matches!(request.download_type, DownloadType::Clip) {
        if let (Some(clip_in), Some(clip_out)) = (request.clip_in, request.clip_out) {
            args.push("--download-sections".to_string());
            args.push(format!(
                "*{}-{}",
                format_clip_time(clip_in),
                format_clip_time(clip_out)
            ));
        }
    }

    if request.ffmpeg.thumbnail.unwrap_or(false) {
        args.push("--write-thumbnail".to_string());
    }

    if request.ffmpeg.subtitles.unwrap_or(false) {
        args.push("--write-subs".to_string());
        if let Some(language) = request.ffmpeg.subtitle_lang.as_deref() {
            args.push("--sub-lang".to_string());
            args.push(language.to_string());
        }
    }

    args.push(request.video_url.clone());

    let stage = if matches!(request.download_type, DownloadType::Clip) {
        DownloadStage::Clipping
    } else {
        DownloadStage::Downloading
    };

    state.emit_progress(
        request_id,
        stage.clone(),
        None,
        None,
        None,
        Some("Downloading source".to_string()),
        true,
    );

    let child_key = format!("{request_id}:yt-dlp");
    let child = Command::new(&state.tools.yt_dlp)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start yt-dlp: {}", error))?;

    state.register_child_process(child_key.clone(), child);
    let child_handle = state
        .child_process(&child_key)
        .ok_or_else(|| "Could not track the yt-dlp process".to_string())?;

    let stdout = child_handle
        .lock()
        .await
        .stdout
        .take()
        .ok_or_else(|| "Could not capture yt-dlp stdout".to_string())?;
    let stderr = child_handle
        .lock()
        .await
        .stderr
        .take()
        .ok_or_else(|| "Could not capture yt-dlp stderr".to_string())?;

    let (line_sender, mut line_receiver) = mpsc::unbounded_channel::<(YtDlpStream, String)>();
    let stdout_task = {
        let line_sender = line_sender.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            while let Ok(Some(line)) = read_lossy_line(&mut reader, "yt-dlp stdout").await {
                let _ = line_sender.send((YtDlpStream::Stdout, line));
            }
        })
    };
    let stderr_task = {
        let line_sender = line_sender.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            while let Ok(Some(line)) = read_lossy_line(&mut reader, "yt-dlp stderr").await {
                let _ = line_sender.send((YtDlpStream::Stderr, line));
            }
        })
    };
    drop(line_sender);

    let mut final_source_path: Option<PathBuf> = None;
    let mut stderr_lines = Vec::new();

    while let Some((stream, line)) = line_receiver.recv().await {
        if let Some(progress) = parse_progress_line(&line) {
            state.emit_progress(
                request_id,
                stage.clone(),
                progress.percent.map(|value| value.trim().to_string()),
                progress.speed.map(|value| value.trim().to_string()),
                progress.eta.map(|value| value.trim().to_string()),
                Some("Downloading source".to_string()),
                false,
            );
        } else if let Some(path) = line.strip_prefix("[YT2PP_FILE]") {
            final_source_path = Some(PathBuf::from(path.trim()));
        } else if matches!(stream, YtDlpStream::Stderr) && !line.trim().is_empty() {
            stderr_lines.push(line);
        }
    }

    let _ = stdout_task.await;
    let _ = stderr_task.await;

    let status = child_handle
        .lock()
        .await
        .wait()
        .await
        .map_err(|error| format!("Could not wait for yt-dlp: {}", error))?;
    state.release_child_process(&child_key);

    let stderr_output = stderr_lines.join("\n");

    if !status.success() {
        return Err(if stderr_output.trim().is_empty() {
            "yt-dlp failed while downloading the requested media".to_string()
        } else {
            stderr_output.trim().to_string()
        });
    }

    let source_path = if let Some(path) = final_source_path {
        path
    } else {
        let mut entries = fs::read_dir(&temp_dir).await.map_err(|error| {
            format!(
                "Could not inspect the temporary download directory: {}",
                error
            )
        })?;
        let mut fallback: Option<PathBuf> = None;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|error| format!("Could not inspect yt-dlp output: {}", error))?
        {
            let path = entry.path();
            if path.is_file() {
                fallback = Some(path);
                break;
            }
        }
        fallback.ok_or_else(|| "yt-dlp finished without producing an output file".to_string())?
    };

    Ok((source_path, temp_dir))
}

async fn move_sidecars(
    temp_dir: &Path,
    source_path: &Path,
    final_output_path: &Path,
) -> Result<(), String> {
    let mut entries = match fs::read_dir(temp_dir).await {
        Ok(entries) => entries,
        Err(_) => return Ok(()),
    };

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|error| format!("Could not inspect downloaded sidecar files: {}", error))?
    {
        let path = entry.path();
        if path == source_path || !path.is_file() {
            continue;
        }

        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        let destination = final_output_path.with_extension(extension);
        let _ = fs::rename(&path, destination).await;
    }

    let _ = fs::remove_dir_all(temp_dir).await;
    Ok(())
}

pub async fn process_download(
    state: AppState,
    mut request: DownloadRequest,
    request_id: String,
    info: VideoInfo,
) -> Result<(), String> {
    let settings = state.settings.get().await;
    request.request_id = Some(request_id.clone());
    request.resolution = Some(
        request
            .resolution
            .clone()
            .unwrap_or_else(|| settings.resolution.clone()),
    );
    if request.ffmpeg.resolution.is_none() {
        request.ffmpeg.resolution = request.resolution.clone();
    }

    let download_dir = resolve_download_dir(&request, &settings);
    fs::create_dir_all(&download_dir)
        .await
        .map_err(|error| format!("Could not create the download directory: {}", error))?;

    state.emit_progress(
        &request_id,
        DownloadStage::Preparing,
        None,
        None,
        None,
        Some("Preparing download".to_string()),
        true,
    );
    let started_at = Utc::now();
    state
        .history
        .upsert_by_request_id(&request_id, |existing| HistoryEntry {
            id: existing
                .as_ref()
                .map(|entry| entry.id)
                .unwrap_or_else(Uuid::new_v4),
            request_id: request_id.clone(),
            url: request.video_url.clone(),
            title: info.title.clone(),
            thumbnail: info.thumbnail.clone(),
            download_type: request.download_type.clone(),
            output_path: existing
                .as_ref()
                .map(|entry| entry.output_path.clone())
                .unwrap_or_default(),
            status: DownloadStatus::Running,
            started_at,
            completed_at: None,
            file_size: None,
            settings: request.clone(),
        })
        .await?;

    let (source_path, temp_dir) =
        run_download(&state, &request, &settings, &request_id, &download_dir).await?;
    let sanitized_title = sanitize_title(&info.title);
    let output_path = ffmpeg::final_output_path(&download_dir, &sanitized_title, &request);
    let final_path = ffmpeg::process_output(
        &state,
        &source_path,
        &output_path,
        &request,
        info.duration,
        &request_id,
    )
    .await?;

    move_sidecars(&temp_dir, &source_path, &final_path).await?;

    let should_import = request
        .import_to_premiere
        .or(request.ffmpeg.import_to_premiere)
        .unwrap_or(settings.default_import_to_premiere);
    if should_import && premiere::is_premiere_running() && state.active_cep_port().is_some() {
        state.emit_progress(
            &request_id,
            DownloadStage::Importing,
            None,
            None,
            None,
            Some("Importing into Premiere".to_string()),
            true,
        );
        if let Err(error) = premiere::import_to_premiere(&state, &final_path).await {
            tracing::warn!(
                request_id = %request_id,
                output = %final_path.display(),
                "Premiere import skipped after download completion: {}",
                error
            );
        }
    } else if should_import {
        tracing::info!(
            request_id = %request_id,
            premiere_running = premiere::is_premiere_running(),
            cep_registered = state.active_cep_port().is_some(),
            "Premiere import skipped because the bridge is unavailable"
        );
    }

    state
        .history
        .upsert_by_request_id(&request_id, |existing| HistoryEntry {
            id: existing
                .as_ref()
                .map(|entry| entry.id)
                .unwrap_or_else(Uuid::new_v4),
            request_id: request_id.clone(),
            url: request.video_url.clone(),
            title: info.title.clone(),
            thumbnail: info.thumbnail.clone(),
            download_type: request.download_type.clone(),
            output_path: final_path.to_string_lossy().to_string(),
            status: DownloadStatus::Complete,
            started_at,
            completed_at: Some(Utc::now()),
            file_size: file_size(&final_path),
            settings: request.clone(),
        })
        .await?;

    state.emit_complete(&request_id, final_path.to_string_lossy().to_string());

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_format_selector_keeps_audio_downloads_permissive() {
        let settings = AppSettings::default();
        let request = DownloadRequest {
            download_type: DownloadType::Audio,
            ..DownloadRequest::default()
        };

        assert_eq!(build_format_selector(&request, &settings), "bestaudio/best");
    }

    #[test]
    fn build_format_selector_adds_progressive_fallback_for_video_only() {
        let settings = AppSettings {
            resolution: "1080".to_string(),
            video_only: true,
            ..AppSettings::default()
        };
        let request = DownloadRequest::default();

        let selector = build_format_selector(&request, &settings);

        assert!(selector.contains("bestvideo*"));
        assert!(selector.contains("/best[height<=?1080]"));
        assert!(selector.ends_with("/best"));
    }

    #[test]
    fn parse_progress_line_supports_download_prefixed_json() {
        let progress =
            parse_progress_line(r#"download:{"percent":"42.0%","speed":"2.1MiB/s","eta":"00:12"}"#)
                .expect("progress");

        assert_eq!(progress.percent.as_deref(), Some("42.0%"));
        assert_eq!(progress.speed.as_deref(), Some("2.1MiB/s"));
        assert_eq!(progress.eta.as_deref(), Some("00:12"));
    }

    #[test]
    fn parse_progress_line_supports_pipe_delimited_template() {
        let progress =
            parse_progress_line("download:42.0%|2.1MiB/s|00:12|84.0MiB").expect("progress");

        assert_eq!(progress.percent.as_deref(), Some("42.0%"));
        assert_eq!(progress.speed.as_deref(), Some("2.1MiB/s"));
        assert_eq!(progress.eta.as_deref(), Some("00:12"));
    }

    #[test]
    fn parse_progress_line_ignores_non_progress_output() {
        assert!(parse_progress_line("[download] Destination: source.mp4").is_none());
    }
}
