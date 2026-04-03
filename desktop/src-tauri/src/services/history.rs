use std::{fs, path::PathBuf};

use chrono::{DateTime, Utc};
use tokio::sync::RwLock;

use crate::{
    models::history::{DownloadStatus, HistoryEntry, HistoryResponse},
    utils::{history_file_path, write_json_atomic},
};

#[derive(Debug)]
pub struct HistoryService {
    path: PathBuf,
    inner: RwLock<Vec<HistoryEntry>>,
}

fn normalize_loaded_entries(
    mut entries: Vec<HistoryEntry>,
    now: DateTime<Utc>,
) -> Vec<HistoryEntry> {
    for entry in &mut entries {
        if entry.request_id.trim().is_empty() {
            entry.request_id = entry.id.to_string();
        }

        if matches!(
            entry.status,
            DownloadStatus::Queued | DownloadStatus::Running
        ) {
            entry.status = DownloadStatus::Interrupted;
            entry.completed_at.get_or_insert(now);
        }
    }

    entries
}

impl HistoryService {
    pub fn load() -> Result<Self, String> {
        Self::load_from_path(history_file_path()?)
    }

    pub(crate) fn load_from_path(path: PathBuf) -> Result<Self, String> {
        let entries = fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str::<Vec<HistoryEntry>>(&content).ok())
            .unwrap_or_default();
        let entries = normalize_loaded_entries(entries, Utc::now());

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create history directory: {}", error))?;
        }
        if !path.exists() {
            write_json_atomic(&path, &Vec::<HistoryEntry>::new())
                .map_err(|error| format!("Could not initialize history file: {}", error))?;
        } else {
            write_json_atomic(&path, &entries)?;
        }

        Ok(Self {
            path,
            inner: RwLock::new(entries),
        })
    }

    async fn persist(&self, entries: &[HistoryEntry]) -> Result<(), String> {
        write_json_atomic(&self.path, &entries)
    }

    pub async fn list_page(&self, page: usize, page_size: usize) -> HistoryResponse {
        let entries = self.inner.read().await;
        let total = entries.len();
        let page = page.max(1);
        let page_size = page_size.clamp(1, 500);
        let start = (page - 1) * page_size;
        let items = entries
            .iter()
            .skip(start)
            .take(page_size)
            .cloned()
            .collect();

        HistoryResponse {
            items,
            total,
            page,
            page_size,
        }
    }

    pub async fn delete(&self, id: uuid::Uuid) -> Result<(), String> {
        let mut entries = self.inner.write().await;
        entries.retain(|entry| entry.id != id);
        self.persist(&entries).await
    }

    pub async fn clear(&self) -> Result<(), String> {
        let mut entries = self.inner.write().await;
        entries.clear();
        self.persist(&entries).await
    }

    pub async fn upsert_by_request_id<F>(
        &self,
        request_id: &str,
        build: F,
    ) -> Result<HistoryEntry, String>
    where
        F: FnOnce(Option<HistoryEntry>) -> HistoryEntry,
    {
        let mut entries = self.inner.write().await;
        let index = entries
            .iter()
            .position(|entry| entry.request_id == request_id);
        let existing = index.map(|current| entries[current].clone());
        let next = build(existing);

        if let Some(index) = index {
            entries[index] = next.clone();
        } else {
            entries.insert(0, next.clone());
            if entries.len() > 500 {
                entries.truncate(500);
            }
        }

        self.persist(&entries).await?;
        Ok(next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::download::{DownloadRequest, DownloadType};
    use tempfile::tempdir;
    use uuid::Uuid;

    fn sample_entry(status: DownloadStatus) -> HistoryEntry {
        HistoryEntry {
            id: Uuid::new_v4(),
            request_id: String::new(),
            url: "https://example.com/video".to_string(),
            title: "Sample".to_string(),
            thumbnail: None,
            download_type: DownloadType::Full,
            output_path: String::new(),
            status,
            started_at: Utc::now(),
            completed_at: None,
            file_size: None,
            settings: DownloadRequest::default(),
        }
    }

    #[test]
    fn normalize_loaded_entries_marks_active_downloads_as_interrupted() {
        let now = Utc::now();
        let queued = sample_entry(DownloadStatus::Queued);
        let running = sample_entry(DownloadStatus::Running);
        let complete = sample_entry(DownloadStatus::Complete);

        let normalized = normalize_loaded_entries(vec![queued, running, complete.clone()], now);

        assert_eq!(normalized[0].status, DownloadStatus::Interrupted);
        assert_eq!(normalized[1].status, DownloadStatus::Interrupted);
        assert_eq!(normalized[2].status, DownloadStatus::Complete);
        assert!(normalized[0].completed_at.is_some());
        assert!(normalized[1].completed_at.is_some());
        assert_eq!(normalized[2].completed_at, complete.completed_at);
        assert!(!normalized[0].request_id.is_empty());
        assert!(!normalized[1].request_id.is_empty());
    }

    #[tokio::test]
    async fn load_from_path_persists_recovered_history() {
        let temp_dir = tempdir().expect("temp dir");
        let path = temp_dir.path().join("download_history.json");
        let queued = sample_entry(DownloadStatus::Queued);
        fs::write(
            &path,
            serde_json::to_vec(&vec![queued]).expect("serialize history"),
        )
        .expect("write history");

        let service = HistoryService::load_from_path(path.clone()).expect("load history");
        let page = service.list_page(1, 10).await;

        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].status, DownloadStatus::Interrupted);

        let persisted: Vec<HistoryEntry> =
            serde_json::from_str(&fs::read_to_string(&path).expect("read history"))
                .expect("parse history");
        assert_eq!(persisted[0].status, DownloadStatus::Interrupted);
    }

    #[tokio::test]
    async fn upsert_by_request_id_trims_history_to_500_entries() {
        let temp_dir = tempdir().expect("temp dir");
        let path = temp_dir.path().join("download_history.json");
        let service = HistoryService::load_from_path(path).expect("load history");

        for index in 0..501 {
            let request_id = format!("req-{index}");
            service
                .upsert_by_request_id(&request_id, |_| HistoryEntry {
                    id: Uuid::new_v4(),
                    request_id: request_id.clone(),
                    url: format!("https://example.com/{index}"),
                    title: format!("Video {index}"),
                    thumbnail: None,
                    download_type: DownloadType::Full,
                    output_path: String::new(),
                    status: DownloadStatus::Queued,
                    started_at: Utc::now(),
                    completed_at: None,
                    file_size: None,
                    settings: DownloadRequest::default(),
                })
                .await
                .expect("upsert history");
        }

        let page = service.list_page(1, 600).await;
        assert_eq!(page.total, 500);
        assert_eq!(page.items.len(), 500);
    }

    #[tokio::test]
    async fn list_page_clamps_page_size_and_returns_requested_slice() {
        let temp_dir = tempdir().expect("temp dir");
        let path = temp_dir.path().join("download_history.json");
        let service = HistoryService::load_from_path(path).expect("load history");

        for index in 0..3 {
            let request_id = format!("page-{index}");
            service
                .upsert_by_request_id(&request_id, |_| HistoryEntry {
                    id: Uuid::new_v4(),
                    request_id: request_id.clone(),
                    url: format!("https://example.com/{index}"),
                    title: format!("Video {index}"),
                    thumbnail: None,
                    download_type: DownloadType::Full,
                    output_path: String::new(),
                    status: DownloadStatus::Complete,
                    started_at: Utc::now(),
                    completed_at: Some(Utc::now()),
                    file_size: None,
                    settings: DownloadRequest::default(),
                })
                .await
                .expect("upsert history");
        }

        let page = service.list_page(2, 2).await;
        assert_eq!(page.page, 2);
        assert_eq!(page.page_size, 2);
        assert_eq!(page.items.len(), 1);
    }
}
