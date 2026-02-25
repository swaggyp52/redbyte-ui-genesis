# PR14 — IDE Fit & Finish: Verify Narrative + Spacing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the top 15% of VerifySurface self-explanatory (one narrative, no duplicate CTAs), turn Mismatches into real content instead of a redirect, and recover canvas space via a global spacing pass.

**Architecture:** Three focused edits — (1) VerifySurface.tsx strip action consolidation: remove duplicate "Jump" button, move Deterministic + Capture Oracle inside the drawer; (2) Mismatches drawer tab: replace redirect text with a proper inline mismatch list; (3) ide-root.css spacing pass: trim 4–6 px from panel headers, inspector padding, and wfbar height. No new components. No modes. No new state.

**Tech Stack:** React + TypeScript, CSS custom properties (`--rb-*`, `--ide-*`), Vite monorepo (`pnpm build` + `pnpm test:audit` = gates).

---

## Codebase Facts (read before touching anything)

| Fact | Value |
|------|-------|
| Primary file | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` |
| CSS file | `packages/rb-apps/src/apps/ide/ide-root.css` |
| Build gate | `pnpm build` (exit 0) |
| Test gate | `pnpm test:audit` (15/15) |
| "Jump to failing node →" duplicated at | Strip ~line 1282–1290 AND fail card ~line 1305–1313 |
| Mismatches tab content at | ~lines 1680–1702 (a redirect paragraph, not real data) |
| Strip actions block at | ~lines 1214–1291 |
| Deterministic run button at | ~lines 1259–1269 |
| Capture Oracle button at | ~lines 1271–1280 |
| Details tab "Actions" section | ~lines 1718–1760 (signal snapshot + diff + hash) |
| panel-header min-height | `var(--ide-title-row-height)` (find exact value in CSS) |

---

## Task 1: Remove duplicate "Jump to failing node →" from strip

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~line 1282)

**Context:** The "Jump to failing node →" `<IdeButton tone="danger">` appears **twice** — once in the strip actions block and once in the fail summary card below. They have identical `onClick` handlers. The fail card version (testId `ide-verify-jump-to-failure-card`) is the canonical one because it lives inside the diagnosis lane. The strip version (testId `ide-verify-jump-to-failure`) is the duplicate to remove.

**Step 1: Locate and delete the strip duplicate**

Find this block (currently ~lines 1282–1290):
```tsx
{displayStatus === 'FAIL' && firstFailure && onFixPath && (
  <IdeButton
    tone="danger"
    onClick={() => { onFixPath(firstFailure); onGoToDesign?.(); }}
    testId="ide-verify-jump-to-failure"
  >
    Jump to failing node →
  </IdeButton>
)}
```

Delete the entire block (6 lines). The fail card version at `testId="ide-verify-jump-to-failure-card"` stays.

**Step 2: Verify**

After deletion, search the file for `ide-verify-jump-to-failure` — should find exactly **one** result (the card version). Zero results for `ide-verify-jump-to-failure"` (with closing quote — the strip version's testId).

---

