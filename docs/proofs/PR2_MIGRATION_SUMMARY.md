# PR2: Logic Playground Migration — COMPLETE ✅

## Summary

Successfully migrated Logic Playground from window-level event listeners to CanvasHost event ownership pattern.

---

## Changes Made

### 1. LogicCanvas.tsx Migration

**Removed:**
- Window-level wheel event listener (lines 317-329)
- Window-level keyboard event listeners (lines 645-721)

**Added:**
- Import `CanvasHost` from `@redbyte/rb-viewport`
- Wrapped component in `<CanvasHost id="playground-canvas">`
- Created `handleWheelActive` callback for zoom
- Created `handleKeyDownActive` callback for keyboard (Space, Alt, Delete, Escape, W, G, F, R, 0)
- Created `handleKeyUpActive` callback for key releases (Space, Alt)
- Updated imports to use `snapToGrid` and `fitToBounds` from `@redbyte/rb-viewport`
- Inlined `calculateFitToView` logic using `fitToBounds`

**Files Modified:**
- `packages/rb-logic-view/src/LogicCanvas.tsx`
- `packages/rb-logic-view/src/index.ts` (removed deprecated exports)
- `packages/rb-logic-view/vite.config.ts` (added rb-viewport to externals)
- `packages/rb-logic-view/package.json` (added rb-viewport dependency)

### 2. Deprecated Code Removal

**Deleted:**
- `packages/rb-logic-view/src/tools/panzoom.ts` (deprecated, replaced by rb-viewport)
- `packages/rb-logic-view/src/__tests__/panzoom.test.ts`

### 3. Consumer Updates

Updated all rb-apps files to import from `@redbyte/rb-viewport` instead of `@redbyte/rb-logic-view`:

**Files Modified:**
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`
  - Changed imports: `screenToWorld`, `snapToGrid`, `fitToBounds` now from `@redbyte/rb-viewport`
  - Replaced `calculateFitToView` with inline `fitToBounds` logic

- `packages/rb-apps/src/components/CircuitToolStrip.tsx`
  - Changed imports: `fitToBounds` from `@redbyte/rb-viewport`
  - Replaced `calculateFitToView` with inline `fitToBounds` logic

- `packages/rb-apps/src/components/SplitViewLayout.tsx`
  - Changed imports: `fitToBounds` from `@redbyte/rb-viewport`
  - Replaced `calculateFitToView` with inline `fitToBounds` logic

---

## Build Status

✅ **rb-viewport**: Built successfully
✅ **rb-logic-view**: Built successfully
✅ **Dev server**: Running at http://localhost:5174/os/

---

## Manual Testing Required

The dev server is running at **http://localhost:5174/os/**

Navigate to Logic Playground and run the 7 manual tests from [PR1_MANUAL_TESTS.md](./PR1_MANUAL_TESTS.md):

### Test 1: Wheel Zoom Never Scrolls Page
1. Open Logic Playground
2. Hover mouse over canvas
3. Scroll wheel up/down rapidly
4. Move mouse outside canvas
5. Scroll wheel up/down
- ✓ While hovering canvas: Page does NOT scroll (not even 1px)
- ✓ While outside canvas: Page scrolls normally
- ✓ Canvas zoom handler receives wheel events only when active

### Test 2: Space Types in Input, Not Canvas
1. Focus text input in sidebar (if any)
2. Keep mouse hovering over canvas
3. Type: "hello world" (with spacebar)
- ✓ "hello world" appears in input, canvas does nothing
4. Blur input (click canvas background)
5. Press Space
- ✓ Canvas receives Space (pan mode), no text typed

### Test 3: Overlays Don't Break Activation
1. Hover canvas → active ON
2. Wheel zoom → works ✓
3. Move mouse over HUD overlay (top-right)
- ✓ Canvas stays active (no "flicker")
4. Wheel zoom → still works ✓

### Test 4: Two Canvases - Only Hovered One Active
(This test requires opening multiple canvas instances - may need 2D Lab open simultaneously)
1. Hover playground canvas → wheel zoom
- ✓ Only playground canvas zooms
2. Hover other canvas → wheel zoom
- ✓ Only other canvas zooms (playground stops responding)

### Test 5: Alt-Tab Does Not Leave Canvas "Stuck Active"
1. Hover canvas → active ON
2. Press Space → canvas receives event ✓
3. Alt+Tab away from browser
4. Alt+Tab back to browser (mouse NOT over canvas)
5. Press Space
- ✓ Canvas does NOT receive event (active cleared on blur)

### Test 6: Keyboard Guards ARIA Textboxes
(If any contenteditable or role="textbox" elements exist)
1. Focus ARIA textbox
2. Hover canvas with mouse
3. Press Space
- ✓ Space types in textbox, NOT routed to canvas

### Test 7: Unmount Cleanup
(May require toggling canvas visibility if available)
1. Hover canvas → active ON
2. Remove/unmount canvas (if toggle available)
- ✓ Active state cleared (not "stuck")
3. Add canvas back
4. Hover new canvas → active ON again
- ✓ Works correctly

---

## Next Steps

1. **Run manual tests** - Complete all 7 tests above
2. **If all tests pass** → Mark PR2 complete, move to PR3
3. **If any test fails** → Fix the issue, rebuild, retest

---

## PR3 Preview

Next migration targets:
- DesignMode/CircuitEditor2D (2D Lab)
- Board view camera controls

These will follow the same pattern:
1. Wrap in CanvasHost
2. Move wheel/keyboard handlers to callbacks
3. Delete old event listeners
4. Run manual tests

---

**Status**: PR2 migration code complete ✅
**Server**: http://localhost:5174/os/
**Next**: Manual testing (7 tests)
