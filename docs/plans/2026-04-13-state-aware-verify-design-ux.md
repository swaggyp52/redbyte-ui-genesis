# State-Aware Verify And Design UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Verify and Design feel spatially deliberate in both open and closed states by fixing collapsed Verify workbench ownership, redesigning Design left and right rails, and cleaning up cross-surface layout density.

**Architecture:** Hoist open and closed state ownership to the surface or shell layer instead of hiding panels locally with CSS. Verify will get a parent-owned waveform-focus mode for collapsed stimulus editing, while Design will get explicit first-class left and right rail collapse and restore behavior rather than relying on one side to be always open.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, repo-local shell layout primitives, source-driven browser validation.

---

### Task 1: Lock Verify Collapsed-State Ownership

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/verifySurface.workspaceLayout.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/verify/VerifyRegionLayout.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Step 1: Write the failing tests**

Add assertions that post-run collapsed stimulus mode:
- marks the workspace with a waveform-focus state marker
- removes the full-height left stimulus column contract
- renders a compact collapsed stimulus strip with scenario recovery actions instead of a giant empty panel shell

**Step 2: Run tests to verify they fail**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifySurface.workspaceLayout.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx`

**Step 3: Implement minimal ownership change**

- Hoist workbench expanded and collapsed state into `VerifySurface`
- Pass explicit collapsed-state props into `ScenarioBuilderPanel`
- Give `VerifyRegionLayout` and `VerifySurface` explicit data markers for `authoring` vs `waveform-focus`
- Replace the empty collapsed shell with a compact authored-stimulus strip that keeps scenario selection, reopen action, and checks entry points visible

**Step 4: Run tests to verify they pass**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifySurface.workspaceLayout.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx`

### Task 2: Add First-Class Design Right-Rail Collapse

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Step 1: Write the failing tests**

Add assertions that:
- Design can render a user-closable right inspector even when selection auto-opens it
- the shell renders a restore affordance for the right rail in Design
- replay-linked Design selection does not permanently force the right rail open once the user closes it

**Step 2: Run tests to verify they fail**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

**Step 3: Implement minimal shell and surface changes**

- Add a real right-rail collapse control path in `IdeWorkbenchShell`
- Let `DesignSurface` request inspector visibility without preventing user collapse forever
- Introduce a calmer closed-state right rail presentation that restores the inspector intentionally

**Step 4: Run tests to verify they pass**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`

### Task 3: Redesign Design Left Rail Open And Closed States

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Step 1: Write the failing tests**

Add assertions that the collapsed Design rail carries meaningful surface identity and that the open rail keeps search and core parts without reading like a full-height slab.

**Step 2: Run tests to verify they fail**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx`

**Step 3: Implement the redesign**

- Enrich the collapsed left rail with better label, icon, and state presentation
- Reduce open-rail slab weight through width, internal section rhythm, and calmer search and category spacing
- Keep board resources and live inputs behavior intact while improving overall silhouette

**Step 4: Run tests to verify they pass**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx`

### Task 4: Clean Up Cross-Surface Density And Replay Coupling

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx`
- Modify: `packages/rb-apps/src/apps/ide/__tests__/verifyCommandBar.actionRowHierarchy.test.tsx`
- Modify: `packages/rb-apps/src/apps/IdeApp.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/verify/VerifyCommandBar.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Step 1: Write the failing tests**

Add assertions that:
- clearing replay-linked focus actually clears the Design-side linked selection state
- the Verify command strip remains compact after collapsed-state redesign and does not regrow extra status clutter

**Step 2: Run tests to verify they fail**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifyCommandBar.actionRowHierarchy.test.tsx`

**Step 3: Implement the cleanup**

- Unify Verify-to-Design linked focus clearing semantics in `IdeApp`
- Trim top-strip density in Design and Verify where the new rail states make older chrome redundant
- Normalize spacing and silhouette rules for left and right support surfaces across both modes

**Step 4: Run tests to verify they pass**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifyCommandBar.actionRowHierarchy.test.tsx`

### Task 5: Full Focused Validation

**Files:**
- Modify if needed: `packages/rb-apps/src/apps/ide/AI_STATE.md` equivalent root `AI_STATE.md`
- Modify if needed: canonical vault notes after implementation and browser validation

**Step 1: Run the focused suites**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifySurface.workspaceLayout.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.debugNav.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifyCommandBar.actionRowHierarchy.test.tsx`

**Step 2: Run build**

Run:
`pnpm --filter @redbyte/playground build`

**Step 3: Browser validation**

Validate in the live browser:
- Verify with workbench open
- Verify with workbench collapsed
- Verify signal rail open and collapsed
- Design left rail open and collapsed
- Design right rail open and collapsed
- Design replay-selected and neutral state
- Verify to Design round-trip still intact

**Step 4: Documentation pass**

- Update `AI_STATE.md`
- Update canonical architecture and dashboard notes if the visible product contract changed