---
doc_status: current
last_validated: 2026-07-13
owner: Connor Angiel
used_by_claude: true
role: Design surface spec
---

# Design Mode Spec

Status: Design Workbench v1
Mode ID: `design`

## Purpose

Build deterministic circuit graphs in a canvas-first workspace that stays honest about replay, verify-linked context, and authoring readiness.

## Primary Actions

1. Add and wire logic on the canvas.
2. Inspect selected or verify-linked elements without leaving the workspace.
3. Move to Verify when the circuit is stable enough to prove.

## Workspace Structure

1. Workbench header
- Compact `What do I do next?` guide rail tells students to place components, wire ports, label signals, then move to Verify.
- `ide-design-workspace-header` is the only persistent top owner.
- It carries the surface identity, the current workspace mode (`Canvas`, `Code`, `Split`, replay-linked variants), and the current `Open Verify` action. Project remains reachable through the five-stage rail or contextual recovery, not as a competing persistent header action.
- The old standalone Design command strip is retired.

2. Left library
- Search and the core build categories stay first.
- Default palette order is `Board -> IO -> Logic -> Sequential -> Reusable`.
- `Board` starts expanded so Basys3 resources and `CLK100MHZ` are immediately reachable; it remains a helper layer, not the primary dashboard story.
- Sim `Clock` is not a student-authored palette item in the current release. Imported `config.role === "sim"` Clock nodes may render for recovery/migration, but board-ready sequential designs should use the `CLK100MHZ` Board Resource.
- In code and split modes the library collapses to an overlay rail by default so it does not reserve workspace width while idle.

3. Center workspace
- The canvas is the primary region and should win the page.
- In Canvas mode, the left library, canvas, and right inspector share one workbench row; the canvas must remain the focal object at `1366x768` and `1440x900`.
- The tools row stays attached to the workbench header; expanded tool options open as a compact popup instead of adding another horizontal band.
- Starter-loaded guidance is compact by default and must not push the graph below the first viewport; long summary / expected-behavior copy lives behind the `Starter brief` disclosure.
- The Design status summary is allowed to overlay the canvas as a compact secondary cue, but it should not consume a standalone vertical band above the graph.
- The compact authoring card is the readiness owner for design issues.
- The simulation strip is contextual and appears only when replay, stale replay, verify-linked focus, active simulation, or another real simulation story exists.
- When opened from a failed Verify run, the simulation strip and failure brief restate the mismatch in student terms: failed label, expected value, observed value, tick, available input snapshot, and the next logic path to inspect. If the graph can trace the failed output's direct driver, Design shows the driver label/type, incoming/outgoing wire counts, and a Focus driver action; if not, it says no direct driver was found instead of inventing root cause. For multi-stage failures, Design also shows a compact upstream signal-trace panel with node depth, upstream sources, open input clues when available, and per-node Focus actions. The trace proves graph connectivity, not formal root cause.

4. Right inspector
- Is selection-driven support: it stays collapsed by default and opens when a selected node, wire, focused asset, mapping, or signal context needs direct controls.
- Selection label editing is exposed by `ide-design-label-edit-btn`; the retired standalone context rename hook should not be used for new tests.
- When the student explicitly opens the inspector without a selection, the compact **Design overview** fallback inside `ide-design-inspector-canvas-default` may show Inputs / Outputs / Nodes / Wires counts, current I/O values, the Verify-owns-proof boundary, and the empty-canvas branch. It is not a persistent default work object.
- In code and split modes the inspector also defaults to a collapsed overlay rail until the student asks for it or context makes it relevant.

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
