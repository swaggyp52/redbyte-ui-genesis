# Desktop Packaging

This guide summarizes the considerations for shipping the RedByte OS (Vite + React) desktop shell through either **Tauri** or **Electron**. It focuses on integrating the existing `npm run build` artifact, wiring native APIs for file/project IO, and keeping the security posture consistent across both stacks.

## Common prerequisites
- Use the Vite production build as the renderer bundle (`npm run build`), ensuring environment variables such as `VITE_*` values are injected at build time.
- Keep `PUBLIC_URL`/`base` aligned with the production host path in `vite.config.ts` so that asset lookups resolve when packaged.
- Enforce CSP-equivalent policies in the renderer: disable `eval`, restrict remote origins, and gate filesystem/network access behind explicit IPC commands.

## Tauri path
- **Dev setup:** Install the Rust toolchain (stable) and `tauri-cli`. Run `npm install`, then `npm run build` to produce `dist/` for the Tauri bundler to consume.
- **Project wiring:**
  - Point `tauri.conf.json > build > distDir` at `dist/` and `devPath` at `http://localhost:5173` for dev preview.
  - Expose commands for project import/export (wrapping the virtual filesystem) via Rust-side `tauri::command` functions; keep them granular (read/write, directory open dialog, OS notifications).
  - Keep the allowlist strict (`tauri.conf.json > tauri > allowlist`) and disable the shell opener unless explicitly needed.
- **Build and signing:** Use `tauri build` per target OS. For macOS notarization and Windows signing, set `bundle > macOS > signingIdentity` and `bundle > windows > certificateThumbprint`.
- **Updates and logs:** Prefer Tauri's updater for delta builds; route Rust logs to `tauri::api::log` and render a small diagnostics surface in the Notification Center window.

## Electron path
- **Dev setup:** Add `electron` + `electron-builder` (or Forge) as dev deps. Keep the Vite dev server for renderer HMR; start Electron with a preload that loads `http://localhost:5173` in dev and `dist/index.html` in prod.
- **Main process:**
  - Create a minimal `main.ts` that opens a single BrowserWindow sized like the desktop shell, sets `contextIsolation: true`, `sandbox: true`, and disables `nodeIntegration`.
  - Use a `preload.ts` to expose a typed, narrow IPC bridge (project load/save, window metrics, OS dialogs). Reject arbitrary channel names and validate payload shapes.
- **Packaging:** Configure `electron-builder` targets (`dmg`, `msi`/`nsis`, `AppImage`) and point `files`/`extraResources` at `dist/` plus any static assets in `public/`.
- **Auto-update:** Wire `autoUpdater` with a private feed; surface progress via desktop notifications. Keep fallbacks for offline installs (zip/tarball plus manual checksums).

## Choosing between Tauri and Electron
- Pick **Tauri** when binary size, sandboxing, and OS-native APIs are top priorities. It reuses Rust for native hooks and keeps memory footprint low.
- Pick **Electron** when you need mature ecosystem support for deep OS integrations, flexible window management, or when existing Electron tooling is already in use.
- Keep the renderer code identical across both by isolating native calls behind a platform service (`window.desktopBridge`) so components stay framework-agnostic.
