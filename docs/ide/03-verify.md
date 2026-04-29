---
doc_status: current
last_validated: 2026-04-29
owner: Connor Angiel
used_by_claude: true
role: Verify surface spec
---

# Verify Mode Spec

Status: testbench authority update
Mode ID: `verify`

## Purpose

Run deterministic testbench verification and present clear pass/fail proof for downstream Hardware and Export trust.

## Primary Actions (max 3)

1. Execute vector run.
2. Author clock/stimulus cases for the current design.
3. Inspect failure diffs, signal traces, and deterministic hashes.

## Layout

1. **Command deck** (`VerifyCommandBar`): two rows — **Run** plus a **Stimulus / Checks** procedure lens, framed **Experiment** block (scenario name from active scenario or last run or vector bucket label; **Case tN** readout; timing / lab mode line), utilities (**More actions**, **Analysis**, **Open in Design**); second row is **session** summary (status, meta, evidence). See `docs/IDE_SYSTEM_MAP.md` § Verify chrome.

2. **Workspace**: **Build testbench** (scenario library, clock/timing guidance, unified stimulus/check grid, run summary) and **waveform** instrument in a lab grid. The left setup area keeps enough width and height to author the testbench after a run; the waveform column remains the primary trace stage.

3. **Clock / timing panel**: sequential designs show a compact guidance banner plus a highlighted clock lane inside the main stimulus grid. The lane distinguishes physical board clock mapping from deterministic Verify stimulus, exposes inline `Alternating`, `Add pulse`, `Hold low`, and `Hold high` actions with a shared row count, and keeps normal direct cell editing available.

4. **Side rails**: Signal lanes (left), inspector / console (per `IdeSurfaceLayout`).

5. **Analysis / failure**: Lower result region and drawer for diagnosis when runs fail. A selected failed case produces a compact `VerifyDebugContext` for Design: raw signal key, student label, expected/observed bits, tick/case context, input snapshot, pattern summary, and next-inspection hint.

6. **Run summary**: the setup column carries a compact summary of driven inputs, checked outputs, case/tick count, clock activity, and whether Compare checks are armed. This is the pre-run truth students should read before pressing `Run Compare checks`.

Rows and cases in Verify are authored **ticks/testbench steps**, not whole clock cycles. Sequential progress requires an authored rising edge in the active clock lane, so a usable pulse is multiple cases such as `0 -> 1 -> 0`.

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

When a current run becomes stale, the copy must say why:

1. `Design changed - rerun Compare`
2. `Testbench changed - rerun Compare`
3. Mapping-driven downstream review in Export / Hardware when bindings changed

For sequential circuits, current proof requires useful timing stimulus. A clock row that never produces a rising edge is still visible for inspection, but it does not satisfy the "clock activity" guidance for register updates. Latch-control designs use the same panel but describe the control signal instead of a generic clock.

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
