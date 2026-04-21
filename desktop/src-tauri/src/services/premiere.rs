use std::{
    path::{Path, PathBuf},
    process::Command,
};

use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sysinfo::{ProcessesToUpdate, System};

use crate::{
    models::hyperframes::PremiereSequenceContext,
    server::AppState,
    utils::quote_for_extendscript,
};

const TICKS_PER_SECOND: f64 = 254_016_000_000.0;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PremiereProjectInfo {
    pub project_open: bool,
    pub project_saved: bool,
    pub project_name: String,
    pub project_path: String,
    #[serde(default)]
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PremiereStatusSnapshot {
    pub running: bool,
    pub cep_registered: bool,
    pub project_open: bool,
    pub project_saved: bool,
    pub project_name: Option<String>,
    pub project_path: Option<String>,
    pub project_folder: Option<String>,
    pub can_import: bool,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProjectFolderError {
    PremiereNotRunning,
    PanelUnavailable,
    NoProjectOpen,
    UnsavedProject,
    QueryFailed(String),
}

impl ProjectFolderError {
    pub fn user_message(&self) -> String {
        match self {
            Self::PremiereNotRunning => {
                "Open Premiere before using the current project folder".to_string()
            }
            Self::PanelUnavailable => {
                "Open the YT2Premiere panel in Premiere before using the current project folder"
                    .to_string()
            }
            Self::NoProjectOpen => {
                "Open a Premiere project before using the current project folder".to_string()
            }
            Self::UnsavedProject => {
                "Save the Premiere project or choose a folder for this download".to_string()
            }
            Self::QueryFailed(message) => message.clone(),
        }
    }
}

pub fn is_premiere_running() -> bool {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    system.processes().values().any(|process| {
        process
            .name()
            .to_string_lossy()
            .to_ascii_lowercase()
            .contains("adobe premiere pro")
    })
}

fn project_info_script() -> &'static str {
    r#"(function () {
        function esc(value) {
            return String(value || '')
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n');
        }

        var result = {
            projectOpen: false,
            projectSaved: false,
            projectName: '',
            projectPath: '',
            error: ''
        };

        try {
            if (app.project) {
                result.projectOpen = true;
                result.projectName = app.project.name || '';
                if (app.project.path) {
                    result.projectPath = app.project.path;
                    result.projectSaved = String(app.project.path).length > 0;
                }
            }
        } catch (error) {
            result.error = String(error);
        }

        return '{'
            + '"projectOpen":' + (result.projectOpen ? 'true' : 'false')
            + ',"projectSaved":' + (result.projectSaved ? 'true' : 'false')
            + ',"projectName":"' + esc(result.projectName) + '"'
            + ',"projectPath":"' + esc(result.projectPath) + '"'
            + ',"error":"' + esc(result.error) + '"'
            + '}';
    })();"#
}

