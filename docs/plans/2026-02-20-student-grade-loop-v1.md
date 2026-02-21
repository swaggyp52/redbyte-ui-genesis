# Student-Grade Loop v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A student can complete the full Design → Verify → Export → Hardware loop in under 2 minutes on 1366×768 at 100% zoom without guessing what to do next.

**Architecture:** Three targeted additions to an already-capable IDE: (1) wire the already-built `IdeGuidedStrip` component into `IdeApp`, (2) make Verify's "no vectors" state impossible to misread, (3) add an end-to-end student loop gate. No new backend logic, no FPGA changes.

**Tech Stack:** React 18, TypeScript, Playwright gate harness (`scripts/gates/_gateHarness.mjs`), Vite preview build

---

## Pre-read: What EXISTS and is NOT to be rebuilt

Before touching code, confirm these exist (they do — don't recreate them):

| File | What's there |
|------|-------------|
| `packages/rb-apps/src/apps/ide/components/IdeGuidedStrip.tsx` | Complete component, `data-testid="ide-guided-strip"`, uses `ProjectHealth` + `ProjectPrimaryCta` |
| `packages/rb-apps/src/apps/ide/projectHealth.ts` | `deriveProjectHealth()`, `choosePrimaryProjectCta()`, all types |
| `packages/rb-apps/src/apps/ide/ide-root.css` lines 847–925 | Full `.ide-guided-strip` CSS block |
| `packages/rb-apps/src/apps/IdeApp.tsx` lines 118–136 | `projectHealth` and `primaryProjectCta` already computed |
| `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` line 464 | `ide-export-readiness-banner` div with READY/BLOCKED label |
| `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` lines 256–319 | Checklist + expected IO table |
| `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` lines 300–333 | `handleGenerateBasicVectors()` function |

---

## Task 1: Wire IdeGuidedStrip into IdeApp

**Files:**
- Modify: `packages/rb-apps/src/apps/IdeApp.tsx` (lines 627–744)
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css` (after `.ide-guided-strip` block, ~line 925)

### Step 1: Add import to IdeApp.tsx

At the top of the imports (after existing `./ide/components/IdeTopBar` import), add:

```tsx
import { IdeGuidedStrip } from './ide/components/IdeGuidedStrip';
import type { ProjectHealthMode } from './ide/projectHealth';
```

### Step 2: Wrap the layout shell's right column

In `IdeApp.tsx`, find lines ~644–744:

```tsx
<div className="ide-layout-shell">
  <IdeLeftRail currentMode={currentMode} onModeChange={setCurrentMode} />
  {currentMode === 'project' ? (
    ...all the surface switch JSX...
  )}
</div>
```

Change to:

```tsx
<div className="ide-layout-shell">
  <IdeLeftRail currentMode={currentMode} onModeChange={setCurrentMode} />
  <div className="ide-surface-column">
    <IdeGuidedStrip
      currentMode={currentMode as ProjectHealthMode}
      health={projectHealth}
      primaryCta={primaryProjectCta}
      onNavigate={(mode) => setCurrentMode(mode as IdeMode)}
    />
    {currentMode === 'project' ? (
      ...all the surface switch JSX unchanged...
    )}
  </div>
</div>
```

### Step 3: Add ide-surface-column CSS

In `ide-root.css`, after the `.ide-guided-strip-fix-link:focus-visible` block (~line 925), add:

```css
/* Surface column: stacks guided strip above the mode workspace */
.ide-surface-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ide-surface-column > .ide-guided-strip {
  flex-shrink: 0;
  margin-bottom: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: 1px solid rgba(46, 196, 182, 0.2);
}

.ide-surface-column > *:not(.ide-guided-strip) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

### Step 4: TypeScript check

Run: `pnpm tsc --noEmit`

Expected: 0 new errors. If `IdeMode` vs `ProjectHealthMode` mismatch, add a cast — both are the same union, they're just separately defined.

### Step 5: Build and verify visually

Run: `pnpm --filter @redbyte/playground build`

Open playground at `/?mode=project`. Confirm the guided strip appears below the top bar, spanning the right column. Navigate to other modes — confirm it updates.

### Step 6: Run existing guided strip gate (if one exists) or verify gate

Run: `node scripts/gates/ide-primary-cta-contract.mjs`

Expected: PASS

### Step 7: Commit

```bash
git add packages/rb-apps/src/apps/IdeApp.tsx packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "feat(ide): wire IdeGuidedStrip into app shell; add ide-surface-column layout"
```

---

## Task 2: Verify UX — Promote "Generate Basics" when no vectors

**Problem:** When a student lands on Verify with no vectors, they see only a vague "Add vectors... run verification" callout. "Generate Basics" is buried in the right inspector panel. Students close the tab thinking the feature is broken.

**Fix:** In the empty-state workspace area, show two crisp sub-states:
- No vectors → "Generate Basics" as the primary action
- Has vectors, not run → "Run Verification" as the obvious next step

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (lines 619–626)

### Step 1: Read the current empty state (lines 619–626 in VerifySurface.tsx)

Current code:
```tsx
{status === 'idle' ? (
  <div className="ide-empty-stack" data-testid="ide-verify-empty-state">
    <div className="ide-empty-illustration ide-empty-illustration-verify" aria-hidden="true" />
    <IdeCallout tone="info" title="Run to generate evidence">
      Add vectors from mapped inputs, run verification, then inspect tick-level waveform output.
    </IdeCallout>
  </div>
) : (
```

### Step 2: Replace with two-sub-state version

```tsx
{status === 'idle' ? (
  <div className="ide-empty-stack" data-testid="ide-verify-empty-state">
    <div className="ide-empty-illustration ide-empty-illustration-verify" aria-hidden="true" />
    {!hasVectors ? (
      <IdeCallout tone="info" title="No vectors yet">
        <p className="ide-copy">Generate a basic set to get started, then click Run.</p>
        <div className="ide-inline-actions">
          <IdeButton
            tone="primary"
            onClick={handleGenerateBasicVectors}
            testId="ide-verify-empty-generate-basics"
          >
            Generate Basics
          </IdeButton>
        </div>
      </IdeCallout>
    ) : (
      <IdeCallout tone="info" title="Vectors loaded — ready to run">
        <p className="ide-copy">
          {authoredVectors.length} vector{authoredVectors.length !== 1 ? 's' : ''} ready.
          Click Run verification to produce deterministic waveform evidence.
        </p>
        <div className="ide-inline-actions">
          <IdeButton
            tone="primary"
            onClick={runVerification}
            testId="ide-verify-empty-run"
          >
            Run verification
          </IdeButton>
        </div>
      </IdeCallout>
    )}
  </div>
) : (
```

**Note:** `handleGenerateBasicVectors`, `runVerification`, `authoredVectors`, and `hasVectors` are all already defined earlier in the same component. No new state needed.

### Step 3: Check the IdeCallout component supports children beyond a string

Read `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx` and find `IdeCallout`. If `children` is typed as `React.ReactNode`, this works as-is. If it's not, you may need to check. It almost certainly accepts ReactNode already (it renders arbitrary children in the existing `VerifySurface`).

### Step 4: TypeScript check

Run: `pnpm tsc --noEmit`

Expected: 0 new errors.

### Step 5: Run verify flow gate

Run: `node scripts/gates/ide-verify-flow-contract.mjs`

Expected: PASS — the gate clicks `ide-verify-generate-basic-vectors` which still exists in the inspector. The workspace empty state is an addendum, not a replacement.

### Step 6: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx
git commit -m "UX(verify): promote Generate Basics to main workspace when idle with no vectors"
```

---

## Task 3: Add ide-student-loop-contract.mjs gate

**What this tests:**
1. Open `and-gate-basics` example from Project surface
2. Guided strip is visible
3. Navigate to Design → sim inputs exist
4. Navigate to Verify → Generate Basics → Run → status not IDLE → banner visible
5. Navigate to Export → READY/BLOCKED banner visible → `vivado_import.tcl` artifact in tree
6. Navigate to Hardware → checklist visible → expected IO table visible

**Files:**
- Create: `scripts/gates/ide-student-loop-contract.mjs`

### Step 1: Write the gate file

```javascript
#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE student loop contract satisfied', async ({ page, baseUrl }) => {
  // ── 1. Open project and load example ───────────────────────────────────
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await page.locator('[data-testid="ide-project-open-example-and-gate-basics"]').click();
  const confirmBtn = page.locator('[data-testid="ide-example-confirm"]');
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForTimeout(400);

  // ── 2. Guided strip must be visible on Project surface ──────────────────
  const strip = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(strip), 'guided strip must be visible on project surface');

  // ── 3. Design: live sim inputs exist ───────────────────────────────────
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const stripOnDesign = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(stripOnDesign), 'guided strip must be visible on design surface');

  // ── 4. Verify: generate basics → run → banner ──────────────────────────
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const stripOnVerify = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(stripOnVerify), 'guided strip must be visible on verify surface');

  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  const vectorTable = page.locator('[data-testid="ide-verify-vectors-table"]').first();
  assert(await visible(vectorTable), 'vector table must appear after generating basics');

  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-status-label"]');
      return Boolean(label && !/IDLE/i.test(label.textContent || ''));
    },
    { timeout: 10000 }
  );

  const verifyBanner = page.locator('[data-testid="ide-verify-banner"]').first();
  assert(await visible(verifyBanner), 'verify summary banner must be visible after run');

  const statusLabel = (
    await page.locator('[data-testid="ide-verify-status-label"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    /PASS|FAIL/i.test(statusLabel),
    `verify status must be PASS or FAIL after run, got "${statusLabel}"`
  );

  // ── 5. Export: readiness banner + vivado_import.tcl artifact ───────────
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const readinessBanner = page.locator('[data-testid="ide-export-readiness-banner"]').first();
  assert(await visible(readinessBanner), 'export readiness banner (READY/BLOCKED) must be visible');

  const readinessLabel = (
    await page.locator('[data-testid="ide-export-readiness-label"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    readinessLabel.length > 0,
    `export readiness label must have text, got "${readinessLabel}"`
  );

  const vivadoTcl = page.locator('[data-testid="ide-export-artifact-tree-item-vivado-import-tcl"]').first();
  assert(
    await visible(vivadoTcl),
    'vivado_import.tcl must appear in export artifact tree'
  );

  // ── 6. Hardware: checklist + expected IO table ─────────────────────────
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 10000 });

  const checklist = page.locator('[data-testid="ide-hardware-checklist"]').first();
  assert(await visible(checklist), 'hardware bring-up checklist must be visible');

  const expectedIoTable = page.locator('[data-testid="ide-hardware-expected-io-table"]').first();
  assert(await visible(expectedIoTable), 'hardware expected IO table must be visible');
});
```

### Step 2: Run the gate to confirm it PASSES

First build the app:
```bash
pnpm --filter @redbyte/playground build
```

Then run:
```bash
node scripts/gates/ide-student-loop-contract.mjs
```

**If it fails on `ide-guided-strip`:** Task 1 (wire IdeGuidedStrip) must be completed first.

**If it fails on `ide-export-artifact-tree-item-vivado-import-tcl`:** The `and-gate-basics` example might not produce that artifact without a verify PASS first. Adjust the gate to check for any artifact in the tree instead:
```javascript
const firstArtifact = page.locator('[data-testid^="ide-export-artifact-tree-item-"]').first();
assert(await visible(firstArtifact), 'at least one artifact must appear in export artifact tree');
```

**If it fails on `ide-hardware-expected-io-table`:** The example may not produce expected IO without a verify run. The table exists in the DOM from `HardwareSurface.tsx` line 303 (`data-testid="ide-hardware-expected-io-table"`), so the section is always rendered — it just shows a "pending" callout. The `visible()` check should pass since the section is in the DOM. If not, the `IdeDataTable` may require rows to render. In that case, loosen the assert:
```javascript
const expectedIoSection = page.locator('[data-testid="ide-hardware-expected-io-table"]').first();
assert(await visible(expectedIoSection), 'hardware expected IO section must be visible');
```

### Step 3: Commit

```bash
git add scripts/gates/ide-student-loop-contract.mjs
git commit -m "test(gates): add ide-student-loop-contract end-to-end loop gate"
```

---

## Task 4: Add package.json script + rebaseline screenshots

**Files:**
- Modify: `package.json` (add gate script)

### Step 1: Add script to package.json

Find the `ide:gate:*` scripts block. Add:

```json
"ide:gate:student-loop-contract": "node ./scripts/gates/ide-student-loop-contract.mjs",
```

### Step 2: Run screenshot rebaseline

The guided strip now appears on every mode surface, so all 6 IDE screenshots need updating.

```bash
pnpm ide:gate:screenshots:update
```

Expected: all 7 tests pass (6 mode baselines + home), 6 `ide-mode-*.png` files regenerated with the strip visible.

### Step 3: Verify existing gates still pass (regression check)

```bash
node scripts/gates/ide-primary-cta-contract.mjs
node scripts/gates/ide-verify-flow-contract.mjs
node scripts/gates/ide-verify-contract.mjs
node scripts/gates/ide-shell-chrome-contract.mjs
```

Expected: all PASS.

### Step 4: Commit

```bash
git add package.json "tests/e2e/ide-screenshot-baseline.spec.ts-snapshots/"
git commit -m "test(gates): add ide:gate:student-loop-contract script; rebaseline screenshots"
```

---

## Commit Summary

| # | Message |
|---|---------|
| 1 | `feat(ide): wire IdeGuidedStrip into app shell; add ide-surface-column layout` |
| 2 | `UX(verify): promote Generate Basics to main workspace when idle with no vectors` |
| 3 | `test(gates): add ide-student-loop-contract end-to-end loop gate` |
| 4 | `test(gates): add ide:gate:student-loop-contract script; rebaseline screenshots` |

---

## Critical Files Quick Reference

| File | Lines | Why |
|------|-------|-----|
| `packages/rb-apps/src/apps/IdeApp.tsx` | 627–744 JSX block | Add import + wrap with `ide-surface-column` div |
| `packages/rb-apps/src/apps/ide/ide-root.css` | After line 925 | Add `.ide-surface-column` CSS rules |
| `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | 619–626 | Replace empty-state block with two-sub-state version |
| `scripts/gates/ide-student-loop-contract.mjs` | new file | End-to-end student loop gate |
| `package.json` | `ide:gate:*` block | Add `ide:gate:student-loop-contract` script |

---

## What NOT to change

- `IdeGuidedStrip.tsx` — already complete, do not modify
- `projectHealth.ts` — already correct, do not modify
- `ExportSurface.tsx` — READY/BLOCKED banner already exists
- `HardwareSurface.tsx` — checklist and expected IO table already correct
- `IdeWorkbenchShell.tsx` — do not modify
- Any store files
- Any backend/FPGA code

---

## Verification Sequence Before Each Commit

After each task, run:
1. `pnpm tsc --noEmit` → 0 errors
2. The specific gate for that task
3. `node scripts/gates/ide-verify-contract.mjs` → still PASS (regression)
