---
doc_status: current
last_validated: 2026-07-15
owner: Connor Angiel
used_by_claude: true
role: RedByte workbench shell and task-plane model
---

# RedByte Workbench Model

Use this doc when changing RedByte shell, surface layout, stable workspace regions, task planes, or browser geometry gates. It is a current architecture control layer, not a historical design essay. Pre-v3 rail, dock-toggle, and disclosure records remain in dated change logs and migrated compatibility gates; they are not the current composition contract.

## Product Frame

RedByte V1 is a browser-based Basys3 digital-logic lab workbench. The main spine remains:

```text
Project -> Design -> Verify -> Map Pins -> Export
```

Import remains a recovery utility. Vivado build, bitstream programming, and board observation remain downstream proof tiers outside browser evidence.

## Shell Contract

The shell must create room for work, not become the work.

- Top bar is compact product/project identity, board target, save state, Import / Recover utility, and Help.
- Exactly five horizontal stages provide Project -> Design -> Verify -> Map Pins -> Export navigation with current/complete/attention/blocked state.
- Import is a top-bar recovery utility, not a sixth numbered stage.
- In-app mode navigation must remain browser-native enough that Back/Forward restores prior RedByte surfaces instead of leaving the shell.
- No proof ribbon, permanent workflow rail, onboarding overlay, injected product-spine header, or permanent footer/status console may compete with the active workspace.
- Surface execution, repair, readiness, and result actions remain inside the surface that owns them.
- Root horizontal overflow is a product defect at supported classroom and desktop viewports.
- Existing local servers are proof only when the visible build hash matches current local HEAD.

## Stable Surface-Region Contract

Support regions make the primary work object usable. Students do not manage the basic layout.

- Design keeps a stable `200-220px` component library, flexible dominant canvas, and `240-280px` inspector at desktop widths. Constrained widths move selected details below the canvas automatically.
- Verify keeps explicit testbench documents/editor, one run-control authority, and waveform/results in one stable Simulation Studio. It must not depend on a collapsible Signals rail or nested essential disclosure.
- Map Pins keeps the assignment table primary, the selected-signal editor stable, and the board reference secondary.
- Export keeps one handoff decision plus a stable file list/selected preview when a package is meaningful.
- Import uses one horizontal Upload -> Review -> Apply recovery sequence without an internal workflow rail.
- Core work does not use student-managed hide/show controls, floating edge toggles, or `<details>` / `<summary>` disclosure for essential actions or evidence.
- Required action centers remain pointer-hittable and keyboard reachable; exactly one `main` landmark owns the surface; the circuit canvas has an accessible name.
- Essential text stays at least `14px`, supporting/metadata text at least `13px`, routine targets at least `36px`, and primary actions at least `40px`.

## Task-Plane Contract

Each surface needs one dominant job object and one clear next action in the useful first viewport.

- Project owns start/recover/continue/build choices. Loaded Project presents identity, Design, Verify, Map Pins, Export, blocker, and one recommendation as a textual engineering overview rather than a command-board/card stack.
- Design owns circuit graph authoring and direct manipulation.
- A selected Design object must expose the current object's identity plus direct edit controls before lower-priority support details.
- Verify owns stimulus, expected checks, observed evidence, mismatch, and repair.
- Hardware owns board/table binding from project signal to Basys3 resource, package pin, and XDC consequence.
- Export owns package handoff, current trust state, generated artifact inspection, and downstream Vivado instructions.
- Import owns recovery/review/apply utility behavior and fidelity limits.

Cards are allowed for repeated items, focused panels, and modals. Page-level workbench surfaces should not become a stack of decorative cards.

## Import Active-Recovery Rule

Import may teach on first look, but its current recovery sequence remains explicit and state-preserving.

- Upload is the first step, with one primary ZIP chooser and Paste HDL/sample paths secondary.
- Review shows detected identity, design summary, ports/mappings, warnings, fidelity limits, and replacement consequences.
- Apply requires explicit confirmation. Cancel preserves current work; invalid input produces a durable error and no current-work mutation.
- The active editor, warning, review table, or blocked-state evidence must start in the useful first viewport at classroom and desktop sizes.
- Import actions must not replace the active project until the review/apply contract is reached.
- No Import layout gate can claim parser breadth, Vivado build proof, board programming proof, or physical observation proof.

## Hardware Board-First Rule

In the normal Logic Gates Map Pins path, the mapping table and selected-signal repair task must appear before explanatory chrome.

- The progress header, mapping table, selected row, board resource, package pin, and XDC consequence are first-order.
- The Basys3 board remains visible at a useful but secondary scale and must not displace the table/editor assignment loop.
- Compatible board resources may assign the selected row; occupied or incompatible resources are visibly disabled.
- Conflicts are explained inline beside affected rows with direct remap/clear actions.
- Blocked states and no-boundary states may keep command/context copy because the student still needs recovery guidance.
- No browser gate or screenshot can claim Vivado build, bitstream programming, or physical board observation proof.

## Current Gates

