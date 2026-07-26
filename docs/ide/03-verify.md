---
doc_status: current
last_validated: 2026-07-22
owner: Connor Angiel
used_by_claude: true
role: Verify surface spec
---

# Verify Mode Spec

Status: Unified Workbench v3 RC authority source; final exact-SHA certification pending
Mode ID: `verify`

## Purpose

Run deterministic testbench verification and present clear pass/fail proof for downstream Hardware and Export trust.

## Primary Actions (max 3)

1. Execute vector run.
2. Author clock/stimulus cases for the current design.
3. Use the visible failure summary, then open `Failure details` for granular diffs, repair scopes, signal traces, and deterministic hashes.

## Layout

0. **Guide rail**: Compact `What do I do next?` copy tells students to run Observe, edit expected outputs, and then Compare until saved checks pass.

1. **Command deck** (`VerifyCommandBar`): a primary command band — **Run** plus a **Stimulus / Checks** procedure lens, framed **Experiment** block (scenario name from active scenario or last run or vector bucket label; **Case tN** readout; timing / lab mode line), explicit **Observe only** vs **Compare checks** selector with inline explainer (`ide-vcb-mode-explainer`), then utilities (**Tools**, **Details**, **Open in Design**) — plus a second **session** summary row (status, meta, evidence). At compact/stress widths of `<=1200px`, the primary band reflows into a two-column / two-row grid so both mode labels remain full and status/truth content cannot overlap the mode selector. See `docs/IDE_SYSTEM_MAP.md` § Verify chrome.

2. **Workspace**: **Build testbench** (scenario library, clock/timing guidance, unified stimulus/check grid) and **waveform** instrument in a lab grid. The first-run starter path keeps the stimulus and expected-output editor visible and names the four student concepts: Inputs to try, Expected outputs, Observed outputs, and Status. After a run, the left setup area stays editable but removes first-run teaching chrome so stimulus/check edits and waveform evidence remain readable together.

3. **Clock / timing panel**: sequential designs surface a detected clock policy, not just a raw lane. A Basys3 board clock such as `CLK100MHZ` / `W5` defaults to **Auto board clock** with run-cycle control, edge/reset summary, and explicit manual-override actions. Non-board inferred clock rows, including switch/button-clocked labs, stay in **Manual pulses** rather than auto-running as a board oscillator.

4. **Side rails**: Signal lanes (left), inspector / console (per `IdeSurfaceLayout`).

5. **Analysis / failure**: A failing Compare keeps a compact visible result summary beside waveform evidence: FAIL state, passed/failed counts, high-level cause guidance, `Open Design`, and `Review expected outputs`. `Failure details` is an explicit disclosure beneath that summary. Opening it reveals the first failed case, failed signal, expected bit, observed bit, input vector, repair scope, and granular expected/testbench versus design-repair actions. Students may then edit expected values, use observed for one cell / the selected row / all failed outputs, inspect Design, or rerun Compare. A selected failed case also produces a compact `VerifyDebugContext` for Design: raw signal key, student label, expected/observed bits, tick/case context, input snapshot, pattern summary, and next-inspection hint. Design may then show direct-driver facts plus a bounded upstream signal trace; Verify must still require a fresh Compare before treating the repair as current evidence.

6. **Run summary**: the setup column carries a compact summary of driven inputs, checked outputs, case/tick count, clock activity, and whether Compare checks are armed before the first run. After a run, that summary is demoted so PASS/FAIL state, first mismatch, expected/observed values, and waveform evidence are the first-order objects.

Rows and cases in Verify are authored **ticks/testbench steps**. In **auto board clock** mode, Verify starts the shared vector sequence at cycle 0 and materializes `max(runCycles, authored-row count, 1)` rows; every visible Auto result row is sampled post-rising-edge. When automatic reset applies, its assertion is materialized in cycle 0 and its later deassertion remains in the same sequence—there is no hidden runtime reset prelude. In **manual** or **custom pattern** mode, each authored row is one settled sample and drives the actual resolved clock input from the authored value. Only a low-to-high transition advances the supported rising-edge state model; repeated high, high-to-low, repeated low, and flat-low rows hold state. Manual/custom execution also injects no hidden reset.

## Named document and sequential policy authority

Each named testbench is one browser-local authored document. The document owns:

1. stable document ID and editable name
2. combinational cases or explicit sequential steps
3. stimulus and expected values
4. version/content hashes used for freshness
5. when sequential, its own execution policy: override mode, run cycles, active edge, reset behavior, detected source/execution type, optional signal/reset identity, and starting level

The policy is not a global Verify preference. Switching testbenches switches policy. New/duplicate documents inherit the active document's policy intentionally, then receive their own ID and proof lifecycle. Rename, duplicate, saved-project reload, previous-session recovery, scenario-library repair, and manifest recovery preserve valid document intent. Compatible Design edits reconcile live signal identity while keeping the document; removed references remain reviewable and current proof is revoked until repair/rerun.

