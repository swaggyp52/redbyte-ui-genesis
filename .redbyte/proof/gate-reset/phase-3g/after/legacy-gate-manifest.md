# verify:gates:legacy

- Suite: `verify:gates:legacy`
- Branch: `product/redbyte-trust-reset-v2`
- HEAD: `26de52957cf97400175f1d8cfc0ff0b4a9391e4e`
- Generated: 2026-06-22T05:37:09.285Z
- Result: DIAGNOSTIC ONLY
- Merge requirement: no

These retired V1 diagnostics are not run by default. Each entry must have a current replacement before it can stay retired.

| Gate | Status | Failure Category | Replacement | Reason |
|---|---|---|---|---|
| `classroom:smoke:labs-5-8` | retired-with-replacement | C | `ci:no-solution:lab5`<br>`ci:no-solution:lab6`<br>`ci:no-solution:lab7`<br>`ci:no-solution:lab8`<br>`lab:profile-contract` | Lab 8 bridge no-solution coverage now lives in dedicated no-solution/profile gates; old smoke falsely treats unconnected placeholder gates as a solved scaffold. |
| `ide:gate:route-contract` | retired-with-replacement | D | `ide:gate:active-mode-reload-recovery`<br>`ide:gate:shell-navigation-overhaul` | Hardcoded localhost:5173 route smoke is superseded by dynamic shared-harness route/reload/history coverage. |
| `ide:gate:default-launcher-hidden` | retired-with-replacement | D | `ide:gate:v2-student-chrome`<br>`ide:gate:final-current-build-smoke` | Hardcoded localhost:5173 default-launcher contract targets a retired launcher/chrome path. |
| `ide:gate:layout-contract` | retired-with-replacement | C | `ide:gate:shell-layout-integrity`<br>`ide:gate:v2-student-chrome` | Old rail-width structural contract conflicts with V2 compact shell measurements. |
| `ide:gate:workbench-layout-contract` | retired-with-replacement | C | `ide:gate:shell-workbench-hierarchy`<br>`ide:gate:workbench-reconstruction-v1` | Old contract requires generic left docks in modes where V2 fixed workspaces replaced them. |
| `ide:gate:visual-contract` | retired-with-replacement | C | `ide:gate:v2-student-chrome`<br>`ide:gate:primary-work-object-dominance`<br>`ide:gate:card-chrome-regression` | Old visual contract requires V1 left dock structure and is superseded by V2 visual/work-object gates. |
| `ide:gate:shell-structure` | retired-with-replacement | C | `ide:gate:shell-layout-integrity`<br>`ide:gate:shell-navigation-overhaul` | Old shell structure contract looks for retired mode markers/chrome instead of V2 primitives. |
| `ide:gate:design-build-contract` | retired-with-replacement | C | `ide:gate:design-workbench-integrity`<br>`ide:gate:design-canvas-direct-workbench` | Old Design build gate expects the hidden zoom-stat element as visible proof; V2 proves direct canvas and build readiness elsewhere. |
| `ide:gate:design-workbench-contract` | retired-with-replacement | C | `ide:gate:design-workbench-integrity`<br>`ide:gate:design-tool-window-coexistence` | Old Design workbench gate requires a V1 right-inspector marker instead of the fixed/contextual V2 workbench contract. |
| `ide:gate:design-fit-contract` | retired-with-replacement | C | `ide:gate:design-canvas-direct-workbench`<br>`ide:gate:design-canvas-zoom-integrity` | Old visible fit-control assertion is superseded by direct canvas and zoom-integrity V2 gates. |
| `ide:gate:canvas-legibility-contract` | retired-with-replacement | C | `ide:gate:no-cropped-controls-regression`<br>`ide:gate:design-canvas-direct-workbench` | Old zoom-indicator visibility contract is superseded by no-cropped-controls and direct canvas proof. |
| `ide:gate:verify-workbench-contract` | retired-with-replacement | C | `ide:gate:verify-v2-authority-cutover`<br>`ide:gate:verify-testbench-usable-layout`<br>`ide:gate:verify-workbench-layout-reset`<br>`ide:gate:verify-postrun-workbench-usability`<br>`ide:gate:verify-task-plane-usability` | Old Verify workbench path waits on pre-V2 side/workbench conditions; V2 coverage is split across authority, testbench, postrun, and task-plane gates. |
| `ide:gate:export-blockers-contract` | retired-with-replacement | C | `ide:gate:export-handoff-station`<br>`ide:gate:export-trust-integrity`<br>`ide:gate:export-ready-contract` | Old Export blocker-list assertion targets a retired blocker panel while V2 Export uses handoff/readiness/artifact workspace authority. |
| `ide:gate:hardware-checklist-contract` | retired-with-replacement | C | `ide:gate:hardware-basys3-workbench`<br>`ide:gate:hardware-first-viewport`<br>`ide:gate:hardware-board-unblocked` | Old Hardware checklist panel assertion targets retired panel structure; V2 Map Pins is covered by board/table/resource gates. |
| `ide:gate:primary-cta-contract` | retired-with-replacement | C | `ide:gate:student-task-completion-flow`<br>`ide:gate:action-first-entry-surfaces`<br>`ide:gate:verify-no-circuit-task-first` | Old universal CTA contract is too generic for V2 surface-specific primary actions. |
| `ide:gate:fullscreen-no-chrome` | legacy-diagnostic |  |  | Historical fullscreen chrome diagnostic; not a V2 merge requirement. |
