---
type: handoff
status: done
area: verify
updated: 2026-03-25
related:
  - "[[Verify Engine]]"
  - "[[BUG-004 Verify Hash Includes Non-Circuit Fields]]"
  - "[[BUG-006 TRACE vs VERIFY Mode Collapse]]"
---

# 2026-03-25 Verify Refactor Plan

## State at Handoff

- This Verify refactor track is closed for now.
- Decision: `projectVectors` remains a declared saved-state compatibility bridge in persistence/history/import/export until a separate scenario-first migration is explicitly approved.
- The deterministic verify core is stronger than the surface model suggests. `projectRuntime.runVerification(...)` rebuilds a fresh deterministic context from the current circuit + IO mapping and runs `runDeterministicVerifyFromModel(...)` against that snapshot.
- Phase 1 freshness cleanup has started:
  - Verify stale detection now uses the verify-freshness hash (`circuit + vectors + mapping`) instead of the full export hash.
  - Project identity edits now dirty export only, not verify.
- Phase 2 has a first safe slice in place:
  - `RuntimeVerifyRun` now persists `runKind`
  - `ProjectHealth.lastVerify` now carries `runKind`
  - Project / Pipeline / Hardware / Export now distinguish trace-only runs from assertion-backed compare runs
- IO rename/remove resilience is better than earlier notes suggested. `synchronizeProjectIoRows(...)`, `rekeyVectorsForLiveIo(...)`, and the authority tests show project/custom vectors survive label renames and output removal by node identity.
- Phase 3 has a first safe slice in place:
  - `projectRuntime.setVectors(...)` and `generateBringUpVectors(...)` now stamp the active scenario whenever the normal `projectVectors` path changes
  - `IdeApp` now resolves `activeScenario` and passes it through Verify / Export / Hardware
  - the normal student loop is covered by an `IdeApp` integration test that proves trace-first, compare, export provenance, and hardware drift all share the same scenario authority
  - `IdeApp` now passes `scenarios` plus runtime-backed create / duplicate / rename / delete / switch callbacks into `VerifySurface`, so the scenario header is live in the shell path
  - `projectRuntime.runVerification(...)` and `generateBringUpVectors()` now prefer active-scenario vectors before falling back to compatibility `projectVectors`
  - `IdeApp` no longer reads `projectVectors` directly for live shell authority
- Phase 9 audit outcome:
  - keep `projectVectors` deliberately in saved state for now
  - the remaining mirror is still justified in persisted runtime restore, design-history snapshots, project import/load, and export no-active-scenario fallback
  - no low-risk reduction was justified in this slice
- TRACE vs VERIFY is no longer materially collapsed in the live app. The remaining `projectVectors` mirror is now a declared saved-state compatibility bridge rather than an open Verify behavior bug.

## Open Work

### Phase 1 — Freshness Authority Cleanup