Sequential steps preserve four distinct pulse behaviors: `rising`, `falling`, `high`, and `low`. A rising pulse must create the low-to-high transition that advances rising-edge state, even when a hold duration follows it. A falling pulse is supported authored stimulus that creates a high-to-low transition and must hold rising-edge state; it does not enable falling-edge-triggered capture. The runtime records the resolved clock policy with the run and includes policy in the scenario stimulus/content authority. Runtime summary, waveform, expected-check sampling, PASS/FAIL classification, and their count domains must project the same execution sequence.

This document/policy library is stored in the browser-local saved-project sidecar and is deliberately absent from portable `RBProject` JSON. The policy and authored rows are materialized into one shared execution-vector sequence consumed by runtime Verify, bring-up expectations, and generated `testbench.vhd` together with the resolved clock/schedule projection. Auto `runCycles`, automatic reset behavior, resolved clock data, starting level, and authored stimulus may therefore change generated bytes, stale Export, and invalidate an old receipt without adding a portable `RBProject` field. UI status, waveform, and Compare-result objects are not byte-generation inputs.

## Empty State

Headline: `No testbench cases yet`
Primary CTA: `Generate starter testbench`
Secondary action: `Open Project vectors`

## Error State

1. Runtime failure callout with details.
2. Determinism mismatch callout with expected vs actual hash.
3. Missing signal mapping warning list.

## Success State

`Verification PASS` with:

1. Stable hash.
2. Zero failing rows.
3. Timestamp-free deterministic run metadata.
4. Current Compare PASS with saved checks that can authorize trusted Hardware/Export handoff.

Verify evidence currentness must keep four student-relevant states distinct:

1. **Current:** the same design/testbench state has a current Compare PASS with saved checks; only this Verify state may authorize Trusted Export.
2. **Missing:** no qualifying Compare result exists. Observe-only trace evidence remains useful but is not proof.
3. **Stale:** a design, testbench/policy, or mapping authority input changed after the qualifying Compare; rerun Compare after the owning repair.
4. **Failed:** current Compare checks differ or structural preflight blocks comparison; keep the failure and repair route visible rather than relabeling it stale.

Incomplete mapping remains a separate downstream authority condition. Trace-only, missing, stale, failed, or incomplete-mapping states do not complete the Verify proof stage.

The Verify evidence signature is tied to the same normalized current-project hash that workflow authority compares: circuit, project vectors, custom vectors, and project I/O mapping. Vector UI IDs are ignored by the evidence signature so helper-generated clock rows do not create a phantom stale loop after the run completes.

`ide:gate:verify-evidence-workbench` guards the classroom Verify evidence path: visible first-run expected-output editing, Observe-only waveform evidence that is not trusted proof, Compare PASS, intentional expected-output edit to FAIL, visible failure summary, disclosed first-mismatch expected/observed evidence, waveform controls, repair back to PASS, and no meaningful overlap between stimulus and waveform evidence regions. The underlying script remains `scripts/gates/ide-verify-evidence-workbench-integrity.mjs`.

`ide:gate:verify-postrun-workbench-usability` also guards the post-run command deck: visible `Observe only` and `Compare checks` labels must remain readable through Compare PASS, induced FAIL, repair PASS, and the workbench toggle path at `1366x768` and `1440x900`.

The strengthened RC form of `ide:gate:verify-postrun-workbench-usability` also requires the case-step/waveform transport controls to stay in one primary row, remain contained and non-overlapping, expose at least `36x36` routine targets, and render visible labels at `13px` or greater at `1366x768` and `1440x900`.

`ide:gate:sequential-testbench-authority` is the exact required standalone sequential authority gate. It covers policy edit, rising/falling/high/low pulse semantics, manual/custom rising-edge execution, flat-clock hold, report/waveform/check agreement, generated-testbench authority, Export staleness, save/reload, duplicate/rename, compatible Design break/repair, and Import recovery while asserting that portable `RBProject` bytes do not gain `sequentialPolicy`. Run it separately from the uninterrupted 72-step `classroom:gate`; the aggregate does not substitute for this gate.

Historical pre-sequential source `f4f7ca8f3` passed the earlier `36/36`, `477/477` matrix. Current integrated pre-doc source `0788044cb` passes the touched `20/20`, `258/258` authority matrix plus sequential authority, custom-clock ZIP truth, preservation, and Verify-repair browser gates under Node `20.19.0` / pnpm `10.24.0`. This is source-checkpoint evidence. The named gates and uninterrupted classroom aggregate must still be rerun on the final docs-complete reconstructed SHA.

`ide:gate:blank-adder-authoring-depth` guards the blank-canvas custom-vector path for a hand-authored primitive full adder and a four-block 4-bit adder. It requires Observe -> save observed outputs -> Compare PASS, intentional expected-output FAIL with an inspectable mismatch after opening `Failure details`, repair back to PASS, and the specified 4-bit adder sample vectors at `1366x768` and `1440x900`.

