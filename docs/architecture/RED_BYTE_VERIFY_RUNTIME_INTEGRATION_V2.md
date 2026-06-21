---
doc_status: current
last_validated: 2026-06-21
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Verify runtime integration boundary
---

# RedByte Verify Runtime Integration V2

This doc records the Phase 3B boundary between the pure Verify truth statechart and the existing runtime/project/export authorities.

## Purpose

`verifyTruthState.ts` defines the legal state machine. `verifyTruthAdapter.ts` is the shadow integration layer that feeds that model from current runtime records without changing the rendered Verify surface yet.

The adapter exists so the next Verify UI rebuild can consume one truth model instead of re-deriving PASS, FAIL, stale, course-check editability, observed values, and repair actions inside JSX.

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
- `selectors.projectVerifyState`: the legacy-compatible `ProjectVerifyState`
- `selectors.exportReadiness`: trusted-ready, draft, stale, failed, observe-only, blocked, or verify-error status
- `selectors.projectStatusText`: plain student-facing status text for later UI consumption
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

The adapter tests prove Course/My check provenance, observe-only trust limits, current compare PASS, compare FAIL repair actions, stale design versus stale testbench classification, and shadow equivalence with `deriveProjectVerifyState`.

The gate is wired into `classroom:gate` and `verify:gates:classroom`.

## Non-Goals In This Slice

This slice does not rebuild the rendered Verify UI, does not change simulation semantics, does not change Compare execution, does not change generated artifacts, does not change pin mapping semantics, does not change project format, and does not claim Vivado/Basys3 hardware proof.

## Next Integration Step

The next Product Trust Reset v2 Verify slice should make rendered Verify consume these selectors for:

- Testbench authoring around Course checks versus My checks
- Results around observed output, selected failure, repair action, and stale reason
- Project readiness copy from the same selector boundary
- Export readiness copy from the same selector boundary
- focused browser gates for the rendered workbench

## Attribution

Connor Angiel
