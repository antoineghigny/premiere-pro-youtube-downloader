use std::{
    fs::{self, File},
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use base64::Engine;
use chrono::Utc;
use futures::{SinkExt, StreamExt};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::{
    fs as async_fs,
    io::{AsyncBufReadExt, AsyncReadExt, BufReader},
    process::Command,
    time::sleep,
};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;
use zip::ZipArchive;

use crate::{
    models::{
        download::DownloadStage,
        hyperframes::{
            GenerateOverlayRequest, HyperframesArtifactDetail, HyperframesArtifactManifest,
            HyperframesCatalogItem, HyperframesContext, PremiereSequenceContext,
        },
    },
    server::AppState,
    services::premiere,
    utils::{app_storage_dir, hide_windows_console_tokio, write_json_atomic},
};

const CHROME_FOR_TESTING_INDEX_URL: &str =
    "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";
const DEFAULT_GSAP_URL: &str = "https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js";

#[derive(Debug, Deserialize)]
struct GeneratedHtmlPayload {
    title: String,
    html: String,
}

#[derive(Debug, Deserialize)]
struct GeminiPart {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Debug)]
struct ResolvedRange {
    in_seconds: f64,
    out_seconds: f64,
    duration_seconds: f64,
}

#[derive(Debug, Deserialize)]
struct CdpCreateTargetResponse {
    id: String,
    #[serde(rename = "webSocketDebuggerUrl")]
    web_socket_debugger_url: String,
}

struct CdpClient {
    socket: tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    next_id: u64,
}

impl CdpClient {
    async fn connect(websocket_url: &str) -> Result<Self, String> {
        let (socket, _) = connect_async(websocket_url)
            .await
            .map_err(|error| format!("Could not connect to Chromium DevTools: {}", error))?;
        Ok(Self { socket, next_id: 1 })
    }

    async fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let payload = json!({
            "id": id,
            "method": method,
            "params": params,
        });

        self.socket
            .send(Message::Text(payload.to_string().into()))
            .await
            .map_err(|error| format!("Could not send Chromium command {method}: {error}"))?;

        loop {
            let Some(message) = self.socket.next().await else {
                return Err("Chromium closed the DevTools connection".to_string());
            };
            let message =
                message.map_err(|error| format!("Could not read Chromium DevTools response: {}", error))?;

            match message {
                Message::Text(text) => {
                    let payload: Value = serde_json::from_str(&text).map_err(|error| {
                        format!("Could not parse Chromium DevTools payload: {}", error)
                    })?;

                    if payload.get("id").and_then(|value| value.as_u64()) == Some(id) {
                        if let Some(error) = payload.get("error") {
                            return Err(format!("Chromium rejected {method}: {}", error));
                        }
                        return Ok(payload.get("result").cloned().unwrap_or(Value::Null));
                    }
                }
                Message::Close(_) => return Err("Chromium closed the DevTools connection".to_string()),
                _ => {}
            }
        }
    }

    async fn wait_for_event(&mut self, event_name: &str) -> Result<Value, String> {
        loop {
            let Some(message) = self.socket.next().await else {
                return Err("Chromium closed the DevTools connection".to_string());
            };
            let message =
                message.map_err(|error| format!("Could not read Chromium event: {}", error))?;

            if let Message::Text(text) = message {
                let payload: Value = serde_json::from_str(&text)
                    .map_err(|error| format!("Could not parse Chromium event payload: {}", error))?;
                if payload
                    .get("method")
                    .and_then(|value| value.as_str())
                    == Some(event_name)
                {
                    return Ok(payload.get("params").cloned().unwrap_or(Value::Null));
                }
            }
        }
    }
}

pub fn catalog_items() -> Vec<HyperframesCatalogItem> {
    vec![
        HyperframesCatalogItem {
            id: "kinetic-title".to_string(),
            title: "Kinetic Title".to_string(),
            summary: "Large editorial text with accent bars and a controlled reveal.".to_string(),
            prompt_hint: "Sharp opener, launch line, chapter card, hero stat".to_string(),
            accent: "#6116ff".to_string(),
            tags: vec!["title".to_string(), "editorial".to_string(), "clean".to_string()],
        },
        HyperframesCatalogItem {
            id: "spotlight-callout".to_string(),
            title: "Spotlight Callout".to_string(),
            summary: "Focused overlay card for naming a product, feature, or key quote.".to_string(),
            prompt_hint: "Product name, feature callout, premium UI burst".to_string(),
            accent: "#14b8a6".to_string(),
            tags: vec!["callout".to_string(), "product".to_string(), "overlay".to_string()],
        },
        HyperframesCatalogItem {
            id: "chapter-breaker".to_string(),
            title: "Chapter Breaker".to_string(),
            summary: "A transition-style full-frame bumper with strong spatial motion.".to_string(),
            prompt_hint: "Section transition, change of argument, chapter reset".to_string(),
            accent: "#f97316".to_string(),
            tags: vec!["transition".to_string(), "chapter".to_string(), "bumper".to_string()],
        },
        HyperframesCatalogItem {
            id: "stats-grid".to_string(),
            title: "Stats Grid".to_string(),
            summary: "Structured numbers, labels, and micro-chart blocks for explainers.".to_string(),
            prompt_hint: "Metrics, before/after, benchmark numbers".to_string(),
            accent: "#22c55e".to_string(),
            tags: vec!["stats".to_string(), "data".to_string(), "explainer".to_string()],
        },
    ]
}

