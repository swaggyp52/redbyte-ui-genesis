# Product Hardening Ticket: Design Split-View Camera Stability

## Ticket

- **Title:** Loaded Design circuit loses visible nodes after Canvas / Code / Split transitions
- **Date:** 2026-07-14
- **Owner:** Connor Angiel
- **Surface:** Design workbench, Canvas / Code / Split views
- **Journey segment:** Load a starter -> edit and inspect the circuit -> compare Canvas and Code in Split -> continue to Verify
- **Mode:** Project-loaded Design, browser E0
- **Environment:**
  - Fresh machine / clean browser profile: clean storage and fresh browser process for each automated gate; existing Windows checkout
  - OS: Windows local proof; Ubuntu 24.04.4 GitHub runner failure
  - Browser: Playwright 1.58.1 / Chromium 145.0.7632.6
  - Node: 20.19.0
  - pnpm: 10.24.0
- **Obsidian note:** Not used; canonical repo docs and untracked local `.redbyte` proof own this recovery
- **Linked GitHub issue:** None; release recovery is anchored to required Actions run `29305203955`, job `86997058794`

## Problem

- **Observed behavior:** The loaded circuit remains intact in runtime/editor state, but switching Canvas -> Code -> Split at `1366x768` can render only two intersecting nodes. The Split pane is visibly narrower than the virtual width supplied to `LogicCanvas`, so camera translation and culling disagree with the real work surface.
- **Expected behavior:** The live canvas must use its truthful visible dimensions. Real host resizes preserve the student's zoom and world-space center; if every node would be stranded, translation restores a real node anchor without inventing a new zoom. Code -> Split must observe the newly mounted canvas host.
- **Why this matters:** A normal student comparison workflow appears to delete or lose circuit work even though project truth is intact. The required Classroom gate failed, so the mainline parent cannot be accepted as a release.
- **Severity:** Release blocker / P1 browser-E0 usability defect

## Reproduction

- **Exact repro steps:**
  1. Start from commit `39b11a6b3a55961d3ea8f16438a4ccc5c613a9be` under Node 20.19.0 and pnpm 10.24.0.
  2. Run `corepack pnpm -s ide:gate:design-workbench-v1` in a fresh process at `1366x768`.
  3. Load the Logic Gates starter, edit/move the graph, select `125%`, switch Canvas -> Code -> Split, and inspect actually intersecting node rectangles.
  4. Observe intermittent `split/code split view: visible nodes disappeared (2)` while runtime/editor node and connection counts remain intact.
- **Reproducibility:** Intermittent: `7/10` fresh unchanged-parent focused-gate processes
- **First known version or date:** Required run on 2026-07-14 for `39b11a6b3a55961d3ea8f16438a4ccc5c613a9be`

## Evidence

- **Screenshot / recording:** Untracked local baseline and after-state PNGs under `.redbyte/design-camera-baseline/` and `.redbyte/product-immersion/design-split-camera-recovery/`
- **Console excerpt:** No product exception; required gate reported `split/code split view: visible nodes disappeared (2)`
- **Test / gate output:** GitHub run `29305203955`, job `86997058794`; local unchanged-parent baseline `3/10` pass and `7/10` fail; final `classroom:gate` passes all steps in `871452ms`
- **Additional artifacts:** Failure JSON/screenshots now write to `.redbyte/ide-design-workbench-v1-failures/`; the workflow uploads that hidden directory on failure with 14-day retention

## Truth Sources

- **Target truth clause(s):** `docs/contracts/RedByte_Product_Contract.md` sections 4.3 and 9.2 require a usable Design surface where moderately complex circuits can be placed, selected, wired, deleted, and undone without frustration.
- **Current truth doc(s):** `docs/manuals/RedByte_Product_Manual.md` sections 7.2 and 8 define Design as the primary visual circuit editor with direct Select / Wire / Undo / Redo / Fit controls and a collapsible library.
- **Gap truth reference(s):** `docs/roadmap/RedByte_Gap_Audit.md` section 4.3 and Phase 5 require runtime-assessed Design legitimacy and correct wire/canvas interaction.
- **System map / ownership reference(s):** `docs/IDE_SYSTEM_MAP.md` assigns canvas-first authoring to `DesignSurface`, camera/selection to the logic-view store, and `ide-design-workbench-v1` to Design browser proof; `docs/ide/SURFACE_CONFORMANCE.md` requires a targeted Design replay with visible authoring behavior.
- **QA / rehearsal clause(s):** `docs/release/manual-assignment-qa-script.md` Phase 2 Design usability; `docs/release/v1-release-checklist.md` browser workflow and required-check proof; `docs/rehearsal/failure-ticket-template.md` exact failure/evidence boundaries.

## Acceptance Proof

- **Minimum acceptance proof:** Exact unchanged-parent red; truthful host/SVG sizing; zoom/world-center preservation; at least three required intersecting nodes and one wire after Code -> Split; exact node move and persistence; selection actions; Library/Inspector transitions; persisted reload; Verify label continuity; no root overflow or browser errors.
- **Required test / gate command(s):**
  - `corepack pnpm exec vitest run packages/rb-apps/src/apps/ide/__tests__/designCanvasCamera.test.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx packages/rb-apps/src/stores/__tests__/circuitStore.canonical.test.ts`
  - `corepack pnpm -s ide:gate:design-camera-stability`
  - `corepack pnpm -s ide:gate:design-workbench-v1`
  - `corepack pnpm -s ide:gate:design-wiring-simplification-flow`
  - `corepack pnpm -s ide:gate:complex-build-signal-trace-debugging`
  - `corepack pnpm -s classroom:gate`
  - `corepack pnpm --filter @redbyte/playground build`
  - `corepack pnpm rb:doc:validate`, `corepack pnpm rb:encoding:check`, gate-script syntax checks, and `git diff --check`
- **Required manual proof:** In-app browser replay at `1366x768`, `1440x900`, `1920x1080`, and `1093x614`; move a node at `125%`; round-trip Code / Split; open/close Library and Inspector; use selected actions; confirm Verify Observe/Compare labels.
- **Screenshot or recording expectation:** Before-state failure evidence plus after-state Split and Verify screenshots stored under untracked local `.redbyte` paths; on future CI failure, upload the diagnostic JSON/PNG bundle.

## Docs Review

- **Docs that must be reviewed if behavior changes:** Product contract, product manual, gap audit, IDE system map, surface conformance, manual assignment QA, V1 release checklist, and failure-ticket template.
- **Docs that must be updated if behavior changes:** `AI_STATE.md`, `docs/ACTIVE_WORK.md`, and this ticket. Product/manual semantics remain unchanged, so no promise expansion is required.

## Disposition

- **Status:** Fixed locally; remote and production acceptance pending
- **Fix PR / commit:** One authorized direct-main recovery commit with message `fix: stabilize Design split view camera`; exact hash is produced only after the final origin-parent guard
- **Notes:** The original three-node/one-wire visibility floor is retained and expanded with geometry, camera, persistence, interaction, reload, and failure-artifact proof. No assertion or hit-test is bypassed. Broad stale inspector assertions and a missing `SchematicView` test import reproduce on the unchanged parent and remain separate debt.

## Out of Scope

- Gate-threshold weakening, assertion removal, synthetic click bypasses, arbitrary sleeps, broad visual rework, simulator/Verify/export semantics, Stage 2, Guided 4-bit, Vivado, Basys3, or E1/E2/E3 proof.

## Attribution

Connor Angiel
