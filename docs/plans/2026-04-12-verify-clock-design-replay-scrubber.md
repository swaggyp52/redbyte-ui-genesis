# Verify Clock Truth + Design Replay Scrubber Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the false sequential clock warning in Verify, add a real case-index replay scrubber in Design, and tighten replay-dependent visual hierarchy across Design and Verify without reopening unrelated surfaces.

**Architecture:** Keep Verify as the sole testbench authoring surface and keep IdeApp as the single replay-selection authority. Fix the clock contradiction by making warning logic read the same effective vector authority the rest of Verify already uses. Upgrade Design replay by adding direct index scrubbing in the existing simulation strip, then make replay-dependent state feel more deliberate by strengthening the strip, inspector, and live-state emphasis instead of adding new panels.

**Tech Stack:** React, TypeScript, Vitest, Playwright-integrated browser validation, RedByte Obsidian notes.

---

### Task 1: Lock the false clock warning into a failing regression

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`

**Step 1: Write the failing warning regression**

Add a test proving Verify does not render the `No clock activity detected in your vectors` warning when the effective vector source already includes clock entries through the active scenario or other non-`authoredVectors` authority.

**Step 2: Run the focused Verify test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx -t "does not warn about missing clock activity"`

Expected: FAIL because `nextRunNeedsClockActivity` currently checks `authoredVectors` only.

**Step 3: Implement the smallest clock-truth fix**

Create one effective vector source for warning logic using the same authority already used by `signalInventory`: active scenario vectors when present, otherwise authored vectors, then append custom vectors as needed. Match clock activity against normalized input keys, not raw strings.

**Step 4: Run the focused Verify test to verify it passes**

Run the same command.

Expected: PASS.

### Task 2: Add a real Design replay scrubber contract

**Files:**
- Modify: `packages/rb-apps/src/apps/IdeApp.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx`

**Step 1: Write the failing scrubber interaction test**

Add a test proving Design renders a replay scrubber during active replay, that the scrubber is indexed by authored case position, and that changing the scrubber requests a new replay index.

**Step 2: Run the focused Design replay test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx -t "allows scrubbing through replay cases"`

Expected: FAIL because only prev/next replay controls exist today.

**Step 3: Add parent-owned replay index selection**

In `IdeApp.tsx`, add a direct replay-index selection callback that maps a case index back to the authoritative waveform sample and updates debug tick plus signal snapshot together.

**Step 4: Implement the central scrubber UI in Design**

In `DesignSurface.tsx`, add one compact horizontal scrubber inside the simulation strip or adjacent replay control cluster:

- previous button
- range input indexed by case order
- next button
- current case/tick label

Do not add a second replay panel.

**Step 5: Run the focused Design replay test to verify it passes**

Run the same command.

Expected: PASS.

### Task 3: Prove replay case changes drive visible replay-dependent state

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Write the failing replay-state regression**

Add a test proving that changing the Design replay case updates at least these visible replay-dependent outputs:

- simulation strip label (`Case N / M · tX`)
- replay summary text
- inspector/live state values or replay emphasis that depend on the selected sample

**Step 2: Run the focused Design test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

Expected: FAIL if the new scrubber changes selection but not enough visible replay-dependent state.

**Step 3: Tighten replay-dependent visual state**

Strengthen the existing replay-aware surfaces instead of adding fake effects:

- promote replay controls to the simulation strip
- add replay-active styling to the live state / inspector area
- ensure case changes visibly update replay-focused values and explanatory copy
- keep stale replay behavior unchanged

**Step 4: Run the focused Design tests to verify they pass**

Run the same command.

Expected: PASS.

### Task 4: Focused Design + Verify organization cleanup

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`
- Modify: any directly related Design / Verify surface files only if required

**Step 1: Apply one narrow hierarchy pass**

Improve only the dominant control areas:

- Design replay controls should read as one clear, central replay feature
- Verify should keep the warning and helper actions visually tied to the stimulus authoring area
- demote duplicated or weak copy if it competes with the primary control region

**Step 2: Add or adjust test coverage if a weak control/region is removed or materially demoted**

Use existing Design/Verify workstation tests where possible.

**Step 3: Re-run the narrow regression suites**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.duplicate.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.placementMode.test.tsx`

Expected: PASS.

### Task 5: Validate in the real app and document the slice

**Files:**
- Modify: `AI_STATE.md`
- Modify: canonical notes only if the replay or clock contract changes materially

**Step 1: Run the focused suite bundle**

Run the Task 4 command.

Expected: PASS.

**Step 2: Run the full workspace build**

Run: `pnpm build`

Expected: PASS.

**Step 3: Browser-validate on the real sequential example**

Use the built preview and confirm:

- Verify no longer shows the false clock warning when effective sequential clock vectors are present
- Design replay has an obvious scrubber in the main replay control area
- scrubbing cases visibly changes replay-dependent state
- stale replay still demotes immediately after mutation
- Design and Verify feel more deliberate in the actual rendered UI

**Step 4: Update AI state and notes factually**

Record only the verified product-surface changes and the actual validation evidence.