fn default_design_document(project_name: Option<&str>) -> String {
    format!(
        r#"# DESIGN.md

## Project
- Name: {}
- Primary use: HTML motion overlays generated inside YT2Premiere and inserted in Premiere Pro.

## Visual Direction
- Tone: cinematic, technical, premium, high-contrast.
- Canvas: transparent whenever possible; assume the video edit is visible behind the overlay.
- Layout: strong hierarchy, large hero type, modular supporting lines, no clutter.

## Colors
- Accent: #6116ff
- Surface: rgba(11, 12, 20, 0.84)
- Surface strong: rgba(6, 7, 14, 0.96)
- Text primary: #f8f8ff
- Text muted: rgba(229, 231, 235, 0.72)

## Typography
- Display: Epilogue, sans-serif
- Body: Geist Variable, sans-serif
- Prefer tight, editorial spacing over round playful UI.

## Motion
- Motion should feel deliberate, not bouncy.
- Use layered reveals, masks, translations, and opacity ramps.
- Default easing: power3.out / power2.inOut.
- Hold enough time for readability before exiting.

## What NOT to Do
- No purple-on-white startup aesthetic.
- No glassmorphism blur overload.
- No stock dashboard cards unless the prompt explicitly asks for them.
- No random particle systems or noisy backgrounds.
- No tiny unreadable labels.
"#,
        project_name.unwrap_or("Untitled Premiere Project")
    )
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn job_title_from_prompt(prompt: &str) -> String {
    let first_line = prompt.lines().next().unwrap_or(prompt).trim();
    let trimmed = if first_line.len() > 72 {
        &first_line[..72]
    } else {
        first_line
    };
    if trimmed.is_empty() {
        "Untitled overlay".to_string()
    } else {
        trimmed.to_string()
    }
}

fn build_contract_runtime(duration_seconds: f64) -> String {
    format!(
        r#"<script>
(function () {{
  var DURATION = {duration_seconds};
  function clamp(value, min, max) {{
    return Math.max(min, Math.min(max, value));
  }}

  function resolveTimeline() {{
    if (window.__yt2premiereTimeline && typeof window.__yt2premiereTimeline.time === "function") {{
      return window.__yt2premiereTimeline;
    }}
    if (window.__timelines) {{
      var keys = Object.keys(window.__timelines);
      for (var index = 0; index < keys.length; index++) {{
        var candidate = window.__timelines[keys[index]];
        if (candidate && typeof candidate.time === "function") {{
          return candidate;
        }}
      }}
    }}
    return null;
  }}

  function applyTime(seconds) {{
    var safeSeconds = clamp(Number(seconds) || 0, 0, Math.max(DURATION, 0));
    var timeline = resolveTimeline();
    document.documentElement.style.setProperty("--yt2pp-current-time", String(safeSeconds));
    document.documentElement.style.setProperty("--yt2pp-progress", String(DURATION <= 0 ? 1 : safeSeconds / DURATION));

    if (timeline) {{
      try {{
        timeline.pause();
        var upperBound = typeof timeline.duration === "function" ? timeline.duration() : DURATION;
        timeline.time(clamp(safeSeconds, 0, Math.max(upperBound || 0, DURATION)));
      }} catch (_timelineError) {{}}
    }}

    document.dispatchEvent(new CustomEvent("yt2pp:time", {{ detail: {{ seconds: safeSeconds, duration: DURATION }} }}));
  }}

  window.__yt2premiereSetTime = applyTime;
  window.addEventListener("message", function (event) {{
    if (!event.data || typeof event.data !== "object") {{
      return;
    }}
    if (event.data.type === "yt2pp:setTime") {{
      applyTime(event.data.seconds);
    }}
  }});

  if (document.readyState === "loading") {{
    document.addEventListener("DOMContentLoaded", function () {{ applyTime(0); }}, {{ once: true }});
  }} else {{
    applyTime(0);
  }}
}})();
</script>"#,
        duration_seconds = duration_seconds
    )
}

fn ensure_html_contract(html: &str, duration_seconds: f64, title: &str) -> String {
    let normalized = if html.to_ascii_lowercase().contains("<html") {
        html.to_string()
    } else {
        format!(
            "<!DOCTYPE html><html><head><meta charset=\"utf-8\" /><title>{}</title></head><body>{}</body></html>",
            html_escape(title),
            html
        )
    };

    let mut output = normalized;
    if !output.contains(DEFAULT_GSAP_URL) && output.contains("gsap.") {
        if let Some(head_end) = output.to_ascii_lowercase().find("</head>") {
            output.insert_str(
                head_end,
                &format!("<script src=\"{}\"></script>", DEFAULT_GSAP_URL),
            );
        }
    }

    if !output.contains("--yt2pp-current-time") {
        if let Some(head_end) = output.to_ascii_lowercase().find("</head>") {
            output.insert_str(
                head_end,
                "<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent !important;}body{min-height:100vh;}</style>",
            );
        }
    }

    let runtime = build_contract_runtime(duration_seconds);
    if let Some(body_end) = output.to_ascii_lowercase().rfind("</body>") {
        output.insert_str(body_end, &runtime);
    } else {
        output.push_str(&runtime);
    }
    output
}

fn fallback_overlay_document(
    prompt: &str,
    title: &str,
    sequence: &PremiereSequenceContext,
    duration_seconds: f64,
) -> String {
    let prompt_html = html_escape(prompt);
    let title_html = html_escape(title);
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title_html}</title>
    <style>
      :root {{
        --progress: 0;
        --accent: #6116ff;
        --surface: rgba(8, 10, 17, 0.82);
        --surface-strong: rgba(4, 5, 10, 0.96);
        --text: #f8f8ff;
        --text-muted: rgba(248, 248, 255, 0.72);
      }}
      * {{
        box-sizing: border-box;
      }}
      html,
      body {{
        width: 100%;
        height: 100%;
        margin: 0;
        background: transparent;
        font-family: "Epilogue", "Segoe UI", sans-serif;
      }}
      body {{
        overflow: hidden;
      }}
      .frame {{
        position: relative;
        width: 100vw;
        height: 100vh;
        padding: 84px;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        color: var(--text);
        background:
          radial-gradient(circle at 15% 18%, rgba(97, 22, 255, 0.24), transparent 26%),
          radial-gradient(circle at 82% 22%, rgba(20, 184, 166, 0.16), transparent 22%),
          linear-gradient(135deg, rgba(5, 6, 10, 0.0), rgba(5, 6, 10, 0.0));
      }}
      .left-rail {{
        position: absolute;
        inset: 0 auto 0 0;
        width: 14px;
        background: linear-gradient(180deg, rgba(97, 22, 255, 0.0), rgba(97, 22, 255, 0.92), rgba(97, 22, 255, 0.0));
        transform: scaleY(calc(0.3 + var(--progress) * 0.7));
        transform-origin: center;
      }}
      .halo {{
        position: absolute;
        inset: auto -12% -26% auto;
        width: 42vw;
        aspect-ratio: 1;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(97, 22, 255, 0.24), rgba(97, 22, 255, 0.02) 62%, transparent 72%);
        opacity: calc(0.35 + var(--progress) * 0.45);
      }}
      .panel {{
        position: relative;
        width: min(860px, 70vw);
        padding: 34px 38px 34px 38px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 34px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
          linear-gradient(160deg, var(--surface), var(--surface-strong));
        box-shadow: 0 28px 72px rgba(0, 0, 0, 0.34);
        transform: translateY(calc((1 - var(--progress)) * 46px)) scale(calc(0.94 + var(--progress) * 0.06));
        opacity: calc(0.06 + var(--progress) * 0.94);
      }}
      .eyebrow {{
        font-size: 14px;
        letter-spacing: 0.34em;
        text-transform: uppercase;
        color: var(--text-muted);
      }}
      .headline {{
        margin-top: 18px;
        font-size: clamp(46px, 4.3vw, 90px);
        line-height: 0.95;
        font-weight: 700;
        max-width: 9ch;
      }}
      .body {{
        margin-top: 18px;
        max-width: 34ch;
        font-size: clamp(18px, 1.45vw, 24px);
        line-height: 1.4;
        color: var(--text-muted);
      }}
      .meta {{
        display: flex;
        gap: 14px;
        margin-top: 26px;
        flex-wrap: wrap;
      }}
      .pill {{
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        font-size: 13px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }}
      .accent-line {{
        position: absolute;
        inset: auto 0 -1px auto;
        width: min(360px, 44vw);
        height: 4px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(97, 22, 255, 0), rgba(97, 22, 255, 1), rgba(97, 22, 255, 0.4));
        transform: scaleX(calc(0.1 + var(--progress) * 0.9));
        transform-origin: right;
      }}
      .timestamp {{
        position: absolute;
        right: 84px;
        top: 84px;
        font-family: "Geist Variable", "Segoe UI", sans-serif;
        font-size: 14px;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.62);
        opacity: calc(0.3 + var(--progress) * 0.7);
      }}
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="left-rail"></div>
      <div class="halo"></div>
      <div class="timestamp">{width}x{height} / {fps}</div>
      <div class="panel">
        <div class="eyebrow">Motion Studio</div>
        <div class="headline">{title_html}</div>
        <div class="body">{prompt_html}</div>
        <div class="meta">
          <div class="pill">Transparent overlay</div>
          <div class="pill">Duration {duration}</div>
          <div class="pill">Premiere-ready</div>
        </div>
        <div class="accent-line"></div>
      </div>
    </div>
    <script>
      (function () {{
        var DURATION = {duration_seconds};
        function clamp(value, min, max) {{
          return Math.max(min, Math.min(max, value));
        }}
        window.__yt2premiereSetTime = function (seconds) {{
          var progress = DURATION <= 0 ? 1 : clamp(Number(seconds) || 0, 0, DURATION) / DURATION;
          document.documentElement.style.setProperty("--progress", String(progress));
          document.documentElement.style.setProperty("--yt2pp-current-time", String(seconds || 0));
        }};
        window.__yt2premiereSetTime(0);
      }})();
    </script>
  </body>
