use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::download::DownloadStage;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveDownloadState {
    pub request_id: String,
    pub stage: DownloadStage,
    pub percentage: Option<String>,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub detail: Option<String>,
    pub indeterminate: bool,
    pub path: Option<String>,
    pub message: Option<String>,
    pub updated_at: DateTime<Utc>,
}
