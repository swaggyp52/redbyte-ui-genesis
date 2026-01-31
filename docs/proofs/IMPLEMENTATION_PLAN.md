# RedByte OS Cohesion Implementation Plan
**Execution Order for Making RedByte Production-Ready**

---

## PHASE 1: UNIFY INTERACTION CONTRACT (Highest Leverage)

**Goal:** Every canvas-like view behaves identically — same pan/zoom/keyboard, no event conflicts, deterministic coordinate transforms.

**Critical:** Phase 1 is **3 PRs** in strict order. Each PR must pass acceptance tests before next PR starts.

---

### PR 1 — rb-viewport + CanvasHost + Event Routing

**Goal:** Establish "active canvas" concept and eliminate focus/event ownership chaos.

**Files to Create:**

1. **`packages/rb-viewport/package.json`** — New package declaration
2. **`packages/rb-viewport/src/index.ts`** — Export all viewport primitives
3. **`packages/rb-viewport/src/types.ts`** — ViewportState, ViewportControls, ContentBounds
4. **`packages/rb-viewport/src/useUnifiedViewport.ts`** — Consolidated pan/zoom logic
5. **`packages/rb-viewport/src/useCanvasInteraction.ts`** — Shared state machine
6. **`packages/rb-viewport/src/transforms.ts`** — Single coordinate transform helpers
7. **`packages/rb-viewport/src/CanvasHost.tsx`** — Event routing wrapper component
8. **`packages/rb-viewport/src/ViewportHUD.tsx`** — Reusable zoom%/mode indicator

**CanvasHost Implementation:**

```tsx
<CanvasHost
  onActive={() => setActiveCanvas('playground')}
  onInactive={() => setActiveCanvas(null)}
  preventPageScroll={true}
>
  {/* Canvas content */}
</CanvasHost>
```

**Responsibilities:**
- Sets "active canvas" on pointer enter (not click)
- Routes wheel/keyboard events ONLY when active
- Prevents page scroll when canvas is active
- Manages cursor feedback (grab/grabbing/crosshair)

**useCanvasInteraction State Machine:**

```ts
type InteractionState = 'idle' | 'panning' | 'draggingNode' | 'wiring' | 'boxSelect' | 'modal';

const { state, canPan, canWire, canSelect, cancelGesture } = useCanvasInteraction();
```

**Standard Transitions:**
- ESC: Cancel current gesture first (wiring → idle, then idle → deselect)
- Space+Down: Enter panning mode (if not in wiring/modal)
- Space+Up: Exit panning mode
- Click node: Enter draggingNode mode
- Click port: Enter wiring mode
- Click+Drag empty: Enter boxSelect mode

**Transform Helpers (`transforms.ts`):**

```ts
export function screenToWorld(screenX: number, screenY: number, camera: Camera): { x: number; y: number };
export function worldToScreen(worldX: number, worldY: number, camera: Camera): { x: number; y: number };
export function fitToBounds(bounds: ContentBounds, marginPx: number, maxZoom: number): Camera;
```

**Standard Constants:**
- FIT_MARGIN: 60px (compromise)
- MIN_ZOOM: 0.1
- MAX_ZOOM: 4.0
- ZOOM_SPEED: 0.001 (no ctrl modifier)

**Interaction Contract:**
- `Space+Drag` = Pan (no Shift+Click or MiddleMouse)
- `Wheel` = Cursor-centered zoom
- `F` = Fit to content
- `Shift+F` = Reset to 1:1
- `ESC` = Cancel gesture (cancel-first, then deselect)

**Verification (Acceptance Tests):**

1. ✓ Hover Playground → Space+Drag/F/ESC work without clicking first
2. ✓ Wheel zoom NEVER scrolls page when cursor over canvas
3. ✓ Sidebar has focus → canvas shortcuts don't fire
4. ✓ ESC cancels wiring first, then deselects on second ESC
5. ✓ Space held during wiring → panning blocked (stays in wiring mode)
6. ✓ All coordinate transforms consistent (test: node at (100, 100) renders at same screen position across all editors)

