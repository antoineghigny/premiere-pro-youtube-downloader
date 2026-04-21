use serde::{Deserialize, Serialize};

use super::ffmpeg_options::FFmpegOptions;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadType {
    Full,
    Audio,
    Clip,
}

impl Default for DownloadType {
    fn default() -> Self {
        Self::Full
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OutputTarget {
    DownloadFolder,
    PremiereProject,
}

impl Default for OutputTarget {
    fn default() -> Self {
        Self::DownloadFolder
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStage {
    Preparing,
    Resolving,
    Downloading,
    Clipping,
    Importing,
    Context,
    Design,
    Generating,
    Validating,
    PreviewReady,
    Rendering,
    Encoding,
    Complete,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DownloadRequest {
    pub request_id: Option<String>,
    pub video_url: String,
    pub download_type: DownloadType,
    pub output_target: OutputTarget,
    pub audio_only: bool,
    pub download_mp3: bool,
    pub clip_in: Option<f64>,
    pub clip_out: Option<f64>,
    pub download_path: Option<String>,
    pub video_only: Option<bool>,
    pub resolution: Option<String>,
    pub import_to_premiere: Option<bool>,
    pub ffmpeg: FFmpegOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub channel: Option<String>,
    pub webpage_url: Option<String>,
}
