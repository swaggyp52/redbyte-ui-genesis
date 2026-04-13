# Design Replay UX Proof And Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Design replay semantics easier for students to read in the live strip, then remove one weak cross-app shell control that does not justify its existence.

**Architecture:** Keep the replay model unchanged. Reuse the existing replay-selection label and replay timing hint in the Design simulation strip so the same meaning is visible without relying on the debug banner alone. Then simplify the shared shell by removing the global Focus toggle and its state/CSS wiring.

**Tech Stack:** React, TypeScript, Vitest, Playwright-integrated browser validation, RedByte Obsidian notes.

---

### Task 1: Lock browser truth into tests

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`
- Create or modify: `packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx`

**Step 1: Write the failing replay-strip clarity test**

Assert that active replay in Design shows the case-aware replay label in the simulation strip and not only a raw `Tick N` label.

**Step 2: Run the replay test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx`

Expected: FAIL because the strip currently renders `Tick {simTick}` during replay.

**Step 3: Write the failing replay timing-hint test**

Assert that active replay in Design shows the sampling meaning in the simulation strip, for example `Sampled post-rising-edge on CLK.`

**Step 4: Run the workstation test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

Expected: FAIL because the replay timing hint currently only renders in the debug banner.

**Step 5: Write the failing Focus-toggle cleanup test**

Assert that the shared shell no longer renders `ide-workbench-focus-toggle`.

**Step 6: Run the shell test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx`

Expected: FAIL because the Focus toggle still exists.

### Task 2: Implement replay-strip clarity

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Replace raw replay tick copy in the simulation strip**

Use the existing `activeReplaySelectionLabel` during replay instead of a plain `Tick {simTick}` label.

**Step 2: Surface replay timing meaning in the simulation strip**

Render the existing `activeReplayTimingHint` in the strip during replay so clock/sample meaning is visible even when the edge pill is absent.

**Step 3: Keep live-mode behavior unchanged**

Ensure non-replay Design still uses the existing live tick and mode semantics.

### Task 3: Remove Focus toggle cleanup

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Step 1: Remove Focus toggle button and shell-local state**

Delete the toggle button, `focusMode` state, localStorage persistence, and shell class/data attributes that only support this control.

**Step 2: Remove dead Focus-toggle CSS**

Delete styling that only applies to the removed control and shell mode.

**Step 3: Preserve existing dock/console policy behavior**

Do not change left/right dock collapse rails, console toggling, or per-surface layout policy.

### Task 4: Verify and document

**Files:**
- Modify: `AI_STATE.md`
- Modify: canonical notes if the student-facing replay contract changed materially

**Step 1: Run focused tests**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx`

Expected: PASS.

**Step 2: Run any directly adjacent replay/control tests if needed**

Keep scope narrow to Design replay and shell-control behavior.

**Step 3: Run build**

Run: `pnpm build`

Expected: PASS.

**Step 4: Update AI state and vault notes**

Record the replay-strip clarity contract and the Focus-toggle cleanup as factual product-surface changes.