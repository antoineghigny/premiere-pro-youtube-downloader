use std::collections::HashSet;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::HeaderMap,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tokio::time::{interval, Duration};

use crate::{cors::is_allowed_socket_origin, models::download::DownloadStage, server::AppState};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WsEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub request_id: String,
    pub stage: Option<DownloadStage>,
    pub percentage: Option<String>,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub detail: Option<String>,
    pub indeterminate: Option<bool>,
    pub path: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WsHub {
    sender: broadcast::Sender<WsEvent>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum ClientEvent {
    Subscribe { request_id: String },
    Unsubscribe { request_id: String },
}

impl WsHub {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(2048);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.sender.subscribe()
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
        let _ = self.sender.send(WsEvent {
            event_type: "progress".to_string(),
            request_id: request_id.to_string(),
            stage: Some(stage),
            percentage,
            speed,
            eta,
            detail,
            indeterminate: Some(indeterminate),
            path: None,
            message: None,
        });
    }

    pub fn emit_complete(&self, request_id: &str, path: String) {
        let _ = self.sender.send(WsEvent {
            event_type: "complete".to_string(),
            request_id: request_id.to_string(),
            stage: Some(DownloadStage::Complete),
            percentage: Some("100.0%".to_string()),
            speed: None,
            eta: None,
            detail: None,
            indeterminate: Some(false),
            path: Some(path),
            message: None,
        });
    }

    pub fn emit_failed(&self, request_id: &str, message: String) {
        let _ = self.sender.send(WsEvent {
            event_type: "failed".to_string(),
            request_id: request_id.to_string(),
            stage: Some(DownloadStage::Failed),
            percentage: None,
            speed: None,
            eta: None,
            detail: None,
            indeterminate: Some(true),
            path: None,
            message: Some(message),
        });
    }
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let origin = headers
        .get("origin")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let Some(origin) = origin else {
        return axum::http::StatusCode::FORBIDDEN.into_response();
    };

    if !is_allowed_socket_origin(origin) {
        return axum::http::StatusCode::FORBIDDEN.into_response();
    }

    ws.on_upgrade(move |socket| handle_socket(socket, state.websocket_hub.clone()))
}

async fn handle_socket(mut socket: WebSocket, hub: WsHub) {
    let mut receiver = hub.subscribe();
    let mut subscriptions = HashSet::<String>::new();
    let mut ping_interval = interval(Duration::from_secs(30));

    loop {
        tokio::select! {
            _ = ping_interval.tick() => {
                if socket.send(Message::Ping(Vec::new().into())).await.is_err() {
                    break;
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(event) = serde_json::from_str::<ClientEvent>(&text) {
                            match event {
                                ClientEvent::Subscribe { request_id } => {
                                    subscriptions.insert(request_id);
                                }
                                ClientEvent::Unsubscribe { request_id } => {
                                    subscriptions.remove(&request_id);
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Pong(_))) => {}
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
            outgoing = receiver.recv() => {
                match outgoing {
                    Ok(event) if subscriptions.contains(&event.request_id) => {
                        if let Ok(payload) = serde_json::to_string(&event) {
                            if socket.send(Message::Text(payload.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(_) => break,
                }
            }
        }
    }
}
