# PR13 — Verify Surface Hierarchy Refactor (No Modes) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all Student/Advanced mode logic from VerifySurface and achieve clarity through CSS hierarchy alone — one deterministic environment, all controls always present.

**Architecture:** Delete `studentMode` + `studentShowAllTruth` states, `toggleStudentMode`, `localStorage` usage, and every conditional JSX block that hides features. Restore full feature visibility. Apply CSS visual hierarchy instead: waveform dominant, secondary controls visually de-emphasized (opacity/weight), disclosure drawer polished.

**Tech Stack:** React + TypeScript, CSS custom properties (`--rb-*`, `--ide-*`), Vite monorepo (`pnpm build` = gate).

---

## Quick Reference

| File | Role |
|------|------|
| `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | Primary: remove all mode state + restore JSX |
| `packages/rb-apps/src/apps/ide/ide-root.css` | CSS hierarchy polish + remove student-mode rules |
| `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx` | Minor: `title` prop stays (it's useful), nothing to delete |

---

## Task 1: Remove mode state, localStorage, toggle function

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx:387-410`

**Step 1: Delete these 24 lines**

Lines 387–410 currently contain:
```tsx
const [studentShowAllTruth, setStudentShowAllTruth] = useState(false);
const [studentMode, setStudentMode] = useState(() =>
  typeof window !== 'undefined'
    ? window.localStorage.getItem('rb.ide.verify.studentMode') !== '0'
    : true
);

const toggleStudentMode = () => {
  setStudentMode((prev) => {
    const next = !prev;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rb.ide.verify.studentMode', next ? '1' : '0');
    }
    return next;
  });
};

// Collapse details and reset filters when entering student mode
useEffect(() => {
  if (studentMode) {
    setDrawerOpen(false);
    setStudentShowAllTruth(false);
  }
}, [studentMode]);
```

Delete all of it. Leave a blank line gap.

**Step 2: Verify the file still compiles mentally**

After deletion, `studentMode`, `studentShowAllTruth`, `toggleStudentMode` will be referenced in ~15 downstream spots and cause TS errors — that is expected. We will fix them in the next tasks.

**Step 3: Do NOT build yet** — more deletions coming.

---

## Task 2: Restore the Vectors inspector section

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~line 1007 after Task 1 offset)

**Step 1: Find and remove the `!studentMode` guard**

Current code (approx after offset):
```tsx
        </IdeInspectorSection>
        {!studentMode && (
          <IdeInspectorSection title="Vectors" accordionId="vectors">
            ...
          </IdeInspectorSection>
        )}
```

Change to:
```tsx
        </IdeInspectorSection>
        <IdeInspectorSection title="Vectors" accordionId="vectors">
          ...
        </IdeInspectorSection>
```

Remove the `{!studentMode && (` wrapper and the corresponding `)}`.

---

## Task 3: Restore secondary Run + Clear + Capture Oracle buttons

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~lines 1273–1310 after offset)

**Step 1: Remove the `(!studentMode || drawerOpen)` guard on the secondary Run button**

Current:
```tsx
{(!studentMode || drawerOpen) && (status === 'pass' || failingRows.length > 0) && (
  <IdeButton tone="secondary" onClick={runVerification} ...>Run</IdeButton>
)}
```
Change to:
```tsx
{(status === 'pass' || failingRows.length > 0) && (
  <IdeButton tone="secondary" onClick={runVerification} ...>Run</IdeButton>
)}
```

**Step 2: Remove the `(!studentMode || drawerOpen)` guard on Clear button**

Current:
```tsx
{(!studentMode || drawerOpen) && (
  <IdeButton tone="ghost" onClick={clearResults} testId="ide-verify-clear">Clear</IdeButton>
)}
```
Change to:
```tsx
<IdeButton tone="ghost" onClick={clearResults} testId="ide-verify-clear">Clear</IdeButton>
```

**Step 3: Remove the `!studentMode &&` guard on Capture Oracle button**

