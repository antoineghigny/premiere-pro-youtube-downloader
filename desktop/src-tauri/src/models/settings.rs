use serde::{Deserialize, Serialize};

use super::{download::OutputTarget, ffmpeg_options::FFmpegOptions};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FFmpegPreset {
    pub id: String,
    pub name: String,
    pub options: FFmpegOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub resolution: String,
    pub download_path: String,
    pub audio_download_path: String,
    pub output_target: OutputTarget,
    pub ask_audio_path_each_time: bool,
    pub ask_download_path_each_time: bool,
    pub video_only: bool,
    pub default_import_to_premiere: bool,
    pub ffmpeg_presets: Vec<FFmpegPreset>,
    pub theme: String,
    pub language: String,
    pub concurrent_downloads: usize,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            resolution: "1080".to_string(),
            download_path: String::new(),
            audio_download_path: String::new(),
            output_target: OutputTarget::DownloadFolder,
            ask_audio_path_each_time: false,
            ask_download_path_each_time: false,
            video_only: false,
            default_import_to_premiere: false,
            ffmpeg_presets: Vec::new(),
            theme: "dark".to_string(),
            language: "en".to_string(),
            concurrent_downloads: 2,
        }
    }
}
