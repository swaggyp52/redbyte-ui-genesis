> 📋 **HISTORICAL QA RECORD — OS ERA.** This is a smoke test checklist from an earlier release cycle. It is not current guidance. See `docs/release/` for current certification evidence.

# P2C Smoke Checklist - SIM ↔ HW Live Mode Robustness (Bridge Dry-run + Fallback)

## Last Validated

- Date: 2026-02-05
- Commit: (pending)
- Result: (pending)

## Scripted Gates (required)

Run from repo root:

1. Build
   - `pnpm -r build`

2. Bridge dry-run gate (no external bridge/hardware required)
   - `pnpm -s bridge:dryrun-gate`

3. HW mode fallback gate (disconnect → SIM contract)
   - `pnpm -s hw:mode-fallback-gate`

## UI Sanity Pass (optional, recommended)

This verifies the student-facing Virtual Lab can exercise hardware mode without real hardware.

1. Start dev server with dry-run enabled:
   - PowerShell: `$env:VITE_RB_BRIDGE_DRYRUN='1'; pnpm -s dev`
2. Open **Virtual Lab**.
3. Open the Board panel and click **CONNECT**.
4. Confirm state shows **CONNECTED** (dry-run) and I/O snapshots update (SW toggles; LED mirrors).
5. Check **I have flashed the board** to enter HW live mode.
6. (Advanced) Simulate a disconnect and confirm fallback:
   - In DevTools Console, call the hardware store disconnect action (if available) and confirm the app returns to SIM and shows a toast:
     - Expected toast: `Bridge disconnected — returned to Simulation.`

## Revalidate When...

Re-run this checklist when changing any of:

- `packages/rb-apps/src/services/hardwareClient.*` (bridge contract, dry-run, offline messaging)
- `packages/rb-apps/src/stores/hardwareStore.*` (connection state mapping)
- `packages/rb-apps/src/apps/ECELabApp.*` (executionSource handling + fallback behavior)
- `docs/ERROR_MESSAGE_MATRIX.md` (student-facing offline/disconnect copy)