`ide:gate:scratch-testbench-repair-flow` guards the scratch-build failure-recovery path for a FullAdder plus extra OR logic design. It requires Observe -> save observed outputs -> Compare PASS, intentional wrong expected-output FAIL, a visible failure summary, `Failure details` disclosure, `Use observed`, repaired PASS, stale expected-output edit detection after PASS, and Export E0 trust boundary at `1366x768` and `1440x900`.

`ide:gate:wrong-build-diagnosis-repair-flow` guards the wrong-circuit repair path. It requires a scratch XOR-intended design built incorrectly with OR, correct expected outputs, Compare FAIL, visible high-level Design recovery, disclosed design-repair lane detail, Inspect Design context with expected/observed/input vector and direct OR driver facts, Focus driver, OR -> XOR repair through the Design inspector, stale Verify rerun, repaired Compare PASS, and Export E0 trust boundary.

`ide:gate:complex-build-signal-trace-debugging` guards the next wrong-build debugging layer. It requires a scratch two-stage full-adder-style sum path built with a wrong final `OR`, correct expected outputs, Compare FAIL, Design handoff, direct driver facts, bounded upstream trace rows, per-node Focus actions, no root overflow, and console/page cleanliness at `1366x768` and `1440x900`.

`ide:gate:testbench-editor-and-export-confidence-flow` guards the current testbench repair and Export confidence path. It requires a nontrivial starter circuit, multiple authored test cases, expected-output labels, Observe evidence, intentional multi-output expected failures, a visible failure summary, disclosed failed-row repair scope, single-cell repair, row/all-failed repair, repaired Compare PASS, stale testbench copy after post-PASS edits, Export stale/draft confidence, final current Compare PASS, Export current browser-E0 confidence, and no E1/E2/E3 overclaim.

`ide:gate:custom-clock-sequential-truth` guards the current clock policy boundary: `CLK100MHZ` board clocks auto-run, manual switch/button clocks stay manual-pulses, imported sim-only Clock components stay import-only/manual, and a non-starter board-clock sequential fixture reaches Verify/Export browser E0 proof.

`ide:gate:verify-counter-repeat-compare-stability` guards repeated Verify run completion for the `2-Bit Up Counter (Basys3)` path. It requires Observe, repeated Compare PASS using the same deterministic report hash with fresh run timestamps, intentional expected-output FAIL, repair PASS, and post-repair repeated PASS without leaving the command deck, waveform run state, or run button visibly stuck in `RUNNING`.

When a current run becomes stale, the copy must say why:

1. `Design changed - rerun Compare`
2. `Testbench changed - rerun Compare` (including expected-output edits after a Compare PASS)
3. Mapping-driven downstream review in Export / Hardware when bindings changed

For sequential circuits, current proof still requires useful timing stimulus, but Basys3 board clocks now provide that stimulus automatically by default. Imported or legacy explicit `role:"sim"` Clock components are import-only in this release: Verify must not describe them as `CLK100MHZ` / `W5` board clocks, and students should replace them with the `CLK100MHZ` board resource before trusting auto Verify or Export. Manual clock rows remain an override/debug path and are explicitly labeled for switch/button-clocked hardware designs. Latch-control designs use the same panel but describe the control signal instead of a generic clock.

## Board Clock Truth

- `CLK100MHZ` on package pin `W5` is treated as a **Basys3 board clock**, not as an ordinary manual stimulus row.
- `Run` / `Observe` auto-toggle that clock for the selected number of cycles.
- `Generate starter stimulus` no longer requires students to author `CLK100MHZ` pulse cells first.
- The waveform and Verify report record the auto-materialized clock values alongside the sampled outputs.
- If a design intentionally clocks from a switch or button, Verify keeps that row in **Manual pulses** or **Custom pattern** so students author the lane directly.
- A sim-only Clock component, even if an imported/synchronized row still has `W5` or `CLK100MHZ`, is not board-clock proof. It stays manual/import-only until replaced by the board resource.

## Batch 1 Product Audit Notes (2026-04-30)

- Supposed to do: be a testbench authoring surface with Observe, Expected Outputs, and Compare checks as distinct concepts.
- Current truth: the product uses Observe-first language, inline clock lanes, and Compare-backed trusted evidence. The mode selector now carries its own plain-language explainer so Observe is not mistaken for Compare.
- Determinism change needed: gates and surface copy must consistently treat Observe as inspection only and Compare PASS as the trusted proof boundary.
- Friction found: additive UI contracts like the inline mode explainer need direct tests so later chrome cleanup does not collapse Observe/Compare truth back into an unlabeled toggle.

## Design Handoff

`Open in Design` for a failed comparison must preserve the selected mismatch brief. Design should be able to say, for example: `Verify failed on LD0: expected 1, observed 0 at tick 4. Inputs: SW0=1, SW1=1. Inspect the logic path feeding LD0.`

## Data Contract (RBProject)

Reads:

1. `vectors`
2. `traceMetadata`
3. `recorder`
4. `probes`
5. `oscilloscope`
6. `ioMapping`
7. `circuit`

Writes (guarded):

1. `vectors`
2. `traceMetadata`
3. `recorder`
4. `probes`
5. `oscilloscope`
