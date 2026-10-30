---
doc_status: current
last_validated: 2026-10-28
owner: Connor Angiel
used_by_claude: true
role: Design surface spec
---

# Design Mode Spec

Status: local P2.6C candidate; exact source digest and current evidence are in the finish ticket
Mode ID: `design`

## Interactive hierarchy contract (2026-10-08)

Explore supports runnable combinational module hierarchies, including repeated and nested
instances. Only actual top-level inputs are drivable. Module ports and internal boundary
nodes are inspection targets, projected from the existing parent live engine. Enter this
instance and the breadcrumb use the exact instance ID path; labels do not establish identity.
Selecting a connection preserves its destination input. Returning to the parent restores
that connection, and Finish exploring retains the authoring camera and experiment owners.
Local rules use actual parent values; unavailable values remain unknown.

Authoring shortcuts and unrelated authoring tools are unavailable during hierarchy exploration.
Large local drawings keep explicit omitted counts and 24-branch pages. Enlarge live drawing
changes only this inspection view. Definitions, cases, expected outputs, recordings, mappings
and checked export authority are unchanged by exploration. Sequential modules remain explicitly
unqualified for live hierarchy exploration; their clock/reset cases run in Simulate. Existing
flat sequential exploration keeps its clock-edge and reset controls.

## Current local authoring/repair contract (2026-09-30)

Starting Blank opens Schematic regardless of a previous HDL preference. Placement at
compact widths leaves the library available; the inspector remains an explicit reveal.
Wire mode keeps the toolbar and ports spatially stable and removes the early guidance
band from the hit area. Draft connectivity issues are notes; duplicate compiler/board/
package diagnostics for the same issue do not become extra work items. Visible ordinary
diagnostics use student labels or component types instead of internal node IDs.

Explore uses runtime values without recording or changing authored defaults. Input-body
clicks toggle current values repeatedly; Reset values restores defaults and register state.
Clock edge is offered for supported clocked components, including Register1, and pulses
an externally connected input clock through the existing runtime. Replay identity and
return-to-authoring stay direct; full playback/failure details sit outside the circuit
behind disclosures. Sources remain read-only, and unsupported HDL is preserved as a reference.


## Current P2.6B authoring and handoff (2026-09-12)

Evidence checkpoint: built 0f941296e passes the complete 15-journey product campaign; matched captures were personally reviewed. This is Browser E0 implementation proof, not owner acceptance or a claim that broader release gates pass. The P2.6B ticket records remaining debt.

Review refinement: Fit consumes the currently measured viewport once, preventing ResizeObserver from translating the camera a second time after Split opens. The Split HDL header wraps its actions; the entire Import button stays inside the source pane. Browser proof asserts all 13 counter components remain inside the schematic viewport.

Explore replaces the Live label and is explicitly unrecorded. Clock edge and Reset values
operate only this exploratory state. There is no Edit/Live/Replay peer switch. A recording
may open a read-only Design view with a visible return to authoring. Test this design opens
the owning scenario with the selected signal and does not run it. Simulate owns recordings.
Split defaults to the circuit/source pair with support panels revealed on request. Sources
and Board I/O share a second library tab row so both stay reachable in the narrow dock.

## Design explores; Simulate records (2026-09-07)

Design has no clock of its own. `Live` is exploration:

- driving an input settles the values through the circuit;
- a circuit with registers offers **Clock edge** (`ide-design-live-step`), applied once when the
  reader asks, with a count of how many have been applied since reset;
- a combinational circuit is offered no clock edge, because there is nothing for one to move;
- **Reset values** (`ide-design-live-reset`) returns inputs and register state to their start;
- the toolbar says `Exploring · not recorded` while any of this is true.

`Replay` reads the run Simulate recorded; it is read-only evidence and says so.

**Retired:** Run / Pause on a wall-clock interval at `speedHz`, the bare `tick N` readout, and the
`onRuntimeSimRun` / `onRuntimeSimPause` / `onRuntimeSimSetSpeed` props. What ran was a counter: on a
combinational circuit stepping changed nothing, and on a clocked one it applied edges at a rate
unrelated to the scenario's clock policy, against no stimulus, with no expected values and no
verdict.

## Purpose

Build deterministic circuit graphs in a canvas-first workspace that stays honest about replay, verify-linked context, and authoring readiness.

## Primary Actions

1. Add and wire logic on the canvas.
2. Inspect selected or verify-linked elements without leaving the workspace.
3. Move to Verify when the circuit is stable enough to prove.

## Workspace Structure