**Files to Deprecate (add warning comments):**
- `packages/rb-apps/src/utils/viewportControls.ts` — Will be removed in PR 2
- `packages/rb-logic-view/src/tools/panzoom.ts` — Will be removed in PR 2

---

### PR 2 — Migrate Logic Playground to Unified Viewport

**Goal:** Playground matches new interaction contract exactly.

**Files to Modify:**

1. **`packages/rb-logic-view/src/LogicCanvas.tsx`**
   - Wrap canvas in `<CanvasHost>`
   - Replace `usePanZoomHandlers` with `useUnifiedViewport`
   - Replace local interaction logic with `useCanvasInteraction`
   - Add `<ViewportHUD>` component

2. **`packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`**
   - Pass viewport state to LogicCanvas
   - Remove window-level keyboard listeners (now in CanvasHost)

**Changes:**
- Remove Shift+Click pan trigger
- Remove MiddleMouse pan trigger
- Add F/Shift+F handlers (from CanvasHost)
- ESC behavior: Cancel gesture first, then deselect

**Files to Delete:**
- `packages/rb-logic-view/src/tools/panzoom.ts` — Replaced by @redbyte/rb-viewport

**Cursor Feedback:**
- Use CSS variables for cursors (no inline styles)
- `--rb-cursor-grab`, `--rb-cursor-grabbing`, `--rb-cursor-crosshair`

**Verification (Acceptance Tests):**

1. ✓ Playground Space+Drag pans (no Shift needed)
2. ✓ F fits circuit to view (60px margin)
3. ✓ Shift+F resets to center (zoom 1.0)
4. ✓ Wheel zoom cursor-centered (no jitter)
5. ✓ ESC cancels wiring, second ESC deselects
6. ✓ ViewportHUD shows zoom% and current mode
7. ✓ No page scroll when wheeling over canvas

---

### PR 3 — Migrate DesignMode/CircuitEditor2D + Board View Camera

**Goal:** All canvas views use identical interaction contract.

**Files to Modify:**

1. **`packages/rb-apps/src/components/DesignMode.tsx`**
   - Wrap canvas in `<CanvasHost>`
   - Replace `useViewportControls`, `useViewportWheel`, `useViewportPan`, `useViewportKeyboard`
   - Import `useUnifiedViewport` and `useCanvasInteraction`
   - Remove local Space/ESC handlers (now in CanvasHost)
   - Add `<ViewportHUD>`

2. **`packages/rb-apps/src/components/CircuitEditor2D.tsx`**
   - Receive camera from unified viewport
   - Use `screenToWorld`/`worldToScreen` from `@redbyte/rb-viewport/transforms`
   - Remove inline coordinate math (line 68-73)

3. **`packages/rb-apps/src/components/DeployMode.tsx`**
   - Add minimal pan/zoom to board view
   - Wrap board in `<CanvasHost>` (fit + zoom only, no node dragging)
   - Use same zoom controls as circuit views

**Files to Delete:**
- `packages/rb-apps/src/utils/viewportControls.ts` — Replaced by @redbyte/rb-viewport

**Verification (Acceptance Tests):**

1. ✓ DesignMode pan/zoom identical to Playground
2. ✓ Minimap updates correctly with unified camera
3. ✓ Wiring works (no conflict with Space panning)
4. ✓ Board view has fit/zoom (even if no pan)
5. ✓ Ghost wire endpoints use `worldToScreen` correctly (no coordinate bugs)
6. ✓ Box select rectangle accurate (uses shared transforms)
7. ✓ All three views (Playground, DesignMode, DeployMode) have ViewportHUD

---

### Phase 1 Complete — Premium Interaction Checklist

After PR 3 merges, RedByte must pass:

