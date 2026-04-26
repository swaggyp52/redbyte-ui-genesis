> 📋 **HISTORICAL QA RECORD — OS ERA.** This is a smoke test checklist from an earlier release cycle. It is not current guidance. See `docs/release/` for current certification evidence.

# P3B Cross-Browser Sanity Checklist

## Purpose

Quick manual verification (10–15 minutes) that essential RedByte classroom surfaces work correctly across Chrome, Edge, and Firefox on Windows. Designed for TA/instructor pre-class validation.

## Last Validated

- Date: (YYYY-MM-DD)
- Commit: (git SHA)
- Chrome version: (e.g., 131.0.6778.140)
- Edge version: (e.g., 131.0.2903.112)
- Firefox version: (e.g., 133.0.3)
- Result: PASS / FAIL

## Prerequisites

- Start RedByte OS (dev server or preview build)
- Test on Windows machine
- Run same procedure in each browser (Chrome → Edge → Firefox)

## Test Steps

### 1. OS Boot & Idle

1. Open browser and navigate to RedByte OS
2. Wait for boot to complete (desktop visible)
3. Do nothing for 10 seconds
4. Observe for obvious jank, console errors, or broken layout

**Pass criteria:**
- Desktop renders correctly
- No JavaScript errors in console
- No visible layout breaks or overlapping UI
- Taskbar/Dock visible and interactive

### 2. Virtual Lab (ECE Lab) - Basic Circuit

1. Click "Virtual Lab" from Desktop or Launcher (Ctrl+K)
2. Place 2 gates (e.g., AND + OR) on breadboard
3. Wire them together
4. Click "Run" to start simulation briefly (~5 seconds)
5. Stop simulation

**Pass criteria:**
- Gates place without errors
- Wiring works (visual feedback on wire creation)
- Simulation runs without console errors
- Stop button works

### 3. Logic Playground - Save/Export/Import Roundtrip

1. Open "Logic Playground" from Desktop or Launcher
2. Place 2–3 gates and connect them
3. Click Save (or verify autosave indicator appears)
4. Export project (Command Palette → "Export Project" or File menu)
5. Import the exported project back
6. Verify circuit reloads correctly

**Pass criteria:**
- Gates and wires restore identically
- No console errors during export/import
- Autosave indicator shows saved state
- Import doesn't corrupt circuit

### 4. Signal Probes / Oscilloscope - Focus/Minimize Behavior

1. In Logic Playground, attach a probe to a wire
2. Open oscilloscope view (if not already visible)
3. Run simulation
4. Verify oscilloscope updates while window is focused
5. Minimize the Logic Playground window
6. Restore window and verify oscilloscope updates resume

**Pass criteria:**
- Oscilloscope shows live signal updates when focused
- Updates pause when window minimized (instrument Hz throttling)
- Updates resume when window restored
- No dropped frames or visual glitches

### 5. Performance Mode - Throttling & 3D Lazy-Load

1. Open Settings (Ctrl+,)
2. Enable "Performance Mode" toggle
3. Open Logic Playground (or switch to existing window)
4. Verify 2D circuit view still works
5. Verify oscilloscope updates at reduced rate (if simulation running)
6. Check that 3D view does NOT auto-load in split view

**Pass criteria:**
- 2D circuit editing works with Performance Mode ON
- Instruments visibly throttle (slower update rate)
- 3D pane remains empty/disabled in Performance Mode
- No console errors when toggling Performance Mode

### 6. 3D View (Optional) - Lazy-Load & Pause on Minimize

1. With Performance Mode OFF, open split view with 3D
2. Verify 3D scene loads only when view is opened
3. Minimize the window
4. Restore window

**Pass criteria:**
- 3D scene loads on demand (not during boot)
- 3D render loop pauses when window minimized
- 3D resumes when window restored
- No WebGL errors in console

## Evidence Capture (If FAIL)

If any test fails, capture the following:

### Console Screenshot
- Open DevTools Console (F12)
- Expand any red errors
- Screenshot full console output

### Windowing State (if windowing-related failure)
1. Enable windowing debug: `localStorage.setItem('rb:windowDebug', '1')`
2. Reload page
3. Run failing test step
4. In console, run: `window.__RB_WINDOWING__?.dump()`
5. Copy console output showing focused window, z-order, modes

### Performance Mode State (if instrument/throttling failure)
- Note: Performance Mode ON or OFF?
- Which window was minimized/focused when failure occurred?
- Copy oscilloscope update interval if visible

### Browser Details
- Browser name and exact version
- Any browser extensions installed (especially ad blockers, privacy tools)
- GPU/hardware acceleration status (chrome://gpu or about:support)

## Revalidation Triggers

Re-run this checklist when changing:
- `packages/rb-windowing/src/store.*` (windowing logic)
- `packages/rb-utils/src/settingsStore.*` (Performance Mode)
- `packages/rb-apps/src/instruments/computeInstrumentHz.*` (throttling)
- `packages/rb-apps/src/components/OscilloscopeView.*` (oscilloscope updates)
- `packages/rb-apps/src/components/SplitViewLayout.*` (3D lazy-load)
- `packages/rb-shell/src/Shell.*` (boot sequence)

## Notes

- This is a **manual** checklist; automated cross-browser CI matrix is deferred
- Run before each classroom session if any revalidation triggers changed
- If all browsers PASS, consider the cross-browser sanity requirement satisfied
- Focus on functional correctness, not visual perfection
- Performance Mode and instrument throttling are browser-agnostic but verify once per browser

## Attribution

Connor Angiel
