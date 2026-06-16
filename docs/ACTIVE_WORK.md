---
doc_status: current
last_validated: 2026-06-16
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte - Active Work Cockpit

**Branch:** main
**Canonical desktop clone:** `C:\Users\conno\redbyte-ui-genesis-main`
**Historical/local source clone:** `C:\Users\conno\OneDrive\Documents\RedByte FPGA`
**Remote:** `https://github.com/swaggyp52/redbyte-ui-genesis.git`
**Audited base commit for this reset:** `d235823a`
**Latest product/control slice:** Project Identity Editing v1
**Target hardware:** Basys3 (`xc7a35tcpg236-1`)
**Vivado target:** 2024.2

RedByte V1 is a browser-based Basys3 digital-logic lab workbench. The current RedByte-owned spine is:

```text
Project -> Design -> Verify -> Map Pins / Hardware -> Export
```

Import is a utility. Vivado build, board programming, and board observation are external proof tiers after Export.

## Top Priorities

1. **Use the under-the-hood docs before stateful product work.** The current source/state/proof control layer is `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`, `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`, `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md`, and `docs/development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md`.
2. **Hardware / Basys3 Workbench is closed locally.** `ide:gate:hardware-basys3-workbench` now proves the selected signal -> Basys3 board resource -> package pin -> XDC consequence chain at `1366x768` and `1440x900`, plus the ready-state E0 wording that keeps Vivado build, bitstream programming, and board observation external.
3. **Export Handoff Station is closed locally.** `ide:gate:export-handoff-station` now proves one visible station for Draft, Ready-to-build, and Trusted post-download states, visible package handoff, artifact workspace, README E0 boundary, mapping agreement, Vivado next steps, no E1/E2/E3 overclaim, and no root overflow or key-region overlap.
4. **Project Identity Editing v1 is closed locally.** `ide:gate:project-identity-editing` now proves top-bar, upper Project identity strip, and loaded Project title rename affordances, Escape cancel, Enter/blur save, navigation/reload persistence, title agreement, and a distinct starter source label at `1366x768` and `1440x900`.
5. **Project Interaction Affordance v1 is closed locally.** `ide:gate:interaction-affordance` now proves Project first launch has a dismissible and reopenable Workflow Orientation, the top-bar project title opens inline rename, Escape cancels, Enter saves through existing project persistence, reload preserves the renamed title, and the compact `Flow` affordance remains visible at `1366x768`.
6. **Export First-Viewport Artifact Visibility v1 is closed locally.** `ide:gate:export-first-viewport-artifacts` now proves the ready-to-build Logic Gates Export path keeps concrete artifact names visible inside the handoff station at `1366x768` and `1440x900`: `README.txt`, `top.vhd`, `top.xdc`, `testbench.vhd`, and `vivado_import.tcl`.
7. **Export Trust Integrity is closed.** `ide:gate:export-trust-integrity` now proves the mapped/verified Export handoff summary, artifact count, visible preview, ZIP entries, README/provenance, Draft/Trusted labels, and E0/E1/E2/E3 wording together.
8. **Verify Evidence Workbench is closed.** `ide:gate:verify-evidence-workbench-integrity` now proves visible first-run stimulus authoring, Compare PASS, intentional expected-output FAIL, first mismatch expected/observed evidence, waveform controls, and repair back to PASS without hiding the editor.
9. **Shell and Workbench Layout Reset is closed.** `ide:gate:shell-workbench-hierarchy` now proves one compact shell/status authority, demoted support footer, rail navigation without `OK` status copy, and first-viewport workbench frame geometry across Project, Design, Verify, Hardware, Export, and Import.
10. **Project Command Center / Starter Density is closed locally.** `ide:gate:project-command-center` now proves Project as a neutral command center with blank, starter, saved/recent, Import/recovery, loaded-project peer paths, no false no-circuit mapping/export failure copy, a guarded loaded-project Build Fresh action, and visible all-lab starter choices on first launch at `1366x768`, `1440x900`, and `1920x1080`.
11. **Active Mode Reload Recovery v1 is closed locally.** `ide:gate:active-mode-reload-recovery` now proves Project starter load syncs the URL to `mode=design`, reload restores Design, left-rail Verify navigation syncs to `mode=verify`, and reload restores Verify.
12. **Verify Saved Checks Default / Compare Intent v1 is closed locally.** `ide:gate:verify-saved-checks-default` now proves the Logic Gates starter arms saved checks before the first run, the primary action names Compare, first Run reaches Compare PASS, Compare remains armed after PASS, and students can still intentionally switch Observe/Compare.
13. **Design Workbench v1 is closed locally.** `ide:gate:design-workbench-v1` now proves blank, loaded starter, selected node, selected wire, wire start/cancel, move, delete/undo, split/code, and zoom/fit/center states at `1366x768` and `1440x900` with the canvas/graph as the focal object.
14. **Import / Recovery is closed locally.** `ide:gate:import-recovery-contract` now proves Project Import / Recover discoverability, RedByte manifest restore as the highest-fidelity path, Vivado/VHDL reconstruction limits, corrupt import safety, imported Verify proof invalidation, and no Vivado/hardware overclaim.
15. **Lab Profile / Course Pack Data Seam is closed locally.** `lab:profile-contract` now proves deterministic built-in profile metadata for Logic Gates, Half Adder, 2-Bit Counter, and the Lab 8 scaffold; validates starter references, IO coverage, export artifact expectations, E0-only proof claims, and solution-forbidden Lab 8 evidence.
16. **Student/Instructor Quickstarts are closed locally.** Current student, instructor, TA troubleshooting, and Windows course quickstart docs now live under `docs/course/` and match the Project -> Design -> Verify -> Map Pins / Hardware -> Export posture.
17. **Design No-Bridge Required is closed locally.** `ide:gate:design-no-bridge-required` now proves Design opens the Logic Gates starter at `1366x768` and `1440x900` with persisted hardware mode on, no bridge fatal copy, no ErrorBoundary/boot crash, and zero local bridge requests before Hardware mode.
18. **Workbench Space Utilization / Rail Collapse v1 is closed locally.** `ide:gate:workbench-space-utilization` now proves the primary work object owns meaningful space at `1366x768`, `1440x900`, and `1920x1080`: Design starts with Library/Inspector collapsed and restorable, Verify keeps the signal rail collapsed so waveform/evidence can breathe, and Project/Hardware/Export/Import keep first-order work/actions visible without root overflow.
19. **Workbench Visual Finish / Import Empty-State Composition v1 is closed locally.** `ide:gate:workbench-visual-finish` now proves Import first-look recovery uses one restore headline, no redundant command strip, visible RedByte ZIP / Paste HDL / structural sample / blocked example choices, first-viewport guidance fit, no root overflow, and neighboring Project/Design/Export captures at `1366x768`, `1440x900`, and `1920x1080`.
20. **Hardware Basys3 Vertical Hierarchy / Board Starts Too Low v1 is closed locally.** `ide:gate:hardware-first-viewport` now proves the Logic Gates starter Map Pins path keeps the Basys3 board/table and selected SW0 -> board resource -> package pin -> XDC chain first-order at `1366x768` and `1440x900`, without changing mapping semantics or claiming E1/E2/E3 proof.
21. **Next browser-first product-polish slice must be selected from live inspection.** Do not choose a target from stale docs; inspect the live app first, rank the visible normal-use issues, then pick one contained gateable defect.
22. **Next board-gated slice remains Vivado/Basys3 Proof Restoration.** Run only on a machine with Vivado 2024.2 and Basys3 hardware; do not make E1/E2/E3 claims from browser/docs evidence.
23. **Keep commercialization gated.** No paid classroom, SaaS/account, hosted-data, or broad commercial-readiness claim comes from this sprint.

