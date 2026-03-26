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

Phase-1 freshness cleanup landed two code changes:

- `IdeApp.tsx` now passes `currentVerifyProjectHash(...)` into `VerifySurface` instead of the full export hash.
- `projectRuntime.ts -> setProjectIdentity(...)` now dirties export only, not verify.

Targeted proof:

- `pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectRuntime.verify-authority.test.ts`

The broader freshness model still needs consolidation into a shared helper, but the immediate non-circuit stale trigger is fixed.

## Links

- [[Verify Engine]]
- [[2026-03-25 Verify Refactor Plan]]