fn sequence_context_script() -> &'static str {
    r#"(function () {
        var TICKS_PER_SECOND = 254016000000.0;

        function esc(value) {
            return String(value || '')
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n');
        }

        function asNumber(value) {
            var numeric = Number(value);
            return isNaN(numeric) ? null : numeric;
        }

        function asJsonNumber(value) {
            return value === null || value === undefined || isNaN(value) ? 'null' : String(value);
        }

        var result = {
            sequenceOpen: false,
            sequenceName: '',
            width: 0,
            height: 0,
            fps: 0,
            timebase: '',
            playerPositionSeconds: null,
            inPointSeconds: null,
            outPointSeconds: null,
            durationSeconds: null,
            workAreaEnabled: false,
            rangeSource: '',
            videoTrackCount: 0,
            error: ''
        };

        try {
            var seq = app.project ? app.project.activeSequence : null;
            if (seq) {
                result.sequenceOpen = true;
                result.sequenceName = seq.name || '';
                result.width = Number(seq.frameSizeHorizontal || 0);
                result.height = Number(seq.frameSizeVertical || 0);
                result.timebase = String(seq.timebase || '');
                result.videoTrackCount = Number(seq.videoTracks ? seq.videoTracks.numTracks || 0 : 0);

                if (result.timebase) {
                    var ticksPerFrame = Number(result.timebase);
                    if (!isNaN(ticksPerFrame) && ticksPerFrame > 0) {
                        result.fps = TICKS_PER_SECOND / ticksPerFrame;
                    }
                }

                try {
                    if (seq.getSettings) {
                        var settings = seq.getSettings();
                        result.width = Number(result.width || settings.videoFrameWidth || 0);
                        result.height = Number(result.height || settings.videoFrameHeight || 0);
                    }
                } catch (_settingsError) {}

                try {
                    var playerPosition = seq.getPlayerPosition();
                    result.playerPositionSeconds = asNumber(playerPosition ? playerPosition.seconds : null);
                } catch (_playerError) {}

                try {
                    var inPoint = asNumber(seq.getInPointAsTime ? seq.getInPointAsTime().seconds : seq.getInPoint());
                    var outPoint = asNumber(seq.getOutPointAsTime ? seq.getOutPointAsTime().seconds : seq.getOutPoint());
                    if (inPoint !== null && outPoint !== null && outPoint > inPoint) {
                        result.inPointSeconds = inPoint;
                        result.outPointSeconds = outPoint;
                        result.durationSeconds = outPoint - inPoint;
                        result.rangeSource = 'sequence';
                    }
                } catch (_rangeError) {}

                try {
                    result.workAreaEnabled = !!seq.isWorkAreaEnabled();
                    if ((!result.rangeSource || !result.durationSeconds) && result.workAreaEnabled) {
                        var workAreaIn = asNumber(seq.getWorkAreaInPointAsTime ? seq.getWorkAreaInPointAsTime().seconds : seq.getWorkAreaInPoint());
                        var workAreaOut = asNumber(seq.getWorkAreaOutPointAsTime ? seq.getWorkAreaOutPointAsTime().seconds : seq.getWorkAreaOutPoint());
                        if (workAreaIn !== null && workAreaOut !== null && workAreaOut > workAreaIn) {
                            result.inPointSeconds = workAreaIn;
                            result.outPointSeconds = workAreaOut;
                            result.durationSeconds = workAreaOut - workAreaIn;
                            result.rangeSource = 'workArea';
                        }
                    }
                } catch (_workAreaError) {}
            }
        } catch (error) {
            result.error = String(error);
        }

        return '{'
            + '"sequenceOpen":' + (result.sequenceOpen ? 'true' : 'false')
            + ',"sequenceName":"' + esc(result.sequenceName) + '"'
            + ',"width":' + asJsonNumber(result.width)
            + ',"height":' + asJsonNumber(result.height)
            + ',"fps":' + asJsonNumber(result.fps)
            + ',"timebase":"' + esc(result.timebase) + '"'
            + ',"playerPositionSeconds":' + asJsonNumber(result.playerPositionSeconds)
            + ',"inPointSeconds":' + asJsonNumber(result.inPointSeconds)
            + ',"outPointSeconds":' + asJsonNumber(result.outPointSeconds)
            + ',"durationSeconds":' + asJsonNumber(result.durationSeconds)
            + ',"workAreaEnabled":' + (result.workAreaEnabled ? 'true' : 'false')
            + ',"rangeSource":"' + esc(result.rangeSource) + '"'
            + ',"videoTrackCount":' + asJsonNumber(result.videoTrackCount)
            + ',"error":"' + esc(result.error) + '"'
            + '}';
    })();"#
}