Do not jump to accounts/SaaS, website polish, pilot/commercial packaging, broad UI cleanup, Vivado proof, or deeper course-pack authoring unless the user explicitly reprioritizes.

## Current Blockers / Risks

| Item | Current truth | Next action |
|---|---|---|
| V1 product contract | New V1 contract reset is the active target route. The older `RedByte_Product_Contract.md` remains broad/historical target context. | Use `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md` for near-term V1 surface work. |
| Runtime screenshot identity | Existing local servers have repeatedly been stale: old `localhost:5173` showed `a4fc624`, the user-visible `127.0.0.1:5174` showed `Build9a639a4`, and current sprint evidence used fresh `127.0.0.1:5175` with `Buildd235823`. | For future screenshot proof, verify the UI build hash before using an existing server. |
| Under-the-hood state authority | The sprint maps project runtime, circuitStore, logic-view camera/selection, Verify health, mapping, Export, Import, persistence, and proof-tier ownership. | Read the under-the-hood map and state authority matrix before changing stateful product code. |
| Shell/status hierarchy | Closed 2026-06-13: proof ribbon is the compact workflow/status authority, left rail is navigation without visible `OK` status copy, and the bottom footer is support chrome. `ide:gate:shell-workbench-hierarchy` guards the geometry and copy split. | Keep the new gate in `classroom:gate` and `verify:gates:classroom`; future surface slices should build on this shell rather than reopening global chrome by assumption. |
| Project command center starter density | Closed locally 2026-06-15: Project first launch now opens the all-lab starter shelf by default, tightens the starter cards, and uses `ide:gate:project-command-center` to prove visible lab starter choices across `1366x768`, `1440x900`, and `1920x1080`. | Preserve the strengthened gate; future Project polish should keep Build Fresh, Import / Recover, saved/recent work, and starter paths visible without creating course-first or hardware-proof claims. |
| Project interaction affordance | Closed locally 2026-06-16: the top-bar project title is now an inline rename control and the first-launch Workflow Orientation can be reopened from a compact `Flow` affordance after dismissal. `ide:gate:interaction-affordance` proves rename cancel/save, Project identity visibility, reload persistence, and orientation dismiss/reopen at `1366x768`. | Preserve the gate in `classroom:gate` and `verify:gates:classroom`; future Project or shell interaction work should keep primary identity and help affordances directly actionable without changing project format or proof-tier semantics. |
| Project identity editing | Closed locally 2026-06-16: loaded Project identity is now directly editable from the top bar, upper Project identity strip, loaded title, and adjacent Rename affordance. `ide:gate:project-identity-editing` proves double-click/click edit paths, Escape cancel, Enter/blur save, navigation/reload persistence, title agreement, and distinct starter source labeling at `1366x768` and `1440x900`. | Preserve the gate in `classroom:gate` and `verify:gates:classroom`; future Project interaction work should keep the lab/source label distinct from the user-owned project title. |
| Active mode reload recovery | Closed locally 2026-06-15: Project starter load and left-rail navigation now synchronize the `mode` query with the visible workspace, and `ide:gate:active-mode-reload-recovery` proves Design and Verify restore correctly after browser reload. | Preserve the gate in `classroom:gate` and `verify:gates:classroom`; future routing work should not assume visible React state is enough if the URL remains stale. |
| Verify saved-check run intent | Closed locally 2026-06-15: starters with saved expected outputs now arm Compare before the first run; `ide:gate:verify-saved-checks-default` proves Run Compare -> Compare PASS and explicit Observe/Compare switching without changing Verify result semantics. | Preserve the gate in `classroom:gate` and `verify:gates:classroom`; future Verify work should keep Observe-only distinct from saved-check Compare proof. |
| Design first viewport | Closed locally 2026-06-14: Design Canvas mode now keeps the canvas/graph primary, narrows palette/inspector pressure, keeps blank/I/O guidance visible, and `ide:gate:design-workbench-v1` covers blank, starter, selection, wire, move, delete/undo, split/code, and zoom/fit/center states at classroom and desktop viewports. | Preserve the new gate in `classroom:gate` and `verify:gates:classroom`; future Design changes should keep the graph first unless a stronger product contract replaces it. |
| Verify evidence workbench | Closed 2026-06-13: first-run stimulus editing stays visible, post-run stimulus chrome is denser, first mismatch expected/observed evidence is first-order, and `ide:gate:verify-evidence-workbench-integrity` guards PASS -> intentional FAIL -> repair PASS with overlap checks and screenshots. | Keep the new gate in `classroom:gate` and `verify:gates:classroom`; future Verify work should start from fresh evidence rather than reopening density by assumption. |
| Export trust integrity | Closed 2026-06-13: generated previews are visible by default, the focused gate compares visible previews with downloaded ZIP entries, and the mapping summary no longer contradicts mapped board I/O rows. | Keep `ide:gate:export-trust-integrity` in `classroom:gate` and `verify:gates:classroom`; do not reopen byte/trust proof without new evidence. |
| Export Handoff Station | Closed 2026-06-14: Draft, Ready-to-build, and Trusted post-download states now sit in one visible station with package handoff, artifact workspace, README E0 boundary, mapping agreement, Vivado next steps, and browser-only evidence boundaries proved by `ide:gate:export-handoff-station`. | Keep the gate in `classroom:gate` and `verify:gates:classroom`; future Export changes should preserve build/download as the primary station action unless product contract changes. |
| Export first-viewport artifact visibility | Closed locally 2026-06-16: `ide:gate:export-first-viewport-artifacts` proves the ready-to-build Logic Gates Export handoff station exposes concrete generated files in the first viewport at `1366x768` and `1440x900` while the downstream artifact explorer still renders. | Preserve the gate in `classroom:gate` and `verify:gates:classroom`; future Export density work must not hide artifact names below the fold or imply E1/E2/E3 proof from browser evidence. |
| Import utility access | Closed locally 2026-06-14: Project exposes Import / Recover, Import leads with RedByte manifest restore as highest fidelity, Vivado/VHDL is reconstruction-limited, corrupt import leaves current project intact, and imported Verify PASS is not trusted automatically. | Keep `ide:gate:import-recovery-contract` in `classroom:gate` and `verify:gates:classroom`; future arbitrary HDL migration work needs separate parser/source tests. |
| Hardware proof language | Closed 2026-06-14: Hardware ready state now says E0 only, the selected binding chain exposes signal, board resource, package pin, and XDC, and `ide:gate:hardware-basys3-workbench` is wired into classroom gates. | Preserve the gate and do not claim Vivado build, bitstream programming, or board observation without external E1/E2/E3 evidence. |
| Hardware first viewport | Closed locally 2026-06-15: `ide:gate:hardware-first-viewport` proves the selected Logic Gates Map Pins board/table and SW0 binding chain start high enough in the classroom and desktop first viewport while preserving E0-only Hardware wording. | Preserve the gate in `classroom:gate` and `verify:gates:classroom`; future Hardware layout work should not change pin mapping, generated XDC, or Vivado/Basys3 proof claims. |
| Lab profile/course-pack seam | Closed locally 2026-06-14 as a data-only seam under `packages/rb-apps/src/apps/ide/labProfiles/`; built-ins reference existing public starter/example IDs and keep Lab 8 scaffold solution-forbidden at E0 only. | Preserve `lab:profile-contract`; future course-pack work should build on the seam without moving simulation, Basys3, Verify, mapping, or export semantics into course data. |
| Student/instructor quickstarts | Closed locally 2026-06-14 under `docs/course/`: student first-lab path, instructor setup/support/proof-tier path, TA troubleshooting triage, and Windows course launcher reference. | Keep these docs as the current public-facing course path; legacy root quickstarts remain stale unless separately rewritten. |
| Design no-bridge boundary | Closed locally 2026-06-14: generic fetch/chunk failures no longer map to bridge fatal copy; explicit off hardware clients ignore persisted hardware mode; `ide:gate:design-no-bridge-required` proves Design does not require or contact the bridge before Hardware. | Preserve the new gate in `classroom:gate` and `verify:gates:classroom`; future Hardware changes must keep bridge access opt-in to Hardware/proof contexts. |
| Workbench space utilization | Closed locally 2026-06-14: persistent support rails were the highest-impact waste source; Design Library/Inspector and Verify Signals now start collapsed/restorable, hidden right docks no longer reserve phantom columns, and `ide:gate:workbench-space-utilization` captures before/after geometry across Project, Design, Verify, Hardware, Export, and Import. | Preserve the gate in `classroom:gate` and `verify:gates:classroom`; future layout slices should keep the primary work object dominant before adding persistent rails, cards, or status chrome. |
| Workbench visual finish / Import empty-state composition | Closed locally 2026-06-15: Import first-look no longer repeats the restore message in a command strip, the RedByte ZIP restore primary action is visually dominant, and Paste HDL / structural sample / blocked example alternatives are visible without opening a disclosure. | Preserve `ide:gate:workbench-visual-finish` in `classroom:gate` and `verify:gates:classroom`; future empty-state polish should use before/after screenshots and avoid changing import parser/apply semantics. |
| Fresh Vivado/Basys3 proof | Vivado 2024.2 and board proof were not run in this reset. | Use a Vivado 2024.2 + Basys3 machine before making new E1/E2/E3 claims. |
| Node pinned runtime | `.nvmrc` is `20.19.0`; current local proof uses Node `v24.15.0` and pnpm `10.24.0`. | Label Node 24 evidence honestly; rerun pinned-runtime proof when available. |

