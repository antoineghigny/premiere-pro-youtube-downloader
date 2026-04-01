# YT2Premiere

YT2Premiere adds download actions directly on YouTube and sends the result to Adobe Premiere Pro.

It is made of three parts:

- a Chrome extension injected on YouTube
- a local Python backend running on `127.0.0.1:3001`
- a CEP panel for Premiere Pro

## Runtime behavior

- settings are stored in the user config directory:
  - Windows: `%APPDATA%\YT2Premiere`
  - macOS: `~/Library/Application Support/YT2Premiere`
  - Linux: `${XDG_CONFIG_HOME:-~/.config}/YT2Premiere`
- downloads default to the current Premiere project folder when Premiere is available
- otherwise downloads fall back to `~/Downloads/YT2Premiere/YYYY-MM-DD`
- the extension now routes backend traffic through its service worker, and its manifest key pins a stable extension ID so the local API only accepts this extension origin

## Repository layout

- `backend/`: local API server, download pipeline, PyInstaller spec
- `extension/`: Chrome extension source and webpack build
- `cep-extension/`: Premiere CEP panel
- `installer/`: NSIS installer definition
- `.github/workflows/`: CI and release automation
- `tools/`: optional local binaries for maintainer builds only, not committed

## Development setup

Requirements:

- Windows is the supported release target
- Node.js 20
- Python 3.12
- Google Chrome
- Adobe Premiere Pro

Install dependencies:

```bash
cd extension
npm ci
cd ..
python -m pip install -r backend/requirements.txt
```

Run the backend locally:

```bash
cd backend
python server.py
```

Build the unpacked extension:

```bash
cd extension
npm run build
```

Then load `extension/dist/` as an unpacked extension in `chrome://extensions`.

## CI and releases

The canonical build path is GitHub Actions:

- `.github/workflows/ci.yml` validates the extension build and the versioned PyInstaller spec on every push and pull request.
- `.github/workflows/release.yml` builds Windows release assets on tags matching `v*` or on manual dispatch.

Tagged releases publish:

- `YT2PremiereInstaller.exe`
- `YT2Premiere-backend-win64.zip`
- `YT2Premiere-chrome-extension.zip`
- `YT2Premiere-cep-extension.zip`
- `SHA256SUMS.txt`

The release workflow installs `ffmpeg`, `aria2`, and `NSIS` explicitly, so artifacts are reproducible and do not depend on maintainer machines.

## Maintainer build

`build.bat` mirrors the release workflow for local maintainer builds. It uses `npm ci --no-audit --no-fund`, the versioned `backend/YT2Premiere.spec`, and auto-detects local FFmpeg and optional `aria2c` when packaging outside CI.
