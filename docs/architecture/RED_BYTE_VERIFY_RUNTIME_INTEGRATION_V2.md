---
doc_status: current
last_validated: 2026-06-21
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Verify runtime integration boundary
---

# RedByte Verify Runtime Integration V2

This doc records the Phase 3E boundary between the pure Verify truth statechart, the existing runtime/project/export authorities, and the rendered Verify workbench authority cutover.

## Purpose

`verifyTruthState.ts` defines the legal state machine. `verifyTruthAdapter.ts` feeds that model from current runtime records and now supplies rendered Verify authority for Course/My checks, expected-output editability, result status, sequential timing authority, Project verify status, and Export readiness.

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
- live and last-run `VerifyClockPolicy`
- live and last-run `VerifyScheduleContract`
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
- `selectors.timingClockSource`
- `selectors.timingActiveEdge`
- `selectors.timingResetMode`
- `selectors.clockLaneEditable`
- `selectors.sequentialRunEligibility`
- `selectors.timingStaleReason`
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
- Auto board-clock timing is generated/read-only in the testbench.
- Manual pulse timing exposes an editable clock lane and marks prior trusted results `staleTiming` when it differs from the trusted run.
- Custom clock patterns are unsupported in trusted novice Verify and must be rejected/disabled explicitly.
- `staleTiming` maps Project verify state to stale and Export readiness to draft-stale.
- Runtime compare failures with no comparison rows become `verify-error`, matching existing Project health behavior.

## Proof

`verify:truth-integration-gate` runs:

- `packages/rb-apps/src/apps/ide/__tests__/verifyTruthState.test.ts`
- `packages/rb-apps/src/apps/ide/__tests__/verifyTruthAdapter.test.ts`
- `packages/rb-apps/src/apps/ide/__tests__/projectWorkflowAuthority.test.ts`

The adapter tests prove Course/My check provenance, observe-only trust limits, current compare PASS, compare FAIL repair actions, stale design versus stale testbench classification, sequential timing stale classification, Project/Export authority consumption, and shadow equivalence with `deriveProjectVerifyState`.

`ide:gate:verify-v2-authority-cutover` proves the rendered student path:

- starter checks render as Course checks from V2 truth
- expected-output cells are locked/disabled with a duplicate explanation
- Duplicate to My checks converts the same checks into editable student-owned checks
- Compare remains available after duplication
- the rendered result authority exposes V2 result status, current/stale state, Project status, and Export readiness
- normal Verify UI does not reintroduce raw E-tier proof language

The gate is wired into `classroom:gate` and `verify:gates:classroom`.

`ide:gate:verify-sequential-authority-v2` proves the rendered clocked path:

- the Counter starter opens Verify with auto board-clock timing
- V2 timing copy names rising edge and read-only/generated clock authority
- the editable clock lane is hidden while auto board-clock owns the run
- Compare PASS is current with auto board-clock timing
- switching to manual pulses makes the prior PASS stale with `timing-changed`
- the manual clock lane and pulse controls become visible
- Project and Export agree the Verify evidence is stale before another Compare run

The gate is wired into `classroom:gate` and `verify:gates:classroom`.

## Non-Goals In This Slice

This slice does not change simulation semantics, does not change Compare execution, does not change generated artifacts, does not change pin mapping semantics, does not change project format, and does not claim Vivado/Basys3 hardware proof.

## Next Integration Step

The next Product Trust Reset v2 Verify slice should keep this authority boundary and broaden proof to multi-context persistence and a11y classroom rehearsal. It should not change simulation semantics, Compare execution, generated artifacts, pin mapping semantics, project format, or hardware proof claims unless a directly observed defect proves that necessary.

## Attribution

Connor Angiel
