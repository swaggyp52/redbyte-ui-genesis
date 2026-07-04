---
doc_status: current
last_validated: 2026-07-04
owner: Connor Angiel
used_by_claude: true
role: RedByte test and gate ownership guide
---

# RedByte Test And Gate Ownership

Use this guide when adding or changing RedByte proof. Tests passing is useful evidence, but each proof layer answers a different question.

## Proof Layers

| Layer | Owns | Best for | Required when |
|---|---|---|---|
| Pure unit/integration tests | deterministic source behavior | runtime state, graph authority, Verify trust, export bytes, import parser, mapping sync | a state transition, generator, parser, or authority function changes |
| Focused browser gate | one rendered workflow invariant | normal student actions, selectors, visible geometry, console/page errors, reload/navigation behavior | a product surface, workbench, mode route, or browser-only trust path changes |
| Classroom gate | required lightweight release confidence | source-delivered classroom flow before push | a hardening slice touches browser behavior, product trust, or any gate-critical path |
| Broad classroom verifier | wider regression breadth | local/nightly confidence and historical contracts | CI/nightly ownership changes or invariant coverage changes |
| Screenshot/audit proof | visual quality and first-viewport hierarchy | product hardening tickets, before/after review, design direction | the complaint is visual, workflow, density, or trust-language based |
| Generated artifact tests | Vivado handoff bytes | VHDL/XDC/testbench/Tcl/ZIP determinism and parity | export generation, aliases, scheduler, mapping, or README/provenance changes |
| Vivado/Basys3 proof | E1/E2/E3 downstream truth | synth/implementation, programming, physical observation | making or renewing hardware readiness claims |

## Current Required Classroom Additions

The following under-the-hood invariant gates are required in both `classroom:gate` and `verify:gates:classroom`:

- `ide:gate:design-canvas-zoom-integrity`
- `ide:gate:project-loaded-command-surface`
- `ide:gate:import-guided-recovery-wizard`
- `ide:gate:export-package-inspector`
- `ide:gate:outer-workflow-action-density`
- `ide:gate:card-chrome-regression`
- `ide:gate:verify-signals-dock-not-clipped`
- `ide:gate:release-solidification-v1`
- `ide:gate:release-solidification-v2`
- `ide:gate:release-candidate-decision`
- `ide:gate:node20-proof-status`
- `ide:gate:authoring-depth-release-safety`
- `ide:gate:design-library-not-cropped`
- `ide:gate:design-tool-window-coexistence`
- `ide:gate:hardware-board-unblocked`
- `ide:gate:hardware-resource-catalog-not-obstructing`
- `ide:gate:release-readiness-visual-contract`
- `ide:gate:no-cropped-controls-regression`
- `ide:gate:import-guided-recovery-workflow`
- `ide:gate:workbench-reconstruction-v1`
- `ide:gate:design-dual-tool-windows`
- `ide:gate:verify-task-plane-usability`
- `ide:gate:hardware-board-dominance`
- `ide:gate:action-first-entry-surfaces`
- `ide:gate:root-overflow-regression`
- `ide:gate:design-canvas-direct-workbench`
- `ide:gate:design-workspace-crash-proof`
- `ide:gate:workbench-stability-overhaul`
- `ide:gate:shell-navigation-overhaul`
- `ide:gate:primary-work-object-dominance`
- `ide:gate:nested-scroll-regression`
- `ide:gate:verify-no-circuit-task-first`
- `ide:gate:project-loaded-paths-first-viewport`
- `ide:gate:verify-postrun-workbench-usability`
- `ide:gate:active-mode-reload-recovery`
- `ide:gate:student-task-completion-flow`
- `ide:gate:design-no-bridge-required`
- `ide:gate:design-workbench-integrity`
- `ide:gate:design-workbench-v1`
- `ide:gate:interaction-affordance`
- `ide:gate:project-identity-editing`
- `ide:gate:side-dock-affordance`
- `ide:gate:open-side-panel-density`
- `ide:gate:workbench-obstruction-usability`
- `ide:gate:export-first-viewport-artifacts`
- `ide:gate:export-artifact-direct-preview`
- `ide:gate:export-handoff-station`
- `ide:gate:export-trust-integrity`
- `ide:gate:hardware-basys3-workbench`
- `ide:gate:hardware-first-viewport`
- `ide:gate:import-recovery-contract`
- `ide:gate:project-command-center`
- `ide:gate:shell-layout-integrity`
- `ide:gate:shell-workbench-hierarchy`
- `ide:gate:workbench-space-utilization`
- `ide:gate:workbench-visual-finish`
- `ide:gate:verify-evidence-workbench`
- `ide:gate:verify-saved-checks-default`
- `ide:gate:verify-testbench-usable-layout`
- `ide:gate:verify-workbench-layout-reset`
- `ide:gate:complex-build-signal-trace-debugging`
- `ide:gate:testbench-editor-and-export-confidence-flow`

