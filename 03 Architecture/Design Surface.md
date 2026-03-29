---
type: architecture
status: active
area: design
updated: 2026-03-29
related:
  - "[[RedByte Engineering Brain]]"
  - "[[Workspace Routing]]"
  - "[[Note Schema]]"
---

# Design Surface

## Overview

This note documents the first-look hierarchy contract for the IDE Design surface. Its purpose is to keep the canvas primary, while preserving the minimum amount of chrome needed to orient the student, show authoring state, and expose simulation context when it becomes relevant.

## Canonical Shape / Contract

The Design surface is a three-zone layout:

1. left build library / board resource rail
2. center canvas workspace
3. right inspector / simulation support rail

For the center workspace, the top-of-canvas chrome contract is:

- one working toolbar row
- one compact authoring/status row
- quieter telemetry inside the canvas overlay instead of loud duplication above the canvas

The top stack must not reintroduce a separate title/header band above the working toolbar. Zoom telemetry may satisfy test and gate contracts, but it belongs in the quieter overlay indicator instead of the louder authoring row. In split layouts that do not render the dedicated simulation strip, tick/mode context must remain visible in the compact status row.

## Rules

- The first look must yield attention to the canvas before instrumentation.
- Do not duplicate the same state across a title band, status row, and canvas overlay.
- Node/wire counters are secondary telemetry and should not dominate the top authoring row.
- Split mode may compress simulation chrome, but it must still preserve essential tick/mode context when the dedicated simulation strip is absent.
- Empty-state guidance belongs in the canvas region, not in a heavyweight top header.

## Consumption Sites

- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/DesignWorkspaceFrame.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

## Open Questions / Stubs

- The current contract covers first-look hierarchy only. It does not yet define the full long-term relationship between canvas overlays, split-mode telemetry, and inspector disclosures for dense sequential circuits.
- Future Design interaction work should extend this note instead of reintroducing header-level chrome ad hoc.