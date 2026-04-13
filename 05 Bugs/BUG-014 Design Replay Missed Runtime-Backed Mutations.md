---
type: bug
status: fixed
area: verify
priority: high
source: manual-debug
updated: 2026-04-11
related:
  - "[[Verify Engine]]"
  - "[[Design Surface]]"
---

# BUG-014 Design Replay Missed Runtime-Backed Mutations

## Summary

During active Verify replay, some Design edits made through runtime-backed paths left the surface frozen on stale Verify evidence instead of demoting replay to stale and returning the canvas to live Design state.

## Root Cause

The replay-invalidation contract depended on `emitCircuitMutation()`, but several runtime-backed mutation paths bypassed it. `commitPendingPlacement(...)`, `addIoPins(...)`, `addAndGateStarter(...)`, `handleUndo(...)`, and `handleRedo(...)` changed the design through runtime callbacks without routing the result back through the replay-authority invalidation seam.

## System Truth

Any real circuit mutation during active Verify replay, including runtime-backed placement, starter insertion, undo, and redo, must immediately revoke replay authority. Stale Verify context may remain as breadcrumb copy only; it cannot keep driving Design state after the circuit changes.

## Fix

- Added a shared runtime-mutation wrapper in `DesignSurface.tsx` so runtime-backed placement and starter actions call `emitCircuitMutation()` after the mutation succeeds.
- Routed `handleUndo(...)` and `handleRedo(...)` through the same invalidation seam.
- Added focused regressions for runtime-backed placement and undo during replay, then revalidated the sparse-case and causation-cue flows in the same replay suite.

## Links

- [[Verify Engine]]
- [[Design Surface]]