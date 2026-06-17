---
doc_status: current
last_validated: 2026-06-17
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
- `ide:gate:design-canvas-direct-workbench`
- `ide:gate:design-workspace-crash-proof`
- `ide:gate:workbench-stability-overhaul`
- `ide:gate:shell-navigation-overhaul`
- `ide:gate:primary-work-object-dominance`
- `ide:gate:nested-scroll-regression`
- `ide:gate:active-mode-reload-recovery`
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
- `ide:gate:verify-evidence-workbench-integrity`
- `ide:gate:verify-saved-checks-default`
- `ide:gate:verify-testbench-usable-layout`
- `ide:gate:verify-workbench-layout-reset`

Why:

- Design zoom integrity protects the exact blank-canvas / non-finite camera failure class.
- Design canvas direct workbench protects loaded starter authoring from default zoom HUD/minimap obstruction while preserving on-demand Fit/Center/preset controls.
- Design workspace crash proof protects stale or failed lazy Design surface imports from stranding the user in an error boundary; it requires non-destructive `Reload App` recovery and preserves `Reset Workspace`.
- Workbench stability overhaul protects normal Project -> Design -> Verify -> reload -> Map Pins -> Design continuity after the boundary recovery repair.
- Shell navigation overhaul protects the compact global shell contract, workflow rail reachability, Import utility route/reload access, no root overflow, and console/page cleanliness at classroom and desktop viewports.
- Primary work object dominance protects Design, Verify, Hardware, Export, and Import from being squeezed by simultaneous support docks or shell chrome; focused workbench support docks must be exclusive outside wide layout.
- Nested scroll regression protects Verify and Hardware from small internal scroll traps in the normal Logic Gates path while allowing normal page-level workbench scroll where appropriate.
- Active mode reload recovery protects route/query synchronization after in-app navigation so a visible Design or Verify workspace reloads back to the same workspace.
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
- Import recovery contract proves Project utility discoverability, RedByte manifest restore as highest fidelity, Vivado/VHDL reconstruction limits, corrupt import safety, imported Verify proof invalidation, and no Vivado/hardware overclaim.
- Project command center proves neutral Project launch copy, peer blank/starter/saved/import paths, loaded-project entry paths, and a guarded loaded Build Fresh action.
- Shell layout integrity proves the core Project, Design, Verify, Hardware, and Export surfaces keep a visible work object with no root overflow across classroom/desktop/wide sizes.
- Shell workbench hierarchy proves the global shell has one compact proof/status authority, a support-only footer, rail navigation without visible completion-status copy, and a visible workbench object across Project, Design, Verify, Hardware, Export, and Import.
- Workbench space utilization proves persistent support rails do not squeeze the focal object below useful size, Design and Verify support rails start collapsed/restorable, Project/Export/Import actions remain visible, and cross-surface geometry has no root overflow at classroom/desktop/wide sizes.
- Workbench visual finish proves Import first-look composition has one restore hierarchy, visible recovery alternatives, first-viewport guidance fit, neighboring surface captures, and no root overflow at classroom/desktop/wide sizes.
- Verify evidence workbench integrity proves visible first-run expected-output editing, Compare PASS, intentional expected-output FAIL, first mismatch expected/observed evidence, waveform controls, repair PASS, and no meaningful evidence-region overlap.
- Verify saved-checks default proves starters with saved expected outputs arm Compare before the first run, label the primary action as Compare-oriented, reach Compare PASS without a manual mode switch, and preserve explicit Observe/Compare switching.
- Verify testbench usable layout proves pre-run Verify gives the stimulus/testbench editor the dominant work surface, keeps empty waveform readiness secondary, exposes all starter expected-output cells/case headers, and rejects horizontal testbench overflow at classroom and desktop viewports.
- Verify workbench layout reset proves Compare PASS, intentional FAIL, repair, and final PASS do not collapse the testbench into a horizontally scrolling slot or hide the evidence workflow.

## Choosing The Right Test

