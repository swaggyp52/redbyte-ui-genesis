---
name: redbyte-verify-truth-steward
description: Use when RedByte work touches Verify semantics, expected or observed outputs, Course checks, My checks, Compare PASS/FAIL/STALE, failure repair, sequential timing, or Verify state ownership.
---

# RedByte Verify Truth Steward

Use this skill before changing Verify runtime state, scenario/check authoring, result display, or any UI that can make a student confuse authored expectations with simulated observations.

## Required References

Read these before implementation:

- `docs/contracts/RED_BYTE_VERIFY_TRUTH_MODEL_V2.md`
- `docs/product/RED_BYTE_STUDENT_UI_CONTRACT_V2.md`
- `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`
- `docs/IDE_SYSTEM_MAP.md`
- `.redbyte-brain/verify-truth-model-audit.md`

## Truth Rules

- Observed outputs are produced by simulation, read-only, and never student-edited.
- Expected outputs are Compare references and editable only in explicit Testbench Authoring.
- Course checks are labeled, locked by default, and never silently editable to manufacture PASS.
- My checks are labeled, editable in Testbench mode, and any edit invalidates the current result.
- Compare result is computed/read-only and valid only for the current design, check-set, and scenario revisions.
- FAIL must identify signal, case, tick/time, expected, observed, provenance, and the allowed repair action.

## Implementation Pattern

Prefer a pure model first:

1. Name the state owner and mutation path.
2. Add or update typed events and revision fields.
3. Make stale reasons explicit.
4. Write invariant tests before UI.
5. Wire UI to derived state instead of creating new surface truth.

Use XState only after an ADR and spike prove it beats a typed reducer/statechart for this repo.

## Proof

Minimum proof for Verify truth work:

- pure invariant tests for state transitions;
- focused React or browser proof for any rendered workflow;
- no changes to simulation, generated artifacts, pin mapping, goldens, or hardware-proof claims unless explicitly required and proven.

## Eval Prompts

1. "Fix Verify so a locked course check fail only offers Fix circuit, while a duplicated My check fail offers Edit my check."
2. "After a Compare PASS, editing expected outputs should make the result stale immediately and remove trusted PASS styling."
3. "Map the current Verify state owners and propose whether XState v5 or a typed reducer is the better architecture."

## Baseline Comparison

| Eval | No-skill / old-skill risk | Expected with this skill | Objective checks |
|---|---|---|---|
| Locked fail repair | Adds another button in JSX and lets course checks be edited | Locks course checks by provenance and gates repair actions from state | test proves `canEditExpected=false`, no Edit check action |
| Stale after edit | Leaves PASS visible until rerun or only changes copy | Emits `STUDENT_CHECK_EDITED` -> staleTestbench with stale reason | test proves PASS invalidated by check-set revision change |
| Architecture choice | Picks XState or reducer by preference | Compares current, typed reducer/statechart, and XState against repo criteria | ADR table covers explicitness, impossible states, serialization, testability, migration risk |
