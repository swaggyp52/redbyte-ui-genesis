---
doc_status: current
last_validated: 2026-04-28
owner: Connor Angiel
used_by_claude: true
role: Verify surface spec
---

# Verify Mode Spec

Status: Phase 2A foundation
Mode ID: `verify`

## Purpose

Run deterministic vector verification and present clear pass/fail proof for downstream Hardware and Export trust.

## Primary Actions (max 3)

1. Execute vector run.
2. Inspect failure diffs.
3. Inspect signal traces and deterministic hash.

## Layout

1. **Command deck** (`VerifyCommandBar`): two rows — **Run** plus a **Stimulus / Assertions** procedure lens, framed **Experiment** block (scenario name from active scenario or last run or vector bucket label; **Case tN** readout; timing / lab mode line), utilities (**More actions**, **Analysis**, **Open in Design**); second row is **session** summary (status, meta, evidence). See `docs/IDE_SYSTEM_MAP.md` § Verify chrome.

2. **Workspace**: **Stimulus** (scenario library, canvas, workbench) and **waveform** instrument in a lab grid; waveform column is visually framed as the primary trace stage after a run.

3. **Side rails**: Signal lanes (left), inspector / console (per `IdeSurfaceLayout`).

4. **Analysis / failure**: Lower result region and drawer for diagnosis when runs fail. A selected failed case produces a compact `VerifyDebugContext` for Design: raw signal key, student label, expected/observed bits, tick/case context, input snapshot, pattern summary, and next-inspection hint.

## Empty State

Headline: `No test vectors yet`
Primary CTA: `Add vectors in Project Mode`
Secondary action: `Open sample vector format`

## Error State

1. Runtime failure callout with details.
2. Determinism mismatch callout with expected vs actual hash.
3. Missing signal mapping warning list.

## Success State

`Verification PASS` with:

1. Stable hash.
2. Zero failing rows.
3. Timestamp-free deterministic run metadata.
4. Current assertion-backed PASS status that can authorize trusted Hardware/Export handoff.

Trace-only, stale, failing, or incomplete-mapping runs remain useful evidence, but they do not complete the Verify proof stage.

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
