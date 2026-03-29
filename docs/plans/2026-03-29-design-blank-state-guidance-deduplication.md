# Design Blank-State Guidance De-duplication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make blank Design feel calm and obvious by keeping one strong onboarding element while hiding or softening duplicate first-step guidance.

**Architecture:** Keep the in-canvas blank-state card as the primary teacher. Suppress or demote duplicate guidance in the Design first-run overlay, blank idle inspector, blank shortcut strip, and blank Design pipeline-strip affordances without changing broader Design behavior.

**Tech Stack:** React, TypeScript, Zustand, Vitest, Vite, Playwright browser audit

---

### Task 1: Lock blank-state audit evidence

**Files:**
- Reference: `c:\Users\conno\AppData\Local\Temp\redbyte-design-slice4-before\design-first-run-overlay.png`
- Reference: `c:\Users\conno\AppData\Local\Temp\redbyte-design-slice4-before\blank-1280x720-100.png`
- Reference: `c:\Users\conno\AppData\Local\Temp\redbyte-design-slice4-before\blank-1280x720-125.png`
- Reference: `c:\Users\conno\AppData\Local\Temp\redbyte-design-slice4-before\blank-1440x900-100.png`
- Reference: `c:\Users\conno\AppData\Local\Temp\redbyte-design-slice4-before\blank-1440x900-125.png`

**Step 1: Record ranked issues before code**

Document the audit findings in working notes:
- Design first-run overlay duplicates the blank-state lesson
- Blank idle inspector repeats first-step guidance
- Blank shortcut strip adds a second/third teaching layer
- Blank Design pipeline strip shows redundant `Open Design` guidance while already on Design

**Step 2: Keep the slice boundary explicit**

Do not change:
- theme tokens
- left-dock hierarchy beyond blank-state guidance
- Verify / Import / Export / Hardware behavior
- broader shell layout

### Task 2: Write failing blank-state behavior tests

**Files:**
- Create: `packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/OnboardingOverlay.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/pipelineStrip.test.tsx`

**Step 1: Write the failing blank-state surface tests**

Add tests that assert:
- the blank-state card remains visible on an empty circuit
- the blank shortcut strip is hidden while the blank-state card is visible
- the blank idle inspector no longer repeats `Start on the canvas first`

**Step 2: Run blank-state tests to verify they fail**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx`

Expected:
- FAIL because the shortcut strip still renders on blank Design
- FAIL because the inspector still renders the duplicate next-step copy

**Step 3: Write the failing onboarding overlay test**

Add a test that asserts the Design onboarding overlay no longer renders for Design mode even when onboarding state is unseen.

**Step 4: Run onboarding overlay tests to verify they fail**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/OnboardingOverlay.test.tsx`

Expected:
- FAIL because the overlay still renders for `mode="design"`

**Step 5: Write the failing pipeline strip test**

Add a test that asserts the blank Design blocker/fix affordance does not render when the current mode is already `design` and the blocker fix path also points to `design`.

**Step 6: Run pipeline strip tests to verify they fail**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/pipelineStrip.test.tsx`

Expected:
- FAIL because the blocker/fix link still render for blank Design

### Task 3: Implement the smallest Design-only fixes

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/components/OnboardingOverlay.tsx`
- Modify: `packages/rb-apps/src/apps/ide/components/PipelineStrip.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css` (only if spacing slack remains after copy removal)

**Step 1: Keep the canvas blank-state card primary**

In `DesignSurface.tsx`:
- keep `ide-design-empty-state` unchanged as the main onboarding card
- derive a `showBlankStateCard` boolean from empty circuit + not placement mode

**Step 2: Hide duplicate shortcut help on blank first look**

In `DesignSurface.tsx`:
- stop rendering `ide-design-shortcut-strip` while `showBlankStateCard` is true
- preserve existing shortcut strip behavior for non-blank or interacted states

**Step 3: Quiet the blank idle inspector**

In `DesignSurface.tsx`:
- keep `Nothing selected`
- keep the neutral subtitle
- remove or suppress the extra next-step paragraph while the circuit is blank

**Step 4: Remove the competing Design overlay lesson**

In `OnboardingOverlay.tsx`:
- keep project/import/other mode onboarding intact
- suppress the overlay entirely for `mode === 'design'`

**Step 5: Remove redundant blank Design pipeline guidance**

In `PipelineStrip.tsx`:
- suppress the right-side blocker/fix affordance when the blocker fix path targets the current `design` page
- preserve blocker rendering for other modes and other fix paths

**Step 6: Only apply CSS cleanup if needed**

If the inspector or canvas layout looks visually slack after the text removals:
- make the smallest spacing adjustment in `ide-root.css`
- avoid unrelated style tuning

### Task 4: Verify green on focused tests

**Files:**
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/OnboardingOverlay.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/pipelineStrip.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorHierarchy.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.placementMode.test.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

**Step 1: Run focused blank-state and regression tests**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx packages/rb-apps/src/apps/ide/__tests__/OnboardingOverlay.test.tsx packages/rb-apps/src/apps/ide/__tests__/pipelineStrip.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.inspectorHierarchy.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.placementMode.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

Expected:
- PASS on the new blank-state contract
- PASS on existing Design chrome and placement behavior

### Task 5: Capture after evidence and build

**Files:**
- Reference output dir: `c:\Users\conno\AppData\Local\Temp\redbyte-design-slice4-after`

**Step 1: Capture after screenshots at the same four blank-state sizes**

Capture:
- `1280x720 / 100%`
- `1280x720 / 125%`
- `1440x900 / 100%`
- `1440x900 / 125%`

**Step 2: Run the build**

Run:
`pnpm --filter @redbyte/playground build`

Expected:
- build succeeds on the final slice state

**Step 3: Run broader repo commands only if the slice grew substantial**

If the implementation expands beyond the planned surface, also run:
- `pnpm repo:status`
- `pnpm classroom:signoff --allow-dirty`

### Task 6: Review, document, and commit

**Files:**
- Modify: `AI_STATE.md`
- Modify: `03 Architecture/Design Surface.md`
- Modify: `01 Dashboard/RedByte Engineering Brain.md`

**Step 1: Run a code review pass on the final diff**

Focus review on:
- duplicate guidance truly removed only for blank Design
- no regressions to placement mode or non-blank Design

**Step 2: Update factual repo docs**

Add:
- the blank-state primary CTA contract
- which guidance is hidden by default
- what visual competition was removed

**Step 3: Commit one coherent slice**

Run:
- `git add [slice files]`
- `git commit -m "ide: dedupe blank design guidance"`
