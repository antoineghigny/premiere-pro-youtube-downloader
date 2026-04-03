use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{models::history::HistoryQuery, server::AppState};

pub async fn list_history(
    State(state): State<AppState>,
    Query(query): Query<HistoryQuery>,
) -> Json<crate::models::history::HistoryResponse> {
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(100);
    Json(state.history.list_page(page, page_size).await)
}

pub async fn delete_history(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let parsed_id = Uuid::parse_str(&id).map_err(|_| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid history id" })),
        )
    })?;
    state.history.delete(parsed_id).await.map_err(|message| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": message })),
        )
    })?;
    Ok(Json(json!({ "success": true })))
}

pub async fn clear_history(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    state.history.clear().await.map_err(|message| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": message })),
        )
    })?;
    Ok(Json(json!({ "success": true })))
}