Why:

- Design zoom integrity protects the exact blank-canvas / non-finite camera failure class.
- Project loaded command surface protects loaded Project from reverting to a metric-first report page before direct Design / Verify / Map Pins / Export actions.
- Import guided recovery wizard protects Import first-look from reverting to passive recovery prose instead of a staged recovery tool with a no-overwrite boundary.
- Export package inspector protects Export ready state from hiding generated-file inspection behind extra interaction.
- Outer workflow action density protects Project, Import, and Export from losing direct first-viewport commands.
- Card chrome regression protects the current reduction in non-interactive card-like chrome on outer workflow surfaces.
- Verify Signals dock not clipped protects the open Verify Signals rail from returning to the cropped `136px`/`144px` state while adjacent gates keep collapsed Signals compact.
- Release Solidification v1 protects the current Verify / Export / Import release package: open-Signals Verify no-overflow geometry, Export package-readiness checklist, and Import selected-source editor plus review lane with reload continuity.
- Release Solidification v2 protects first-launch Project orientation from blocking starter/launch actions and protects Verify Compare PASS/repair PASS next-action visibility while keeping FAIL evidence usable.
- Release Candidate Decision protects the release-closeout bundle: active-mode reload/history, Project loaded command-center final pass, Verify evidence clarity final pass, and honest Node 20 status.
- Browser E0 Release Proof protects pinned-runtime release confidence: Node `20.19.0` setup/proof status, `build:unified`, release-candidate/final-current gates, authoring/student gates, full `classroom:gate`, docs validation, encoding, diff check, and deployed-SHA proof after push.
- Browser E0 packaging readiness protects package/demo review from drifting into hardware or commercial overclaims by requiring the tracked checklist, Node 20, final/deployed SHA, Cloudflare targets, hardware blockers, commercial blockers, and exact no-overclaim language.
- Node 20 proof status keeps pinned-runtime proof honest by passing under Node `20.19.0` or requiring the release-candidate report to record the exact local blocker when another Node runtime is active.
- Authoring depth release safety protects the repeated-use authoring loop after Build Fresh: Add boundary I/O must leave a direct Add gate/Wire continuation, starter authoring actions must stay usable, reload smoke must stay clean across the main surfaces, and stale builds/dynamic imports/error boundaries/console errors must fail the gate.
- Design library not cropped protects the release-readiness requirement that visible tool controls fit inside the open Library dock at classroom and desktop viewports.
- Design tool-window coexistence protects the Design Library and Inspector from becoming disproportionate panels that starve the canvas.
- Hardware board unblocked protects Map Pins from resource summaries covering the Basys3 board visual.
- Hardware resource catalog not obstructing protects board controls from summary/catalog overlays.
- Release readiness visual contract keeps the current Design/Hardware visual repair together as one classroom product contract.
- No cropped controls regression protects visible Design and Hardware controls from returning to horizontally clipped states.
- Import guided recovery workflow protects active Paste HDL and unsupported-example recovery from reverting to first-look cards above the editor/review work object.
- Workbench reconstruction protects the compact shell/task-plane model across Project, Design, Verify, Hardware, Export, and Import.
- Design dual tool windows protects Design support tools from covering or squeezing the canvas task plane.
- Verify task-plane usability keeps the existing Verify pre-run, post-run, fail, repair, and reset layout gates together as one current task-plane contract.
- Hardware board dominance protects Map Pins from pushing the board/table binding task below non-action chrome.
- Action-first entry surfaces protects Project, Export, and Import from regressing into static card stacks before useful actions.
- Root overflow regression protects the reconstructed shell from returning document-level horizontal overflow in normal modes.
- Design canvas direct workbench protects loaded starter authoring from default zoom HUD/minimap obstruction while preserving on-demand Fit/Center/preset controls.
- Design workspace crash proof protects stale or failed lazy Design surface imports from stranding the user in an error boundary; it requires non-destructive `Reload App` recovery and preserves `Reset Workspace`.
- Workbench stability overhaul protects normal Project -> Design -> Verify -> reload -> Map Pins -> Design continuity after the boundary recovery repair.
- Shell navigation overhaul protects the compact global shell contract, workflow rail reachability, Import utility route/reload access, no root overflow, and console/page cleanliness at classroom and desktop viewports.
- Primary work object dominance protects Design, Verify, Hardware, Export, and Import from being squeezed by simultaneous support docks or shell chrome; focused workbench support docks must be exclusive outside wide layout.
- Nested scroll regression protects Verify and Hardware from small internal scroll traps in the normal Logic Gates path while allowing normal page-level workbench scroll where appropriate.
- Verify no-circuit task-first protects fresh direct Verify entry from showing waveform/testbench or mapping apparatus before a circuit exists; it requires actionable Open Design, Load starter, and Import / Recover paths.
- Project loaded paths first viewport protects loaded Project from pushing Continue, Build Fresh, Course Starter, Import / Recover, and Open Recent below metrics/support content.
- Verify post-run workbench usability protects Compare PASS, induced FAIL, and repair PASS from returning the editable expected-output checks lane to a tiny `460px` slot beside waveform evidence, and from placing the waveform evidence too low or too short in the first viewport.
- Active mode reload recovery protects route/query synchronization after in-app navigation so a visible Design or Verify workspace reloads back to the same workspace.
- Student task completion flow protects the real classroom loop from returning to a non-functional Design inspector: Project starter, selected-node direct edits, Verify PASS/FAIL/repair/PASS, Hardware mapping, and Export E0 handoff must all remain usable at classroom and desktop viewports.
- Design no-bridge required protects the product boundary that Design must load and remain editable without a local bridge agent, even if a prior Hardware visit persisted hardware mode as on.
- Design workbench integrity proves the graph stays visible and mutable through normal student actions.
- Design Workbench v1 proves blank guidance, loaded graph priority, selection, wiring, movement, delete/undo, split/code, and zoom/fit/center at classroom and desktop viewports.
- Interaction affordance proves Project title rename and Workflow Orientation recovery remain visible and functional from normal first-launch use, including cancel/save and reload persistence, and now also proves loaded Project `Flow` help does not cover Project entry paths.
- Project identity editing proves the top-bar, upper Project identity strip, loaded Project title, and adjacent Rename affordances all open meaningful inline rename, with cancel/save, title agreement, starter/source labeling, navigation persistence, and reload persistence at classroom and desktop viewports.
- Side Dock Affordance proves collapsed Design Library/Inspector, Verify Signals, Hardware Inspector, and Export Inspector rails are compact horizontal restore buttons, not sideways labels; it also proves open/close recovery, focal workbench visibility, no root overflow, and no console/page errors at classroom and desktop viewports.
- Open Side Panel Density proves compact Hardware and Export right inspectors remain proportional full-height side tools rather than full-width bottom cards; it also proves workspace height, focal-object visibility, close-to-restore behavior, no root overflow, and no console/page errors at classroom and desktop viewports.
- Workbench Obstruction Usability proves Hardware Map Pins starts with support chrome collapsed away from the board/table, keeps the compact Map restore rail visible, opens left/right support docks proportionally, restores workbench space on close, and rejects root overflow or console/page errors at classroom and desktop viewports.
- Export first-viewport artifact visibility proves the ready-to-build handoff station exposes the concrete generated files students and professors need to inspect before scrolling.
- Export artifact direct preview proves those first-viewport generated-file cues are functional preview controls: button/keyboard reachable, selected-state exposed, and wired to reveal the existing artifact workspace for `top.vhd` and `top.xdc`.
- Export handoff station proves Draft/Ready/Trusted station hierarchy, one repair/build/download primary action, artifact workspace, README E0 boundary, mapping agreement, Vivado next steps, no overclaim, and no overlap/overflow.
- Export trust integrity proves visible generated previews, downloaded ZIP entries, README/provenance, Draft/Trusted labels, and proof-tier language agree for the mapped/verified handoff path.
- Hardware Basys3 workbench proves selected signal -> board resource -> package pin -> XDC hierarchy at classroom/desktop viewports and keeps ready-state copy E0-only.
- Hardware first viewport proves the loaded Logic Gates Map Pins board/table and selected SW0 -> board resource -> package pin -> XDC chain stay high enough in the first viewport at classroom and desktop heights without making E1/E2/E3 claims.
- Import recovery contract proves Project utility discoverability, RedByte manifest restore as highest fidelity, Vivado/VHDL reconstruction limits, corrupt and non-ZIP import safety, source-specific archive failure copy, imported Verify proof invalidation, and no Vivado/hardware overclaim.
- Project command center proves neutral Project launch copy, peer blank/starter/saved/import paths, loaded-project entry paths, and a guarded loaded Build Fresh action.
- Shell layout integrity proves the core Project, Design, Verify, Hardware, and Export surfaces keep a visible work object with no root overflow across classroom/desktop/wide sizes.
- Shell workbench hierarchy proves the global shell has one compact proof/status authority, a support-only footer, rail navigation without visible completion-status copy, and a visible workbench object across Project, Design, Verify, Hardware, Export, and Import.
- Workbench space utilization proves persistent support rails do not squeeze the focal object below useful size, Design and Verify support rails start collapsed/restorable, Project/Export/Import actions remain visible, and cross-surface geometry has no root overflow at classroom/desktop/wide sizes.
- Workbench visual finish proves Import first-look composition has one restore hierarchy, visible recovery alternatives, first-viewport guidance fit, neighboring surface captures, and no root overflow at classroom/desktop/wide sizes.
- Verify evidence workbench proves visible first-run expected-output editing, Observe-only as non-proof trace evidence, Compare PASS, intentional expected-output FAIL, first mismatch expected/observed evidence, waveform controls, repair PASS, and no meaningful evidence-region overlap.
- Complex build signal trace debugging protects the failed Compare -> Inspect Design repair path for a two-stage wrong-build graph, including output context, direct driver facts, bounded upstream trace rows, node Focus actions, no root overflow, and console/page cleanliness.
- Testbench editor and export confidence flow protects the normal student recovery path after wrong expected-output edits: multiple authored cases, Observe/save evidence, multi-output Compare FAIL, scoped Use observed repair, stale testbench evidence, Export stale/draft confidence, Export current browser-E0 confidence, and no E1/E2/E3 overclaim.
- Verify saved-checks default proves starters with saved expected outputs arm Compare before the first run, label the primary action as Compare-oriented, reach Compare PASS without a manual mode switch, and preserve explicit Observe/Compare switching.
- Verify testbench usable layout proves pre-run Verify gives the stimulus/testbench editor the dominant work surface, keeps empty waveform readiness secondary, exposes all starter expected-output cells/case headers, and rejects horizontal testbench overflow at classroom and desktop viewports.
- Verify workbench layout reset proves Compare PASS, intentional FAIL, repair, and final PASS do not collapse the testbench into a horizontally scrolling slot or hide the evidence workflow.

