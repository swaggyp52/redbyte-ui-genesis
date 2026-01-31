# PR 1: Manual Test Checklist
**Gate 1 & 2 Verification — CanvasHost Event Ownership**

---

## ✅ Gate 1: Package Importable

```bash
node -e "import('./packages/rb-viewport/dist/index.js').then(m=>console.log('exports:',Object.keys(m).sort()))"
```

**Expected exports:**
```
[
  'CanvasHost',
  'ViewportHUD',
  'clearIfActive',
  'fitToBounds',
  'getActiveCanvasId',
  'isCanvasActive',
  'screenToWorld',
  'setActiveCanvas',
  'snapToGrid',
  'useCanvasInteraction',
  'useUnifiedViewport',
  'worldToScreen'
]
```

**Status:** ✅ PASS

---

## ✅ Gate 2: CanvasHost Event Ownership

### Test 1: Wheel Zoom Never Scrolls Page

**Setup:**
1. Create test page with scrollable content
2. Add `<CanvasHost id="test-canvas">` with tall content inside
3. Attach `onWheelActive` callback

**Test:**
1. Hover mouse over canvas
2. Scroll wheel up/down rapidly
3. Move mouse outside canvas
4. Scroll wheel up/down

**Expected:**
- ✓ While hovering canvas: Page does NOT scroll (not even 1px)
- ✓ While outside canvas: Page scrolls normally
- ✓ Canvas zoom handler receives wheel events only when active

**Status:** 🟡 DEFERRED (requires PR2 integration test)

---

### Test 2: Space Types in Input, Not Canvas

**Setup:**
1. Page with `<input>` in sidebar
2. Canvas with `<CanvasHost id="test-canvas">`
3. Canvas handler for Space key (pan modifier)

**Test Steps:**
1. Focus text input in sidebar
2. Keep mouse hovering over canvas
3. Type: "hello world" (with spacebar)
4. Expected: "hello world" appears in input, canvas does nothing
5. Blur input (click canvas background)
6. Press Space
7. Expected: Canvas receives Space, no text typed

**Critical:** Uses `document.activeElement`, not `e.target`

**Status:** 🟡 DEFERRED (requires PR2 integration test)

---

### Test 3: Overlays Don't Break Activation

**Setup:**
1. Canvas with `<CanvasHost id="test-canvas">`
2. Absolutely positioned HUD overlay inside canvas (top-right corner)
3. Minimap overlay (bottom-right corner)

**Test Steps:**
1. Hover canvas → active ON
2. Wheel zoom → works ✓
3. Move mouse over HUD overlay
4. Expected: Canvas stays active (no "flicker")
5. Wheel zoom → still works ✓
6. Move mouse over minimap
7. Expected: Canvas stays active
8. Wheel zoom → still works ✓

**Critical:** `relatedTarget` containment check prevents deactivation

**Status:** 🟡 DEFERRED (requires PR2 integration test)

---

### Test 4: Two Canvases - Only Hovered One Active

**Setup:**
1. Two `<CanvasHost>` instances on same page:
   - `<CanvasHost id="canvas-1">`
   - `<CanvasHost id="canvas-2">`
2. Each with wheel zoom handler

**Test Steps:**
1. Hover canvas-1 → wheel zoom
2. Expected: Only canvas-1 zooms
3. Hover canvas-2 → wheel zoom
4. Expected: Only canvas-2 zooms (canvas-1 stops responding)
5. Hover canvas-1 again → wheel zoom
6. Expected: Only canvas-1 zooms

**Critical:** Global singleton `activeCanvasId` ensures mutual exclusion

**Status:** 🟡 DEFERRED (requires PR2 integration test)

---

### Test 5: Alt-Tab Does Not Leave Canvas "Stuck Active"

**Setup:**
1. Canvas with `<CanvasHost id="test-canvas">`
2. Keyboard handler for Space (pan modifier)

**Test Steps:**
1. Hover canvas → active ON
2. Press Space → canvas receives event ✓
3. Alt+Tab away from browser
4. Alt+Tab back to browser
5. Mouse is NOT over canvas
6. Press Space
7. Expected: Canvas does NOT receive event (active cleared on blur)

**Critical:** `window.blur` and `document.visibilitychange` clear active state

**Status:** 🟡 DEFERRED (requires PR2 integration test)

---

### Test 6: Keyboard Guards ARIA Textboxes

**Setup:**
1. Page with component library input (e.g., `<div role="textbox" contenteditable>`)
2. Canvas with keyboard handler

**Test Steps:**
1. Focus ARIA textbox
2. Hover canvas with mouse
3. Press Space
4. Expected: Space types in textbox, NOT routed to canvas

**Critical:** `isTextEntryElement()` checks `role="textbox"` attribute

**Status:** 🟡 DEFERRED (requires PR2 integration test)

---

### Test 7: Unmount Cleanup

**Setup:**
1. Canvas with `<CanvasHost id="test-canvas">`
2. Button to conditionally unmount canvas

**Test Steps:**
1. Hover canvas → active ON
2. Click "Remove Canvas" button (unmount)
3. Verify: `getActiveCanvasId()` returns `null` (not "test-canvas")
4. Add canvas back
5. Hover new canvas → active ON again

**Critical:** Cleanup on unmount calls `clearIfActive(id)`

**Status:** 🟡 DEFERRED (requires PR2 integration test)

---

## Summary: PR1 Status

**✅ Gate 1 PASS** - Package builds and exports correctly

**🟡 Gate 2 DEFERRED** - All 7 tests require PR2 integration:
1. Wheel scroll prevention
2. Space input protection
3. Overlay activation stability
4. Multi-canvas exclusion
5. Alt-tab cleanup
6. ARIA textbox guard
7. Unmount cleanup

**Next Step:** Proceed to PR2 (Logic Playground migration) to validate Gate 2

---

## PR2 Integration Requirements

When migrating Logic Playground:

1. **Stable ID:** `<CanvasHost id="playground-canvas">`
2. **HUD Overlays:** Add `pointer-events: none` to ViewportHUD by default
3. **Delete Old Listeners:** Remove window-level wheel/keyboard from LogicCanvas
4. **Test All 7:** Run manual checklist above after PR2 complete

---

**End of PR1 Manual Tests — Ready for PR2**
