---
type: bug
status: fixed
area: verify
priority: high
source: implementation
updated: 2026-03-25
related:
  - "[[Verify Engine]]"
  - "[[2026-03-25 Verify Refactor Plan]]"
---

# BUG-006 TRACE vs VERIFY Mode Collapse

## Summary

The architectural collapse is much smaller now:

- `RuntimeVerifyRun` now persists `runKind: 'trace' | 'verify'`
- `ProjectHealth.lastVerify` now carries that run kind into downstream health consumers
- Project / Pipeline / Hardware / Export no longer treat a current trace-only run like a verified PASS
- `VerifySurface` summary pills, run-proof hero/copy, result-pane visibility, and trace capture CTA now derive from `VerifySessionStatus` plus persisted `runKind`, not from a parallel `DisplayStatus`
- `VerifySurface` now names its local toggle as next-run intent (`nextRunUsesAssertions`) and uses it only for pre-run/reference copy and trace-vs-compare run wiring

This bug is now effectively contained. The remaining `projectVectors` question is a saved-state compatibility-policy decision, not a live TRACE-vs-VERIFY behavior bug.

## Root Cause

The original collapse came from the mode split living only in `VerifySurface.tsx`:

- `assertionMode` was local component state
- trace-only runs called `runVerification(...)` with zero compare rows
- `projectRuntime.runVerification(...)` persisted only `status: 'pass' | 'fail'`

That let downstream consumers like `choosePrimaryProjectCta(...)`, `PipelineStrip`, and `ProjectSurface` interpret a trace-only observation run as current passing verify evidence because they only saw `lastVerify.status === 'pass'` plus `dirtySinceVerify === false`.

The remaining gap is narrower now:

- `runKind` is persisted and `IdeApp` now passes the resolved active scenario through the normal shell path
- `projectRuntime.setVectors(...)` / `generateBringUpVectors(...)` now stamp the active scenario so `scenarioVersion` and `scenarioContentHash` stay truthful during normal authoring
- the Verify scenario header is now live because `IdeApp` passes `scenarios` plus runtime-backed create / duplicate / rename / delete / switch callbacks into `VerifySurface`
- `projectRuntime.runVerification(...)` and `generateBringUpVectors()` now prefer active-scenario vectors before falling back to compatibility `projectVectors`
- `IdeApp` no longer reads `projectVectors` directly for live shell authority; it now trusts `activeScenario?.vectors ?? []`
- `VerifySurface` now routes more of its fail workspace, drawers, waveform compare decorations, proof sections, status pills, and result-pane visibility from shared session status instead of from local `assertionMode` / `DisplayStatus`
- `buildVerifySessionViewModel(...)` no longer collapses restored compare evidence back to `draft` just because live vector props are absent
- `DisplayStatus` is no longer a live authority path
- the former local `assertionMode` path is now explicitly named `nextRunUsesAssertions`, and the dead readiness branches that treated it like a broader status source are gone
- Phase 9 audit says the remaining `projectVectors` mirror should stay in saved state for now, on purpose:
  - persisted runtime restore still depends on it
  - design-history snapshots still depend on it
  - import/load still depends on it
  - export still keeps a no-active-scenario fallback around it

## System Truth

Trace and compare are different session outcomes:

- trace = observed waveform only
- verify = asserted comparison against expected outputs

A trace-only run must never satisfy the same authority contract as an assertions-match run.

## Fix

Fixed on 2026-03-25 as a live-product bug.

Landed:

- `RuntimeVerifyRun` now persists `runKind`
- `ProjectHealthVerifyResult` now carries `runKind`
- `VerifySurface` now sends `runKind` when it explicitly runs trace vs compare
- Project / Pipeline / Hardware / Export now derive their first-pass trust state from `runKind`, not bare `status`
- `IdeApp` now resolves and passes `activeScenario` into Verify / Export / Hardware
- `projectRuntime` now stamps active-scenario version/hash when the normal `projectVectors` path changes
- `projectRuntime` now exposes first-class scenario actions and the Verify scenario header uses them in the normal shell path
- the normal student loop is covered by an `IdeApp` integration test that proves trace-first -> compare -> export -> hardware drift all use the same scenario provenance
- the Verify scenario header is now covered by an `IdeApp` integration test that proves create + switch operations re-authorize the compatibility vector mirror from the selected scenario
- `VerifySurface` now keeps current compare evidence visible even if the student flips the next-run toggle back to trace intent
- `buildVerifySessionViewModel(...)` now keeps persisted compare evidence non-draft even when the current surface props do not include live vectors
- `VerifySurface` summary status, run-proof tone/class, and trace-only proof CTA now follow shared session state instead of a parallel display enum
- focused workstation tests now prove the trace-only surface renders `ASSERTIONS INCOMPLETE` status-copy and `ide-verify-run-proof--trace` from the session model rather than from `TRACE`
- focused fail-state tests now prove the run-proof card stays `--fail` even after the next-run toggle is switched back to trace intent
- `buildVerifySessionViewModel(...)` now takes `nextRunUsesAssertions` as explicit next-run intent, and tests prove trace-only `stimulus-only` status survives even when the next run is armed for compare
- Phase 9 audit formalized `projectVectors` as a declared saved-state compatibility bridge for now instead of treating it like a half-removed live authority source

Follow-up, not part of BUG-006:

- if the repo later wants scenario-first persistence/history, track that as a separate migration effort
- refresh `projectRuntime.history-authority.test.tsx` before using it as authority, because part of that suite still expects older stale-copy wording and older output-auto-expansion behavior

## Links

- [[Verify Engine]]
- [[2026-03-25 Verify Refactor Plan]]
