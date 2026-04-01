# Repository Guidelines

## Project Structure & Module Organization
`backend/` contains the local Flask-SocketIO service (`server.py`) plus download, Premiere import, and settings logic. `extension/` is the Chrome extension; source lives in `extension/src/` with feature folders such as `api/`, `player/`, `popup/`, `styles/`, and `utils/`, and production output goes to `extension/dist/`. `cep-extension/` holds the Premiere CEP panel, `installer/` contains the NSIS script, and `dist/` is generated release staging. Treat `tools/` as local-only packaging input for FFmpeg and optional `aria2c`.

## Build, Test, and Development Commands
`cd extension && npm ci` installs the extension toolchain.  
`cd backend && python -m pip install -r requirements.txt` installs backend runtime dependencies.  
`cd extension && npm run dev` starts webpack watch mode for extension work.  
`cd extension && npm run build` creates the production Chrome bundle.  
`cd backend && python server.py` starts the local API on `127.0.0.1:3001`.  
`build.bat` runs the full Windows release flow: extension build, PyInstaller backend, staging under `dist/staging/`, and NSIS packaging when `makensis` is available.

## Coding Style & Naming Conventions
Use the surrounding style instead of introducing a formatter footprint. TypeScript is strict-mode, uses 2-space indentation, semicolons, and camelCase identifiers and filenames such as `clipOverlay.ts` or `timeUtils.ts`. Python uses 4-space indentation, snake_case functions/modules, and keeps route handlers thin by delegating logic to helper modules. Keep CSS in `extension/src/styles/` and reuse existing Tailwind/theme tokens before adding new ones.

## Testing Guidelines
There is no committed automated test suite or coverage gate yet. Every change should at minimum pass `npm run build` and a manual smoke test of the changed flow. For backend work, confirm `/get-version` and a download path still behave correctly. For UI work, verify Chrome popup behavior and, when relevant, Premiere integration. If you add automated tests, keep them close to the feature using `*.test.ts` or `backend/tests/test_*.py`.

## Commit & Pull Request Guidelines
Recent commits use short imperative subjects with initial caps, for example `Update extension build dependencies` and `Polish popup toggles and download progress UI`. Follow that pattern and keep each commit focused. PRs should summarize the affected area (`backend`, `extension`, `cep-extension`, or `installer`), list manual verification steps, link related issues, and include screenshots or clips for visible UI changes. Do not commit generated binaries, downloaded media, or personal tool paths.
