---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: RedByte product invariant and gate ownership matrix
---

# RedByte Invariant Matrix

This matrix maps product invariants to concrete proof. If an invariant has only a screenshot or only a unit test, say that plainly and add the missing gate before claiming full coverage.

Base audited for this matrix: `d235823a` on `main`; Export Trust Integrity proof was added from the later `fdd1abd` base, Verify Evidence Workbench proof was added from the later `fdf17b7` base, Shell Workbench Hierarchy proof was added from the later `9a5fb0b` base, Project Command Center proof was added from the later `3b55d92` base, Export Handoff Station proof was added from the later `06bbb6a` base, Hardware / Basys3 Workbench proof was added from the later 2026-06-14 local hardware slice, Design Workbench v1 proof was added from the later `7bb1a00` base, Import / Recovery proof was added from the later 2026-06-14 local import slice, Lab Profile / Course Pack Data Seam proof was added from the later 2026-06-14 local lab-profile slice, Design No-Bridge Required proof was added from the later 2026-06-14 local boundary slice, Workbench Space Utilization / Rail Collapse v1 proof was added from the later 2026-06-14 local layout slice, Workbench Visual Finish / Import Empty-State Composition v1 proof was added from the later 2026-06-15 local visual-finish slice, Active Mode Reload Recovery v1 proof was added from the later 2026-06-15 local routing slice and strengthened by the later 2026-06-19 release-candidate mode-history slice, Verify Saved Checks Default / Compare Intent v1 proof was added from the later 2026-06-15 local Verify run-intent slice, Hardware First Viewport proof was added from the later 2026-06-15 local Hardware hierarchy slice, Export First-Viewport Artifact Visibility proof was added from the later 2026-06-16 local Export slice, Project Interaction Affordance proof was added from the later 2026-06-16 local Project interaction slice and strengthened by the later Workflow Orientation Integrated and release-candidate loaded Project auto-collapse slices, Project Identity Editing proof was added from the later 2026-06-16 local Project identity slice, Side Dock Affordance proof was added from the later 2026-06-16 local shell/rail slice, Open Side Panel Density proof was added from the later 2026-06-16 local shell/panel slice, Export Artifact Direct Preview proof was added from the later 2026-06-16 local Export direct-manipulation slice, Workbench Obstruction Usability proof was added from the later 2026-06-16 local Hardware/workbench obstruction slice, Design Canvas Direct Workbench proof was added from the later 2026-06-16 local Design direct-workbench slice, Workbench Stability Overhaul proof was added from the later 2026-06-16 local surface-load recovery slice, Verify Workbench Rebuild proof was added from the later 2026-06-17 local Verify layout slice, Shell and Navigation De-Scaffold proof was added from the later 2026-06-17 local shell/navigation slice, Verify Post-Run Workbench Usability proof was added from the later 2026-06-17 local Verify post-run layout slice and strengthened by the later 2026-06-20 Browser E0 Verify Evidence Density proof, Core Product Acceleration Sprint 2 proof was added from the later 2026-06-17 local Verify/Project task-first entry slice, Workbench Reconstruction v1 proof was added from the later 2026-06-18 local shell/task-plane slice, Import Guided Recovery Workflow proof was added from the later 2026-06-18 local Import active-recovery slice, Release Readiness Tool Windows proof was added from the later 2026-06-18 local visual reconstruction slice, Release Solidification v1 proof was added from the later 2026-06-18 local Verify/Export/Import workbench slice, Student Task Completion / Design Direct Edits proof was added from the later 2026-06-19 local student-flow slice, Release Solidification v2 proof was added from the later 2026-06-19 local Project/Verify action-visibility slice, Authoring Depth + Release Safety proof was added from the later 2026-06-19 local repeated-use authoring slice, Release Candidate Decision proof was added from the later 2026-06-19 mode-history / Node-status slice, and Project Loaded Command Center + Browser E0 Packaging Readiness proof was added from the later 2026-06-20 local packaging-readiness slice.

Product Trust Reset v2 note: the V2 branch adds a new invariant target that normal student UI must not expose raw build hashes, E0/E1/E2/E3 proof labels, or generic side-rail controls, and that Verify must separate observed, expected, locked course checks, student-authored checks, stale, PASS, FAIL, repair semantics, and sequential timing authority. Phase 2 implements the student-chrome half with `ide:gate:v2-student-chrome`; Phase 3 adds the pure Verify truth-state foundation; Phase 3B adds the runtime adapter/selector boundary with `verify:truth-integration-gate`; Phase 3C cuts rendered Verify Course/My check authority plus Project/Export readiness over to that model with `ide:gate:verify-v2-authority-cutover`; Phase 3D adds rendered stale reason, selected-failure repair, and timing-label proof with `ide:gate:verify-authority-phase-3d`; Phase 3E adds sequential timing stale proof with `ide:gate:verify-sequential-authority-v2`; Phase 3F adds Verify accessibility/keyboard/zoom proof, project durability/corrupt-storage/multi-tab proof, Diagnostics support-bundle proof, and 30-context browser classroom rehearsals; Phase 3G adds manifest-backed gate authority so required, broad, retired, and legacy diagnostic gates are explicit; Phase 3H adds browser-local project storage facade, journal, last-known-good, recovery points, quota recovery UI, dirty update guard, diagnostics storage fields, recovery accessibility proof, and Phase 3H storage-wave rehearsal evidence; Phase 3I adds `gate:project-storage-authority`, current-build assertions in the rehearsal, and `rehearsal:classroom-fault-injection` to prove the rehearsal fails on wrong-build, error-boundary, authority-mutation, stale-trust, state-leak, and reload-error classes. V1 gates that prove old structures are legacy unless rewritten for the V2 primitive model listed in `docs/development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md`.

## Gate Ownership Summary

| Gate / test layer | Owns | Use it for | Do not use it for |
|---|---|---|---|
| Vitest runtime tests | deterministic state, derived authority, export bytes, pure logic | hashes, stale/pass/fail rules, generator contracts | rendered first-viewport layout |
| Focused Playwright gate | one user journey or surface contract | browser behavior, selectors, layout geometry, console errors | Vivado or hardware claims |
| `classroom:gate` | required lightweight classroom truth | source-delivered classroom confidence before push | exhaustive visual review |
| `verify:gates:classroom` | broader local/nightly classroom sweep | regression breadth and legacy contracts | fast closeout only |
| Manual/audit screenshots | visual hierarchy and product trust review | product hardening tickets, first-viewport evidence | state semantics or generated byte correctness |
| Vivado/Basys3 evidence | E1/E2/E3 hardware tiers | synthesis, implementation, programming, observation | browser-only readiness |

## Invariants

