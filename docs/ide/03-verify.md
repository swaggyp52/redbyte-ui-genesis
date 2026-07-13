---
doc_status: current
last_validated: 2026-07-13
owner: Connor Angiel
used_by_claude: true
role: Verify surface spec
---

# Verify Mode Spec

Status: board-clock verify truth update
Mode ID: `verify`

## Purpose

Run deterministic testbench verification and present clear pass/fail proof for downstream Hardware and Export trust.

## Primary Actions (max 3)

1. Execute vector run.
2. Author clock/stimulus cases for the current design.
3. Use the visible failure summary, then open `Failure details` for granular diffs, repair scopes, signal traces, and deterministic hashes.

## Layout

0. **Guide rail**: Compact `What do I do next?` copy tells students to run Observe, edit expected outputs, and then Compare until saved checks pass.

1. **Command deck** (`VerifyCommandBar`): two rows — **Run** plus a **Stimulus / Checks** procedure lens, framed **Experiment** block (scenario name from active scenario or last run or vector bucket label; **Case tN** readout; timing / lab mode line), explicit **Observe only** vs **Compare checks** selector with inline explainer (`ide-vcb-mode-explainer`), then utilities (**Tools**, **Details**, **Open in Design**); second row is **session** summary (status, meta, evidence). See `docs/IDE_SYSTEM_MAP.md` § Verify chrome.

2. **Workspace**: **Build testbench** (scenario library, clock/timing guidance, unified stimulus/check grid) and **waveform** instrument in a lab grid. The first-run starter path keeps the stimulus and expected-output editor visible and names the four student concepts: Inputs to try, Expected outputs, Observed outputs, and Status. After a run, the left setup area stays editable but removes first-run teaching chrome so stimulus/check edits and waveform evidence remain readable together.

3. **Clock / timing panel**: sequential designs surface a detected clock policy, not just a raw lane. A Basys3 board clock such as `CLK100MHZ` / `W5` defaults to **Auto board clock** with run-cycle control, edge/reset summary, and explicit manual-override actions. Non-board inferred clock rows, including switch/button-clocked labs, stay in **Manual pulses** rather than auto-running as a board oscillator.

4. **Side rails**: Signal lanes (left), inspector / console (per `IdeSurfaceLayout`).

5. **Analysis / failure**: A failing Compare keeps a compact visible result summary beside waveform evidence: FAIL state, passed/failed counts, high-level cause guidance, `Open Design`, and `Review expected outputs`. `Failure details` is an explicit disclosure beneath that summary. Opening it reveals the first failed case, failed signal, expected bit, observed bit, input vector, repair scope, and granular expected/testbench versus design-repair actions. Students may then edit expected values, use observed for one cell / the selected row / all failed outputs, inspect Design, or rerun Compare. A selected failed case also produces a compact `VerifyDebugContext` for Design: raw signal key, student label, expected/observed bits, tick/case context, input snapshot, pattern summary, and next-inspection hint. Design may then show direct-driver facts plus a bounded upstream signal trace; Verify must still require a fresh Compare before treating the repair as current evidence.

6. **Run summary**: the setup column carries a compact summary of driven inputs, checked outputs, case/tick count, clock activity, and whether Compare checks are armed before the first run. After a run, that summary is demoted so PASS/FAIL state, first mismatch, expected/observed values, and waveform evidence are the first-order objects.

Rows and cases in Verify are authored **ticks/testbench steps**. In **auto board clock** mode, Verify treats each visible tick as one sampled cycle and materializes the low/high clock sequence internally, so students do not have to author `CLK100MHZ` pulses by hand. In **manual** or **custom pattern** mode, sequential progress still comes from authored clock activity in the clock lane.

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

Trace-only, stale, failing, or incomplete-mapping runs remain useful evidence, but they do not complete the Verify proof stage.

The Verify evidence signature is tied to the same normalized current-project hash that workflow authority compares: circuit, project vectors, custom vectors, and project I/O mapping. Vector UI IDs are ignored for trust so helper-generated clock rows do not create a phantom stale loop after the run completes.

`ide:gate:verify-evidence-workbench` guards the classroom Verify evidence path: visible first-run expected-output editing, Observe-only waveform evidence that is not trusted proof, Compare PASS, intentional expected-output edit to FAIL, visible failure summary, disclosed first-mismatch expected/observed evidence, waveform controls, repair back to PASS, and no meaningful overlap between stimulus and waveform evidence regions. The underlying script remains `scripts/gates/ide-verify-evidence-workbench-integrity.mjs`.

`ide:gate:verify-postrun-workbench-usability` also guards the post-run command deck: visible `Observe only` and `Compare checks` labels must remain readable through Compare PASS, induced FAIL, repair PASS, and the workbench toggle path at `1366x768` and `1440x900`.

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