1. ✓ **Wheel zoom never scrolls page** while canvas is active
2. ✓ **Space pan never drags nodes** and never types space into inputs
3. ✓ **ESC cancels current action** (wire, drag, box select) consistently across all views
4. ✓ **Fit uses identical padding + zoom clamp** everywhere (60px, 0.1-4.0)
5. ✓ **Cursor language consistent**: grab/grabbing/crosshair only from shared CSS variables
6. ✓ **Coordinate transforms correct**: Node at (x,y) renders identically in Playground/DesignMode
7. ✓ **Focus never breaks shortcuts**: Hover canvas → shortcuts work without clicking

**If any test fails, Phase 1 is incomplete.**

---

## PHASE 2: MAKE 2D LAB FEEL LIKE REAL EDITOR

**Goal:** DesignMode feels professional, not like a prototype.

### 2.1 Add Proper Tool Palette

**Files to Modify:**
- `packages/rb-apps/src/components/DesignMode.tsx:272-303` — Replace basic palette

**New Palette:**
- Tool modes: `Select | Wire | Place Gate | Place IO`
- Undo/Redo buttons (disabled if no history)
- Grid toggle, Snap toggle
- Consistent button styling (use `--rb-button-*` tokens)

**Verification:**
- Palette looks like Playground's ComponentPalette
- Tool switching works
- Visual feedback for active tool

---

### 2.2 Implement Port Snap + Highlight

**Files to Modify:**
- `packages/rb-apps/src/components/CircuitEditor2D.tsx` — Add snap logic

**Logic:**
- When wiring, detect nearby ports (within 20px radius)
- Snap ghost wire endpoint to nearest port
- Highlight target port with glow effect
- Prevent invalid connections (output→output, input→input)

**Verification:**
- Ghost wire snaps to ports smoothly
- Port highlights on hover
- Invalid connections blocked

---

### 2.3 Improve Wiring Visual Feedback

**Files to Modify:**
- `packages/rb-apps/src/components/CircuitEditor2D.tsx:144-171` — Ghost wire styling

**Changes:**
- Use `--rb-wire-ghost` token for stroke color
- Add animated dash offset for "flowing" effect
- Thicker stroke (3px instead of 2px)
- End cap: circle indicator at mouse cursor

**Verification:**
- Ghost wire feels premium
- Animation smooth, not distracting

---

### 2.4 Add Selection Box (Drag-to-Select)

**Files to Modify:**
- `packages/rb-apps/src/components/CircuitEditor2D.tsx` — Add box select logic

**Implementation:**
- Click+Drag on empty canvas = draw selection rectangle
- All nodes inside rect get selected
- Works in "Select" tool mode only (not during wiring)

**Verification:**
- Box select works like Playground
- Doesn't conflict with panning (Space prevents box select)

---

## PHASE 3: REPLACE 3D MESS WITH PREMIUM BOARD INSTRUMENT

**Goal:** Deploy tab is demo-first quality.

### 3.1 Basys3: Flat 2.5D Board (Not 3D Scene)

**Files to Modify:**
- `packages/rb-apps/src/components/boards/Basys3BoardView.tsx` — Already SVG-based, enhance

**Changes:**
- Add subtle board tilt (2.5D perspective transform)
- Improve switch flip animation (smooth easing, not linear)
- Add LED glow intensity based on signal strength (not just on/off)
- Pin labels: show signal name on hover, not just SW/LD index
- Add "Click to Inspect" hint overlay

**Verification:**
- Board feels tactile, not flat
- Switch flips feel responsive
- LED glow looks premium (not harsh)

---

### 3.2 Basys3: Animated State Changes

**Files to Modify:**
- `packages/rb-apps/src/components/boards/Basys3BoardView.tsx:88-106` — Switch rendering

**Animations:**
- Switch flip: 100ms ease-out transition
- LED on/off: 150ms glow fade-in/out
- Inspector panel: slide-in from right (200ms)

**Use CSS Transitions:**
```tsx
style={{
  transition: 'transform 100ms var(--rb-ease-out)',
  transform: isOn ? 'translateY(-10px)' : 'translateY(0)'
}}
```

**Verification:**
- All state changes animated
- No jank at 60Hz sim tick rate
- Animations respect `prefers-reduced-motion`

---

### 3.3 Arduino: Strip Chart Reliability

