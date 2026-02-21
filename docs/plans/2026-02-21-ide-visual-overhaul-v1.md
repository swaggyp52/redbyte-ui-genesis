# IDE Visual Overhaul v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make RedByte IDE usable at 100% browser zoom with no horizontal overflow, no cropping, coherent spacing, and elevation expressed through luminance contrast rather than stacked borders and box-shadows.

**Architecture:** Six surgical CSS + minimal TSX commits. Order is dependency-driven: reclaim viewport first, then flatten nesting, then trim chrome overhead, then unify buttons, then lock in responsive density, then gate + rebaseline. No new components. No new features. No backend changes.

**Tech Stack:** CSS custom properties (var), React 18, TypeScript, Playwright gate harness

**Key context before touching anything:**
- Primary CSS file: `packages/rb-apps/src/apps/ide/ide-root.css`
- Component primitives: `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx`
- Workbench shell: `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx`
- Surface layout wrapper: `packages/rb-apps/src/apps/ide/components/IdeSurfaceLayout.tsx`
- Screenshot baselines: `tests/e2e/ide-screenshot-baseline.spec.ts-snapshots/`

**Design principles (enforce throughout):**
1. Elevation = luminance. Dock is slightly lighter than canvas bg. Panel is slightly lighter than dock. No borders needed to establish hierarchy in the workbench area.
2. Borders = semantic structure. One border for: panel outer edge, table cell separators, status bar, top-bar bottom edge. Not for nested regions within a panel.
3. Workspace is king. Chrome (topbar + rail + guided-strip + console) must not exceed 130px of vertical overhead at any time.
4. Mono is scoped. `var(--rb-font-mono)` for machine facts only: hashes, pins, ticks, signal names, filenames, HDL snippets. Never for UI labels or buttons.

---

## Pre-read: Confirmed facts (verified before writing — do not re-verify)

| Fact | Value |
|------|-------|
| Shell padding currently | `padding: var(--ide-space-1) var(--ide-gutter)` = **8px top/bottom, 12px left/right** |
| Workspace padding currently | `padding: 0 var(--ide-space-1)` = **0 top/bottom, 8px left/right** |
| Console grid-template bug | `minmax(var(--ide-workbench-console-height), var(--ide-console-collapsed-h))` — **args ARE SWAPPED** (min 64 > max 40 = always 40px) |
| Breakpoint direction bug | `@media (max-width: 1120px)` INCREASES shell padding 8px→16px |
| Box-soup depth | `.ide-workbench-dock` (border+shadow) → `.ide-panel` (border+shadow) → `.ide-inspector-section` (border) = 3 nested borders |
| Panel-actions overhead | Always renders 32px min-height + 12px margin-bottom + 8px padding-bottom + 1px border = **53px even when empty** |
| JetBrains Mono anomaly | Used ONLY at `ide-root.css:237` for `.ide-project-subline`. Should be `var(--rb-font-mono)` |
| Mode label exception | `.ide-mode-label { font-size: 8px }` — below minimum token (12px) |
| Button size fragmentation | 3 different font-sizes: 10px (topbar), 11px (default), 10px (canvas controls) |
| Right dock min causes overflow | `RIGHT_WIDTH_RANGE.min = 280px` means right dock can never be narrower than 280px |

---

## Task 1: Reclaim the viewport (shell padding + console grid bug + breakpoint direction)

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css` (lines 394–405, 429–435, 3032–3054)

### Step 1: Fix workbench shell — remove padding, fix console grid minmax swap

Find `.ide-workbench-shell` starting at line 394. Replace the entire rule:

```css
/* BEFORE (lines 394–405) */
.ide-workbench-shell {
  --ide-workbench-left-width: var(--ide-dock-l-w);
  --ide-workbench-right-width: var(--ide-dock-r-w);
  --ide-workbench-console-height: var(--ide-console-default-h);
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 6px minmax(var(--ide-workbench-console-height), var(--ide-console-collapsed-h));
  gap: var(--ide-space-1);
  min-height: 0;
  height: 100%;
  padding: var(--ide-space-1) var(--ide-gutter);
}
```

Replace with:

```css
/* AFTER */
.ide-workbench-shell {
  --ide-workbench-left-width: var(--ide-dock-l-w);
  --ide-workbench-right-width: var(--ide-dock-r-w);
  --ide-workbench-console-height: var(--ide-console-default-h);
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 6px minmax(var(--ide-console-collapsed-h), var(--ide-workbench-console-height));
  gap: 0;
  min-height: 0;
  height: 100%;
  padding: 0;
}
```

**Why:** `minmax(consoleHeight, collapsedH)` has min 64 > max 40 — CSS spec says use max, so console is always locked at 40px regardless of state. Swapping to `minmax(collapsedH, consoleHeight)` fixes it. Removing padding reclaims 40px of vertical space + 24px of horizontal space.

### Step 2: Remove workspace horizontal padding

Find `.ide-workbench-workspace` at line 429. Change:

```css
/* BEFORE */
.ide-workbench-workspace {
  min-height: 0;
  overflow: hidden;
  padding: 0 var(--ide-space-1);
  display: flex;
  flex-direction: column;
}
```

To:

```css
/* AFTER */
.ide-workbench-workspace {
  min-height: 0;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}
