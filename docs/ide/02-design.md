---
doc_status: current
last_validated: 2026-04-21
owner: Connor Angiel
used_by_claude: true
role: Design surface spec
---

# Design Mode Spec

Status: Surface reconciliation v2
Mode ID: `design`

## Purpose

Build deterministic circuit graphs in a canvas-first workspace that stays honest about replay, verify-linked context, and authoring readiness.

## Primary Actions

1. Add and wire logic on the canvas.
2. Inspect selected or verify-linked elements without leaving the workspace.
3. Move to Verify when the circuit is stable enough to prove.

## Workspace Structure

1. Workbench header
- `ide-design-workspace-header` is the only persistent top owner.
- It carries the surface identity, the current workspace mode (`Canvas`, `Code`, `Split`, replay-linked variants), and the existing `Open Verify` / `Project` actions.
- The old standalone Design command strip is retired.

2. Left library
- Search and the core build categories stay first.
- Default palette order is `Logic -> Sequential -> IO -> Reusable -> Board`.
- `Board` and `Quick Inputs` are secondary helpers and start collapsed.
- In code and split modes the library collapses to an overlay rail by default so it does not reserve workspace width while idle.

3. Center workspace
- The canvas is the primary region and should win the page.
- The tools row stays attached to the workbench header; expanded tool options open as a compact popup instead of adding another horizontal band.
- The compact authoring card is the readiness owner for design issues.
- The simulation strip is contextual and appears only when replay, stale replay, verify-linked focus, active simulation, or another real simulation story exists.

4. Right inspector
- Owns selection, focused-asset, mapping, and signal context.
- Idle fallback is the calm `Canvas ready` state, not a large empty coaching card.
- In code and split modes the inspector also defaults to a collapsed overlay rail until the student asks for it or context makes it relevant.

## Empty / Idle State

- Blank-state teaching stays inside the canvas region.
- The floating shortcut strip no longer exists.
- Idle rails should feel secondary, not like co-equal dashboard bands.

## Error / Status Rules

Use non-blocking callouts and the compact authoring owner for design truth:

1. Invalid wire target.
2. Floating outputs.
3. Missing required IO nodes.
4. Replay invalidated after a circuit edit during replay.

## Data Contract (RBProject)

Reads:

1. `circuit`
2. `layout`
3. `submodules`

Writes (guarded):

1. `circuit`
2. `layout`
3. `submodules`
