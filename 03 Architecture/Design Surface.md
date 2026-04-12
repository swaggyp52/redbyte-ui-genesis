---
type: architecture
status: active
area: design
updated: 2026-04-12
related:
  - "[[RedByte Engineering Brain]]"
  - "[[Verify Engine]]"
  - "[[ADR-005 Verify Schedule Contract Owns Sequential Clock Authority]]"
  - "[[BUG-014 Design Replay Missed Runtime-Backed Mutations]]"
  - "[[Workspace Routing]]"
  - "[[Note Schema]]"
---

# Design Surface

## Overview

This note documents the first-look hierarchy contract for the IDE Design surface. Its purpose is to keep the canvas primary, while preserving the minimum amount of chrome needed to orient the student, expose core parts access, show authoring state, and reveal simulation context only when it becomes relevant.

## Canonical Shape / Contract

The Design surface is a three-zone layout:

1. left build library / board resource rail
2. center canvas workspace
3. right inspector / simulation support rail

For the left dock, the contract is:

- search remains visible at all times
- Logic Gates, Sequential & Timing, and Inputs & Outputs remain directly visible
- Board Resources and Live Inputs are secondary sections and start collapsed by default
- board search matches must auto-reveal Board Resources so hardware inventory remains discoverable

For the center workspace, the top-of-canvas chrome contract is:

- one working toolbar row
- one compact authoring/status row
- quieter telemetry inside the canvas overlay instead of loud duplication above the canvas

For blank Design first look, the guidance contract is:

- the in-canvas blank-state card is the one primary onboarding element
- Design-mode onboarding overlay must not compete with blank Design
- duplicate idle-inspector coaching should stay hidden while the blank-state card is visible
- shortcut help should stay hidden until the student has moved past the blank-state card
- the pipeline strip should not issue a redundant `Open Design` message while already on blank Design

For the bottom edge, the quiet-state contract is:

- Design should not reserve a workbench console row when there are no compiler diagnostics to inspect
- compiler warnings/errors may reclaim the console when actionable diagnostics exist
- the global footer in Design should carry only the quiet readiness signal, not repeat mode/hash metadata already visible elsewhere

For the idle inspector / simulation contract, the Design surface must:

- keep `Live Simulation` directly reachable on first arrival even when no node is selected
- avoid burying the live input/output rows behind a closed idle-state disclosure
- treat sequential selections as first-class authoring context instead of generic parts
- treat multi-node selections as a continued-editing state, not a dead-end summary card
- make the grouped-editing loop explicit after box-select:
  - marquee selection must capture nodes by standard body-bounds overlap, not only by node origin
  - additive marquee (`Shift` / `Ctrl` / `Cmd`) must extend the existing group instead of resetting it
  - Arrow keys nudge the selected group by one movement step
  - `Shift + Arrow` performs a larger coarse move
  - the multi-select inspector exposes the first grouped-arrange actions directly in the Design workflow:
    - `Align left`
    - `Align top`
    - `Distribute horizontally`
  - grouped arrange actions must preserve the current selection and move only the selected nodes
  - grouped horizontal distribution must:
    - use the current left-to-right order
    - keep the leftmost and rightmost selected nodes anchored
    - redistribute only the intermediate selected nodes
    - preserve existing `y` positions
  - inspector copy must advertise grouped movement and duplication instead of generic bulk wording
- show timing-aware inspector semantics for sequential selections:
  - clocks identify timing-source role and mapped board context when present
  - flip-flops identify clock-driven state behavior and the active control path
  - latches identify enable or set/reset control semantics instead of clock-edge wording
- expose one direct sequential next step when applicable:
  - `Trace control path` for state-holding elements
  - `Go to Map Pins` for unmapped timing sources
- keep the existing generic identity/property/state path for non-sequential nodes

For the Verify replay / inspection contract, the Design surface must:

- treat the selected Verify replay sample as the current display authority while replay is active
- revoke replay authority immediately on any real circuit mutation, including runtime-backed palette placement, starter insertion, undo, and redo
- preserve stale replay only as breadcrumb context (case/tick, linked Verify signal, timing hint) once the circuit changes; live Design state retakes display authority immediately
- repeat the replay sample meaning in the simulation strip itself during replay: authored case/tick plus the sampling hint must stay visible there, not only in the debug banner
- render direct replay case selection in that same simulation strip when the parent provides case-index control; banner-only prev/next is fallback behavior for replay paths that do not provide direct scrubber selection
- resolve sequential clock narration from contract-backed timing guidance plus canonical IO match keys when that guidance exists; live Design copy must not guess the authoritative clock from `/clk|clock/i` label heuristics
- keep replay explanation inside the existing `Signal / State` section with one compact `Why now` row when replay evidence exists for the selected node, selected wire, or Verify-linked signal
- summarize replay causation using previous/current sampled values, direct upstream driver labels when available, and the next inspect target when one exists

The top stack must not reintroduce a separate title/header band above the working toolbar. Zoom telemetry may satisfy test and gate contracts, but it belongs in the quieter overlay indicator instead of the louder authoring row. In split layouts that do not render the dedicated simulation strip, tick/mode context must remain visible in the compact status row.

