use std::{
    env, fs,
    path::{Path, PathBuf},
};

fn copy_if_exists(source: &Path, destination: &Path) {
    if !source.exists() {
        if destination.exists() {
            println!(
                "cargo:warning=Using prebuilt sidecar already present at {}",
                destination.display()
            );
            return;
        }

        println!("cargo:warning=Missing sidecar source: {}", source.display());
        return;
    }

    if let Some(parent) = destination.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Err(error) = fs::copy(source, destination) {
        println!(
            "cargo:warning=Could not copy sidecar from {} to {}: {}",
            source.display(),
            destination.display(),
            error
        );
    }
}

fn copy_dir_recursive(source: &Path, destination: &Path) {
    if !source.exists() {
        println!(
            "cargo:warning=Missing resource source: {}",
            source.display()
        );
        return;
    }

    let _ = fs::create_dir_all(destination);

    let entries = match fs::read_dir(source) {
        Ok(entries) => entries,
        Err(error) => {
            println!(
                "cargo:warning=Could not read resource source {}: {}",
                source.display(),
                error
            );
            return;
        }
    };

    for entry in entries.flatten() {
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());

        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &destination_path);
            continue;
        }

        if let Some(parent) = destination_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        if let Err(error) = fs::copy(&source_path, &destination_path) {
            println!(
                "cargo:warning=Could not copy resource from {} to {}: {}",
                source_path.display(),
                destination_path.display(),
                error
            );
        }
    }
}

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_default());
    let target = env::var("TARGET").unwrap_or_default();
    let binary_dir = manifest_dir.join("binaries");
    let _ = fs::create_dir_all(&binary_dir);

    let is_windows = target.contains("windows");
    let exe_suffix = if is_windows { ".exe" } else { "" };
    let repo_root = manifest_dir.join("..").join("..");

    let ytdlp_source = repo_root
        .join("tools")
        .join(format!("yt-dlp{}", exe_suffix));
    let ffmpeg_source = if is_windows {
        repo_root
            .join("tools")
            .join("ffmpeg_win")
            .join("bin")
            .join("ffmpeg.exe")
    } else {
        repo_root.join("tools").join("ffmpeg")
    };

    copy_if_exists(
        &ytdlp_source,
        &binary_dir.join(format!("yt-dlp-{}{}", target, exe_suffix)),
    );
    copy_if_exists(
        &ffmpeg_source,
        &binary_dir.join(format!("ffmpeg-{}{}", target, exe_suffix)),
    );

    let resources_dir = manifest_dir.join("resources");
    let _ = fs::create_dir_all(&resources_dir);
    copy_dir_recursive(
        &repo_root.join("cep-extension"),
        &resources_dir.join("cep-extension"),
    );
    copy_dir_recursive(
        &repo_root.join("extension").join("dist"),
        &resources_dir.join("chrome-extension"),
    );

    tauri_build::build();
}