1. Workbench header and direct toolbar
- `ide-design-workspace-header` is the only persistent top owner. It names the current Canvas / Code / Split state and keeps the owning next action visible without adding a second command deck.
- Select, Wire, Undo, Redo, Fit, Zoom, and View remain direct. Port selection opens a compact picker only when more than one port needs disambiguation; it must not become a canvas-obscuring HUD.
- 2026-10-05, local candidate (not owner-accepted). Fit, Selection and zoom are a view dock on the sheet's lower left corner (`ide-design-viewdock`, same control ids), not toolbar buttons. The command row is one row of one height: its status chip takes only left-over room, and Explore has a strip of its own, so the height changes on a mode change and never on selection. Gate: `scripts/gates/ide-design-working-camera.mjs`.
- 2026-10-28, 1.0.0-rc.8 (not owner-accepted). Wire mode changes nothing above the canvas: the Wire badge, what to do next or why a click was refused, and Cancel (one cell with Esc) all live in the status line's announced hint slot (`ide-status-hint-slot`, `role="status"`). The message takes two lines at most; a refusal that does not fit offers More (`ide-design-wire-more`), which shows it whole on a line of its own until the next wire event; a repeated refusal is announced again. The command row never holds a tool's cue, so choosing Wire, arming, completing or refusing a wire moves no pin, including with the inspector open at 1366 and 1440 (rc.7 moved the canvas 44 px there on every wire; RB-DEBT-030, fixed). The placement hint shares the slot and ends in an ellipsis. A finished wire returns to Select; clicking the next source port starts Wire again. Journeys: `packages/rb-e2e/design-core-authoring-journey.mjs`, `packages/rb-e2e/design-workspace-stability-journey.mjs`.
- Sheet ink, same candidate. The schematic's ink follows the sheet's own appearance (`data-canvas-appearance` on the Design workspace): the default light sheet keeps dark ink in Workbench dark (rc.7 drew part names near-white on it, 1.14:1) and a dark sheet keeps light ink in the light workbench; `system` follows the workbench. `design-workspace-stability` requires every part name at 4.5:1 or better in Workbench dark (rc.8: lowest 14.35:1 on the counter starter).
- Working view, same date. A resized sheet is never rescaled: opening the inspector keeps the zoom and slides the view only far enough to keep the selected (or just-placed) part on the sheet; an untouched framed view stays centred. The camera is remembered per project and module for the session (not saved with the project) and restored on returning to Design, reopening a project and entering or leaving a module; Save As keeps the current view. New work is framed once; Fit is explicit.
- Working view, 2026-10-30 (where it differs from the bullet above, this holds). A view switch (Schematic, Split, Code) keeps the world point in the middle of the sheet in the middle of the new sheet, at the student's zoom, through the resizes that settle it, and frames an untouched frame again; a panel shown, hidden or resized afterwards, or a pan or zoom, ends it (kept, it re-centred the old middle whenever the bottom panel opened). A panel opening or closing beside the sheet moves nothing of a view the student zoomed or panned: the inspector opening with a selection, the library shown, hidden or resized (the camera takes up the sheet's moved left edge), the bottom panel. The selected part, or one released a moment ago, is slid back only when the resize itself would hide more of it, even one the edge already cut: until it is wholly on the sheet, by the least amount, and only across the edge that covered it (a part released long ago is no longer followed). The inspector moves an untouched frame only to slide back a selected part it would cover (each select and release used to walk it right by half the inspector), and the library shown or hidden keeps it centred with a part selected or not, sliding by half the change at its zoom, or frames it again when the work no longer fits (with a part selected it used to keep its camera and jump with the sheet's left edge). Opening a module and coming back returns each level to the view it had, an untouched frame framed again, and a first visit frames the module's own parts (holding the camera on the page as the module's strips appeared shifted each level 44px per trip). A sheet measured a pixel differently with nothing beside it changed is not a resize, so the camera stays (at 1366x768 that pixel framed an untouched view again whenever a wire was selected). The camera is settled before the change is painted. Gate: `ide:gate:design-workbench-v1` camera stress (world centre through view switches within 1 world px; page position through panel changes within 1 px; an untouched frame through three rounds of selecting and releasing a part and a wire, then the library hidden and shown with a part selected).
- Library, same date. A compact labeled list at 208px that does not change form on selection; long names wrap rather than truncate; a fixed strip under the list (`ide-design-palette-detail`) shows the focused part's ports for keyboard and pointer alike.
- Project remains reachable through the horizontal five-stage navigator or contextual recovery. The old standalone Design command strip, rail controls, and floating layout toggles are retired.

2. Stable left library
- Search and the core build categories stay first.
- Default palette order is `Board -> IO -> Logic -> Sequential -> Reusable`.
- `Board` starts expanded so Basys3 resources and `CLK100MHZ` are immediately reachable; it remains a helper layer, not the primary dashboard story.
- Sim `Clock` is not a student-authored palette item in the current release. Imported `config.role === "sim"` Clock nodes may render for recovery/migration, but board-ready sequential designs should use the `CLK100MHZ` Board Resource.
- At desktop/laptop Canvas widths the library remains a stable `200-220px` region. Constrained mode changes may reflow support content automatically; students do not manage the basic page layout.

3. Center workspace
- The canvas is the primary region and should win the page.
- In Canvas mode, the left library, canvas, and right inspector share one workbench row; the canvas must remain the focal object at `1366x768` and `1440x900`.
- The accepted full-viewport laptop canvas floor is `62%`. Recorded RC geometry is `63.1%` at `1366x768` and `65.0%` at `1440x900`; the strategic `70%` laptop target remains unmet and may not be reported as complete.
- The tools row stays attached to the workbench header; expanded tool options open as a compact popup instead of adding another horizontal band.
- Starter-loaded guidance is compact by default and must not push the graph below the first viewport; long summary / expected-behavior copy lives behind the `Starter brief` disclosure.
- Status/selection guidance may not cover routine wiring paths or the main circuit graph.
- The compact authoring card is the readiness owner for design issues.
- The simulation strip is contextual and appears only when replay, stale replay, verify-linked focus, active simulation, or another real simulation story exists.
- When opened from a failed Verify run, the simulation strip and failure brief restate the mismatch in student terms: failed label, expected value, observed value, tick, available input snapshot, and the next logic path to inspect. If the graph can trace the failed output's direct driver, Design shows the driver label/type, incoming/outgoing wire counts, and a Focus driver action; if not, it says no direct driver was found instead of inventing root cause. For multi-stage failures, Design also shows a compact upstream signal-trace panel with node depth, upstream sources, open input clues when available, and per-node Focus actions. The trace proves graph connectivity, not formal root cause.

4. Stable right inspector
- Is selection-driven support in a stable `240-280px` region at desktop widths. At constrained widths selected details move to a stable lower region automatically; the student does not open/close a core rail to recover the canvas.
- 2026-10-30 (owner direction for PR #88; see the V1 contract record of that date). With the library and inspector both open the sheet keeps at least 60% of the window; the inspector takes what is left up to 256 px and never less than 240 px (`design-workbench-v3.css`). 1366x768 gives a 250 px inspector and an 828 px sheet, 1440x900 256 px and 896 px, 1920x1080 256 px and 1376 px (the Studio-restart widths had left 766 px at 1366x768). The rail is 64 px with its icons and labels, the library 208 px, the sheet's side gutters 8 px at desktop widths, and the status line 28 px (two Wire-cue lines still fit, set at about 12.4 px at 100% text). Inspector labels and values wrap instead of being cut: at 100% text the term column is 6 rem beside the value, and with enlarged text each term sits above its value (a `design-inspector` container query on the dock body, below 12 rem), so pins, board resources and CLK100MHZ stay whole. The library and inspector are shown together only in the standard and wide layouts (a shell of at least 1280 px, so a window of at least 1344 px at 100% text), where the inspector is at least 241.6 px; the 240 px floor is a safety net. An inspector width saved as the old 280 px default is read as 256 px. Gates: `ide:gate:workbench-obstruction-usability`, `ide:gate:primary-work-object-dominance`, `ide:gate:design-dual-tool-windows`, `ide:gate:workbench-space-utilization`.
- For a selected node, the compact identity and actionable issue guidance come first, primary Actions follow immediately, and teaching/reference/mapping context follows in **Selection details**. Cross-platform font wrapping in secondary context must not push direct edit controls below the `1366x768` classroom first viewport.
- 2026-10-05, local candidate: within Actions for one selected part the groups are, in the markup and on screen, Value → Net tracing → Edit. Selection details, Connectivity, Evidence and Related start closed with their content hidden, and open from the keyboard. Running copy names the other workspaces as the rail does ("Open in Board", "Open Board").
- The inspector is organised as named sections over existing authorities, in this order: Identity (the properties surface: name, kind, rename; there is no standalone Properties section) → Actions → Selection details → **Connectivity** (pin values, input drivers, what the selection drives) → **Evidence** (`ide-design-context-inspector`: live or replayed state, verify focus, probes) → **Mapping** (board resource, package pin, constraint set, the constraint lines the package writes, Open in Board & Constraints) → **Source** (the generated VHDL lines that name the signal, Show HDL beside the schematic; collapsed by default) → **Related** (the documents the signal appears in, as a list). Mapping renders when the selection has a board row or relation, and Related when the signal resolves to a boundary relation; Source renders for any single selected node and says so plainly when the signal is not named in the generated source. Board relations always name the package pin, even when the row stores the board alias.
- Selection label editing is exposed by `ide-design-label-edit-btn`; the retired standalone context rename hook should not be used for new tests.
- With no selection, the compact **Design overview** fallback inside `ide-design-inspector-canvas-default` may show Inputs / Outputs / Nodes / Wires counts, current I/O values, the Verify-owns-proof boundary, and the empty-canvas branch. It stays secondary to the canvas.

5. Port interaction authority
- Sparse direct ports expose at least a `24x24` hit target; a single spacious port may use `32x32`.
- Dense same-side ports expose a consolidated target at least `32x24` (the current tested dense cluster is `32x36`) and open a compact labeled port picker.
- Direct targets and picker options must support pointer, Enter, and Space through the same wiring callback. The visible port name/side remains the student's authority; hidden implementation IDs do not become UI.

## Empty / Idle State

- Blank-state teaching stays inside the canvas region.
- Blank-state guidance must expose a clear build path and board I/O authoring path without forcing a starter-first workflow.
- The floating shortcut strip no longer exists.
- Idle rails should feel secondary, not like co-equal dashboard bands.

## Workbench v1 Proof Contract

- `ide:gate:design-workbench-v1` is the scoped Design Workbench v1 gate.
- It proves blank/fresh Design, Logic Gates starter, Half Adder, selected node, selected wire, wire start/cancel, moved node, delete/undo restore, split/code, and zoom/fit/center states at `1366x768` and `1440x900`.
- `ide:gate:blank-adder-authoring-depth` is the focused blank-canvas depth gate. It proves manual SW/LD placement, signal labeling, primitive full-adder XOR/AND/OR wiring, invalid/cancel/delete/undo/move wire handling, four-`FullAdder` carry-chain authoring, and low-zoom chip port hit targets at `1366x768` and `1440x900`.
- `ide:gate:custom-clock-sequential-truth` guards clock authoring truth: `CLK100MHZ` is the supported visible board clock, the Sim Clock palette path stays hidden, and imported sim-only Clock projects are migration-only.
- `ide:gate:wrong-build-diagnosis-repair-flow` guards failed-Compare design repair: Inspect Design preserves mismatch context, exposes direct driver facts when available, focuses the driver, supports OR -> XOR repair, and returns to stale Verify evidence until Compare passes again.
- `ide:gate:complex-build-signal-trace-debugging` guards multi-stage failed-Compare Design debugging: a scratch two-stage sum path built with the wrong final gate opens Design with a bounded upstream trace for `SUM_OUT`, direct driver, intermediate gate, and input sources at `1366x768` and `1440x900`.
- `ide:gate:design-workbench-v1` must stay semantic-neutral: no simulation, Verify, pin mapping, export generation, project format, or golden artifact changes are implied by that gate.
- Before/after visual proof for this closeout is local-only under `.redbyte/product-immersion/design-workbench-v1/`.
- `ide:gate:design-port-target-authority` is the RC interaction gate for direct/cluster target geometry, keyboard operation, compact port disambiguation, and normal wiring at the constrained laptop viewport.
- `ide:gate:design-build-contract` and the adjacent wiring gate protect build/placement continuity after the target changes.
- These are source-slice gates until they are rerun on the final reconstructed docs-complete SHA.

## Error / Status Rules

Use non-blocking callouts and the compact authoring owner for design truth:

1. Invalid wire target.
2. Floating outputs.
3. Missing required IO nodes.
4. Replay invalidated after a circuit edit during replay.
5. Verify mismatch context must stay visible while the replay/debug view is active; if no mismatch context exists, Design falls back to the generic Verify focus copy.

## Data Contract (RBProject)

Reads:

1. `circuit`
2. `layout`
3. `submodules`

Writes (guarded):

1. `circuit`
2. `layout`
3. `submodules`

## Batch 1 Product Audit Notes (2026-04-30)

- Supposed to do: let a user create a supported FPGA design from scratch and understand what will become top-level HDL ports versus internal wires.
- Current truth: the canvas, live diagnostics, and support registry are real, but the first proof loop still leans on starter projects and fixtures more than a fully manual blank-canvas browser rehearsal.
- Determinism change needed: surface export-support truth, top-level port naming, and unsupported component warnings close to authoring so Vivado blockers are caught before Export.
- Friction found: mixed-gate custom project E1 is proven through a blank-shaped `.rbproj` fixture and real Vivado, but a fully hand-authored browser path remains the next product proof.
