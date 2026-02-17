# IDE Sovereignty Verification Checklist

**Purpose**: Verify Logic Playground is the sovereign surface with no accidental escape to template library.

## Test 1: Fresh Load Auto-Boot
1. Navigate to `http://localhost:5173` (no URL params).
2. **Expected**: Logic Playground opens within 2 seconds.
3. **Pass/Fail**: _________

## Test 2: IDE Cannot Be Closed
1. With Logic Playground open, look for close button in window chrome.
2. **Expected**: No close button is visible (only minimize/maximize).
3. **Pass/Fail**: _________

## Test 3: Auto-Reopen on Empty Windows
1. Force-close the IDE via devtools: `useWindowStore.getState().closeWindow('logic-playground')` in console.
2. **Expected**: IDE reopens automatically within 2 seconds.
3. **Pass/Fail**: _________

## Test 4: Launcher Mode Opt-In
1. Navigate to `http://localhost:5173?launcher=1`.
2. **Expected**: Template library grid appears instead of auto-boot.
3. Load a template—IDE opens with that circuit.
4. **Pass/Fail**: _________

## Test 5: Zoom-Safe Layout (125%)
1. Open Logic Playground.
2. Press Ctrl+ (or Cmd+) to zoom to 125%.
3. **Expected**: Canvas fully visible, mode nav reachable, no clipping.
4. **Pass/Fail**: _________

## Test 6: Zoom-Safe Layout (150%)
1. Continue zooming to 150%.
2. **Expected**: Canvas fully visible, modals centered, all UI reachable.
3. **Pass/Fail**: _________

## Test 7: Port Hit Targets (Wiring UX)
1. Add a NOT gate and a Lamp to canvas.
2. Click the NOT gate's output port (right side).
3. Click the Lamp's input port (left side).
4. **Expected**: Wire created without pixel-perfect aiming. Ports have ~32px hit radius.
5. **Pass/Fail**: _________

## Test 8: Escape Cancels Wiring
1. Start wiring from any port.
2. Press Escape key.
3. **Expected**: Wire preview disappears, canvas returns to idle mode.
4. **Pass/Fail**: _________

## Test 9: Template Modal Centering (Zoom 125%)
1. With browser zoom at 125%, click "Labs" button in mode nav.
2. **Expected**: Modal appears centered on screen, fully accessible.
3. **Pass/Fail**: _________

## Test 10: No Course Language
1. Open template modal.
2. Scan UI for any "progress", "completed", "active", or "Lab X of 8" language.
3. **Expected**: Only sees "LOAD TEMPLATE" and neutral circuit template descriptions.
4. **Pass/Fail**: _________

---

**Sign-off (TA/Instructor)**:
- Name: ________________
- Date: ________________
- Result: ☐ PASS  ☐ FAIL (note issues below)

**Issues/Notes**:
