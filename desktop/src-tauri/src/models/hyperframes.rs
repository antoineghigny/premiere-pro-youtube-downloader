use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HyperframesCatalogItem {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub prompt_hint: String,
    pub accent: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PremiereSequenceContext {
    pub sequence_open: bool,
    pub sequence_name: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub timebase: String,
    pub player_position_seconds: Option<f64>,
    pub in_point_seconds: Option<f64>,
    pub out_point_seconds: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub work_area_enabled: bool,
    pub range_source: Option<String>,
    pub video_track_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct HyperframesContext {
    pub project_name: Option<String>,
    pub project_path: Option<String>,
    pub project_folder: Option<String>,
    pub design_path: Option<String>,
    pub design_exists: bool,
    pub artifacts_root: Option<String>,
    pub premiere_ready: bool,
    pub reason: String,
    pub sequence: PremiereSequenceContext,
    pub latest_artifact_id: Option<String>,
    pub latest_render_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HyperframesArtifactManifest {
    pub job_id: String,
    pub title: String,
    pub prompt: String,
    pub template_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub html_path: String,
    pub render_path: Option<String>,
    pub preview_image_path: Option<String>,
    pub manifest_path: String,
    pub design_path: String,
    pub project_name: Option<String>,
    pub sequence_name: Option<String>,
    pub in_point_seconds: Option<f64>,
    pub out_point_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HyperframesArtifactDetail {
    pub artifact: HyperframesArtifactManifest,
    pub html_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct GenerateOverlayRequest {
    pub prompt: String,
    pub template_id: Option<String>,
    pub manual_in_seconds: Option<f64>,
    pub manual_out_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderOverlayRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOverlayRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDesignRequest {
    pub content: String,
}