`ide:gate:unified-workbench-v3-flow` is the primary composition gate. It covers the product bar, horizontal five-stage navigator, absent rail/disclosure/toggle architecture, stable surface work objects, size floors, root/internal clipping, nominal-center hitability, one `main`, named canvas, four viewport conditions, and browser errors. Focused component tests and independent reachability artifacts separately cover keyboard activation, post-run result announcement, and deliberate focus.

The surviving Workbench Reconstruction gate family is migrated compatibility coverage for this model:

- `ide:gate:design-library-not-cropped` checks the Design Library is wide enough for visible controls and board-resource chips without horizontal clipping at `1366x768` and `1440x900`.
- `ide:gate:design-tool-window-coexistence` checks the stable Design Library and Inspector remain proportional while leaving a usable canvas.
- `ide:gate:hardware-board-unblocked` checks Map Pins keeps the secondary Basys3 board clear of the primary mapping table/editor.
- `ide:gate:hardware-resource-catalog-not-obstructing` checks resource summaries/catalogs do not sit on top of board controls.
- `ide:gate:release-readiness-visual-contract` combines the current Design and Hardware release-readiness geometry contract.
- `ide:gate:no-cropped-controls-regression` prevents visible Design/Hardware controls from returning to horizontally cropped states.
- `ide:gate:verify-signals-dock-not-clipped` retains its historical name but now checks the readable Verify signal support lane at `1366x768` and `1440x900` without requiring a collapsed/open dock workflow.
- `ide:gate:project-loaded-command-surface`, `ide:gate:import-guided-recovery-wizard`, and `ide:gate:export-package-inspector` check the outer workflow surfaces behave like command, recovery, and package-inspection tools rather than static card stacks.
- `ide:gate:outer-workflow-action-density` and `ide:gate:card-chrome-regression` guard the outer workflow against losing direct actions or regressing into passive card chrome.
- `ide:gate:release-solidification-v1` checks the current release package across Verify signal/evidence no-overflow geometry, Export handoff clarity, and Import selected-source review layout with reload continuity.
- `ide:gate:release-solidification-v2` checks the Project/Verify follow-up release layer: predecessor onboarding/orientation chrome is absent, PASS/repair Verify actions stay visible, and FAIL evidence keeps the lower viewport useful.
- `ide:gate:release-candidate-decision` aggregates the release-candidate closeout checks for active-mode history/reload, Project loaded command-center final pass, Verify evidence clarity final pass, and Node 20 proof status.
- `ide:gate:browser-e0-packaging-readiness` checks the Browser E0 packaging checklist exists and preserves final-SHA, Cloudflare, commercial, hardware, and no-overclaim boundaries before package/demo review.
- `ide:gate:active-mode-reload-recovery` now checks browser Back/Forward mode history in addition to active mode URL sync and reload recovery.
- `ide:gate:student-task-completion-flow` checks the complete student flow from Project starter through selected-node Design edits, Verify PASS/FAIL/repair/PASS, Map Pins visibility, and Export E0 handoff at `1366x768` and `1440x900`.
- `ide:gate:design-inspector-contract`, `ide:gate:design-tool-window-coexistence`, `ide:gate:design-dual-tool-windows`, and `ide:gate:design-workbench-v1` keep the stable Design Inspector proportional while preserving a usable canvas.
- `ide:gate:import-guided-recovery-workflow` checks first-look Import guidance plus active Paste HDL, invalid-input recovery, and review/apply hierarchy at `1366x768` and `1440x900`.
- `ide:gate:workbench-reconstruction-v1` checks compact shell geometry, cross-surface task-plane visibility, no root overflow, and no console/page errors at `1366x768` and `1440x900`.
- `ide:gate:design-dual-tool-windows` retains migrated geometry obligations for the stable Design library/canvas/inspector regions without restoring student-managed hide/show controls.
- `ide:gate:verify-task-plane-usability` aggregates pre-run, post-run, fail, repair, and reset Verify layout contracts.
- `ide:gate:hardware-board-dominance` checks Map Pins table/editor dominance, secondary board geometry, selected-row behavior, and E0-only wording.
- `ide:gate:action-first-entry-surfaces` checks Project, Export, and Import entry surfaces keep actions and recovery paths first-order.
- `ide:gate:root-overflow-regression` sweeps the main modes and rejects root horizontal overflow.

Adjacent gates remain active: `ide:gate:shell-navigation-overhaul`, `ide:gate:primary-work-object-dominance`, `ide:gate:nested-scroll-regression`, `ide:gate:workbench-space-utilization`, `ide:gate:hardware-first-viewport`, and the surface-specific Verify/Export/Import/Project gates. `ide:gate:workbench-space-utilization` is also the wide `1920x1080` guard for the Verify task plane; the workspace must not collapse back into a narrow centered cap on large screens.

## Non-Negotiables

- Do not change simulation, Verify result semantics, Compare rules, expected-output meaning, pin mapping semantics, VHDL/XDC/testbench/Tcl/ZIP generation bytes, project data format, import parser/apply behavior, or export goldens in layout-only slices.
- Do not add SaaS/accounts or hosted classroom assumptions to this model.
- Do not weaken browser gates to hide a real layout problem.
- Do not claim E1/E2/E3 proof from browser screenshots, Playwright runs, or generated package inspection.
