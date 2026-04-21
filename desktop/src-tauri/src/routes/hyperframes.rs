use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    models::hyperframes::{
        GenerateOverlayRequest, ImportOverlayRequest, RenderOverlayRequest, SaveDesignRequest,
    },
    server::AppState,
    services::hyperframes,
};

pub async fn hyperframes_context(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({ "context": hyperframes::hyperframes_context(&state).await }))
}

pub async fn hyperframes_catalog(State(_state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({ "items": hyperframes::catalog_items() }))
}

pub async fn get_design(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let (path, content) = hyperframes::read_design_document(&state).await.map_err(|message| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": message })),
        )
    })?;
    Ok(Json(json!({
        "path": path.to_string_lossy().to_string(),
        "content": content,
    })))
}

pub async fn save_design(
    State(state): State<AppState>,
    Json(payload): Json<SaveDesignRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let path = hyperframes::save_design_document(&state, &payload.content).await.map_err(
        |message| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({ "error": message })),
            )
        },
    )?;
    Ok(Json(json!({
        "success": true,
        "path": path.to_string_lossy().to_string(),
    })))
}

pub async fn list_jobs(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({ "items": state.active_hyperframes() }))
}

pub async fn list_artifacts(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let items = hyperframes::list_artifacts(&state).await.map_err(|message| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": message })),
        )
    })?;
    Ok(Json(json!({ "items": items })))
}

pub async fn get_artifact(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let detail = hyperframes::artifact_detail(&state, &job_id).await.map_err(|message| {
        (
            axum::http::StatusCode::NOT_FOUND,
            Json(json!({ "error": message })),
        )
    })?;
    Ok(Json(json!({
        "artifact": detail.artifact,
        "htmlSource": detail.html_source,
    })))
}

pub async fn generate_overlay(
    State(state): State<AppState>,
    Json(payload): Json<GenerateOverlayRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    if payload.prompt.trim().is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Prompt is required" })),
        ));
    }

    let job_id = Uuid::new_v4().to_string();
    let spawned_state = state.clone();
    let spawned_payload = payload.clone();
    let spawned_job_id = job_id.clone();
    state.emit_hyperframes_progress(
        &job_id,
        crate::models::download::DownloadStage::Preparing,
        Some("0.0%".to_string()),
        Some("Queued overlay generation".to_string()),
        true,
    );

    tokio::spawn(async move {
        if let Err(message) =
            hyperframes::run_generate_job(spawned_state.clone(), spawned_job_id.clone(), spawned_payload).await
        {
            spawned_state.emit_hyperframes_failed(&spawned_job_id, message);
        }
    });

    Ok(Json(json!({
        "success": true,
        "jobId": job_id,
    })))
}

pub async fn render_overlay(
    State(state): State<AppState>,
    Json(payload): Json<RenderOverlayRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    if payload.job_id.trim().is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": "jobId is required" })),
        ));
    }

    let job_id = payload.job_id.trim().to_string();
    let spawned_state = state.clone();
    let spawned_job_id = job_id.clone();
    state.emit_hyperframes_progress(
        &job_id,
        crate::models::download::DownloadStage::Preparing,
        Some("0.0%".to_string()),
        Some("Queued overlay render".to_string()),
        true,
    );

    tokio::spawn(async move {
        if let Err(message) = hyperframes::run_render_job(spawned_state.clone(), spawned_job_id.clone()).await {
            spawned_state.emit_hyperframes_failed(&spawned_job_id, message);
        }
    });

    Ok(Json(json!({
        "success": true,
        "jobId": job_id,
    })))
}

pub async fn import_overlay(
    State(state): State<AppState>,
    Json(payload): Json<ImportOverlayRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    hyperframes::import_rendered_overlay(&state, payload.job_id.trim())
        .await
        .map_err(|message| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(json!({ "error": message })),
            )
        })?;
    Ok(Json(json!({ "success": true })))
}