```

### Step 3: Fix the responsive breakpoint — stop increasing padding at 1120px

Find `@media (max-width: 1120px)` at line 3032. Within that block, find:

```css
.ide-workbench-shell {
  --ide-workbench-left-width: 232px;
  --ide-workbench-right-width: 312px;
  padding: var(--ide-space-3);
}
```

Replace with:

```css
.ide-workbench-shell {
  --ide-workbench-left-width: 200px;
  --ide-workbench-right-width: 260px;
}
```

Remove the `padding: var(--ide-space-3)` line entirely. This was increasing padding at narrow widths — wrong direction.

Also remove the workspace padding override in that same breakpoint block:

```css
/* REMOVE this line from the 1120px block: */
.ide-workbench-workspace {
  padding: 0 var(--ide-space-2);
}
```

### Step 4: TypeScript check

Run: `pnpm tsc --noEmit`
Expected: 0 errors (no TS changes in this task).

### Step 5: Build + smoke test visually

Run: `pnpm --filter @redbyte/playground build`

Open `/?mode=design`. Confirm:
- Workbench fills its container edge-to-edge
- Console is visible and can collapse/expand (was broken by grid bug)
- No horizontal scrollbar on the layout-shell

### Step 6: Run existing shell chrome gate

Run: `node scripts/gates/ide-shell-chrome-contract.mjs`
Expected: PASS (rail width unchanged)

### Step 7: Commit

```bash
git add packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "fix(ide): reclaim workbench viewport — zero shell/workspace padding, fix console grid minmax swap, stop breakpoint padding increase"
```

---

## Task 2: Flatten elevation hierarchy (kill box soup + fix dock overflow)

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css` (lines 419–427, 697–711, 743–753)
- Modify: `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx` (IdePanel component, ~lines 56–77)

**Goal:** Dock → Panel → Section should form a luminance-based hierarchy, not a border-soup hierarchy. Removing borders from the dock and removing box-shadows from all panels reduces visual noise without losing hierarchy. Fix dock overflow:hidden so child panels control their own scroll, not the dock.

### Step 1: Remove dock border + shadow; fix overflow

Find `.ide-workbench-dock` at line 419. Replace:

```css
/* BEFORE */
.ide-workbench-dock {
  min-height: 0;
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--ide-border) 84%, #6ba8dc 16%);
  border-radius: var(--ide-radius-s);
  background: linear-gradient(180deg, rgba(15, 25, 36, 0.9), rgba(11, 20, 30, 0.92));
  box-shadow: var(--rb-shadow-1);
  padding: var(--ide-card-pad);
}
```

With:

```css
/* AFTER */
.ide-workbench-dock {
  min-height: 0;
  overflow: hidden;
  background: rgba(12, 20, 30, 0.95);
  padding: var(--ide-card-pad);
}
```

**Why:** `overflow: auto` on the dock + `overflow: auto` on child panels = double scrollbar. Dock gets `overflow: hidden`, child panels own their scroll via `.ide-workbench-dock > * { overflow-y: auto }` (added separately if needed). The background `rgba(12, 20, 30, 0.95)` is slightly lighter than the root bg `#091018`, establishing luminance hierarchy without borders.

### Step 2: Remove box-shadows from panel/card/inspector-section

Find `.ide-panel, .ide-card, .ide-inspector-section` at line 697. Replace:

