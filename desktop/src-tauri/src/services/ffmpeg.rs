use std::{
    path::{Path, PathBuf},
    process::Stdio,
};

use tokio::{
    fs,
    io::{AsyncBufReadExt, AsyncReadExt, BufReader},
    process::Command,
};

use crate::{
    models::download::{DownloadRequest, DownloadStage, DownloadType},
    server::AppState,
    utils::unique_output_path,
};

fn is_audio_extension(extension: &str) -> bool {
    matches!(extension, "wav" | "mp3" | "flac" | "aac" | "opus" | "m4a")
}

pub fn desired_extension(request: &DownloadRequest) -> String {
    if let Some(output_format) = request.ffmpeg.output_format.as_deref() {
        let normalized = output_format
            .trim()
            .trim_start_matches('.')
            .to_ascii_lowercase();
        if !normalized.is_empty() {
            return normalized;
        }
    }

    if matches!(request.download_type, DownloadType::Audio) {
        if request.download_mp3 {
            return "mp3".to_string();
        }
        return "wav".to_string();
    }

    "mp4".to_string()
}

pub fn final_output_path(download_dir: &Path, title: &str, request: &DownloadRequest) -> PathBuf {
    let suffix = if matches!(request.download_type, DownloadType::Clip) {
        "_clip"
    } else {
        ""
    };
    unique_output_path(
        download_dir,
        &format!("{}{}", title, suffix),
        &desired_extension(request),
    )
}

fn requested_video_height(request: &DownloadRequest) -> Option<u32> {
    request
        .ffmpeg
        .resolution
        .as_deref()
        .or(request.resolution.as_deref())
        .map(str::trim)
        .and_then(|value| {
            if value.is_empty() {
                return None;
            }

            let normalized = value.to_ascii_lowercase();
            if matches!(normalized.as_str(), "highest" | "original") {
                return None;
            }

            value.parse::<u32>().ok()
        })
}

fn requested_frame_rate(request: &DownloadRequest) -> Option<String> {
    request
        .ffmpeg
        .frame_rate
        .as_deref()
        .map(str::trim)
        .and_then(|value| {
            if value.is_empty() || value.eq_ignore_ascii_case("original") {
                None
            } else {
                Some(value.to_string())
            }
        })
}

fn resolve_video_codec(request: &DownloadRequest, requires_transcode: bool) -> &'static str {
    let selected = request
        .ffmpeg
        .video_codec
        .as_deref()
        .unwrap_or("copy")
        .trim()
        .to_ascii_lowercase();

    match selected.as_str() {
        "h264" => "libx264",
        "h265" => "libx265",
        "vp9" => "libvpx-vp9",
        "av1" => "libaom-av1",
        _ if requires_transcode => "libx264",
        _ => "copy",
    }
}

