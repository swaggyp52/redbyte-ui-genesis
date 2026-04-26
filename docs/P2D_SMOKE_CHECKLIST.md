> 📋 **HISTORICAL QA RECORD — OS ERA.** This is a smoke test checklist from an earlier release cycle. It is not current guidance. See `docs/release/` for current certification evidence.

# P2D Smoke Checklist - Wire Tracing / Net Highlight Consistency (2D-first)

## Last Validated

- Date: 2026-02-05
- Commit: (pending)
- Result: (pending)

## Scripted Gates (required)

Run from repo root:

1. Build
   - `pnpm -r build`

2. Net highlight resolution gate (deterministic net id mapping)
   - `pnpm -s net:highlight-resolution-gate`

## UI Sanity Pass (optional, recommended)

1. Open **Logic Playground** (or **Virtual Lab** 2D).
2. Build a small fanout net (one output driving two inputs).
3. Hover a wire segment:
   - Expected: the **entire net** highlights (all segments in that connected net).
4. Click a wire segment to select it:
   - Expected: selection remains blue, and the **rest of the net** stays highlighted (amber).
5. Shift-click another wire in a different net:
   - Expected: both nets highlight independently.

## 3D Reflection (optional, recommended)

If the 3D view is open (split view includes **3D View**):

1. Hover a wire segment in 2D.
   - Expected: the corresponding 3D wire segments glow/highlight (visual-only).
2. Click a wire segment in 2D to select.
   - Expected: the 3D highlight persists while selected and clears when selection clears.

## Revalidate When...

Re-run this checklist when changing any of:

- `packages/rb-logic-view/src/tools/netHighlight.*` (net id policy)
- `packages/rb-logic-view/src/LogicCanvas.*` (wire hover/select rendering)
- `packages/rb-logic-view/src/components/WireView.*` (wire highlight styles/interaction handlers)
- `packages/rb-apps/src/components/SplitViewLayout.*` (2D->3D highlight plumbing)
- `packages/rb-logic-3d/src/Logic3DScene.*` / `packages/rb-logic-3d/src/components/Rb3DSceneCircuit.*` (3D wire highlighting)
