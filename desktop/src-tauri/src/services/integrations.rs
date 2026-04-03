use std::{
    env, fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use serde::Serialize;

use crate::{
    server::AppState,
    services::premiere,
    utils::{app_storage_dir, hide_windows_console},
};

const CEP_EXTENSION_ID: &str = "com.yt2premiere.cep";
const CEP_MARKER_FILE: &str = "CSXS/manifest.xml";
const BROWSER_MARKER_FILE: &str = "manifest.json";
const LEGACY_CEP_IDS: &[&str] = &["com.youtubetopremiere", "com.selgy.youtubetopremiere"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationConflict {
    pub id: String,
    pub path: String,
    pub scope: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationStatus {
    pub premiere_installed: bool,
    pub premiere_panel_installed: bool,
    pub chrome_installed: bool,
    pub browser_addon_ready: bool,
    pub cep_install_path: Option<String>,
    pub browser_addon_path: Option<String>,
    pub conflicts: Vec<IntegrationConflict>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationActionResult {
    pub success: bool,
    pub message: String,
    pub manual_step_required: bool,
    pub status: IntegrationStatus,
}

pub fn run_startup_setup(state: &AppState) -> Result<(), String> {
    if !cfg!(target_os = "windows") {
        return Ok(());
    }

    write_install_path_registry()?;

    if detect_premiere_installed() {
        let _ = install_premiere_panel(state);
    }

    Ok(())
}

pub fn integration_status(state: &AppState) -> IntegrationStatus {
    let cep_install_path = cep_target_dir().ok();
    let browser_addon_path = browser_addon_target_dir().ok();

    IntegrationStatus {
        premiere_installed: detect_premiere_installed(),
        premiere_panel_installed: premiere_panel_installed(state),
        chrome_installed: detect_chrome_executable().is_some(),
        browser_addon_ready: browser_addon_ready(),
        cep_install_path: cep_install_path.map(|path| path.to_string_lossy().to_string()),
        browser_addon_path: browser_addon_path.map(|path| path.to_string_lossy().to_string()),
        conflicts: detect_cep_conflicts(),
    }
}

pub fn install_premiere_panel(state: &AppState) -> Result<IntegrationActionResult, String> {
    if !cfg!(target_os = "windows") {
        return Err("Premiere setup is only available on Windows right now".to_string());
    }

    write_install_path_registry()?;
    enable_cep_debug_mode()?;

    let target_dir = cep_target_dir()?;
    let was_installed = target_dir.exists();

    if let Some(source_dir) = resolve_cep_source_dir(state) {
        let copied =
            sync_dir_if_marker_changed(&source_dir, &target_dir, Path::new(CEP_MARKER_FILE))?;

        let status = integration_status(state);
        let message = if !status.conflicts.is_empty() {
            "YT2Premiere was updated in your CEP extensions. Remove the older Premiere panels listed below, then restart Premiere.".to_string()
        } else if copied {
            "Premiere is ready. Open YT2Premiere from Window > Extensions (Legacy)."
                .to_string()
        } else if was_installed {
            "Premiere is already ready.".to_string()
        } else {
            "Premiere setup is ready.".to_string()
        };

        return Ok(IntegrationActionResult {
            success: true,
            message,
            manual_step_required: false,
            status,
        });
    }

    if target_dir.join(CEP_MARKER_FILE).exists() {
        let status = integration_status(state);
        return Ok(IntegrationActionResult {
            success: true,
            message: "Premiere is already ready.".to_string(),
            manual_step_required: false,
            status,
        });
    }

    Err("Could not find the files needed to set up Premiere".to_string())
}

pub fn open_browser_setup(state: &AppState) -> Result<IntegrationActionResult, String> {
    if !cfg!(target_os = "windows") {
        return Err("Browser setup is only available on Windows right now".to_string());
    }

    let source_dir = resolve_browser_source_dir(state).ok_or_else(|| {
        "Could not find the files needed to set up the browser add-on".to_string()
    })?;
    let target_dir = browser_addon_target_dir()?;
    stage_dir(&source_dir, &target_dir)?;
    open_directory(&target_dir)?;

    let _ = open_chrome_extensions();

    let status = integration_status(state);
    let message = "The extension folder is ready. In Chrome, open chrome://extensions, turn on Developer mode, then load the YT2Premiere folder that just opened.".to_string();

    Ok(IntegrationActionResult {
        success: true,
        message,
        manual_step_required: true,
        status,
    })
}

fn premiere_panel_installed(state: &AppState) -> bool {
    let target_dir = match cep_target_dir() {
        Ok(path) => path,
        Err(_) => return false,
    };

    let target_marker = target_dir.join(CEP_MARKER_FILE);
    if !target_marker.exists() {
        return false;
    }

    if let Some(source_dir) = resolve_cep_source_dir(state) {
        return directories_match(&source_dir, &target_dir).unwrap_or(false);
    }

    true
}

fn browser_addon_ready() -> bool {
    browser_addon_target_dir()
        .map(|path| path.join(BROWSER_MARKER_FILE).exists())
        .unwrap_or(false)
}

#[derive(Debug, Clone)]
struct CepInstallRecord {
    id: String,
    path: PathBuf,
    scope: &'static str,
    manifest: String,
}

fn resolve_cep_source_dir(state: &AppState) -> Option<PathBuf> {
    resolve_source_dir(
        state,
        &[
            repo_root().join("cep-extension"),
            manifest_root().join("resources").join("cep-extension"),
        ],
        "cep-extension",
        CEP_MARKER_FILE,
    )
}

fn resolve_browser_source_dir(state: &AppState) -> Option<PathBuf> {
    resolve_source_dir(
        state,
        &[
            repo_root().join("extension").join("dist"),
            manifest_root().join("resources").join("chrome-extension"),
        ],
        "chrome-extension",
        BROWSER_MARKER_FILE,
    )
}

fn resolve_source_dir(
    state: &AppState,
    direct_candidates: &[PathBuf],
    resource_subdir: &str,
    marker_file: &str,
) -> Option<PathBuf> {
    for candidate in direct_candidates {
        if candidate.join(marker_file).exists() {
            return Some(candidate.clone());
        }
    }

    state
        .resource_dir
        .as_ref()
        .map(|resource_dir| resource_dir.join(resource_subdir))
        .filter(|candidate| candidate.join(marker_file).exists())
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

fn manifest_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn cep_target_dir() -> Result<PathBuf, String> {
    let appdata = env::var("APPDATA")
        .map_err(|_| "Could not resolve the Windows AppData directory".to_string())?;
    Ok(PathBuf::from(appdata)
        .join("Adobe")
        .join("CEP")
        .join("extensions")
        .join(CEP_EXTENSION_ID))
}

fn cep_search_roots() -> Vec<(PathBuf, &'static str)> {
    let mut roots = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") {
        roots.push((
            PathBuf::from(appdata).join("Adobe").join("CEP").join("extensions"),
            "user",
        ));
    }

    for key in ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(base) = env::var_os(key) {
            let candidate = PathBuf::from(base)
                .join("Common Files")
                .join("Adobe")
                .join("CEP")
                .join("extensions");
            if !roots.iter().any(|(existing, _)| existing == &candidate) {
                roots.push((candidate, "system"));
            }
        }
    }

    roots
}

fn read_manifest(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_default()
}

fn collect_cep_install_records() -> Vec<CepInstallRecord> {
    let mut installs = Vec::new();

    for (root, scope) in cep_search_roots() {
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join(CEP_MARKER_FILE);
            if !manifest_path.exists() {
                continue;
            }

            installs.push(CepInstallRecord {
                id: entry.file_name().to_string_lossy().to_string(),
                path,
                scope,
                manifest: read_manifest(&manifest_path),
            });
        }
    }

    installs
}

fn describe_manifest_issues(manifest: &str) -> Vec<&'static str> {
    let normalized = manifest.to_ascii_lowercase();
    let mut issues = Vec::new();

    if normalized.contains("<type>custom</type>") {
        issues.push("it is still configured as a hidden background extension");
    }
    if normalized.contains("<autovisible>true</autovisible>") {
        issues.push("it is still configured to pop open automatically");
    }
    if normalized.contains("<starton>") {
        issues.push("it still starts automatically when Premiere gets focus");
    }

    issues
}

fn detect_cep_conflicts() -> Vec<IntegrationConflict> {
    let target_dir = cep_target_dir().ok();
    let mut conflicts = Vec::new();

    for install in collect_cep_install_records() {
        let normalized_id = install.id.to_ascii_lowercase();
        let mut reasons = Vec::new();

        if LEGACY_CEP_IDS.contains(&normalized_id.as_str()) {
            reasons.push("this older panel can still open automatically in Premiere");
        }

        if normalized_id == CEP_EXTENSION_ID {
            if let Some(target_dir) = target_dir.as_ref() {
                if install.path != *target_dir {
                    reasons.push("another YT2Premiere panel is installed in a different CEP folder");
                }
            }

            reasons.extend(describe_manifest_issues(&install.manifest));
        }

        if reasons.is_empty() {
            continue;
        }

        conflicts.push(IntegrationConflict {
            id: install.id,
            path: install.path.to_string_lossy().to_string(),
            scope: install.scope.to_string(),
            reason: reasons.join("; "),
        });
    }

    conflicts.sort_by(|left, right| left.path.cmp(&right.path));
    conflicts
}

fn browser_addon_target_dir() -> Result<PathBuf, String> {
    Ok(app_storage_dir()?.join("chrome-extension"))
}

fn sync_dir_if_marker_changed(
    source_dir: &Path,
    target_dir: &Path,
    marker_relative_path: &Path,
) -> Result<bool, String> {
    let source_marker = source_dir.join(marker_relative_path);
    if !source_marker.exists() {
        return Err(format!("Missing setup file: {}", source_marker.display()));
    }

    if target_dir.exists() && directories_match(source_dir, target_dir)? {
        return Ok(false);
    }

    stage_dir(source_dir, target_dir)?;
    Ok(true)
}

fn stage_dir(source_dir: &Path, target_dir: &Path) -> Result<(), String> {
    if !source_dir.exists() {
        return Err(format!("Missing setup directory: {}", source_dir.display()));
    }

    if target_dir.exists() {
        fs::remove_dir_all(target_dir)
            .map_err(|error| format!("Could not refresh {}: {}", target_dir.display(), error))?;
    }

    if let Some(parent) = target_dir.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {}", parent.display(), error))?;
    }

    copy_dir_recursive(source_dir, target_dir)
}

