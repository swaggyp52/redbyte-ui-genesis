> 📋 **HISTORICAL QA RECORD — OS ERA.** This is a smoke test checklist from an earlier release cycle. It is not current guidance. See `docs/release/` for current certification evidence.

# Phase 3A-3 Smoke Checklist (Performance Mode)

## Last Validated
- Date: (pending)
- Commit: (pending)
- Browser: (pending)
- Result: PASS / FAIL

## Goals
- Performance Mode is a global OS setting (persisted) and can be toggled from Settings.
- When enabled, Performance Mode reduces expensive UI work (motion reduction + throttled instruments).
- 3D view is disabled in Performance Mode (no heavy Three.js stack loaded by accident).

## Scripted Gates (preferred)
- `pnpm -s os:performance-mode-gate`
- `pnpm -s os:instrument-hz-gate`
- `pnpm -r build`

## Manual Checks (optional)
1. Open Settings -> Motion.
2. Toggle **Performance Mode** on.
3. Confirm:
   - Shell sets `data-rb-perf="on"`.
   - Shell sets `data-rb-motion="reduced"` (effective reduced motion).
   - Attempting to open the 3D view shows "3D view disabled in Performance Mode."
   - Oscilloscope polling is throttled (no 60Hz updates while Performance Mode is enabled).
4. Toggle **Performance Mode** off and reload the OS.
5. Confirm the setting persists (toggle remains off after reload).

## Revalidate When...
Re-run this checklist when changing any of:
- `packages/rb-utils/src/settingsStore.*`
- `packages/rb-shell/src/Shell.*`
- `packages/rb-apps/src/apps/SettingsApp.*`
- `packages/rb-apps/src/components/SplitViewLayout.*`
- `packages/rb-apps/src/components/OscilloscopeView.*`
