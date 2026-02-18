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

1. Top banner
- PASS/FAIL status.
- Deterministic hash.
- Run summary (vectors passed/failed).

2. Main center
- Results table: tick, signal, expected, actual, status.

3. Right inspector
- Signal picker.
- Lightweight waveform preview.

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
