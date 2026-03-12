# Verify Surface UI Overhaul — Design Document

**Date:** 2026-03-11  
**Phase:** Student Pain Point Fix — Verification Page Usability  
**Status:** Ready for Implementation  

---

## 1. Vision

**Goal:** Make Verify visually communicate **pass/fail cause** immediately, with the clarity and directness of a professional debugging tool.

**Current Problem:** Dense UI, nested scrolling, failure info disconnected from waveform. Students don't understand why they're failing.

**Target Experience:** Three-panel engineering workstation (left: vector list | center: waveform | right: failure explanation) that auto-focuses on first failure and keeps all three panels in sync.

---

## 2. Architecture Overview

### 2.1 Layout Model: Hybrid Desktop-First

**Desktop / Laptop (> 1200px):**
- Persistent three-panel layout
- Left panel: vector/case list (selectable, keyboard nav)
- Center panel: waveform SVG + signal controls (primary workspace)
- Right panel: failure explanation (always visible, updates on selection)
- Failure auto-focus: on FAIL, first failing case selected → waveform centers → right panel populates

**Smaller Screens (≤ 1200px):**
- Keep center waveform primary (never shrink below readable)
- Collapse right explanation panel first (slide-over or stacked)
- Compress left vector table columns second
- Preserve vector selection click pattern

**UX Principle:**  
> The waveform is the central workspace. The failure explanation is contextual support. The vector table is the navigation spine.

---

## 3. Component Breakdown

Current state: `VerifySurface.tsx` (~2400 LOC) monolithic.

Target state: Split into **five clear responsibilities**:

### 3.1 `VerifyVectorListPanel` (New)

**Responsibility:** Left sidebar — vector/test case selection

**Renders:**
```
┌─────────────────────┐
│ Vectors             │
├─────────────────────┤
│ ☑ Vec 1 (PASS)     │  ← clickable, selects
│ ☒ Vec 2 (FAIL)     │  ← red highlight
│ ☑ Vec 3 (PASS)     │  ← shows pass/fail status
└─────────────────────┘
```

**Props:**
- `vectors: VerifyAuthorVector[]`
- `selectedVectorId: string | null`
- `failingVectorIds: Set<string>`
- `onSelectVector: (id: string) => void`
- `onDeleteVector?: (id: string) => void`

**Features:**
- Each row: vector label + status pill + selection highlight
- Keyboard navigation: Up/Down arrows, Enter to select, Delete to remove
- **Auto-focus on FAIL:** When `lastRun.status === 'fail'`, first failing vector selected automatically
- Scrollable if many vectors
- Can integrate "Add Vector" UI or delegateup to parent

### 3.2 `VerifyWaveformPanel` (Refactored)

**Responsibility:** Center workspace — waveform SVG + signal controls

**Refactoring:**
- Extract `WaveformViewer` SVG component (already inline, keep there)
- Add responsive resize listener (grow vertically on desktop, compress on mobile)
- Add controls above/below waveform:
  - Tick width slider (+ Shift+Wheel zoom)
  - Density selector (small/normal/large)
  - Fit view button
  - Show all / mismatch-only toggles

**Props:**
- `waveform: VerifyWaveSignalRow[]`
- `ticks: number[]`
- `failTicks: Set<number>`
- `failingSignalKeys: Set<string>`
- `selectedSignalKey: string | null`
- `selectedTick: number | null`
- `isSequential: boolean`
- `tickWidth: number`
- `waveformDensity: 'small' | 'normal' | 'large'`
- `onSelectTick: (tick: number) => void`
- `onSelectSignal: (key: string) => void`
- `onTickWidthChange: (w: number) => void`

**Behavior on FAIL:**
- Auto-zoom to failure window (ticks around first failure)
- Highlight failing signal visually
- Center ticks on failure

### 3.3 `VerifyFailureExplanationPanel` (New)

**Responsibility:** Right sidebar — show why the selected failure occurred

**Renders on FAIL:**
```
┌──────────────────────────┐
│ Failing: LED0            │
│ Vector: 4                │
├──────────────────────────┤
│ Inputs:                  │
│  SW0 = 1                 │
│  SW1 = 1                 │
├──────────────────────────┤
│ Expected:                │
│  LED0 = 1                │
├──────────────────────────┤
│ Actual:                  │
│  LED0 = 0 ❌             │
├──────────────────────────┤
│ Problem:                 │
│  Output driver mismatch  │
│                          │
│ Driver Path:             │
│  SW0 → AND1              │
│  SW1 → AND1              │
│  AND1 → LED0 ❌          │
└──────────────────────────┘
```

**Props:**
- `selectedFailure: VerifyFailureCase | null`
- `vectorInputs: Record<string, 0 | 1>`
- `allSignalValues: Record<string, string>` (for context)
- `mappedSignalMeta: Map<string, {direction, pin}>` 