Current:
```tsx
{!studentMode && canSetOracle && (
  <span title="...">
    <IdeButton tone="ghost" onClick={handleSetOracleExpected} ...>Capture observed outputs as expected</IdeButton>
  </span>
)}
```
Change to:
```tsx
{canSetOracle && (
  <span title="...">
    <IdeButton tone="ghost" onClick={handleSetOracleExpected} ...>Capture observed outputs as expected</IdeButton>
  </span>
)}
```

---

## Task 4: Delete the mode toggle button

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~lines 1319–1327 after offset)

**Step 1: Delete the whole toggle button block**

Current:
```tsx
<IdeButton
  tone="ghost"
  onClick={toggleStudentMode}
  testId="ide-verify-mode-toggle"
  title={studentMode ? 'Switch to advanced view (shows vectors, oracle)' : 'Switch to student view (simplified)'}
>
  {studentMode ? 'Advanced' : 'Student'}
</IdeButton>
```

Delete entirely. Nothing replaces it.

---

## Task 5: Delete the student fail nav block

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~lines 1491–1499 after offset)

**Step 1: Delete the pinned student fail nav**

Current:
```tsx
{/* Mini fail navigator — pinned in student mode so Prev/Next are reachable without opening Details */}
{studentMode && displayStatus === 'FAIL' && failTicksSorted.length > 0 && (
  <div className="ide-verify-student-fail-nav" data-testid="ide-verify-student-fail-nav">
    <IdeButton tone="secondary" onClick={goToPrevFail} testId="ide-verify-student-fail-prev">‹ Prev</IdeButton>
    <span className="ide-verify-fail-nav-position ide-copy">
      fail {currentFailIndex >= 0 ? currentFailIndex + 1 : 1} / {failTicksSorted.length}
    </span>
    <IdeButton tone="secondary" onClick={goToNextFail} testId="ide-verify-student-fail-next">Next ›</IdeButton>
  </div>
)}
```

Delete entirely. The full fail nav already exists inside the waveform bar (which is always visible now).

---

## Task 6: Restore the waveform bar (always visible)

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~line 1500 after offset)

**Step 1: Remove the `(!studentMode || drawerOpen)` wrapper**

Current:
```tsx
{(!studentMode || drawerOpen) && (
  <div className="ide-verify-waveform-bar" data-testid="ide-verify-waveform-bar">
    {/* ... waveform bar content ... */}
  </div>
)}
```

Change to:
```tsx
<div className="ide-verify-waveform-bar" data-testid="ide-verify-waveform-bar">
  {/* ... waveform bar content ... */}
</div>
```

Remove the outer `{(!studentMode || drawerOpen) && (` and matching `)}`.

---

## Task 7: Restore truth table (always visible, remove student truth controls)

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~lines 1649–1672 after offset)

**Step 1: Remove the outer `(!studentMode || drawerOpen)` wrapper**

**Step 2: Remove the student truth controls block entirely**

Current:
```tsx
{(!studentMode || drawerOpen) && (
  <>
    {studentMode && !studentShowAllTruth && firstFailure != null && (
      <div className="ide-verify-student-truth-controls" ...>
        <span className="ide-copy">Showing tick {firstFailure.tick}</span>
        <IdeButton tone="ghost" onClick={() => setStudentShowAllTruth(true)} ...>
          Show all vectors
        </IdeButton>
      </div>
    )}
    <TruthTablePane
      mode={truthTableMode}
      rows={
        studentMode && !studentShowAllTruth && firstFailure != null
          ? truthRows.filter((r) => r.tick === firstFailure.tick)
          : truthRows
      }
      selectedTick={selectedTick}
      onSelectTick={setSelectedTick}
      onModeChange={setTruthTableMode}
      onFixPath={onFixPath ? (row) => onFixPath(...) : undefined}
    />
  </>
)}
```

Replace with:
```tsx
<TruthTablePane
  mode={truthTableMode}
  rows={truthRows}
  selectedTick={selectedTick}
  onSelectTick={setSelectedTick}
  onModeChange={setTruthTableMode}
  onFixPath={onFixPath ? (row) => onFixPath(row.signal, row.tick) : undefined}
/>
```

Note: preserve the exact `onFixPath` lambda shape from your existing code — just ensure `studentMode` filtering is gone.

---

## Task 8: Fix drawer toggle — always show tabs

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~lines 1685–1710 after offset)