| ID | Invariant | Owner subsystem | Existing proof | Added / current proof | Missing proof or risk | Severity |
|---|---|---|---|---|---|---|
| RB-INV-001 | The app boots to the intended IDE mode and route marker matches the visible surface. | App boot/routing | route/layout gates | covered by `ide:gate:shell-layout-integrity` mode sweep and `ide:gate:active-mode-reload-recovery` for Project-starter and left-rail mode URL sync, reload recovery, and browser Back/Forward mode history | none current for Project / Design / Verify mode history; broaden if Import utility history or deep-link routes change | P1 |
| RB-INV-002 | A stale local dev server must not be used as current proof unless the visible build hash matches HEAD. | Proof process | prior audits and AI_STATE entries | normal-use audit records `Buildd235823` on fresh `127.0.0.1:5175` | keep checking before screenshots | P1 |
| RB-INV-003 | The shell must not create horizontal root overflow at supported classroom/desktop/wide viewports. | Shell/workbench | viewport overflow and visual-system gates | `ide:gate:shell-layout-integrity` checks root width in Project, Design, Verify, Hardware, Export at 3 viewports; `ide:gate:shell-workbench-hierarchy` also checks Project, Design, Verify, Hardware, Export, and Import at the classroom viewport; `ide:gate:shell-navigation-overhaul` and `ide:gate:nested-scroll-regression` extend the classroom/desktop overflow contract while preserving Import as a utility route | none current for the covered browser shell paths | P1 |
| RB-INV-004 | Each primary surface must expose a visible first-viewport focal object without competing shell status authorities. | Shell/surfaces | visual audits and surface gates | `ide:gate:shell-workbench-hierarchy` proves compact proof ribbon/evidence, support-only footer, rail labels without `OK` status copy, workbench top at the compact shell boundary, and visible focal objects across Project, Design, Verify, Hardware, Export, and Import; `ide:gate:workbench-space-utilization` proves the primary work object owns meaningful space at `1366x768`, `1440x900`, and `1920x1080`; `ide:gate:primary-work-object-dominance` proves Design, Verify, Hardware, Export, and Import keep the main object dominant after the shell/navigation de-scaffold pass; `ide:gate:workbench-visual-finish` proves Import first-look has one restore headline, visible recovery alternatives, first-viewport guidance fit, and no duplicate command strip at the same viewport set; `ide:gate:import-guided-recovery-workflow` proves active Import Paste HDL and unsupported-example states replace intro chrome with a compact taskbar and keep editor/review work objects in the first viewport; `ide:gate:project-command-center` proves the Project first-launch command center fits the classroom viewport; `ide:gate:project-loaded-command-surface` proves loaded Project keeps identity, current next action, direct route actions, secondary starts/recovery, and compact evidence without boxed metric-card stacks; `ide:gate:export-handoff-station` proves one visible Export station and no Export key-region overlap; `ide:gate:export-first-viewport-artifacts` proves concrete generated artifact files are visible inside the ready-to-build Export handoff station at classroom and desktop sizes; `ide:gate:design-workbench-v1` proves Design canvas/graph priority at classroom and desktop viewports; `ide:gate:design-canvas-direct-workbench` proves Design support chrome is compact by default and keeps the loaded graph unobstructed until the student opens View tools; `ide:gate:hardware-first-viewport` proves Hardware Map Pins keeps the board/table and selected binding chain high enough in the first viewport at classroom and desktop sizes; `ide:gate:import-recovery-contract` proves the Import utility/recovery first look and representative review states at classroom/desktop viewports | broader Project/Verify visual maturity remains product-owner review, not a missing invariant for this loaded Project card regression | P1 |
| RB-INV-005 | Loaded starter circuit nodes and wires must remain visible after zoom, Fit, Center, resize, navigation, and reload. | Design canvas | design canvas zoom integrity | `ide:gate:design-workbench-integrity` extends movement/delete/undo/view-mode coverage; `ide:gate:design-workbench-v1` proves loaded starter graph visibility and zoom/fit/center states at `1366x768` and `1440x900`; `ide:gate:design-canvas-direct-workbench` proves the same loaded starter starts without expanded zoom HUD or minimap obstruction and still supports on-demand zoom preset / fit controls | none current for starter graph visibility | P1 |
| RB-INV-006 | Canvas camera and SVG attributes must stay finite. | Logic view | design canvas zoom integrity | design workbench integrity also checks finite runtime/editor graph after edit | none current | P1 |
| RB-INV-007 | Design select/drag/delete/undo must mutate the same project graph authority and expose readable selected-object direct edits. | Design interaction/history | projectRuntime history tests, design gates | design workbench integrity deletes one visible node and verifies undo restore; `ide:gate:design-workbench-v1` covers selected node, selected wire, moved node, delete, and undo restore; `ide:gate:student-task-completion-flow` proves selected-node direct edit geometry and continues through Verify, Hardware, and Export | redo is covered by runtime tests, not browser integrity gate | P1 |
| RB-INV-008 | Wiring cancellation and view mode toggles must not corrupt graph state. | Design interaction | wire interaction and design workbench contract | design workbench integrity checks graph after view toggles/navigation; `ide:gate:design-workbench-v1` covers wire start/cancel plus split/code mode | future from-scratch integrity can broaden | P2 |
| RB-INV-009 | Circuit edits must stale previous Verify and Export trust. | Runtime/project health | projectRuntime and projectWorkflowAuthority tests | covered indirectly by classroom and fail-edit-repair gates | no new source changes this slice | P1 |
| RB-INV-010 | Observe-only output is not equivalent to Compare PASS. | Verify | verify contract/reality tests | normal-use audit exercised Observe then Compare; `ide:gate:verify-saved-checks-default` proves saved-check starters arm Compare by default while still allowing an explicit Observe-only switch | no new risk for the covered starter path | P1 |
| RB-INV-011 | Expected-output edits stale old PASS, can create intentional FAIL, and can be repaired to PASS. | Verify expected grid | `ide:gate:verify-fail-edit-repair`; workflow tests | `ide:gate:verify-evidence-workbench-integrity` also proves visible first-run editing, intentional FAIL, first mismatch expected/observed evidence, and repair PASS | none current for the covered starter path | P1 |
| RB-INV-012 | PASS/FAIL/STALE must be derived from the same circuit/vector/mapping state. | Project health/trust | projectWorkflowAuthority tests | classroom gate includes verify and export checks | no additional invariant gate added here | P1 |
| RB-INV-013 | Waveform and mismatch UI explain Verify proof but do not own trust. | Verify waveform | verify workbench/summary gates | `ide:gate:verify-evidence-workbench-integrity` checks waveform/mismatch visibility and no meaningful overlap in PASS, FAIL, and repaired PASS states; `ide:gate:verify-testbench-usable-layout` proves the empty pre-run waveform placeholder stays secondary to the stimulus/testbench work surface; `ide:gate:verify-workbench-layout-reset` proves waveform/stimulus geometry remains usable through PASS, intentional FAIL, repair, and final PASS; `ide:gate:verify-postrun-workbench-usability` proves post-run waveform evidence remains wide enough, starts high enough, and exposes useful viewport-visible chart height while the editable checks lane is no longer trapped at `460px` | broader Design/Verify visual hierarchy work remains surface-specific, not Verify semantics | P2 |
| RB-INV-014 | Hardware mapping V2 and flat project IO rows must remain synchronized. | Hardware mapping | mapping authority/editor/bridge tests; hardware gates | normal-use audit mapped pins and checked board/table alignment; `ide:gate:export-trust-integrity` checks Export mapped count against XDC rows; `ide:gate:hardware-basys3-workbench` proves the selected visible signal -> board resource -> package pin -> XDC chain without changing mapping semantics; `ide:gate:hardware-first-viewport` proves the same selected chain remains first-viewport content after layout tightening | none current for mapped Export summary agreement | P1 |
| RB-INV-015 | Board wording must not imply E1/E2/E3 proof from browser evidence. | Hardware/Export/package readiness copy | release docs, visual audits | normal-use audit saw no Vivado overclaim in Export; `ide:gate:export-handoff-station` proves Export labels E1/E2/E3 external/manual and does not claim browser success for them; `ide:gate:hardware-basys3-workbench` proves Hardware ready state says E0 only and keeps Vivado build/programming/observation external; `ide:gate:browser-e0-packaging-readiness` requires the tracked Browser E0 packaging checklist to separate Browser E0, final/deployed SHA proof, commercial blockers, hardware blockers, and exact no-overclaim language | none current for the browser Hardware/Export/package-readiness path | P1 |
| RB-INV-016 | Export Draft is allowed but must be visibly distinct from Trusted/current E0-ready export. | Export trust | export ready/blockers/download/e2e gates; workflow tests | `ide:gate:export-trust-integrity` proves READY/Trusted path labels, README proof-tier language, and no E1/E2/E3 browser overclaim; `ide:gate:export-handoff-station` proves Draft/Needs Review does not look package-ready and Trusted keeps build/download as the primary station action | none current for the covered Export station path | P1 |
| RB-INV-017 | Export generated artifact list, preview, downloaded ZIP, and generated bytes should agree. | Export artifacts | export artifact explorer/download/e2e/golden tests | `ide:gate:export-trust-integrity` proves visible generated preview, downloaded ZIP entries, preview body parity, README/provenance, XDC mapped row count, and `EXPECTED_IO.json` output evidence; `ide:gate:export-first-viewport-artifacts` proves `README.txt`, `top.vhd`, `top.xdc`, `testbench.vhd`, and `vivado_import.tcl` are visible in the ready-to-build handoff station before the full artifact explorer; `ide:gate:export-artifact-direct-preview` proves first-viewport generated-file cues select and reveal the existing preview for `top.vhd` and `top.xdc` without changing generated bytes | no fresh Vivado proof | P1 |
| RB-INV-018 | Generated VHDL/XDC/testbench/Tcl changes require generator/golden proof, not visual proof. | Export generation | golden export and vivado artifact tests | unchanged in this slice | no fresh Vivado proof | P1 |
| RB-INV-019 | Import must not replace the active project before review/apply. | Import | Import surface tests, zip import gates | `ide:gate:import-recovery-contract` proves corrupt manifest ZIP failure does not replace the active Logic Gates project and manifest restore still requires Review Import plus Confirm Replace Project; `ide:gate:import-guided-recovery-workflow` preserves the same active taskbar review/apply contract while changing only presentation hierarchy | arbitrary unsupported user files remain parser-specific future coverage | P2 |
| RB-INV-020 | Import access must match docs and product contract. | Import/product control | manual and V1 docs disagree with current loaded Project visibility | `ide:gate:project-command-center` and `ide:gate:import-recovery-contract` prove Import / Recover is visible from first-launch and loaded Project command centers and opens the utility route | none current for representative manifest/corrupt paths | P2 |
| RB-INV-021 | Starter examples must not leak blocked solution content. | Examples/no-solution | no-solution gates, examples contract | classroom gate still includes examples/no-solution layers | no new risk | P1 |
| RB-INV-022 | Lab profile/course pack data must remain metadata and must not move Basys3, Verify, mapping, export, or proof-tier semantics out of core product authority. | Product architecture | work queue and V1 execution program | `lab:profile-contract` proves deterministic profile data, existing starter references, course/runtime separation, IO/export/proof validation, and Lab 8 no-solution rejection | deeper course-pack authoring and runtime enforcement remain future work | P2 |
| RB-INV-023 | Persistence must not resurrect stale trusted proof after reload. | Runtime persistence | persistence tests/gate; projectRuntime persistence | normal-use audit included reload persistence | browser gate does not exhaust every mutation sequence | P1 |
| RB-INV-024 | Browser gates must use current selectors and current user flows. | Gate harness | recent gate repairs | new shell/design integrity gates use visible runtime assertions | selector drift remains an ongoing risk | P1 |
| RB-INV-025 | `classroom:gate` must include trust-critical lightweight browser gates. | CI/Classroom | classroom gate script | includes Release Solidification v1, Outer Workflow Command Surfaces + Verify Signals Dock, Release Readiness Tool Windows, Import Guided Recovery Workflow, Workbench Reconstruction v1, Design Dual Tool Windows, Verify Task Plane Usability, Hardware Board Dominance, Action-First Entry Surfaces, Root Overflow Regression, Verify No-Circuit Task First, Project Loaded Paths First Viewport, Verify Post-Run Workbench Usability, Shell Navigation Overhaul, Primary Work Object Dominance, Nested Scroll Regression, Project identity editing, Side Dock Affordance, Open Side Panel Density, Workbench Obstruction Usability, Design Canvas Direct Workbench, Design Workspace Crash Proof, Workbench Stability Overhaul, Project interaction affordance, active mode reload recovery, Verify saved-checks default, Verify testbench usable layout, Verify workbench layout reset, Hardware first viewport, design workbench, Design Workbench v1, Design no-bridge, workbench space utilization, workbench visual finish, shell layout, shell workbench hierarchy, Project command center, Export trust, Export handoff station, Export first-viewport artifact visibility, Export artifact direct preview, Hardware Basys3 workbench, Import recovery, and Verify evidence workbench integrity gates | runtime duration can grow; monitor CI time | P1 |
| RB-INV-026 | Broader classroom verifier must include the same invariant gates for local/nightly breadth. | CI/Classroom | `verify-gates-classroom.mjs` | includes Release Solidification v1, Outer Workflow Command Surfaces + Verify Signals Dock, Release Readiness Tool Windows, Import Guided Recovery Workflow, Workbench Reconstruction v1, Design Dual Tool Windows, Verify Task Plane Usability, Hardware Board Dominance, Action-First Entry Surfaces, Root Overflow Regression, Verify No-Circuit Task First, Project Loaded Paths First Viewport, Verify Post-Run Workbench Usability, Shell Navigation Overhaul, Primary Work Object Dominance, Nested Scroll Regression, Project identity editing, Side Dock Affordance, Open Side Panel Density, Workbench Obstruction Usability, Design Canvas Direct Workbench, Design Workspace Crash Proof, Workbench Stability Overhaul, Project interaction affordance, active mode reload recovery, Verify saved-checks default, Verify testbench usable layout, Verify workbench layout reset, Hardware first viewport, design workbench, Design Workbench v1, Design no-bridge, workbench space utilization, workbench visual finish, shell layout, shell workbench hierarchy, Project command center, Export trust, Export handoff station, Export first-viewport artifact visibility, Export artifact direct preview, Hardware Basys3 workbench, Import recovery, and Verify evidence workbench integrity gates | broad suite can be slow | P2 |
| RB-INV-027 | Pushed source is not the same as live-student deployment. | GitHub/deploy | GitHub operations docs | closeout must watch deploy checks | final status depends on live GitHub run | P1 |
| RB-INV-028 | Design must not require or probe the local hardware bridge before the user enters Hardware/proof contexts. | Design shell/error boundary/hardware client | prior product contract separates Design from downstream hardware proof | `studentError.test.ts` proves generic fetch/chunk failures no longer become bridge fatal copy; `hardware-client-boundary.test.ts` proves explicit off clients ignore persisted hardware mode; `ide:gate:design-no-bridge-required` proves Design loads the Logic Gates starter at `1366x768` and `1440x900` with persisted hardware mode on, no bridge fatal copy, no error boundary, and zero bridge-origin requests | future Hardware changes must keep bridge access opt-in to Hardware/proof surfaces | P0 |
| RB-INV-029 | Persistent rails and support panels must not steal workbench space unless actively needed. | Shell/workbench/surfaces | V1 visual audit, shell/layout gates | `ide:gate:workbench-space-utilization` captures before/after evidence across Project, Design, Verify, Hardware, Export, and Import; proves Design Library/Inspector and Verify Signals start collapsed/restorable; verifies readable Design canvas, Verify waveform/evidence, and Hardware board/table minimum areas; and rejects root horizontal overflow at `1366x768`, `1440x900`, and `1920x1080`. `ide:gate:side-dock-affordance` extends this rail invariant by proving collapsed restore rails are compact horizontal controls, stay within a `48px` slot, reopen readable content, and close back to restored workbench space at `1366x768` and `1440x900`. `ide:gate:open-side-panel-density` proves compact Hardware/Export open right inspectors remain full-height `212px` side tools instead of bottom cards. `ide:gate:workbench-obstruction-usability` proves Hardware Map Pins starts with Map support collapsed, opens left/right support docks proportionally, restores workbench space on close, and keeps board/table mapping first-order at `1366x768` and `1440x900`. `ide:gate:primary-work-object-dominance` now proves focused workbench support docks are exclusive outside wide layout and cannot both squeeze the primary work object. | future surface polish should still inspect screenshots for content density and direct-manipulation quality beyond shell geometry thresholds | P1 |
| RB-INV-030 | Empty states must not duplicate the same instruction hierarchy or hide the viable recovery paths below the fold. | Surface composition / Import first-look | visual audits and Import recovery gate | `ide:gate:workbench-visual-finish` intentionally failed before the fix on the duplicate Import command strip, then passed after the first-look composition change; it captures Import empty state plus Project/Design/Export neighbors at `1366x768`, `1440x900`, and `1920x1080`, requires one restore headline, visible RedByte ZIP/Paste HDL/sample/blocked paths, first-viewport guidance fit, and no root overflow | future Project or Export empty-state polish needs its own focused visual gate if product review reopens it | P2 |
| RB-INV-031 | A visible active workspace must be reload-recoverable from the URL mode. | App routing / persistence | route/layout gates and persistence gate | `ide:gate:active-mode-reload-recovery` intentionally failed when Project starter load left the URL at `mode=project`, then passed after active-mode URL sync; it proves starter-loaded Design and left-rail Verify restore after reload | browser back/forward stack behavior is not claimed by this gate | P1 |
| RB-INV-032 | Starters with saved expected outputs should default the next run to Compare, while explicit Observe remains available. | Verify command/run intent | verify contract/reality tests and Verify evidence workbench gate | `ide:gate:verify-saved-checks-default` intentionally failed when saved checks were available but Observe-only was armed and the action read `Run`; it now proves saved checks armed, Compare-oriented action copy, first Run reaching Compare PASS, Compare remaining armed after PASS, and explicit Observe/Compare switching | broader custom-vector editing sequences remain covered by runtime tests and future targeted gates if reopened | P1 |
| RB-INV-033 | Hardware Map Pins must keep the board/table binding work first-order at common classroom heights. | Hardware / Map Pins visual hierarchy | Hardware workbench and space-utilization gates | `ide:gate:hardware-first-viewport` intentionally failed when the loaded Logic Gates Map Pins board/table sat below the tightened threshold, then passed after the Hardware-only layout fix; it verifies visible build hash, selected SW0 row, board/table first-viewport geometry, selected binding chain height, `PACKAGE_PIN V17`, and no E1/E2/E3 browser overclaim at `1366x768` and `1440x900` | direct no-circuit and arbitrary custom mapping states remain separate future visual coverage if reopened | P1 |
| RB-INV-034 | Export must expose concrete generated artifact files before asking students or professors to inspect the package. | Export handoff / artifact visibility | Export handoff station and artifact explorer gates | `ide:gate:export-first-viewport-artifacts` intentionally failed when the ready-to-build handoff station did not expose generated filenames in the first viewport; it now proves `README.txt`, `top.vhd`, `top.xdc`, `testbench.vhd`, and `vivado_import.tcl` are visible in the station, the artifact explorer still renders, the visible build hash matches HEAD, and no E1/E2/E3 browser proof is claimed at `1366x768` and `1440x900` | custom-project artifact emphasis remains separate future coverage if reopened | P1 |
| RB-INV-035 | Project identity and workflow help affordances must be directly actionable from normal Project use without covering the Project work path. | Project / top bar / onboarding | Project command center and persistence gates | `ide:gate:interaction-affordance` intentionally failed when dismissed Workflow Orientation had no visible reopen affordance, then passed after the Project top bar gained `Flow` reopen and inline title rename. It was later strengthened to intentionally fail when loaded Project `Flow` reopened the old bottom overlay over `ide-project-entry-paths`; it now proves a compact integrated callout with no entry-path overlap. The release-candidate shakedown strengthened the same gate again so loaded Project must not auto-show the full Workflow Orientation card after real work is loaded, while first launch still gets automatic help and `Flow` remains the explicit reopen control. `ide:gate:project-identity-editing` intentionally failed when the loaded Project title did not open rename on double-click, then passed after top-bar, upper Project identity strip, loaded Project title, and adjacent Rename all shared meaningful inline rename behavior. `ide:gate:release-solidification-v2` now proves first-launch Workflow Orientation is also integrated and does not cover Build Fresh, starter, or primary launch actions. Current proof verifies visible build hash, orientation dismiss/reopen, first-launch and loaded Project no-overlap, loaded Project auto-collapse, title edit/cancel/save, Project/top-bar/strip identity agreement, distinct starter source label, navigation persistence, and reload persistence across `1366x768` and `1440x900`. | broader card-heavy interaction model and direct-manipulation depth remain separate future visual/product coverage | P1 |
| RB-INV-036 | Collapsed side docks must read as intentional restore controls, not sideways permanent scaffolding. | Shell/workbench/surfaces | side-dock browser inspection | `ide:gate:side-dock-affordance` intentionally failed when collapsed Design Library/Inspector, Verify Signals, Hardware Inspector, and Export Inspector rails used vertical `Library`/`Signals`/`Inspector` labels and Verify consumed `56px`; it now proves compact horizontal `+ / Show / Lib|Sig|Info` restore controls in `48px` slots, readable opened support content, close-to-restore workspace behavior, focal workbench visibility, no root overflow, and no console/page errors at `1366x768` and `1440x900`. | open panel content density and card-heavy static composition remain separate future coverage | P1 |
| RB-INV-037 | Compact open side panels must remain proportional tools beside the workspace. | Shell/workbench/surfaces | open side-panel browser inspection | `ide:gate:open-side-panel-density` intentionally failed when compact Hardware and Export right inspectors opened as short bottom cards `1017px`/`1089px` wide; it now proves Hardware and Export right inspectors open as full-height `212px` side tools at `1366x768` and `1440x900`, keep workspace height, keep focal work objects visible, collapse back to restore rails, reject root overflow, and fail on console/page errors. | broader support-panel content density and direct-manipulation affordances remain visual/product follow-up, not this shell geometry invariant | P1 |
| RB-INV-038 | First-viewport generated-file cues in Export must be direct preview controls, not passive labels. | Export handoff / artifact interaction | export direct-manipulation browser inspection | `ide:gate:export-artifact-direct-preview` intentionally failed when `top.vhd` rendered as a passive `span`, then passed after generated-file cues became button/keyboard preview controls. It proves visible build hash, `top.vhd` click selection, `top.xdc` keyboard selection, existing artifact workspace reveal geometry, selected-state `aria-pressed`, no root overflow, and no browser E1/E2/E3 overclaim at `1366x768` and `1440x900`. | arbitrary custom artifact sets remain future coverage if reopened | P1 |
| RB-INV-039 | Hardware Map Pins support chrome must not obstruct the board/table mapping workbench on entry. | Hardware / Map Pins / shell support docks | browser-first workbench obstruction inspection | `ide:gate:workbench-obstruction-usability` intentionally failed when Hardware opened with the Map support dock visible on entry; it now proves default-collapsed Map support, compact `Map` restore control, board/table first-viewport geometry, proportional left and right support docks when opened, close-to-restore behavior, no root overflow, and no console/page errors at `1366x768` and `1440x900`. | broader support-panel content density and direct-manipulation depth remain future product coverage | P1 |
| RB-INV-040 | Design canvas support chrome must not cover the loaded graph by default. | Design canvas / workbench chrome | Design Workbench v1 and zoom gates | `ide:gate:design-canvas-direct-workbench` intentionally failed when compact View toggle was missing and the default HUD/minimap covered the graph; it now proves compact View default, on-demand expansion/reclose, no default graph overlap, no root overflow, no console/page errors, and zoom preset reachability at `1366x768` and `1440x900`. | broader direct-manipulation and card-heavy polish remains separate future product coverage | P1 |
| RB-INV-041 | Recoverable surface-load failures must not strand a visible workspace or require destructive reset. | Shared error boundary / lazy surfaces | error-boundary unit gate and route gates | `ide:gate:design-workspace-crash-proof` intentionally failed when a rejected Design lazy-surface module was not classified as recoverable; it now proves `DesignSurface-*.js` load failure surfaces a non-destructive `Reload App` action, preserves `Reset Workspace`, and recovers to Design. `ide:gate:workbench-stability-overhaul` proves Project -> Design -> Verify -> reload -> Map Pins -> Design continuity without boundaries or stuck loading. | browser back/forward and arbitrary deploy-cache races remain future coverage | P1 |
| RB-INV-042 | Verify's first-run testbench must be usable before waveform evidence exists. | Verify / stimulus workbench | Verify evidence and saved-check gates | `ide:gate:verify-testbench-usable-layout` intentionally failed when pre-run Verify stayed in split mode with a narrow horizontally scrolling testbench; it now proves `stimulus-focus`, all starter expected-output cells, all four case headers, no root overflow, and no meaningful horizontal testbench overflow at `1366x768` and `1440x900`. `ide:gate:verify-workbench-layout-reset` proves the layout remains usable through Compare PASS, intentional FAIL, repair, and final PASS. `ide:gate:verify-postrun-workbench-usability` extends the post-run half of that contract across PASS, induced FAIL, and repair PASS at `1366x768` and `1440x900`. | broader Verify visual polish may still need future product-review gates, but Compare semantics are unchanged | P1 |
| RB-INV-043 | The global shell and navigation must behave like compact tools around the workbench, not permanent scaffold that creates mini-scroll traps. | Shell/navigation/workbench | shell hierarchy, side-dock, and Verify layout gates | `ide:gate:shell-navigation-overhaul` intentionally failed during this slice on stale build proof, proof-ribbon height drift, and an outdated Import-left-rail assumption; it now proves compact rail/proof-ribbon geometry, workflow rail reachability, Import utility route/reload access, no root overflow, and no console/page errors at `1366x768` and `1440x900`. `ide:gate:primary-work-object-dominance` proves Design, Verify, Hardware, Export, and Import main work regions dominate the viewport and support docks are exclusive in focused workbench modes. `ide:gate:nested-scroll-regression` rejects meaningful Verify stimulus/waveform and Hardware workbench mini-scroll traps. | broader function-depth and card-heavy composition still require future browser-first product slices | P1 |
| RB-INV-044 | Verify post-run repair must keep editable checks usable beside waveform evidence. | Verify / stimulus workbench / evidence layout | Verify Workbench Rebuild and shell/navigation gates | `ide:gate:verify-postrun-workbench-usability` intentionally failed on the old `460px` post-run checks lane and was later strengthened when browser E0 proof found waveform evidence starting too low. It now proves Compare PASS, induced expected-output FAIL, repair PASS, usable checks width/share, waveform minimum width, waveform evidence top offset, viewport-visible chart height, no mini-scroll trap, visible first-failing-check action, build-hash identity, no root overflow, and no console/page errors at `1366x768` and `1440x900`. Updated `ide:gate:primary-work-object-dominance`, `ide:gate:nested-scroll-regression`, and `ide:gate:workbench-space-utilization` keep the balanced evidence/repair contract through wider viewports. | direct Verify no-circuit composition and broader evidence clarity remain future product-review targets | P1 |
| RB-INV-045 | Empty or loaded entry states must present actionable task paths before apparatus or static metrics. | Verify / Project entry surfaces | Project command center and Verify layout gates | `ide:gate:verify-no-circuit-task-first` intentionally failed when fresh direct Verify did not expose a task-first no-circuit panel, then passed after Verify hid waveform/testbench apparatus and showed Open Design, Load starter, and Import / Recover actions. `ide:gate:project-loaded-paths-first-viewport` intentionally failed when loaded Project action paths started too low in the first viewport, then passed after the loaded Project hierarchy placed all five action paths higher than lower metrics/support content. Both gates verify visible build hash, route actions, no root overflow, and no console/page errors at `1366x768` and `1440x900`. | broader card-heavy static composition and deeper direct-manipulation depth remain future product-review targets | P1 |
| RB-INV-046 | Release-readiness tool windows must not crop visible controls or obstruct the Basys3 board. | Design Library / Hardware Map Pins / workbench CSS | Workbench reconstruction and Hardware board-dominance gates | `ide:gate:design-library-not-cropped` intentionally failed when the Design Library was `176px`/`184px` wide and board-resource controls extended outside the dock; `ide:gate:hardware-board-unblocked` intentionally failed when the resource summary overlapped the Basys3 board. The final six-gate release-readiness contract proves proportional Design tool windows, usable canvas width, no visible horizontal cropped controls, Hardware resource summary/catalog separation from the board visual, visible build hash, no root overflow, and no console/page errors at `1366x768` and `1440x900`. | Project/Export/Import still have separate card-heavy/function-depth product debt; Vivado/Basys3 proof remains external | P1 |
| RB-INV-047 | Outer workflow surfaces must expose direct command/recovery/package tools before passive cards. | Project / Import / Export surfaces | Project command center, Import recovery, Export handoff station | `ide:gate:project-loaded-command-surface`, `ide:gate:import-guided-recovery-wizard`, and `ide:gate:export-package-inspector` prove loaded Project direct mode commands, Import first-look wizard stages/no-overwrite boundary, and Export ready-state file browser plus selected preview. `ide:gate:outer-workflow-action-density` and `ide:gate:card-chrome-regression` guard against direct actions being buried under passive card chrome. | deeper direct manipulation and surface-specific function depth remain future browser-first targets | P1 |
| RB-INV-048 | Verify's open Signals dock must be readable without making the collapsed rail bulky. | Verify Signals rail / workbench CSS | Side Dock Affordance and Verify layout gates | `ide:gate:verify-signals-dock-not-clipped` intentionally failed when the open dock measured `136px`/`144px`; it now proves a `224px` readable open rail, no horizontal clipping for header/title/count/actions/list, no root overflow, and a usable Verify workspace at `1366x768` and `1440x900`. `ide:gate:side-dock-affordance` still proves the collapsed Verify rail remains compact. | signal filtering/content depth remains future product work, not a geometry fix | P1 |
| RB-INV-049 | Release-critical active workbenches must remain tool-like after their first reconstruction pass. | Verify / Export / Import workbenches | full-browser release-solidification audit | `ide:gate:release-solidification-v1` intentionally failed on Verify internal horizontal overflow with Signals open; it now proves Verify open-Signals no-overflow geometry and usable stimulus/waveform lanes, Export Package / Verify / Pin Mapping / E0 Boundary checklist clarity, and Import selected-source editor plus source-review layout with reload continuity at `1366x768` and `1440x900`. | deeper direct manipulation, Project/Design composition, and Vivado/Basys3 E1/E2/E3 proof remain separate future work | P1 |
| RB-INV-050 | Verify post-run next actions must remain visible after Compare PASS and repair PASS. | Verify result/action layout | Verify post-run and release-solidification gates | `ide:gate:release-solidification-v2` proves Verify Compare PASS and repair PASS expose a compact lower action band with Continue to Hardware, Open Export, and Back to Design. It also proves intentional FAIL keeps the first failing-check action visible and avoids reserving an empty lower result row. | broader Verify information hierarchy remains a product-review concern, not a Verify semantic change | P1 |
| RB-INV-051 | A blank or partial Design circuit must keep direct next authoring actions visible after Build Fresh. | Design blank authoring / proof harness | Design workbench and student-task gates | `ide:gate:authoring-depth-release-safety` intentionally failed when Add boundary I/O left only input/output nodes and no direct Add gate/Wire path in the current workbench. It now proves Build Fresh, Add boundary I/O, direct Add AND/Wire continuation, Design reload, starter select/duplicate/delete/undo, wire delete/undo, Project continuity, and Verify/Hardware/Export/Import reload smoke with visible build-hash identity and no error boundary, dynamic-import failure, root overflow, or console/page errors at `1366x768` and `1440x900`. `ide:gate:final-current-build-smoke` protects final closeout from dirty worktrees and stale build-hash proof. | deeper freeform circuit construction and course-pack authoring remain future work | P1 |
| RB-INV-052 | Release-candidate closeout must distinguish browser E0 readiness, final deployed-SHA proof, pinned Node proof, and downstream Vivado/Basys3 proof tiers. | Release management / proof process | release docs and final-current gate | `docs/product/RED_BYTE_RELEASE_CANDIDATE_DECISION.md` records current E0 posture and not-shippable blockers; `docs/product/RED_BYTE_BROWSER_E0_RELEASE_PROOF.md` records pinned Node `20.19.0` proof status and browser E0 flows; `ide:gate:node20-proof-status` passes when Node `20.19.0` is active and records a blocker when it is not; `ide:gate:release-final-sha-discipline` delegates to the clean-worktree final current-build smoke. | final deployed-SHA proof must still be collected after the proof-package commit; Vivado/Basys3 proof remains separate | P1 |
| RB-INV-053 | Normal student chrome must separate lab work from engineering diagnostics. | Product Trust Reset v2 shell / diagnostics / workspace foundation | Phase 1 contracts and student-chrome inventory | `ide:gate:v2-student-chrome` proves Project, Design, Verify, Hardware, Export, and Import hide raw build badges, hide E-tier labels, expose Help, open Diagnostics with the full build fingerprint and plain external-proof boundary, reject generic HIDE / SHOW INFO rails, keep project title/save state visible, reject root overflow, and assert V2 workspace primitives. After screenshots and observations are under `.redbyte/product-immersion/product-trust-reset-v2/phase-2/after/` at `1366x768`, `1440x900`, and `1920x1080`. | Phase 3 still must rebuild Verify truth/editing hierarchy; generated README/provenance still carries existing artifact proof wording until an explicit export-generation slice changes bytes. | P1 |
| RB-INV-054 | Rendered Verify authority must match the V2 truth model for check ownership, stale reason, repair authority, timing, and Project/Export readiness. | Verify truth adapter / Verify workbench / Project workflow authority | Phase 3 state and adapter tests | `verify:truth-integration-gate` now includes `projectWorkflowAuthority.test.ts`; `ide:gate:verify-v2-authority-cutover` proves Course checks render locked, expected-output cells are disabled with duplicate guidance, Duplicate to My checks makes the same checks editable, Compare still runs, and the rendered V2 result authority exposes result status, current state, Project status, and Export readiness. `ide:gate:verify-authority-phase-3d` extends that rendered proof through V2 saved-check stale reason/recovery copy, timing label, My-check failure repair authority, visible expected-output repair affordance, and repaired PASS. Phase 3F adds the first browser accessibility, keyboard, durability, and classroom rehearsal proof around this authority. | Full human assistive-technology review and hardware proof remain separate; no Vivado/Basys3 proof is implied. | P1 |
| RB-INV-055 | Sequential Verify timing must be part of the trusted run authority, and timing edits must stale old trusted results across Verify, Project, and Export. | Verify truth adapter / Verify clock policy / Project workflow authority | Phase 3E model and adapter tests | `verify:truth-integration-gate` proves `staleTiming` / `timing-changed`, manual-pulse editability, custom-pattern rejection, and Project/Export stale readiness. `ide:gate:verify-sequential-authority-v2` proves the Counter browser path: auto board-clock is generated/read-only, Compare PASS is current, manual pulses expose the editable clock lane, timing changes stale the prior PASS, and Project/Export agree before rerun. | Custom clock patterns remain explicitly unsupported in trusted novice Verify; broader sequential classroom labs still need future task-specific rehearsal. | P1 |
| RB-INV-056 | Verify V2 must be usable through accessible names, keyboard-only expected-output editing, and classroom zoom/contrast conditions. | Verify workbench / Diagnostics dialog | Phase 3F accessibility review | `ide:gate:verify-accessibility-v2`, `ide:gate:verify-keyboard-grid-v2`, and `ide:gate:verify-zoom-contrast-v2` prove visible Verify controls have accessible names, Course checks are locked and duplicable, keyboard can edit My expected outputs and rerun Compare, Diagnostics has modal semantics, and key controls remain visible/contrasty at 125 percent zoom. | Full screen-reader/human WCAG audit remains future work. | P1 |
| RB-INV-057 | Browser persistence must survive reload/corrupt storage, warn on multi-tab runtime-key writes, surface failed/quota saves, and recover from last-known-good without changing project format. | Project storage facade / runtime storage / project persistence / session metadata | Phase 3 durability docs | `ide:gate:project-durability-v2`, `ide:gate:verify-corrupt-state-recovery-v2`, and `ide:gate:verify-multitab-conflict-v2` prove snapshot/index/runtime reload restore, malformed runtime/session storage recovery without stale PASS, and visible Reload/Dismiss warning when another tab writes the runtime key. Phase 3H adds `ide:gate:project-storage-facade-v2`, `ide:gate:atomic-save-journal-v2`, `ide:gate:project-schema-migration-v2`, `ide:gate:project-quota-recovery-v2`, `ide:gate:project-multitab-conflict-v2`, `ide:gate:dirty-update-guard-v2`, `ide:gate:project-recovery-workflow-v2`, `ide:gate:diagnostics-storage-v2`, and `ide:gate:recovery-accessibility-v2`. | Full collaborative conflict merge UI, backend/cloud sync, and screen-reader certification remain future work. | P1 |
| RB-INV-058 | Diagnostics must keep engineering support metadata behind Help while normal student chrome stays clean. | Help / Diagnostics / student chrome | Phase 2 V2 student chrome gate | `ide:gate:diagnostics-bundle-v2` proves Help / Diagnostics exposes full SHA plus project/mode/Verify/storage/browser support bundle while normal UI still hides raw build hashes and E-tier labels. | TA copy flow needs human support-process rehearsal. | P1 |
| RB-INV-059 | Current classroom gates must have one manifest-backed authority and retired V1 checks must name replacements. | Test authority / release proof | Phase 3G red baseline and gate reset | `scripts/gates/gate-manifest.mjs`, `gate:manifest:validate`, `gate:no-hardcoded-redbyte-test-ports`, `verify:gates:legacy`, `classroom:gate` `76/76`, and `verify:gates:classroom` `95/95` prove the current suite split and retired-gate documentation | keep the manifest current when adding, retiring, or quarantining gates | P1 |
| RB-INV-060 | Project persistence authority must not silently reintroduce direct project storage writes outside the facade. | Project storage facade / source gate / compatibility cleanup | Phase 3H storage facade gates and durability model | `gate:project-storage-authority` scans production source for direct browser storage writes, allows only documented non-project preferences and compatibility project paths, and fails new direct project persistence outside the facade/allowlist. Phase 3I rehearsal fault injection also proves wrong-build, runtime-error, authority-mutation, stale-trust, state-leak, and reload-error failures are detected by the classroom harness. | Retire package-root compatibility writers after consumer audit; exact origin/main performance delta and human AT pass remain separate P2/non-draft work | P1 |