pub async fn eval_in_premiere(state: &AppState, script: &str) -> Result<String, String> {
    let cep_port = state
        .active_cep_port()
        .ok_or_else(|| "Open the YT2Premiere panel in Premiere".to_string())?;

    let client = reqwest::Client::new();
    let response = client
        .post(format!("http://127.0.0.1:{cep_port}/"))
        .header("X-YT2PP-CEP-Token", state.auth.cep_token())
        .json(&json!({ "to_eval": script }))
        .send()
        .await
        .map_err(|error| {
            state.clear_cep_port();
            format!("Could not reach Premiere: {}", error)
        })?;

    if response.status() != StatusCode::OK {
        state.clear_cep_port();
        return Err(format!(
            "Premiere did not accept the request ({})",
            response.status()
        ));
    }

    response
        .text()
        .await
        .map_err(|error| format!("Could not read the Premiere response: {}", error))
}

pub async fn query_sequence_context(state: &AppState) -> Result<PremiereSequenceContext, String> {
    if !is_premiere_running() {
        return Err("Open Premiere before generating an overlay".to_string());
    }

    if state.active_cep_port().is_none() {
        return Err("Open the YT2Premiere panel in Premiere".to_string());
    }

    let response = eval_in_premiere(state, sequence_context_script()).await?;
    let payload: serde_json::Value = serde_json::from_str(&response)
        .map_err(|error| format!("Could not parse the current sequence context: {}", error))?;

    if let Some(error) = payload.get("error").and_then(|value| value.as_str()) {
        if !error.trim().is_empty() {
            return Err("Premiere could not report the active sequence".to_string());
        }
    }

    let timebase = payload
        .get("timebase")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let fps = payload
        .get("fps")
        .and_then(|value| value.as_f64())
        .filter(|value| *value > 0.0)
        .or_else(|| {
            timebase
                .parse::<f64>()
                .ok()
                .filter(|ticks_per_frame| *ticks_per_frame > 0.0)
                .map(|ticks_per_frame| TICKS_PER_SECOND / ticks_per_frame)
        })
        .unwrap_or(30.0);

    Ok(PremiereSequenceContext {
        sequence_open: payload
            .get("sequenceOpen")
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        sequence_name: payload
            .get("sequenceName")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string(),
        width: payload
            .get("width")
            .and_then(|value| value.as_u64())
            .unwrap_or(1920) as u32,
        height: payload
            .get("height")
            .and_then(|value| value.as_u64())
            .unwrap_or(1080) as u32,
        fps,
        timebase,
        player_position_seconds: payload
            .get("playerPositionSeconds")
            .and_then(|value| value.as_f64()),
        in_point_seconds: payload
            .get("inPointSeconds")
            .and_then(|value| value.as_f64()),
        out_point_seconds: payload
            .get("outPointSeconds")
            .and_then(|value| value.as_f64()),
        duration_seconds: payload
            .get("durationSeconds")
            .and_then(|value| value.as_f64()),
        work_area_enabled: payload
            .get("workAreaEnabled")
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        range_source: payload
            .get("rangeSource")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        video_track_count: payload
            .get("videoTrackCount")
            .and_then(|value| value.as_u64())
            .unwrap_or(0) as usize,
    })
}

pub async fn query_project_info(state: &AppState) -> Result<PremiereProjectInfo, ProjectFolderError> {
    if !is_premiere_running() {
        return Err(ProjectFolderError::PremiereNotRunning);
    }

    if state.active_cep_port().is_none() {
        return Err(ProjectFolderError::PanelUnavailable);
    }

    let response = eval_in_premiere(state, project_info_script())
        .await
        .map_err(ProjectFolderError::QueryFailed)?;
    let info: PremiereProjectInfo = serde_json::from_str(&response).map_err(|error| {
        ProjectFolderError::QueryFailed(format!("Could not read the current Premiere project: {}", error))
    })?;

    if !info.error.trim().is_empty() {
        return Err(ProjectFolderError::QueryFailed(
            "Premiere could not report the current project".to_string(),
        ));
    }

    Ok(info)
}

