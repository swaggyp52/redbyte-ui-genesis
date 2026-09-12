# P2.6B - Determinism made visible and one coherent studio

- Date: 2026-09-12
- Owner: Connor Angiel
- Status: in progress; implementer review is not owner acceptance
- Surfaces: Project, Design, Simulate, shell, Board Check, Package
- Journey: author -> explore -> select signal -> experiment -> reproduce -> inspect failure -> repair -> rerun -> map -> package -> reopen
- Environment: canonical Windows checkout; Node 20.19.0, pnpm 10.24.0; fresh Chromium contexts; dev URL `http://[::1]:5173/`.
- Source: `458125d381f1028ec62dd4a74b877c0c89c7386b` on `claude/redbyte-studio-completion-p2-6-q7m3v8`; remote and draft PR #86 verified at that same head. Base stays `claude/redbyte-operational-workbench-convergence-w9k2r4`.

## Problem and reproduction

Open the Full Adder starter, select a gate in Design, then visit Simulate and Project's Runs.
At 1280x650 the Design circuit shares the width with two permanent support panels; its tool
strip offers Edit / Live / Replay and the four library tabs exceed their strip (218px available,
314px required in the handoff measurement). Simulate offers Observe / Compare, another Live
I/O surface, a permanently populated inspector and a provider import strip before any run.
Project's five destinations become a second row of navigation as they are visited.
An old failed run can report "Simulation failing" while another workspace is active.
Run hashes exist, but the student cannot request or see a determinism comparison.

Expected: one primary work object, contextual support, Design exploration explicitly unrecorded,
one scenario Run with optional checks, visible design/stimulus/engine identity, repeat execution
with a digest comparison, retained historical evidence, and a topology/sample-derived causal path.
Severity: high; the capabilities exist but their composition obscures the learning task.

## Truth and authority

The 2026-09-12 Decision Record in `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md` defines the
target. Current behavior is verified in code and browser; older surface descriptions are history.
`projectRuntime` owns execution and retained runs; scenarios own stimulus/checks; the circuit and
hierarchy stores own design; workspace preferences and document descriptors own only presentation.
`runScope`, the recorded sample/relationship resolvers and immutable snapshots are projections.
No second execution, project, run, mapping or package authority is introduced.

## Acceptance proof

Run the existing Full Adder, recorded-investigation, project lifecycle, source/import, hierarchy,
board and package journeys, extending their current controls and assertions. Add the uncovered
determinism journey: three Reproduce clicks give four executions of one identity with equal
digests in the DOM; design and stimulus changes are named; old recordings remain inspectable.
Assert real clock/capture/driver hops and agreement across trace, schematic and board.
Capture matched before/after states at 1440x900, 1366x768, 1280x650, 1920x1080 and separate
200% text/effective narrow viewport stress. Inspect captures personally and repair obvious defects.
Keep correctness, interaction and visual verdicts separate. Negative controls must fail without
the corresponding implementation. Run affected unit tests, typecheck baseline, CSS audit, docs,
encoding, production build, journeys against dev and built bundles, then converged product gates.

## Evidence and checkpoint record

Before captures: `.redbyte/e2e-evidence/visual-craft/p2-6b-before/` (five surfaces, four viewports).
Implementation evidence and exact command results are appended at each checkpoint.

### First implementation checkpoint

- Counter repair: project-context/ counter journey, both viewports passed. An optional-check
  alias initially changed the output digest; native retained samples now define it. Restored
  XOR outputs have the original digest while both earlier failures remain byte-equivalent JSON.
- Native trace/schematic/Board agree at t2 and missing t9 in causal-capture/three-drawings-first.
  A real manually authored clock edge supports output -> Q0 -> rising edge -> retained clk event.
- VCD: 18 operations across 1440x900 and 1366x768, including invalid-file rejection and reload.
- Negative controls: digest-aliases, sample-collision-alarm, ambiguous-driver each fail with
  the respective fix disabled; restored focused suites pass (10 tests).
- Bring-up contract debt: the old test manufactured PASS from expected values for an imported
  port-only HDL projection. The actual engine reports four floating outputs and X. The contract
  now keeps project-vector references separate from browser proof; 12 relevant tests passed.
- Personal image review found repeated sequential summaries and a stale Project signal panel;
  the summary was removed, controls moved beside Time, and Project inspector context corrected.
- Before artifacts remain under visual-craft/p2-6b-before; construction after artifacts use
  determinism, causal-capture, recorded-investigation, board-check-composition and studio-scale.
  These folders are ignored local evidence, not remotely published screenshots.

Initial visual review: Design's right panel clips the selected part's rename action; the canvas
is subordinate to tool regions. Simulate's right inspector occupies nearly a third of its primary
region before any recording; the import strip reads "Provider: Imported VCD" without an import.

## Docs and delivery

Update this ticket, the top P2.6 section in `docs/ACTIVE_WORK.md`, `AI_STATE.md`, relevant current
`docs/ide/` specs, the existing ignored `RESUME.md`, and draft PR #86 at checkpoints.
No merge, retarget, force push, main/product branch push, production deployment, format change,
golden regeneration, Vivado installation or hardware-proof claim.


The 512-case hierarchical 4-bit adder import now records 39 native signals and evaluates
2560 authored checks. Reproduce retains digest 140ba365; explicit save and reload preserve
both recordings. The browser journey measured 4.049 s to run and 1.017 s to open/select linked
inspection on this machine. A real quota failure led to lossless packing of waveform columns,
check rows and repeated normalization metadata at existing runtime/repository storage boundaries.
The two-run fixture uses about 5.00 million stored characters; larger retained sets still face
the browser quota and must report save failure. No evidence is silently discarded. Older plain
JSON saves remain readable; portable format 1 and existing storage keys are unchanged.
The storage/repository owner batch passes 23/23, including exact mixed X/Z/missing samples and
both long recordings after rehydration. The latest focused UI/owner batch passes 72/72.