fn copy_dir_recursive(source_dir: &Path, target_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(target_dir)
        .map_err(|error| format!("Could not create {}: {}", target_dir.display(), error))?;

    for entry in fs::read_dir(source_dir)
        .map_err(|error| format!("Could not read {}: {}", source_dir.display(), error))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let target_path = target_dir.join(entry.file_name());

        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "Could not copy {} to {}: {}",
                    source_path.display(),
                    target_path.display(),
                    error
                )
            })?;
        }
    }

    Ok(())
}

fn read_file(path: &Path) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|error| format!("Could not read {}: {}", path.display(), error))
}

fn directories_match(source_dir: &Path, target_dir: &Path) -> Result<bool, String> {
    if !source_dir.exists() || !target_dir.exists() {
        return Ok(false);
    }

    let mut source_entries = fs::read_dir(source_dir)
        .map_err(|error| format!("Could not read {}: {}", source_dir.display(), error))?
        .map(|entry| entry.map_err(|error| error.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    let mut target_entries = fs::read_dir(target_dir)
        .map_err(|error| format!("Could not read {}: {}", target_dir.display(), error))?
        .map(|entry| entry.map_err(|error| error.to_string()))
        .collect::<Result<Vec<_>, _>>()?;

    source_entries.sort_by_key(|entry| entry.file_name());
    target_entries.sort_by_key(|entry| entry.file_name());

    if source_entries.len() != target_entries.len() {
        return Ok(false);
    }

    for (source_entry, target_entry) in source_entries.iter().zip(target_entries.iter()) {
        if source_entry.file_name() != target_entry.file_name() {
            return Ok(false);
        }

        let source_path = source_entry.path();
        let target_path = target_entry.path();

        if source_path.is_dir() != target_path.is_dir() {
            return Ok(false);
        }

        if source_path.is_dir() {
            if !directories_match(&source_path, &target_path)? {
                return Ok(false);
            }
        } else if read_file(&source_path)? != read_file(&target_path)? {
            return Ok(false);
        }
    }

    Ok(true)
}

fn open_directory(path: &Path) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        let mut command = Command::new("explorer.exe");
        command
            .arg(path.as_os_str())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        hide_windows_console(&mut command)
            .spawn()
            .map_err(|error| format!("Could not open the folder: {}", error))?;
        return Ok(());
    }

    let status = if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(path)
            .status()
            .map_err(|error| format!("Could not open the folder: {}", error))?
    } else {
        Command::new("xdg-open")
            .arg(path)
            .status()
            .map_err(|error| format!("Could not open the folder: {}", error))?
    };

    if status.success() {
        Ok(())
    } else {
        Err("The operating system rejected the request to open the folder".to_string())
    }
}

