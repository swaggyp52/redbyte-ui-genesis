# Design Left Dock Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the Design left dock so search and core parts stay primary, while Board Resources and Live Inputs become optional secondary sections.

**Architecture:** Keep the slice local to the Design palette and left dock. Use a small amount of local disclosure state in the Design surface to collapse secondary sections by default, preserve board search discoverability by auto-opening matching board results, and use CSS softening for counts/header weight rather than a broader shell rewrite.

**Tech Stack:** React, TypeScript, Vitest, Vite, repo-local IDE CSS, Playwright screenshots

---

### Task 1: Lock the new left-dock hierarchy with failing tests

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx`

**Step 1: Write the failing tests**

Add coverage for:
- Board Resources collapsed by default on first render
- Live Inputs collapsed by default when live inputs exist
- Board search terms like `led` or `sw0` reopen Board Resources so matching results remain visible

**Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx`

Expected: FAIL because the left dock still renders Board Resources and Live Inputs fully expanded.

### Task 2: Add local disclosure behavior for secondary left-dock sections

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Write minimal implementation**

Add local left-dock disclosure state so:
- Logic Gates, Sequential & Timing, and Inputs & Outputs remain open
- Board Resources starts collapsed by default
- Live Inputs starts collapsed by default
- Board Resources auto-opens when the current search query matches board inventory results

**Step 2: Run targeted test**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx`

Expected: still FAIL or partially pass until the visual hierarchy work is complete.

### Task 3: Demote header/count chrome so the dock reads like a parts tray

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Step 1: Write minimal implementation**

Adjust the left dock so:
- `Build Library` framing is quieter
- section counts are less visually assertive
- secondary subsection headers are softened
- the `Focus` control is removed or demoted enough that it no longer competes with search and core parts access

**Step 2: Run targeted tests**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

Expected: PASS.

### Task 4: Capture the after matrix and run slice validation

**Files:**
- No source changes unless a targeted regression requires a narrow follow-up.

**Step 1: Capture after screenshots**

Capture the same Design states and size/zoom matrix used in the audit.

**Step 2: Run build validation**

Run: `pnpm --filter @redbyte/playground build`

Expected: PASS.

### Task 5: Document and close the slice

**Files:**
- Modify: `AI_STATE.md`
- Modify: `03 Architecture/Design Surface.md`
- Modify: `01 Dashboard/RedByte Engineering Brain.md` only if the design contract or next-action guidance needs a factual update

**Step 1: Add factual change log entry**

Record the left-dock simplification slice and its validation evidence.

**Step 2: Review and commit one logical slice**

Run code review on the final diff, then commit only the slice files.

Run: `git commit -m "ide: simplify design left dock"`