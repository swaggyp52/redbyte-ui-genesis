---
type: architecture
status: active
area: verify
updated: 2026-03-29
related:
  - "[[Verify Hint System]]"
  - "[[Connection Model]]"
  - "[[Test Infrastructure]]"
  - "[[BUG-003 React.act Infrastructure Failure]]"
  - "[[BUG-004 Verify Hash Includes Non-Circuit Fields]]"
  - "[[BUG-006 TRACE vs VERIFY Mode Collapse]]"
  - "[[2026-03-25 Verify Refactor Plan]]"
---

# Verify Engine

Full reference for the Verify pipeline: how a run is triggered, what it computes, where truth comes from, and where the current implementation still diverges from the intended model.

## Overview

Verify currently spans three layers:

1. `projectRuntime.ts` + `sim/simEngineCore.ts` own the actual deterministic run.
2. `buildVerifySessionViewModel.ts` defines the intended student-facing session model.
3. `IdeApp.tsx` + `surfaces/VerifySurface.tsx` decide which hash, vectors, and banners the student actually sees.

The deterministic engine itself does run against a fresh circuit + IO snapshot. The weak spots are the layers above it: freshness is still computed in multiple ways and the scenario/session model is only partially live outside the normal shell path. The latest Phase 6 slice made the remaining local Verify toggle explicit authoring intent: `VerifySurface` now uses `nextRunUsesAssertions` for next-run copy/preflight/wiring, while current-run meaning stays on `VerifySessionStatus` plus persisted `runKind`. `READY` / `BLOCKED` now survive only as a draft-only presentation shim.

The latest Phase 7 slice moved the scenario model one layer deeper into the real app flow:

- the Verify scenario header is now live because `IdeApp` passes `scenarios` plus runtime-backed create / duplicate / rename / delete / switch callbacks into `VerifySurface`
- `projectRuntime.runVerification(...)` now prefers the resolved active scenario when callers omit vectors
- `projectRuntime.generateBringUpVectors()` now seeds from the active scenario before falling back to compatibility `projectVectors`
- the live shell no longer reads `projectVectors` directly for Verify authority; `IdeApp` now trusts the active-scenario invariant and uses `activeScenario?.vectors ?? []`

The latest pre-lab trust slice tightened the first-run student contract:

- draft trace-authoring sessions now use testbench wording (`Ready to run this testbench` / `Run Testbench`) instead of generic simulation wording
- compare wording remains reserved for asserted sessions that actually have expected outputs loaded
- the first-run builder/footer now consumes authoritative total vector + assertion state from `VerifySurface`, so custom-vector sessions cannot drift into a `READY` hero with a missing primary run CTA

## Canonical Shape / Contract

### Run pipeline

```text
VerifySurface
  -> onRunVerification(input)
  -> IdeApp.handleRunVerification(input)
  -> projectRuntime.runVerification(input)
       -> buildDeterministicVerifyContext(circuit, ioMapping)
       -> normalizeVectorsForLiveIo(vectors, projectIoRows)
       -> runDeterministicVerifyFromModel(circuit, simModel, ioRows, vectors, schedule)
       -> buildVerifyReport(...)
       -> buildCanonicalVerifyWaveSamples(report, trace)
       -> persist verifyLastRun + verifyRunHistory
```

### Persisted run state

`RuntimeVerifyRun` in `projectRuntime.ts` is the persisted run record:

```typescript
{
  scenarioId: string
  scenarioName: string
  runKind?: 'trace' | 'verify'
  scenarioVersion?: number
  scenarioContentHash?: string
  status: 'pass' | 'fail'
  qualification?: 'incomplete-mapping'
  deterministicHash: string
  reportHash: string
  generatedAtIso: string
  schedule: 'combinational' | 'clocked_macro'
  scheduleContract?: VerifyScheduleContract
  meta: VerifyRunMeta
  report: VerifyReport
  waveform: VerifyWaveSample[]
  evidence?: VerifyEvidenceCapsule
}
```

`VerifyRunLedgerEntry` is the only place that currently stores split hashes:

```typescript
{
  circuitHash: string
  vectorsHash: string
  mappingHash: string
  projectHash: string
}
```

`projectHash` is the current best freshness fingerprint because it is built from:

- `circuit`
- `projectVectors + customVectors`
- `ioMapping`

It deliberately excludes project metadata, FPGA config, generated HDL/XDC, and student metadata.

### Student-facing session model

`VerifySessionStatus` in `buildVerifySessionViewModel.ts` is the intended student-facing state machine:

