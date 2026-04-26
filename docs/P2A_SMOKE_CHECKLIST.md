> 📋 **HISTORICAL QA RECORD — OS ERA.** This is a smoke test checklist from an earlier release cycle. It is not current guidance. See `docs/release/` for current certification evidence.

# P2A Smoke Checklist - Deterministic Simulation Core

## Last Validated

- Date: 2026-02-05
- Commit: 323c7fd05151d6b20abac48b9775a9fa93c024a5 (worktree dirty)
- Result: PASS

## Scripted Gates (required)

Run from repo root:

1. Build
   - `pnpm -r build`

2. Tick repeatability gate
   - `pnpm -s sim:repeatability-gate`

3. Combinational loop detection gate
   - `pnpm -s sim:loop-detection-gate`

4. Probe stability gate
   - `pnpm -s sim:probe-stability-gate`

## UI Sanity Pass (optional)

1. Open Logic Playground
2. Load a small circuit, run simulation, and verify outputs are stable across repeated runs
3. Create a simple combinational feedback loop (e.g., NOT feedback) and confirm the UI shows a clear warning instead of hanging
4. Attach a probe/oscilloscope to a net and confirm samples update while simulation runs

## Revalidate When...

Re-run this checklist when changing any of:

- `packages/rb-logic-core/src/CircuitEngine.*` or `packages/rb-logic-core/src/TickEngine.*`
- node evaluation / propagation logic
- probe sampling / instrument buffering
