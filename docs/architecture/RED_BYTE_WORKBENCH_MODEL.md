---
doc_status: current
last_validated: 2026-06-19
owner: Connor Angiel
used_by_claude: true
role: RedByte workbench shell and task-plane model
---

# RedByte Workbench Model

Use this doc when changing RedByte shell, surface layout, side tools, task planes, or browser geometry gates. It is a current architecture control layer, not a historical design essay.

## Product Frame

RedByte V1 is a browser-based Basys3 digital-logic lab workbench. The main spine remains:

```text
Project -> Design -> Verify -> Map Pins / Hardware -> Export
```

Import remains a recovery utility. Vivado build, bitstream programming, and board observation remain downstream proof tiers outside browser evidence.

## Shell Contract

The shell must create room for work, not become the work.

- Top bar is compact project identity, route, and build-hash chrome.
- Proof ribbon is compact E0/browser workflow context.
- Left rail is navigation only; it must not duplicate completion status as bulky visible copy.
- In-app mode navigation must remain browser-native enough that Back/Forward restores prior RedByte surfaces instead of leaving the shell.
- Bottom console/status is conditional support chrome. An empty auto console must not reserve layout space.
- Root horizontal overflow is a product defect at supported classroom and desktop viewports.
- Existing local servers are proof only when the visible build hash matches current local HEAD.

## Dual Tool-Window Contract

Side tools support a primary task plane. They do not own the workbench.

- Collapsed side tools use compact horizontal restore controls, not vertical/sideways labels.
- Open side tools remain proportional, readable, and closable.
- Verify's Signals support tool has two different obligations: collapsed must stay compact, and open must be wide enough to read the title, count, actions, and signal list without horizontal clipping.
- Design Library must be wide enough to hold search, category controls, and board-resource chips without horizontal clipping at `1366x768` and `1440x900`.
- Design Inspector must be wide enough for selected-node direct actions and type-swap controls without cramped overlap at `1366x768` and `1440x900`.
- A proportional Design Library is a tool window, not a collapsed rail; the canvas must remain usable beside it.
- Docked tool windows that are part of normal authoring, such as Design Quick Inputs, must remain visible while their longer support lists scroll internally.
- Focused workbench modes should not show both support docks if that squeezes the task plane.
- Design, Verify, Hardware, Export, and Import must keep the main work object visible and usable when a support dock is opened and then closed.

## Task-Plane Contract

Each surface needs one dominant job object and one clear next action in the useful first viewport.

- Project owns start/recover/continue/build choices.
- Design owns circuit graph authoring and direct manipulation.
- A selected Design object must expose the current object's identity plus direct edit controls before lower-priority support details.
- Verify owns stimulus, expected checks, observed evidence, mismatch, and repair.
- Hardware owns board/table binding from project signal to Basys3 resource, package pin, and XDC consequence.
- Export owns package handoff, current trust state, generated artifact inspection, and downstream Vivado instructions.
- Import owns recovery/review/apply utility behavior and fidelity limits.

Cards are allowed for repeated items, focused panels, and modals. Page-level workbench surfaces should not become a stack of decorative cards.

## Import Active-Recovery Rule

Import may teach on first look, but active recovery states must show tools first.

- First-look Import may keep one guided restore path and compact recovery choices.
- After a user chooses Paste HDL, uploads/selects a ZIP path, or opens an unsupported example, the intro shell must collapse into a compact taskbar.
- The editor, warning, review table, or blocked-state evidence must start in the first viewport at classroom and desktop sizes.
- Active Import actions may route Parse HDL, Paste XDC, Apply Pins Only, Review Import, or Start fresh in Design, but they must not replace the active project until the existing review/apply contract is reached.
- No Import layout gate can claim parser breadth, Vivado build proof, board programming proof, or physical observation proof.

## Hardware Board-First Rule

In the normal Logic Gates Map Pins path, the board/table binding task must appear before explanatory chrome.

- The Basys3 board workspace, mapping table, selected row, board resource, package pin, and XDC consequence are first-order.
- A non-action command strip should not sit above the board/table in the normal mapped workbench.
- Resource summaries and catalogs may orient the student, but they must not overlay or block the Basys3 board visual.
- Board-resource summary controls stay in normal document flow and remain interactive.
- Blocked states and no-boundary states may keep command/context copy because the student still needs recovery guidance.
- No browser gate or screenshot can claim Vivado build, bitstream programming, or physical board observation proof.

## Current Gates

The Workbench Reconstruction v1 gate family protects this model:

- `ide:gate:design-library-not-cropped` checks the Design Library is wide enough for visible controls and board-resource chips without horizontal clipping at `1366x768` and `1440x900`.
- `ide:gate:design-tool-window-coexistence` checks Design Library and Inspector remain proportional tool windows while leaving a usable canvas.
- `ide:gate:hardware-board-unblocked` checks Hardware Map Pins keeps the Basys3 board and mapping table separated from resource summary overlays.
- `ide:gate:hardware-resource-catalog-not-obstructing` checks resource summaries/catalogs do not sit on top of board controls.
- `ide:gate:release-readiness-visual-contract` combines the current Design and Hardware release-readiness geometry contract.
- `ide:gate:no-cropped-controls-regression` prevents visible Design/Hardware controls from returning to horizontally cropped states.
- `ide:gate:verify-signals-dock-not-clipped` checks the open Verify Signals dock is readable at `1366x768` and `1440x900` while adjacent side-dock and space-utilization gates keep collapsed Verify compact and the main workbench usable.
- `ide:gate:project-loaded-command-surface`, `ide:gate:import-guided-recovery-wizard`, and `ide:gate:export-package-inspector` check the outer workflow surfaces behave like command, recovery, and package-inspection tools rather than static card stacks.
- `ide:gate:outer-workflow-action-density` and `ide:gate:card-chrome-regression` guard the outer workflow against losing direct actions or regressing into passive card chrome.
- `ide:gate:release-solidification-v1` checks the current release package across Verify open-Signals no-overflow geometry, Export Package / Verify / Pin Mapping / E0 Boundary checklist clarity, and Import selected-source editor plus source-review layout with reload continuity.
- `ide:gate:release-solidification-v2` checks the Project/Verify follow-up release layer: first-launch orientation is integrated and non-blocking, PASS/repair Verify action bands stay visible, and FAIL evidence keeps the lower viewport useful.
- `ide:gate:release-candidate-decision` aggregates the release-candidate closeout checks for active-mode history/reload, Project loaded command-center final pass, Verify evidence clarity final pass, and Node 20 proof status.
- `ide:gate:active-mode-reload-recovery` now checks browser Back/Forward mode history in addition to active mode URL sync and reload recovery.
- `ide:gate:student-task-completion-flow` checks the complete student flow from Project starter through selected-node Design edits, Verify PASS/FAIL/repair/PASS, Hardware mapping visibility, and Export E0 handoff at `1366x768` and `1440x900`.
- `ide:gate:design-inspector-contract`, `ide:gate:design-tool-window-coexistence`, `ide:gate:design-dual-tool-windows`, and `ide:gate:design-workbench-v1` keep the wider Design Inspector proportional while preserving a usable canvas.
- `ide:gate:import-guided-recovery-workflow` checks first-look Import guidance plus active Paste HDL and unsupported-example recovery taskbar/editor/review hierarchy at `1366x768` and `1440x900`.
- `ide:gate:workbench-reconstruction-v1` checks compact shell geometry, cross-surface task-plane visibility, no root overflow, and no console/page errors at `1366x768` and `1440x900`.
- `ide:gate:design-dual-tool-windows` checks Design support tools open, close, and restore without covering the canvas task plane.
- `ide:gate:verify-task-plane-usability` aggregates pre-run, post-run, fail, repair, and reset Verify layout contracts.
- `ide:gate:hardware-board-dominance` checks Hardware Map Pins board/table dominance, selected-row geometry, and E0-only wording.
- `ide:gate:action-first-entry-surfaces` checks Project, Export, and Import entry surfaces keep actions and recovery paths first-order.
- `ide:gate:root-overflow-regression` sweeps the main modes and rejects root horizontal overflow.

Adjacent gates remain active: `ide:gate:shell-navigation-overhaul`, `ide:gate:primary-work-object-dominance`, `ide:gate:nested-scroll-regression`, `ide:gate:workbench-space-utilization`, `ide:gate:hardware-first-viewport`, and the surface-specific Verify/Export/Import/Project gates. `ide:gate:workbench-space-utilization` is also the wide `1920x1080` guard for the Verify task plane; the workspace must not collapse back into a narrow centered cap on large screens.

## Non-Negotiables

- Do not change simulation, Verify result semantics, Compare rules, expected-output meaning, pin mapping semantics, VHDL/XDC/testbench/Tcl/ZIP generation bytes, project data format, import parser/apply behavior, or export goldens in layout-only slices.
- Do not add SaaS/accounts or hosted classroom assumptions to this model.
- Do not weaken browser gates to hide a real layout problem.
- Do not claim E1/E2/E3 proof from browser screenshots, Playwright runs, or generated package inspection.
