# P1D Smoke Checklist — End-to-End Lab Flow

## Last Validated

- Date: 2026-02-05
- Commit: 323c7fd05151d6b20abac48b9775a9fa93c024a5
- Result: PASS

Gate intent: validate the unified lab surface (2D canonical + optional 3D read-only) is classroom-safe end-to-end:

**ingest → run → export/import → verify**

This gate is intentionally **script-first** (fast, repeatable) with an optional short UI sanity pass.

## Scripted Gate (required)

Run from repo root:

1. Build
   - `pnpm -r build`

2. Student export fixture structure (export pipeline)
   - `pnpm -s ops:student-export-fixture-test`

3. Ingest + diff contract gate (API end-to-end)
   - `pnpm -s ops:diff-gate`

4. Evidence determinism gate (capsule format is stable)
   - `pnpm -s rbx:evidence-determinism-gate`

5. Project roundtrip gate (export/import codec stability)
   - `pnpm -s rbproj:roundtrip-gate`

**PASS criteria:** all commands exit 0.

## UI Sanity Pass (optional, ~2 minutes)

1. Open OS and Launcher
2. Open **Virtual Lab** (app id `ece-lab`)
3. Confirm:
   - 2D surface is editable
   - 3D view (if enabled) is view-only and offers **Edit in 2D**
   - minimizing the 3D window pauses rendering (CPU drops; resumes on restore)

## Recording a PASS

In `AI_STATE.md`, add a short validation entry with:

- Date
- Commands run (copy/paste list)
- PASS/FAIL

## Revalidate When...

Re-run this checklist when making changes to any of:

- Lab app IDs/manifests (especially `ece-lab` / `virtual-lab`)
- 3D lazy-load boundaries (`rb-logic-3d` / `three` / `@react-three` imports)
- Export/import/evidence codepaths (project codec, capsule/evidence writers)

CI note: a non-blocking scheduled run is defined in `.github/workflows/p1d-smoke-nonblocking.yml`.