**Files to Modify:**
- `packages/rb-apps/src/components/boards/ArduinoInstrument.tsx:210-232` — Plot SVG

**Fixes:**
- Replace wall-clock sampling with tick-driven updates
- Ring buffer: fixed 50-sample window
- Auto-scale Y-axis (0-1 for digital, dynamic for analog)
- Add time labels on X-axis (T-5s, T-4s, ..., T-0s)
- Freeze on hover (show cursor readout)

**Verification:**
- Same plot every run with same inputs
- No missing segments
- No rescaling jitter

---

### 3.4 Arduino: PWM Slider Polish

**Files to Modify:**
- `packages/rb-apps/src/components/boards/ArduinoInstrument.tsx:134-137` — PWM slider

**Changes:**
- Custom styled slider (not default HTML5 range)
- Value label above thumb
- Snap to 10% increments
- Color-coded: blue gradient for PWM value

**Verification:**
- Slider feels premium
- Value updates circuit immediately
- Visual feedback clear

---

## PHASE 4: MAKE SCOPE/PLOTTING RELIABLE

**Goal:** Oscilloscope is deterministic and boring (in a good way).

### 4.1 Migrate to Tick-Driven Sampling

**Files to Modify:**
- `packages/rb-apps/src/components/OscilloscopeView.tsx:55-56` — Remove wall-clock timer

**Implementation:**
- Replace `SAMPLE_INTERVAL = 50ms` with tick subscription
- Sample on every Nth tick (configurable: 1, 10, 100)
- Store samples as `{ tick: number, value: 0 | 1 }[]`

**Verification:**
- Same inputs = same plot every time
- Replay produces identical plot

---

### 4.2 Fixed Ring Buffer

**Files to Modify:**
- `packages/rb-apps/src/components/OscilloscopeView.tsx:55` — `MAX_SAMPLES`

**Implementation:**
- Ring buffer size: 500 samples
- Eviction policy: FIFO (oldest sample dropped)
- Time axis: tick-based, not wall-clock

**Verification:**
- Plot never exceeds 500 samples
- Scrolling smooth, no lag

---

### 4.3 Clear Labels + Units

**Files to Modify:**
- `packages/rb-apps/src/components/OscilloscopeView.tsx` — Canvas rendering

**Additions:**
- Y-axis labels: "HIGH (1)", "LOW (0)"
- X-axis labels: Tick numbers (not seconds)
- Grid lines at 0.5V threshold
- Probe legend: color + signal name

**Verification:**
- Plot is self-explanatory
- No guessing what axes mean

---

### 4.4 Pause/Resume + Clear

**Files to Modify:**
- `packages/rb-apps/src/components/OscilloscopeView.tsx:116-117` — Pause controls

**Features:**
- Pause: Stop sampling, freeze display
- Resume: Continue sampling from current tick
- Clear: Wipe buffer, reset to tick 0

**Verification:**
- Pause doesn't lose data
- Clear instant, no flicker

---

## PHASE 5: VISUAL SYSTEM + OS COHESION

**Goal:** RedByte looks like one product.

### 5.1 Create rb-tokens Package Enhancement

**Files to Create:**
- `packages/rb-tokens/src/canvas-tokens.ts` — Canvas-specific colors
- `packages/rb-tokens/src/board-tokens.ts` — Board-specific colors

**Tokens to Add:**
```ts
export const canvasTokens = {
  bgCanvas: '#0a0a0a',
  gridMinor: '#1a1a1a',
  gridMajor: '#2a2a2a',
  wireGhost: '#00ffff',
  wireLive: '#3b82f6',
  nodeSelected: '#60a5fa',
};

export const boardTokens = {
  ledOn: '#22c55e',
  ledOff: '#1e3a2a',
  switchBody: '#333333',
  switchLever: '#dddddd',
  plotTrace: '#06b6d4',
};
```

**Verification:**
- Tokens imported across all views
- Theme switching works

---

### 5.2 StatusBar Redesign

**Files to Modify:**
- `packages/rb-apps/src/components/StatusBar.tsx` — Complete rewrite