The `SurfaceCommandStrip` in Design is now a compact authority bar, not a card. Description text is hidden; label + title + meta chips render in one horizontal row at 7px 14px padding. The replay scrubber renders as a first-class teal-bordered transport card (6px track height, accent-color) when replay is active; when no replay is active the sim story strip collapses to an 18px ghost line.

## Rules

- The first look must yield attention to the canvas before instrumentation.
- The first look of the left dock must yield attention to search and core parts before hardware inventory or live state.
- Blank Design must teach with one primary CTA, not multiple simultaneous first-step lessons.
- Do not duplicate the same state across a title band, status row, and canvas overlay.
- Do not duplicate the same blank-state instruction across the onboarding modal, canvas, inspector, shortcut help, and pipeline strip.
- Do not reserve bottom-edge chrome for an empty console in quiet Design states.
- Do not repeat shell metadata in the Design footer when the same truth is already visible in the top shell.
- Node/wire counters are secondary telemetry and should not dominate the top authoring row.
- Board Resources and Live Inputs should remain available but default-collapsed unless the student explicitly opens them or search needs the board inventory visible.
- Live Simulation is collapsible (shows "Hide" in its toggle-state span, not "Live"); it defaults to open so it remains discoverable on first load. Do not pin it permanently open with `disableCollapse`.
- Split mode may compress simulation chrome, but it must still preserve essential tick/mode context when the dedicated simulation strip is absent.
- Empty-state guidance belongs in the canvas region, not in a heavyweight top header or a competing blank-state modal.
- Sequential authoring must sound intentional in the inspector; do not describe latches with flip-flop clock-edge language or reduce clocks to generic node state.
- Multi-node selection should stay action-focused; live-signal detail belongs to single-node or single-wire inspection.
- Grouped movement must not depend on mouse drag alone once a student has already selected the cluster.
- Box-select must feel trustworthy in dense circuits; partial overlap with the standard node body must count as selection.
- The Design inspector must not expose developer internals to students: no raw IR diagnostic codes (e.g. `IR006`), no "Compiler diagnostics" section label, no pipeline-layer staleness rows ("Dirty since verify", "Dirty since export") in the default or advanced views.
- Multi-node selection must not show a "Single-object state only" dead-end callout; return nothing and let the multi-select arrange actions speak for themselves.
- Signal Probe in Design must not render per-tick waveform/history buttons; those are a Verify-surface idiom and do not belong in the authoring inspector.
- Replay evidence is authoritative only until the circuit mutates; stale replay must never continue driving Design state after a real edit.
- Replay strip copy must remain case-aware during replay; do not regress to a generic `Tick N` strip that forces students to infer case/timing meaning from the debug banner alone.
- Direct replay scrubbing belongs in the simulation strip when parent-owned case selection exists; do not split that primary control into a separate replay panel or hide it in the banner.
- Design must not invent a second sequential clock identity from regex or presentation labels when Verify timing guidance is available.
- Replay explanation must stay compact and student-facing: one `Why now` row in `Signal / State`, not a separate replay-only panel or raw internal-key dump.
- Generic shell maximize/focus chrome should not return without a concrete Design workflow contract; replay clarity belongs in the existing strip, banner, and inspector surfaces.
- When a node is selected and the simulation is running, the inspector must show a **Driver Context panel** with the name and current HIGH/LOW value of each node driving the selected node's input ports. The panel is hidden when no simulation values exist (`liveSignals.size === 0`). Test IDs: `ide-design-input-drivers`, `ide-design-driver-row-{port}`.
- When an INPUT or Switch node is selected and `onRuntimeSimSetInput` is wired, the inspector must show an **Input Control group** with a toggle button reflecting the current HIGH/LOW state. Clicking it calls `onRuntimeSimSetInput` with the flipped value. Test IDs: `ide-design-inspector-input-control`, `ide-design-inspector-input-toggle`. The control does not render when the prop is absent.
- When the simulation is running and a node is selected with no existing trace, the surface must automatically trigger a fanout trace highlight. The auto-trace must not override a manually-set trace (guard: `!traceStateRef.current`). The trace clears automatically when selection is lost. Auto-trace must NOT fire when the simulation is not running.
- Wire selection must show a **Connection summary row** (`testId="ide-design-wire-connection"`) as the first row in the wire inspector, formatted as `{sourceLabel} → {targetLabel}`. It appears before the Signal / Current / Previous / Transition rows.
- Logic gates within the same port-arity family are **swappable without dropping connections**. The inspector shows a **Swap type** action group for any node in `GATE_SWAP_FAMILIES`: 2-input family (AND/NAND/NOR/OR/XOR/XNOR) and 3-input family (AND3/NAND3/NOR3/OR3/XOR3). Clicking a chip calls `updateNode(id, { type: newType })` — all connections are preserved because port names (`a`, `b`, `c`, `out`) are identical within each family. Non-gate nodes see no swap group. Test IDs: `ide-design-swap-group`, `ide-design-swap-{typename.toLowerCase()}`.
- The **Signal/State inspector section** must show only the 4 signal timing rows: Current, Previous, Transition, Last transition, and Trace state. The following rows are BANNED from Signal/State: "Driver / Source" (duplicated by the driver context panel added in B-9), "Fan-in / Fan-out" (raw graph metric with no student value), "Board mapping" (duplicated in identity card), "Probe state" (not actionable in this section). IR diagnostic codes must not appear in any student-facing inspector section, including the Advanced Details `Node diagnostics` sub-list.