- Goal: make every surface answer the same stale/current question.
- Affected files: `packages/rb-apps/src/apps/IdeApp.tsx`, `packages/rb-apps/src/apps/ide/projectRuntime.ts`, `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, downstream freshness consumers.
- Risks: changing hash scope can invalidate old UI assumptions and visible hash labels.
- Tests/contracts: `projectRuntime.verify-authority.test.ts`, `projectRuntime.history-authority.test.tsx`, any pure freshness helper tests added in this phase.
- Trust problem solved: students stop seeing stale verify after metadata edits and stop missing stale verify after custom-vector changes.

### Phase 2 — Persist Real Verify Session Provenance

- Goal: store what run actually happened, not just whether mismatches existed.
- Affected files: `projectRuntime.ts`, `verifyReport.ts`, `VerifySurface.tsx`, `buildVerifySessionViewModel.ts`.
- Risks: persisted-state migrations and any export/hardware code reading `RuntimeVerifyRun`.
- Tests/contracts: new pure tests around `RuntimeVerifyRun` shape, persistence migration coverage, trace-vs-compare state derivation tests.
- Trust problem solved: trace, compare, and stale become distinct machine states instead of UI inference.
- Status: partially landed.
  - `runKind` now persists on `RuntimeVerifyRun`
  - `VerifySurface` now emits explicit trace vs verify intent
  - Remaining work is to finish scenario provenance wiring and remove parallel UI-only inference

### Phase 3 — Wire the Scenario Model End-to-End

- Goal: make the active scenario the authoritative vector source for Verify/Export/Hardware.
- Affected files: `IdeApp.tsx`, `projectRuntime.ts`, `verifyScenario.ts`, `VerifySurface.tsx`, `HardwareSurface.tsx`, `buildExportViewModel.ts`.
- Risks: current project-vector compatibility paths may regress if the migration is too abrupt.
- Tests/contracts: scenario library actions, active-scenario switching, scenario-stale/wrong-scenario coverage, export provenance tests.
- Trust problem solved: the run result can be traced back to a real immutable scenario/session snapshot.
- Status: partially landed.
  - `IdeApp` now carries active-scenario provenance through the normal Verify / Export / Hardware shell path
  - `projectRuntime` now stamps the active scenario during normal vector edits and bring-up generation
  - `projectRuntime` now exposes create / duplicate / rename / delete / switch scenario actions
  - `VerifySurface` now uses those actions through the live scenario header in the normal shell path
  - Phase 8 removed the last live shell fallback to `projectVectors`
  - Phase 9 recommendation: keep `projectVectors` deliberately in saved state for now as a compatibility bridge in persistence/history/import/export
  - remaining work is to decide whether persistence/history snapshots should later become scenario-first too, or whether the saved-state mirror should simply be formalized and kept

### Phase 4 — Remove the Parallel Verify State Machines

- Goal: stop maintaining both `DisplayStatus` and `VerifySessionStatus`.
- Affected files: `VerifySurface.tsx`, `buildVerifySessionViewModel.ts`.
- Risks: large UI rendering diff if done before Phase 2 defines a stable run/session contract.
- Tests/contracts: session-model tests, verify workstation contracts once component infrastructure is healthy.
- Trust problem solved: stale, trace, compare, and failure messaging stop contradicting each other inside Verify itself.
- Status: partially landed.
  - `VerifySurface` now routes its fail workspace, mismatch drawers, compare strip, waveform compare decorations, and assertion overlay from shared session status instead of from the local next-run toggle
  - `buildVerifySessionViewModel.ts` now keeps persisted compare evidence authoritative even when live vector props are absent
  - `VerifySurface` summary pills, run-proof hero/copy, run-proof tone, trace capture CTA, and result-pane visibility now follow `VerifySessionStatus` plus persisted `runKind`
  - workstation tests now prove trace-only runs render `ASSERTIONS INCOMPLETE` status-copy and `ide-verify-run-proof--trace` from the shared session model
  - `VerifySurface` now names the local toggle as explicit next-run intent (`nextRunUsesAssertions`) and no longer feeds it into dead readiness/status branches
  - viewmodel + fail-state tests now prove current-run meaning stays on persisted session state even when the next-run toggle changes
  - remaining work is to decide whether the draft-only `READY` / `BLOCKED` presentation shim is still worth keeping once the remaining `projectVectors` compatibility bridge is either reduced or declared permanent

### Phase 5 — Downstream Consumer Cleanup

- Goal: make Project, Pipeline, Hardware, and Export consume the new verify authority model consistently.
- Affected files: `projectHealth.ts`, `ProjectSurface.tsx`, `components/PipelineStrip.tsx`, `HardwareSurface.tsx`, `buildExportViewModel.ts`, `ExportSurface.tsx`.
- Risks: easy to accidentally reintroduce gating semantics if consumer logic is updated piecemeal.
- Tests/contracts: project health tests, hardware readiness tests, export authority/provenance contract tests.
- Trust problem solved: a trace-only run no longer looks like a passing compare elsewhere in the product.
- Status: first consumer slice landed alongside Phase 2.
  - `projectHealth.ts` now derives a verify authority state from `runKind`
  - `PipelineStrip`, `ProjectSurface`, `HardwareSurface`, `ExportSurface`, and `buildExportViewModel.ts` now use that split in their first-pass trust decisions
  - Remaining work is to remove the last status-only fallbacks and unify VerifySurface with the shared session model

### Phase 6 — Sequential / Clocked Clarification

- Goal: clean up the sequential bring-up story after freshness and session provenance are stable.
- Affected files: `verifySchedule.ts`, `simEngineCore.ts`, `bringupArtifacts.ts`, Verify/Hardware copy.
- Risks: clock/reset handling can regress quickly if changed before the session model is explicit.
- Tests/contracts: sequential verify diagnostics, bring-up artifact tests, student-loop sequential coverage.
- Trust problem solved: students can tell exactly what tick 0 means, what clock is being used, and what kind of evidence a sequential run produced.

## System Constraints

- Do not treat export gating as a verify-pass problem. Export content generation is already intentionally decoupled from verify status.
- Preserve the live-circuit authority chain. Verify must continue deriving its deterministic model from the current circuit and current IO mapping at run time.
- Keep vector rebinding keyed by live IO identity (`row.id` / `row.nodeId` aliasing). Rename resilience is already one of the stronger parts of the current system.
- Avoid component-render test dependence for core logic changes until [[BUG-003 React.act Infrastructure Failure]] is fixed.

## Context Needed

- Read [[Verify Engine]] first.
- Read [[BUG-004 Verify Hash Includes Non-Circuit Fields]] and [[BUG-006 TRACE vs VERIFY Mode Collapse]].
- Inspect these files before continuing implementation:
  - `packages/rb-apps/src/apps/IdeApp.tsx`
  - `packages/rb-apps/src/apps/ide/projectRuntime.ts`
  - `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
  - `packages/rb-apps/src/apps/ide/viewmodels/buildVerifySessionViewModel.ts`
  - `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`

## Next Action

- Shift attention away from Verify unless a separate scenario-first persistence/history migration is explicitly approved.
- The best next technical target is [[BUG-003 React.act Infrastructure Failure]] so Verify render tests become trustworthy again.
- If the repo later reopens saved-state migration, refresh `projectRuntime.history-authority.test.tsx` first: part of that suite still expects older `Verify: STALE` copy and older output-auto-expansion behavior.