## Choosing The Right Test

| Change type | Minimum local proof |
|---|---|
| Runtime authority, project health, stale/pass/fail, mapping sync | focused Vitest for the authority module plus any existing browser gate affected by the display |
| Mode route, in-app navigation, browser Back/Forward, reload recovery, or stale lazy-surface recovery | `ide:gate:active-mode-reload-recovery`, `ide:gate:design-workspace-crash-proof`, `ide:gate:workbench-stability-overhaul`, plus the affected route/surface gate; add focused unit coverage when boundary classification or startup-mode parsing changes |
| Project command-center, start paths, loaded-project entry paths | `ide:gate:project-command-center`, `ide:gate:project-loaded-paths-first-viewport`, Project screenshots, and existing Project readiness/overview gates |
| Project identity rename, first-run help, loaded Project `Flow` placement, loaded Project workflow-help auto-collapse, or top-bar interaction affordance | `ide:gate:interaction-affordance`, `ide:gate:project-identity-editing`, `ide:gate:release-solidification-v2` when first-launch orientation could block launch actions, Project before/after screenshots, and persistence gate coverage when saved identity or reload behavior changes |
| Design gesture, canvas, zoom, selection, visible graph, blank/partial authoring continuation, selected-object direct edits, no-bridge boundary, Library clipping | `ide:gate:design-workbench-v1`, `ide:gate:design-canvas-direct-workbench`, `ide:gate:design-library-not-cropped`, `ide:gate:design-tool-window-coexistence`, `ide:gate:design-dual-tool-windows`, `ide:gate:student-task-completion-flow`, `ide:gate:authoring-depth-release-safety`, `ide:gate:design-no-bridge-required`, plus focused Design browser gates; add Vitest when source state/error semantics change |
| Verify behavior, run intent, repair loop, testbench layout, scoped expected-output repair, no-circuit entry, Signals rail geometry, Design handoff trace, or post-run next-action visibility | focused runtime tests plus `ide:gate:verify-fail-edit-repair`, `ide:gate:verify-evidence-workbench`, `ide:gate:verify-saved-checks-default`, `ide:gate:verify-no-circuit-task-first`, `ide:gate:verify-testbench-usable-layout`, `ide:gate:verify-workbench-layout-reset`, `ide:gate:verify-postrun-workbench-usability`, `ide:gate:verify-signals-dock-not-clipped`, `ide:gate:wrong-build-diagnosis-repair-flow`, `ide:gate:complex-build-signal-trace-debugging`, `ide:gate:testbench-editor-and-export-confidence-flow`, `ide:gate:release-solidification-v1` when release workbench geometry is involved, `ide:gate:release-solidification-v2` when Project orientation plus Verify next-action visibility are involved, or a narrower new Verify browser gate |
| Export generation bytes | generator tests, golden/hash proof, export e2e/download gates; screenshots are not enough |
| Export trust, visible handoff, confidence station, package inspector, handoff checklist, or artifact affordance | export authority tests plus `ide:gate:export-trust-integrity`, `ide:gate:export-handoff-station`, `ide:gate:testbench-editor-and-export-confidence-flow`, `ide:gate:export-first-viewport-artifacts`, `ide:gate:export-artifact-direct-preview`, `ide:gate:export-package-inspector`, or `ide:gate:release-solidification-v1` proving visible labels, preview, download, station hierarchy, concrete artifact files, direct preview controls, selected package preview, package/Compare/mapping/E0 checklist, and no overclaim |
| Hardware/Map Pins layout, board obstruction, resource catalog placement, or E0 proof wording | `ide:gate:hardware-basys3-workbench`, `ide:gate:hardware-first-viewport`, `ide:gate:hardware-board-dominance`, `ide:gate:hardware-board-unblocked`, `ide:gate:hardware-resource-catalog-not-obstructing`, `ide:gate:workbench-obstruction-usability`, hardware browser screenshots, and mapping tests only if map state changes |
| Import parse/apply behavior | import parser/runtime tests plus `ide:gate:import-recovery-contract` or a narrower zip/import browser gate |
| Import first-look wizard, active recovery presentation, selected-source persistence, editor/review hierarchy, or visible ZIP recovery copy | `ide:gate:import-guided-recovery-wizard`, `ide:gate:import-guided-recovery-workflow`, `ide:gate:import-recovery-contract`, `ide:gate:release-solidification-v1`, Import before/after screenshots, and focused Import Vitest when selector/action contracts or rendered failure-copy classification change |
| Lab profile/course-pack metadata | focused Vitest data contract such as `lab:profile-contract`; add browser proof only when profile data changes rendered workflow |
| Shell, navigation, rail pressure, side-dock affordance, open-panel proportion, empty-state composition, outer workflow card/action density, workbench obstruction, nested-scroll traps, task-plane hierarchy, or first-viewport layout | `ide:gate:workbench-reconstruction-v1`, `ide:gate:design-dual-tool-windows`, `ide:gate:verify-task-plane-usability`, `ide:gate:hardware-board-dominance`, `ide:gate:action-first-entry-surfaces`, `ide:gate:root-overflow-regression`, `ide:gate:shell-navigation-overhaul`, `ide:gate:primary-work-object-dominance`, `ide:gate:nested-scroll-regression`, `ide:gate:shell-layout-integrity`, `ide:gate:shell-workbench-hierarchy`, `ide:gate:workbench-space-utilization`, `ide:gate:side-dock-affordance`, `ide:gate:open-side-panel-density`, `ide:gate:workbench-obstruction-usability`, `ide:gate:workbench-visual-finish`, `ide:gate:outer-workflow-action-density`, `ide:gate:card-chrome-regression`, viewport overflow gate, screenshots at `1366x768`, `1440x900`, `1920x1080` as appropriate |
| Docs/control-only slice | `pnpm rb:doc:validate`, `pnpm rb:encoding:check`, `git diff --check`; no product claim unless source proof exists |
| Release-candidate closeout or pinned-runtime status | `ide:gate:release-candidate-decision`, `ide:gate:node20-proof-status`, `ide:gate:release-final-sha-discipline` after commit/build, `build:unified`, full `classroom:gate` when runtime/time permits, and final deployed-SHA proof before calling the release current |

