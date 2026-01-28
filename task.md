# Virtual Lab MVP-1 Reliability Tasks

Updated: 2026-01-28

## Status
- [x] Invariants and fingerprinting (canonical JSON, stable hash, SHA-256)
- [x] Store recovery state machine with deterministic truncation and integrity events
- [x] Import/export hardening with capsule hash + seed
- [x] Performance guards with reconstruction timing
- [x] Fuzz suite (basic, mode switch, stress, repair)
- [x] Documentation refresh

## Notes
- Unverified capsules open in read-only replay mode.
- Integrity recovery emits INTEGRITY_RECOVERY and truncates future events.
- Snapshots store traceHash and optional async fingerprint.
