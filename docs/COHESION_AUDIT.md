# RedByte OS Cohesion Audit
**Phase 0 — Interaction, Visual, Performance, and Feature Discrepancies**

---

## INTERACTION DISCREPANCIES (Critical Path)

### CRITICAL: Focus + Event Ownership Chaos

**Problem:** Event listeners are scattered across window-level, element-level, and implicit focus, causing shortcuts to fail or apply to wrong canvas.

**Symptoms:**
- Space+Drag doesn't work if sidebar has focus
- Wheel zoom sometimes scrolls page instead of canvas
- ESC cancels wrong action depending on last clicked element
- Shortcuts work inconsistently based on where mouse was last

**Root Cause:** No "active canvas" concept - multiple views compete for same global events.

**Files Affected:**
- `rb-apps/src/utils/viewportControls.ts:210-260` — Window-level keyboard listeners
- `rb-logic-view/src/tools/panzoom.ts:246-258` — Window-level pan handlers
- `rb-apps/src/components/DesignMode.tsx:86-138` — Window-level ESC/Delete handlers

**Fix Required:**
1. Create `CanvasHost` wrapper component that owns event routing
2. Set "active canvas" on pointer enter (not click)
3. Route wheel/keyboard to active canvas only
4. Prevent page scroll when canvas is active
5. Clear active canvas on pointer leave

**Acceptance:**
- Hover Playground → Space+Drag/F/ESC work without clicking first
- Wheel zoom NEVER scrolls page when cursor over canvas
- Sidebar focused → canvas shortcuts don't fire

---

### CRITICAL: Interaction State Machine Fragmentation

**Problem:** Each view implements its own interaction logic, causing ESC/Delete behavior to drift.

**Current State:**
- Logic Playground: Unknown state machine (not audited in detail)
- DesignMode: `idle | panning | dragging-node | wiring` (line 75-80)
- No shared contract for state transitions

**Divergence Example:**
- DesignMode ESC: Cancels wiring first, then clears selection (line 98-106)
- Logic Playground ESC: Behavior unclear, possibly inconsistent

**Fix Required:**
1. Create shared interaction state machine hook: `useCanvasInteraction()`
2. Standard states: `idle → panning → draggingNode → wiring → boxSelect → modal`
3. Standard transitions: ESC always cancels current gesture first
4. Enforce: Can't enter `panning` while `wiring`, etc.

**Files to Create:**
- `packages/rb-viewport/src/useCanvasInteraction.ts` — Shared state machine

**Acceptance:**
- ESC behavior identical across all canvas views
- State transitions predictable and documented
- Can't accidentally enter invalid states (e.g., panning while wiring)

---

### CRITICAL: Transform Pipeline Duplication

**Problem:** Multiple coordinate system implementations causing drift in screen↔world conversions.

**Duplication Found:**
- `rb-logic-view/src/tools/panzoom.ts:107-130` — `screenToWorld`, `worldToScreen`
- `rb-apps/src/utils/viewportControls.ts:125-139` — `toScreenCoords`, `toWorldCoords`
- `rb-apps/src/components/CircuitEditor2D.tsx:68-73` — Inline transform math

**Inconsistencies:**
- Fit padding: 100px vs 40px vs none
- Max zoom: 2.0 vs 4.0 vs respects option
- Ghost wire uses world coords (line 72) but mouse events in screen coords

**Fix Required:**
1. Single canonical transform helper in `@redbyte/rb-viewport`
2. Standard API:
   ```ts
   screenToWorld(screenX, screenY, camera): { x, y }
   worldToScreen(worldX, worldY, camera): { x, y }
   fitToBounds(bounds, marginPx, maxZoom): Camera
   ```
3. Same zoom clamp defaults everywhere (0.1 - 4.0)
4. Same fit margin (60px compromise)

**Acceptance:**
- Node at (x,y) means same thing across all editors
- Fit behavior identical in Playground and DesignMode
- No coordinate system bugs (ghost wire endpoints, selection boxes)

---

### Pan/Zoom Contract Violations

