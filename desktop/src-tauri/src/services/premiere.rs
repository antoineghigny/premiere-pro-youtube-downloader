use std::{
    path::{Path, PathBuf},
    process::Command,
};

use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sysinfo::{ProcessesToUpdate, System};

use crate::{server::AppState, utils::quote_for_extendscript};

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

async fn eval_in_premiere(state: &AppState, script: &str) -> Result<String, String> {
    let cep_port = state
        .active_cep_port()
        .ok_or_else(|| "Open the YT2Premiere panel in Premiere".to_string())?;

    let client = reqwest::Client::new();
    let response = client
        .post(format!("http://127.0.0.1:{cep_port}/"))
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
