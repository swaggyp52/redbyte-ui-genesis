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


## Current P2.6B experiment model (2026-09-12)

With no circuit, the instrument yields to the start instructions. Design, the existing starter picker and Import/Recover are direct actions; external VCD import stays available. Browsing starters preserves current work. The current instrument stylesheet owns this empty-state rule.

The linked investigation reserves its shared controls above two independently scrolling panes. Focusing Time must not obscure the recording header; the trace retains a useful minimum height, and its event-editor disclosure stays below it. One recorded execution says no repeat yet; identical counts describe comparisons after reproduction.

Review refinement: Time uses Up/Down to select a lane and Left/Right to move the tick. Space/Enter edits only the selected authored input; generated clock and recorded output lanes cannot mutate stimulus. Child controls retain their own keyboard actions. Combinational Table inputs remain directly editable. Pre-run check context says no recording.

This section supersedes the representation/run-line/mode descriptions below where they conflict.
Run evaluates saved optional checks automatically; no Observe/Compare fork or Live I/O peer.
Reproduce executes the selected recording's retained design/stimulus/engine, leaving edits intact.
The visible identity strip owns digest, check result, repetition count and recording selection.
Full values and the FNV-1a/sample-comparison definition are under Run details. Legacy records
without execution inputs cannot be reproduced and explain why.

Sequential work stays in Time: authored lanes, actual recorded output/internal lanes, cursor,
A/B measurement, transition/failure navigation and recorded playback. Expected values are an
optional overlay, never substituted for observations. Table remains the combinational default;
Recorded trace is its alternative. Details and circuit investigation are mutually exclusive,
explicit auxiliary views. No default lower Inspect/Checks/Vectors deck.

Circuit investigation uses retained topology and samples. Driver, capturing edge and authored
stimulus are clickable only when topology and chronology support them; missing/ambiguous
evidence stops the chain. Imported VCD is a separate disclosure and always external evidence.

## Purpose

Provide a simulation-first workspace: author a scenario, run deterministic simulation, inspect waveform or circuit replay, and add expected-output assertions when useful.

## One experiment, one primary working area (2026-09-07)

This section supersedes the deck/splitter composition described below and the three-document
Cases / Timing / Waveform vocabulary wherever they conflict.

A scenario is **one experiment**, drawn one way at a time in **one primary region**:

| Representation | What it draws | Default for |
|---|---|---|
| **Timeline** (`ide-verify-view-timeline`) | `TimingLab` / `TimingLanes`: one lane per signal on a time axis, events where the reader places them, outputs as expected-over-observed | a clocked circuit |
| **Table** (`ide-verify-view-table`) | `CaseLab`: one row per case, inputs beside expected and observed | a combinational circuit |
| **Waveform** (`ide-verify-view-waveform`) | `WaveformViewer`: the recorded trace, with cursors and measurement | never a default; enabled once a run exists |

The circuit chooses the default; a reader who says otherwise says it for that scenario, and it is
remembered while the scenario is open. The switch renders inside whichever region is currently
primary - the stimulus region for Timeline and Table, the trace region for Waveform - so the way
back is where the way in was. Switching representation never opens a document and never a tab.

**The run line** (`ide-verify-run-line`) sits under the instrument in every representation and
holds what the last run did: the verdict summary with its details disclosure and `Inspect with
circuit`, the live readout, edge navigation, the failure focus, and the tail actions
(`Check…` / `Watch` / `Inspect run`). Its grid track is `fit-content(34%)`, so however much it has
to say the instrument keeps two thirds of the workspace. Before a run it renders
`ide-verify-run-line-empty`: "No run recorded yet", with the authored case count.

**The trace toolbar** (`ide-verify-waveform-cmd`) is rendered only in the Waveform representation
and holds what describes a drawn trace: case stepping, the tick range (`All ticks` / `Fail window`
/ `Selected`), the radix, the expected overlay, the tick scrubber, and playback. `View and measure`
(zoom, row density, A/B cursors) is a disclosure in the same representation.

**Retired with this composition:** the Cases/Evidence deck splitter (`ide-verify-deck-handle`), its
collapse and maximize controls, the collapsed evidence strip, and the persisted deck fraction.
Simulate no longer reads or writes `workspacePreferences.simulate`.

