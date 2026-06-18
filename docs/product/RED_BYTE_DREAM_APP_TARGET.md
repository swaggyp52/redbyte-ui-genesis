# RedByte Dream App Target

Last updated: 2026-06-18

## Product Shape

RedByte should feel like a Basys3-first digital logic lab workbench, not a documentation dashboard. Each mode should lead with the object a student manipulates: project identity and next path, circuit canvas, testbench/evidence, board mapping, export artifact, or import recovery editor.

## First-Viewport Standard

- One dominant work object appears in the first viewport.
- One primary next action is obvious without reading a paragraph.
- Passive explanation belongs in compact guidance, inspector details, disclosures, or first-launch states.
- Cards are reserved for repeated items, focused panels, and modal-like choices. A surface should not become stacked cards explaining what the surface is.
- Side docks must either expose useful controls or collapse into a small, readable restore rail. They should not consume disproportionate space with sideways labels or long prose.

## Interaction Standard

- Labels that look editable should be editable.
- Workflow orientation should be a navigable control or compact progress indicator, not a floating obstruction.
- Active states should replace intro copy with tools.
- Recovery and repair paths should show the user's concrete artifact, diff, editor, waveform, board, or checklist before abstract status.
- A user should be able to continue the lab path by clicking visible controls, not by interpreting status copy.

## Surface Targets

- Project: a command center for the current lab, project identity, and next path. Loaded project state should prioritize the current assignment and continuation path.
- Design: a direct circuit workbench with canvas and HDL/tooling nearby; support docks must not steal the canvas by default.
- Verify: a testbench and evidence workstation with enough horizontal and vertical room to inspect vectors, expected outputs, and run results.
- Hardware: a board and pin-mapping workbench; the Basys3 board/table should be the main object when mapping is active.
- Export: an artifact handoff station with direct preview, build/download controls, and clear proof boundaries.
- Import: a recovery workstation. First look may explain the safest restore path; once a user chooses Paste HDL, ZIP, or a sample, the editor/review object must be first.

## Current Reconstruction Package

Import guided recovery workflow reconstruction.

Target behavior for this package:

- First-look Import keeps a single recommended restore path.
- Active Import replaces the large intake hero with a compact task bar.
- Paste HDL puts the editor in the first viewport at 1366x768 and 1440x900.
- Unsupported examples keep honesty/blocker copy, but the review/blocker area starts in the first viewport and direct next actions remain reachable.
- No import parsing, project replacement, pin mapping, export artifact, Verify, or hardware semantics change.

Proof for this package:

- `ide:gate:import-guided-recovery-workflow`
- before screenshots and observations under `.redbyte/product-immersion/product-reconstruction/2026-06-18/before/`
- after screenshots and observations under `.redbyte/product-immersion/product-reconstruction/2026-06-18/after/`

Remaining target gaps:

- Project loaded state still needs more function depth and less metric/card dominance.
- Export can still become a denser artifact inspector with stronger direct file interaction.
- Support rails and docks are much improved, but future work should keep reducing passive chrome whenever it competes with the active work object.