## Browser Gate Rules

- Always verify the visible build hash before using an existing local server as evidence.
- Final release closeouts that rely on browser proof should run `ide:gate:final-current-build-smoke` after committing and rebuilding so the clean worktree, visible build badge, and `/os/build.json` match current HEAD.
- Release-candidate closeouts should use `ide:gate:release-candidate-decision` before commit and `ide:gate:release-final-sha-discipline` only after a clean final commit/build. The Node status gate is not Vivado or hardware proof.
- Treat `verify:gates:classroom` as broad local/nightly regression breadth, not the final interactive closeout authority. If an outer runner times out, inspect the script and changed gate wiring, run syntax checks, and run the new/affected gates directly; do not record the timeout as either green proof or a product regression without a failing child gate.
- Start from a realistic path: Project load, starter/blank selection, user actions, navigation, reload.
- Prefer stable `data-testid` selectors only when they point to current product objects. Do not preserve retired selector assumptions.
- Assert visible behavior, not only DOM existence. For layout gates, check bounding boxes intersect the viewport.
- Capture console/page errors and reject `NaN`, `Infinity`, and `-Infinity` in console or SVG geometry when geometry matters.
- Keep gates narrow enough to diagnose a failure. Add one broader classroom aggregator only after the focused gate is reliable.
- Do not hide a product issue by weakening a gate. If the issue is real but outside the slice, record it as an audit/issue finding.

