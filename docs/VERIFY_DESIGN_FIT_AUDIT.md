# Verify Design-Fit Audit

**Date:** 2026-03-19
**Context:** Post-Slice 6 (AssertionCanvas read-only overlay complete)
**Purpose:** Identify spatial, density, and visual hierarchy issues blocking page usability

---

## 1. What Looks Visually Wrong

The Verify page currently exhibits several critical design-fit issues:

### 1.1 Vertical Compression
- **Waveform scroll container:** `max-height: min(75vh, 900px)` — severely constrained
- **In compact mode:** `max-height: min(65vh, 750px)` — even more compressed
- **Result:** User must zoom out to see the full picture, indicating layout is not tuned for comfortable viewing
- **Symptom:** Screenshots show signs of extreme zoom-out just to visualize page structure

### 1.2 Dead Negative Space
- **Top section:** Scenario controls + run status + tick explainer consume ~15-20% of viewport without proportional content value
- **Meta strips:** Legend, cursor readout, status pills scatter across horizontal band without clear visual grouping
- **Result:** Important surfaces squeezed into thin rows while empty space above wastes potential
- **Evidence:** First screenshot shows large empty central region despite compressed waveform

### 1.3 Weak Section Hierarchy
- **No dominant centerpiece:** Page reads as "stacked modules" rather than "cohesive studio"
- **Scenario controls:** Currently text links (`+ New Dup Rename Delete`), look improvised, not like a real toolbar
- **Waveform framing:** Minimal borders, thin background, no visual weight
- **AssertionCanvas:** Bolted on with minimal padding, doesn't feel integrated
- **Inspector drawer:** Subordinate but visually competes with main content

### 1.4 Inconsistent Spacing Rhythm
- **Observed:** Mix of 8px, 10px, 12px, 14px padding with no clear system
- **Gap sizes:** Scattered 4px, 6px, 8px gaps without semantic meaning
- **Borders:** Different radii (4px, 12px, 14px) without pattern
- **Result:** Page feels ad-hoc, assembled rather than designed

### 1.5 Poor Control Density
- **Scenario toolbar:** Too sparse, text-based, no visual affordance
- **Waveform controls:** Density buttons scattered (standard/compact density picker)
- **Cursor controls:** Stashed in secondary row (Set A, Set B, Jump A, Jump B, Clear AB)
- **Result:** Controls feel buried and hard to discover

---

## 2. Regions Are Underweighted or Overweighted

### Overweighted (Taking Too Much Space)
| Region | Current Allocation | Problem |
|--------|-------------------|---------|
| Scenario Meta | ~8-10% top | Dense info (name, hash, buttons) in sparse layout |
| Status Strips | ~6-8% | Multiple horizontal bands (legend, cursor readout, meta) |
| Tick Explainer | ~5-8% (collapsed) | Collapsible but still reserves vertical real estate |
| Inspector Drawer | ~25-30% bottom | Fixed height, competes with waveform above |
| **Total Overhead:** | **~50%** of viewport | This is why zoom-out feels necessary |

### Underweighted (Not Getting Enough Space)
| Region | Current Allocation | Problem |
|--------|-------------------|---------|
| StimulusCanvas | ~0% when not authoring | Hero surface is hidden/demoted |
| Observed Waveform | ~25-30% max | Core visualization crushed by overhead |
| AssertionCanvas | ~5% (when visible) | Read-only overlay, no visual presence |
| Canvas Grouping Headers | Minimal | "Stimulus" / "Observed" / "Asserted" labels are faint |

### Result
**Waveform gets 25-30% of tall-stretched container, when it should get 50%+**

---

## 3. Why Current Layout Requires Excessive Zoom-Out

Three compounding factors:

### A. Fixed-Height Constraints
```css
.ide-verify-waveform-scroll {
  max-height: min(75vh, 900px);  /* ← Hard ceiling */
  min-height: 480px;              /* ← Hard floor */
}
```
- In standard mode: locked to 75% of viewport
- In compact mode: locked to 65% of viewport
- VH-based sizing doesn't flex with density modes
- Result: Page layout is rigid, doesn't adapt to content

### B. Unprioritized Overhead
- Scenario section, status strips, explainer, legend, cursor readout each demand horizontal space
- None are collapsible or density-aware
- Together they force waveform into remainder
- Zoom-out is the only way to fit all regions comfortably in the same view

### C. Two-Panel Layout (Waveform + Inspector)
- Inspector drawer is fixed-height at bottom (25-30% allocation)
- Waveform squeezed above it
- Side-by-side layout would give each more space, but requires architecture change
- Workaround: Zoom out to see both without scrolling

---