fn build_ffmpeg_args(source: &Path, destination: &Path, request: &DownloadRequest) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "error".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-nostats".to_string(),
        "-i".to_string(),
        source.to_string_lossy().to_string(),
    ];

    let extension = desired_extension(request);
    let is_audio_output = is_audio_extension(&extension)
        || request.audio_only
        || matches!(request.download_type, DownloadType::Audio);

    if is_audio_output {
        args.push("-vn".to_string());
        match extension.as_str() {
            "wav" => {
                args.extend(
                    ["-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2"]
                        .into_iter()
                        .map(String::from),
                );
            }
            "mp3" => {
                args.extend(["-c:a", "libmp3lame"].into_iter().map(String::from));
                args.push("-b:a".to_string());
                args.push(
                    request
                        .ffmpeg
                        .audio_bitrate
                        .clone()
                        .unwrap_or_else(|| "320k".to_string()),
                );
            }
            "flac" => {
                args.extend(["-c:a", "flac"].into_iter().map(String::from));
            }
            "aac" => {
                args.extend(["-c:a", "aac"].into_iter().map(String::from));
            }
            "opus" => {
                args.extend(["-c:a", "libopus"].into_iter().map(String::from));
            }
            _ => {
                args.extend(["-c:a", "copy"].into_iter().map(String::from));
            }
        }
    } else {
        let requested_height = requested_video_height(request);
        if let Some(height) = requested_height {
            args.push("-vf".to_string());
            args.push(format!("scale=-2:{}", height));
        }

        let frame_rate = requested_frame_rate(request);
        if let Some(frame_rate) = frame_rate.as_deref() {
            args.push("-r".to_string());
            args.push(frame_rate.to_string());
        }

        let chosen_video_codec = resolve_video_codec(
            request,
            requested_height.is_some() || frame_rate.is_some(),
        );
        args.push("-c:v".to_string());
        args.push(chosen_video_codec.to_string());

        if let Some(video_bitrate) = request.ffmpeg.video_bitrate.as_deref() {
            if !matches!(video_bitrate.trim(), "" | "auto") && chosen_video_codec != "copy" {
                args.push("-b:v".to_string());
                args.push(video_bitrate.trim().to_string());
            }
        }

        if request.video_only.unwrap_or(false) {
            args.push("-an".to_string());
        } else {
            let audio_codec = request
                .ffmpeg
                .audio_codec
                .clone()
                .unwrap_or_else(|| "copy".to_string())
                .to_ascii_lowercase();
            let chosen_audio_codec = match audio_codec.as_str() {
                "aac" => "aac",
                "mp3" => "libmp3lame",
                "opus" => "libopus",
                "flac" => "flac",
                _ => "copy",
            };
            args.push("-c:a".to_string());
            args.push(chosen_audio_codec.to_string());

            if let Some(audio_bitrate) = request.ffmpeg.audio_bitrate.as_deref() {
                if !audio_bitrate.trim().is_empty() && chosen_audio_codec != "copy" {
                    args.push("-b:a".to_string());
                    args.push(audio_bitrate.trim().to_string());
                }
            }
        }
    }

    args.push(destination.to_string_lossy().to_string());
    args
}

fn requires_processing(request: &DownloadRequest, source: &Path) -> bool {
    let desired_extension = desired_extension(request);
    let source_extension = source
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if desired_extension != source_extension {
        return true;
    }

    if request.video_only.unwrap_or(false) || request.audio_only {
        return true;
    }

    for option in [
        request.ffmpeg.video_codec.as_deref(),
        request.ffmpeg.audio_codec.as_deref(),
        request.ffmpeg.video_bitrate.as_deref(),
        request.ffmpeg.audio_bitrate.as_deref(),
        request.ffmpeg.frame_rate.as_deref(),
    ] {
        if let Some(value) = option {
            let normalized = value.trim().to_ascii_lowercase();
            if !normalized.is_empty()
                && !matches!(normalized.as_str(), "auto" | "copy" | "original")
            {
                return true;
            }
        }
    }

    if let Some(resolution) = request.ffmpeg.resolution.as_deref() {
        let normalized = resolution.trim().to_ascii_lowercase();
        if !normalized.is_empty() && !matches!(normalized.as_str(), "highest" | "original") {
            return true;
        }
    }

    false
}

async fn move_or_copy(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|error| format!("Could not create the output directory: {}", error))?;
    }

    match fs::rename(source, destination).await {
        Ok(_) => Ok(()),
        Err(_) => {
            fs::copy(source, destination)
                .await
                .map_err(|error| format!("Could not copy the output file: {}", error))?;
            let _ = fs::remove_file(source).await;
            Ok(())
        }
    }
}