| View | Pan Gesture | Zoom Trigger | File | Lines |
|------|-------------|--------------|------|-------|
| Logic Playground | `Shift+LeftClick` OR `MiddleMouse` | Wheel (deltaY * 0.001, ctrl modifier 0.5x) | `rb-logic-view/src/tools/panzoom.ts` | 33, 79 |
| DesignMode (Lab Workspace) | `Space+Drag` | Wheel (deltaY * 0.001, no ctrl modifier) | `rb-apps/src/utils/viewportControls.ts` | 205-260, 177-200 |
| CircuitEditor2D | Inherits DesignMode contract | Inherits DesignMode contract | `rb-apps/src/components/CircuitEditor2D.tsx` | N/A |
| DeployMode (Board View) | No pan/zoom implemented | No zoom | `rb-apps/src/components/DeployMode.tsx` | N/A |

**Impact:** User must relearn navigation when switching between Playground and Lab Workspace.

**Fix Required:** Unify to one interaction contract across all canvas views.

---

### Keyboard Shortcut Inconsistency

| Shortcut | Logic Playground | DesignMode | Expected Behavior |
|----------|------------------|------------|-------------------|
| `F` | Not implemented | Fit to content | Fit to content |
| `Shift+F` | Not implemented | Reset view | Reset view to 1:1 |
| `Space` | Not used (uses Shift) | Pan modifier | Pan modifier (PREFERRED) |
| `ESC` | Unclear | Cancel wiring OR clear selection | Cancel current gesture |
| `Delete` | Delete selected nodes/wires | Delete selected nodes/wires | ✓ Consistent |

**Files:**
- `rb-logic-view/src/tools/panzoom.ts` — No F/Shift+F handlers
- `rb-apps/src/utils/viewportControls.ts:155-172` — F/Shift+F implemented
- `rb-apps/src/components/DesignMode.tsx:86-138` — ESC/Delete/Space handlers

**Fix Required:** Add F/Shift+F to Playground, enforce Space+Drag everywhere.

---

### Cursor Feedback Discrepancies

| View | Pan Cursor | Wiring Cursor | Idle Cursor |
|------|------------|---------------|-------------|
| Logic Playground | `grabbing` (inline style) | Not visible | `default` |
| DesignMode | `grab` (via CSS class) | `crosshair` (line 309) | `default` |
| Basys3BoardView | Not applicable | N/A | `default` (switches/LEDs: `pointer`) |

**Files:**
- `rb-logic-view/src/tools/panzoom.ts:38` — Inline `style.cursor = 'grabbing'`
- `rb-apps/src/components/DesignMode.tsx:309` — Ternary CSS cursor logic

**Fix Required:** Standardize cursor feedback using CSS variables or shared utility.

---

### Selection Model Fragmentation

| View | Multi-Select | Select+Shift | Click Background |
|------|--------------|--------------|------------------|
| Logic Playground | Yes (Ctrl/Cmd+Click assumed) | Additive | Deselect all |
| DesignMode | Yes (via `addToSelection` param) | Additive (line 193) | Deselect all |
| DeployMode | N/A (no circuit selection) | N/A | N/A |

**Files:**
- `rb-apps/src/components/DesignMode.tsx:191-213` — Selection handlers
- `rb-apps/src/components/CircuitEditor2D.tsx:45` — Receives `selectedNodeIds` set

**Impact:** Selection mostly consistent, but no box-select in either view.

---

## VISUAL DISCREPANCIES (Theme Breaking)

### StatusBar Hardcoded Colors (CRITICAL)

**Problem:** StatusBar uses emoji icons and hardcoded Tailwind colors that break theme switching.

**File:** `rb-apps/src/components/StatusBar.tsx`

| Element | Line | Hardcoded Value | Should Use |
|---------|------|-----------------|------------|
| Node count emoji | 38 | `📦` + `text-cyan-400` | Icon component + `--rb-color-accent` |
| Wire count emoji | 44 | `🔌` + `text-green-400` | Icon component + `--rb-color-success` |
| Selection emoji | 50 | `✓` + `text-purple-400` | Icon component + `--rb-color-accent-soft` |
| Dirty indicator | 58 | `●` + `text-orange-400` | Icon component + `--rb-color-warning` |
| Running status | 70, 72 | `text-green-400`, `animate-pulse` | `--rb-color-success` |
| View mode badge | 83 | `bg-gray-800 text-cyan-400` | `--rb-surface-2` + `--rb-color-accent` |