## New Gates In This Slice

### `ide:gate:verify-accessibility-v2`

Protects the Verify V2 accessibility baseline. It opens Verify through the loaded starter path, checks accessible names for primary controls, verifies locked Course expected-output cells communicate why they are locked, opens Help / Diagnostics as a modal, and rejects normal-surface raw build/E-tier proof labels.

### `ide:gate:verify-keyboard-grid-v2`

Protects keyboard-only Verify repair. It duplicates Course checks to My checks, edits an expected-output cell with keyboard focus, runs Compare through keyboard activation, and verifies the authority result becomes stale/fail/pass through the same rendered V2 model instead of a detached grid state.

### `ide:gate:verify-zoom-contrast-v2`

Protects classroom zoom and contrast tolerance. It exercises Verify at the classroom viewport under 125 percent zoom, requires key controls and the authority summary to remain visible, and checks representative foreground/background contrast for the main action and authority surfaces.

### `ide:gate:project-durability-v2`

Protects reload durability for browser E0 project state. It renames the starter project, runs Verify, checks snapshot/index/runtime storage keys, reloads, and verifies the project title plus Verify authority are restored from current browser storage without claiming a storage-facade migration.

### `ide:gate:verify-corrupt-state-recovery-v2`

Protects corrupt browser-state recovery. It seeds malformed runtime/session storage, opens Verify, verifies the app recovers to a usable starter path, and rejects resurrecting stale trusted PASS from corrupt state.

