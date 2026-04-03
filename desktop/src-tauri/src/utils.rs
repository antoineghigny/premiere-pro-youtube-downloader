use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};

use directories::BaseDirs;
use serde::Serialize;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub const APP_NAME: &str = "YT2Premiere";
pub const APP_FINGERPRINT: &str = "YT2Premiere";
pub const BACKEND_API_VERSION: u8 = 2;
pub const BACKEND_TRANSPORT: &str = "rust-desktop";
pub const SERVER_PORT_RANGE: std::ops::RangeInclusive<u16> = 3001..=3010;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone)]
pub struct ToolPaths {
    pub yt_dlp: String,
    pub ffmpeg: String,
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

fn recursive_find_with_prefix(root: &Path, prefix: &str, depth: usize) -> Option<PathBuf> {
    if depth == 0 || !root.exists() {
        return None;
    }

    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let file_name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();
            if file_name.starts_with(prefix) {
                return Some(path);
            }
        } else if path.is_dir() {
            if let Some(found) = recursive_find_with_prefix(&path, prefix, depth - 1) {
                return Some(found);
            }
        }
    }
    None
}

fn resolve_tool_command(command_name: &str, env_var: &str, local_candidates: &[PathBuf]) -> String {
    if let Ok(override_path) = env::var(env_var) {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    for candidate in local_candidates {
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if let Some(found) = recursive_find_with_prefix(exe_dir, command_name, 4) {
                return found.to_string_lossy().to_string();
            }
            if let Some(parent) = exe_dir.parent() {
                if let Some(found) = recursive_find_with_prefix(parent, command_name, 4) {
                    return found.to_string_lossy().to_string();
                }
            }
        }
    }

    command_name.to_string()
}

pub fn resolve_tool_paths() -> ToolPaths {
    let repo_root = repo_root();
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let is_windows = cfg!(target_os = "windows");

    let target_triple = env!("TAURI_ENV_TARGET_TRIPLE");

    let ytdlp_candidates = vec![
        repo_root
            .join("tools")
            .join(if is_windows { "yt-dlp.exe" } else { "yt-dlp" }),
        manifest_dir.join("binaries").join(format!(
            "yt-dlp-{}{}",
            target_triple,
            if is_windows { ".exe" } else { "" }
        )),
    ];

    let ffmpeg_candidates = vec![
        manifest_dir.join("binaries").join(format!(
            "ffmpeg-{}{}",
            target_triple,
            if is_windows { ".exe" } else { "" }
        )),
        if is_windows {
            repo_root
                .join("tools")
                .join("ffmpeg_win")
                .join("bin")
                .join("ffmpeg.exe")
        } else {
            repo_root.join("tools").join("ffmpeg")
        },
    ];

    ToolPaths {
        yt_dlp: resolve_tool_command("yt-dlp", "YT2PP_YTDLP", &ytdlp_candidates),
        ffmpeg: resolve_tool_command("ffmpeg", "YT2PP_FFMPEG", &ffmpeg_candidates),
    }
}

pub fn hide_windows_console(command: &mut Command) -> &mut Command {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

pub fn hide_windows_console_tokio(
    command: &mut tokio::process::Command,
) -> &mut tokio::process::Command {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

pub fn app_storage_dir() -> Result<PathBuf, String> {
    let base_dirs =
        BaseDirs::new().ok_or_else(|| "Could not resolve the user config directory".to_string())?;
    let path = base_dirs.config_dir().join(APP_NAME);
    fs::create_dir_all(&path)
        .map_err(|error| format!("Could not create app storage directory: {}", error))?;
    Ok(path)
}

pub fn settings_file_path() -> Result<PathBuf, String> {
    Ok(app_storage_dir()?.join("settings.json"))
}

pub fn history_file_path() -> Result<PathBuf, String> {
    Ok(app_storage_dir()?.join("download_history.json"))
}

pub fn active_port_file_path() -> Result<PathBuf, String> {
    Ok(app_storage_dir()?.join("active_port.json"))
}

pub fn backend_instance_kind() -> &'static str {
    if cfg!(debug_assertions) {
        "development"
    } else {
        "installed"
    }
}

pub fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create directory for {}: {}",
                path.display(),
                error
            )
        })?;
    }

    let payload = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("Could not serialize {}: {}", path.display(), error))?;
    let temp_path = path.with_extension("tmp");

    fs::write(&temp_path, payload).map_err(|error| {
        format!(
            "Could not write temporary file {}: {}",
            temp_path.display(),
            error
        )
    })?;

    if path.exists() {
        let _ = fs::remove_file(path);
    }

    fs::rename(&temp_path, path).map_err(|error| {
        format!(
            "Could not replace {} with {}: {}",
            path.display(),
            temp_path.display(),
            error
        )
    })
}