## Current Release Readiness Visual Gates

`ide:gate:project-loaded-command-surface` proves loaded Project has a command board with direct mode actions, secondary start/recovery paths, and compact evidence at classroom and desktop viewports; it rejects boxed metric-card stacks inside the loaded command board.

`ide:gate:browser-e0-packaging-readiness` proves `docs/product/RED_BYTE_BROWSER_E0_PACKAGING_CHECKLIST.md` exists and keeps Browser E0 package/demo readiness separate from Vivado/Basys3 E1-E3, final-SHA, deploy, commercial, paid/licensed, and hardware proof claims.

`ide:gate:import-guided-recovery-wizard` proves Import first-look uses a staged recovery wizard and explicit no-overwrite boundary.

`ide:gate:export-package-inspector` proves Export ready state opens with generated-file browser, selected preview, and direct package actions.

`ide:gate:outer-workflow-action-density` and `ide:gate:card-chrome-regression` protect Project, Import, and Export from regressing into passive card/report surfaces.

`ide:gate:verify-signals-dock-not-clipped` proves the open Verify Signals dock is readable at `1366x768` and `1440x900`; `ide:gate:side-dock-affordance` remains the collapsed-rail guard.

`ide:gate:release-solidification-v1` proves the current Verify / Export / Import release package: open-Signals Verify no internal horizontal overflow, usable stimulus and waveform lanes, Export package/Compare/mapping/E0 checklist, Import selected-source editor plus source-review lane, reload continuity, no root overflow, and no console/page errors at `1366x768` and `1440x900`.

