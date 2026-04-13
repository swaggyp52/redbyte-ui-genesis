# Clock Authority + Design Consistency

## Goal

Prove one canonical browser clock model across Verify authoring, Verify replay, Design live narration, and bring-up helper generation without reopening unrelated Project/Import/Hardware/Export work.

## Product Rules

- Verify schedule authority is canonical.
- Default helper clock alternates by case starting low: `t0=0`, `t1=1`, `t2=0`, `t3=1`.
- Sequential samples represent the sampled state for the selected case.
- Rising edge is `0 -> 1`.
- Design must not infer a different clock story from label heuristics.

## Chosen Slice

### Part 1

Thread the live `VerifyScheduleContract` into surface logic and move helper clock generation behind one shared helper policy.

- Verify pre-run inventory must use the active schedule contract, not `lastRun` alone.
- Verify helper clock buttons must use the canonical named clock and absolute tick parity.
- Bring-up sequential helper generation must reuse the same clock-value helper.

### Part 2

Use the same contract-backed timing guidance in Design live simulation story so the story strip identifies the clock/control signal from schedule authority instead of `/clk|clock/i` label inference.

## TDD Plan

1. Add failing unit tests for active contract resolution and helper clock parity.
2. Add failing VerifySurface test showing inserted helper clock respects absolute tick parity and the contract clock name.
3. Add failing DesignSurface test showing the live story clock pill follows contract timing guidance for a non-regex clock label.
4. Implement the smallest production change set to make those tests pass.
5. Run focused Vitest suites, then a workspace build if the focused tests pass.

## Files Expected

- `packages/rb-apps/src/apps/ide/clockAuthority.ts`
- `packages/rb-apps/src/apps/ide/__tests__/clockAuthority.test.ts`
- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx`
- `packages/rb-apps/src/apps/ide/bringupArtifacts.ts`
- `packages/rb-apps/src/apps/IdeApp.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

## Verification

- Focused Vitest coverage for the new clock-authority seams.
- A workspace build check.
- Browser validation on one sequential example after tests are green.