fn detect_premiere_installed() -> bool {
    if !cfg!(target_os = "windows") {
        return false;
    }

    if premiere::is_premiere_running() {
        return true;
    }

    if let Some(program_files) = env::var_os("ProgramFiles") {
        let adobe_dir = PathBuf::from(program_files).join("Adobe");
        if let Ok(entries) = fs::read_dir(adobe_dir) {
            if entries.flatten().any(|entry| {
                entry.path().is_dir()
                    && entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with("Adobe Premiere Pro")
            }) {
                return true;
            }
        }
    }

    registry_contains(
        r"HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        "Adobe Premiere Pro",
    ) || registry_contains(
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        "Adobe Premiere Pro",
    )
}

fn detect_chrome_executable() -> Option<PathBuf> {
    if !cfg!(target_os = "windows") {
        return None;
    }

    if let Some(path) = query_registry_value(
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
        None,
    ) {
        let candidate = PathBuf::from(path);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    let candidates = [
        env::var_os("LOCALAPPDATA").map(PathBuf::from).map(|base| {
            base.join("Google")
                .join("Chrome")
                .join("Application")
                .join("chrome.exe")
        }),
        env::var_os("ProgramFiles").map(PathBuf::from).map(|base| {
            base.join("Google")
                .join("Chrome")
                .join("Application")
                .join("chrome.exe")
        }),
        env::var_os("ProgramFiles(x86)")
            .map(PathBuf::from)
            .map(|base| {
                base.join("Google")
                    .join("Chrome")
                    .join("Application")
                    .join("chrome.exe")
            }),
    ];

    candidates
        .into_iter()
        .flatten()
        .find(|candidate| candidate.exists())
}

fn open_chrome_extensions() -> bool {
    if !cfg!(target_os = "windows") {
        return false;
    }

    if let Some(chrome_executable) = detect_chrome_executable() {
        let mut command = Command::new(chrome_executable);
        if hide_windows_console(
            command
                .args(["--new-tab", "chrome://extensions"])
                .stdout(Stdio::null())
                .stderr(Stdio::null()),
        )
            .spawn()
            .is_ok()
        {
            return true;
        }
    }

    let mut command = Command::new("cmd");
    hide_windows_console(
        command
            .args(["/C", "start", "", "chrome://extensions"])
            .stdout(Stdio::null())
            .stderr(Stdio::null()),
    )
        .spawn()
        .is_ok()
}

fn write_install_path_registry() -> Result<(), String> {
    if !cfg!(target_os = "windows") {
        return Ok(());
    }

    let current_exe = env::current_exe()
        .map_err(|error| format!("Could not resolve the app location: {}", error))?;
    let install_dir = current_exe
        .parent()
        .ok_or_else(|| "Could not resolve the app folder".to_string())?;

    write_registry_value(
        r"HKCU\Software\YT2Premiere",
        "InstallPath",
        &install_dir.to_string_lossy(),
    )
}

fn enable_cep_debug_mode() -> Result<(), String> {
    if !cfg!(target_os = "windows") {
        return Ok(());
    }

    for version in 6..=13 {
        write_registry_value(
            &format!(r"HKCU\Software\Adobe\CSXS.{}", version),
            "PlayerDebugMode",
            "1",
        )?;
    }

    Ok(())
}

fn write_registry_value(key: &str, name: &str, value: &str) -> Result<(), String> {
    let mut command = Command::new("reg");
    let status = hide_windows_console(
        command.args(["add", key, "/v", name, "/t", "REG_SZ", "/d", value, "/f"]),
    )
        .status()
        .map_err(|error| format!("Could not update {}: {}", key, error))?;

    if !status.success() {
        return Err(format!("Could not update {}", key));
    }

    Ok(())
}

fn registry_contains(key: &str, text: &str) -> bool {
    let mut command = Command::new("reg");
    let output = hide_windows_console(command.args(["query", key, "/s", "/f", text, "/d"]))
        .output();

    match output {
        Ok(output) if output.status.success() => {
            String::from_utf8_lossy(&output.stdout).contains(text)
        }
        _ => false,
    }
}

fn query_registry_value(key: &str, value_name: Option<&str>) -> Option<String> {
    let mut args = vec!["query", key];
    match value_name {
        Some(name) => {
            args.push("/v");
            args.push(name);
        }
        None => args.push("/ve"),
    }

    let mut command = Command::new("reg");
    let output = hide_windows_console(command.args(args)).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let expected_name = value_name.unwrap_or("(Default)");
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(expected_name) {
            continue;
        }

        for registry_type in ["REG_SZ", "REG_EXPAND_SZ"] {
            if let Some((_, value)) = trimmed.split_once(registry_type) {
                let next = value.trim();
                if !next.is_empty() {
                    return Some(next.to_string());
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn sync_dir_if_marker_changed_copies_missing_target() {
        let temp_dir = tempdir().expect("temp dir");
        let source = temp_dir.path().join("source");
        let target = temp_dir.path().join("target");

        fs::create_dir_all(source.join("CSXS")).expect("create source");
        fs::write(source.join("CSXS").join("manifest.xml"), "v1").expect("write marker");
        fs::write(source.join("index.html"), "ready").expect("write file");

        let changed = sync_dir_if_marker_changed(&source, &target, Path::new(CEP_MARKER_FILE))
            .expect("sync directory");

        assert!(changed);
        assert_eq!(
            fs::read_to_string(target.join("index.html")).expect("target file"),
            "ready"
        );
    }

    #[test]
    fn sync_dir_if_marker_changed_skips_matching_target() {
        let temp_dir = tempdir().expect("temp dir");
        let source = temp_dir.path().join("source");
        let target = temp_dir.path().join("target");

        fs::create_dir_all(source.join("CSXS")).expect("create source");
        fs::create_dir_all(target.join("CSXS")).expect("create target");
        fs::write(source.join("CSXS").join("manifest.xml"), "v1").expect("write source marker");
        fs::write(source.join("index.html"), "existing").expect("write source file");
        fs::write(target.join("CSXS").join("manifest.xml"), "v1").expect("write target marker");
        fs::write(target.join("index.html"), "existing").expect("write target file");

        let changed = sync_dir_if_marker_changed(&source, &target, Path::new(CEP_MARKER_FILE))
            .expect("sync directory");

        assert!(!changed);
        assert_eq!(
            fs::read_to_string(target.join("index.html")).expect("target file"),
            "existing"
        );
    }

    #[test]
    fn directories_match_detects_content_changes() {
        let temp_dir = tempdir().expect("temp dir");
        let source = temp_dir.path().join("source");
        let target = temp_dir.path().join("target");

        fs::create_dir_all(&source).expect("create source");
        fs::create_dir_all(&target).expect("create target");
        fs::write(source.join("index.html"), "v2").expect("write source");
        fs::write(target.join("index.html"), "v1").expect("write target");

        assert!(!directories_match(&source, &target).expect("compare directories"));
    }
}