## Task 2: Move Deterministic Run into drawer Details tab (keep Capture Oracle visible)

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`

**Context:** Correction B — "Capture observed outputs as expected" is an escape hatch that students need when stuck. It must stay always-visible in the strip. Only "Run Deterministic" (a power-user reproducibility tool) moves to the Details drawer. After this task the strip has: primary CTA + Re-run (secondary) + Clear + Capture Oracle.

**Step 1: Remove Deterministic Run from the strip**

Find this block (currently ~lines 1259–1270):
```tsx
{authoredVectors.length > 0 && onRunVerification && (
  <span title="Always simulates from the circuit, ignoring the interactive runtime trace. Use for reproducible results.">
    <IdeButton
      tone="ghost"
      onClick={runDeterministicVerification}
      disabled={runState === 'running'}
      testId="ide-verify-run-deterministic"
    >
      Run Deterministic
    </IdeButton>
  </span>
)}
```

Delete the entire block (9 lines).

**Step 2: Add Deterministic Run inside the Details drawer tab**

Locate the Details tab panel (~lines 1718–1773). It currently renders:
1. Signal snapshot table
2. Diff callout (on FAIL)
3. Hash block

Insert a new "Advanced Actions" section **at the top** of the details panel, before the signal snapshot `<section>`:

```tsx
{verifyTab === 'details' && (
  <>
    {/* Advanced run actions — moved here from strip */}
    <div className="ide-verify-details-actions" data-testid="ide-verify-details-actions">
      {authoredVectors.length > 0 && onRunVerification && (
        <IdeButton
          tone="secondary"
          onClick={runDeterministicVerification}
          disabled={runState === 'running'}
          testId="ide-verify-run-deterministic"
          title="Always simulates from the circuit, ignoring the interactive runtime trace. Use for reproducible results."
        >
          Run Deterministic
        </IdeButton>
      )}
    </div>
    {/* ... rest of existing details content unchanged ... */}
```

IMPORTANT: DO NOT delete the existing details tab content — only prepend the `ide-verify-details-actions` div. Capture Oracle (`ide-verify-set-oracle`) stays in the strip where it is.

**Step 3: Add CSS for ide-verify-details-actions**

In `ide-root.css`, find the `.ide-verify-hash-block` rule (~line 6870). Add BEFORE it:

```css
/* PR14: Details tab advanced actions row */
.ide-verify-details-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
```

---

## Task 3: Fix Mismatches tab — real inline list, not a redirect

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (~lines 1680–1702)

**Context:** The current Mismatches tab content is a redirect paragraph saying "mismatches shown in Truth Table above" with a Fix button. This is not a real mismatch inspector — it is a placeholder that adds no value over opening the truth table directly. Replace it with an inline list of all failing rows showing signal/tick/expected/actual.

**Step 1: Replace the mismatch redirect content**

Current content (~lines 1680–1702):
```tsx
{verifyTab === 'mismatches' && (
  <section className="ide-verify-mismatch-panel" data-testid="ide-verify-mismatch-table">
    {status === 'fail' ? (
      <div className="ide-verify-mismatch-redirect" ...>
        <p className="ide-copy">
          {failingRows.length} mismatch{failingRows.length !== 1 ? 'es' : ''} shown in the Truth Table panel above.
          Click any row to jump to that tick on the waveform.
        </p>
        {firstFailure && onFixPath && (
          <div className="ide-inline-actions">
            <IdeButton tone="secondary" onClick={() => onFixPath(firstFailure)} testId="ide-verify-mismatch-redirect-fix">
              Fix first failure in Design
            </IdeButton>
          </div>
        )}
      </div>
    ) : failingRows.length === 0 ? (
      <IdeCallout tone="success" title="No mismatches in current run">
        PASS evidence is ready for export.
      </IdeCallout>
    ) : null}
  </section>
)}
```

Replace with:
```tsx
{verifyTab === 'mismatches' && (
  <section className="ide-verify-mismatch-panel" data-testid="ide-verify-mismatch-table">
    {failingRows.length === 0 ? (
      <IdeCallout tone="success" title="No mismatches in current run">
        PASS evidence is ready for export.
      </IdeCallout>
    ) : (
      <table className="ide-verify-mismatch-list" data-testid="ide-verify-mismatch-list">
        <thead>
          <tr>
            <th>Tick</th>
            <th>Signal</th>
            <th>Expected</th>
            <th>Actual</th>
            {onFixPath && <th />}
          </tr>
        </thead>
        <tbody>
          {failingRows.map((row) => (
            <tr key={`${row.tick}-${row.signal}`} className="ide-verify-mismatch-row">
              <td className="ide-verify-mismatch-tick">
                <button
                  type="button"
                  className="ide-verify-mismatch-tick-btn"
                  onClick={() => setSelectedTick(row.tick)}
                >
                  t{row.tick}
                </button>
              </td>
              <td><code className="ide-verify-mismatch-signal">{row.signal}</code></td>
              <td><code className="ide-verify-mismatch-expected">{row.expected}</code></td>
              <td><code className="ide-verify-mismatch-actual ide-verify-mismatch-actual--fail">{row.actual}</code></td>
              {onFixPath && (
                <td>
                  <button
                    type="button"
                    className="ide-verify-mismatch-fix-btn"
                    onClick={() => { onFixPath({ signal: row.signal, tick: row.tick, expected: row.expected, actual: row.actual }); onGoToDesign?.(); }}
                    title={`Fix ${row.signal} in Design`}
                  >
                    Fix →
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>
)}
```

Note: `setSelectedTick` is already in scope (it's from `useState` in the component). `row` is typed as `RunRow` which has `{ signal, tick, expected, actual }`.

**Step 2: Add CSS for the mismatch list**

In `ide-root.css`, find the `.ide-verify-mismatch-redirect` rule block. After it, add:

```css
/* PR14: Mismatch list — real inline inspector */
.ide-verify-mismatch-list {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-family: var(--rb-font-mono);
}
.ide-verify-mismatch-list thead th {
  text-align: left;
  padding: 4px 8px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ide-text-soft);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  position: sticky;
  top: 0;
  background: rgba(8,16,28,0.95);
}
.ide-verify-mismatch-row {
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.ide-verify-mismatch-row:hover {
  background: rgba(255,255,255,0.03);
}
.ide-verify-mismatch-tick {
  width: 36px;
  text-align: center;
}
.ide-verify-mismatch-tick-btn {
  all: unset;
  cursor: pointer;
  color: var(--rb-accent);
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
}
.ide-verify-mismatch-tick-btn:hover {
  background: rgba(46,196,182,0.12);
}
.ide-verify-mismatch-list td {
  padding: 3px 8px;
  vertical-align: middle;
}
.ide-verify-mismatch-signal {
  color: var(--rb-text-2);
}
.ide-verify-mismatch-expected {
  color: var(--rb-text-2);
}
.ide-verify-mismatch-actual--fail {
  color: var(--rb-error, #ff6b6b);
  font-weight: 600;
}
.ide-verify-mismatch-fix-btn {
  all: unset;
  cursor: pointer;
  font-size: 9px;
  font-family: var(--rb-font-sans);
  color: var(--rb-error, #ff6b6b);
  border: 1px solid rgba(255,107,107,0.3);
  border-radius: 3px;
  padding: 1px 5px;
  transition: background 0.1s;
}
.ide-verify-mismatch-fix-btn:hover {
  background: rgba(255,107,107,0.1);
}
```

---

## Task 4: Global spacing pass — recover canvas vertical space

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Goal:** On a 1366×768 display, the waveform canvas should be visibly taller after this pass. Target: recover 20–28px of vertical space total across panel headers, inspector rows, wfbar height.

**Step 1: Tighten `.ide-panel-header` min-height**

Find `.ide-panel-header` (~line 866):
```css
.ide-panel-header {
  ...
  min-height: var(--ide-title-row-height);
}
```

Find where `--ide-title-row-height` is declared (likely in the `:root` block near the top of the file). Reduce its value by 6px:
- If currently `36px` → change to `30px`
- If currently `32px` → change to `26px`
- Whatever the current value is, subtract 6px

If `--ide-title-row-height` is used in more than 3 places in the CSS, instead of changing the variable, add an override directly on `.ide-panel-header`:
```css
.ide-panel-header {
  /* existing rules */
  min-height: 30px;   /* override: was var(--ide-title-row-height) */
}
```

**Step 2: Tighten `.ide-inspector-section` padding**

Find `.ide-inspector-section` (~line 3404):
```css
.ide-inspector-section {
  padding: var(--ide-card-pad);
  ...
}
```

Find where `--ide-card-pad` is declared. If it's `12px` → change to `8px`. If it's a multi-value shorthand like `12px 16px` → change to `8px 12px`.

If changing the variable affects too many other places, instead add a direct override:
```css
.ide-inspector-section {
  padding: 8px 12px;   /* override from var(--ide-card-pad) */
}
```

**Step 3: Tighten `.ide-verify-waveform-bar` min-height**

Find `.ide-verify-waveform-bar` (~line 6764):
```css
.ide-verify-waveform-bar {
  min-height: ...
  ...
}
```

If `min-height` is `34px` or higher, reduce to `30px`. This saves 4px from the control bar.

**Step 4: Tighten `.ide-verify-scope-header` padding**

Find `.ide-verify-scope-header` (~line 7350). It has padding. Reduce the top+bottom padding by 2px each. E.g., if `padding: 8px 12px` → `padding: 6px 12px`. If `padding: var(--ide-space-1)` → add `padding-top: 4px; padding-bottom: 4px;` override.

---

## Task 5: Add Vitest RTL test for FAIL state rendering

**Files:**
- Create: `packages/rb-apps/src/apps/ide/__tests__/verifySurface-fail-state.test.tsx`

**Context:** Correction A — the repo has a real `@testing-library/react` + Vitest setup (confirmed in `packages/rb-apps/src/__tests__/`). Add a DOM test that renders VerifySurface in FAIL state and asserts the FAIL card and mismatches table render. This is a regression guard — if the FAIL card disappears or the mismatch table regresses to a redirect, this test catches it.

**Step 1: Check how other component tests are set up**

Read any existing test file in `packages/rb-apps/src/__tests__/` that renders a React component (e.g., `error-boundary-gate.test.tsx`) to understand the import pattern and how props are mocked.

**Step 2: Create the test file**

`packages/rb-apps/src/apps/ide/__tests__/verifySurface-fail-state.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';
import type { VerifySurfaceProps } from '../surfaces/VerifySurface';

// Minimal props to get VerifySurface into FAIL state
function makeFailProps(): VerifySurfaceProps {
  const tick0: import('../surfaces/VerifySurface').VerifyFailureTarget = {
    signal: 'out_led',
    tick: 0,
    expected: '1',
    actual: '0',
  };
  return {
    // Required props — provide minimal working values
    inputSignals: [{ name: 'sw', label: 'sw', width: 1 }],
    outputSignals: [{ name: 'out_led', label: 'out_led', width: 1 }],
    vectors: [{ tick: 0, inputs: { sw: '1' }, expected: { out_led: '1' } }],
    lastRun: {
      status: 'fail' as const,
      runRows: [{ tick: 0, signal: 'out_led', expected: '1', actual: '0', status: 'fail' as const }],
      signalTimeline: [{ tick: 0, values: { sw: '1', out_led: '0' } }],
      reportHash: 'abc123',
      deterministicHash: 'def456',
      firstFailingTick: 0,
      schedule: 'combinational',
    },
    onRunVerification: vi.fn(),
    onFixPath: vi.fn(),
  } as unknown as VerifySurfaceProps;
}

describe('VerifySurface FAIL state', () => {
  it('renders the FAIL summary card', () => {
    render(<VerifySurface {...makeFailProps()} />);
    expect(screen.getByTestId('ide-verify-fail-card')).toBeDefined();
  });

  it('renders exactly one Jump to failing node button', () => {
    render(<VerifySurface {...makeFailProps()} />);
    // testId `ide-verify-jump-to-failure-card` is in the fail card (the only one)
    expect(screen.getByTestId('ide-verify-jump-to-failure-card')).toBeDefined();
    // The strip duplicate was removed in PR14 — it should NOT exist
    expect(screen.queryByTestId('ide-verify-jump-to-failure')).toBeNull();
  });
});
```

**IMPORTANT:** The exact prop shape of `VerifySurfaceProps` must match the actual interface in `VerifySurface.tsx`. Before writing the final file, read `VerifySurface.tsx` lines 56–140 to see what `VerifySurfaceProps` actually requires. Use `as unknown as VerifySurfaceProps` cast only if the minimal props don't satisfy all required fields, to avoid fighting TypeScript in a test file.

**Step 3: Run the test to verify it passes**

```
pnpm --filter @redbyte/rb-apps exec vitest run src/apps/ide/__tests__/verifySurface-fail-state.test.tsx
```

Expected: 2/2 passing.

If the test fails due to missing providers (Context, etc.) — check how `error-boundary-gate.test.tsx` wraps renders and apply the same pattern.

---

## Task 6: Build gate + commit

**Step 1: Run build**

```
pnpm build
```

Expected: exit 0, `✨ Unified Build Succeeded!`

If TS errors appear:
- "Property 'setSelectedTick' does not exist" → it does exist; check the lambda in Task 3 calls it correctly
- "Parameter 'row' implicitly has an 'any' type" → add `(row: RunRow)` type annotation if the map callback needs it (check what type `failingRows` items are — search for `RunRow` or `VerifyRow` in the file)

**Step 2: Run audit tests**

```
pnpm test:audit
```

Expected: 15/15 passed.

**Step 3: Verify intent with grep**

```
grep -n "ide-verify-jump-to-failure\"" packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx
```

Expected: ONE result only (the card version `ide-verify-jump-to-failure-card`, NOT the removed strip version).

```
grep -c "studentMode\|toggleStudentMode" packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx
```

Expected: 0 (confirming PR13 cleanup is intact).

**Step 4: Commit**

```bash
git add packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "$(cat <<'EOF'
feat(pr14): verify narrative + fit & finish

- remove duplicate "Jump to failing node" from strip (kept in fail card)
- move Deterministic Run + Capture Oracle into Details drawer tab
- replace mismatches redirect with real inline mismatch table (tick/signal/exp/act/fix)
- global spacing: panel-header, inspector-section, wfbar, scope-header trimmed ~6px each

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## What this plan deliberately skips

| Skipped | Why | When |
|---------|-----|------|
| Cross-surface "Next Action Strip" | New architectural component; bigger scope than polish | PR15 |
| Playwright e2e visual contracts | No Playwright setup found in repo; would need scaffolding | Separate PR |
| Strip action overflow menu (•••) | Current strip is clean enough after removing 2 actions | PR15 if still noisy |
| "Waveform Controls" tab in drawer | Wfbar already de-emphasized at 0.82 opacity; low priority | PR15 |

---

## Acceptance checks (verify manually after implementation)

1. **Top 15% of Verify (FAIL state):** Status strip → FAIL summary card → hint callout. Only ONE "Jump to failing node →" button visible (in the card, not the strip).
2. **Details tab:** Contains "Run Deterministic" + "Capture outputs" buttons at the top.
3. **Mismatches tab:** Shows a real table with every failing row (tick/signal/expected/actual). Clicking tick updates waveform to that tick. "Fix →" button navigates to design.
4. **Canvas height:** Open Verify on a 1366×768 window. The waveform SVG region should visibly extend further toward the bottom compared to pre-PR14.