</html>"#,
        title_html = title_html,
        prompt_html = prompt_html,
        width = sequence.width.max(1),
        height = sequence.height.max(1),
        fps = format!("{:.2} fps", sequence.fps.max(1.0)),
        duration = format!("{:.2}s", duration_seconds),
        duration_seconds = duration_seconds
    )
}

fn build_generation_prompt(
    request: &GenerateOverlayRequest,
    design_document: &str,
    sequence: &PremiereSequenceContext,
    duration_seconds: f64,
) -> String {
    let template_hint = catalog_items()
        .into_iter()
        .find(|item| request.template_id.as_deref() == Some(item.id.as_str()))
        .map(|item| format!("Template anchor: {}. {}", item.title, item.summary))
        .unwrap_or_else(|| "Template anchor: create the strongest match for the user prompt.".to_string());

    format!(
        r#"Generate one premium HTML motion overlay for YT2Premiere.

User prompt:
{prompt}

Context:
- Canvas: {width}x{height}
- FPS: {fps:.3}
- Duration: {duration_seconds:.3} seconds
- {template_hint}

Design system:
{design_document}

Return strict JSON with:
- title: short human-readable title
- html: a complete HTML document

Requirements for the HTML:
- transparent background
- inline CSS and inline JS only
- no external assets other than optional GSAP via {gsap_url}
- deterministic behavior only
- install a paused GSAP timeline when GSAP is used:
  const tl = gsap.timeline({{ paused: true }});
  window.__yt2premiereTimeline = tl;
  window.__yt2premiereSetTime = function(seconds) {{ tl.pause(); tl.time(Math.max(0, Math.min(seconds, tl.duration()))); }};
- if not using GSAP, still define window.__yt2premiereSetTime(seconds)
- premium editorial composition, not a generic dashboard
- avoid default blue or purple startup aesthetics; follow DESIGN.md exactly
- no network fetches, iframes, videos, or images
- readable at a glance in video
"#,
        prompt = request.prompt.trim(),
        width = sequence.width.max(1),
        height = sequence.height.max(1),
        fps = sequence.fps.max(1.0),
        duration_seconds = duration_seconds,
        template_hint = template_hint,
        design_document = design_document.trim(),
        gsap_url = DEFAULT_GSAP_URL
    )
}

