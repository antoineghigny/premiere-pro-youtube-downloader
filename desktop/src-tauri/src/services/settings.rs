use std::{fs, path::PathBuf};

use tokio::sync::RwLock;

use crate::{
    models::settings::AppSettings,
    utils::{settings_file_path, write_json_atomic},
};

#[derive(Debug)]
pub struct SettingsService {
    path: PathBuf,
    inner: RwLock<AppSettings>,
}

fn normalize_settings(mut settings: AppSettings) -> AppSettings {
    let allowed_resolutions = ["2160", "1440", "1080", "720", "480"];
    if !allowed_resolutions.contains(&settings.resolution.as_str()) {
        settings.resolution = AppSettings::default().resolution;
    }

    if settings.concurrent_downloads == 0 {
        settings.concurrent_downloads = 2;
    }

    if !matches!(settings.theme.as_str(), "dark" | "light") {
        settings.theme = "dark".to_string();
    }

    if !matches!(settings.language.as_str(), "en" | "fr") {
        settings.language = "en".to_string();
    }

    settings
}

fn read_settings_file(path: &PathBuf) -> Option<AppSettings> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str::<AppSettings>(&content).ok()
}

impl SettingsService {
    pub fn load() -> Result<Self, String> {
        Self::load_from_path(settings_file_path()?)
    }

    pub(crate) fn load_from_path(path: PathBuf) -> Result<Self, String> {
        let raw_settings = read_settings_file(&path).unwrap_or_default();
        let settings = normalize_settings(raw_settings);

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create settings directory: {}", error))?;
        }
        write_json_atomic(&path, &settings)?;

        Ok(Self {
            path,
            inner: RwLock::new(settings),
        })
    }

    pub async fn get(&self) -> AppSettings {
        self.inner.read().await.clone()
    }

    pub async fn save(&self, settings: AppSettings) -> Result<AppSettings, String> {
        let normalized = normalize_settings(settings);
        write_json_atomic(&self.path, &normalized)?;
        *self.inner.write().await = normalized.clone();
        Ok(normalized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn load_from_path_normalizes_invalid_values_and_persists_them() {
        let temp_dir = tempdir().expect("temp dir");
        let path = temp_dir.path().join("settings.json");
        let invalid = AppSettings {
            resolution: "999".to_string(),
            concurrent_downloads: 0,
            theme: "neon".to_string(),
            language: "es".to_string(),
            ..AppSettings::default()
        };
        fs::write(
            &path,
            serde_json::to_vec(&invalid).expect("serialize settings"),
        )
        .expect("write settings");

        let service = SettingsService::load_from_path(path.clone()).expect("load settings");
        let settings = service.get().await;

        assert_eq!(settings.resolution, "1080");
        assert_eq!(settings.concurrent_downloads, 2);
        assert_eq!(settings.theme, "dark");
        assert_eq!(settings.language, "en");

        let persisted: AppSettings =
            serde_json::from_str(&fs::read_to_string(&path).expect("read settings"))
                .expect("parse settings");
        assert_eq!(persisted.resolution, "1080");
        assert_eq!(persisted.concurrent_downloads, 2);
        assert_eq!(persisted.theme, "dark");
        assert_eq!(persisted.language, "en");
    }

    #[tokio::test]
    async fn save_rewrites_the_backing_file() {
        let temp_dir = tempdir().expect("temp dir");
        let path = temp_dir.path().join("settings.json");
        let service = SettingsService::load_from_path(path.clone()).expect("load settings");

        let saved = service
            .save(AppSettings {
                resolution: "720".to_string(),
                concurrent_downloads: 4,
                theme: "light".to_string(),
                language: "fr".to_string(),
                ..AppSettings::default()
            })
            .await
            .expect("save settings");

        assert_eq!(saved.resolution, "720");
        assert_eq!(saved.concurrent_downloads, 4);
        assert_eq!(saved.theme, "light");
        assert_eq!(saved.language, "fr");

        let persisted: AppSettings =
            serde_json::from_str(&fs::read_to_string(&path).expect("read settings"))
                .expect("parse settings");
        assert_eq!(persisted.resolution, "720");
        assert_eq!(persisted.concurrent_downloads, 4);
        assert_eq!(persisted.theme, "light");
        assert_eq!(persisted.language, "fr");
    }
}
