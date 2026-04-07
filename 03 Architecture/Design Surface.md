---
type: architecture
status: active
area: design
updated: 2026-04-07
related:
  - "[[RedByte Engineering Brain]]"
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
  - Arrow keys nudge the selected group by one movement step
  - `Shift + Arrow` performs a larger coarse move
  - inspector copy must advertise grouped movement and duplication instead of generic bulk wording
- show timing-aware inspector semantics for sequential selections:
  - clocks identify timing-source role and mapped board context when present
  - flip-flops identify clock-driven state behavior and the active control path
  - latches identify enable or set/reset control semantics instead of clock-edge wording
- expose one direct sequential next step when applicable:
  - `Trace control path` for state-holding elements
  - `Go to Map Pins` for unmapped timing sources
- keep the existing generic identity/property/state path for non-sequential nodes

The top stack must not reintroduce a separate title/header band above the working toolbar. Zoom telemetry may satisfy test and gate contracts, but it belongs in the quieter overlay indicator instead of the louder authoring row. In split layouts that do not render the dedicated simulation strip, tick/mode context must remain visible in the compact status row.

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
- Live Simulation may be compact, but it should not disappear behind an idle-state collapse when it is the only direct runtime truth in starter-loaded student flows.
- Split mode may compress simulation chrome, but it must still preserve essential tick/mode context when the dedicated simulation strip is absent.
- Empty-state guidance belongs in the canvas region, not in a heavyweight top header or a competing blank-state modal.
- Sequential authoring must sound intentional in the inspector; do not describe latches with flip-flop clock-edge language or reduce clocks to generic node state.
- Multi-node selection should stay action-focused; live-signal detail belongs to single-node or single-wire inspection.
- Grouped movement must not depend on mouse drag alone once a student has already selected the cluster.

## Consumption Sites

- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
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
- Wire reconnect discoverability — RESOLVED (Phase B Slice 6, 2026-04-06). `hoveredWireId` moved to `useLogicViewStore`; `hoveredWireOverlay` memo in LogicCanvas drives discoverable endpoint hint circles on wire hover without requiring prior selection.
- Wire reconnect visual feedback — RESOLVED (Phase B Slice 7, 2026-04-07). `rewiredWireId` added to `useLogicViewStore` (same pattern as `hoveredWireId`). `isBeingRewired` prop on `WireView` dims the wire group (opacity 0.35) and adds a blue dashed overlay while reconnect is in progress. `circuitForValidation` derived memo excludes the being-replaced wire from `isValidConnection` checks, fixing false duplicate-rejection when reconnecting to the original port. `beginWireReconnect` sets `rewiredWireId`; the cleanup effect and successful commit both clear it.
