# P2.6B - Determinism made visible and one coherent studio

- Date: 2026-09-12
- Owner: Connor Angiel
- Status: in progress; implementer review is not owner acceptance
- Surfaces: Project, Design, Simulate, shell, Board Check, Package
- Journey: author -> explore -> select signal -> experiment -> reproduce -> inspect failure -> repair -> rerun -> map -> package -> reopen
- Environment: canonical Windows checkout; Node 20.19.0, pnpm 10.24.0; fresh Chromium contexts; dev URL `http://[::1]:5173/`.
- Initial source: `458125d381f1028ec62dd4a74b877c0c89c7386b` on `claude/redbyte-studio-completion-p2-6-q7m3v8`; remote and draft PR #86 verified at that same head. Base stays `claude/redbyte-operational-workbench-convergence-w9k2r4`.

## P2.6B validation follow-up - 2026-09-12

At pushed dfec50b446aeab5b48d1828adf1f8139be32615f, verify:gates passes (23 reported
Vitest invocations, 109 passing tests, both protected export goldens) and all 15 built
browser journeys pass. All 13 matched final captures were personally reviewed. The 512-case
experiment measured 2.746 s to run and 1.578 s to inspect; digest remains 140ba365.

The canonical classroom chain passes build and examples, then fails Project command center
at step 3 of 72 on its retired start-hub assertion. A separate diagnostic continuation of
all 71 post-build commands at that unchanged build gives 19 pass / 52 fail. The clipping
gate, both guided import recovery gates, and the 31-test determinism/parity suite pass.
The exact per-command failures are classified in docs/validation/test-debt.md and ignored
local evidence under p2-6b/classroom-final. This is not a green classroom release.
repo-status --skip-build now passes bring-up and import, then stops at Project Overview's
retired landing-title assertion; later checks in that chain remain unmeasured.

One real regression in that census is corrected: the no-circuit instrument retained a hiding
rule for the retired frame class. Its rule now belongs to the current instrument, while
the Design, starter and Import/Recover actions and external VCD disclosure remain available.
Load starter opens the existing bounded picker instead of taking an open blank project to
Overview. Browsing does not replace work. Source browser checks pass at 1440x900 and 1280x650;
the focused owner suite passes 11/11. The existing gate retains its navigation and visibility
invariants and adds 1280x650. A fresh committed build and affected proof follow this checkpoint.

Typecheck remains 768 / b9e8e0eb29ca1d2a (Node 20.19.0, TS 5.9.3), with no suppression or
upward rebaseline. Full Design/Verify families remain 374 pass / 86 fail at 2563b40d4, with
23 new, 11 closed and 63 retained failure identities versus baseline. Browser E0 only.
No merge, retarget or production deployment; this review is not Connor Angiel's acceptance.

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

## P2.6B visual closure checkpoint - 2026-09-12

The product gate passes at pushed 2563b40d4e16a152d02c37aa5d8daf2a5349f9e1, including both
protected export goldens. All 15 built-browser journeys pass at that same build: determinism,
causal capture, scenario partnership, recorded repair, Full Adder, nested adder, complex import,
VCD analyzer, project lifecycle/persistence, studio composition/scale, Board Check, accessibility
and the 512-case hierarchical experiment. The long fixture measured 2.608 s to run and 1.576 s
to open/select linked inspection under the concurrent campaign; digest remains 140ba365.

Personal review of all 13 matched built captures identified a second full Problems list in
Overview and 80 px of the linked recording header behind its shared controls. Overview now
shows one blocker and opens the canonical Problems dock. Investigation has bounded separate
pane scrolling, a complete recording header and a minimum useful Time viewport; the event
editor disclosure cannot overlap the instrument. A singleton recording now says no repeat yet
in both Simulate and Project. Source browser assertions pass at 1440x900 and 1280x650; the
Project/recorded-truth batch passes 13/13. The compact Project test explicitly reveals its
explorer again after opening the inspector, preserving its document-activation assertion.

These final presentation corrections require a fresh build and repeated affected browser
proof. Classroom, repo-status, final source/CI and the visual report remain closure work.
No merge, retarget or production deployment. Browser E0 only; implementer review does not
substitute for Connor Angiel's acceptance.

## P2.6B review checkpoint - 2026-09-12

This supersedes the first implementation checkpoint below. The first checkpoint is pushed
as 57f4df2bdbc0b95881c7043d112b09239f634f70. The reviewed follow-up fixes measured Split
camera double-translation, wraps the source header so Import remains reachable, gives Time
keyboard lane selection and authored-input editing, restores direct combinational input
editing, and aligns Reproduce with the command row. Failure context has readable contrast;
one recording in Project Runs now says no repeat yet.

The actual Full Adder repair/map/download/reload browser journey exposed eight authored
event ids being discarded on reload. Scenario cloning and persisted-vector normalization
now preserve valid ids. This keeps exported project bytes and exact package receipts stable;
execution content hashes still exclude authoring identity. A regression test fails with the
loss restored and passes with the fix. No receipt/trust checks were weakened.

Construction proof on Node 20.19.0: the Full Adder UI-only core passes at 1440x900, 1366x768,
1280x650, including actual ZIP SHA-256 and receipt persistence. The persistence/scenario/
export batch passes 91/91; the keyboard/current-surface batch passes 92/92. The accessibility
journey passes four viewport/text configurations with measured minimum text contrast 5.17:1,
visible keyboard focus, usable mapping controls and explicit Package report access. Nested
adder authoring retains four distinct instances and exact SUM=0111, carry=1 on reload;
its execution and automatic mapping stages use runtime calls and are not UI-only proof.

Typecheck is 768 diagnostics / b9e8e0eb29ca1d2a, TS 5.9.3. The decrease from 770 removes two
obsolete control assertions from test consumers; it is not broad production type repair or
an upward rebaseline. The 460-test Design/Verify census is 374 pass / 86 fail. Against the
same baseline suite at 2d3160131 (386 pass / 74 fail), 23 failure identities are new, 11 are
closed, and 63 remain. These are named validation debt, not all pre-existing failures.
See docs/validation/test-debt.md. No skipped tests, suppressions or golden changes were added.

Final quiet-head build, classroom/product gates, built-bundle journeys and matched visual
review remain the next closure steps. Browser E0 only. PR #86 remains draft on the existing
branch and base; no merge, retarget, production deployment, format change or hardware claim.

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
