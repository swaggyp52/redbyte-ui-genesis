# Student Export Bundle Schema (Locked Contract)

**Status**: IMMUTABLE as of 2026-01-18

Student app exports `.rb-lab.zip` containing the following **exact** file structure:

## Required Files

### `manifest.json`

```json
{
  "schema_version": "v1",
  "lab_id": "traffic-light",
  "student": {
    "id": "student-001",
    "name": "Test Student"
  },
  "created_at": "2026-01-18T...",
  "proof": {
    "capsule_path": "proofs/capsule.json",
    "events_path": "proofs/events.ndjson"
  }
}
```

**Validation in ingest**:
- `schema_version` MUST be `"v1"`
- `lab_id` REQUIRED
- `student.id` REQUIRED
- `student.name` REQUIRED  
- `created_at` REQUIRED
- `proof.capsule_path` REQUIRED (path inside ZIP)
- `proof.events_path` REQUIRED (path inside ZIP)

### `proofs/capsule.json`

```json
{
  "session_id": "capsule-1234567890",
  "lab_id": "traffic-light",
  "student_id": "student-001",
  "timestamp": "2026-01-18T...",
  "vectors": [],
  "summary": {
    "pass": 0,
    "fail": 0,
    "total": 0
  }
}
```

**Notes**:
- `vectors` array: populated when self-check runs occur (initially empty for submission)
- `summary`: counts of pass/fail test vectors; initially all zeros
- Used for grading + instructor timeline

### `proofs/events.ndjson`

**Always present** (can be empty or 0 bytes).

Example (populated):
```
{"type":"step_completed","tick":10,"timestamp":"2026-01-18T...","data":{"node_id":"switch_1","action":"toggled"}}
{"type":"attempt_started","timestamp":"2026-01-18T...","data":{"lab_id":"traffic-light"}}
```

**Notes**:
- NDJSON = newline-delimited JSON (one JSON object per line, no array wrapper)
- Can be empty file if no events recorded yet
- Used by instructor to track student progress + timeline

## Files NOT Included (Removed Scope)

- `activity.json` - removed; use events.ndjson instead
- `artifacts/` - reserved for future (screenshots, traces, exports)
- Other files - may fail ingest validation

## Validation Flow (Agent)

1. Extract ZIP
2. Parse `manifest.json`
3. Validate manifest schema (all required fields present + correct types)
4. Load `proofs/capsule.json` from path in manifest
5. Load `proofs/events.ndjson` from path in manifest (optional if empty)
6. Compute grade based on capsule vectors + summary
7. Write grade.json + grade.md to runs/ directory
8. Emit [FINAL] verdict (exit code 0=PASS, 1=FAIL, 2=INVALID)

## Student App Contract

1. **Export button** generates ZIP with this exact schema
2. **Hardcode labs** (traffic-light, etc.) with lab_id, title, description
3. **Student ID** = hardcoded or prompted (e.g., "student-001")
4. **Capsule** = empty vectors on initial export; populated after self-check
5. **Events** = empty file initially; populated as user interacts

## No More Changes to This Schema

Once this contract is locked, the student app export MUST:
- Always write all 3 files
- Never omit or rename files
- Keep manifest fields stable
- Keep capsule/events structure

Changes require version bump (e.g., `v2`) + migration logic.

---

**Locked by**: Agent AI + Connor Angiel  
**Date**: 2026-01-18  
**Reason**: Eliminate "guesswork" parsing; enable CI-safe ingest + instructor verification