**Content:**
1. **Header** — "Failing: [signal name]" + status icon
2. **Vector Context** — "Vector [N], Tick [T]"
3. **Input Values** — all inputs for this vector
4. **Expected vs Actual** — side-by-side comparison with ✓/❌ icons
5. **Problem Classification** — one of:
   - "Output driver mismatch" (expected ≠ actual)
   - "Undefined output" (actual is 'X' or '-')
   - "Floating output" (no driver)
   - "Timing mismatch" (for sequential)
   - "Logic path broken" (if derivable)
6. **Driver Path** — if available, show signal flow from inputs → logic → output
7. **Action Hints** (context-dependent)
   - "Click waveform to see trace" 
   - "Edit expected values if this is correct"

**Behavior:**
- Auto-populate when failure selected
- Collapse/hide on PASS
- Keyboard: Esc to dismiss on mobile

### 3.4 `VerifyThreePanel` (New Wrapper)

**Responsibility:** Orchestrate three-panel layout + responsive collapse

**Props:**
- `desktop: boolean` (from window size media query)
- `leftPanel: ReactNode` (VerifyVectorListPanel)
- `centerPanel: ReactNode` (VerifyWaveformPanel)
- `rightPanel: ReactNode` (VerifyFailureExplanationPanel)
- `rightPanelVisible: boolean` (on mobile, can hide)

**Responsive CSS:**
```css
.verify-three-panel {
  display: flex;
  gap: 1rem;
}

/* Desktop: all three visible */
@media (min-width: 1200px) {
  .verify-left { flex: 0 0 220px; }
  .verify-center { flex: 1; }
  .verify-right { flex: 0 0 280px; }
}

/* Tablet: right slides over center */
@media (max-width: 1199px) {
  .verify-left { flex: 0 0 180px; }
  .verify-center { flex: 1; }
  .verify-right {
    position: absolute | fixed;
    right: 0;
    width: 280px;
    transform: translateX(100%) if hidden;
  }
}

/* Mobile: stack, hide right by default */
@media (max-width: 768px) {
  .verify-left { flex: 0 0 100%; order: 2; }
  .verify-center { flex: 1 1 100%; order: 1; }
  .verify-right { display: none; }
}
```

### 3.5 `VerifySurface` (Refactored)

**Responsibility:** Orchestrate state, coordinate panels, maintain backward compatibility

**State Additions:**
- `selectedVectorId: string | null` — which vector is selected
- `selectedFailureKey: string | null` → keep, use for right panel
- `rightPanelOpen: boolean` — on mobile, is explanation visible?
- `autoFocusedOnFail: boolean` — tracks if we auto-focused on first FAIL

**Lifecycle (on verification FAIL):**
1. `lastRun.status` changes to 'fail'
2. Compute first failing vector ID
3. Auto-set `selectedVectorId` to first failure
4. Compute first failing signal for waveform centering
5. Set `selectedFailureKey` to first failure case
6. Waveform auto-zooms to failure window
7. Right panel becomes visible (auto-opened on desktop)
8. All three panels now in sync, student can click other vectors

---

## 4. Accessibility & Interaction

### 4.1 Keyboard Navigation

**Within Vector List:**
- `↑ / ↓` — move selection up/down
- `Enter` — confirm selection (already selected, but signals to "focus here")
- `Delete` — remove vector (if `onDeleteVector` defined)
- `Escape` — blur focus, return to waveform

**Within Waveform:**
- `j / J` — jump to next failure (existing)
- `k / K` — jump to previous failure (existing)
- `f / F` — fit view (existing)
- `→ / ←` — scroll ticks left/right
- `Shift + Wheel` — zoom ticks (existing)

**Global (Verify mode):**
- `Tab` — cycle through panels in order (left → center → right)
- `Shift+Tab` — cycle backward

### 4.2 Visual Failure Indicators

**Color + Icon (not color-only):**
- ❌ Red X icon for FAIL rows
- ✓ Green check for PASS rows
- Orange ⚠ for warnings (stale, undefined)
- Icon + color always paired

**Contrast:**
- WCAG AA minimum on all text
- Failing signal highlight: 4.5:1 ratio on background
- Waveform grid: subtle but readable at zoom level

**Hover Tooltips** (signal labels in waveform):
```
Signal: LED0
Direction: Output
Pin: D17
Expected: 1
Actual: 0
Status: FAIL ❌
```

### 4.3 Font Scaling

- Waveform font respects page zoom (`zoom: 100%` at baseline)
- Signal labels don't overflow with "..." truncation
- Tick numbers readable at smallest zoom (12px minimum)

---

## 5. Failure Explanation System

### 5.1 Data Structure: `VerifyFailureCase`

```typescript
interface VerifyFailureCase {
  tick: number;
  signal: string;
  expected: string;           // '0', '1', 'X', '-'
  actual: string;             // observed value
  vectorId?: string;          // which vector this came from
  caseIndex?: number;         // which case within vector
}
```

### 5.2 Problem Classification

When right panel populates, compute one classification:

