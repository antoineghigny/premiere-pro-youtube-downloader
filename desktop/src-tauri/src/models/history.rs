use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::download::{DownloadRequest, DownloadType};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Running,
    Interrupted,
    Complete,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: Uuid,
    #[serde(default)]
    pub request_id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub download_type: DownloadType,
    pub output_path: String,
    pub status: DownloadStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub file_size: Option<u64>,
    pub settings: DownloadRequest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQuery {
    pub page: Option<usize>,
    pub page_size: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryResponse {
    pub items: Vec<HistoryEntry>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
}