| Change type | Minimum local proof |
|---|---|
| Runtime authority, project health, stale/pass/fail, mapping sync | focused Vitest for the authority module plus any existing browser gate affected by the display |
| Mode route, in-app navigation, reload recovery, or stale lazy-surface recovery | `ide:gate:active-mode-reload-recovery`, `ide:gate:design-workspace-crash-proof`, `ide:gate:workbench-stability-overhaul`, plus the affected route/surface gate; add focused unit coverage when boundary classification or startup-mode parsing changes |
| Project command-center, start paths, loaded-project entry paths | `ide:gate:project-command-center`, Project screenshots, and existing Project readiness/overview gates |
| Project identity rename, first-run help, loaded Project `Flow` placement, or top-bar interaction affordance | `ide:gate:interaction-affordance`, `ide:gate:project-identity-editing`, Project before/after screenshots, and persistence gate coverage when saved identity or reload behavior changes |
| Design gesture, canvas, zoom, selection, visible graph, no-bridge boundary | `ide:gate:design-workbench-v1`, `ide:gate:design-canvas-direct-workbench`, `ide:gate:design-no-bridge-required`, plus focused Design browser gates; add Vitest when source state/error semantics change |
| Verify behavior, run intent, repair loop, or testbench layout | focused runtime tests plus `ide:gate:verify-fail-edit-repair`, `ide:gate:verify-evidence-workbench-integrity`, `ide:gate:verify-saved-checks-default`, `ide:gate:verify-testbench-usable-layout`, `ide:gate:verify-workbench-layout-reset`, or a narrower new Verify browser gate |
| Export generation bytes | generator tests, golden/hash proof, export e2e/download gates; screenshots are not enough |
| Export trust, visible handoff, or artifact affordance | export authority tests plus `ide:gate:export-trust-integrity`, `ide:gate:export-handoff-station`, `ide:gate:export-first-viewport-artifacts`, or `ide:gate:export-artifact-direct-preview` proving visible labels, preview, download, station hierarchy, concrete artifact files, direct preview controls, and no overclaim |
| Hardware/Map Pins layout or E0 proof wording | `ide:gate:hardware-basys3-workbench`, `ide:gate:hardware-first-viewport`, `ide:gate:workbench-obstruction-usability`, hardware browser screenshots, and mapping tests only if map state changes |
| Import parse/apply behavior | import parser/runtime tests plus `ide:gate:import-recovery-contract` or a narrower zip/import browser gate |
| Lab profile/course-pack metadata | focused Vitest data contract such as `lab:profile-contract`; add browser proof only when profile data changes rendered workflow |
| Shell, navigation, rail pressure, side-dock affordance, open-panel proportion, empty-state composition, workbench obstruction, nested-scroll traps, or first-viewport layout | `ide:gate:shell-navigation-overhaul`, `ide:gate:primary-work-object-dominance`, `ide:gate:nested-scroll-regression`, `ide:gate:shell-layout-integrity`, `ide:gate:shell-workbench-hierarchy`, `ide:gate:workbench-space-utilization`, `ide:gate:side-dock-affordance`, `ide:gate:open-side-panel-density`, `ide:gate:workbench-obstruction-usability`, `ide:gate:workbench-visual-finish`, viewport overflow gate, screenshots at `1366x768`, `1440x900`, `1920x1080` as appropriate |
| Docs/control-only slice | `pnpm rb:doc:validate`, `pnpm rb:encoding:check`, `git diff --check`; no product claim unless source proof exists |

## Browser Gate Rules

- Always verify the visible build hash before using an existing local server as evidence.
- Start from a realistic path: Project load, starter/blank selection, user actions, navigation, reload.
- Prefer stable `data-testid` selectors only when they point to current product objects. Do not preserve retired selector assumptions.
- Assert visible behavior, not only DOM existence. For layout gates, check bounding boxes intersect the viewport.
- Capture console/page errors and reject `NaN`, `Infinity`, and `-Infinity` in console or SVG geometry when geometry matters.
- Keep gates narrow enough to diagnose a failure. Add one broader classroom aggregator only after the focused gate is reliable.
- Do not hide a product issue by weakening a gate. If the issue is real but outside the slice, record it as an audit/issue finding.

## Current Design Direct-Workbench Gate

`ide:gate:design-canvas-direct-workbench` loads Logic Gates at `1366x768` and `1440x900`, requires compact View by default, rejects expanded controls or minimap before the student asks for them, proves expand/reclose and zoom preset interaction, rejects root overflow, and fails on console/page errors.

## Current Workbench Stability Gates

`ide:gate:design-workspace-crash-proof` simulates a failed production `DesignSurface-*.js` lazy import, requires `surface-load` boundary classification, proves `Reload App` recovery without clearing saved project state, and rejects unexpected console/page errors. `ide:gate:workbench-stability-overhaul` covers the normal Project -> Design -> Verify -> reload -> Map Pins -> Design path with route/mode, loading, boundary, overflow, and console checks.

## Current Shell And Navigation Gates

`ide:gate:shell-navigation-overhaul` proves the compact shell/navigation contract at `1366x768` and `1440x900`: visible build hash, workflow rail reachability, Import utility route and reload access, compact proof-ribbon/left-rail geometry, no root overflow, and no console/page errors.

`ide:gate:primary-work-object-dominance` proves Design, Verify pre-run, Verify Compare PASS, Hardware, Export, and Import keep the primary work object dominant at classroom and desktop viewports, and that focused workbench support docks are exclusive outside wide layout.

`ide:gate:nested-scroll-regression` rejects the Verify stimulus/waveform and Hardware workbench mini-scroll traps observed in browser-first review while preserving normal page-level workbench scroll.

## Current Verify Layout Gates

`ide:gate:verify-testbench-usable-layout` proves the Logic Gates first-run testbench owns the pre-run Verify workbench at `1366x768` and `1440x900`: `stimulus-focus`, all expected-output cells and case headers visible, no meaningful horizontal grid overflow, no root overflow, and waveform readiness kept secondary until a run exists.

`ide:gate:verify-workbench-layout-reset` proves the same layout contract survives the normal evidence loop at `1366x768`: pre-run, Compare PASS, intentional expected-output FAIL, repair, and final PASS.

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
