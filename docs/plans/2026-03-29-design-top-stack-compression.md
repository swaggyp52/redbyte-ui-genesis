# Design Top Stack Compression Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the Design surface top-of-canvas stack to one primary toolbar row plus one compact status row so the canvas becomes the primary first-look element.

**Architecture:** Keep the slice Design-only. Remove the separate Design frame header band, keep the existing toolbar/status structure, and demote duplicate top-row canvas telemetry instead of rewriting workbench behavior or canvas interactions.

**Tech Stack:** React, TypeScript, Vitest, Playwright screenshots, repo-local IDE CSS

---

### Task 1: Lock the behavior with a failing Design chrome test

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx`

**Step 1: Write the failing test**

Add a test asserting the Design frame title/context band no longer renders and the top status strip no longer surfaces duplicate node/wire/zoom telemetry.

**Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx`

Expected: FAIL because `Circuit Designer` and top-row canvas stats still render.

### Task 2: Remove the extra Design title band

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignWorkspaceFrame.tsx`

**Step 1: Write minimal implementation**

Render the workspace body without the dedicated frame header row.

**Step 2: Run targeted test**

Run: `pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx`

Expected: still FAIL until duplicate top status telemetry is removed.

### Task 3: Demote duplicate top-row telemetry and tighten Design chrome styling

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Step 1: Write minimal implementation**

Remove node/wire/zoom telemetry from the top compact status strip, keep edit-critical authoring and simulation truth, and tighten Design control bar/header spacing to match the new two-row stack.

**Step 2: Run targeted tests**

Run: `pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

Expected: PASS.

### Task 4: Re-capture the screenshot matrix and validate the slice

**Files:**
- No source changes unless a test requires a narrow follow-up.

**Step 1: Capture after screenshots**

Capture the same Design states and size/zoom matrix used in the audit.

**Step 2: Run build validation**

Run: `pnpm --filter @redbyte/playground build`

Expected: PASS.

### Task 5: Document and close the slice

**Files:**
- Modify: `AI_STATE.md`

**Step 1: Add factual change log entry**

Record the Design top-stack compression slice and its validation evidence.

**Step 2: Commit one logical slice**

Run: `git add docs/plans/2026-03-29-design-top-stack-compression.md packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/surfaces/DesignWorkspaceFrame.tsx packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx packages/rb-apps/src/apps/ide/ide-root.css AI_STATE.md`

Run: `git commit -m "ide: compress design top stack"`