# Design Bottom Console and Footer Demotion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the dead bottom-edge chrome from calm Design states so blank and healthy authoring views stop reserving space for an empty console row and a repetitive footer.

**Architecture:** Keep the slice Design-only. Hide the Design workbench console when there are no compiler diagnostics to show, preserve the existing console path when warnings or errors exist, and quiet the Design footer so it stops repeating mode/hash truth already present in the shell.

**Tech Stack:** React, TypeScript, Zustand, Vitest, Vite, live browser audit

---

### Task 1: Lock the bottom-edge contract with failing tests

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`
- Create: `packages/rb-apps/src/apps/ide/__tests__/IdeStatusBar.test.tsx`

**Step 1: Write the failing quiet-Design console tests**

Add assertions that:
- blank Design does not render the workbench console when there are no diagnostics
- code and split Design views also keep the console hidden when there are no diagnostics
- Design still renders the console when compiler diagnostics exist

**Step 2: Write the failing Design footer test**

Add a status-bar test that asserts:
- non-Design modes still show the full footer details
- Design mode no longer repeats `Mode:` and `Project Hash:` in the footer chrome

**Step 3: Run focused tests to verify red**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/IdeStatusBar.test.tsx`

Expected:
- FAIL because quiet Design still renders a collapsed workbench console
- FAIL because the status bar still renders full mode/hash text for Design

### Task 2: Implement the smallest Design-only bottom-edge change

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/components/IdeStatusBar.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css` (only if footer layout needs a quiet-mode class)

**Step 1: Hide the empty Design console**

In `DesignSurface.tsx`:
- derive a `hasVisibleDiagnosticsConsole` boolean from compiler counts and diagnostic rows
- pass `consoleMode="hidden"` for quiet Design states
- preserve the existing collapsed/blocking console path when warnings or errors exist

**Step 2: Quiet the Design footer**

In `IdeStatusBar.tsx`:
- keep the existing footer for non-Design modes
- for `mode === 'design'`, render only the readiness pill and omit the repeated mode/hash text

**Step 3: Apply the smallest footer CSS adjustment if needed**

Only if the quiet footer looks awkward:
- add a quiet footer modifier class
- keep the status bar compact and secondary

### Task 3: Verify green and audit live behavior

**Files:**
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/IdeStatusBar.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorHierarchy.test.tsx`

**Step 1: Run focused regression tests**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/IdeStatusBar.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorHierarchy.test.tsx`

Expected:
- PASS on quiet Design console behavior
- PASS on existing Design chrome hierarchy

**Step 2: Re-check live blank Design and a populated Design state**

Confirm:
- quiet Design no longer shows the dead `Console / Show` row
- diagnostics still surface when present
- the footer no longer competes with the canvas in Design

**Step 3: Run the build**

Run:
`pnpm --filter @redbyte/playground build`

Expected:
- build succeeds on the final slice state

### Task 4: Update canonical notes and close the slice

**Files:**
- Modify: `AI_STATE.md`
- Modify: `03 Architecture/Design Surface.md`
- Modify: `01 Dashboard/RedByte Engineering Brain.md`

**Step 1: Record the new bottom-edge contract**

Document that:
- quiet Design hides the empty console entirely
- Design footer chrome now carries only the quiet readiness signal
- diagnostics still reclaim the console when needed

**Step 2: Advance the dashboard next action**

Update the dashboard so the next Design slice reflects the next unresolved chrome or interaction issue after bottom-edge cleanup.

**Step 3: Commit one coherent slice**

Run:
- `git add [slice files]`
- `git commit -m "ide: demote design bottom chrome"`