## Consumption Sites

- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- `packages/rb-logic-view/src/LogicCanvas.tsx`
- `packages/rb-logic-view/src/useCanvasInput.ts`
- `packages/rb-apps/src/apps/ide/surfaces/DesignWorkspaceFrame.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`
- `packages/rb-apps/src/apps/IdeApp.tsx`
- `packages/rb-apps/src/apps/ide/components/OnboardingOverlay.tsx`
- `packages/rb-apps/src/apps/ide/components/PipelineStrip.tsx`
- `packages/rb-apps/src/apps/ide/components/IdeStatusBar.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/IdeStatusBar.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/OnboardingOverlay.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/pipelineStrip.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.connectionAffordance.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`
- `packages/rb-logic-view/src/__tests__/canvas-input-controller.test.ts`

## Keyboard Command Ownership (Phase B, 2026-04-06)

Keyboard commands that affect the editing graph are split across two owners:

1. **CanvasHost / LogicCanvas** — canvas-spatial operations (pan, zoom, wire mode, snap toggle, fit-to-view). These fire only when the canvas is "active" (has received recent pointer input).
2. **DesignSurface global window handler** — editing commands that must work across the full surface (canvas + inspector + palette). These fire unconditionally.

The global handler currently owns: G (grid toggle), Ctrl+C/V/D/A/X, Shift+F (fit-to-selection), Arrow keys for selected-node nudging, a/o/n/x (gate hotkeys), Ctrl+Z/Y (undo/redo), Delete/Backspace (delete selection), Escape (clear selection).

**Deduplication strategy:**

- For Ctrl+Z/Y: CanvasHost calls `e.preventDefault()` when canvas is active. DesignSurface checks `e.defaultPrevented` to skip (preventing double-undo). Registration order: CanvasHost registers first (deepest child), DesignSurface last (parent), so CanvasHost fires first.
- For Delete/Backspace: CanvasHost does NOT call `e.preventDefault()`. DesignSurface reads `useLogicViewStore.getState().selection` (live, not closure-stale) to check whether canvas already cleared the selection before acting.
- For Escape: idempotent `clearSelection()` — safe to double-fire.

## Open Questions / Stubs

- The current contract covers first-look and continued-editing hierarchy. It does not yet define the full long-term relationship between bottom console demotion and shared workflow chrome across dense sequential circuits.
- Future Design interaction work should extend this note instead of reintroducing header-level chrome ad hoc.
- One more simple grouped tidy action remains the next expansion point now that box-select capture, duplicate, delete, nudge, edge alignment, and horizontal distribution are all in the trusted path.
- The replay `Why now` cue currently stops at direct-driver labels plus the next inspect target. If deeper multi-stage causal tracing becomes necessary, it should extend this same row/section contract instead of adding a new replay panel.
- Wire reconnect discoverability — RESOLVED (Phase B Slice 6, 2026-04-06). `hoveredWireId` moved to `useLogicViewStore`; `hoveredWireOverlay` memo in LogicCanvas drives discoverable endpoint hint circles on wire hover without requiring prior selection.
- Wire reconnect visual feedback — RESOLVED (Phase B Slice 7, 2026-04-07). `rewiredWireId` added to `useLogicViewStore` (same pattern as `hoveredWireId`). `isBeingRewired` prop on `WireView` dims the wire group (opacity 0.35) and adds a blue dashed overlay while reconnect is in progress. `circuitForValidation` derived memo excludes the being-replaced wire from `isValidConnection` checks, fixing false duplicate-rejection when reconnecting to the original port. `beginWireReconnect` sets `rewiredWireId`; the cleanup effect and successful commit both clear it.
- Inspector developer-internals leakage — RESOLVED (Phase B Slice 8, 2026-04-07). Five categories of verify/pipeline internals removed from the student-facing inspector: raw IR diagnostic codes, "Compiler diagnostics" section label, "Dirty since verify/export" KV rows, `disableCollapse` pin on Live Simulation (now shows "Hide"), "Single-object state only" dead-end callout on multi-select, and per-tick waveform history buttons in Signal Probe.
- Signal/State inspector redundancy + IR codes in Advanced Details — RESOLVED (Phase B-10, 2026-04-07). Removed "Driver/Source", "Fan-in/Fan-out", "Board mapping", and "Probe state" rows from Signal/State (now kept: Current, Previous, Transition, Last transition, Trace state). Removed `{diagnostic.code}` span from Advanced Details Node diagnostics sub-list — completing the B-8 cleanup.
