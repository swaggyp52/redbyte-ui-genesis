# P2B Smoke Checklist - No Data Loss (Autosave + Undo/Redo)

## Last Validated

- Date: 2026-02-05
- Commit: d636da8561c24c74dd469f0989c9ee7f14757599 (worktree dirty)
- Result: PASS

## Scripted Gates (required)

Run from repo root:

1. Build
   - `pnpm -r build`

2. Autosave recovery gate (RBProject codec, canonical key)
   - `pnpm -s proj:autosave-recovery-gate`

3. Undo/redo gate (labReducer core circuit edits reversible)
   - `pnpm -s proj:undo-redo-gate`

## UI Sanity Pass (optional)

1. Open Virtual Lab (student-facing lab surface)
2. Make a small edit (add gate + wire) and wait for autosave status/toast
3. Hard refresh and confirm the restore prompt appears; restore and verify circuit state matches
4. Perform a small edit sequence and verify Undo/Redo do not corrupt wires or leave dangling connections

## Revalidate When...

Re-run this checklist when changing any of:

- `packages/rb-apps/src/utils/rbprojAutosave.*` (keys/records/hash semantics)
- `packages/rb-apps/src/utils/snapshotSystem.*` (workspace recovery contract)
- `packages/rb-apps/src/utils/labProjectRbprojAdapter.*` (LabProject <-> RBProject mapping)
- `packages/rb-lab-engine/src/reducer/labReducer.*` (core circuit mutations)
- `packages/rb-lab-engine/src/stores/unifiedProjectStore.*` (project lifecycle/dirty tracking)
