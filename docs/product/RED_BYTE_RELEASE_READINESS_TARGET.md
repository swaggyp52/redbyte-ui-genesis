---
doc_status: current
last_validated: 2026-06-18
owner: Connor Angiel
used_by_claude: true
role: release-readiness visual/workbench target for RedByte V1
---

# RedByte Release Readiness Target

This doc captures the stricter browser-readiness target used for the 2026-06-18 release-readiness reconstruction slice. It is a current product target, not hardware proof.

## Standard

RedByte should read as a serious Basys3-first digital logic workbench, not a page of explanatory cards.

At `1366x768` and `1440x900`:

- the primary work object owns the useful viewport
- side tools behave like proportional tool windows
- visible controls are not horizontally cropped
- board visuals are not covered by resource catalogs or explanatory overlays
- active tasks show the tool/editor/evidence object before teaching copy
- screenshots and Playwright gates remain browser/E0 proof only

## Closed In This Slice

The 2026-06-18 release-readiness reconstruction closed two live defects:

1. Design Library was too narrow for normal board-resource controls.
   - Before: `176px` at `1366x768` and `184px` at `1440x900`, with visible controls extending outside the dock.
   - After: `264px` at `1366x768` and `280px` at `1440x900`, with the canvas still usable.

2. Hardware Map Pins placed resource summary cards over the Basys3 board.
   - Before: the summary strip overlapped the board SVG.
   - After: the summary strip sits above the board/table task plane and remains interactive.

## Gates

This target is protected by:

- `ide:gate:design-library-not-cropped`
- `ide:gate:design-tool-window-coexistence`
- `ide:gate:hardware-board-unblocked`
- `ide:gate:hardware-resource-catalog-not-obstructing`
- `ide:gate:release-readiness-visual-contract`
- `ide:gate:no-cropped-controls-regression`

These gates are wired into `classroom:gate` and `verify:gates:classroom`.

## Project / Import / Export Reconstruction Target

The 2026-06-18 outer workflow package extends the same standard to the outer workflow surfaces and closes locally:

1. **Project must behave like a command center.**
   - A loaded project should immediately show the current required action, contextual commands for Design / Verify / Map Pins / Export, secondary starts, and compact evidence.
   - Metrics should support decisions; they should not become the main page structure.

2. **Import must behave like a guided recovery wizard.**
   - Source selection, detected content, repair/mapping, replacement review, and apply confirmation should be staged as one workflow.
   - The no-overwrite boundary remains explicit, but long recovery prose should not dominate the useful viewport.

3. **Export must behave like a package inspector.**
   - The generated file list and selected artifact preview should be the default work object when files exist.
   - Build, download, copy, and preview actions should stay direct; Vivado guidance should be concise and state-tied.

New reconstruction gates should reject static/card-heavy first-viewport layouts in addition to preserving existing reachability, reload, and no-overflow guarantees.

Closed gates:

- `ide:gate:project-loaded-command-surface`
- `ide:gate:import-guided-recovery-wizard`
- `ide:gate:export-package-inspector`
- `ide:gate:outer-workflow-action-density`
- `ide:gate:card-chrome-regression`

## Verify Signals Dock Readability Target

The same visual-readiness standard applies to Verify support tools. The open Signals dock must be readable when a student asks for it, while the collapsed rail must remain compact when the workspace needs the room.

Closed by `ide:gate:verify-signals-dock-not-clipped`:

- Before: open Verify Signals dock measured `136px` at `1366x768` and `144px` at `1440x900`, visibly cropping the title/count/action region.
- After: open Verify Signals dock has a readable `224px` minimum slot, no horizontal clipping, no root overflow, and the main Verify workspace remains usable.
- Regression coverage: `ide:gate:side-dock-affordance` still proves collapsed Verify Signals does not widen back into a bulky rail.

## Release Solidification Sprint Target

The 2026-06-18 full-browser audit at `805b47a` showed the remaining release blockers are no longer simple missing buttons. The next target is to make the most important active workbenches feel like tools rather than static panels.

Status: Closed locally by `ide:gate:release-solidification-v1` and the 2026-06-18 browser proof under `.redbyte/product-immersion/release-solidification/2026-06-18/`.

Selected package:

- **Verify final usability/depth:** when Signals is open, Verify must not create an internal horizontal scroll trap, and PASS/FAIL evidence must keep a clear repair/evidence flow without changing pass/fail truth.
- **Export package inspector depth:** the package inspector must expose a compact handoff checklist that separates E0 package readiness from external Vivado/Basys3 proof.
- **Import guided wizard depth:** selected-source recovery must use the available workspace for editor plus review/checklist affordances instead of a narrow utility editor.

New gates should reject:

- internal workbench overflow in normal `1366x768` and `1440x900` use
- missing or hidden handoff checklist state in Export
- source-selected Import states without a visible review/workflow checklist
- browser errors, workspace error boundaries, root overflow, or stale build hashes

Closed proof:

- Verify before evidence showed internal horizontal overflow with the Signals dock open; after evidence keeps open Signals readable while preserving usable stimulus and waveform lanes.
- Export before evidence had package preview depth but no compact readiness checklist; after evidence shows Package, Verify / Compare, Pin Mapping, and E0 Boundary in the package inspector first viewport.
- Import before evidence underused the active workbench width; after evidence shows source editor plus source-review lane and reload continuity.

## Non-Claims

This target does not prove Vivado build, bitstream programming, or physical Basys3 behavior. It also does not change simulation semantics, Verify semantics, pin mapping semantics, generated artifacts, project format, or goldens.