`ide:gate:release-solidification-v2` proves the next release-solidification product layer: first-launch Project Workflow Orientation is integrated and does not overlap Build Fresh/starter launch targets, Verify Compare PASS and repair PASS expose the lower next-action band, intentional expected-output FAIL keeps the first failing-check action visible and evidence workspace tall, no root overflow, visible build-hash identity, and no console/page errors at `1366x768` and `1440x900`.

`ide:gate:student-task-completion-flow` proves the current student task path: Project starter, selected Design node direct edits, Verify PASS/FAIL/repair/PASS, Hardware mapping visibility, and Export E0 handoff. It is the regression guard for selected-node Inspector geometry after widening the Design right tool window.

`ide:gate:authoring-depth-release-safety` proves the current repeated-use authoring and release-safety path: Project first-launch rename, Build Fresh, Add boundary I/O, direct Add AND/Wire continuation, Design reload, starter select/duplicate/delete/undo, wire delete/undo, Project continuity, and Verify/Hardware/Export/Import reload smoke with visible build-hash identity, no error boundary, no dynamic-import failure, no root overflow, and no console/page errors at `1366x768` and `1440x900`.

`ide:gate:interaction-affordance` also proves the current loaded Project workflow-help contract: first launch can auto-show integrated help, loaded Project does not auto-show the full Workflow Orientation card after real work exists, `Flow` stays visible for explicit reopen, and reopened help does not overlap loaded Project entry paths at classroom and desktop viewports.