fn project_folder_from_path(project_path: &str) -> Option<String> {
    let trimmed = project_path.trim();
    if trimmed.is_empty() {
        return None;
    }

    Path::new(trimmed)
        .parent()
        .map(|path| path.to_string_lossy().to_string())
}

pub async fn premiere_status(state: &AppState) -> PremiereStatusSnapshot {
    let running = is_premiere_running();
    let cep_registered = state.active_cep_port().is_some();

    if !running {
        return PremiereStatusSnapshot {
            running,
            cep_registered,
            project_open: false,
            project_saved: false,
            project_name: None,
            project_path: None,
            project_folder: None,
            can_import: false,
            reason: "Premiere is not running".to_string(),
        };
    }

    if !cep_registered {
        return PremiereStatusSnapshot {
            running,
            cep_registered,
            project_open: false,
            project_saved: false,
            project_name: None,
            project_path: None,
            project_folder: None,
            can_import: false,
            reason: "Open the YT2Premiere panel in Premiere".to_string(),
        };
    }

    match query_project_info(state).await {
        Ok(info) => {
            let project_folder = project_folder_from_path(&info.project_path);
            let can_import = info.project_open;
            let reason = if !info.project_open {
                "Open a Premiere project to add downloads to it".to_string()
            } else if !info.project_saved {
                "Save the Premiere project to use its folder".to_string()
            } else {
                "Ready".to_string()
            };

            PremiereStatusSnapshot {
                running,
                cep_registered,
                project_open: info.project_open,
                project_saved: info.project_saved,
                project_name: (!info.project_name.trim().is_empty()).then_some(info.project_name),
                project_path: (!info.project_path.trim().is_empty()).then_some(info.project_path),
                project_folder,
                can_import,
                reason,
            }
        }
        Err(ProjectFolderError::NoProjectOpen | ProjectFolderError::UnsavedProject) => {
            unreachable!("query_project_info does not return these variants directly")
        }
        Err(error) => PremiereStatusSnapshot {
            running,
            cep_registered,
            project_open: false,
            project_saved: false,
            project_name: None,
            project_path: None,
            project_folder: None,
            can_import: false,
            reason: error.user_message(),
        },
    }
}

pub async fn resolve_project_output_dir(state: &AppState) -> Result<PathBuf, ProjectFolderError> {
    let project = query_project_info(state).await?;

    if !project.project_open {
        return Err(ProjectFolderError::NoProjectOpen);
    }

    if !project.project_saved {
        return Err(ProjectFolderError::UnsavedProject);
    }

    let folder = project_folder_from_path(&project.project_path)
        .ok_or(ProjectFolderError::UnsavedProject)?;
    Ok(PathBuf::from(folder))
}

pub async fn import_to_premiere(state: &AppState, path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Output file does not exist: {}", path.display()));
    }

    if !is_premiere_running() {
        return Ok(());
    }

    let script = format!(
        "(function() {{ var filePath = \"{}\"; if (!app.project) {{ return \"NO_PROJECT\"; }} app.project.importFiles([filePath], true, app.project.rootItem, false); app.sourceMonitor.openFilePath(filePath); return \"OK\"; }})();",
        quote_for_extendscript(path)
    );

    let result = eval_in_premiere(state, &script).await?;
    if result.trim() == "OK" {
        return Ok(());
    }

    if result.trim() == "NO_PROJECT" {
        return Err("Open a Premiere project before adding downloads to it".to_string());
    }

    Err("Premiere could not add the file to the current project".to_string())
}