async fn generate_with_gemini(
    api_key: &str,
    request: &GenerateOverlayRequest,
    design_document: &str,
    sequence: &PremiereSequenceContext,
    duration_seconds: f64,
) -> Result<GeneratedHtmlPayload, String> {
    let client = Client::new();
    let payload = json!({
        "contents": [{
            "parts": [{
                "text": build_generation_prompt(request, design_document, sequence, duration_seconds)
            }]
        }],
        "generationConfig": {
            "temperature": 0.35,
            "responseMimeType": "application/json"
        }
    });

    let response = client
        .post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")
        .header("x-goog-api-key", api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Could not reach Gemini: {}", error))?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(if body.trim().is_empty() {
            "Gemini rejected the overlay request".to_string()
        } else {
            format!("Gemini rejected the overlay request: {}", body)
        });
    }

    let response: GeminiResponse = response
        .json()
        .await
        .map_err(|error| format!("Could not parse Gemini response: {}", error))?;
    let text = response
        .candidates
        .and_then(|candidates| candidates.into_iter().next())
        .and_then(|candidate| candidate.content)
        .and_then(|content| content.parts.into_iter().find_map(|part| part.text))
        .ok_or_else(|| "Gemini returned no candidate text".to_string())?;

    serde_json::from_str::<GeneratedHtmlPayload>(&text)
        .map_err(|error| format!("Gemini returned invalid overlay JSON: {}", error))
}

async fn ensure_project_folder(state: &AppState) -> Result<PathBuf, String> {
    premiere::resolve_project_output_dir(state)
        .await
        .map_err(|error| error.user_message())
}

fn design_file_path(project_root: &Path) -> PathBuf {
    project_root.join("DESIGN.md")
}

fn hyperframes_root(project_root: &Path) -> PathBuf {
    project_root.join(".yt2premiere").join("hyperframes")
}

fn job_dir(project_root: &Path, job_id: &str) -> PathBuf {
    hyperframes_root(project_root).join(job_id)
}

fn manifest_path(project_root: &Path, job_id: &str) -> PathBuf {
    job_dir(project_root, job_id).join("manifest.json")
}

async fn ensure_design_document(state: &AppState) -> Result<(PathBuf, String), String> {
    let project_root = ensure_project_folder(state).await?;
    let design_path = design_file_path(&project_root);
    if design_path.exists() {
        let content = async_fs::read_to_string(&design_path)
            .await
            .map_err(|error| format!("Could not read DESIGN.md: {}", error))?;
        return Ok((design_path, content));
    }

    let project_info = premiere::query_project_info(state)
        .await
        .map_err(|error| error.user_message())?;
    let content = default_design_document(Some(project_info.project_name.as_str()));
    async_fs::write(&design_path, &content)
        .await
        .map_err(|error| format!("Could not create DESIGN.md: {}", error))?;
    Ok((design_path, content))
}

fn read_manifest(path: &Path) -> Option<HyperframesArtifactManifest> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str::<HyperframesArtifactManifest>(&content).ok()
}

fn list_manifest_paths(root: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return paths;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("manifest.json");
        if manifest_path.exists() {
            paths.push(manifest_path);
        }
    }

    paths
}

pub async fn read_design_document(state: &AppState) -> Result<(PathBuf, String), String> {
    ensure_design_document(state).await
}

pub async fn save_design_document(state: &AppState, content: &str) -> Result<PathBuf, String> {
    let project_root = ensure_project_folder(state).await?;
    let design_path = design_file_path(&project_root);
    async_fs::write(&design_path, content)
        .await
        .map_err(|error| format!("Could not save DESIGN.md: {}", error))?;
    Ok(design_path)
}

pub async fn list_artifacts(
    state: &AppState,
) -> Result<Vec<HyperframesArtifactManifest>, String> {
    let project_root = match ensure_project_folder(state).await {
        Ok(path) => path,
        Err(_) => return Ok(Vec::new()),
    };
    let root = hyperframes_root(&project_root);
    let mut artifacts = list_manifest_paths(&root)
        .into_iter()
        .filter_map(|path| read_manifest(&path))
        .collect::<Vec<_>>();
    artifacts.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(artifacts)
}

pub async fn artifact_detail(
    state: &AppState,
    job_id: &str,
) -> Result<HyperframesArtifactDetail, String> {
    let project_root = ensure_project_folder(state).await?;
    let manifest_path = manifest_path(&project_root, job_id);
    let artifact = read_manifest(&manifest_path)
        .ok_or_else(|| "Could not find the requested overlay artifact".to_string())?;
    let html_source = async_fs::read_to_string(&artifact.html_path)
        .await
        .map_err(|error| format!("Could not read the overlay HTML: {}", error))?;
    Ok(HyperframesArtifactDetail { artifact, html_source })
}