`ide:gate:design-library-not-cropped` proves the Design Library is at least `260px` wide at classroom/desktop viewports, leaves a usable canvas, and keeps visible search/board-resource controls inside the dock.

`ide:gate:design-tool-window-coexistence` proves open Design Library and Inspector states remain proportional tool windows rather than card-like panels that starve the canvas.

`ide:gate:hardware-board-unblocked` proves the Hardware Map Pins board/table task plane is not covered by resource summary cards.

`ide:gate:hardware-resource-catalog-not-obstructing` proves the resource summary/catalog placement stays separate from the Basys3 board controls.

`ide:gate:release-readiness-visual-contract` combines the current Design and Hardware release-readiness visual target.

`ide:gate:no-cropped-controls-regression` sweeps the changed Design and Hardware paths for visible horizontally cropped controls.

## Current Import Guided Recovery Gate

`ide:gate:import-guided-recovery-workflow` proves first-look Import guidance plus active Paste HDL and unsupported-example recovery states at `1366x768` and `1440x900`: visible build hash, compact active taskbar, editor/review or blocker evidence in the first viewport, no lingering first-look shell in active states, preserved review/apply selector contract, no root overflow, no console/page errors, and no browser E1/E2/E3 or Vivado/Basys3 overclaim.

## Current Workbench Reconstruction Gates

`ide:gate:workbench-reconstruction-v1` proves the compact shell/task-plane model across Project, Design, Verify, Hardware, Export, and Import at `1366x768` and `1440x900`: visible build hash, conditional empty-console space ownership, task-plane visibility, no root overflow, and no console/page errors.

`ide:gate:design-dual-tool-windows` proves Design support tools open and close without covering the canvas task plane, and that Quick Inputs remain visible as a docked tool window while palette sections scroll inside the left dock.

`ide:gate:verify-task-plane-usability` runs the current Verify pre-run, post-run, fail/repair, and reset layout gates as one task-plane contract.

`ide:gate:hardware-board-dominance` proves Hardware Map Pins opens the normal mapped workbench with the board/table task plane first-order, selected SW0 geometry visible, no browser E1/E2/E3 overclaim, no root overflow, and no console/page errors.

`ide:gate:action-first-entry-surfaces` proves Project, Export, and Import keep first-viewport actions/recovery paths useful instead of reverting to passive card stacks.

`ide:gate:root-overflow-regression` sweeps the main modes for document-level horizontal overflow after shell/task-plane compaction.

`ide:gate:workbench-space-utilization` remains the wide-viewport guard for this model too; it now protects the Verify workspace from returning to a capped/narrow layout at `1920x1080` after shell compaction.

## Current Design Direct-Workbench Gate

`ide:gate:design-canvas-direct-workbench` loads Logic Gates at `1366x768` and `1440x900`, requires compact View by default, rejects expanded controls or minimap before the student asks for them, proves expand/reclose and zoom preset interaction, rejects root overflow, and fails on console/page errors.

## Current Workbench Stability Gates