### `ide:gate:verify-multitab-conflict-v2`

Protects the minimal multi-tab conflict boundary. It opens two same-origin contexts, writes the runtime storage key from the second tab, requires the first tab to show a saved-work-changed warning, and verifies Dismiss and Reload remain explicit user choices.

### `ide:gate:diagnostics-bundle-v2`

Protects the support-bundle boundary. It opens Help / Diagnostics, verifies full build SHA and support-bundle fields for project, mode, Verify, storage, and browser context, and ensures normal chrome still hides raw build hash and E-tier labels.

### `ide:gate:verify-v2-authority-cutover`

Protects the rendered Verify authority cutover. It loads the Logic Gates starter, proves starter checks render as locked Course checks, verifies expected-output cells are disabled with duplicate guidance, duplicates to My checks, verifies expected-output cells become editable, runs Compare, and asserts the rendered V2 authority marker exposes result status, current/stale state, Project status, and Export readiness without normal-surface proof-tier wording.

### `ide:gate:verify-authority-phase-3d`

Protects the rendered Phase 3D Verify authority completion. It loads the Logic Gates starter, proves Course checks are locked, duplicates to My checks, runs Compare PASS, edits an expected-output cell, proves the V2 stale reason renders as saved-check/testbench stale instead of design-build stale, runs Compare FAIL, proves the selected My-check failure exposes expected-output and Design repair authority, repairs the expected output, and proves the final V2 PASS is current.