**Step 1: Remove the studentMode ternary in drawer tabs area**

Current:
```tsx
{!studentMode && !drawerOpen && firstFailure && (
  <span className="ide-verify-drawer-hint">...</span>
)}
<span className="ide-verify-drawer-tabs">
  {studentMode ? (
    <span className="ide-verify-drawer-details-label">
      {drawerOpen ? 'Hide details' : 'Details'}
    </span>
  ) : (
    (['mismatches', 'vectors', 'details'] as const).map((tab) => (
      <span key={tab} className={`ide-verify-drawer-tab ${verifyTab === tab ? 'is-active' : ''}`}
        onClick={(event) => { event.stopPropagation(); setVerifyTab(tab); setDrawerOpen(true); }}>
        {tab === 'mismatches' ? 'Mismatches' : tab === 'vectors' ? 'Vectors' : 'Details'}
      </span>
    ))
  )}
</span>
```

Change to (remove `!studentMode &&` from hint, collapse ternary to always show tabs):
```tsx
{!drawerOpen && firstFailure && (
  <span className="ide-verify-drawer-hint">...</span>
)}
<span className="ide-verify-drawer-tabs">
  {(['mismatches', 'vectors', 'details'] as const).map((tab) => (
    <span key={tab} className={`ide-verify-drawer-tab ${verifyTab === tab ? 'is-active' : ''}`}
      onClick={(event) => { event.stopPropagation(); setVerifyTab(tab); setDrawerOpen(true); }}>
      {tab === 'mismatches' ? 'Mismatches' : tab === 'vectors' ? 'Vectors' : 'Details'}
    </span>
  ))}
</span>
```

---

## Task 9: Build gate — verify zero TypeScript errors

**Step 1: Run**

```
pnpm build
```

Expected: exit 0, ✨ Unified Build Succeeded!

If TS errors appear, they will be unused variable errors for `studentMode`, `studentShowAllTruth`, `toggleStudentMode`, `setStudentShowAllTruth`. Fix by confirming all references were deleted in Tasks 1–8.

**Step 2: Check for any remaining `studentMode` references**

```
grep -n "studentMode\|studentShowAllTruth\|toggleStudentMode" packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx
```

Expected: no output. If any remain, delete them.

**Step 3: Commit if clean**

```bash
git add packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx
git commit -m "refactor(verify): remove studentMode — one deterministic environment, no feature gating"
```

---

## Task 10: CSS hierarchy — waveform dominance + secondary controls quieter

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Goal:** Waveform = strongest contrast container. Secondary controls (zoom, density, scrubber, truth table header, small labels) visually de-emphasized but present.

**Step 1: Add waveform dominance rules**

Find `.ide-verify-oscilloscope-stage` (currently ~line 7033). Strengthen it:
```css
.ide-verify-oscilloscope-stage {
  /* existing rules... */
  background: rgba(8, 16, 30, 0.92);          /* slightly deeper than current */
  border-right: 1px solid rgba(24,44,72,0.7);  /* sharper separator */
}
```

**Step 2: De-emphasize secondary controls**

Add after the existing waveform bar rules:
```css
/* PR13: Secondary controls — visually quieter, all features present */
.ide-verify-wfbar-center,
.ide-verify-wfbar-right {
  opacity: 0.82;
  transition: opacity 0.15s;
}
.ide-verify-wfbar-center:hover,
.ide-verify-wfbar-right:hover {
  opacity: 1;
}

/* Truth table header — quieter weight, not competing with waveform */
.ide-truth-table-header {
  opacity: 0.88;
}

/* Strip secondary actions — de-emphasized */
.ide-verify-strip-actions .ide-button-ghost,
.ide-verify-strip-actions .ide-button-secondary {
  opacity: 0.8;
  font-size: 11px;
  transition: opacity 0.15s;
}
.ide-verify-strip-actions .ide-button-ghost:hover,
.ide-verify-strip-actions .ide-button-secondary:hover {
  opacity: 1;
}
```

**Step 3: Verify no teal on secondary controls (only on primary + active states)**

Confirm `.ide-button-ghost:hover` rule (added in Phase E) shows `color: var(--rb-accent)` ONLY on hover — not as default. This is already correct from Phase E. No change needed.

