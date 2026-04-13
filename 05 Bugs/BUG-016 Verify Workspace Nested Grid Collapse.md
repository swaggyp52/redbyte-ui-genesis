---
type: bug
status: fixed
area: verify
priority: high
source: manual-debug
updated: 2026-04-13
related:
  - "[[Verify Engine]]"
---

# BUG-016 Verify Workspace Nested Grid Collapse

## Summary

Post-run Verify desktop sessions could collapse the waveform into a narrow strip, leave dead bottom space in the main lab, and keep the left `Signals` rail cramped even though the shell had plenty of available width.

## Root Cause

The visual hierarchy had split across three layout owners instead of one.

- `.ide-verify-workspace` still declared direct desktop columns for stimulus and waveform even though the real DOM path only contained one child: `.ide-verify-lab-frame`
- `.ide-verify-lab-grid` then tried to do the real stimulus/waveform split inside that already-constrained parent, which trapped the waveform in a nested narrow region
- `.ide-verify-lab-frame` still reserved an unused second row, which created the dead bottom gap
- CSS-only rail cleanup could not widen the left dock because `IdeWorkbenchShell.tsx` was still clamping Verify dock width with narrower inline width caps

## System Truth

Verify desktop geometry must have one clear ownership chain.

- the outer workspace owns one full-width lab frame
- the inner lab grid owns the stimulus/waveform split
- the lab frame must not reserve dead rows below the active workspace
- shell width caps must be wide enough for the Verify `Signals` rail to present grouped controls without horizontal crowding

## Fix

- `ide-root.css` now collapses `.ide-verify-workspace` to a single full-width track and lets `.ide-verify-lab-grid` own the actual two-pane split
- `.ide-verify-lab-frame` now uses a single live row, removing the dead bottom space
- `.ide-verify-lab-grid` now uses a near-even desktop split instead of the older narrow stimulus / oversized waveform imbalance
- `.ide-verify-workbench-live` no longer keeps the old post-run height cap
- the Verify signal rail header, summary, and action layout were tightened so the dock reads as a deliberate tool rail instead of stacked clutter
- `IdeWorkbenchShell.tsx` now widens the Verify left-dock clamp ranges, which lets the `Signals` rail expand to the intended width
- focused Verify and shell regressions passed after the fix (`56` tests across `5` files)

## Links

- [[Verify Engine]]