### `ide:gate:verify-sequential-authority-v2`

Protects the rendered Phase 3E sequential timing authority. It loads the Counter starter, proves Verify starts in generated/read-only auto board-clock mode with rising-edge V2 timing copy, runs Compare PASS, switches to manual pulses, verifies the old PASS becomes `timing-changed` stale, requires the editable clock lane and pulse controls, and verifies Project plus Export both agree the Verify evidence is stale before rerun.

### `ide:gate:project-loaded-command-surface`

Protects loaded Project from reverting to a metric-first report page. It loads a starter at `1366x768` and `1440x900`, verifies the visible build hash, requires the command board and direct Design / Verify / Map Pins / Export actions, preserves secondary start/recovery paths, rejects root overflow, and fails on console/page errors.

### `ide:gate:import-guided-recovery-wizard`

Protects Import first-look from reverting to a passive recovery explainer. It verifies source choice, staged recovery track, no-overwrite boundary, visible recovery choices, no root overflow, and console/page cleanliness at `1366x768` and `1440x900`.

### `ide:gate:export-package-inspector`

Protects Export ready state from hiding package inspection behind extra interaction. It reaches a ready-to-build starter export, requires a generated-file browser, selected artifact preview, direct build/download/copy actions, no browser E1/E2/E3 overclaim, no root overflow, and console/page cleanliness at `1366x768` and `1440x900`.