**Fix Required:** Replace emojis with proper `<Icon>` components, use CSS variables.

---

### Canvas Background Color Inconsistency

| View | Background | File | Line |
|------|------------|------|------|
| Logic Playground | Inherited (likely `--rb-bg-0`) | `rb-logic-view/src/LogicCanvas.tsx` | N/A |
| DesignMode | `bg-gray-950` (Tailwind) | `rb-apps/src/components/DesignMode.tsx` | 270 |
| CircuitEditor2D | `#0a0a0a` (hardcoded) | `rb-apps/src/components/CircuitEditor2D.tsx` | 105 |
| DeployMode | `bg-gray-950` (Tailwind) | `rb-apps/src/components/DeployMode.tsx` | 165 |

**Fix Required:** Use `--rb-bg-canvas` token everywhere.

---

### Grid Styling Hardcoded

**File:** `rb-apps/src/components/CircuitEditor2D.tsx:117-122`

```tsx
{renderGrid(camera, width, height, {
    size: gridSize,
    color: '#1a1a1a',           // ← Hardcoded
    majorLineInterval: 5,
    majorLineColor: '#2a2a2a',  // ← Hardcoded
})}
```

**Fix Required:** Use `--rb-grid-minor` and `--rb-grid-major` tokens.

---

### Board View Color Inconsistency

| Component | Hardcoded Color | File | Line |
|-----------|----------------|------|------|
| Basys3 PCB | `#1a4731` (green) | `rb-apps/src/components/boards/Basys3BoardView.tsx` | 61 |
| Basys3 LED ON | `#22c55e`, `#4ade80` | `rb-apps/src/components/boards/Basys3BoardView.tsx` | 133-134 |
| Basys3 LED OFF | `#1e3a2a`, `#111` | `rb-apps/src/components/boards/Basys3BoardView.tsx` | 133-134 |
| Arduino Plot Stroke | `#06b6d4` (cyan) | `rb-apps/src/components/boards/ArduinoInstrument.tsx` | 222 |

**Fix Required:** Define semantic board colors (`--rb-board-led-on`, `--rb-board-led-off`, `--rb-plot-trace`).

---

### Typography & Spacing Inconsistency

| Element | DesignMode | DeployMode | StatusBar |
|---------|------------|------------|-----------|
| Header font-size | `text-xs` (12px) | `text-sm` (14px) | `text-xs` (12px) |
| Button padding | `px-3 py-1` | `px-2 py-1` | N/A |
| Border style | `border-gray-800` | `border-gray-800` | `border-gray-800` |

**Mostly consistent, but no design token enforcement.**

---

## PERFORMANCE HOT SPOTS

### OscilloscopeView Re-Render Storm

**File:** `rb-apps/src/components/OscilloscopeView.tsx`

**Issues:**
- Line 70: `trackRender('OscilloscopeView')` — Heavy component
- Line 55-56: `MAX_SAMPLES = 500`, `SAMPLE_INTERVAL = 50ms` — Wall-clock sampling (not tick-driven)
- Line 130: Auto-probe enabled hook triggers selection-based re-renders
- No memoization on probe data map transformations

**Fix Required:**
1. Migrate to tick-driven sampling (not wall-clock)
2. Memoize probe data transformations
3. Throttle canvas redraws via `requestAnimationFrame`

---

### CircuitEditor2D Ghost Wire Performance Optimization

**File:** `rb-apps/src/components/CircuitEditor2D.tsx:59-86`

**Good:** Direct DOM manipulation to avoid re-renders:
```tsx
ghostLineRef.current.setAttribute('x2', String(worldX));
ghostLineRef.current.setAttribute('y2', String(worldY));
```

**Issue:** Comment on line 81 says "use rAF for throttling if needed" but not implemented.