pub async fn hyperframes_context(state: &AppState) -> HyperframesContext {
    let status = premiere::premiere_status(state).await;
    let sequence = premiere::query_sequence_context(state)
        .await
        .unwrap_or_default();
    let artifacts = list_artifacts(state).await.unwrap_or_default();
    let latest = artifacts.first().cloned();

    let project_folder = status.project_folder.clone();
    let design_path = project_folder
        .as_ref()
        .map(|folder| design_file_path(Path::new(folder)).to_string_lossy().to_string());

    HyperframesContext {
        project_name: status.project_name.clone(),
        project_path: status.project_path.clone(),
        project_folder: project_folder.clone(),
        design_path: design_path.clone(),
        design_exists: design_path
            .as_deref()
            .map(Path::new)
            .map(Path::exists)
            .unwrap_or(false),
        artifacts_root: project_folder
            .map(|folder| hyperframes_root(Path::new(&folder)).to_string_lossy().to_string()),
        premiere_ready: status.can_import && sequence.sequence_open,
        reason: if status.can_import && sequence.sequence_open {
            "Ready".to_string()
        } else {
            status.reason
        },
        sequence,
        latest_artifact_id: latest.as_ref().map(|artifact| artifact.job_id.clone()),
        latest_render_path: latest.and_then(|artifact| artifact.render_path),
    }
}

fn resolve_range(
    request: &GenerateOverlayRequest,
    sequence: &PremiereSequenceContext,
) -> Result<ResolvedRange, String> {
    let manual_range = request
        .manual_in_seconds
        .zip(request.manual_out_seconds)
        .filter(|(start, end)| end > start);

    let (in_seconds, out_seconds) = if let Some((start, end)) = manual_range {
        (start, end)
    } else if let (Some(start), Some(end)) = (sequence.in_point_seconds, sequence.out_point_seconds) {
        (start, end)
    } else {
        return Err("Set an IN/OUT range in Premiere or provide a manual range".to_string());
    };

    let duration_seconds = (out_seconds - in_seconds).max(0.0);
    if duration_seconds <= 0.0 {
        return Err("The selected overlay range must be longer than zero".to_string());
    }

    Ok(ResolvedRange {
        in_seconds,
        out_seconds,
        duration_seconds,
    })
}

fn platform_archive_label() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        "win64"
    }
    #[cfg(all(target_os = "windows", not(target_arch = "x86_64")))]
    {
        "win32"
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "mac-arm64"
    }
    #[cfg(all(target_os = "macos", not(target_arch = "aarch64")))]
    {
        "mac-x64"
    }
    #[cfg(target_os = "linux")]
    {
        "linux64"
    }
}

fn chromium_binary_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "chrome.exe"
    }
    #[cfg(target_os = "macos")]
    {
        "Google Chrome for Testing"
    }
    #[cfg(target_os = "linux")]
    {
        "chrome"
    }
}

fn recursive_find_executable(root: &Path, needle: &str, depth: usize) -> Option<PathBuf> {
    if depth == 0 || !root.exists() {
        return None;
    }

    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file()
            && path
                .file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.eq_ignore_ascii_case(needle))
                .unwrap_or(false)
        {
            return Some(path);
        }

        if path.is_dir() {
            if let Some(found) = recursive_find_executable(&path, needle, depth - 1) {
                return Some(found);
            }
        }
    }

    None
}

fn system_chromium_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    #[cfg(target_os = "windows")]
    {
        candidates.push(PathBuf::from(
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        ));
        candidates.push(PathBuf::from(
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ));
        candidates.push(PathBuf::from(
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ));
    }

    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ));
    }

    #[cfg(target_os = "linux")]
    {
        candidates.push(PathBuf::from("/usr/bin/google-chrome"));
        candidates.push(PathBuf::from("/usr/bin/chromium-browser"));
        candidates.push(PathBuf::from("/usr/bin/chromium"));
    }

    candidates
}

fn unzip_archive(archive_path: &Path, destination: &Path) -> Result<(), String> {
    let archive_file = File::open(archive_path)
        .map_err(|error| format!("Could not open Chromium archive: {}", error))?;
    let mut archive = ZipArchive::new(archive_file)
        .map_err(|error| format!("Could not read Chromium archive: {}", error))?;

    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| format!("Could not read Chromium archive entry: {}", error))?;
        let out_path = match file.enclosed_name() {
            Some(path) => destination.join(path),
            None => continue,
        };

        if file.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|error| format!("Could not create Chromium directory: {}", error))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create Chromium directory: {}", error))?;
        }

        let mut output =
            File::create(&out_path).map_err(|error| format!("Could not extract Chromium file: {}", error))?;
        std::io::copy(&mut file, &mut output)
            .map_err(|error| format!("Could not extract Chromium file: {}", error))?;
    }

    Ok(())
}

async fn download_and_install_chromium() -> Result<PathBuf, String> {
    let root = app_storage_dir()?.join("chromium");
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create Chromium cache directory: {}", error))?;

    let response: Value = Client::new()
        .get(CHROME_FOR_TESTING_INDEX_URL)
        .send()
        .await
        .map_err(|error| format!("Could not fetch Chromium index: {}", error))?
        .json()
        .await
        .map_err(|error| format!("Could not parse Chromium index: {}", error))?;

    let platform = platform_archive_label();
    let versions = response
        .get("versions")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Chromium index did not include version data".to_string())?;

    let mut selected_version = None;
    let mut selected_url = None;
    for version in versions.iter().rev() {
        let chrome_downloads = version
            .get("downloads")
            .and_then(|value| value.get("chrome"))
            .and_then(|value| value.as_array());
        let Some(chrome_downloads) = chrome_downloads else {
            continue;
        };

        if let Some(entry) = chrome_downloads.iter().find(|candidate| {
            candidate.get("platform").and_then(|value| value.as_str()) == Some(platform)
        }) {
            selected_version = version
                .get("version")
                .and_then(|value| value.as_str())
                .map(str::to_string);
            selected_url = entry
                .get("url")
                .and_then(|value| value.as_str())
                .map(str::to_string);
            break;
        }
    }

    let version = selected_version.ok_or_else(|| "Could not find a Chromium build for this platform".to_string())?;
    let download_url = selected_url.ok_or_else(|| "Could not find a Chromium download URL".to_string())?;
    let install_root = root.join(format!("{}-{}", version, platform));
    let executable_name = chromium_binary_name();

    if let Some(existing) = recursive_find_executable(&install_root, executable_name, 8) {
        return Ok(existing);
    }

    let archive_path = root.join(format!("chrome-{}.zip", platform));
    let archive_bytes = Client::new()
        .get(&download_url)
        .send()
        .await
        .map_err(|error| format!("Could not download Chromium: {}", error))?
        .bytes()
        .await
        .map_err(|error| format!("Could not read Chromium archive: {}", error))?;
    async_fs::write(&archive_path, archive_bytes)
        .await
        .map_err(|error| format!("Could not write Chromium archive: {}", error))?;

    if install_root.exists() {
        let _ = fs::remove_dir_all(&install_root);
    }
    fs::create_dir_all(&install_root)
        .map_err(|error| format!("Could not create Chromium install directory: {}", error))?;
    unzip_archive(&archive_path, &install_root)?;

    recursive_find_executable(&install_root, executable_name, 8)
        .ok_or_else(|| "Chromium was downloaded but the executable could not be found".to_string())
}