### `ide:gate:outer-workflow-action-density`

Sweeps Project, Import, and Export for direct first-viewport actions so outer workflow surfaces cannot regress into passive static panels before useful commands.

### `ide:gate:card-chrome-regression`

Counts real non-interactive card-like chrome on Project, Import, and Export while ignoring plain text children inside larger work objects. It protects the current reduction in decorative/report-card structure.

### `ide:gate:verify-signals-dock-not-clipped`

Protects the open Verify Signals rail from returning to the cropped `136px`/`144px` state. It opens Verify, opens Signals, requires a readable open dock width, checks header/title/count/action/list horizontal clipping, preserves a usable workspace, rejects root overflow, and fails on console/page errors at `1366x768` and `1440x900`.

### `ide:gate:design-library-not-cropped`

Protects the Design Library from reverting to a clipped rail. It loads the Logic Gates starter at `1366x768` and `1440x900`, verifies the visible build hash, requires the Library tool window to be at least `260px`, requires a usable canvas, rejects visible horizontal clipping for search/board-resource controls, rejects root overflow, and fails on console/page errors.

### `ide:gate:design-tool-window-coexistence`

Protects proportional Design side tools. It proves Library and Inspector open as tool windows within release-readiness bounds while leaving the canvas usable at classroom and desktop viewports.

### `ide:gate:hardware-board-unblocked`

Protects Hardware Map Pins from resource summary overlays. It loads the Logic Gates starter, opens Hardware, requires board/table separation and a usable board visual, rejects resource-summary overlap with the Basys3 board, rejects root overflow, and fails on console/page errors.

### `ide:gate:hardware-resource-catalog-not-obstructing`

Protects board controls from resource catalog/summary obstruction. It verifies the resource summary and catalog do not sit over the Basys3 board visual at `1366x768` and `1440x900`.

### `ide:gate:release-readiness-visual-contract`

Combines the current Design Library and Hardware board release-readiness geometry target into one focused browser contract.

### `ide:gate:no-cropped-controls-regression`

Sweeps the changed Design and Hardware paths for visible horizontally cropped controls while preserving legitimate internal scrolling.

### `ide:gate:verify-no-circuit-task-first`

Protects fresh direct Verify entry from looking like a broken mapping or empty testbench state before a circuit exists. It verifies the visible build hash against current Git HEAD, opens direct Verify at `1366x768` and `1440x900`, requires a no-circuit task panel, rejects visible waveform/testbench apparatus and misleading Hardware/Map Pins/No IO mapping copy, proves Open Design / Load starter / Import Recover actions, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:project-loaded-paths-first-viewport`

Protects loaded Project from pushing real action paths below metrics/support content. It loads the Logic Gates starter at `1366x768` and `1440x900`, returns to Project, verifies the visible build hash, requires Continue / Build Fresh / Course Starter / Import Recover / Open Recent in the useful first viewport, proves Continue and Import navigation, verifies the loaded Build Fresh guard, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:verify-postrun-workbench-usability`

Protects the post-run Verify PASS/FAIL/repair workbench from falling back into the tiny editable checks lane observed in live browser inspection. It verifies the visible build hash against current Git HEAD, loads the Logic Gates starter at `1366x768` and `1440x900`, runs Compare PASS, induces an expected-output FAIL, repairs to PASS, requires usable checks-lane width/share beside waveform evidence, rejects meaningful stimulus-grid mini-scroll, checks the first-failing-check action remains visible, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:shell-navigation-overhaul`

Protects the global shell from regressing back into scaffold-heavy navigation. It verifies the visible build hash against current Git HEAD, checks Project/Design/Verify/Hardware/Export workflow rail reachability at `1366x768` and `1440x900`, verifies Import remains reachable as a utility route and after reload, requires the compact proof-ribbon/left-rail contract, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:primary-work-object-dominance`