## 4. Proposed Spacing / Density / Hierarchy Model

### New Vertical Allocation (at 1440px viewport height)
```
┌─────────────────────────────────────────┐
│ SCENARIO TOOLBAR (new compact)    40px  │  ← Solid, dark, real controls
├─────────────────────────────────────────┤
│                                         │
│ STIMULUS AUTHORING ZONE           180px │  ← StimulusCanvas when editing
│                                         │
├─────────────────────────────────────────┤
│ OBSERVED WAVEFORM ZONE                  │
│ (WaveformViewer + AssertionCanvas)      │
│ + Meta (legend, readout, explainer      │  ← ~500px (flexible to ~700px)
│        compressed into single row)      │
├─────────────────────────────────────────┤
│ INSPECTOR DRAWER TOGGLE         (32px)  │  ← Collapsed, scrollable
├─────────────────────────────────────────┤
│ DETAILS PANEL                   (flexible) │ ← Expanded on demand
└─────────────────────────────────────────┘
```

### Key Design Principles

**1. Rhythm System (New)**
```
--rb-space-0 = 2px
--rb-space-1 = 4px
--rb-space-2 = 8px   ← section padding
--rb-space-3 = 12px  ← major panel margin
--rb-space-4 = 16px  ← group header spacing
--rb-space-5 = 24px  ← section margin
--rb-space-6 = 32px  ← major boundary
```

**2. Hierarchy (New)**

| Level | Treatment | Use Case |
|-------|-----------|----------|
| Hero | Large, strong framing, 32px internal padding | StimulusCanvas + Waveform |
| Primary | Solid toolbar, dark background, 40px min height | Scenario controls |
| Secondary | Grouped headers, 20px row height | "Stimulus", "Observed", "Asserted" labels |
| Tertiary | Inline meta, 12px chips | Legend, cursor readout, counters |
| Subordinate | Minimal borders, 8px padding | Inspector drawer, details |

**3. Focus (New)**

Define one **dominant visual centerpiece:**

```
┌──────────────────────────────────────────────────────────────┐
│  Scenario Toolbar (compact, 40px)                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│              ★ WAVEFORM STUDIO ★                            │
│      (3-layer model: Stimulus → Observed → Asserted)        │
│         [Centered, ~60% of available viewport]              │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Details / Inspector (expandable, scrollable)               │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Proposed Panel Sizing and Viewport Allocation

### Standard Mode (1440px high)

```
Scenario Toolbar:          40px    (5%)
─────────────────
Stimulus Canvas:          120px    (8%)    ← When editing
─────────────────
Waveform Studio:          750px   (52%)    ← Hero zone
  ├─ Headers              40px
  ├─ Legend/Meta          30px
  ├─ WaveformViewer      550px
  └─ AssertionCanvas      90px
─────────────────
Inspector Toggle:          32px    (2%)    ← Collapsed state
─────────────────
Details Panel:           ~355px   (25%)    ← Expanded, scrollable
──────────────
  TOTAL:               1440px
```

### Compact Mode (1080px high)

```
Scenario Toolbar:          40px    (4%)
─────────────────
Stimulus Canvas:          100px    (9%)
─────────────────
Waveform Studio:          600px   (56%)
  ├─ Headers              32px
  ├─ Legend/Meta          24px    ← Denser
  ├─ WaveformViewer      450px
  └─ AssertionCanvas      64px
─────────────────
Inspector Toggle:          32px    (3%)
─────────────────
Details Panel:           ~288px   (27%)    ← Fully scrollable
──────────────
  TOTAL:               1080px