```css
/* BEFORE */
.ide-panel,
.ide-card,
.ide-inspector-section {
  border: 1px solid var(--ide-border);
  border-radius: var(--ide-radius-m);
  background: linear-gradient(180deg, rgba(20, 34, 50, 0.86), rgba(13, 24, 36, 0.9));
  box-shadow: var(--rb-shadow-1);
}

.ide-panel {
  padding: var(--ide-card-pad);
  border-color: color-mix(in srgb, var(--ide-border) 80%, #8ec7ff 20%);
  background: linear-gradient(180deg, rgba(24, 40, 58, 0.9), rgba(15, 26, 38, 0.92));
  box-shadow: var(--rb-shadow-2);
}
```

With:

```css
/* AFTER */
.ide-panel,
.ide-card,
.ide-inspector-section {
  border: 1px solid var(--ide-border);
  border-radius: var(--ide-radius-m);
  background: linear-gradient(180deg, rgba(20, 34, 50, 0.86), rgba(13, 24, 36, 0.9));
}

.ide-panel {
  padding: var(--ide-card-pad);
  border-color: color-mix(in srgb, var(--ide-border) 80%, #8ec7ff 20%);
  background: linear-gradient(180deg, rgba(24, 40, 58, 0.9), rgba(15, 26, 38, 0.92));
}
```

**Why:** Stacked box-shadows from dock + panel + section read as visual static, not structure. Single borders + luminance backgrounds communicate the hierarchy adequately. Four fewer box-shadow renders per workbench = sharper visual and faster paint.

### Step 3: Remove divider line from panel-actions; tighten margin

Find `.ide-panel-actions` at line 743. Replace:

```css
/* BEFORE */
.ide-panel-actions {
  min-height: var(--ide-action-row-height);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ide-space-1);
  flex-wrap: wrap;
  margin-bottom: var(--ide-space-2);
  padding-bottom: var(--ide-space-1);
  border-bottom: 1px solid rgba(58, 87, 116, 0.5);
}
```

With:

```css
/* AFTER */
.ide-panel-actions {
  min-height: var(--ide-action-row-height);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ide-space-1);
  flex-wrap: wrap;
  margin-bottom: var(--ide-space-1);
  padding-bottom: var(--ide-space-1);
}
```

**Why:** The border-bottom under actions adds visual weight between header area and content. The heading + actions together form a title zone — no divider needed inside it. Reducing margin-bottom by 4px recovers a small amount of vertical space.

### Step 4: Conditionally render panel-actions in IdePrimitives

Open `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx`.

Find the `IdePanel` component (line ~56). The current JSX always renders the `ide-panel-actions` div:

```tsx
      <div className="ide-panel-actions" data-testid="ide-panel-action-row">
        <div className="ide-surface-actions" data-testid="ide-surface-actions">
          {actions}
        </div>
      </div>
```

Replace with:

```tsx
      {actions != null && (
        <div className="ide-panel-actions" data-testid="ide-panel-action-row">
          <div className="ide-surface-actions" data-testid="ide-surface-actions">
            {actions}
          </div>
        </div>
      )}
```

**Why:** When `actions` is not provided, this saves 32px (min-height) + 4px (margin) + 8px (padding) + 1px = 45px of wasted vertical space every time IdePanel is used without actions. Verify, Export, Hardware all have actions — this only applies to panels that don't (like future standalone info panels).

**Important:** The gate `ide-primary-cta-contract.mjs` checks for `data-testid="ide-panel-action-row"` in every mode... actually no, it checks for `ide-primary-cta`. But check that no gate searches for `ide-panel-action-row` before making this change. (A quick grep will confirm.)

### Step 5: Grep for ide-panel-action-row in gate files

Run: `grep -r "ide-panel-action-row" scripts/gates/`
Expected: no output (no gate checks for this testid)

### Step 6: TypeScript check

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

### Step 7: Run regression gates

Run:
```bash
node scripts/gates/ide-primary-cta-contract.mjs
node scripts/gates/ide-verify-flow-contract.mjs
node scripts/gates/ide-verify-contract.mjs
```
Expected: all PASS.

### Step 8: Commit

```bash
git add packages/rb-apps/src/apps/ide/ide-root.css packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx
git commit -m "fix(ide): flatten elevation hierarchy — remove dock border/shadow, drop panel box-shadows, fix dock overflow:hidden, conditional panel-actions"
```