---

## Task 11: CSS hierarchy — Details disclosure polish

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Goal:** Drawer toggle = full-width, divider above, chevron, smooth 140ms animation.

**Step 1: Upgrade the drawer supporting strip animation**

Find `.ide-verify-supporting-strip` (~line 7400) and `.ide-verify-supporting-strip.is-open`:

```css
.ide-verify-supporting-strip {
  /* existing rules */
  transition: max-height 0.14s ease;  /* was 0.18s — tighten to feel snappier */
}
```

**Step 2: Polish drawer toggle — full width + top divider**

Find `.ide-verify-drawer-toggle` (~line 7413). Add/update:
```css
.ide-verify-drawer-toggle {
  /* existing rules */
  border-top: 1px solid rgba(255,255,255,0.06);   /* hairline separator above */
  width: 100%;
  justify-content: space-between;
}
```

**Step 3: Add a label hint on the drawer toggle for discoverability**

No JSX changes needed. The drawer toggle already shows tabs ("Mismatches / Vectors / Details") and the chevron. The separator above (Step 2) is the visual anchor. No "count" label needed if tabs are visible.

---

## Task 12: CSS — PASS state polish

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Goal:** PASS state = calm, complete, guidance toward next action. Remove red-tinted structures entirely.

**Step 1: Find `.ide-verify-pass-hero` (~line 6871) and strengthen it**

```css
.ide-verify-pass-hero {
  /* existing rules — keep gradient green bg, teal border */
}

/* PR13: PASS hero — calm next-step guidance */
.ide-verify-pass-hero-title {
  font-size: 16px;  /* was 15px — bump slightly */
  font-weight: 600;
}
.ide-verify-pass-hero-actions {
  margin-top: 12px;
}
```

**Step 2: Confirm no red elements render in PASS state**

PASS state renders `.ide-verify-pass-hero`. The FAIL summary card only renders on FAIL. The status strip shows pass count (teal). The truth table stays visible showing pass rows. This is already correct — no structural changes needed.

---

## Task 13: CSS — Remove student-mode CSS rules

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Step 1: Delete these rule blocks** (currently ~lines 6670–6716):

```css
/* Mode toggle — subtle preference indicator, not a decision gate */
[data-testid="ide-verify-mode-toggle"] { ... }
[data-testid="ide-verify-mode-toggle"]:hover { ... }

/* ── PR12: Student mode pinned fail navigator ── */
.ide-verify-student-fail-nav { ... }
.ide-verify-student-fail-nav .ide-verify-fail-nav-position { ... }

/* PR12: Student mode truth table "show all" controls row */
.ide-verify-student-truth-controls { ... }

/* PR12: Student mode drawer "Details" / "Hide details" label */
.ide-verify-drawer-details-label { ... }
```

Delete all 7 blocks.

---

## Task 14: Final build + test gate

**Step 1: Run build**

```
pnpm build
```

Expected: exit 0.

**Step 2: Run audit tests**

```
pnpm test:audit
```

Expected: 15/15 passed.

**Step 3: Confirm no studentMode in any IDE source file**

```
grep -rn "studentMode\|toggleStudentMode\|studentShowAllTruth\|rb.ide.verify.studentMode" packages/rb-apps/src/apps/ide/
```

Expected: no output.

**Step 4: Commit**

```bash
git add packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "feat(pr13): verify hierarchy refactor — kill modes, hierarchy through CSS only"
```

---

## Summary of Changes

| Deleted | Restored to Always-Visible |
|---------|---------------------------|
| `studentMode` state + localStorage | Secondary Run button |
| `studentShowAllTruth` state | Clear button |
| `toggleStudentMode` fn | Capture Oracle button |
| `useEffect` mode cascade | Vectors inspector section |
| Mode toggle button | Waveform bar |
| Student fail nav block | Full truth table rows |
| Student truth controls block | Drawer tabs (all 3 always) |
| Student CSS rules (7 blocks) | Drawer hint |

**CSS net result:** Quieter secondary controls (opacity), dominant waveform container, polished drawer disclosure (140ms, hairline divider, full-width), PASS state calm + next-action focused.
