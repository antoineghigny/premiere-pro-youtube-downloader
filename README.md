# YT2Premiere

YT2Premiere adds download actions directly on YouTube and sends the result to Adobe Premiere Pro.

It is made of three parts:

- a Chrome extension injected on YouTube
- a local Python backend running on `127.0.0.1:3001`
- a CEP panel for Premiere Pro

## Goals

- no hardcoded user paths
- clean GitHub repository without local artifacts
- simple local setup
- release build that auto-detects local tools when possible

## Runtime behavior

- settings are stored in the user config directory:
  - Windows: `%APPDATA%\\YT2Premiere`
  - macOS: `~/Library/Application Support/YT2Premiere`
  - Linux: `${XDG_CONFIG_HOME:-~/.config}/YT2Premiere`
- downloads default to the current Premiere project folder when Premiere is available
- otherwise downloads fall back to `~/Downloads/YT2Premiere/YYYY-MM-DD`

## Repository layout

- `backend/`: local API server and download/import logic
- `extension/`: Chrome extension source
- `cep-extension/`: Premiere CEP panel
- `installer/`: NSIS installer
- `tools/`: optional local binaries for packaging only, not committed

## Development setup

Requirements:

- Windows is the main supported release target
- Node.js 20+
- Python 3.11+ with `pip`
- Google Chrome
- Adobe Premiere Pro
- FFmpeg available either on `PATH` or in `tools/ffmpeg_win/`

Install dependencies:

```bash
cd extension
npm ci
cd ..
python -m pip install -r backend/requirements.txt
```

Run the backend:

```bash
cd backend
python server.py
```

Build the Chrome extension:

```bash
cd extension
npm run build
```

Then load `extension/dist/` as an unpacked extension in `chrome://extensions`.

## Release build

Use:

```bat
build.bat
```

What the script does:

- installs build dependencies for the backend
- builds the Chrome extension
- builds the Python executable with PyInstaller
- stages release files in `dist/staging/`
- bundles FFmpeg from `tools/ffmpeg_win/` or from `PATH`
- bundles `aria2c` if available, but it is optional
- builds the NSIS installer if `makensis` is installed

The script does not require any personal directory path.

## Notes

- `tools/` is intentionally ignored by git
- generated media files, logs, and build outputs are ignored by git
- audio-only exports are saved as WAV because that format is safer for Premiere workflows