```typescript
type FailureProblem = 
  | 'output-mismatch'         // expected !== actual (both valid)
  | 'undefined-output'        // actual === 'X'
  | 'floating-output'         // actual === '-'
  | 'timing-mismatch'         // for sequential (clock edge issue)
  | 'logic-path-broken'       // derived from circuit
  | 'constraint-unmet';       // XDC violation

function classifyFailure(failure: VerifyFailureCase, circuit: Circuit): FailureProblem {
  if (failure.actual === 'X') return 'undefined-output';
  if (failure.actual === '-') return 'floating-output';
  if (expectedValue !== actualValue) return 'output-mismatch';
  // ... more complex logic
}
```

### 5.3 Driver Path Resolution

If available (from circuit metadata), show the signal path:

```
Input: SW0
  ↓
Logic: AND1_GATE
  (inputs: SW0, SW1 → output: AND1_OUT)
  ↓
Output: LED0
  ↓
Status: ❌ Expected 1, got 0
```

---

## 6. Implementation Roadmap

### Phase 1: Extract & Refactor (1–2 sessions)
1. Extract `VerifyVectorListPanel` from VerifySurface state
2. Extract `VerifyFailureExplanationPanel` UI structure
3. Create `VerifyThreePanel` layout wrapper
4. Adapt `VerifySurface` to use new panels
5. Wire auto-focus logic on FAIL

### Phase 2: Accessibility & UX (1 session)
1. Add keyboard navigation to vector list
2. Add color + icon failure indicators
3. Add signal hover tooltips
4. Ensure WCAG AA contrast
5. Test on tablet/mobile responsive behavior

### Phase 3: Failure Explanation (1 session)
1. Implement problem classification logic
2. Add driver path rendering (if metadata available)
3. Add context hints and actions
4. Test with real failures from test vectors

### Phase 4: Waveform Integration (1 session)
1. Wire failure selection → waveform center/zoom
2. Highlight failing signal in waveform
3. Sync all three panels on vector selection
4. Test cross-panel interactions

---

## 7. Acceptance Criteria

✓ **Layout:** Desktop shows all three panels; mobile hides right panel first  
✓ **Auto-Focus:** On FAIL, first failing case selected automatically  
✓ **Waveform:** Centers and zooms on failure window  
✓ **Failure Panel:** Shows expected vs actual, problem type, driver path  
✓ **Keyboard:** Arrow keys navigate vectors, Tab cycles panels  
✓ **Accessibility:** Color + icon for status, hover tooltips, WCAG AA contrast  
✓ **Responsive:** All three breakpoints (desktop, tablet, mobile) work  
✓ **Build & Tests:** No regressions, gates pass  
✓ **UX Feel:** "Engineering debugger", not a settings panel or drawer  

---

## 8. Files to Modify / Create

### Create (New Components):
- `packages/rb-apps/src/apps/ide/surfaces/VerifyVectorListPanel.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/VerifyFailureExplanationPanel.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/VerifyThreePanel.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/verify-failure-classifier.ts` (logic only)

### Refactor:
- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (orchestration, state management)
- `packages/rb-apps/src/apps/ide/surfaces/styles/VerifySurface.css` (three-panel layout CSS)

### No Changes Needed:
- `WaveformViewer` (inline SVG component stays in VerifySurface)
- Simulation engine, verify runner (behavioral logic only)
- Export, Hardware surfaces

---

## 9. Design Tokens (CSS)

**Spacing & Sizing:**
- Panel gaps: `1rem`
- Panel padding: `1rem`
- Left panel width (desktop): `220px`
- Right panel width (desktop): `280px`
- Waveform row height: `38px` (scalable via density)

**Colors (existing scheme or new):**
- Failing signal: `#ff6b6b` (red)
- Passing signal: `#2ec4b6` (teal)
- Failure icon: `❌` (character) or `<Icon />` component
- Pass icon: `✓` (character)

**Typography:**
- Vector list labels: `11px / 14px`
- Failure panel headings: `12px` bold
- Signal tooltips: `12px` monospace
- Waveform tick labels: `11px`

---

## 10. Testing Strategy

**Unit Tests:**
- `VerifyVectorListPanel` selection logic
- `VerifyFailureExplanationPanel` classificationlogic
- `VerifyThreePanel` responsive breakpoints

**Integration Tests:**
- FAIL → auto-select first vector → panel sync
- Click vector → waveform centers → right panel updates
- Keyboard navigation → panel focus → Enter selects

**E2E Tests:**
- Student flow: create vectors → run → see failure → click other vectors → understand logic

---

## 11. Success Metrics

After this overhaul ships:

1. **Clarity:** When a test fails, student can see why in < 2 seconds
2. **Workflow:** Click vector → waveform + explanation sync, no manual navigation
3. **Accessibility:** Students using keyboard or screen reader can navigate
4. **Responsiveness:** Works on 13" laptop, 11" tablet, no UI broken on mobile
5. **Confidence:** Students report "I understand the failure" vs "I'm lost"

---

## 12. Notes

- **Phone Experience:** Probably still awkward for this level of debugging, but don't make it worse. Stack horizontal → vertical, hide right panel.
- **Future:** If time permits, add "similar failures" quick-jump or "fix prediction" hints.
- **Data:** All three panels pull from same `lastRun` data source; no stale cross-panel state.

---

End of Design Document.