```

### Benefits
- ✓ Waveform gets 50%+ of viewport (was 25-30%)
- ✓ No zoom-out needed at normal viewport sizes
- ✓ Scenario toolbar is 5-9% (was invisible / weak)
- ✓ Inspector drawer is collapsible, not always taking space
- ✓ Flexible layout adapts to content density

---

## 6. Scenario Toolbar Redesign

**Current state:** Text links scattered (`+ New Dup Rename Delete`)
**Target:** Real toolbar with visual affordance

### New Scenario Toolbar Structure (40px)

```
┌────────────────────────────────────────────────────────────────┐
│  [Scenario ▼] [●] │ + New   Dup   Rename   Delete │ [⋮ More]   │
│  <dropdown/>      │         <icon buttons/>        │            │
│                   │                                │            │
│  Scenario Name    │  Actions                       │  Hash/Meta │
│  w/ version       │  (icon-only buttons)           │  (small)   │
└────────────────────────────────────────────────────────────────┘
```

### Left Zone (Scenario Selector)
- Dropdown showing current scenario name + version
- Status pill (✓ Ready, ⟳ Stale, ✗ Error)
- Quick indicator + switchability

### Center Zone (Toolbarctions)
- `+` (new scenario) — primary
- `Dup` (duplicate) — secondary
- `Rename` (rename) — secondary
- `Delete` (delete) — danger
- **All icon+label buttons** to start; condense to icons only in compact mode

### Right Zone (Metadata)
- Hash badge (very small text)
- Status indicator
- Menu button (⋮) for additional actions

### Styling
- Background: Solid dark (`--rb-surface-2`)
- Height: 40px (fixed, not flexible)
- Padding: 8px left/right, 6px top/bottom
- Buttons: IdeButton tone='secondary' with icons
- Typography: Smaller, 12px max

**Result:** Toolbar looks real, has weight, is discoverable

---

## 7. Regions Needing Stronger Visual Treatment

### A. Stimulus Canvas (When Editing)
**Current:** Minimal framing, no header separation
**Proposed:**
- Add 12px top margin gap
- Strong section header: "Stimulus" (all-caps, 14px, letter-spacing)
- Light background band (`--rb-surface-1`)
- Min 20px padding around grid
- Clear separation from waveform below

### B. Waveform Studio
**Current:** Nested details + legend + legend + cursor + waveform all jammed together
**Proposed:**
- Consolidate meta strip ABOVE waveform (not below)
- Single row: [Legend badges] [Cursor A/B readout] [Zoom controls]
- Max 30px height
- Grouped visually with waveform
- Dark background to create unified "Stage" feel

### C. Observed / Asserted Layer Headers
**Current:** Faint text in StimulusCanvas
**Proposed:**
- Same in both canvases: "Stimulus", "Observed", "Asserted"
- 14px uppercase, 0.08em letter-spacing
- Dark text on light band (`--rb-surface-2`)
- 20px height (gives breathing room)
- Vertical separator lines between row groups

### D. Inspector Drawer
**Current:** Competes visually with primary content
**Proposed:**
- Collapsed by default (32px toggle bar)
- Only expand on user demand or auto-expand on FAIL
- When expanded: smooth slide, semi-transparent overlay or side panel
- Clear visual separation from waveform

### E. Canvas Grid Row Height
**Current:** ROW_H dynamic (34/48/62px)
**Proposed:**
- Default: 44px (more breathing room)
- Compact: 34px (current "small")
- Spacious: 56px (new option)
- More generous horizontal padding per cell

---

## 8. Priority Implementation Slices

### Phase 1: Viewport Rebalancing (Slice 7A) — **HIGHEST PRIORITY**
**Focus:** Reduce overhead, expand waveform, remove zoom-out need
**Changes:**
- Compress scenario meta into 40px toolbar (redesign)
- Consolidate meta strips (legend + cursor + explainer) into single 30px row
- Make inspector drawer collapsible (hidden by default)
- Adjust waveform scroll `max-height` to 60%+ (not 75vh)
- Add new vh-aware zoom level for compact mode

**Effort:** Medium (mostly CSS + minor component refactoring)
**Impact:** Immediately solves "zoom-out problem"
**Risk:** Low (no semantic changes, pure layout)

### Phase 2: Scenario Toolbar Redesign (Slice 7B)
**Focus:** Make scenario controls real and discoverable
**Changes:**
- Create `ScenarioToolbar.tsx` component
- Replace scattered text links with icon buttons
- Add dropdown scenario selector
- Integrate into VerifySurface at top

**Effort:** Low (100-150 LOC component + CSS)
**Impact:** Page feels more intentional and professional
**Risk:** Low (isolated component, backward compatible)

### Phase 3: Section Hierarchy & Framing (Slice 7C)
**Focus:** Give major regions stronger visual presence
**Changes:**
- Add group headers to StimulusCanvas and WaveformViewer
- Redesign group header styling (stronger, more breathing room)
- Add background bands to major regions
- Consolidate meta strip into unified bar
- Redesign cursor readout as compact single-line widget

**Effort:** Medium (CSS + minor component updates)
**Impact:** Page reads as intentional, not ad-hoc
**Risk:** Low (visual only)

### Phase 4: Density Modes Refinement (Slice 7D)
**Focus:** Give users control over layout density
**Changes:**
- Add row-height picker (34/44/56px options)
- Add horizontal density picker (compressed/standard/spacious)
- Remember user preference in localStorage
- Test compact/standard/expanded modes

**Effort:** Low (state management + localStorage)
**Impact:** Users can optimize for their workflow
**Risk:** Low (non-destructive)

---

## 9. Single Highest-Leverage First Design-Fit Slice

### **Slice 7A: Viewport Rebalancing + Scenario Toolbar**

This is the critical first move because:

1. **Solves the zoom-out problem immediately** — waveform expands from 25-30% to 50%+
2. **Makes scenario control toolbar real** — weak text links → solid toolbar
3. **Consolidates overhead** — multiple meta strips → 1 unified bar
4. **Highest impact/effort ratio** — mostly CSS, no architectural changes
5. **Unblocks next slices** — once viewport is usable, texture and hierarchy work is easier

**Scope (Slice 7A only):**
- ✓ Compress scenario section to 40px toolbar
- ✓ Consolidate legend + cursor readout + meta into single 30px row
- ✓ Make inspector drawer collapsible (off by default)
- ✓ Adjust waveform `max-height` to 60%+
- ✗ (Defer) Scenario toolbar component refactor → Slice 7B
- ✗ (Defer) Group header redesign → Slice 7C

**Outcome:** Page is comfortable at normal zoom, waveform is prominent, overhead is visible but non-competing

---

## 10. Exact Files to Change First

### For Slice 7A (Viewport Rebalancing):

1. **`ide-root.css`** (lines ~19200–19270)
   - Reduce `.ide-verify-waveform-scroll` max-height constraint
   - Compress scenario meta strip sizing
   - Make inspector drawer collapsible/hidden by default
   - New consolidated meta bar styling
   - Tighter padding on metadata strips

2. **`VerifySurface.tsx`** (lines ~4000–4300)
   - Add `inspector drawer toggle` state (default closed)
   - Move legend + cursor readout + explainer into single horizontal meta bar component
   - Adjust layout render order (toolbar → stimulus → waveform → meta → details)
   - Conditional inspector drawer visibility

3. **`ide-root.css`** (new section ~line 19370)
   - `.ide-verify-scenario-toolbar` (new, 40px)
   - `.ide-verify-meta-bar-unified` (new, 30px, consolidates current scattered bars)
   - `.ide-verify-inspector-drawer--collapsed` (new, 32px, hidden by default)

### For Slice 7B (Scenario Toolbar, later):

4. **`ScenarioToolbar.tsx`** (new component)
   - Dropdown selector
   - New, Dup, Rename, Delete buttons
   - Integration with VerifySurface

5. **`VerifySurface.tsx`** (import + render)
   - Replace old scenario meta rendering with `<ScenarioToolbar />`

---

## Success Criteria (Slice 7A)

✓ Page is readable and usable at **normal zoom (100%)** without zoom-out
✓ Waveform occupies **≥50%** of viewport (up from 25-30%)
✓ Scenario toolbar is **solid, dark, 40px** and looks real
✓ Meta strips consolidated into **single unified bar**
✓ Inspector drawer **hidden by default**, expandable on demand
✓ **No regressions** in existing Verify behavior or test coverage
✓ Page **stops feeling cramped and minimal**, starts feeling intentional
✓ **No architectural changes** to surface semantics or data flow

---

## Appendix: Current CSS Constraint Summary

### Problematic Constraints (To Adjust)

```css
/* Current: Crushes waveform */
.ide-verify-waveform-scroll {
  max-height: min(75vh, 900px);  /* ← REDUCE to 60% */
  padding: 8px 10px 10px;         /* ← TIGHTEN to 6px */
  min-height: 480px;
}