async fn resolve_chromium_binary() -> Result<PathBuf, String> {
    if let Ok(override_path) = std::env::var("YT2PP_CHROMIUM") {
        let path = PathBuf::from(override_path.trim());
        if path.exists() {
            return Ok(path);
        }
    }

    let cached_root = app_storage_dir()?.join("chromium");
    if let Some(existing) = recursive_find_executable(&cached_root, chromium_binary_name(), 8) {
        return Ok(existing);
    }

    for candidate in system_chromium_candidates() {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    download_and_install_chromium().await
}

async fn wait_for_devtools_port(profile_dir: &Path) -> Result<u16, String> {
    let port_file = profile_dir.join("DevToolsActivePort");

    for _attempt in 0..100 {
        if port_file.exists() {
            let content = async_fs::read_to_string(&port_file)
                .await
                .map_err(|error| format!("Could not read Chromium DevTools port file: {}", error))?;
            if let Some(first_line) = content.lines().next() {
                if let Ok(port) = first_line.trim().parse::<u16>() {
                    return Ok(port);
                }
            }
        }
        sleep(Duration::from_millis(100)).await;
    }

    Err("Chromium did not expose a DevTools port in time".to_string())
}

async fn launch_chromium(
    state: &AppState,
    chromium_path: &Path,
    profile_dir: &Path,
    job_id: &str,
) -> Result<u16, String> {
    fs::create_dir_all(profile_dir)
        .map_err(|error| format!("Could not create Chromium profile directory: {}", error))?;

    let mut command = Command::new(chromium_path);
    hide_windows_console_tokio(&mut command);
    command
        .arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--hide-scrollbars")
        .arg("--mute-audio")
        .arg("--disable-background-networking")
        .arg("--allow-file-access-from-files")
        .arg(format!("--user-data-dir={}", profile_dir.to_string_lossy()))
        .arg("--remote-debugging-port=0")
        .arg("about:blank")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = command
        .spawn()
        .map_err(|error| format!("Could not launch Chromium: {}", error))?;
    let child_key = format!("{job_id}:chromium");
    state.register_child_process(child_key, child);
    wait_for_devtools_port(profile_dir).await
}

async fn capture_frames_with_chromium(
    state: &AppState,
    job_id: &str,
    html_path: &Path,
    frames_dir: &Path,
    preview_path: &Path,
    width: u32,
    height: u32,
    fps: f64,
    duration_seconds: f64,
) -> Result<(), String> {
    let chromium_path = resolve_chromium_binary().await?;
    let profile_dir = frames_dir.join(".chromium-profile");
    let port = launch_chromium(state, &chromium_path, &profile_dir, job_id).await?;

    let browser_url = format!(
        "http://127.0.0.1:{}/json/new?{}",
        port,
        url::form_urlencoded::byte_serialize(b"about:blank").collect::<String>()
    );
    let target: CdpCreateTargetResponse = Client::new()
        .put(&browser_url)
        .send()
        .await
        .map_err(|error| format!("Could not open a Chromium target: {}", error))?
        .json()
        .await
        .map_err(|error| format!("Could not parse the Chromium target response: {}", error))?;
    let _target_id = target.id;

    let mut client = CdpClient::connect(&target.web_socket_debugger_url).await?;
    client.call("Page.enable", json!({})).await?;
    client.call("Runtime.enable", json!({})).await?;
    client
        .call(
            "Emulation.setDeviceMetricsOverride",
            json!({
                "width": width,
                "height": height,
                "deviceScaleFactor": 1,
                "mobile": false,
                "screenWidth": width,
                "screenHeight": height,
            }),
        )
        .await?;
    client
        .call(
            "Emulation.setDefaultBackgroundColorOverride",
            json!({ "color": { "r": 0, "g": 0, "b": 0, "a": 0 } }),
        )
        .await?;

    let html_url = Url::from_file_path(html_path)
        .map_err(|_| "Could not build a file URL for the generated overlay".to_string())?;
    client
        .call(
            "Page.navigate",
            json!({
                "url": html_url.as_str(),
            }),
        )
        .await?;
    client.wait_for_event("Page.loadEventFired").await?;
    sleep(Duration::from_millis(300)).await;

    let frame_count = ((duration_seconds * fps).round() as usize).max(1);
    for frame_index in 0..frame_count {
        let seconds = frame_index as f64 / fps.max(1.0);
        let expression = format!(
            "window.__yt2premiereSetTime && window.__yt2premiereSetTime({seconds}); true;"
        );
        client
            .call(
                "Runtime.evaluate",
                json!({
                    "expression": expression,
                    "awaitPromise": true,
                    "returnByValue": true
                }),
            )
            .await?;

        let screenshot = client
            .call(
                "Page.captureScreenshot",
                json!({
                    "format": "png",
                    "fromSurface": true,
                    "captureBeyondViewport": false
                }),
            )
            .await?;
        let encoded = screenshot
            .get("data")
            .and_then(|value| value.as_str())
            .ok_or_else(|| "Chromium did not return screenshot data".to_string())?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(|error| format!("Could not decode Chromium screenshot: {}", error))?;

        let frame_path = frames_dir.join(format!("frame-{frame_index:06}.png"));
        async_fs::write(&frame_path, &bytes)
            .await
            .map_err(|error| format!("Could not write a rendered frame: {}", error))?;
        if frame_index == 0 {
            async_fs::write(preview_path, &bytes)
                .await
                .map_err(|error| format!("Could not write the preview frame: {}", error))?;
        }

        let percentage = ((frame_index + 1) as f64 / frame_count as f64) * 100.0;
        state.emit_hyperframes_progress(
            job_id,
            DownloadStage::Rendering,
            Some(format!("{:.1}%", percentage)),
            Some("Capturing deterministic frames".to_string()),
            false,
        );
    }

    let child_key = format!("{job_id}:chromium");
    if let Some(child) = state.child_process(&child_key) {
        let _ = child.lock().await.kill().await;
        state.release_child_process(&child_key);
    }

    Ok(())
}

async fn encode_frames_to_mov(
    state: &AppState,
    job_id: &str,
    frames_dir: &Path,
    fps: f64,
    duration_seconds: f64,
    output_path: &Path,
) -> Result<(), String> {
    let mut command = Command::new(&state.tools.ffmpeg);
    hide_windows_console_tokio(&mut command);
    command
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-progress")
        .arg("pipe:1")
        .arg("-nostats")
        .arg("-framerate")
        .arg(format!("{:.6}", fps.max(1.0)))
        .arg("-i")
        .arg(frames_dir.join("frame-%06d.png"))
        .arg("-c:v")
        .arg("prores_ks")
        .arg("-profile:v")
        .arg("4")
        .arg("-pix_fmt")
        .arg("yuva444p10le")
        .arg("-alpha_bits")
        .arg("16")
        .arg(output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child_key = format!("{job_id}:hyperframes-ffmpeg");
    let child = command
        .spawn()
        .map_err(|error| format!("Could not start FFmpeg for overlay encoding: {}", error))?;
    state.register_child_process(child_key.clone(), child);

    let child_handle = state
        .child_process(&child_key)
        .ok_or_else(|| "Could not track the FFmpeg overlay encoder".to_string())?;
    let stdout = child_handle
        .lock()
        .await
        .stdout
        .take()
        .ok_or_else(|| "Could not capture FFmpeg overlay progress".to_string())?;
    let stderr = child_handle
        .lock()
        .await
        .stderr
        .take()
        .ok_or_else(|| "Could not capture FFmpeg overlay errors".to_string())?;

    let stderr_task = tokio::spawn(async move {
        let mut stderr_output = String::new();
        let mut reader = BufReader::new(stderr);
        reader
            .read_to_string(&mut stderr_output)
            .await
            .map_err(|error| format!("Could not read FFmpeg overlay stderr: {}", error))?;
        Ok::<String, String>(stderr_output)
    });

    let mut stdout_reader = BufReader::new(stdout).lines();
    while let Some(line) = stdout_reader
        .next_line()
        .await
        .map_err(|error| format!("Could not read FFmpeg overlay progress: {}", error))?
    {
        if let Some(raw) = line.strip_prefix("out_time_ms=") {
            let current_ms = raw.trim().parse::<f64>().unwrap_or(0.0);
            let percentage = ((current_ms / 1_000_000.0) / duration_seconds.max(0.001)) * 100.0;
            state.emit_hyperframes_progress(
                job_id,
                DownloadStage::Encoding,
                Some(format!("{:.1}%", percentage.clamp(0.0, 99.5))),
                Some("Encoding ProRes 4444 MOV".to_string()),
                false,
            );
        }
    }

    let status = child_handle
        .lock()
        .await
        .wait()
        .await
        .map_err(|error| format!("Could not finish FFmpeg overlay encoding: {}", error))?;
    state.release_child_process(&child_key);

    let stderr_output = stderr_task
        .await
        .map_err(|error| format!("Could not finish FFmpeg stderr task: {}", error))??;
    if !status.success() {
        return Err(if stderr_output.trim().is_empty() {
            "FFmpeg could not encode the rendered overlay".to_string()
        } else {
            stderr_output.trim().to_string()
        });
    }

    Ok(())
}

fn write_manifest(path: &Path, manifest: &HyperframesArtifactManifest) -> Result<(), String> {
    write_json_atomic(path, manifest)
}

pub async fn run_generate_job(
    state: AppState,
    job_id: String,
    request: GenerateOverlayRequest,
) -> Result<(), String> {
    state.emit_hyperframes_progress(
        &job_id,
        DownloadStage::Context,
        Some("2.0%".to_string()),
        Some("Reading Premiere project context".to_string()),
        false,
    );

    let project_root = ensure_project_folder(&state).await?;
    let project_info = premiere::query_project_info(&state)
        .await
        .map_err(|error| error.user_message())?;
    let sequence = premiere::query_sequence_context(&state).await?;
    if !sequence.sequence_open {
        return Err("Open a Premiere sequence before generating an overlay".to_string());
    }
    let range = resolve_range(&request, &sequence)?;

    state.emit_hyperframes_progress(
        &job_id,
        DownloadStage::Design,
        Some("12.0%".to_string()),
        Some("Loading DESIGN.md".to_string()),
        false,
    );

    let (design_path, design_document) = ensure_design_document(&state).await?;
    let title = job_title_from_prompt(&request.prompt);
    let generated = {
        let api_key = state.settings.get().await.gemini_api_key;
        if api_key.trim().is_empty() {
            GeneratedHtmlPayload {
                title: title.clone(),
                html: fallback_overlay_document(
                    &request.prompt,
                    &title,
                    &sequence,
                    range.duration_seconds,
                ),
            }
        } else {
            state.emit_hyperframes_progress(
                &job_id,
                DownloadStage::Generating,
                Some("38.0%".to_string()),
                Some("Generating HTML with Gemini 2.5 Flash".to_string()),
                false,
            );
            generate_with_gemini(
                api_key.trim(),
                &request,
                &design_document,
                &sequence,
                range.duration_seconds,
            )
            .await?
        }
    };

    state.emit_hyperframes_progress(
        &job_id,
        DownloadStage::Validating,
        Some("72.0%".to_string()),
        Some("Normalizing overlay HTML contract".to_string()),
        false,
    );

    let normalized_title = if generated.title.trim().is_empty() {
        title.clone()
    } else {
        generated.title.trim().to_string()
    };
    let html = ensure_html_contract(&generated.html, range.duration_seconds, &normalized_title);

    let job_dir = job_dir(&project_root, &job_id);
    async_fs::create_dir_all(&job_dir)
        .await
        .map_err(|error| format!("Could not create overlay artifact directory: {}", error))?;
    let html_path = job_dir.join("index.html");
    let preview_path = job_dir.join("preview.png");
    let render_path = job_dir.join("overlay.mov");
    let manifest_path = job_dir.join("manifest.json");

    async_fs::write(&html_path, html)
        .await
        .map_err(|error| format!("Could not save the generated HTML overlay: {}", error))?;

    let manifest = HyperframesArtifactManifest {
        job_id: job_id.clone(),
        title: normalized_title,
        prompt: request.prompt.trim().to_string(),
        template_id: request.template_id.clone(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        duration_seconds: range.duration_seconds,
        width: sequence.width.max(1),
        height: sequence.height.max(1),
        fps: sequence.fps.max(1.0),
        html_path: html_path.to_string_lossy().to_string(),
        render_path: render_path.exists().then(|| render_path.to_string_lossy().to_string()),
        preview_image_path: preview_path.exists().then(|| preview_path.to_string_lossy().to_string()),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        design_path: design_path.to_string_lossy().to_string(),
        project_name: Some(project_info.project_name),
        sequence_name: Some(sequence.sequence_name),
        in_point_seconds: Some(range.in_seconds),
        out_point_seconds: Some(range.out_seconds),
    };
    write_manifest(&manifest_path, &manifest)?;

    state.emit_hyperframes_progress(
        &job_id,
        DownloadStage::PreviewReady,
        Some("100.0%".to_string()),
        Some("Overlay preview ready".to_string()),
        false,
    );
    state.emit_hyperframes_complete(&job_id, html_path.to_string_lossy().to_string());
    Ok(())
}

pub async fn run_render_job(state: AppState, job_id: String) -> Result<(), String> {
    let artifact = artifact_detail(&state, &job_id).await?;
    let artifact_dir = Path::new(&artifact.artifact.html_path)
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Could not resolve the overlay artifact directory".to_string())?;
    let frames_dir = artifact_dir.join("frames");
    let preview_path = artifact_dir.join("preview.png");
    let render_path = artifact_dir.join("overlay.mov");

    if frames_dir.exists() {
        let _ = fs::remove_dir_all(&frames_dir);
    }
    async_fs::create_dir_all(&frames_dir)
        .await
        .map_err(|error| format!("Could not create the frame cache directory: {}", error))?;

    state.emit_hyperframes_progress(
        &job_id,
        DownloadStage::Rendering,
        Some("4.0%".to_string()),
        Some("Launching Chromium renderer".to_string()),
        false,
    );

    capture_frames_with_chromium(
        &state,
        &job_id,
        Path::new(&artifact.artifact.html_path),
        &frames_dir,
        &preview_path,
        artifact.artifact.width.max(1),
        artifact.artifact.height.max(1),
        artifact.artifact.fps.max(1.0),
        artifact.artifact.duration_seconds,
    )
    .await?;

    state.emit_hyperframes_progress(
        &job_id,
        DownloadStage::Encoding,
        Some("82.0%".to_string()),
        Some("Encoding ProRes 4444 MOV".to_string()),
        false,
    );

    encode_frames_to_mov(
        &state,
        &job_id,
        &frames_dir,
        artifact.artifact.fps.max(1.0),
        artifact.artifact.duration_seconds,
        &render_path,
    )
    .await?;

    let mut manifest = artifact.artifact;
    manifest.updated_at = Utc::now();
    manifest.render_path = Some(render_path.to_string_lossy().to_string());
    manifest.preview_image_path = Some(preview_path.to_string_lossy().to_string());
    write_manifest(Path::new(&manifest.manifest_path), &manifest)?;

    state.emit_hyperframes_complete(&job_id, render_path.to_string_lossy().to_string());
    Ok(())
}

pub async fn import_rendered_overlay(state: &AppState, job_id: &str) -> Result<(), String> {
    let artifact = artifact_detail(state, job_id).await?;
    let render_path = artifact
        .artifact
        .render_path
        .as_deref()
        .ok_or_else(|| "Render the overlay before importing it into Premiere".to_string())?;
    premiere::import_overlay_to_premiere(
        state,
        Path::new(render_path),
        artifact.artifact.in_point_seconds,
        artifact.artifact.duration_seconds,
    )
    .await
}
