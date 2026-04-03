use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU16, Ordering},
        Arc, RwLock,
    },
    time::Duration,
};

#[cfg(test)]
use std::path::Path;

use axum::{middleware, routing::get, Router};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::Serialize;
use tokio::{net::TcpListener, process::Child, sync::Mutex};

use crate::{
    cors,
    models::{download::DownloadStage, runtime::ActiveDownloadState},
    routes,
    services::{history::HistoryService, settings::SettingsService},
    utils::{
        active_port_file_path, backend_instance_kind, resolve_tool_paths, write_json_atomic,
        ToolPaths, APP_FINGERPRINT, BACKEND_API_VERSION, BACKEND_TRANSPORT, SERVER_PORT_RANGE,
    },
    websocket::{self, WsHub},
};

const CEP_HEARTBEAT_TTL: i64 = 15;

#[derive(Debug)]
pub struct CepRegistration {
    port: AtomicU16,
    last_heartbeat: RwLock<Option<DateTime<Utc>>>,
}

impl CepRegistration {
    fn new() -> Self {
        Self {
            port: AtomicU16::new(0),
            last_heartbeat: RwLock::new(None),
        }
    }

    fn register(&self, port: u16) {
        self.port.store(port, Ordering::SeqCst);
        if let Ok(mut last_heartbeat) = self.last_heartbeat.write() {
            *last_heartbeat = Some(Utc::now());
        }
    }

    fn current_port(&self) -> Option<u16> {
        let port = self.port.load(Ordering::SeqCst);
        if port == 0 {
            return None;
        }

        let Ok(last_heartbeat) = self.last_heartbeat.read() else {
            return None;
        };
        let Some(last_heartbeat) = *last_heartbeat else {
            return None;
        };

        if (Utc::now() - last_heartbeat).num_seconds() > CEP_HEARTBEAT_TTL {
            return None;
        }

        Some(port)
    }

