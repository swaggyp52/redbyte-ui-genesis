---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Design workspace contract
---

# RedByte Design Workspace V2

Design V2 is a canvas-first circuit-authoring workspace. It must not default to a generic right rail or hide the authoring controls behind passive cards.

## Current Contract

- The left side is a fixed parts palette, not a collapsible side rail.
- The primary canvas owns the remaining width at `1366x768` and `1440x900`.
- Clean design health does not reserve a prominent status band above the canvas.
- A compact context property bar sits directly under the toolbar.
- Canvas context exposes direct next actions: add boundary I/O, add AND, fit, and open Verify.
- Node or multi-node selection changes the context bar to selection actions: rename when applicable, duplicate, delete.
- Active canvas `Ctrl+A` selects all nodes through the canvas interaction authority.
- The old Design inspector remains available for real selection/debug contexts, but it is no longer default-open just because live I/O exists.

## State Authority

Design V2 does not introduce a new project truth source.

| Concern | Authority |
|---|---|
| Circuit graph | runtime circuit in `projectRuntime.ts`, mirrored through `circuitStore` for editor mutations |
| Canvas camera, zoom, pan | `useLogicViewStore.ts` |
| Selection | `useLogicViewStore.ts` |
| Context bar state | derived from current Design selection and artifact/canvas mode |
| Verify/export trust invalidation | existing runtime/project workflow authority |

## Proof

- `ide:gate:design-workspace-v2`
- affected Design gates such as `ide:gate:design-library-not-cropped`, `ide:gate:design-tool-window-coexistence`, and `ide:gate:design-canvas-direct-workbench`
- screenshots under `.redbyte/product-immersion/product-trust-reset-v2/phase-4/`

## Non-Goals

This contract does not change simulation behavior, Verify semantics, project format, generated artifacts, mapping truth, goldens, Vivado proof, or Basys3 proof.

## Attribution

Connor Angiel
