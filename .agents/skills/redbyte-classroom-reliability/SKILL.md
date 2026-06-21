---
name: redbyte-classroom-reliability
description: Use when RedByte work touches project persistence, autosave, recovery, schema versions, corrupted storage, reload/back-forward behavior, multi-context rehearsals, classroom gates, or local-first reliability.
---

# RedByte Classroom Reliability

Use this skill when the question is whether 20-30 students can use RedByte at once without losing work, seeing stale trust, or getting stranded after reload/import/export.

## Required References

Read these before implementation:

- `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`
- `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`
- `docs/development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md`
- `docs/release/v1-release-checklist.md`
- `docs/rehearsal/failure-ticket-template.md`

## Reliability Model

Audit these before claiming classroom readiness:

- storage authority: localStorage, IndexedDB, `.rbproj`, ZIP, runtime persist;
- schema version and migration behavior;
- autosave and last-known-good recovery;
- write atomicity and corruption handling;
- multi-tab or multi-context behavior;
- reload, back/forward, deploy update, and stale asset behavior;
- console/page errors and error-boundary recovery.

## Implementation Pattern

Prefer small, reversible reliability layers:

1. Document the current storage model.
2. Add validation or explicit failure handling before broad migration.
3. Preserve user work before replacing or clearing storage.
4. Use isolated browser contexts for classroom rehearsal.
5. Capture traces on failure and record exact counts/timings.

Do not add accounts, a backend, collaboration, or automatic cloud sync unless a classroom user story proves it is necessary.

## Proof

Use pure tests for validators/migrations and browser gates for reload/recovery. For rehearsal, use repeated waves of isolated contexts against a built preview and report success/failure count, route time, console/page errors, storage failures, and trace paths.

## Eval Prompts

1. "Audit RedByte project persistence and tell me what can lose student work in a classroom."
2. "Add a 30-context rehearsal that proves Project, Design, Verify, Hardware, Export, and Import survive reload/back/forward."
3. "A corrupted saved project traps the app on startup; fix recovery without clearing all local storage."

## Baseline Comparison

| Eval | No-skill / old-skill risk | Expected with this skill | Objective checks |
|---|---|---|---|
| Persistence audit | Lists storage keys without risk ranking | Maps owners, failure modes, current proof, and pilot prerequisites | audit includes schema, atomicity, corruption, multitab, deploy update |
| 30-context rehearsal | Runs one browser session and extrapolates | Uses isolated contexts, repeated waves, meaningful actions, traces on failure | script reports 30 contexts, wave results, console/page errors |
| Corruption recovery | Clears storage destructively | Preserves last-known-good / backup route and fails closed | test proves corrupt item does not erase valid snapshot |
