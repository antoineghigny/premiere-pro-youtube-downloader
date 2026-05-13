#!/usr/bin/env bash
set -euo pipefail

TARGET_TRIPLE="${1:-aarch64-apple-darwin}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BINARIES_DIR="$REPO_ROOT/desktop/src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

download_if_missing() {
  local url="$1"
  local dest="$2"
  if [ -f "$dest" ] && [ -s "$dest" ]; then
    echo "Using existing sidecar at $dest"
    return 0
  fi
  echo "Downloading $url"
  curl -fsSL -o "$dest" "$url"
  if [ ! -s "$dest" ]; then
    echo "Error: downloaded file is empty: $dest" >&2
    exit 1
  fi
}

# yt-dlp standalone binary
YT_DLP_DEST="$BINARIES_DIR/yt-dlp-$TARGET_TRIPLE"
if [ ! -f "$YT_DLP_DEST" ] || [ ! -s "$YT_DLP_DEST" ]; then
  download_if_missing "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" "$YT_DLP_DEST"
  chmod +x "$YT_DLP_DEST"
fi

# FFmpeg
FFMPEG_DEST="$BINARIES_DIR/ffmpeg-$TARGET_TRIPLE"
if [ ! -f "$FFMPEG_DEST" ] || [ ! -s "$FFMPEG_DEST" ]; then
  OS_ARCH="${TARGET_TRIPLE%%-*}"
  if [ "$OS_ARCH" = "aarch64" ] || [ "$OS_ARCH" = "arm64" ]; then
    FFMPEG_URL="https://evermeet.cx/ffmpeg/ffmpeg/FFmpeg.7z"
  else
    FFMPEG_URL="https://evermeet.cx/ffmpeg/ffmpeg/FFmpeg.7z"
  fi

  TEMP_DIR="$(mktemp -d)"
  FFMPEG_7Z="$TEMP_DIR/ffmpeg.7z"
  trap 'rm -rf "$TEMP_DIR"' EXIT

  echo "Downloading FFmpeg from $FFMPEG_URL"
  curl -fsSL -o "$FFMPEG_7Z" "$FFMPEG_URL"

  if command -v 7z &>/dev/null; then
    7z e "$FFMPEG_7Z" -o"$TEMP_DIR" ffmpeg -y
  elif command -v 7zz &>/dev/null; then
    7zz e "$FFMPEG_7Z" -o"$TEMP_DIR" ffmpeg -y
  else
    echo "Error: install 7zip (brew install 7zip) to extract FFmpeg" >&2
    exit 1
  fi

  cp "$TEMP_DIR/ffmpeg" "$FFMPEG_DEST"
  chmod +x "$FFMPEG_DEST"
  rm -rf "$TEMP_DIR"
  trap - EXIT

  if [ ! -s "$FFMPEG_DEST" ]; then
    echo "Error: downloaded ffmpeg is empty" >&2
    exit 1
  fi
fi

echo "Sidecars ready in $BINARIES_DIR"
ls -lh "$BINARIES_DIR"/
