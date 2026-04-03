# Repository Guidelines

## Project Structure & Module Organization
`desktop/` contains the Tauri desktop app: `desktop/src-tauri/` is the Rust backend/runtime and `desktop/src/` is the React UI. `extension/` is the Chrome extension; source lives in `extension/src/` with feature folders such as `api/`, `player/`, `popup/`, `styles/`, and `utils/`, and production output goes to `extension/dist/`. `cep-extension/` holds the Premiere CEP panel. `dist/` is generated release staging. Treat `tools/` as local-only packaging input for FFmpeg and optional `aria2c`.

## Build, Test, and Development Commands
`cd extension && npm ci` installs the extension toolchain.  
`cd desktop && npm ci` installs the desktop toolchain.  
`cd extension && npm run dev` starts webpack watch mode for extension work.  
`cd extension && npm run build` creates the production Chrome bundle.  
`cd desktop && npm run tauri:dev` starts the desktop app with the embedded Rust backend.  
`cd desktop/src-tauri && cargo check` validates the Rust backend.  
`cd desktop && npm run build` validates the desktop frontend. GitHub Actions `.github/workflows/release.yml` is the canonical release path.

## Coding Style & Naming Conventions
Use the surrounding style instead of introducing a formatter footprint. TypeScript is strict-mode, uses 2-space indentation, semicolons, and camelCase identifiers and filenames such as `clipOverlay.ts` or `timeUtils.ts`. Rust should follow the surrounding module split and keep route handlers thin by delegating logic to services. Keep CSS in `extension/src/styles/` and reuse existing Tailwind/theme tokens before adding new ones.

## Testing Guidelines
There is no committed automated test suite or coverage gate yet. Every change should at minimum pass `cd desktop/src-tauri && cargo check`, `cd desktop && npm run build`, `cd extension && npm run build`, and a manual smoke test of the changed flow. For backend work, confirm the desktop app health endpoint and a download path still behave correctly. For UI work, verify Chrome popup behavior and, when relevant, Premiere integration. If you add automated tests, keep them close to the feature using `*.test.ts`.

## Commit & Pull Request Guidelines
Recent commits use short imperative subjects with initial caps, for example `Update extension build dependencies` and `Polish popup toggles and download progress UI`. Follow that pattern and keep each commit focused. PRs should summarize the affected area (`desktop`, `extension`, `cep-extension`, or release tooling), list manual verification steps, link related issues, and include screenshots or clips for visible UI changes. Do not commit generated binaries, downloaded media, or personal tool paths.
