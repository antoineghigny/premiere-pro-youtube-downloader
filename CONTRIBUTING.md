# Contributing

This document is for contributors working from source. It is not part of the end-user install flow.

## Repository layout

- `backend/`: local API server, download pipeline, PyInstaller spec
- `extension/`: Chrome extension source and webpack build
- `cep-extension/`: Premiere CEP panel used for Premiere automation
- `installer/`: NSIS installer definition
- `.github/workflows/`: CI and release automation
- `tools/`: optional local binaries for maintainer builds only, not committed

## Local development

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

Recommended day-to-day workflow:

1. Install the Premiere CEP panel for development.
2. Run the backend from source during development.
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

Start the backend from source:

```bash
cd backend
python server.py
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

## Packaged backend testing

You only need the `.exe` when you want to validate the packaged backend instead of the source server.

Build it with:

```bash
cd backend
python -m PyInstaller YT2Premiere.spec --noconfirm --clean --distpath dist --workpath build
```

The resulting executable is:

`C:\Users\Antoine\Code\YT2Premiere\backend\dist\YT2Premiere.exe`

Use the packaged `.exe` only to validate packaging behavior. Normal feature development should keep using `python server.py`.

## CI and releases

- `.github/workflows/ci.yml` validates the extension build and the versioned PyInstaller spec on every push and pull request.
- `.github/workflows/release.yml` builds the Windows installer artifact on every push to `main`, on manual dispatch, and on tags matching `v*`.
- `.github/workflows/release.yml` is the canonical packaging path for `YT2PremiereInstaller.exe`; it rebuilds the installer from the current `backend/`, `extension/`, `cep-extension/`, and `installer/` sources.