async fn run_ffmpeg(
    state: &AppState,
    args: &[String],
    duration_seconds: Option<f64>,
    request_id: &str,
) -> Result<(), String> {
    let mut command = Command::new(&state.tools.ffmpeg);
    command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child_key = format!("{request_id}:ffmpeg");
    let child = command
        .spawn()
        .map_err(|error| format!("Could not start FFmpeg: {}", error))?;

    state.register_child_process(child_key.clone(), child);
    let child_handle = state
        .child_process(&child_key)
        .ok_or_else(|| "Could not track the FFmpeg process".to_string())?;

    let stdout = child_handle
        .lock()
        .await
        .stdout
        .take()
        .ok_or_else(|| "Could not capture FFmpeg stdout".to_string())?;
    let mut stdout_reader = BufReader::new(stdout).lines();

    let stderr = child_handle
        .lock()
        .await
        .stderr
        .take()
        .ok_or_else(|| "Could not capture FFmpeg stderr".to_string())?;
    let stderr_task = tokio::spawn(async move {
        let mut stderr_output = String::new();
        let mut stderr_reader = BufReader::new(stderr);
        stderr_reader
            .read_to_string(&mut stderr_output)
            .await
            .map_err(|error| format!("Could not read FFmpeg stderr: {}", error))?;
        Ok::<String, String>(stderr_output)
    });

    while let Some(line) = stdout_reader
        .next_line()
        .await
        .map_err(|error| format!("Could not read FFmpeg progress: {}", error))?
    {
        if let Some(duration_seconds) = duration_seconds {
            if let Some(raw_out_time) = line.strip_prefix("out_time_ms=") {
                let current_ms = raw_out_time.trim().parse::<f64>().unwrap_or(0.0);
                let percentage = ((current_ms / 1_000_000.0) / duration_seconds) * 100.0;
                state.emit_progress(
                    request_id,
                    DownloadStage::Clipping,
                    Some(format!("{:.1}%", percentage.clamp(0.0, 99.5))),
                    None,
                    None,
                    Some("Processing with FFmpeg".to_string()),
                    false,
                );
            }
        }
    }

    let status = child_handle
        .lock()
        .await
        .wait()
        .await
        .map_err(|error| format!("Could not wait for FFmpeg: {}", error))?;
    state.release_child_process(&child_key);
    let stderr_output = stderr_task
        .await
        .map_err(|error| format!("Could not join FFmpeg stderr reader: {}", error))??;

    if !status.success() {
        return Err(if stderr_output.trim().is_empty() {
            "FFmpeg failed while processing the downloaded media".to_string()
        } else {
            stderr_output.trim().to_string()
        });
    }

    state.emit_progress(
        request_id,
        DownloadStage::Clipping,
        Some("100.0%".to_string()),
        None,
        None,
        Some("Processing complete".to_string()),
        false,
    );

    Ok(())
}

pub async fn process_output(
    state: &AppState,
    source: &Path,
    destination: &Path,
    request: &DownloadRequest,
    duration_seconds: Option<f64>,
    request_id: &str,
) -> Result<PathBuf, String> {
    if !requires_processing(request, source) {
        move_or_copy(source, destination).await?;
        return Ok(destination.to_path_buf());
    }

    let args = build_ffmpeg_args(source, destination, request);
    run_ffmpeg(state, &args, duration_seconds, request_id).await?;

    let _ = fs::remove_file(source).await;
    Ok(destination.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::build_ffmpeg_args;
    use crate::models::{
        download::{DownloadRequest, DownloadType},
        ffmpeg_options::FFmpegOptions,
    };
    use std::path::Path;

    fn base_video_request() -> DownloadRequest {
        DownloadRequest {
            video_url: "https://example.com/video".to_string(),
            download_type: DownloadType::Full,
            ffmpeg: FFmpegOptions {
                output_format: Some("mp4".to_string()),
                video_codec: Some("copy".to_string()),
                audio_codec: Some("copy".to_string()),
                resolution: Some("highest".to_string()),
                frame_rate: Some("original".to_string()),
                ..FFmpegOptions::default()
            },
            ..DownloadRequest::default()
        }
    }

    #[test]
    fn forces_video_transcode_when_resolution_scaling_is_requested() {
        let mut request = base_video_request();
        request.ffmpeg.resolution = Some("1080".to_string());

        let args = build_ffmpeg_args(Path::new("input.mp4"), Path::new("output.mp4"), &request);

        assert!(args.windows(2).any(|pair| pair == ["-vf", "scale=-2:1080"]));
        assert!(args.windows(2).any(|pair| pair == ["-c:v", "libx264"]));
        assert!(!args.windows(2).any(|pair| pair == ["-c:v", "copy"]));
    }

    #[test]
    fn keeps_stream_copy_when_no_video_transform_is_requested() {
        let request = base_video_request();

        let args = build_ffmpeg_args(Path::new("input.mp4"), Path::new("output.mp4"), &request);

        assert!(args.windows(2).any(|pair| pair == ["-c:v", "copy"]));
    }
}
