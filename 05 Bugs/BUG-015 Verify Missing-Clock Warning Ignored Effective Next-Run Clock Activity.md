---
type: bug
status: fixed
area: verify
priority: high
source: manual-debug
updated: 2026-04-12
related:
  - "[[Verify Engine]]"
  - "[[ADR-005 Verify Schedule Contract Owns Sequential Clock Authority]]"
---

# BUG-015 Verify Missing-Clock Warning Ignored Effective Next-Run Clock Activity

## Summary

Verify could show `No clock activity detected in your vectors` even when the actual next run already included valid clock activity through mixed project + custom vectors.

## Root Cause

`nextRunNeedsClockActivity` only inspected project-authored vectors and compared clock keys as raw strings. The rest of Verify already treated the next run as the effective vector authority plus normalized signal naming, so the warning path had drifted away from the run path it was supposed to describe.

## System Truth

Pre-run clock warnings must derive from the same effective next-run vector authority Verify will actually run, and clock activity matching must use normalized ids rather than presentation-only string equality.

## Fix

- `VerifySurface.tsx` now builds `effectiveNextRunVectors` from authored plus custom vectors and uses that same authority for the missing-clock warning.
- Clock activity detection now matches normalized input keys against normalized authoritative clock names.
- Focused regressions prove both mixed vector sources and normalized clock ids suppress the false warning.

## Links

- [[Verify Engine]]
- [[ADR-005 Verify Schedule Contract Owns Sequential Clock Authority]]