pub fn sanitize_title(value: &str) -> String {
    let filtered: String = value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();

    filtered
        .trim_matches(|character: char| character == '.' || character.is_whitespace())
        .to_string()
}

pub fn unique_output_path(directory: &Path, stem: &str, extension: &str) -> PathBuf {
    let clean_stem = sanitize_title(stem);
    let extension = extension.trim_start_matches('.');
    let base_name = if extension.is_empty() {
        clean_stem.clone()
    } else {
        format!("{}.{}", clean_stem, extension)
    };

    let mut candidate = directory.join(&base_name);
    if !candidate.exists() {
        return candidate;
    }

    let mut counter = 1;
    loop {
        candidate = directory.join(if extension.is_empty() {
            format!("{}_{}", clean_stem, counter)
        } else {
            format!("{}_{}.{}", clean_stem, counter, extension)
        });

        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

pub fn file_size(path: &Path) -> Option<u64> {
    fs::metadata(path).ok().map(|metadata| metadata.len())
}

pub fn format_clip_time(seconds: f64) -> String {
    let seconds = seconds.max(0.0);
    let hours = (seconds / 3600.0).floor() as u64;
    let minutes = ((seconds % 3600.0) / 60.0).floor() as u64;
    let whole_seconds = (seconds % 60.0).floor() as u64;
    let milliseconds = ((seconds.fract()) * 1000.0).round() as u64;
    format!(
        "{:02}:{:02}:{:02}.{:03}",
        hours, minutes, whole_seconds, milliseconds
    )
}

pub fn quote_for_extendscript(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "\\\\")
        .replace('\"', "\\\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    #[test]
    fn sanitize_title_replaces_invalid_characters() {
        assert_eq!(sanitize_title("bad:/\\name*?"), "bad___name__");
        assert_eq!(sanitize_title("  .final name.  "), "final name");
    }

    #[test]
    fn unique_output_path_increments_when_file_exists() {
        let temp_dir = tempdir().expect("temp dir");
        let first_path = temp_dir.path().join("clip.mp4");
        fs::write(&first_path, b"one").expect("write file");

        let unique = unique_output_path(temp_dir.path(), "clip", "mp4");
        assert_eq!(
            unique.file_name().and_then(|value| value.to_str()),
            Some("clip_1.mp4")
        );
    }

    #[test]
    fn write_json_atomic_replaces_previous_content() {
        let temp_dir = tempdir().expect("temp dir");
        let path = temp_dir.path().join("state.json");

        write_json_atomic(&path, &json!({ "value": 1 })).expect("write first payload");
        write_json_atomic(&path, &json!({ "value": 2 })).expect("write second payload");

        let payload: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).expect("read payload"))
                .expect("parse payload");
        assert_eq!(payload["value"], 2);
        assert!(!path.with_extension("tmp").exists());
    }

    #[test]
    fn format_clip_time_and_quote_for_extendscript_are_stable() {
        assert_eq!(format_clip_time(3661.25), "01:01:01.250");
        assert_eq!(
            quote_for_extendscript(Path::new(r#"C:\media\"clip".mp4"#)),
            r#"C:\\media\\\"clip\".mp4"#
        );
    }

    #[test]
    fn backend_instance_kind_matches_build_profile() {
        assert_eq!(
            backend_instance_kind(),
            if cfg!(debug_assertions) {
                "development"
            } else {
                "installed"
            }
        );
    }
}