---

## Task 3: Reduce panel chrome overhead (title row height + guided strip compaction + typography outliers)

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`
  - `.ide-panel-header` min-height (line 727–733)
  - `:root` token `--rb-mode-header-height` (line 75)
  - `.ide-project-name` font-size (line 225–233)
  - `.ide-mode-label` font-size (line 387–392)
  - `.ide-project-subline` font-family (line 235–241)
  - `.ide-surface-column > .ide-guided-strip` (line 935–943)

**Goal:** Reduce non-content vertical overhead. Panel header from 40px → 32px. Guided strip from unconstrained padding → compact 28px tall. Fix typography outliers that break the token scale.

### Step 1: Reduce panel header min-height token

In `:root` block (line 76), find `--rb-title-row-height` which maps to `--rb-mode-header-height` (40px at line 75).

Change line 75:
```css
/* BEFORE */
--rb-mode-header-height: 40px;

/* AFTER */
--rb-mode-header-height: 36px;
```

**Why:** 40px was chosen for a touch-friendly target. At desktop keyboard-first IDE context, 36px is sufficient and saves 4px × number of panels per surface.

### Step 2: Compact the guided strip in surface-column context

Find `.ide-surface-column > .ide-guided-strip` at line 935. Modify padding to be tighter:

```css
/* BEFORE */
.ide-surface-column > .ide-guided-strip {
  flex-shrink: 0;
  margin-bottom: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: 1px solid rgba(46, 196, 182, 0.18);
}

