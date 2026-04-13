---
type: bug
status: fixed
area: verify
priority: high
source: implementation
updated: 2026-04-12
related:
  - "[[Verify Engine]]"
  - "[[2026-03-25 Verify Refactor Plan]]"
---

# BUG-004 Verify Hash Includes Non-Circuit Fields

## Summary

Verify freshness was keyed off the full export/project hash, so metadata edits could mark Verify stale while some real verify inputs were ignored.

## Root Cause

Two different freshness fingerprints existed at once:

- `IdeApp` computed `determinismHash = digestValue(exportProject)`, which includes project metadata, FPGA config, generated HDL/XDC text, and student metadata.
- Verify truth actually depends on `circuit + ioMapping + vectors used for the run`.

`VerifySurface` compared `lastRun.deterministicHash` against the full export hash, while other surfaces also relied on `dirtySinceVerify` and `verifyRunHistory.projectHash`. That split model created contradictory stale/current answers across Verify, Project, and Hardware.

## System Truth

Verify freshness must only depend on the data that can change deterministic verify output:

- circuit structure
- IO mapping
- vectors used for the run

Project identity and export metadata are export concerns, not verify-truth concerns.

## Fix

Phase-1 freshness cleanup (2026-03-25) landed the IdeApp hash fix but the `setProjectIdentity` code change was documented but never applied.

Phase-2 (2026-03-31) applied the actual code fix:

- `projectRuntime.ts -> setProjectIdentity(...)` now computes `changesCircuitTruth` to detect whether circuit-truth-relevant fields (projectKind, sourceExampleId, scenarioAuthority) are being changed. Identity-only edits (name, description) dirty export but preserve existing `dirtySinceVerify` state.

Targeted proof:

- `pnpm -w exec vitest run projectRuntime.verify-authority projectRuntime.history-authority` → 50 tests PASS (was 4 failures)

Phase-3 Verify trust cleanup (2026-04-12) closed the remaining student-visible replay drift:

- `IdeApp.tsx` now computes a replay-specific hash from circuit + stimulus + mapping instead of using broader project/export truth
- replay input hashing now normalizes starter/example aliases to canonical project IO ids, so `Save as checks` no longer creates fake stimulus drift after capture
- `projectRuntime.ts` persists `scenarioStimulusHash` with each run, and `VerifySurface.tsx` compares stimulus truth against actual run vectors before marking the current waveform stale

Targeted proof:

- focused Verify freshness regressions: `verifySurface.workstation`, `verifyScenario`, `circuitProjection` → PASS (`75` tests before later duplicate-key/test additions; `77` verify-side tests after them)
- built-preview browser validation on `2-Bit Up Counter` confirmed `Save as checks` no longer flips the Verify header to `STALE`

## Links

- [[Verify Engine]]
- [[2026-03-25 Verify Refactor Plan]]
