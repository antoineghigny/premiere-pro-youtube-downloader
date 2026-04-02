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

Start the backend from source:

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

- `.github/workflows/ci.yml` validates the extension build and the versioned PyInstaller spec on every push and pull request.
- `.github/workflows/release.yml` builds the Windows release on tags matching `v*` or on manual dispatch.
- `.github/workflows/release.yml` is the canonical packaging path for `YT2PremiereInstaller.exe`; it rebuilds the installer from the current `backend/`, `extension/`, `cep-extension/`, and `installer/` sources.