```text
draft
running
stale
stimulus-only
assertions-incomplete
assertions-match
assertions-differ
```

## Rules

- The live schematic plus current IO mapping are the simulation truth source. `projectRuntime.runVerification(...)` rebuilds `buildDeterministicVerifyContext(...)` from the current circuit at run time; it does not trust old interactive trace state.
- Verify freshness must only depend on the inputs that change verify truth: circuit structure, IO mapping, and the vector set actually used for the run.
- Project identity edits are export metadata changes, not verify-truth changes. They may dirty export, but they must not dirty verify freshness.
- IO rows are derived from the live circuit boundary via `synchronizeProjectIoRows(...)`. Bare `input` / `output` labels and internal `node-v2-*` style ids are not acceptable student-facing boundary names; unlabeled or legacy rows must promote to deterministic labels such as `Input 1`, `Input 2`, `Output 1`, or `Clock`.
- Vector keys are normalized and rekeyed through `row.id`, `row.label`, and `row.nodeId`, which is why IO rename/remove flows now survive design edits without zombie keys.
- Restore/import paths must rekey project vectors, scenario vectors, and custom vectors against the sanitized live IO rows during load/merge. A saved project may arrive with old boundary ids, but the in-memory Verify state must not keep those stale keys after normalization.
- Trace-only observation and asserted comparison now persist a distinct `runKind` on `RuntimeVerifyRun`, and `ProjectHealth` carries that projection into Project / Pipeline / Hardware / Export.
- `status` still matters inside a given run kind: `runKind='verify'` plus `status='pass' | 'fail'` distinguishes assertions-match vs assertions-differ, while stale remains a freshness overlay computed from the live project hash.
- `projectRuntime.setVectors(...)` and `generateBringUpVectors(...)` now stamp the active scenario in lockstep with `projectVectors`, so `scenarioVersion` and `scenarioContentHash` no longer lag behind the normal shell authoring path.
- Verify scenario lifecycle is now partially first-class in the runtime store: create / duplicate / rename / delete / switch all operate on `scenarios + activeScenarioId`, then mirror the selected scenario back into `projectVectors` as a compatibility bridge.
- `IdeApp.tsx` now resolves `activeScenario = getActiveScenario(scenarios, activeScenarioId)` and uses that scenario as the shell-level vector authority for Verify / Export / Hardware. The compatibility `projectVectors` path still exists, but the normal shell flow no longer drops scenario provenance on the floor.
- Export artifact generation is already decoupled from verify PASS/FAIL. Verify affects provenance notes and advisory copy only; it should not block artifact generation.
- Draft trace-authoring sessions must speak in testbench language. Reserve compare wording for asserted sessions and reserve observation-only wording for recorded trace evidence.
- First-run CTA readiness must derive from the total live vector authority (`activeScenario` / project vectors + custom vectors), not just project-authored vectors, so custom-vector sessions still expose the correct primary action.

## ProjectVectors Audit

The current repo state does **not** support deleting `projectVectors` outright yet.

### Still-required compatibility bridge

- persisted runtime state still serializes `projectVectors`
- persisted runtime merge still rebuilds `RBProject.vectors`, restored verify hash, and scenario repair/migration from `candidate.projectVectors`
- design history snapshots still store `projectVectors`
- undo / redo still rekey snapshot `projectVectors` back through the current IO shape
- legacy/persisted runtime load still repairs or migrates scenarios from `candidate.projectVectors`
- RBProject import/load still seeds the scenario library from `project.vectors`
- export still has an explicit compatibility fallback from `project.vectors` / `bundle.testbench` when no active scenario is available

### Derived mirror that can keep shrinking

- `ProjectRuntimeState.projectVectors` is now best understood as a mirror of the selected scenario, not as an independent source of truth
- `setVectors(...)`, `generateBringUpVectors()`, and scenario switching all mirror active-scenario vectors into `projectVectors`
- shell surfaces should prefer `activeScenario` directly whenever the repaired-scenario invariant is already guaranteed

### Obsolete live fallback removed

- `IdeApp` used to read `projectVectors` directly and fall back to it even after the scenario model was live
- that shell-level fallback is now gone; the shell trusts `activeScenario?.vectors ?? []`

### Phase 9 recommendation

- Keep `projectVectors` deliberately in saved state for now as a compatibility bridge.
- Do **not** delete it from persistence/history yet:
  - persisted restore still uses it to rebuild the normalized project + verify/export trust inputs
  - design-history snapshots still rely on it for undo / redo vector rekeying
  - import/load still uses it to seed the default scenario
  - export still needs it for the no-active-scenario fallback