**New Design:**
```
[Left]                 [Center]              [Right]
Nodes: 24 | Wires: 18  Running @ 20Hz       Zoom: 100% | ? Help
```

**Changes:**
- Remove ALL emojis (📦 🔌 ✓ ●)
- Use `<Icon>` components from `rb-icons`
- All colors from CSS variables
- Clickable zoom (opens zoom controls)

**Verification:**
- No hardcoded colors
- Theme-aware
- Professional appearance

---

### 5.3 Apply Tokens to All Canvas Backgrounds

**Files to Modify:**
- `packages/rb-apps/src/components/DesignMode.tsx:270`
- `packages/rb-apps/src/components/CircuitEditor2D.tsx:105`
- `packages/rb-apps/src/components/DeployMode.tsx:165`

**Changes:**
```tsx
// Before:
className="bg-gray-950"
style={{ background: '#0a0a0a' }}

// After:
style={{ background: 'var(--rb-bg-canvas)' }}
```

**Verification:**
- All views use same background
- No more hardcoded grays

---

### 5.4 Grid Rendering Standardization

**Files to Modify:**
- `packages/rb-apps/src/components/CircuitEditor2D.tsx:117-122`
- `packages/rb-logic-view/src/tools/grid.tsx` — If exists

**Changes:**
```tsx
{renderGrid(camera, width, height, {
    size: 20,
    color: 'var(--rb-grid-minor)',      // ← Token
    majorLineInterval: 5,
    majorLineColor: 'var(--rb-grid-major)', // ← Token
})}
```

**Verification:**
- Grid colors match across all views
- Theme-aware

---

### 5.5 Button Primitive Standardization

**Files to Modify:**
- `packages/rb-primitives/src/Button.tsx` — Ensure token compliance

**Requirements:**
- All buttons use `--rb-button-*` tokens
- Variants: primary, secondary, ghost, danger
- Sizes: sm, md, lg
- Consistent padding, border-radius, shadow

**Verification:**
- All buttons across app look cohesive
- No one-off button styles

---

### 5.6 Typography Scale Enforcement

**Files to Audit:**
- All components using `text-xs`, `text-sm`, `text-base`

**Standardize:**
- Headers: `text-sm font-bold uppercase tracking-wide`
- Body: `text-xs`
- Labels: `text-[10px] font-mono`

**Verification:**
- Consistent hierarchy
- No random font sizes

---

## IMPLEMENTATION ORDER (Gantt-Style)

```
Week 1:
  Phase 1.1-1.3: Unified Viewport Contract (3 days)
  Phase 1.4-1.5: Consolidation + HUD (2 days)

Week 2:
  Phase 2.1-2.2: Tool Palette + Port Snap (2 days)
  Phase 2.3-2.4: Wiring Feedback + Box Select (3 days)

Week 3:
  Phase 3.1-3.2: Basys3 Board Polish (2 days)
  Phase 3.3-3.4: Arduino Instrument Reliability (3 days)

Week 4:
  Phase 4.1-4.4: Oscilloscope Tick-Driven Sampling (4 days)
  Phase 5.1-5.2: Token Package + StatusBar Redesign (1 day)

Week 5:
  Phase 5.3-5.6: Visual Cohesion Sweep (4 days)
  Testing + Documentation (1 day)
```

**Total: ~25 days of execution work**

---

## VERIFICATION CRITERIA (Definition of Done)

After all phases complete, RedByte must pass:

1. **Interaction Test:** User can pan/zoom/fit in Playground and Lab Workspace without noticing difference
2. **Visual Test:** Screenshots from all three modes look like same app family
3. **Theme Test:** Switch theme → no hardcoded colors visible
4. **Performance Test:** No jank at 120Hz mouse movement
5. **Determinism Test:** Same inputs = same oscilloscope plot every run
6. **Demo Test:** Board views are impressive enough to show professor first

**If any test fails, cohesion is incomplete.**

---

**End of Implementation Plan — Ready to Execute Phase 1**