## Next Technical Task

**Target:** Browser-first product ownership: choose the next single visible normal-use defect from the live app.

Structured hardening ticket fields to start from after inspection:

- Title: name the observed defect precisely.
- Surface: the one surface or navigation path where the defect is visible.
- Journey segment: the normal student or professor workflow affected.
- Observed behavior: record screenshot-backed evidence at `1366x768` and `1440x900`.
- Expected behavior: define the smallest product repair without changing unrelated semantics.
- Minimum acceptance proof: intentional red if feasible, one focused browser gate or gate update, affected surface gates, `classroom:gate`, build/doc/encoding/diff checks, before/after screenshots, and no E1/E2/E3 claim unless real Vivado/Basys3 evidence is produced.

Board-gated proof remains a separate path: `docs: restore RedByte Vivado Basys3 proof` only on a machine with Vivado 2024.2 and Basys3 hardware.

## Latest Verified Evidence

| Evidence | Result |
|---|---|
| Project Identity Editing v1 | Closed locally 2026-06-16: added `ide:gate:project-identity-editing` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The intentional red run caught the loaded Project title not opening inline rename on double-click; after proof shows top-bar, upper identity strip, loaded title, and adjacent Rename edit paths; Escape cancel; Enter and blur save; Project/top-bar/strip title agreement; distinct source label; navigation/reload persistence; and no console/page errors at `1366x768` and `1440x900`. Before screenshots are under `.redbyte/product-immersion/project-identity-editing/before/`; after screenshots and observations are under `.redbyte/product-immersion/project-identity-editing/after/`. |
| Project Interaction Affordance v1 | Closed locally 2026-06-16: added `ide:gate:interaction-affordance` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The intentional red run caught the dismissed Workflow Orientation lacking a visible reopen affordance; after proof shows the `Flow` button reopens orientation, the top-bar title opens inline rename, Escape cancels, Enter saves `EE 141 Lab 2`, Project/top-bar identity update together, reload preserves the renamed title, and no console/page errors were captured. Before screenshots are under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/interaction-affordance/before/`; after screenshots and observations are under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/interaction-affordance/after/`. |
| Export First-Viewport Artifact Visibility v1 | Closed locally 2026-06-16: added `ide:gate:export-first-viewport-artifacts` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The intentional red run caught the ready-to-build Export handoff station not exposing artifact file names in the first viewport at `1366x768` and `1440x900`; after proof shows `README.txt`, `top.vhd`, `top.xdc`, `testbench.vhd`, and `vivado_import.tcl` visible inside the handoff station while the downstream artifact explorer still renders and no E1/E2/E3 proof is claimed. Before screenshots are under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/before/`; after screenshots and observations are under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/after/export-first-viewport-artifacts/`. |
| Hardware Basys3 Vertical Hierarchy / Board Starts Too Low v1 | Closed locally 2026-06-15: added `ide:gate:hardware-first-viewport` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The intentional red run caught the loaded Logic Gates Map Pins board/table starting below the tightened first-viewport threshold; after proof shows the board/table starting about `9px` higher while keeping the selected SW0 -> board resource -> `PACKAGE_PIN V17` -> XDC chain visible, no root overflow, and no Vivado/build/programming/observation overclaim. Before/after screenshots and metrics are local-only under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/hardware-first-viewport/`. |
| Verify Saved Checks Default / Compare Intent v1 | Closed locally 2026-06-15: added `ide:gate:verify-saved-checks-default` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The intentional red run caught the Logic Gates starter exposing saved checks while Observe-only remained armed and the primary action read `Run`; after proof shows saved checks armed, `Run Compare`, first Run reaching Compare PASS, `Update Compare` after PASS, and explicit Observe/Compare switching. Before/after screenshots are local-only under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/`. |
| Active Mode Reload Recovery v1 | Closed locally 2026-06-15: added `ide:gate:active-mode-reload-recovery` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The intentional red run caught Project starter load leaving the URL at `mode=project` while Design was visible; after proof shows starter load writes `mode=design`, reload restores Design, left-rail Verify writes `mode=verify`, and reload restores Verify. Before/after screenshots are local-only under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/`. |
| Project Starter Density / Command Center Lab Shelf v1 | Closed locally 2026-06-15: strengthened `ide:gate:project-command-center` so Project first launch is checked at `1366x768`, `1440x900`, and `1920x1080`; the intentional red run caught the hidden all-lab starter grid; after proof shows the all-lab shelf open by default with eight lab choices, a tighter launch command center, no console/page findings in after screenshots, and browser E0-only evidence under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/`. |
| Workbench Visual Finish / Import Empty-State Composition v1 | Closed locally 2026-06-15: added `ide:gate:workbench-visual-finish` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The intentional red run caught the duplicate Import command strip at `1366x768`, `1440x900`, and `1920x1080`; after proof shows one restore headline, visible RedByte ZIP / Paste HDL / structural sample / blocked example paths, compact recovery guidance above the fold, no root overflow, and Project/Design/Export neighbor captures. Screenshots and metrics are local-only under `.redbyte/product-immersion/workbench-visual-finish/`. |
| Workbench Space Utilization / Rail Collapse v1 | Closed locally 2026-06-14: added `ide:gate:workbench-space-utilization` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. Before proof caught the highest-impact defect: Design canvas was squeezed to `829px` at `1366x768` and Verify waveform/evidence to `491px`. After proof shows Design canvas at about `1185px`, Verify waveform/evidence at about `663px`, support rails collapsed/restorable, no root horizontal overflow, and Project/Hardware/Export/Import first-order work/actions visible. Screenshots and metrics are local-only under `.redbyte/product-immersion/workbench-space-utilization/`. |
| Design No-Bridge Required | Closed locally 2026-06-14: `studentError.test.ts` proves generic fetch/chunk failures are no longer labeled bridge-unreachable; `hardware-client-boundary.test.ts` proves explicit off bridge clients ignore persisted hardware mode; `ide:gate:design-no-bridge-required` proves Design loads the Logic Gates starter at classroom/desktop viewports with no bridge fatal copy, no ErrorBoundary/boot crash, and zero bridge-origin requests. Screenshots and manifest are local-only under `.redbyte/product-immersion/design-no-bridge-required/`. |
| Student/Instructor Quickstarts | Closed locally 2026-06-14: added current `docs/course/STUDENT_QUICKSTART.md`, `docs/course/INSTRUCTOR_QUICKSTART.md`, and `docs/course/TA_TROUBLESHOOTING_GUIDE.md`; routed README/DOC_INDEX/current-truth docs toward the `docs/course/` path; kept Import utility-scoped, E0/E1/E2/E3 separated, and Vivado/Basys3 proof external. |
| Lab Profile / Course Pack Data Seam | Closed locally 2026-06-14: added `packages/rb-apps/src/apps/ide/labProfiles/` with typed built-in profile metadata, `validateLabProfile`, `validateLabProfiles`, `assertNoSolutionLeak`, `listBuiltInLabProfiles`, and `getLabProfileById`; added `lab:profile-contract` to prove deterministic profile IDs, existing starter/example references, course metadata separation from runtime circuit state, IO/export/proof validation, duplicate/missing-reference diagnostics, and Lab 8 scaffold no-solution rejection. |
| Import / Recovery Utility Contract v1 | Closed locally 2026-06-14: added `ide:gate:import-recovery-contract` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The gate proves Project Import / Recover discoverability, RedByte manifest restore as highest fidelity, Vivado ZIP/VHDL reconstruction limits, corrupt import leaves the active project intact, manifest restore routes to editable project state, imported Verify PASS is not automatically trusted, and no Vivado/Basys3 proof is claimed. Before/after screenshots are local-only under `.redbyte/product-immersion/import-recovery-contract/`. |
| Design Workbench v1 | Closed locally 2026-06-14: added `ide:gate:design-workbench-v1` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The gate proves blank, loaded starter, selected node, selected wire, wire start/cancel, moved node, delete/undo restore, split/code, and zoom/fit/center states at `1366x768` and `1440x900`; after screenshots are local-only under `.redbyte/product-immersion/design-workbench-v1/after/`. |
| Hardware / Basys3 Workbench | Closed locally 2026-06-14: added `ide:gate:hardware-basys3-workbench` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The gate proves the Basys3 workbench at `1366x768` and `1440x900`, the selected SW0 chain from project signal to board resource to package pin to XDC lines, ready-state E0-only wording, no Vivado/programming/board-observation browser overclaim, and no root overflow. Before/after screenshots are local-only under `.redbyte/product-immersion/hardware-basys3-workbench/`. |
| Export Handoff Station | Closed locally 2026-06-14: added `ide:gate:export-handoff-station` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The gate proves Draft/Needs Review is not trusted and has a repair path, Ready-to-build and Trusted post-download keep one build/download primary action, package handoff is visible, artifact workspace includes README/top.vhd/top.xdc/testbench/vivado_import.tcl, README preview states E0 and E1/E2/E3 boundaries, mapping summaries agree, Vivado next steps are downstream, and the browser has no root overflow or key-region overlap. Before/after screenshots are local-only under `.redbyte/product-immersion/export-handoff-station/`. |
| Project Command Center | Closed locally 2026-06-15: `ide:gate:project-command-center` now covers first-launch command-center copy, blank/starter/saved/import paths, visible all-lab starter choices across classroom/desktop viewports, loaded-project peer entry paths, loaded Build Fresh guard, collapsed loaded starter browser, no premature no-circuit mapping/export failure copy, and first-viewport launch fit. After screenshots for the latest density pass are local-only under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/after/`. |
| Shell and Workbench Layout Reset | Closed 2026-06-13: added `ide:gate:shell-workbench-hierarchy` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The gate proves compact proof ribbon/evidence, support-only footer, rail navigation without `OK` status labels, workbench top at the compact shell boundary, visible focal objects, and no root overflow across Project, Design, Verify, Hardware, Export, and Import. After screenshots and geometry summary are local-only under `.redbyte/product-immersion/shell-workbench-layout-reset/after/`. |
| Verify Evidence Workbench | Closed 2026-06-13: added `ide:gate:verify-evidence-workbench-integrity` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The gate proves visible first-run stimulus editor and expected-output cells, Compare PASS, intentional expected-output edit to FAIL, visible first mismatch expected/observed values, waveform evidence, repair back to PASS, and no meaningful overlap among stimulus/waveform evidence regions. Browser screenshots are local-only under `.redbyte/product-immersion/verify-evidence-workbench/2026-06-13-after/`. |
| Export Trust Integrity | Closed 2026-06-13: added `ide:gate:export-trust-integrity` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. The gate proves mapped Logic Gates -> Verify Compare PASS -> Export READY -> Build Current Bundle, visible generated previews, downloaded Vivado ZIP entries, preview body parity, README/provenance E0/E1/E2/E3 boundary wording, XDC mapped pin count, and `EXPECTED_IO.json` output evidence. |
| Under-the-Hood Mastery Sprint | Created source-level subsystem map, state authority matrix, invariant matrix, normal-use breakage audit, and test/gate ownership doc. Added `ide:gate:design-workbench-integrity` and `ide:gate:shell-layout-integrity` to focused scripts, `classroom:gate`, and `verify:gates:classroom`. |
| Normal-use breakage audit | Fresh local server at `http://127.0.0.1:5175` showed `Buildd235823`; audit recorded no console/page errors and no Design blank-canvas regression. Export artifact preview visibility is now closed by the Export Trust Integrity / Export Handoff Station slices, and Import utility-access ambiguity is closed by the Import / Recovery slice. |
| V1 contract reset screenshot capture | 30 screenshots captured under `.redbyte/product-immersion/v1-contract-reset/screenshots/` across Project, Design, Verify observation, Verify PASS, Verify FAIL, Hardware, Export draft, Export ready, Import, and public start states at `1366x768`, `1440x900`, and `1920x1080`. Capture summary recorded zero console/page errors, zero root horizontal overflow, base URL `http://127.0.0.1:5174`, and UI build `2d17655` matching HEAD `2d176550`. |
| V1 competitive/workflow research | Official/primary-source research covered AMD Vivado UG892/UG908, Digilent Basys3/XDC, CircuitVerse, Logisim Evolution, Digital, HDLBits, and public university Basys3/Vivado lab workflows. |
| GitHub main pre-reset health | Before this docs slice, `main` at `2d176550` was in sync with `origin/main`. GitHub check-runs for `Classroom Truth Gates`, deploy, and manual Nightly Heavy Suites were green; optional manual screenshot/UI smoke jobs were skipped by design. |
| Nightly FPGA Bridge Proof repair | Done before this reset. Bridge proof stayed enabled, dynamic CI proof ports were used, broad port killing was removed, and GitHub Nightly Heavy Suites was green for the repaired commit. |
| Verify fail-edit-repair proof | `ide:gate:verify-fail-edit-repair` proves Compare PASS -> expected-output edit/stale -> rerun FAIL -> repair/stale -> rerun PASS, then Project PASS/CLEAN and Export current-Verify/ready-to-build truth. |
| General Lab Workbench Sprint 0 | `ide:gate:from-scratch-general-workflow` proves blank project -> two inputs -> AND -> output -> Verify Compare PASS -> Map Pins -> post-map Verify Compare PASS -> Export artifacts/README at E0 browser level. |
| Visual-system integrity history | Prior gates proved Project/Design bounded work areas, Verify command/evidence containment, Hardware guide/board/table visibility, and Export draft/ready handoff/evidence/action visibility. Current V1 screenshots still show higher-level contract issues, especially Design graph priority and Verify density. |

