---
type: bug
status: fixed
area: infrastructure
priority: high
source: manual-debug
updated: 2026-04-13
related:
  - "[[Design Surface]]"
  - "[[Project Surface]]"
  - "[[Verify Engine]]"
---

# BUG-017 Shared Compact Workbench Row Theft

## Summary

In compact layouts, Project, Design, and Verify could all collapse into a top-heavy workspace because the shared workbench grid kept reserving a second row even when the right dock was hidden or only represented by a collapsed restore rail. Wide-screen hidden-right-dock sessions could also keep a marooned workbench because an older shared grid rule still capped the layout and reserved full dock width instead of the collapsed slot width.

## Root Cause

The shared shell and the late compact-layout CSS had drifted out of contract.

- `IdeWorkbenchShell.tsx` no longer marked the grid with `hide-right-dock` when the inspector was fully hidden
- compact-layout CSS still treated every `.ide-workbench-main:not(.hide-right-dock)` state as a stacked two-row layout
- later rail styling made collapsed restore rails participate in normal layout instead of behaving like a harmless overlay affordance
- a legacy shared `.ide-workbench-main.hide-right-dock` rule still used full left-dock width plus a centered `min(100%, 1440px)` width cap, so wide-screen hidden-right-dock surfaces could look stranded even after the compact-height issue was fixed
- `IdeSurfaceLayout.tsx` was also dropping the new `rightDockCanCollapse` / `rightDockRevealKey` props, so Design's auto-open inspector could not use the intended shared collapse behavior

## System Truth

Compact shell geometry must distinguish three states cleanly.

- visible right inspector: may claim a dedicated compact secondary row when the product intentionally wants stacked layout
- collapsed right dock: must remain a restore affordance only and must not steal a full workspace row
- hidden right dock: must remove inspector layout claims entirely so the workspace keeps the full shell height and uses collapsed slot geometry instead of an invisible full-dock-width column

## Fix

- `IdeWorkbenchShell.tsx` now emits `hide-right-dock` when the right dock is actually hidden
- `ide-root.css` compact stacking selectors now exclude `.is-right-dock-collapsed`, so collapsed rails stop creating a phantom second row
- the Verify compact secondary-row override now follows that same visible-inspector-only rule
- the shared `hide-right-dock` grid rule now uses `--ide-workbench-left-slot-width` and no longer applies the old shared `1440px` cap, so wide-screen hidden-right-dock sessions keep full workbench width
- `IdeSurfaceLayout.tsx` now passes `rightDockCanCollapse` and `rightDockRevealKey` into the shell
- `DesignSurface.tsx` now computes a stable reveal key from selection / replay / diagnostic / sim context and opts into the shared manual-collapse behavior
- focused shell + Design workstation regressions passed after the fix (`43` tests across `2` files)
- live wide-viewport proof on `http://127.0.0.1:4180/` now shows Verify at `2212px` grid width with a `56px` collapsed `Signals` rail and `2156px` workspace body

## Links

- [[Design Surface]]
- [[Project Surface]]
- [[Verify Engine]]