Protects the primary work object from being squeezed by both support docks or shell chrome. It loads the normal Logic Gates workflow, checks Design, Verify pre-run, Verify Compare PASS, Hardware, Export, and Import at classroom and desktop viewports, requires dominant canvas/testbench/waveform/board/artifact/recovery geometry, verifies focused support docks are exclusive outside wide layout, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:nested-scroll-regression`

Protects against the small internal scroll regions that made Verify and Hardware feel cramped in live inspection. It exercises the Logic Gates Verify and Hardware paths, rejects meaningful horizontal mini-scroll in the stimulus grid and waveform lane, rejects root overflow, allows normal page-level workbench scroll where appropriate, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:verify-testbench-usable-layout`

Protects the Verify first-run testbench from being trapped in a tiny split-pane lane beside empty waveform chrome. It verifies the visible build hash against current Git HEAD, loads the Logic Gates starter at `1366x768` and `1440x900`, requires pre-run `stimulus-focus`, checks the stimulus region owns the workbench, requires all saved expected-output cells and all starter case headers to be visible, rejects meaningful horizontal grid overflow, rejects root overflow, and keeps the waveform readiness panel secondary until a run exists.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:verify-workbench-layout-reset`

Protects Verify layout continuity across the normal evidence workflow. It loads Logic Gates at `1366x768`, checks the pre-run testbench layout, runs Compare PASS, intentionally edits an expected output to FAIL, repairs it, and requires the post-run stimulus/waveform geometry and grid overflow to stay usable through final PASS.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:design-canvas-direct-workbench`

Protects loaded Design authoring from default zoom HUD/minimap obstruction. It verifies the visible build hash against current Git HEAD, loads the Logic Gates starter at `1366x768` and `1440x900`, requires the compact View toggle by default, rejects expanded controls or minimap before the student opens them, opens and recloses View tools, proves a 125% zoom preset interaction, checks graph overlap geometry, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:design-workspace-crash-proof`

Protects stale or failed lazy Design surface loading. It aborts the first production `DesignSurface-*.js` chunk request at `1366x768` and `1440x900`, requires the shared boundary to classify the issue as `surface-load`, requires non-destructive `Reload App` recovery plus the retained `Reset Workspace` escape hatch, and verifies the reload returns to Design with the build badge, no boundary, no horizontal overflow, and only the expected aborted-chunk console noise.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:workbench-stability-overhaul`

Protects normal core workbench continuity after the surface-load repair. It loads Project, opens Design, exercises the compact View/zoom controls, navigates to Verify, reloads Verify, opens Map Pins, returns to Design, and rejects error boundaries, stuck loading states, route/mode mismatch, root overflow, and console/page errors at `1366x768` and `1440x900`.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:workbench-obstruction-usability`

Protects the Hardware Map Pins workbench from support-chrome obstruction. It verifies the visible build hash against current Git HEAD, opens Hardware from a loaded Logic Gates starter at `1366x768` and `1440x900`, requires the Map support dock to start collapsed with a compact `Map` restore rail, checks the board/table mapping area owns the first viewport, opens and closes both right and left support docks to prove proportional tool sizing and workspace restoration, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:export-artifact-direct-preview`

Protects Export generated-file direct manipulation in the ready-to-build Logic Gates path. It verifies the visible build hash against current Git HEAD, reaches Verify Compare PASS, opens Export at `1366x768` and `1440x900`, requires first-viewport generated-file cues to be real buttons with preview labels and keyboard reachability, clicks `top.vhd`, keyboard-activates `top.xdc`, checks preview-path updates, requires the artifact workspace to be revealed, checks selected `aria-pressed`, rejects root overflow, and rejects browser-side E1/E2/E3 or Vivado/Basys3 overclaims.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:open-side-panel-density`

Protects compact open right-dock geometry for Hardware and Export. It loads a starter, opens Hardware and Export at `1366x768` and `1440x900`, opens the right inspector from the restore rail, requires the inspector to be a proportional full-height side panel (`180px`-`320px`) beside the workspace rather than a bottom drawer, verifies focal work objects stay visible, rejects horizontal overflow and console/page errors, and proves collapse returns the restore rail.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:side-dock-affordance`

Protects the collapsed side-dock restore affordance across normal RedByte surfaces. It loads the Logic Gates starter, checks Project, Design, Verify, Hardware, Export, and Import at `1366x768` and `1440x900`, requires collapsed rails to stay within a `48px` slot, rejects vertical/sideways label writing, verifies the restore controls are focusable buttons with clear `Show` copy, opens each available dock to prove readable content, closes it to prove workbench width returns, checks focal work objects remain visible, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:project-identity-editing`

Protects the Project identity editing contract after a starter is loaded. It verifies the visible build hash against current Git HEAD, opens Project at `1366x768` and `1440x900`, proves top-bar title double-click, upper Project identity strip click/double-click, loaded Project title click/double-click, and adjacent Rename edit paths, then checks Escape cancel, Enter save, blur save, Project/top-bar/strip title agreement, distinct starter source label, navigation persistence, reload persistence, and console/page error absence.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:interaction-affordance`

Protects the Project first-launch and loaded Project interaction affordance contract. It verifies the visible build hash against current Git HEAD, starts from a fresh Project route at `1366x768`, dismisses Workflow Orientation, requires the compact `Flow` affordance to reopen it, cancels a title rename with Escape, saves `EE 141 Lab 2` with Enter, verifies Project and top-bar identity agree, reloads, confirms the renamed title persists while the orientation remains dismissed and recoverable, then loads the Logic Gates starter, returns to Project at `1440x900`, rejects the full orientation card auto-showing on loaded Project, verifies `Flow` remains visible, reopens `Flow`, and rejects overlap between the orientation callout and loaded Project entry paths.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:export-first-viewport-artifacts`

Protects Export first-viewport artifact visibility for the ready-to-build Logic Gates path. It verifies the visible build hash against current Git HEAD, reaches Verify Compare PASS, opens Export at `1366x768` and `1440x900`, requires `README.txt`, `top.vhd`, `top.xdc`, `testbench.vhd`, and `vivado_import.tcl` to be visible inside the handoff station, verifies the downstream artifact explorer still renders, and rejects browser-side E1/E2/E3 or Vivado/Basys3 overclaims.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:hardware-first-viewport`

Protects the Hardware first-viewport hierarchy for the Logic Gates starter Map Pins path. It verifies the visible build hash against current Git HEAD, loads the starter, opens Hardware at `1366x768` and `1440x900`, selects SW0, and requires the board workspace, mapping table, Basys3 board, and selected SW0 -> board resource -> package pin -> XDC chain to be visible high enough in the first viewport with no root overflow or E1/E2/E3 browser overclaim.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:verify-saved-checks-default`

Protects the Verify run-intent invariant for starters with saved expected outputs. It loads the Logic Gates starter, opens Verify at `1366x768` and `1440x900`, requires saved checks to be available and armed before the first run, requires the primary action and explainer to name Compare, runs without manually changing mode, expects Compare PASS, verifies Compare remains armed after PASS, and proves students can intentionally switch Observe-only and back to Compare.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:active-mode-reload-recovery`

Protects the route/reload invariant that the visible active workspace must match the URL mode before a refresh. It starts from Project, loads the Logic Gates starter, requires the route to become `mode=design`, reloads and verifies Design restores, then navigates to Verify through the left rail, requires `mode=verify`, reloads and verifies Verify restores.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:workbench-visual-finish`

Protects the visual-finish invariant that first-look empty states must not feel like stacked scaffolding. It opens Import with no project at `1366x768`, `1440x900`, and `1920x1080`, rejects the redundant Import command strip in first-look, requires exactly one visible restore headline, requires visible RedByte ZIP / Paste HDL / structural sample / blocked example choices without opening a disclosure, checks recovery guidance stays in the first viewport, captures neighboring Project/Design/Export states, and rejects horizontal overflow.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:workbench-space-utilization`

Protects the cross-surface product invariant that the primary work object owns the screen. It loads the Logic Gates starter, captures Project, Design, Verify before-run, Verify PASS/observation, Hardware, Export, and Import at `1366x768`, `1440x900`, and `1920x1080`, rejects horizontal overflow, enforces useful Design canvas / Verify waveform / Hardware board-table geometry, verifies Project/Export/Import primary actions are not buried, and proves collapsed Design Library/Inspector rails can be reopened.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:design-no-bridge-required`

Protects the Design/Hardware product boundary. It opens Design with persisted hardware mode set to `on`, loads the Logic Gates starter at `1366x768` and `1440x900`, verifies the visible build hash against current Git HEAD, rejects `RedByte Bridge Unreachable` / bridge-agent fatal copy, rejects ErrorBoundary and boot-crash markers, captures local screenshots under `.redbyte/product-immersion/design-no-bridge-required/`, and fails on any request to the local bridge origin before Hardware mode.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:design-workbench-integrity`

Protects Design against the class of bugs exposed by the zoom incident: the graph can load, remain visible, keep finite camera/SVG state, survive drag/delete/undo, preserve runtime/editor graph consistency, switch view modes, navigate away/back, and reload directly into Design.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:design-workbench-v1`

Protects Design Workbench v1 hierarchy and normal authoring interactions. It proves blank guidance, loaded starter graph visibility, selected node and wire context, wire start/cancel recovery, moved node state, delete/undo restore, split/code mode, zoom/fit/center, finite graph geometry, and no root overflow at `1366x768` and `1440x900`.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:project-command-center`