## Tracked Proof vs Local Generated Proof

Portable/tracked proof lives in docs:

- `docs/STUDENT_RELEASE_READINESS.md`
- `docs/release/vivado-basys3-certification-matrix.md`
- `docs/release/redbyte-bench-evidence-model.md`
- `docs/release/vivado-basys3-bench-intelligence-2026-05-05.md`
- `docs/release/proof/**`
- `docs/release/course-edition/08-validation-log.md`

Local/generated proof packs may be useful but are not guaranteed in a clean clone:

- `.redbyte/bench/runs/**`
- `.redbyte/product-immersion/**`
- `out/vivado-cert/**`
- `dist/**`
- `test-results/**`
- `playwright-report/**`

If a doc references a generated pack that is missing locally, do not treat the tracked doc as false. Regenerate raw packs only when the approved slice needs them.

## In-Flight Work

| Status | Item | Evidence |
|---|---|---|
| Closed | Under-the-Hood Mastery Sprint. | `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`; `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`; `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md`; normal-use audit; invariant gates. |
| Closed | Export Trust Integrity. | `RB-EXPORT-TRUST-001`; `ide:gate:export-trust-integrity`. |
| Closed | Verify Evidence Workbench. | `RB-VERIFY-EVIDENCE-001`; `ide:gate:verify-evidence-workbench-integrity`; screenshots under `.redbyte/product-immersion/verify-evidence-workbench/2026-06-13-after/`. |
| Closed | Shell and Workbench Layout Reset. | `RB-SHELL-001`; `ide:gate:shell-workbench-hierarchy`; screenshots under `.redbyte/product-immersion/shell-workbench-layout-reset/after/`. |
| Closed | Project Command Center. | `RB-PROJECT-CC-001`; `ide:gate:project-command-center`; screenshots under `.redbyte/product-immersion/project-command-center/after/`. |
| Closed | Export Handoff Station. | `RB-EXPORT-HANDOFF-001`; `ide:gate:export-handoff-station`; screenshots under `.redbyte/product-immersion/export-handoff-station/after/`. |
| Closed | Hardware / Basys3 Workbench. | `RB-HARDWARE-WB-001`; `ide:gate:hardware-basys3-workbench`; screenshots under `.redbyte/product-immersion/hardware-basys3-workbench/after/`. |
| Closed | Design Workbench v1. | `RB-DESIGN-WB-001`; `ide:gate:design-workbench-v1`; screenshots under `.redbyte/product-immersion/design-workbench-v1/after/`. |
| Closed | Import / Recovery. | `RB-IMPORT-001`; `RB-IMPORT-ACCESS-001`; `ide:gate:import-recovery-contract`; screenshots under `.redbyte/product-immersion/import-recovery-contract/after/`. |
| Closed | Lab Profile / Course Pack Data Seam. | `packages/rb-apps/src/apps/ide/labProfiles/`; `lab:profile-contract`; `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`; queue item 11. |
| Closed | Student/Instructor Quickstarts. | `docs/course/STUDENT_QUICKSTART.md`; `docs/course/INSTRUCTOR_QUICKSTART.md`; `docs/course/TA_TROUBLESHOOTING_GUIDE.md`; queue item 12. |
| Closed | Workbench Space Utilization / Rail Collapse v1. | `ide:gate:workbench-space-utilization`; screenshots and metrics under `.redbyte/product-immersion/workbench-space-utilization/`. |
| Closed | Hardware Basys3 Vertical Hierarchy / Board Starts Too Low v1. | `RB-HARDWARE-VIEWPORT-001`; `ide:gate:hardware-first-viewport`; screenshots and metrics under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/hardware-first-viewport/`. |
| Closed | Export First-Viewport Artifact Visibility v1. | `RB-EXPORT-FIRST-VIEWPORT-001`; `ide:gate:export-first-viewport-artifacts`; screenshots and observations under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/`. |
| Closed | Project Interaction Affordance v1. | `RB-PROJECT-INTERACTION-001`; `ide:gate:interaction-affordance`; screenshots and observations under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/interaction-affordance/`. |
| Closed | Project Identity Editing v1. | `RB-PROJECT-IDENTITY-001`; `ide:gate:project-identity-editing`; screenshots and observations under `.redbyte/product-immersion/project-identity-editing/`. |
| Closed | Active Mode Reload Recovery v1. | `ide:gate:active-mode-reload-recovery`; before/after screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/`. |
| Next / board-gated | Vivado/Basys3 proof restoration. | Requires Vivado 2024.2 and Basys3 hardware. |

