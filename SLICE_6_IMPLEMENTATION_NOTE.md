# Slice 6: Assertion Overlay / Output Lanes Redesign

Implementation note for assertion-first visual layer on the timing model.

---

## 1. What Parts of Assertion Authoring/Checking Are Still Disconnected

**Current disconnects:**

- **AssertionMode toggle (line 711, VerifySurface.tsx)** controls visibility of mismatch panels, but has no visual connection to the waveform timeline
- **Output lanes in scenario table** (lines 1388–1518, VerifySurface.tsx) ARE editable (`vector.expected[fieldId]`), but they live in an isolated form UI, not in the canvas/waveform world
- **Mismatches are a separate drawer panel** (VerifyVectorListPanel + VerifyFailureExplanationPanel) — they show failures at specific ticks, but the user must mentally map tick numbers back to the waveform
- **WaveformViewer (lines 161–201+)** only renders observed traces (from `inputsAtTick` + `report.rows.actual`), never expected values
- **StimulusCanvas (Slice 5)** handles input authoring with full click-to-edit, but output/assertion editing is still form-based
- **Visual grouping confusion**: stimulus is "Inputs" group, observed is "Outputs" group, but "Assertions" aren't grouped at all — they're a modal state

**Result:** A student edits expected outputs in one place (scenario table), sees stimulus and observation in another (waveform), and failure details in a third (three-panel drawer). No unified mental model.

---

## 2. What Current Expected-Output / Mismatch UI Should Be Preserved

**Must keep:**

- `VerifyFailureExplanationPanel.tsx` — detailed failure breakdowns with "Likely reason" and "Next step" guidance
- `VerifyVectorListPanel.tsx` — mismatch list with arrow/j/k keyboard navigation
- Three-panel layout (list, explanation, details) — click mismatch → shows breakdown
- Failure classification logic (`verify-failure-classifier.ts`) — reason codes and heuristics
- Input snapshot at tick (lines 205–225, VerifyFailureExplanationPanel.tsx)
- Peer mismatch navigation (lines 227–243)
- Assertion-aware language ("asserted" vs "Observed", line 79/86)
- Drawer tab structure (`'mismatches' | 'vectors' | 'truth' | 'kmap' | 'details'`)
- Auto-open-on-fail behavior (lines 1361–1362)
- Mismatch count badge (line 75, VerifyVectorListPanel.tsx)

**Why preserve:** These are the *diagnostic* layer. Slice 6 is *authoring* layer. Keep diagnostics untouched.

---

## 3. Proposed Assertion-Overlay Model

**Core idea:**

Assertions are a **second read-only overlay row** that sits **below each output signal** in the waveform.

**Visual structure (post-Slice 6):**

```
┌─ Stimulus (Inputs group) ────────────────────────────┐
│  a         [0][1][0][1]...                           │
│  b         [1][1][0][0]...                           │
└──────────────────────────────────────────────────────┘
┌─ Observed (Outputs group) ──────────────────────────┐
│  x'        [0][1][0][X]...    (actual from circuit)  │
│  x!        [1][1][0][0]...    (expected from vector) │
│  y'        [1][1][1][1]...                           │
│  y!        [1][1][1][1]...                           │
└──────────────────────────────────────────────────────┘
```

- `x'` = observed (current)
- `x!` = asserted/expected (new assertion lane)
- When `x'` ≠ `x!`, the cell is highlighted failing
- When `x'` = `x!`, the cell is highlighted passing
- When no assertion exists (empty expected), cell is neutral/disabled
- When assertionMode OFF, assertion lanes are hidden/collapsed

**Read-only by design in v1:**

Assertion editing deferred to v2. Slice 6 focuses on *visibility* and *visual relationship*.

---

## 4. Proposed Interaction Model for Editable Assertion/Output Lanes

**Phase 1 (Slice 6) — Read-Only Assertions:**

1. Click mismatch in VerifyVectorListPanel → highlights corresponding tick + signal in waveform
2. That highlight extends to BOTH observed (`x'`) AND assertion (`x!`) lanes
3. Failure detail panel shows expected vs actual with colored badges
4. Keyboard nav (↑↓/jk) in mismatch list jumps between failures; waveform auto-scrolls to keep selected tick visible

**Phase 2+ (future slices) — Editable Assertions:**

- Click assertion lane cell (`x!`) to toggle 0↔1 (if assertionMode ON)
- Edits flow back through `onVectorsChange` callback (like StimulusCanvas)
- Real-time revalidation: waveform cells re-color immediately
- "Assume actual" quick-fix button (current line 1416, VerifySurface.tsx) extends to assertion lanes

---

## 5. Minimal Data/Contract Changes Required

**No runtime schema changes needed.** Existing types already support this:

- `TestVector` (rb-utils, line 218): already has `expected: Record<string, boolean | number>`
- `VerifyAuthorVector` (ScenarioBuilderPanel.tsx, line 12): already has `expected: Record<string, 0 | 1>`
- `VerifyReportVector` (verifyReport.ts, line 13): already has `expected: Record<string, 0 | 1>`
- `VerifyWaveSample` (verifyReport.ts, line 94): already carries `mismatches[]` with `expected` field

**New data flows:**

- WaveformViewer: add optional `expectedAtTick: Record<number, Record<string, 0 | 1>>` to render assertion lanes
- WaveformViewer: add optional `assertionsBySignal: Map<string, 0 | 1 | null>` for mismatch highlighting
- No API changes; no scenario schema changes

**New component props:**