Protects Project against starter-first regression. It proves the no-circuit command center is neutral and first-viewport visible, Build Fresh / course starter / saved-recent / Import-Recover paths are visible, loaded Project keeps one primary next action plus peer entry paths, loaded starter browsing starts collapsed, and loaded Build Fresh is confirmation-guarded.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:shell-layout-integrity`

Protects the main RedByte spine against invisible or collapsed work surfaces. It loads the Logic Gates starter and checks Project, Design, Verify, Hardware, and Export at `1366x768`, `1440x900`, and `1920x1080` for current mode marker, no root overflow, visible top bar/left rail/mode root, visible focal object, and Design graph visibility.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:shell-workbench-hierarchy`

Protects the shell reset boundary. It loads the Logic Gates starter and checks Project, Design, Verify, Hardware, Export, and Import at `1366x768` for one compact proof/status authority: proof ribbon height, inline evidence height, proof-step count and density, support-only footer copy, rail step labels without visible `OK` status text, workbench top at the compact shell boundary, visible focal object, and no root overflow.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:export-trust-integrity`

Protects Export handoff trust for the mapped/verified Logic Gates path. It proves Export reaches `READY TO BUILD`, builds the current bundle, shows generated previews by default, downloads the Vivado Project ZIP, compares visible preview bodies with ZIP entries, checks README/provenance and E0/E1/E2/E3 boundary wording, and validates XDC/`EXPECTED_IO.json` evidence against mapped board I/O.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:export-handoff-station`

Protects Export station hierarchy for Draft, Ready-to-build, and Trusted post-download states. It proves exactly one visible handoff station at `1366x768`, Draft is not package-ready and has a repair path, Ready/Trusted keep one build/download primary action, artifact workspace and README preview are visible, expected Vivado package files are listed, mapping summaries agree, Vivado next steps are downstream, E1/E2/E3 are external/manual, and Export creates no root overflow or key-region overlap.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:hardware-basys3-workbench`

Protects the Hardware / Basys3 Workbench boundary. It proves Map Pins renders a Basys3 workbench at `1366x768` and `1440x900`, selecting SW0 exposes project signal, board resource, package pin, and generated XDC consequence lines, current Verify+Export ready state remains E0 browser/package evidence only, Vivado build/bitstream/board observation stay external, and Hardware creates no root horizontal overflow.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:verify-evidence-workbench-integrity`

Protects the Verify evidence workbench for the Logic Gates starter path. It proves the first-run stimulus editor and expected-output cells remain visible, Compare PASS works from saved checks, an expected-output edit creates an intentional Compare FAIL, the first mismatch shows expected/observed values near the waveform, and repairing the expected output returns to PASS. It also checks meaningful overlap among stimulus and waveform evidence regions at the classroom viewport.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:import-guided-recovery-workflow`

Protects active Import recovery from reverting to a first-look card stack after the user chooses a concrete recovery path. It verifies the visible build hash against current Git HEAD, checks first-look guidance, then proves Paste HDL and unsupported-example active states show a compact recovery taskbar, put editor/review or blocker evidence in the first viewport, preserve the Review Import apply contract, reject root overflow, reject console/page errors, and avoid E1/E2/E3 or Vivado/Basys3 overclaim at `1366x768` and `1440x900`.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:import-recovery-contract`

Protects Import / Recovery as a utility path. It proves Project Import / Recover discoverability, the first Import screen identifies RedByte manifest restore as the highest-fidelity path, Vivado ZIP/VHDL are reconstruction-limited, corrupt manifest import leaves the active project intact, manifest restore reaches editable project state, imported Verify PASS is not trusted automatically, and Import/Export copy does not claim Vivado build, board programming, or physical observation proof.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `lab:profile-contract`

Protects the first lab-profile data seam. It proves the built-in profile IDs are deterministic, profile metadata references existing public starter/example IDs, course metadata does not include runtime circuit state, validators report duplicate IDs and missing starter/output coverage, required IO/export/proof expectations stay explicit, and Lab 8 solved starter evidence is rejected by the no-solution policy.

This gate is a focused Vitest contract, not a browser, Vivado, or hardware proof.

### `ide:gate:workbench-reconstruction-v1`

Protects the Workbench Reconstruction v1 shell/task-plane model. It verifies the visible build hash against current Git HEAD, checks Project, Design, Verify, Hardware, Export, and Import at `1366x768` and `1440x900`, requires compact shell geometry, rejects an empty auto-console layout slot, verifies task-plane visibility, rejects root horizontal overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:design-dual-tool-windows`

Protects Design tool-window behavior under the reconstructed workbench model. It opens and closes the Design support tools, verifies the canvas remains the primary task plane, checks restore affordances, rejects root overflow, and fails on console/page errors at classroom and desktop viewports.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:verify-task-plane-usability`

Aggregates Verify task-plane proof for the current pre-run, post-run, fail, repair, and layout-reset contracts. It runs `ide:gate:verify-testbench-usable-layout`, `ide:gate:verify-postrun-workbench-usability`, and `ide:gate:verify-workbench-layout-reset`.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:hardware-board-dominance`

Protects Hardware Map Pins as a board/table-first task plane. It loads the Logic Gates starter, opens Map Pins at `1366x768` and `1440x900`, selects SW0, rejects the normal mapped workbench if a non-action command strip sits above the board/table, verifies selected-row board/table geometry, rejects E1/E2/E3 browser overclaims, rejects root overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:action-first-entry-surfaces`

Protects Project, Export, and Import entry surfaces from regressing into static card stacks. It verifies normal first-viewport action paths, direct Export preview reachability, Import recovery hierarchy, build-hash identity, no root overflow, and console/page cleanliness.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:root-overflow-regression`

Protects the root viewport overflow invariant across the main modes after shell/task-plane compaction. It sweeps Project, Design, Verify, Hardware, Export, and Import, rejects horizontal document overflow, and fails on console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:release-solidification-v1`

Protects the current Verify / Export / Import release package. It proves Verify with Signals open has no internal horizontal overflow and keeps both stimulus and waveform lanes usable, Export package inspector exposes package readiness, Verify/Compare state, pin mapping state, and E0/external-proof boundary, and Import selected-source recovery uses an editor plus source-review lane that survives reload continuity at `1366x768` and `1440x900`.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:release-solidification-v2`

Protects the next release-solidification layer selected from live browser inspection. It proves first-launch Project Workflow Orientation is integrated and does not block launch actions, Compare PASS and repair PASS expose the lower Verify action band, intentional FAIL keeps the first failing-check action visible and the evidence workspace tall, visible build hash matches HEAD, no root overflow appears, and console/page errors fail the gate at `1366x768` and `1440x900`.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:student-task-completion-flow`

Protects the complete classroom student task loop after the Design direct-edit repair. It verifies the visible build hash, starts from Project, loads a starter, selects a Design node, proves the selected-node Inspector is proportional with visible Copy/Duplicate/Swap controls, continues through Verify Compare PASS, intentional expected-output FAIL, repaired PASS, Hardware map visibility, and Export E0 handoff at `1366x768` and `1440x900`, while rejecting root overflow, browser console/page errors, and browser E1/E2/E3 overclaim.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:authoring-depth-release-safety`

Protects repeated-use authoring depth and closeout safety. It verifies the visible build hash against current Git HEAD, starts from Project, proves first-launch title rename, runs Build Fresh, adds boundary I/O, requires direct partial-blank Add AND/Wire continuation, reloads Design, proves loaded Project continuity, exercises starter Design select/duplicate/delete/undo and wire delete/undo, then smoke checks Verify, Hardware, Export, and Import reload behavior at `1366x768` and `1440x900`. It fails on error boundaries, dynamic import failures, stale build hashes, root overflow, and console/page errors.

This gate is now part of `classroom:gate` and `verify:gates:classroom`.

### `ide:gate:final-current-build-smoke`

Protects release closeout proof from using stale screenshots or stale preview output. It refuses dirty tracked worktrees by default, then verifies root build metadata and `/os/build.json` match current Git HEAD while walking Project, Design, Verify, Hardware, Export, and Import. In V2 student UI, raw build hashes stay out of normal chrome, so this gate must not require a visible badge. Use it after the closeout commit and rebuild; it is not a replacement for focused defect gates or `classroom:gate`.

## Recommended Next Gates

| Proposed gate | Why |
|---|---|
| Next browser-first product defect | Inspect the live app first, rank visible normal-use issues, then add one focused browser gate for the selected defect. |
| Verify V2 merge-readiness review | Review PR #78 end to end against the V2 contracts, current gates, and remaining human/a11y/storage risks before readying the branch for merge. |
| Storage facade / quota-risk durability | Add a journaled storage facade, rolling snapshots, quota failure UX, and conflict resolution beyond the Phase 3F warning/rehearsal proof. |
| Vivado/Basys3 proof restoration | Refresh E1/E2/E3 evidence only from real Vivado 2024.2 and board runs, keeping browser E0 proof separate. |

## Attribution

Connor Angiel