.ide-verify-supporting-strip {
  max-height: min(44vh, 420px) !important;  /* ← REDUCE to 30% */
}

/* Meta bars take too much space */
.ide-verify-waveform-legend {
  padding: 8px;  /* Too generous */
}

.ide-verify-cursor-readout-table {
  /* No max-height: allows it to expand indefinitely */
}
```

### New Constraints (Proposed)

```css
.ide-verify-waveform-scroll {
  max-height: min(60vh, 800px);  /* ← Expanded */
  padding: 6px 8px 8px;          /* ← Tighter */
}

.ide-verify-meta-bar-unified {  /* NEW */
  height: 30px;                  /* Fixed */
  padding: 4px 8px;              /* Compact */
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--rb-border);
}

.ide-verify-inspector-drawer {
  max-height: 32px;              /* Collapsed */
  overflow: hidden;
  transition: max-height 0.2s ease;
}

.ide-verify-inspector-drawer.is-open {
  max-height: min(30vh, 350px);  /* Expanded */
}
```

---

## Conclusion

**The Verify page has a strong feature model but weak visual systems.**

Slice 7A (Viewport Rebalancing) fixes the spatial architecture, making the page feel intentional and professional instead of cramped and minimal.

Subsequent slices (7B–7D) layer in refined details and user control.

**Estimated impact:** From "requires zoom-out" → "comfortable at normal zoom, feels like a real tool"