- `AssertionCanvas` (new): mirrors StimulusCanvas interface, but read-only in v1, controlled by `onVectorsChange` callback

---

## 6. Files to Change

1. **`src/apps/ide/components/StimulusCanvas.tsx`**
   - (no changes in Slice 6; lay groundwork for future AssertionCanvas peer)

2. **`src/apps/ide/components/AssertionCanvas.tsx`** ← **NEW**
   - Parallel to StimulusCanvas: tick columns × signal rows for *output* signals
   - Layout: same LABEL_W=140, TICK_W=48, ROW_H=34
   - Render logic: show expected value from scenario; highlight match/fail/undefined
   - Interaction: read-only click states (v1); prepare for 0↔1 toggle (v2)
   - CSS: `.ide-assertion-*` helpers
   - Props: `outputFields`, `assertedVectors`, `selectedTick`, `selectedSignal`, `mismatches`, `onVectorChange?`, `readOnly=true`

3. **`src/apps/ide/surfaces/VerifySurface.tsx`**
   - (lines ~900–950) Integrate AssertionCanvas below WaveformViewer (or as overlay)
   - (lines ~1400+) Pass `assertedVectors` and `mismatches` data to AssertionCanvas
   - (lines ~1100) Wire up mismatch selection to highlight both stimulus + assertion lanes
   - No new state logic; reuse `authoredVectors` and `selectedFailure`

4. **`src/apps/ide/surfaces/ScenarioBuilderPanel.tsx`**
   - (no changes in Slice 6; canvas is integrated in VerifySurface, not ScenarioBuilderPanel)
   - Fallback manual entry form stays intact

5. **`src/apps/ide/ide-root.css`**
   - Add `.ide-assertion-*` CSS classes (similar to `.ide-stimulus-*`)
   - Grid layout, cell styling, mismatch highlight colors
   - Responsive font/sizing for compact timeline

---

## 7. Behavior That Must Remain Identical

✓ **Runtime scenario authority:** `vector.expected` is immutable until user confirms an edit (Slice 7+)
✓ **Export provenance:** assertionMode toggle does NOT affect export or testbench generation
✓ **AssertionMode toggle:** still shows/hides mismatch panels, still gates grading language
✓ **Mismatch detection:** `expected !== actual` logic unchanged
✓ **Three-panel drawer:** navigation, keyboard shortcuts, peer selection all work identically
✓ **Fallback manual entry:** ScenarioBuilderPanel form still available for manual vector entry
✓ **Stimulus canvas:** Slice 5 behavior (input editing, row height, tick columns) untouched
✓ **Waveform trace rendering:** observed values still rendered with same signal grouping
✓ **Test execution authority:** Verify run STILL uses `scenario.vectors` as the source of truth

---

## 8. Tests to Add/Update

**Unit tests (vitest):**

- `AssertionCanvas.test.tsx` — layout, cell rendering, mismatch highlighting
- Verify expected values from scenario are rendered correctly
- Verify mismatch highlighting matches failure list
- Verify click handlers propagate selection to parent
- Keyboard navigation on assertion lanes (prepare for v2 editing)

**Integration tests (VerifySurface context):**

- Mismatch selection highlights both stimulus + assertion lanes
- Scroll sync: selecting far-right mismatch auto-scrolls waveform to tick
- assertionMode OFF: assertion lanes are hidden
- assertionMode ON: assertion lanes visible, mismatch colors applied
- Three-panel drawer is NOT affected by assertion canvas changes

**E2E tests (Playwright):**

- Half-adder example: run verify, inspect assertion lane for one output
- Full-adder example: scroll through mismatches, verify assertion lanes track selection
- Toggle assertionMode: assertion lanes appear/disappear

---

## Implementation Strategy

**Slice 6 scope (read-only assertions):**

1. Create `AssertionCanvas.tsx` (100–150 lines): grid + cell rendering
2. Integrate into VerifySurface waveform area (5–10 LOC)
3. Add CSS (30–50 lines)
4. Add tests (80–120 lines)
5. Wire mismatch selection to highlight both canvases
6. Verify no regressions in existing three-panel drawer

**Do NOT do in Slice 6:**

- ❌ Editable assertion cells (save for Slice 7)
- ❌ New mismatch detection logic (use existing)
- ❌ Changes to runtime vector execution (already correct)
- ❌ Export/Vivado integration (still uses scenario.vectors)

---

## Success Criteria (Slice 6)

✓ Assertions visually grouped below outputs in waveform
✓ Mismatch selection highlights matching cells in both canvases
✓ Expected values from scenario are rendered correctly
✓ Pass/fail/undefined states are visually distinct
✓ Keyboard nav in mismatch list works; waveform auto-scrolls
✓ No regression in three-panel drawer or export flow
✓ Tests pass; 660+ suite passing maintained
✓ Gate tests pass (console budget, lab starter load)

---

## Notes

- **Co-location principle:** AssertionCanvas is NOT in a separate file from waveform (like WaveformViewer); they render together in VerifySurface layout.
- **Immutability:** AssertionCanvas ops are read-only; all mutations go through callbacks, preserving VerifyAuthorVector contract.
- **Signal grouping:** assertion lanes follow the same Inputs/Outputs/Internal grouping logic as waveform.
- **Color scheme:** suggest reusing existing pass/fail colors (green/red) + neutral/disabled (gray) for undefined assertions.
- **Future:** Slice 7 upgrades read-only to editable; Slice 8+ might unify assertion + stimulus into one grid model.

