# Repo Cleanup And Surface Clarification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean the active RedByte feature branch into a deliberate local release candidate, define canonical surface workflows in Obsidian, and implement a clearer Verify-first product hierarchy across Verify, Design, Project, and Hardware.

**Architecture:** Work in three phases. First, classify and clean the repo state on `feat/verify-panel-ownership` without losing validated work, then align local `main` by fast-forward only. Second, update canonical architecture notes so each surface has a sharp operational role and handoff. Third, use TDD to simplify visible product flow, with Verify as the primary target and Design as the secondary target.

**Tech Stack:** Git, PowerShell, React, TypeScript, Vitest, Testing Library, Playwright browser validation, Obsidian canonical notes.

---

### Task 1: Audit And Stabilize The Repo State

**Files:**
- Modify: `.git/info/exclude`
- Modify: `.claude/launch.json`
- Inspect: `.claude/worktrees/interesting-napier/`
- Inspect: `dist.staged/`

**Step 1: Record the exact current git state**

Run:
`git status --short`
`git branch -vv`
`git remote -v`
`git rev-parse HEAD`
`git log --oneline -15`
`git merge-base HEAD origin/main`
`git rev-list --left-right --count "$(git rev-parse origin/main)...$(git rev-parse HEAD)"`

**Step 2: Create local safety refs before cleanup**

Run:
`git branch safety/feat-verify-panel-ownership-20260413 HEAD`
`git branch safety/main-pre-align-20260413 main`

**Step 3: Exclude local-only artifact paths from status**

Add these lines to `.git/info/exclude`:
`.claude/worktrees/`
`dist.staged/`

**Step 4: Restore accidental tracked-file drift**

Restore `.claude/launch.json` to its `HEAD` contents if it remains an empty accidental truncation.

**Step 5: Classify untracked paths**

- Keep as source/docs: ADR-005, BUG-014..017, `clockAuthority.ts`, new tests, retained plan docs, `merge-dist-lib.mjs`
- Treat as local artifacts: `dist.staged/`
- Treat as local linked worktree: `.claude/worktrees/interesting-napier/`

### Task 2: Commit The Existing Validated Dirty Work In Logical Slices

**Files:**
- Modify: validated source, tests, and docs already present in the working tree

**Step 1: Stage the Verify freshness and merge-dist fallback slice**

Include:
- `packages/rb-apps/src/apps/IdeApp.tsx`
- `packages/rb-apps/src/apps/ide/projectRuntime.ts`
- `packages/rb-apps/src/apps/ide/verifyScenario.ts`
- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/verify/VerifyFirstRunPanel.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/verify/VerifyWaveformPlaceholder.tsx`
- `scripts/merge-dist.mjs`
- `scripts/merge-dist-lib.mjs`
- matching tests and note updates

**Step 2: Run the focused tests for that slice**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifyScenario.test.ts packages/rb-apps/src/apps/ide/__tests__/circuitProjection.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyFirstRunUsability.test.tsx packages/rb-apps/src/__tests__/merge-dist.retry.test.ts`

**Step 3: Commit the slice**

Commit message:
`ide: harden verify freshness and merge-dist fallback`

**Step 4: Stage the shared shell / Verify layout / Design inspector slice**

Include:
- `packages/rb-apps/src/apps/ide/components/IdeSurfaceLayout.tsx`
- `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`
- focused shell/layout/design tests
- matching bug notes and architecture notes

**Step 5: Run the focused tests for that slice**

Run:
`pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.workspaceLayout.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.layout-workflow.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifyCommandBar.actionRowHierarchy.test.tsx`

**Step 6: Commit the slice**

Commit message:
`ide: fix shared shell geometry and clarify verify layout`

### Task 3: Align Local Main Safely

**Files:**
- No source edits expected

**Step 1: Ensure the feature branch working tree is clean**

Run:
`git status --short`

Expected: no tracked modifications; no untracked source/docs except intentionally retained plan files.

**Step 2: Fast-forward local main only**

Run:
`git checkout main`
`git merge --ff-only feat/verify-panel-ownership`

**Step 3: Record the local release SHA**

Run:
`git rev-parse HEAD`
`git log --oneline -3`

### Task 4: Define The Canonical Surface Workflows

**Files:**
- Modify: `03 Architecture/Verify Engine.md`
- Modify: `03 Architecture/Design Surface.md`
- Modify: `03 Architecture/Project Surface.md`
- Modify: closest hardware/export notes
- Modify: `01 Dashboard/RedByte Engineering Brain.md`
- Create or modify: one verify-design relationship note only if no canonical note already covers it

**Step 1: Update each canonical note with operational surface rules**

For each surface document:
- primary purpose
- user goal
- primary inputs and outputs
- primary and secondary actions
- default visible state
- demoted/hidden state
- state-by-state appearance
- required terminology and banned terminology
- confusion modes and handoff to the next surface

**Step 2: Add an explicit Verify-first workflow contract**

Define:
- Observe
- Check outputs
- Compare
- Save as checks
- Generate
- project vectors vs authored cases
- default post-run state
- advanced actions that must be hidden or demoted

### Task 5: Write Failing Tests For The New Product Hierarchy

**Files:**
- Modify: Verify suites
- Modify: Design suites
- Modify: Project/Hardware suites if touched

**Step 1: Add failing tests for the intended default Verify path**

Cover:
- authored stimulus first
- waveform primary truth
- advanced checks/compare not shouting by default
- clearer grouped actions and renamed controls

**Step 2: Add failing tests for Design rail state contracts**

Cover:
- intentional open/closed left rail
- intentional open/closed right rail
- no-selection vs selection vs replay state

### Task 6: Implement The Product Cleanup

**Files:**
- Modify: Verify surface and related command/workbench/layout components
- Modify: Design surface and shell/rail components
- Modify: Project and Hardware surfaces only where the workflow docs reveal contradictions

**Step 1: Simplify Verify visible flow**

- make the default sequence explicit: author -> run -> observe
- demote advanced compare/check controls
- rename confusing terms where required
- reduce cramped toolbar density and duplicate chips

**Step 2: Clarify Design state hierarchy**

- improve left and right rail open/closed states
- tighten no-selection, selection, and replay-active presentation
- reduce noisy inspector/tool chrome

**Step 3: Apply cross-surface terminology cleanup**

- Project acts as front door / next-action authority
- Hardware acts as handoff / readiness sequence
- labels match the defined workflow across surfaces

### Task 7: Validate And Document The Final State

**Files:**
- Modify: `AI_STATE.md`
- Modify: touched canonical notes and dashboard

**Step 1: Run focused suites**

Run the touched Verify, Design, Project, and Hardware suites.

**Step 2: Run build and repo checks**

Run:
`pnpm --filter @redbyte/playground build`
`pnpm repo:status`
`git status -sb`

**Step 3: Browser validation**

Validate on the local preview:
- `/`
- `/?launcher=1`
- Verify default flow
- Verify advanced check/compare discovery path
- Design open/closed rails
- Project front-door clarity
- Hardware readiness sequence if touched

**Step 4: Prepare release handoff**

Report:
- current feature SHA
- local main SHA
- exact commit list added in this phase
- exact push commands required outside this environment