**Measured** at 1280x650 on the two-bit counter after a run: primary region 376px, run line 91px,
timeline lanes 244px, 0 tabs, 0 document overflow. At 1440x900 in the Waveform representation the
canvas fills 527px of its 717px region.

**Input combinations** is stated for a combinational circuit and withheld for a clocked one: 2^n is
the size of a truth table, which is the specification of a combinational circuit, and says nothing
about a design whose output depends on the state it is in.

**Direct editing and the cursor.** Every column the ruler draws holds the cursor, including the
spare columns past the last authored event - the readout, the header chip and the drawn cursor
always name the same tick. Clicking the tick number selects that tick: the number, the grid line
and the edge marker are decoration and do not take the click. The event editor edits the event at
the cursor and says so when there is none ("No event at t7. Click a stimulus cell in that column
to drive an input there, or use + Add event"), rather than silently editing the first event in the
scenario. The ruler's spare columns follow the experiment, not the cursor, so selecting one column
does not re-fit the tick width and move the rest.

**The alternate editors are bounded.** "Event table", "Edit event at tN" and "Generators and full
event editor" are disclosures the reader opens. An open one takes a bounded, scrolling share
(55% of the region) and the instrument keeps a 132px floor: opening the generators takes the
lanes from 432px to 153px, not to 1px, and every control in the composer bar above still answers
at its own coordinates.

**At hostile scales the instrument is floored and the workspace scrolls.** At 1024x720, at 200%
text and at 720x450 (a 1440x900 machine at 200% browser zoom) the trace canvas keeps a 160px
floor, the case table's failure navigation is painted rather than clipped, and the stacked
template gives the primary instrument 180-220px before the contextual inspector gets anything.
Where the floors add up to more than the window, `.rb-sim-lab-frame` scrolls.

**Imported evidence.** `VcdAnalyzerPanel` is always mounted and compacts itself: with nothing
imported it is one row naming the provider and offering Load, and it is the only `.vcd` route on
the surface. `SimulationProviderBar` appears once there is a second source to choose between.

**Signal identity.** The rail groups a lane as Inputs / Outputs / Internal by name. A normalised
name claimed by more than one thing in the circuit resolves to nothing and cannot credit a lane to
the boundary; only a lane carrying the boundary's own display name may do that. The two-bit
counter is the case: its io row for the board pin is `{ id: 'q0', label: 'LD0' }` and the D
flip-flop driving it is labelled `Q0`, so the register used to be counted as a board output
("Outputs 4 / Internal 0" for a circuit with two pins and two registers). Owners come from
`buildWaveformSignalAliasOwners`; `buildCanonicalWaveformSignalAliases` is the subset that resolves
and `buildAmbiguousWaveformSignalKeys` the subset that does not.

## Simulation & Replay Studio v1 current contract (2026-07-26)

This section supersedes older Observe/Compare chrome descriptions below where wording conflicts. The current student loop is:

```text
Scenario -> Run simulation -> Inspect replay -> Optional checks
```

- **Scenario** owns stimulus. A new testbench preserves useful stimulus/policy context but begins with no expected-output checks.
- **Run simulation** always executes the current scenario and records deterministic ticks when the design is runnable.
- **Replay** exposes the waveform and opens the same trace through the existing read-only Design `replaySession`; it does not create a second schematic renderer or editable simulation canvas.
- **Checks** are optional expected-output assertions. No-check runs report `Simulation complete` plus `No checks configured` and never FAIL.
- Runtime simulation status and assertion status are independent. A failed assertion does not erase or downgrade the completed simulation or its replay.
- Behavioral evidence tiers are **Draft** (no current usable run), **Simulated** (current completed run without all checks passing), and **Validated** (current run with all configured checks passing). Only Validated can support trusted Export.

## Primary Actions (max 3)

1. Run simulation for the current scenario.
2. Author clock/stimulus cases and inspect waveform or circuit replay.
3. Optionally add checks; on mismatch, use the visible repair summary and detailed diffs.

## Layout

0. **Studio procedure**: Scenario, Replay, and Checks lenses keep stimulus authoring, recorded evidence, and optional assertions distinct.

1. **Command deck** (`VerifyCommandBar`): a primary command band — **Run** plus a **Stimulus / Checks** procedure lens, framed **Experiment** block (scenario name from active scenario or last run or vector bucket label; **Case tN** readout; timing / lab mode line), explicit **Observe only** vs **Compare checks** selector with inline explainer (`ide-vcb-mode-explainer`), then utilities (**Tools**, **Details**, **Open in Design**) — plus a second **session** summary row (status, meta, evidence). At compact/stress widths of `<=1200px`, the primary band reflows into a two-column / two-row grid so both mode labels remain full and status/truth content cannot overlap the mode selector. See `docs/IDE_SYSTEM_MAP.md` § Verify chrome.

2. **Workspace**: Scenario keeps the named document library, clock/timing guidance, and stimulus grid primary. Replay keeps waveform/observed evidence primary after a run. Checks exposes the optional expected-output lanes without forcing them into first-run stimulus authoring.

3. **Clock / timing panel**: sequential designs surface a detected clock policy, not just a raw lane. A Basys3 board clock such as `CLK100MHZ` / `W5` defaults to **Auto board clock** with run-cycle control, edge/reset summary, and explicit manual-override actions. Non-board inferred clock rows, including switch/button-clocked labs, stay in **Manual pulses** rather than auto-running as a board oscillator.

4. **Side rails**: Signal lanes (left), inspector / console (per `IdeSurfaceLayout`).

5. **Analysis / failure**: A failing Compare keeps a compact visible result summary beside waveform evidence: FAIL state, passed/failed counts, high-level cause guidance, `Open Design`, and `Review expected outputs`. `Failure details` is an explicit disclosure beneath that summary. Opening it reveals the first failed case, failed signal, expected bit, observed bit, input vector, repair scope, and granular expected/testbench versus design-repair actions. Students may then edit expected values, use observed for one cell / the selected row / all failed outputs, inspect Design, or rerun Compare. A selected failed case also produces a compact `VerifyDebugContext` for Design: raw signal key, student label, expected/observed bits, tick/case context, input snapshot, pattern summary, and next-inspection hint. Design may then show direct-driver facts plus a bounded upstream signal trace; Verify must still require a fresh Compare before treating the repair as current evidence.

6. **Run summary**: before a run, show driven inputs, optional checked outputs, case/tick count, and timing policy. After a run, show simulation completion first, assertion status second, then the selected tick, observed values, and replay evidence.

Rows and cases in Verify are authored **ticks/testbench steps**. In **auto board clock** mode, Verify starts the shared vector sequence at cycle 0 and materializes `max(runCycles, authored-row count, 1)` rows; every visible Auto result row is sampled post-rising-edge. When automatic reset applies, its assertion is materialized in cycle 0 and its later deassertion remains in the same sequence—there is no hidden runtime reset prelude. In **manual** or **custom pattern** mode, each authored row is one settled sample and drives the actual resolved clock input from the authored value. Only a low-to-high transition advances the supported rising-edge state model; repeated high, high-to-low, repeated low, and flat-low rows hold state. Manual/custom execution also injects no hidden reset.

## Named document and sequential policy authority

Each named testbench is one browser-local authored document. The document owns:

1. stable document ID and editable name
2. combinational cases or explicit sequential steps
3. stimulus and expected values
4. version/content hashes used for freshness
5. when sequential, its own execution policy: override mode, run cycles, active edge, reset behavior, detected source/execution type, optional signal/reset identity, and starting level

The policy is not a global Verify preference. Switching testbenches switches policy. A new document intentionally inherits compatible stimulus and policy context but clears expected-output assertions so it begins as a simulation scenario, not a prevalidated oracle. Duplicate preserves the full authored document. Rename, duplicate, saved-project reload, previous-session recovery, scenario-library repair, and manifest recovery preserve valid document intent. Compatible Design edits reconcile live signal identity while keeping the document; removed references remain reviewable and current proof is revoked until repair/rerun.

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

`Simulation complete` with:

1. Stable hash and deterministic run metadata.
2. Readable waveform and circuit replay.
3. Independent check status: no checks, passing, or failing.
4. Current passing assertions only when the run can authorize trusted Hardware/Export handoff.

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
