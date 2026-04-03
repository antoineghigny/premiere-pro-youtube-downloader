use std::{path::Path, process::Command};

use reqwest::StatusCode;
use serde_json::json;
use sysinfo::{ProcessesToUpdate, System};

use crate::{server::AppState, utils::quote_for_extendscript};

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

pub async fn import_to_premiere(state: &AppState, path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Output file does not exist: {}", path.display()));
    }

    if !is_premiere_running() {
        return Ok(());
    }

    let cep_port = state
        .active_cep_port()
        .ok_or_else(|| "Premiere CEP bridge is not registered".to_string())?;

    let script = format!(
        "(function() {{ var filePath = \"{}\"; if (!app.project) {{ return \"NO_PROJECT\"; }} app.project.importFiles([filePath], true, app.project.rootItem, false); app.sourceMonitor.openFilePath(filePath); return \"OK\"; }})();",
        quote_for_extendscript(path)
    );

    let client = reqwest::Client::new();
    let response = client
        .post(format!("http://127.0.0.1:{cep_port}/"))
        .json(&json!({ "to_eval": script }))
        .send()
        .await
        .map_err(|error| format!("Could not reach the Premiere CEP bridge: {}", error))?;

    if response.status() != StatusCode::OK {
        return Err(format!(
            "Premiere CEP bridge returned {}",
            response.status()
        ));
    }

    Ok(())
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