pub async fn import_overlay_to_premiere(
    state: &AppState,
    path: &Path,
    fallback_in_seconds: Option<f64>,
    duration_seconds: f64,
) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Rendered overlay does not exist: {}", path.display()));
    }

    if !is_premiere_running() {
        return Err("Open Premiere before importing the rendered overlay".to_string());
    }

    let sequence = query_sequence_context(state).await?;
    if !sequence.sequence_open {
        return Err("Open a Premiere sequence before importing the rendered overlay".to_string());
    }

    let insert_seconds = sequence
        .in_point_seconds
        .or(fallback_in_seconds)
        .ok_or_else(|| "Set an IN point in Premiere or provide a manual range".to_string())?;
    let clip_end_seconds = insert_seconds + duration_seconds.max(0.0);

    let script = format!(
        r#"(function() {{
            function esc(value) {{
                return String(value || '')
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\r/g, '\\r')
                    .replace(/\n/g, '\\n');
            }}

            function normalizePath(value) {{
                return String(value || '').replace(/\//g, '\\').toLowerCase();
            }}

            function findProjectItemByPath(projectItem, mediaPath) {{
                if (!projectItem) {{
                    return null;
                }}

                try {{
                    if (projectItem.getMediaPath && normalizePath(projectItem.getMediaPath()) === mediaPath) {{
                        return projectItem;
                    }}
                }} catch (_mediaError) {{}}

                try {{
                    var children = projectItem.children;
                    if (children && children.numItems) {{
                        for (var index = 0; index < children.numItems; index++) {{
                            var child = children[index];
                            var found = findProjectItemByPath(child, mediaPath);
                            if (found) {{
                                return found;
                            }}
                        }}
                    }}
                }} catch (_childrenError) {{}}

                return null;
            }}

            function overlaps(startA, endA, startB, endB) {{
                return startA < endB && endA > startB;
            }}

            function trackIsFree(track, startSeconds, endSeconds) {{
                if (!track || !track.clips || !track.clips.numItems) {{
                    return true;
                }}

                for (var clipIndex = 0; clipIndex < track.clips.numItems; clipIndex++) {{
                    var clip = track.clips[clipIndex];
                    var clipStart = Number(clip.start.seconds);
                    var clipEnd = Number(clip.end.seconds);
                    if (!isNaN(clipStart) && !isNaN(clipEnd) && overlaps(startSeconds, endSeconds, clipStart, clipEnd)) {{
                        return false;
                    }}
                }}

                return true;
            }}

            function findFreeTrackIndex(sequence, startSeconds, endSeconds, minimumTrackIndex) {{
                if (!sequence || !sequence.videoTracks) {{
                    return -1;
                }}

                for (var trackIndex = minimumTrackIndex; trackIndex < sequence.videoTracks.numTracks; trackIndex++) {{
                    if (trackIsFree(sequence.videoTracks[trackIndex], startSeconds, endSeconds)) {{
                        return trackIndex;
                    }}
                }}

                return -1;
            }}

            function appendTrack(sequence) {{
                try {{
                    if (app.enableQE) {{
                        app.enableQE();
                    }}
                    if (typeof qe !== 'undefined' && qe && qe.project && qe.project.getActiveSequence) {{
                        var before = Number(sequence.videoTracks ? sequence.videoTracks.numTracks || 0 : 0);
                        var qeSequence = qe.project.getActiveSequence();
                        if (qeSequence && qeSequence.addTracks) {{
                            if (before > 0) {{
                                qeSequence.addTracks(1, before - 1, 0);
                            }} else {{
                                qeSequence.addTracks(1);
                            }}
                            var after = Number(sequence.videoTracks ? sequence.videoTracks.numTracks || 0 : 0);
                            if (after > before) {{
                                return after - 1;
                            }}
                        }}
                    }}
                }} catch (_qeError) {{}}

                return -1;
            }}

            var result = {{
                ok: false,
                error: '',
                trackIndex: -1,
                insertSeconds: {insert_seconds}
            }};

            try {{
                if (!app.project) {{
                    result.error = 'NO_PROJECT';
                    return JSON.stringify(result);
                }}

                var sequence = app.project.activeSequence;
                if (!sequence) {{
                    result.error = 'NO_SEQUENCE';
                    return JSON.stringify(result);
                }}

                var filePath = "{file_path}";
                var mediaPath = normalizePath(filePath);
                var projectItem = findProjectItemByPath(app.project.rootItem, mediaPath);
                if (!projectItem) {{
                    var imported = app.project.importFiles([filePath], true, app.project.rootItem, false);
                    if (!imported) {{
                        result.error = 'IMPORT_FAILED';
                        return JSON.stringify(result);
                    }}
                    projectItem = findProjectItemByPath(app.project.rootItem, mediaPath);
                }}

                if (!projectItem) {{
                    result.error = 'MISSING_PROJECT_ITEM';
                    return JSON.stringify(result);
                }}

                var targetTrackIndex = findFreeTrackIndex(sequence, {insert_seconds}, {clip_end_seconds}, 1);
                if (targetTrackIndex < 0) {{
                    targetTrackIndex = appendTrack(sequence);
                }}
                if (targetTrackIndex < 0 || !trackIsFree(sequence.videoTracks[targetTrackIndex], {insert_seconds}, {clip_end_seconds})) {{
                    result.error = 'NO_FREE_TRACK';
                    return JSON.stringify(result);
                }}

                var inserted = sequence.overwriteClip(projectItem, String({insert_seconds}), targetTrackIndex, 0);
                if (!inserted) {{
                    result.error = 'INSERT_FAILED';
                    return JSON.stringify(result);
                }}

                result.ok = true;
                result.trackIndex = targetTrackIndex;
                return JSON.stringify(result);
            }} catch (error) {{
                result.error = String(error);
                return JSON.stringify(result);
            }}
        }})();"#,
        insert_seconds = insert_seconds,
        clip_end_seconds = clip_end_seconds,
        file_path = quote_for_extendscript(path),
    );

    let result = eval_in_premiere(state, &script).await?;
    let payload: serde_json::Value = serde_json::from_str(&result)
        .map_err(|error| format!("Could not parse Premiere overlay import result: {}", error))?;

    if payload
        .get("ok")
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        return Ok(());
    }

    match payload.get("error").and_then(|value| value.as_str()).unwrap_or("") {
        "NO_PROJECT" => Err("Open a Premiere project before importing the rendered overlay".to_string()),
        "NO_SEQUENCE" => Err("Open a Premiere sequence before importing the rendered overlay".to_string()),
        "NO_FREE_TRACK" => Err("No free V2+ video track is available for the selected range".to_string()),
        "IMPORT_FAILED" | "MISSING_PROJECT_ITEM" => {
            Err("Premiere could not import the rendered overlay".to_string())
        }
        _ => Err("Premiere could not place the rendered overlay on the active sequence".to_string()),
    }
}

pub async fn reveal_file(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    let status = if cfg!(target_os = "windows") {
        if path.is_dir() {
            Command::new("explorer.exe")
                .arg(path.as_os_str())
                .status()
                .map_err(|error| format!("Could not open Explorer: {}", error))?
        } else {
            Command::new("explorer.exe")
                .args(["/select,", &path.to_string_lossy()])
                .status()
                .map_err(|error| format!("Could not open Explorer: {}", error))?
        }
    } else if cfg!(target_os = "macos") {
        Command::new("open")
            .arg("-R")
            .arg(path)
            .status()
            .map_err(|error| format!("Could not reveal the file in Finder: {}", error))?
    } else {
        let target = path.parent().unwrap_or(path);
        Command::new("xdg-open")
            .arg(target)
            .status()
            .map_err(|error| format!("Could not open the file location: {}", error))?
    };

    if !status.success() {
        return Err("The operating system rejected the reveal-file request".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_folder_is_derived_from_saved_project_path() {
        assert_eq!(
            project_folder_from_path(r"C:\Projects\Edit\MyEdit.prproj"),
            Some(r"C:\Projects\Edit".to_string())
        );
        assert_eq!(project_folder_from_path(""), None);
    }
}