## Cockpit Links

| What | Where |
|---|---|
| Startup truth hierarchy | `AGENTS.md`, `AI_STATE.md`, `docs/DOC_INDEX.md` |
| Compact current truth | `docs/product/RED_BYTE_CURRENT_TRUTH.md` |
| Ordered V1 work queue | `docs/product/RED_BYTE_WORK_QUEUE.md` |
| V1 product contract | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md` |
| Under-the-hood subsystem map | `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md` |
| State authority matrix | `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md` |
| Invariant matrix | `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md` |
| Normal-use breakage audit | `docs/audits/2026-06-13-redbyte-normal-use-breakage-audit.md` |
| Test/gate ownership | `docs/development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md` |
| V1 research | `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md` |
| V1 visual audit | `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md` |
| V1 delete/demote/rebuild inventory | `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md` |
| V1 execution program | `docs/plans/RED_BYTE_V1_EXECUTION_PROGRAM.md` |
| Product issue index | `docs/plans/2026-06-12-redbyte-product-issue-index.md` |
| Lab profile target model | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md` |
| Student quickstart | `docs/course/STUDENT_QUICKSTART.md` |
| Instructor quickstart | `docs/course/INSTRUCTOR_QUICKSTART.md` |
| TA troubleshooting guide | `docs/course/TA_TROUBLESHOOTING_GUIDE.md` |
| Product manual | `docs/manuals/RedByte_Product_Manual.md` |
| Release readiness / TA surface | `docs/STUDENT_RELEASE_READINESS.md` |
| Certification matrix | `docs/release/vivado-basys3-certification-matrix.md` |
| GitHub operations | `docs/development/RED_BYTE_GITHUB_OPERATIONS.md` |

## Operational Commands

```powershell
# Docs-only validation
corepack pnpm rb:doc:validate
corepack pnpm rb:encoding:check
git diff --check

# Local dev server in this Windows shell
pnpm run dev

# Fallback if the bare pnpm shim is missing
corepack pnpm run dev

# Fresh screenshot identity check before browser proof
git rev-parse --short HEAD
Invoke-WebRequest -Uri 'http://localhost:5173/?mode=project&e2e=1' -UseBasicParsing
```

## Update Rules

After every meaningful batch:

1. Reorder Top Priorities.
2. Add or resolve Blockers / Risks with evidence.
3. Replace Next Technical Task with the next concrete action.
4. Prepend Latest Verified Evidence when new validation or proof lands.
5. Keep generated/local proof clearly separate from tracked proof.
6. Bump `last_validated`.

This file is imported into `CLAUDE.md` via `@docs/ACTIVE_WORK.md`. Every agent session should treat it as the current cockpit after `AI_STATE.md`.
