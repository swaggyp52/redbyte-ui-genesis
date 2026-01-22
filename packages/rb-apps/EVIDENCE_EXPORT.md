# Evidence Export (Track 5.1)

## What does the “Export Lab Evidence” button do?

- Exports a single `.json` file containing all information needed for an instructor to grade a lab without re-running the circuit.
- The evidence bundle includes:
  - Circuit snapshot (nodes, wires, labels)
  - Selected example ID and perspective
  - Probe list and signal names
  - Oscilloscope trace metadata (tick range, sample count)
  - Simulation state (tick, running, tick rate)
  - Timestamp, app version/hash
  - Simple integrity hash (FNV-1a, deterministic)

## Determinism Guarantees

- The exported JSON is canonicalized (stable key ordering, stable array order for sets).
- The integrity hash is computed over the canonical JSON (excluding the hash field itself).
- Same app state → same evidence JSON bytes (except timestamp/filename).

## Instructor Usage

- Download the evidence file from the “Export Lab Evidence” button in the top toolbar.
- Inspect the JSON for grading: all required grading info is present.
- To verify integrity, re-hash the canonical JSON (excluding the `integrityHash`) using FNV-1a 32-bit.

## File Naming

- Files are named: `lab-evidence-YYYYMMDD-HHMMSS.json`

---

For more details, see the evidence schema in `evidenceSchema.ts`.