**Fix Required:** Confirm no jank at high mouse poll rates (120Hz+).

---

### Board View Mapping Panel Virtualization

**Files:**
- `rb-apps/src/components/DeployMode.tsx:197-261` — Basys3 mapping (32+ rows)
- `rb-apps/src/components/boards/ArduinoInstrument.tsx:174-185` — Arduino channels (18+ rows)

**Issue:** No virtualization for large lists. Acceptable for 16-32 items, but watch for future expansion.

**Fix Required:** Monitor performance; add `react-window` if pin count exceeds 50.

---

## FEATURE INCONSISTENCIES

### Fit-to-View Algorithm Duplication

**Three implementations, slightly different logic:**

| Implementation | File | Lines | Padding | Max Zoom |
|----------------|------|-------|---------|----------|
| Logic Playground | `rb-logic-view/src/tools/panzoom.ts` | 142-186 | 100px (2×padding param) | 2.0 |
| DesignMode | `rb-apps/src/utils/viewportControls.ts` | 91-119 | 40px (FIT_MARGIN const) | Respects `maxZoom` option |
| (Not in CircuitEditor2D) | N/A | N/A | N/A | N/A |

**Fix Required:** Consolidate to single shared implementation.

---

### Wiring Feedback Inconsistency

| View | Ghost Wire | Snap to Port | Port Highlight |
|------|-----------|--------------|----------------|
| Logic Playground | Assumed (not visible in audit) | Yes (assumed) | Unknown |
| CircuitEditor2D | SVG `<line>` with `strokeDasharray` | Not implemented | Not implemented |

**Files:**
- `rb-apps/src/components/CircuitEditor2D.tsx:144-171` — Ghost wire implementation
- `rb-apps/src/components/CircuitEditor2D.tsx:182` — `onPortClick` handler (no snap logic)

**Fix Required:** Add port snap + highlight feedback to CircuitEditor2D.

---

### Delete/ESC Behavior Divergence

| View | ESC Behavior | Delete Behavior |
|------|-------------|-----------------|
| Logic Playground | Unknown (not audited) | Delete selection |
| DesignMode | Cancel wiring OR clear selection (line 98-106) | Delete nodes + wires (line 109-124) |

**File:** `rb-apps/src/components/DesignMode.tsx:86-138`

**Fix Required:** Document and enforce consistent ESC behavior (cancel-first, then deselect).

---

### Oscilloscope Sampling Policy Inconsistency

**File:** `rb-apps/src/components/OscilloscopeView.tsx`

**Current:** Wall-clock sampling at 50ms intervals (line 56: `SAMPLE_INTERVAL = 50`)

**Problem:** Not tick-synchronized, creates non-deterministic plots.

**Expected:** Sampling should be tick-driven (one sample per sim tick) for determinism.

**Fix Required:** Replace wall-clock timer with tick subscription.

---

## SUMMARY: CRITICAL PATH FIXES

**BLOCKERS (Phase 1 — Must Fix First):**

1. **Focus + Event Ownership** — Create CanvasHost wrapper, active canvas routing, prevent page scroll
2. **Interaction State Machine** — Shared state machine hook so views can't diverge
3. **Transform Pipeline Unification** — Single coordinate system, one set of transform helpers
4. **Unify Pan/Zoom Contract** — All views use Space+Drag, wheel zoom, F/Shift+F
5. **Fit-to-View Consolidation** — Single shared implementation with 60px padding, 0.1-4.0 zoom clamp

**Must-Fix Before Cohesion (Phase 1-4):**

6. **StatusBar Theme Compliance** — Remove emojis, use CSS variables
7. **Canvas Background Tokens** — Replace all hardcoded colors with `--rb-bg-canvas`
8. **Grid Color Tokens** — Use `--rb-grid-minor` and `--rb-grid-major`
9. **Oscilloscope Tick-Driven Sampling** — Replace wall-clock with tick subscription

**Nice-to-Have (Phase 5):**

- Box-select in all editors
- Port snap + highlight for wiring
- Virtualized mapping panels
- Consistent cursor feedback system

---

**End of Audit — Ready for Phase 1 Implementation**
