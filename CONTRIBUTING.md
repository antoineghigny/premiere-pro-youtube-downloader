# Contributing

This document is for contributors working from source. It is not part of the end-user install flow.

## Repository layout

- `desktop/`: Tauri desktop app, React frontend, Rust backend
- `extension/`: Chrome extension source and webpack build
- `cep-extension/`: Premiere CEP panel used for Premiere automation
- `.github/workflows/`: CI and release automation
- `tools/`: optional local binaries for maintainer builds only, not committed

## Local development

Requirements:

- Windows is the supported release target
- Node.js 22
- Rust stable
- Google Chrome
- Adobe Premiere Pro

Install dependencies:

```bash
cd extension
npm ci

cd ../desktop
npm ci
```

Recommended day-to-day workflow:

1. Install the Premiere CEP panel for development.
2. Run the desktop app from source during development.
3. Build and load the unpacked Chrome extension.

## Premiere setup for development

Install the CEP panel from source into the user-level Adobe CEP folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-cep-dev.ps1
```

What this does:

- copies `cep-extension/` to `%APPDATA%\Adobe\CEP\extensions\com.yt2premiere.cep`
- enables `PlayerDebugMode` for CSXS versions 6 through 13 in `HKCU`
- avoids `Program Files`, so admin rights are not required for normal development

After running it:

1. Start Premiere Pro.
2. Open `Window > Extensions (Legacy) > YT2Premiere`.
3. Keep Premiere open while testing import automation.

Start the desktop app from source:

```bash
cd desktop
npm run tauri:dev
```

Equivalent from the repository root:

```bash
npm run dev:desktop
```

Build the unpacked extension once:

```bash
cd extension
npm run build
```

Or keep it rebuilding while you work:

```bash
cd extension
npm run dev
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `C:\Users\Antoine\Code\YT2Premiere\extension\dist`

After each rebuild, click `Reload` on the extension card in Chrome, then refresh the active YouTube tab.

Important:

- the CEP bridge now tries to locate an installed `YT2Premiere.exe` through the Windows registry
- if you are testing only from source and do not have the packaged app installed, keep `npm run tauri:dev` running before opening the CEP panel

## Packaged desktop testing

Build the packaged desktop app with:

```bash
cd desktop
npm run tauri:build
```

Useful local validation commands:

```bash
cd desktop/src-tauri
cargo check

cd ..
npm run build

cd ../extension
npm run build
```

The packaged installer is emitted under `desktop/src-tauri/target/release/bundle/`.

## CI and releases

- `.github/workflows/ci.yml` validates the extension build, desktop frontend build, and Rust backend checks on every push and pull request.
- `.github/workflows/release.yml` builds the Windows desktop release artifacts on every push to `main`, on manual dispatch, and on tags matching `v*`.
- `.github/workflows/release.yml` is the canonical packaging path; it rebuilds the desktop app, Chrome extension, and CEP payloads from the current `desktop/`, `extension/`, and `cep-extension/` sources.
