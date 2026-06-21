---
doc_status: current
last_validated: 2026-06-21
owner: Connor Angiel
used_by_claude: true
role: Verify truth-state orchestration decision for Product Trust Reset v2
---

# ADR: Verify State Orchestration

## Status

Accepted for Product Trust Reset v2 Phase 3 foundation and Phase 3B runtime integration.

## Context

Verify already has several correct local authorities:

- `projectRuntime.ts` owns runs, run history, scenarios, vectors, and project health.
- `verifyScenario.ts` owns scenario versioning and scenario/stimulus hashes.
- `verifyProjectHash.ts` owns current design/vector/mapping freshness hashing.
- Verify viewmodels derive visible status from runtime and run evidence.
- `StimulusCanvas.tsx` lets the student edit expected outputs.

The product gap is that these pieces did not form a single explicit state model for student-facing truth. That makes Course checks versus My checks, expected versus observed values, stale evidence, PASS/FAIL, selected failures, and repair actions too easy to represent ambiguously.

## Decision

Add a pure Verify truth-state model at `packages/rb-apps/src/apps/ide/verifyTruthState.ts`.

The model defines:

- `unavailable`, `needsTestbench`, `ready`, `running`, `passed`, `failed`, `staleDesign`, `staleTestbench`, and `runtimeError`
- `DESIGN_CHANGED`, `CHECK_SET_CHANGED`, `SCENARIO_CHANGED`, `RUN_REQUESTED`, `RUN_COMPLETED`, `RUN_FAILED`, `FAILURE_SELECTED`, `COURSE_CHECK_DUPLICATED`, `STUDENT_CHECK_EDITED`, and `RESET`
- explicit `designRevision`, `scenarioRevision`, and `checkSetRevision`
- Course checks versus student checks
- locked expected-output reasons for Course checks
- editable My checks
- observed values attached to completed runs
- selected failure and repair-action derivation
- sequential timing mode carried from requested run to completed run

The initial pure-model proof is `verify:truth-state-gate`, a focused Vitest gate for legal and illegal state transitions.

Phase 3B adds `packages/rb-apps/src/apps/ide/verifyTruthAdapter.ts` and `docs/architecture/RED_BYTE_VERIFY_RUNTIME_INTEGRATION_V2.md`. The adapter feeds existing runtime/scenario/hash records into the state model and derives legacy-compatible Project verify state plus Export readiness selectors. The current source-level proof is `verify:truth-integration-gate`, which includes the pure-model tests and adapter equivalence tests.

## Consequences

- PASS and FAIL can only come from completed Compare runs tied to the current revisions.
- Observe runs can record observed values but do not become trusted PASS or FAIL.
- Course checks are locked by default; editing requires duplicating into a student-owned check.
- Editing a student check invalidates prior trusted results as `staleTestbench`.
- Design edits invalidate prior trusted results as `staleDesign`.
- Failure repair affordances can distinguish Fix circuit from Edit my check without guessing from display copy.

## Integration Plan

1. Make rendered Verify consume `verifyTruthAdapter.ts` selectors from existing runtime/scenario/hash owners.
2. Replace ambiguous Verify expected-output controls with Course checks and My checks.
3. Keep viewmodels as surface adapters, not independent truth authorities.
4. Add browser gates after UI integration: PASS, FAIL, duplicate Course check, edit My check, stale design, stale testbench, selected failure repair, Project readiness, Export readiness, and sequential timing visibility.

## Non-Goals

- No simulator behavior changed.
- No Verify generated evidence changed.
- No project format changed.
- No mapping, VHDL, XDC, testbench, Tcl, ZIP, or golden artifact changed.
- No Vivado/Basys3 proof was run or claimed.

## Attribution

Connor Angiel
