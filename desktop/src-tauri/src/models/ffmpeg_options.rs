use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct FFmpegOptions {
    pub output_format: Option<String>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub resolution: Option<String>,
    pub video_bitrate: Option<String>,
    pub audio_bitrate: Option<String>,
    pub frame_rate: Option<String>,
    pub thumbnail: Option<bool>,
    pub subtitles: Option<bool>,
    pub subtitle_lang: Option<String>,
    pub import_to_premiere: Option<bool>,
    pub preset_name: Option<String>,
}
