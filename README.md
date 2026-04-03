# YT2Premiere

Open-source video downloader for desktop and Chrome, with optional Adobe Premiere Pro import.

YT2Premiere lets you download video, audio, and clips from `yt-dlp` compatible sites, manage everything in a desktop queue, trigger downloads from Chrome, and send finished media to Premiere when you need it.

## Features

- Open-source desktop downloader for `yt-dlp` compatible sites
- Download full videos, audio-only exports, or short clips
- Queue management with history and retry support
- FFmpeg output presets, codecs, resolution, audio export, and post-processing
- Chrome extension that sends downloads to the local desktop app
- Optional Adobe Premiere Pro import workflow
- Single-instance desktop app with tray mode and background mode
- Rust backend embedded in the desktop app

## Use cases

- Save online videos locally for viewing, archiving, or editing
- Extract audio tracks for podcasts, music references, or sound design
- Cut short clips before export instead of downloading the whole timeline manually
- Push finished files into Premiere when your workflow needs it

## Components

- `desktop/` - Tauri desktop app and embedded Rust backend
- `extension/` - Chrome extension
- `cep-extension/` - Adobe Premiere Pro CEP bridge

## Install

### Desktop app

1. Download the latest Windows installer from Releases.
2. Install the `.msi`.
3. Launch `YT2Premiere`.

### Chrome extension

1. Download and extract `YT2Premiere-chrome-extension.zip`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the extracted extension folder.

### Premiere bridge

1. Download and extract `YT2Premiere-cep-extension.zip`.
2. Copy it to your Adobe CEP extensions directory.
3. Open Premiere Pro.
4. Open `Window > Extensions (Legacy) > YT2Premiere`.

On Windows, the CEP target folder is typically:

`%APPDATA%\Adobe\CEP\extensions\com.yt2premiere.cep`

## Usage

1. Launch `YT2Premiere`.
2. Paste a video URL in the desktop app or trigger a download from the Chrome extension.
3. Adjust output options if needed.
4. Start the download.
5. Enable Premiere import only when you want the finished media added to the current project.

## Tech stack

- Tauri 2
- Rust + Axum
- React 19 + Vite
- Tailwind CSS v4 + shadcn/ui
- Chrome Extension Manifest V3
- Adobe CEP

## Development

### Requirements

- Node.js 22
- Rust stable
- Google Chrome
- Adobe Premiere Pro for import testing

### Setup

```bash
cd extension
npm ci

cd ../desktop
npm ci
```

### Run the desktop app

```bash
npm run dev:desktop
```

### Build the extension

```bash
cd extension
npm run build
```

### Run the test suite

```bash
npm test
```

## Documentation

- [Architecture](./ARCHITECTURE.md)
- [Contributing](./CONTRIBUTING.md)
