# Phase 6B Waveform Legitimacy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Verify oscilloscope trustworthy by keeping the assertion overlay locked to the same tick geometry and tick window as the waveform viewport.

**Architecture:** Keep the change minimal and local. Treat the waveform SVG as the layout authority, then thread its runtime tick window and tick width into AssertionCanvas so both panels describe the same evidence. Prove the contract with one unit-style geometry test and one VerifySurface integration test.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

---

### Task 1: Add failing AssertionCanvas geometry coverage

**Files:**
- Modify: `packages/rb-apps/src/__tests__/AssertionCanvas.test.tsx`

**Step 1: Write the failing test**

Add a test that renders `AssertionCanvas` with `tickWidth={72}` and asserts the inner layout width is `140 + ticks * 72 + 36`.

**Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/__tests__/AssertionCanvas.test.tsx`

Expected: FAIL because `AssertionCanvas` still hardcodes `TICK_W = 48`.

### Task 2: Add failing VerifySurface fail-window sync coverage

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/verifySurface.waveform-priority.test.tsx`

**Step 1: Write the failing test**

Add an integration assertion that after focusing a late mismatch, the assertion canvas shows only the fail-window ticks visible in the waveform and does not keep rendering off-window tick headers.

**Step 2: Run test to verify it fails**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifySurface.waveform-priority.test.tsx`

Expected: FAIL because `VerifySurface` still passes `timelineTicks` into `AssertionCanvas`.

### Task 3: Wire runtime waveform geometry into AssertionCanvas

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/components/AssertionCanvas.tsx`

**Step 1: Write minimal implementation**

Add an optional `tickWidth` prop with a default of `48`, and replace the file-level hardcoded `TICK_W` usage with the runtime value.

**Step 2: Run unit test to verify it passes**

Run: `pnpm -w exec vitest run packages/rb-apps/src/__tests__/AssertionCanvas.test.tsx`

Expected: PASS.

### Task 4: Sync VerifySurface assertion ticks with waveform ticks

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`

**Step 1: Write minimal implementation**

At the `AssertionCanvas` callsite, pass `tickWidth={tickWidth}` and replace `ticks={timelineTicks}` with `ticks={zoomedTicks}`.

**Step 2: Run integration test to verify it passes**

Run: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifySurface.waveform-priority.test.tsx`

Expected: PASS.

### Task 5: Regression proof

**Files:**
- Validate only

**Step 1: Run focused regression suite**

Run: `pnpm -w exec vitest run packages/rb-apps/src/__tests__/AssertionCanvas.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.waveform-priority.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx`

Expected: PASS.

**Step 2: Run build proof**

Run: `pnpm --filter @redbyte/playground build`

Expected: EXIT 0.

### Task 6: Update current-state docs

**Files:**
- Modify: `AI_STATE.md`
- Modify: `01 Dashboard/RedByte Engineering Brain.md`
- Modify: `docs/roadmap/RedByte_Gap_Audit.md`

**Step 1: Record what changed**

Document that Phase 6B first slice established a waveform evidence contract: the assertion overlay now shares the same tick width and fail window as the oscilloscope.

**Step 2: Record proof**

Include the focused test command and build command results.

---

## Follow-up Slice: Waveform Chrome Reduction

**Goal:** Remove repeated scope chrome so the waveform viewport gives more space and attention to actual debugging evidence.

**Implementation:**
- Remove the redundant signal-digest strip, in-frame tick explainer, legend strip, and cursor readout table from `VerifySurface.tsx`
- Simplify the idle ghost scope and make its width responsive to the real container instead of a fixed decorative track
- Strengthen fail overlay opacity directly in the waveform SVG

**Verification:**
- `pnpm -w exec vitest run packages/rb-apps/src/__tests__/AssertionCanvas.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.waveform-priority.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx --reporter=basic`
- `pnpm --filter @redbyte/playground build`

**Manual smoke checklist:**
- Fail run: no signal digest, no legend strip, no tick explainer, no cursor readout table inside the waveform frame
- Fail run: mismatch columns are immediately visible without opening extra panels
- Idle waveform: ready viewport stretches to available width and does not show fixed-width `ARMED · AWAITING RUN` chrome
- Sequential run: sequential badge and trace readability remain intact after the chrome reduction