---
doc_status: current
last_validated: 2026-09-05
owner: Connor Angiel
used_by_claude: true
role: Design surface spec
---

# Design Mode Spec

Status: Unified Workbench v3 RC source; final exact-SHA certification pending
Mode ID: `design`

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
- For a selected node, the compact identity and actionable issue guidance come first, primary Actions follow immediately, and teaching/reference/mapping context follows in **Selection details**. Cross-platform font wrapping in secondary context must not push direct edit controls below the `1366x768` classroom first viewport.
- The inspector is organised as named sections over existing authorities, in this order: Identity (the properties surface: name, kind, rename; there is no standalone Properties section) → Actions → Selection details → **Connectivity** (pin values, input drivers, what the selection drives) → **Evidence** (`ide-design-context-inspector`: live or replayed state, verify focus, probes) → **Mapping** (board resource, package pin, constraint set, the constraint lines the package writes, Open in Board & Constraints) → **Source** (the generated VHDL lines that name the signal, Show HDL beside the schematic; collapsed by default) → **Related** (the documents the signal appears in, as a list). Mapping, Source and Related render only when the selection has that context; board relations always name the package pin, even when the row stores the board alias.
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
