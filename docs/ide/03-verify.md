---
doc_status: current
last_validated: 2026-04-21
owner: Connor Angiel
used_by_claude: true
role: Verify surface spec
---

# Verify Mode Spec

Status: Phase 1 v1
Mode ID: `verify`

## Purpose

Run deterministic vector verification and present clear pass/fail proof.

## Primary Actions (max 3)

1. Execute vector run.
2. Inspect failure diffs.
3. Inspect signal traces and deterministic hash.

## Layout

1. **Command deck** (`VerifyCommandBar`): two rows — **Run** plus a **Stimulus / Assertions** procedure lens, framed **Experiment** block (scenario name from active scenario or last run or vector bucket label; **Case tN** readout; timing / lab mode line), utilities (**More actions**, **Analysis**, **Open in Design**); second row is **session** summary (status, meta, evidence). See `docs/IDE_SYSTEM_MAP.md` § Verify chrome.

2. **Workspace**: **Stimulus** (scenario library, canvas, workbench) and **waveform** instrument in a lab grid; waveform column is visually framed as the primary trace stage after a run.

3. **Side rails**: Signal lanes (left), inspector / console (per `IdeSurfaceLayout`).

4. **Analysis / failure**: Lower result region and drawer for diagnosis when runs fail (details vary by session state).

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
