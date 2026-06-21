---
doc_status: current
last_validated: 2026-06-21
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Verify runtime integration boundary
---

# RedByte Verify Runtime Integration V2

This doc records the Phase 3C boundary between the pure Verify truth statechart, the existing runtime/project/export authorities, and the rendered Verify workbench authority cutover.

## Purpose

`verifyTruthState.ts` defines the legal state machine. `verifyTruthAdapter.ts` feeds that model from current runtime records and now supplies rendered Verify authority for Course/My checks, expected-output editability, result status, Project verify status, and Export readiness.

The adapter exists so the Verify UI consumes one truth model instead of re-deriving PASS, FAIL, stale, course-check editability, observed values, and repair actions inside JSX.

## Authoritative Inputs

The adapter reads these existing authorities:

- runtime scenario vectors and the active `VerifyScenario`
- `RuntimeVerifyRun` for observed/compare results
- run kind from `getRuntimeVerifyRunKind`
- scenario version, scenario content hash, and scenario stimulus hash
- latest `VerifyRunLedgerEntry.projectHash`
- current Verify project hash
- `dirtySinceVerify`
- project kind / starter identity when deriving Course versus My check provenance

The adapter does not persist new state. Runtime storage remains owned by `projectRuntime.ts`, project health remains owned by `projectHealth.ts`, and workflow/export trust remains owned by `projectWorkflowAuthority.ts` until those views are intentionally migrated.

## Derived Outputs

`buildVerifyTruthStateFromRuntime` returns:

- `state`: a `VerifyTruthState`
- `selectors.projectVerifyState` / `selectors.projectVerifyStatus`: the legacy-compatible `ProjectVerifyState`
- `selectors.exportReadiness`: trusted-ready, draft, stale, failed, observe-only, blocked, or verify-error status
- `selectors.projectStatusText`: plain student-facing status text for later UI consumption
- `selectors.selectedCheckSet`
- `selectors.selectedCheckProvenance`
- `selectors.canEditExpected`
- `selectors.lockedReason`
- `selectors.resultStatus`
- `selectors.resultIsCurrent`
- `selectors.staleReason`
- `selectors.canRunObserve`
- `selectors.canRunCompare`
- `selectors.canExportTrusted`
- selected failure and provenance-aware repair actions
- invariant problems from `assertVerifyTruthInvariants`

## Current Invariants

- Observe-only runs can run with no checks, but they cannot become trusted PASS or FAIL.
- Compare runs require at least one check.
- PASS and FAIL come only from current Compare runs.
- Course checks are locked and require duplication before expected-output edits.
- My checks are editable.
- Design/hash dirtiness marks prior results as `staleDesign` unless scenario/check hashes prove the stale source is the testbench.
- Scenario id or stimulus hash changes mark prior results as `staleTestbench` with scenario-change reason.
- Scenario content hash changes with the same stimulus mark prior results as `staleTestbench` with check-set-change reason.
- Runtime compare failures with no comparison rows become `verify-error`, matching existing Project health behavior.

## Proof

`verify:truth-integration-gate` runs:

- `packages/rb-apps/src/apps/ide/__tests__/verifyTruthState.test.ts`
- `packages/rb-apps/src/apps/ide/__tests__/verifyTruthAdapter.test.ts`
- `packages/rb-apps/src/apps/ide/__tests__/projectWorkflowAuthority.test.ts`

The adapter tests prove Course/My check provenance, observe-only trust limits, current compare PASS, compare FAIL repair actions, stale design versus stale testbench classification, Project/Export authority consumption, and shadow equivalence with `deriveProjectVerifyState`.

`ide:gate:verify-v2-authority-cutover` proves the rendered student path:

- starter checks render as Course checks from V2 truth
- expected-output cells are locked/disabled with a duplicate explanation
- Duplicate to My checks converts the same checks into editable student-owned checks
- Compare remains available after duplication
- the rendered result authority exposes V2 result status, current/stale state, Project status, and Export readiness
- normal Verify UI does not reintroduce raw E-tier proof language

The gate is wired into `classroom:gate` and `verify:gates:classroom`.

## Non-Goals In This Slice

This slice does not change simulation semantics, does not change Compare execution, does not change generated artifacts, does not change pin mapping semantics, does not change project format, and does not claim Vivado/Basys3 hardware proof.

## Next Integration Step

The next Product Trust Reset v2 Verify slice should finish removing legacy local derivations for:

- staleDesign/staleTestbench reason presentation
- selected failure repair display
- sequential timing visibility
- browser proof for stale invalidation and repair guidance using the V2 model

## Attribution

Connor Angiel