`ide:gate:design-workspace-crash-proof` simulates a failed production `DesignSurface-*.js` lazy import, requires `surface-load` boundary classification, proves `Reload App` recovery without clearing saved project state, and rejects unexpected console/page errors. `ide:gate:workbench-stability-overhaul` covers the normal Project -> Design -> Verify -> reload -> Map Pins -> Design path with route/mode, loading, boundary, overflow, and console checks.

## Current Shell And Navigation Gates

`ide:gate:shell-navigation-overhaul` proves the compact shell/navigation contract at `1366x768` and `1440x900`: visible build hash, workflow rail reachability, Import utility route and reload access, compact proof-ribbon/left-rail geometry, no root overflow, and no console/page errors.

`ide:gate:primary-work-object-dominance` proves Design, Verify pre-run, Verify Compare PASS, Hardware, Export, and Import keep the primary work object dominant at classroom and desktop viewports, and that focused workbench support docks are exclusive outside wide layout.

`ide:gate:nested-scroll-regression` rejects the Verify stimulus/waveform and Hardware workbench mini-scroll traps observed in browser-first review while preserving normal page-level workbench scroll.

## Current Core Entry Gates

`ide:gate:verify-no-circuit-task-first` proves fresh direct Verify opens as an actionable no-circuit recovery state at `1366x768` and `1440x900`: task panel visible, Open Design / Load starter / Import Recover actions working, waveform/testbench apparatus hidden, no misleading Hardware/Map Pins/No IO mapping copy, no root overflow, and no console/page errors.

`ide:gate:project-loaded-paths-first-viewport` proves a loaded Project keeps all five action paths in the useful first viewport at `1366x768` and `1440x900`: Continue, Build Fresh, Course Starter, Import / Recover, and Open Recent remain visible; Continue and Import navigate correctly; loaded Build Fresh stays guarded; no root overflow or console/page errors appear.

## Current Verify Layout Gates

`ide:gate:verify-testbench-usable-layout` proves the Logic Gates first-run testbench owns the pre-run Verify workbench at `1366x768` and `1440x900`: `stimulus-focus`, all expected-output cells and case headers visible, no meaningful horizontal grid overflow, no root overflow, and waveform readiness kept secondary until a run exists.

`ide:gate:verify-workbench-layout-reset` proves the same layout contract survives the normal evidence loop at `1366x768`: pre-run, Compare PASS, intentional expected-output FAIL, repair, and final PASS.

`ide:gate:verify-postrun-workbench-usability` proves the post-run evidence loop at `1366x768` and `1440x900`: Compare PASS, induced expected-output FAIL, repair PASS, usable editable checks width/share, visible failure action, waveform evidence minimum width, waveform evidence top offset, viewport-visible chart height, no meaningful stimulus-grid mini-scroll, no root overflow, and no console/page errors.

`ide:gate:complex-build-signal-trace-debugging` proves the failed Compare -> Inspect Design handoff for a scratch two-stage wrong-build graph: failed output, expected/observed values, input vector, direct driver, upstream trace, Focus node behavior, build-hash verification, no root overflow, and no console/page errors at `1366x768` and `1440x900`.

## State Authority Rules

- Runtime state changes belong in `projectRuntime.ts`, `projectHealth.ts`, or `projectWorkflowAuthority.ts`.
- Editor gesture/cache changes belong in `circuitStore.ts`, `DesignSurface.tsx`, or `rb-logic-view`.
- Surface display must read derived authority. It should not create independent PASS, CLEAN, Trusted, mapped, or export-ready claims.
- If a TS/TSX source under `packages/rb-apps/src/**` changes and has a `.js` sibling, keep the JS mirror aligned.

## Closeout Rules

For hardening slices, closeout is not done at local green:

1. Run focused proof and the required aggregate proof for the slice.
2. Update `AI_STATE.md` and the relevant cockpit docs with factual evidence.
3. Stage only the slice files.
4. Commit and push to `origin` unless blocked.
5. Watch GitHub required checks and deploy checks for the pushed commit.
6. Report exact branch, commit, push result, GitHub check result, and production/live impact.

## Current Open Gate Gaps

| Gap | Recommended next gate |
|---|---|
| Fresh Vivado/Basys3 proof is not current in this reset. | Run E1/E2/E3 proof only on a machine with Vivado 2024.2 and Basys3 hardware; update release evidence without promoting browser E0 proof. |

## Attribution

Connor Angiel