- If the repo wants to reduce it later, that needs a scenario-first redesign of persistence/history/import/export together, not another narrow shell-side cleanup.

## Consumption Sites

- `packages/rb-apps/src/apps/IdeApp.tsx`
  - computes `currentVerifyProjectHash(...)`
  - routes verify runs into `projectRuntime`
  - now resolves and passes `activeScenario` into Verify / Export / Hardware in the normal shell flow
  - no longer reads `projectVectors` directly as a live shell fallback
- `packages/rb-apps/src/apps/ide/projectRuntime.ts`
  - owns verify state, dirty flags, run ledger, vector normalization, IO synchronization
  - now stamps the active scenario whenever the compatibility `projectVectors` path changes
  - now exposes the first real scenario library actions used by the shell (`createScenario`, `duplicateScenario`, `renameScenario`, `deleteScenario`, `switchScenario`)
  - now prefers active-scenario vectors before falling back to compatibility `projectVectors` in runtime verify and bring-up generation
  - now promotes unlabeled/legacy boundary rows to student-facing labels during load/restore and rekeys restored vectors against the sanitized IO row ids
- `packages/rb-apps/src/apps/ide/sim/simEngineCore.ts`
  - runs deterministic verify from the current `SimulationModel`
  - resolves IO keys through `getIoSignalLookupKeys(...)` + model-port aliases
- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
  - owns local next-run assertion/capture intent via `nextRunUsesAssertions`
  - current compare behavior now keys off `VerifySessionStatus` plus persisted `runKind`
  - summary pills, run-proof hero/copy, result-pane visibility, and trace capture CTA no longer use live `DisplayStatus` branches
  - next-run intent now drives only pre-run/reference copy, compare-vs-trace run wiring, and the advanced toggle state
  - the remaining local split is mostly draft-only `READY` / `BLOCKED` presentation plus compatibility `projectVectors` paths
- `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx`
  - first-run footer/copy now consumes authoritative vector/assertion counts from `VerifySurface` instead of inferring readiness from project-authored vectors alone
- `packages/rb-apps/src/apps/ide/viewmodels/buildVerifySessionViewModel.ts`
  - intended student-facing source of truth for session state
  - now keeps persisted compare evidence authoritative even when live vector props are temporarily absent
  - now defines the draft trace-authoring contract using testbench language instead of generic simulation wording
- `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
  - correctly keeps export content decoupled from verify status
  - now refuses to treat `runKind='trace'` as verified PASS provenance
  - its scenario-provenance branch is now live in the normal shell flow when Verify has recorded an assertion-backed run
- `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
  - `components/PipelineStrip.tsx`
  - `surfaces/HardwareSurface.tsx`
  - now derive current trace vs asserted compare from `ProjectHealth.lastVerify.runKind`

## Open Questions / Stubs

- Phase 1 freshness cleanup is only partially landed. Verify now uses `currentVerifyProjectHash` for stale detection and project identity edits no longer dirty verify, but freshness logic still lives in multiple places instead of a shared helper.
- The scenario/session model is only partially wired end-to-end:
  - `IdeApp` now passes the resolved active scenario through the normal Verify / Export / Hardware shell path
  - `projectRuntime` now stamps the active scenario during normal vector edits
  - dedicated runtime actions for create / duplicate / rename / delete / switch scenario now exist and the Verify scenario header uses them in the shell path
  - the remaining gap is that `projectVectors` still persists as a compatibility mirror for runtime persistence/history/import/export, so the scenario library is not yet the only vector state in storage/runtime APIs
- BUG-006 is effectively fixed. Current-run meaning no longer depends on local Verify state, and the remaining `projectVectors` mirror is now a declared saved-state compatibility bridge rather than a live Verify behavior problem.
- Phase 9 audit recommendation: keep `projectVectors` deliberately in saved state for now as a declared compatibility bridge. The remaining decision is whether that bridge should later be replaced by scenario-first persistence/history snapshots.
- Targeted validation note: the persistence and export suites still support this bridge, while `projectRuntime.history-authority.test.tsx` now contains stale expectations against current stale-copy wording and older output-auto-expansion behavior.
- Future scenario-first persistence/history work, if it happens, should be treated as a separate migration track rather than as unfinished Verify emergency cleanup.
- Component render coverage for Verify surfaces is still constrained by [[BUG-003 React.act Infrastructure Failure]], so most end-to-end Verify UI regressions need pure-logic or contract tests until React test infrastructure is fixed.