    fn clear(&self) {
        self.port.store(0, Ordering::SeqCst);
        if let Ok(mut last_heartbeat) = self.last_heartbeat.write() {
            *last_heartbeat = None;
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivePortDescriptor {
    app: &'static str,
    api_version: u8,
    transport: &'static str,
    instance_kind: &'static str,
    cep_token: String,
    port: u16,
    pid: u32,
    version: &'static str,
}

#[derive(Debug, Clone)]
pub struct AuthState {
    desktop_token: String,
    cep_token: String,
}

impl AuthState {
    fn new() -> Self {
        Self {
            desktop_token: uuid::Uuid::new_v4().to_string(),
            cep_token: uuid::Uuid::new_v4().to_string(),
        }
    }

    pub fn desktop_token(&self) -> &str {
        &self.desktop_token
    }

    pub fn cep_token(&self) -> &str {
        &self.cep_token
    }
}

#[derive(Clone)]
pub struct AppState {
    pub settings: Arc<SettingsService>,
    pub history: Arc<HistoryService>,
    pub tools: ToolPaths,
    pub resource_dir: Option<PathBuf>,
    pub websocket_hub: WsHub,
    pub downloads: Arc<DashMap<String, ActiveDownloadState>>,
    pub child_processes: Arc<DashMap<String, Arc<Mutex<Child>>>>,
    pub cep: Arc<CepRegistration>,
    pub auth: Arc<AuthState>,
    pub server_port: Arc<AtomicU16>,
    pub quit_requested: Arc<AtomicBool>,
}

impl AppState {
    pub fn bootstrap(resource_dir: Option<PathBuf>) -> Result<Self, String> {
        let tools = resolve_tool_paths();
        tracing::info!(
            "Resolved tools: yt-dlp={}, ffmpeg={}",
            tools.yt_dlp,
            tools.ffmpeg
        );

        Ok(Self {
            settings: Arc::new(SettingsService::load()?),
            history: Arc::new(HistoryService::load()?),
            tools,
            resource_dir,
            websocket_hub: WsHub::new(),
            downloads: Arc::new(DashMap::new()),
            child_processes: Arc::new(DashMap::new()),
            cep: Arc::new(CepRegistration::new()),
            auth: Arc::new(AuthState::new()),
            server_port: Arc::new(AtomicU16::new(0)),
            quit_requested: Arc::new(AtomicBool::new(false)),
        })
    }

    pub fn server_port(&self) -> u16 {
        self.server_port.load(Ordering::SeqCst)
    }

    pub fn register_cep_port(&self, port: u16) {
        self.cep.register(port);
    }

    pub fn active_cep_port(&self) -> Option<u16> {
        self.cep.current_port()
    }

    pub fn clear_cep_port(&self) {
        self.cep.clear();
    }

    pub fn update_download_state(&self, next: ActiveDownloadState) {
        self.downloads.insert(next.request_id.clone(), next);
    }

    pub fn active_downloads(&self) -> Vec<ActiveDownloadState> {
        self.downloads
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    pub fn emit_progress(
        &self,
        request_id: &str,
        stage: DownloadStage,
        percentage: Option<String>,
        speed: Option<String>,
        eta: Option<String>,
        detail: Option<String>,
        indeterminate: bool,
    ) {
        self.update_download_state(ActiveDownloadState {
            request_id: request_id.to_string(),
            stage: stage.clone(),
            percentage: percentage.clone(),
            speed: speed.clone(),
            eta: eta.clone(),
            detail: detail.clone(),
            indeterminate,
            path: None,
            message: None,
            updated_at: Utc::now(),
        });

        self.websocket_hub.emit_progress(
            request_id,
            stage,
            percentage,
            speed,
            eta,
            detail,
            indeterminate,
        );
    }

    pub fn emit_complete(&self, request_id: &str, path: String) {
        self.update_download_state(ActiveDownloadState {
            request_id: request_id.to_string(),
            stage: DownloadStage::Complete,
            percentage: Some("100.0%".to_string()),
            speed: None,
            eta: None,
            detail: None,
            indeterminate: false,
            path: Some(path.clone()),
            message: None,
            updated_at: Utc::now(),
        });

        self.websocket_hub.emit_complete(request_id, path);
    }

    pub fn emit_failed(&self, request_id: &str, message: String) {
        self.update_download_state(ActiveDownloadState {
            request_id: request_id.to_string(),
            stage: DownloadStage::Failed,
            percentage: None,
            speed: None,
            eta: None,
            detail: None,
            indeterminate: true,
            path: None,
            message: Some(message.clone()),
            updated_at: Utc::now(),
        });

        self.websocket_hub.emit_failed(request_id, message);
    }

    pub fn register_child_process(&self, key: String, child: Child) {
        self.child_processes
            .insert(key, Arc::new(Mutex::new(child)));
    }

    pub fn child_process(&self, key: &str) -> Option<Arc<Mutex<Child>>> {
        self.child_processes
            .get(key)
            .map(|entry| entry.value().clone())
    }

    pub fn release_child_process(&self, key: &str) {
        self.child_processes.remove(key);
    }

    pub async fn kill_all_child_processes(&self) {
        let processes: Vec<(String, Arc<Mutex<Child>>)> = self
            .child_processes
            .iter()
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect();

        for (key, child) in processes {
            let mut child = child.lock().await;
            let _ = child.kill().await;
            self.child_processes.remove(&key);
        }
    }

    #[cfg(test)]
    pub(crate) fn for_tests(base_dir: &Path) -> Result<Self, String> {
        Ok(Self {
            settings: Arc::new(SettingsService::load_from_path(
                base_dir.join("settings.json"),
            )?),
            history: Arc::new(HistoryService::load_from_path(
                base_dir.join("download_history.json"),
            )?),
            tools: ToolPaths {
                yt_dlp: "yt-dlp".to_string(),
                ffmpeg: "ffmpeg".to_string(),
            },
            resource_dir: None,
            websocket_hub: WsHub::new(),
            downloads: Arc::new(DashMap::new()),
            child_processes: Arc::new(DashMap::new()),
            cep: Arc::new(CepRegistration::new()),
            auth: Arc::new(AuthState::new()),
            server_port: Arc::new(AtomicU16::new(3001)),
            quit_requested: Arc::new(AtomicBool::new(false)),
        })
    }
}

async fn bind_server(state: &AppState) -> Result<TcpListener, String> {
    for port in SERVER_PORT_RANGE {
        match TcpListener::bind(("127.0.0.1", port)).await {
            Ok(listener) => {
                let port_file = active_port_file_path()?;
                let descriptor = ActivePortDescriptor {
                    app: APP_FINGERPRINT,
                    api_version: BACKEND_API_VERSION,
                    transport: BACKEND_TRANSPORT,
                    instance_kind: backend_instance_kind(),
                    cep_token: state.auth.cep_token().to_string(),
                    port,
                    pid: std::process::id(),
                    version: env!("CARGO_PKG_VERSION"),
                };
                write_json_atomic(&port_file, &descriptor)?;
                state.server_port.store(port, Ordering::SeqCst);
                return Ok(listener);
            }
            Err(_) => continue,
        }
    }

    Err("No available port in range 3001-3010".to_string())
}

pub async fn serve(state: AppState) -> Result<(), String> {
    let listener = bind_server(&state).await?;
    let port = state.server_port();

    let app = Router::new()
        .route(
            "/",
            get(routes::health::root)
                .post(routes::health::root_post)
                .options(routes::options_ok),
        )
        .route(
            "/get-version",
            get(routes::health::get_version).options(routes::options_ok),
        )
        .route(
            "/settings",
            get(routes::settings::get_settings)
                .post(routes::settings::save_settings)
                .options(routes::options_ok),
        )
        .route(
            "/pick-folder",
            axum::routing::post(routes::folder_picker::pick_folder).options(routes::options_ok),
        )
        .route(
            "/video-info",
            axum::routing::post(routes::video_info::video_info).options(routes::options_ok),
        )
        .route(
            "/handle-video-url",
            axum::routing::post(routes::download::handle_video_url).options(routes::options_ok),
        )
        .route(
            "/active-downloads",
            get(routes::download::active_downloads).options(routes::options_ok),
        )
        .route(
            "/premiere-status",
            get(routes::premiere::premiere_status).options(routes::options_ok),
        )
        .route(
            "/integrations/status",
            get(routes::integrations::integration_status).options(routes::options_ok),
        )
        .route(
            "/integrations/install-premiere",
            axum::routing::post(routes::integrations::install_premiere).options(routes::options_ok),
        )
        .route(
            "/integrations/open-browser-setup",
            axum::routing::post(routes::integrations::open_browser_setup)
                .options(routes::options_ok),
        )
        .route(
            "/register-cep",
            axum::routing::post(routes::premiere::register_cep).options(routes::options_ok),
        )
        .route(
            "/reveal-file",
            axum::routing::post(routes::premiere::reveal_file).options(routes::options_ok),
        )
        .route(
            "/history",
            get(routes::history::list_history)
                .delete(routes::history::clear_history)
                .options(routes::options_ok),
        )
        .route(
            "/history/{id}",
            axum::routing::delete(routes::history::delete_history).options(routes::options_ok),
        )
        .route("/ws", get(websocket::ws_handler))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            cors::enforce_request_origin,
        ))
        .with_state(state.clone());

    tracing::info!("YT2Premiere Rust backend listening on http://127.0.0.1:{port}");
    let shutdown_state = state.clone();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            while !shutdown_state.quit_requested.load(Ordering::SeqCst) {
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        })
        .await
        .map_err(|error| format!("HTTP server error: {}", error))
}