/* AFTER */
.ide-surface-column > .ide-guided-strip {
  flex-shrink: 0;
  margin-bottom: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: 1px solid rgba(46, 196, 182, 0.18);
  padding-top: 6px;
  padding-bottom: 6px;
}
```

**Why:** The standalone `.ide-guided-strip` has `padding: var(--ide-space-2) var(--ide-space-3)` = 8px/12px. In the edge-to-edge surface-column context, 6px top/bottom is more appropriate (saves 4px). Horizontal padding inherits the 12px from the base rule.

### Step 3: Fix typography outliers

Find and update the following specific rules in `ide-root.css`:

**3a. `.ide-project-name` at line 225–233:**
```css
/* BEFORE */
.ide-project-name {
  margin: 0;
  font-size: 15px;
  line-height: 1.2;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* AFTER */
.ide-project-name {
  margin: 0;
  font-size: var(--rb-font-size-4);
  line-height: var(--rb-line-height-3);
  font-weight: var(--rb-font-weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**3b. `.ide-mode-label` at line 387–392:**
```css
/* BEFORE */
.ide-mode-label {
  font-size: 8px;
  line-height: 10px;
  font-weight: 600;
  text-align: center;
}

/* AFTER */
.ide-mode-label {
  font-size: 9px;
  line-height: 11px;
  font-weight: var(--rb-font-weight-semibold);
  text-align: center;
}
```

Note: going from 8→12px here would make the rail buttons significantly taller. 9px is a pragmatic compromise — one step closer to the system without reordering the rail layout. The mode buttons are 52px rail width with fixed padding; pushing label to 12px requires reducing glyph size or padding which is a separate refactor.

**3c. `.ide-project-subline` at line 235–241 — replace JetBrains Mono:**
```css
/* BEFORE */
.ide-project-subline {
  margin: 0;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 10px;
  color: var(--ide-text-muted);
  letter-spacing: 0.01em;
}

/* AFTER */
.ide-project-subline {
  margin: 0;
  font-family: var(--rb-font-mono);
  font-size: var(--rb-font-size-1);
  color: var(--ide-text-muted);
  letter-spacing: 0.01em;
}
```

**Why:** JetBrains Mono is not declared anywhere else and loads an extra font family. IBM Plex Mono (`--rb-font-mono`) is already loaded. Size 10px → 12px brings it into the token scale.

### Step 4: TypeScript check

Run: `pnpm tsc --noEmit`
Expected: 0 errors (CSS-only + no-TS changes in step 4 fix).

### Step 5: Visual smoke test

Build and open `/?mode=design`. Check:
- Panel headers are slightly tighter (36px vs 40px)
- Guided strip is compact (28px tall approx)
- Project name in topbar is readable (16px vs 15px — nearly identical)
- Mode labels on rail are slightly larger (9px)

### Step 6: Commit

```bash
git add packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "fix(ide): reduce panel chrome overhead — 36px title row, compact guided strip, fix typography outliers (8px/10px/15px/JetBrains→system tokens)"
```

---

## Task 4: Unify button size system

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`
  - `.ide-button` base (find around line 2232)
  - `.ide-top-right .ide-button` (line 274–278)
  - `.ide-design-canvas-controls .ide-button` (run grep to find)

**Goal:** All button text at `var(--rb-font-size-1)` (12px). All buttons at minimum 26px height. Three context adjustments (topbar, canvas controls) preserve height differences but share the same font size.

### Step 1: Grep for all .ide-button size overrides

Run:
```bash
grep -n "ide-button" packages/rb-apps/src/apps/ide/ide-root.css | grep -E "font-size|padding|min-height"
```

Note all occurrences. You'll find approximately:
- Base `.ide-button` rule: `font-size: 11px; padding: 6px 10px`
- `.ide-top-right .ide-button`: `font-size: 10px; padding: 4px 8px; min-height: 26px`
- `.ide-design-canvas-controls .ide-button`: `font-size: 10px; padding: 3px 8px; min-height: 24px`

### Step 2: Update base .ide-button

Find the base `.ide-button` rule. Change:

```css
/* BEFORE (approximate) */
.ide-button {
  padding: 6px 10px;
  font-size: 11px;
  line-height: var(--rb-line-height-1);
  /* ... other properties ... */
}
```

To:

```css
/* AFTER */
.ide-button {
  padding: 5px 10px;
  font-size: var(--rb-font-size-1);
  line-height: var(--rb-line-height-1);
  /* ... other properties unchanged ... */
}
```

### Step 3: Update topbar button override

Find `.ide-top-right .ide-button`. Remove font-size override (it will now inherit 12px from base):

```css
/* BEFORE */
.ide-top-right .ide-button {
  padding: 4px 8px;
  min-height: 26px;
  font-size: 10px;
}

/* AFTER */
.ide-top-right .ide-button {
  padding: 4px 8px;
  min-height: 26px;
}
```

### Step 4: Update canvas controls button override

Find `.ide-design-canvas-controls .ide-button`. Remove font-size override:

```css
/* BEFORE */
.ide-design-canvas-controls .ide-button {
  min-height: 24px;
  padding: 3px 8px;
  font-size: 10px;
}

/* AFTER */
.ide-design-canvas-controls .ide-button {
  min-height: 24px;
  padding: 3px 8px;
}
```

### Step 5: TypeScript check + regression gates

Run: `pnpm tsc --noEmit`

Run:
```bash
node scripts/gates/ide-primary-cta-contract.mjs
node scripts/gates/ide-shell-chrome-contract.mjs
```
Expected: both PASS.

### Step 6: Commit

```bash
git add packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "fix(ide): unify button font-size to 12px across all contexts (topbar + canvas controls + base)"
```

---

## Task 5: Responsive density system (replace 1120px breakpoint + add 960px tier)

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`
  - Add density custom property to `:root`
  - Replace `@media (max-width: 1120px)` breakpoint with `@media (max-width: 1280px)`
  - Add `@media (max-width: 960px)` breakpoint

**Goal:** Responsive density that actually fires before users experience overflow. At 1280px+ = comfortable (current defaults). At 960–1280px = compact (smaller dock defaults, tighter but still usable). Below 960px = existing 780px mobile breakpoint handles it.

### Step 1: Add density tokens to :root

In the `:root[data-redbyte-mode='ide']` block (after the existing `--dense-*` lines near line 136), add:

```css
/* Responsive density: comfortable (default) / compact (narrow viewport) */
--ide-density: comfortable;
--ide-dock-l-w: 220px;
--ide-dock-r-w: 280px;
```

(The dock widths are already there — just document them as part of the density system now.)

### Step 2: Replace 1120px breakpoint with 1280px — compact tier

Find `@media (max-width: 1120px)` at the bottom of the file (line 3032). Change the breakpoint threshold:

```css
/* BEFORE */
@media (max-width: 1120px) {
  /* ... */
  .ide-workbench-shell {
    --ide-workbench-left-width: 200px;
    --ide-workbench-right-width: 260px;
    /* (after task 1 we already removed padding here) */
  }
  /* ... */
}

/* AFTER — change outer threshold */
@media (max-width: 1280px) {
  /* ... keep everything in this block ... */
  .ide-workbench-shell {
    --ide-workbench-left-width: 200px;
    --ide-workbench-right-width: 260px;
  }
  /* ... */
}
```

**Important:** Only change the media query threshold (`1120` → `1280`). Do NOT add padding inside this block — Task 1 already ensured no padding increase in this breakpoint.

### Step 3: Remove redundant workbench-workspace padding override from breakpoint block

If Task 1's removal of the workspace padding override from the 1120px block is still present as a stale entry, verify it's gone. Grep:

```bash
grep -A 3 "max-width: 1280px" packages/rb-apps/src/apps/ide/ide-root.css | grep workspace
```

Expected: no output.

### Step 4: Add 960px compact tier

After the 1280px breakpoint block, add a new block:

```css
@media (max-width: 960px) {
  :root[data-redbyte-mode='ide'] {
    --ide-dock-l-w: 180px;
    --ide-dock-r-w: 240px;
  }

  .ide-workbench-shell {
    --ide-workbench-left-width: 180px;
    --ide-workbench-right-width: 240px;
  }

  .ide-top-right-group + .ide-top-right-group {
    display: none;
  }
}
```

The last rule hides the secondary action group (Run Verify / Export / Help) at 960px to prevent the topbar from wrapping. The primary group (Save / Save As / Load / Reset) remains. This is the minimal visible change at this breakpoint.

### Step 5: TypeScript check

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

### Step 6: Run shell chrome + density gates

Run:
```bash
node scripts/gates/ide-shell-chrome-contract.mjs
node scripts/gates/ide-shell-density-contract.mjs
```
Expected: PASS.

### Step 7: Commit

```bash
git add packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "fix(ide): responsive density system — 1280px compact breakpoint fires earlier, 960px tighter dock tier, no padding increases at any breakpoint"
```

---

## Task 6: Viewport overflow gate + screenshot rebaseline

**Files:**
- Create: `scripts/gates/ide-viewport-overflow-contract.mjs`
- Modify: `package.json` (add gate script)
- Modify: `scripts/repo-status.mjs` (add runCheck)
- Modify: `scripts/verify-gates-classroom.mjs` (add runGate)
- Update: `tests/e2e/ide-screenshot-baseline.spec.ts-snapshots/*.png`

**Gate purpose:** Assert that at standard viewport (1366×768) no IDE mode has horizontal overflow — i.e. `document.body.scrollWidth <= window.innerWidth` on every surface.

### Step 1: Write the gate file

Create `scripts/gates/ide-viewport-overflow-contract.mjs`:

```javascript
#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export', 'import'];

await runIdeGate('IDE viewport overflow contract satisfied', async ({ page, baseUrl }) => {
  // Set a standard classroom viewport
  await page.setViewportSize({ width: 1366, height: 768 });

  for (const mode of MODES) {
    await page.goto(`${baseUrl}/?mode=${mode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 }).catch(() => null);

    // Check for horizontal overflow: scrollWidth should not exceed clientWidth
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    assert(
      scrollWidth <= clientWidth,
      `mode=${mode} has horizontal overflow: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`
    );

    // Check that the workbench main area (or surface shell) is visible and not zero size
    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    const bbox = await modeRoot.boundingBox();
    assert(
      bbox !== null && bbox.width > 100 && bbox.height > 100,
      `mode=${mode} surface has insufficient bounds: ${JSON.stringify(bbox)}`
    );
  }
});
```

### Step 2: Add package.json script

Find the `ide:gate:*` scripts block. Add:

```json
"ide:gate:viewport-overflow-contract": "node ./scripts/gates/ide-viewport-overflow-contract.mjs",
```

### Step 3: Add to repo-status.mjs

Find `scripts/repo-status.mjs`. After the student-loop-contract `runCheck` block, add:

```javascript
if (!runCheck('IDE Viewport Overflow Contract', 'pnpm -s ide:gate:viewport-overflow-contract 2>&1')) {
  process.exit(1);
}
```

### Step 4: Add to verify-gates-classroom.mjs

Find `scripts/verify-gates-classroom.mjs`. After the student-loop-contract entry, add:

```javascript
runGate('ide:viewport-overflow-contract', 'pnpm -s ide:gate:viewport-overflow-contract', true),
```

### Step 5: Run the gate to confirm it passes

First build:
```bash
pnpm --filter @redbyte/playground build
```

Then run:
```bash
node scripts/gates/ide-viewport-overflow-contract.mjs
```

Expected: `PASS: IDE viewport overflow contract satisfied.`

If it fails: identify which mode overflows and trace the specific element causing it. Common culprits:
- `.ide-top-bar` wrapping (add `overflow: hidden` to `.ide-top-right-group` if second group is too wide)
- Export table with long strings in cells (add `word-break: break-all` to `.ide-export-diagnostic-message`)
- Import surface with wide input fields

### Step 6: Screenshot rebaseline

The visual changes across all 6 tasks (removed dock borders, compacted panels, unified buttons) require new baselines:

```bash
pnpm ide:gate:screenshots:update
```

Expected: 7 tests pass (home + 6 modes), all 6 `ide-mode-*.png` files regenerated.

### Step 7: Run full regression suite

```bash
node scripts/gates/ide-primary-cta-contract.mjs
node scripts/gates/ide-verify-flow-contract.mjs
node scripts/gates/ide-verify-contract.mjs
node scripts/gates/ide-shell-chrome-contract.mjs
node scripts/gates/ide-student-loop-contract.mjs
```

Expected: all PASS.

### Step 8: Commit

```bash
git add scripts/gates/ide-viewport-overflow-contract.mjs package.json scripts/repo-status.mjs scripts/verify-gates-classroom.mjs "tests/e2e/ide-screenshot-baseline.spec.ts-snapshots/"
git commit -m "test(gates): add ide-viewport-overflow-contract; rebaseline screenshots after visual overhaul"
```

---

## Commit Summary

| # | Commit message |
|---|----------------|
| 1 | `fix(ide): reclaim workbench viewport — zero shell/workspace padding, fix console grid minmax swap, stop breakpoint padding increase` |
| 2 | `fix(ide): flatten elevation hierarchy — remove dock border/shadow, drop panel box-shadows, fix dock overflow:hidden, conditional panel-actions` |
| 3 | `fix(ide): reduce panel chrome overhead — 36px title row, compact guided strip, fix typography outliers (8px/10px/15px/JetBrains→system tokens)` |
| 4 | `fix(ide): unify button font-size to 12px across all contexts` |
| 5 | `fix(ide): responsive density system — 1280px compact breakpoint, 960px dock shrink tier` |
| 6 | `test(gates): add ide-viewport-overflow-contract; rebaseline screenshots after visual overhaul` |

---

## What NOT to change

- Any simulation logic or store files
- `IdeGuidedStrip.tsx` component internals
- `IdeWorkbenchShell.tsx` logic (only CSS changes)
- `projectHealth.ts`
- Any VHDL/constraint/export generation
- Drag-to-resize behavior in `IdeWorkbenchShell.tsx`

---

## Critical Files Quick Reference

| File | Lines | Change |
|------|-------|--------|
| `ide-root.css` | 394–405 | Shell: remove padding, fix minmax swap |
| `ide-root.css` | 429–435 | Workspace: remove horizontal padding |
| `ide-root.css` | 419–427 | Dock: remove border+shadow, fix overflow |
| `ide-root.css` | 697–711 | Panel/card/section: remove box-shadows |
| `ide-root.css` | 743–753 | Panel-actions: remove border, tighten margin |
| `ide-root.css` | 75 | Token: mode-header-height 40px→36px |
| `ide-root.css` | 225–241 | Typography: project-name 15px→16px, subline font |
| `ide-root.css` | 387–392 | Typography: mode-label 8px→9px |
| `ide-root.css` | ~2232 | Button base: 11px→12px font-size |
| `ide-root.css` | 274–278 | Topbar button: remove font-size override |
| `ide-root.css` | 3032–3054 | Breakpoint: 1120→1280, no padding increase |
| `IdePrimitives.tsx` | 70–74 | IdePanel: conditional panel-actions render |
| `scripts/gates/ide-viewport-overflow-contract.mjs` | new | Overflow gate |

---

## Verification After Each Commit

1. `pnpm tsc --noEmit` → 0 errors
2. `node scripts/gates/ide-verify-contract.mjs` → PASS (regression check)
3. `node scripts/gates/ide-shell-chrome-contract.mjs` → PASS (regression check)
