---
doc_status: current
last_validated: 2026-06-20
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 deterministic workspace layout contract
---

# RedByte Workspace Layout V2

This layout contract applies to Product Trust Reset v2. It supersedes the generic open/close side-rail model for normal student use at supported desktop classroom viewports.

The old `IdeWorkbenchShell` dock model can remain as a temporary implementation bridge and for diagnostics, but V2 student surfaces must be deterministic workspaces.

## Global Shell

- Top bar: product identity, project identity, current surface, save state, Help.
- Normal top bar does not show raw build SHA or internal proof tier.
- Workflow progress is compact and student-language only.
- Help / About / Diagnostics owns build/runtime/proof details.
- The left navigation rail remains route navigation only.
- The bottom status bar is support context only and must not reserve unnecessary work space.

## Shared V2 Primitives

Phase 2 should implement or equivalent:

- `AppFrameV2`
- `ProjectCommandBar`
- `WorkflowProgress`
- `WorkspaceHeader`
- `FixedToolPalette`
- `ContextPropertyBar`
- `TestbenchWorkspace`
- `ResultsWorkspace`
- `MappingWorkspace`
- `ArtifactWorkspace`
- `StepWorkflow`
- `StudentStatus`
- `DiagnosticsPanel`

Phase 2 implementation note: the first branch implementation wires these concepts through the existing shell/components rather than a fully new component library. The real acceptance point is visible surface behavior and `data-workspace-primitive` markers on live workspaces, not unused abstractions.

Phase 4A implementation note: Design and Map Pins now have focused workspace contracts at `docs/architecture/RED_BYTE_DESIGN_WORKSPACE_V2.md` and `docs/architecture/RED_BYTE_MAP_PINS_WORKSPACE_V2.md`. The acceptance point is the live browser behavior guarded by `ide:gate:design-workspace-v2` and `ide:gate:map-pins-workspace-v2`.

## Project

- No side rails.
- Project identity at top.
- One dominant current action.
- Compact workflow progress.
- Direct Design / Verify / Map Pins / Export commands.
- Starter catalog appears when starting or switching projects.
- Metrics and diagnostics are secondary.
- Orientation/help cannot block the command center.

## Design

- Fixed `260px` to `304px` parts palette depending on viewport.
- Main canvas receives remaining width.
- No persistent generic right rail.
- Contextual property bar sits beneath the toolbar:
  - selected node: name, type, duplicate, delete, properties
  - selected wire: endpoints, delete
  - selected boundary I/O: name, direction, board role
- One compact top toolbar.
- Quick Inputs belong inside the palette.
- Zoom is integrated into the toolbar.
- Default view fits the loaded circuit.
- Palette categories and resources must not crop.
- Current Phase 4A proof: `ide:gate:design-workspace-v2` verifies the fixed palette, context property bar, default-hidden generic inspector, canvas geometry, active-canvas select-all, and selected context actions.

## Verify

- Testbench / Results tabs define the mental model.
- No generic Signals rail.
- Signal selection/filter belongs in the waveform or testbench header.
- Before run, Testbench owns the workspace.
- After PASS or FAIL, Results owns the workspace.
- Sequential and combinational labs use the same basic object model.
- Observe-only and advanced patterns live under Tools, not the primary novice path.

## Map Pins

- Fixed split:
  - left: signal-to-board mapping table
  - right: full Basys3 board
- No generic summary rail.
- No resource cards overlaying the board.
- Resource categories become a compact toolbar or legend outside the board.
- Selecting a row highlights the exact board resource.
- Selected mapping details appear inline or immediately beneath the selected row.
- Board and mapping table remain visible together.
- Current Phase 4A proof: `ide:gate:map-pins-workspace-v2` verifies the table/board split, selected row highlight, inline XDC/detail context, board-resource assignment, no root overflow, and no browser errors.

## Export

- Three-part package inspector:
  - file list/tree
  - selected file preview
  - package actions/status
- Student states:
  - Blocked
  - Draft package available
  - Package ready
  - Package downloaded
- Vivado guidance is concise and collapsible.
- Build / Download / Copy / Preview are direct operations.

## Import

- Guided step workflow:
  1. Choose source
  2. Inspect
  3. Resolve
  4. Review replacement
  5. Apply
- No large passive fidelity cards.
- Nothing replaces work before explicit confirmation.

## Legacy Gate Routing

Old gates that primarily preserve docks, rails, or old card composition become legacy safety while V2 gates are introduced. They should be rewritten or retired as each V2 surface lands.

Phase 2 rewrote the active classroom gates that expected normal restore rails, visible build badges, E-tier browser wording, or V1 closed-rail Design canvas budgets. The current primitives used by live surfaces are:

- Project: `course-workspace`
- Design: `fixed-tool-palette`
- Verify: `testbench-workspace`
- Map Pins / Hardware: `board-mapping-workspace`
- Export: `artifact-workspace`
- Import: `step-workflow`
