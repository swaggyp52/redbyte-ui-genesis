---
doc_status: current
last_validated: 2026-06-20
owner: Connor Angiel
used_by_claude: true
role: ordered RedByte V1 execution program after contract reset
---

# RedByte V1 Execution Program

This program is the authoritative near-term execution sequence for RedByte V1 product work. It replaces the previous "lab-profile next" queue with a contract-first and invariant-first workbench reset.

## Program Rules

- One logical slice per commit.
- Start each product complaint from the hardening-ticket fields.
- Do not combine layout, Verify behavior, lab-profile data, Export generation, Hardware proof, or commercial packaging unless a direct dependency is proven.
- Browser screenshots prove layout. Tests prove behavior. Vivado/hardware runs prove downstream handoff.
- Preserve E0/E1/E2/E3 truth at every phase.

## Phase 12x - Release Readiness Tool Windows

Status: Closed 2026-06-18 by the Release Readiness Tool Windows v1 slice.

Goal: Remove the most visible release-readiness clipping/obstruction defects from the Design and Hardware workbench surfaces.

Why: Live browser evidence showed the Design Library was only `176px`/`184px` wide at the supported viewports and clipped visible board-resource controls, while Hardware resource summary cards were absolutely positioned over the Basys3 board. These were normal-use visual defects that made RedByte read as unfinished even though the underlying semantics were correct.

Proof:

- `ide:gate:design-library-not-cropped`
- `ide:gate:design-tool-window-coexistence`
- `ide:gate:hardware-board-unblocked`
- `ide:gate:hardware-resource-catalog-not-obstructing`
- `ide:gate:release-readiness-visual-contract`
- `ide:gate:no-cropped-controls-regression`
- Before/after screenshots under `.redbyte/product-immersion/release-readiness-reconstruction/2026-06-18/`.

Acceptance:

- Design Library is at least `260px` and visible controls do not clip horizontally.
- Design canvas remains usable beside open tool windows.
- Hardware resource summary/catalog content does not overlay the Basys3 board visual.
- No simulation, Verify, mapping, generated artifact, project-format, golden, Vivado, or Basys3 physical-proof semantics change.

## Phase 12y - Outer Workflow Command Surfaces + Verify Signals Dock

Status: Closed 2026-06-18 by the Outer Workflow Command Surfaces + Verify Signals Dock v1 slice.

Goal: Make the outer workflow surfaces feel like tools instead of static card/report pages, and repair the visibly cropped Verify Signals dock reported from live browser screenshots.

Why: Browser-first reconstruction showed loaded Project still needed a direct command surface, Import first-look still needed a clearer recovery wizard, and Export ready state still needed package-inspector behavior. The user also provided Verify screenshots showing the open Signals rail cropped to `136px`/`144px`, which made a core evidence support tool look unfinished.

Proof:

- `ide:gate:project-loaded-command-surface`
- `ide:gate:import-guided-recovery-wizard`
- `ide:gate:export-package-inspector`
- `ide:gate:outer-workflow-action-density`
- `ide:gate:card-chrome-regression`
- `ide:gate:verify-signals-dock-not-clipped`
- `ide:gate:side-dock-affordance`
- Before/after screenshots under `.redbyte/product-immersion/project-import-export-reconstruction/2026-06-18/`.

Acceptance:

- Loaded Project exposes direct Design / Verify / Map Pins / Export actions with secondary start/recovery paths and compact evidence.
- Import first-look presents recovery as staged wizard work with an explicit no-overwrite boundary.
- Export ready state opens as a package inspector with generated-file browser, selected artifact preview, and direct package actions.
- Verify Signals opens to a readable `224px` minimum rail with no horizontal clipping, while collapsed Signals remains compact.
- No simulation, Verify, mapping, import parser/apply, generated artifact, project-format, golden, Vivado, or Basys3 physical-proof semantics change.

## Phase 12z - Release Solidification v1

Status: Closed 2026-06-18 by the Verify / Export / Import release-solidification package.

Goal: Make the most release-critical active workbenches feel like usable tools after the broader reconstruction passes.

Why: Full browser inspection at `805b47a` showed the remaining shippability risk was no longer one missing control. Verify could still create an internal horizontal overflow trap when Signals opened, Export needed a compact package-readiness checklist that separated E0 browser/package proof from external Vivado/Basys3 proof, and Import selected-source recovery still underused the available workbench width.

Proof:

- `ide:gate:release-solidification-v1`
- `ide:gate:verify-signals-dock-not-clipped`
- `ide:gate:verify-postrun-workbench-usability`
- `ide:gate:verify-testbench-usable-layout`
- `ide:gate:export-package-inspector`
- `ide:gate:export-artifact-direct-preview`
- `ide:gate:import-guided-recovery-wizard`
- `ide:gate:import-guided-recovery-workflow`
- Shared workbench gates, `classroom:gate`, and `build:unified`
- Before/after screenshots under `.redbyte/product-immersion/release-solidification/2026-06-18/`.

Acceptance:

- Verify with Signals open has no internal horizontal overflow and keeps both stimulus and waveform lanes usable at `1366x768` and `1440x900`.
- Collapsed-Signals Verify still preserves waveform dominance in the normal post-run workbench.
- Export package inspector exposes a compact Package / Verify / Pin Mapping / E0 Boundary checklist without claiming E1/E2/E3 proof.
- Import selected-source recovery uses editor plus source-review lanes and survives reload continuity.
- No simulation, Verify, mapping, import parser/apply, generated artifact, project-format, golden, Vivado, or Basys3 physical-proof semantics change.

## Phase 12aa - Student Task Completion / Design Direct Edits v1

Status: Closed 2026-06-19 by `ide:gate:student-task-completion-flow`.

Goal: Make the complete student task loop feel usable at the point where students directly manipulate a selected circuit object.

Why: Browser-first inspection at `53bddd4` showed the highest contained defect was Design direct manipulation. Selecting an AND node opened a too-narrow right Inspector, Copy and Duplicate were cramped, and Swap type controls sat below the useful viewport. That made the circuit editor feel unfinished even though the Project, Verify, Hardware, and Export spine could complete.

Proof:

- `ide:gate:student-task-completion-flow`
- `ide:gate:design-inspector-contract`
- `ide:gate:design-workbench-v1`
- `ide:gate:design-tool-window-coexistence`
- `ide:gate:design-dual-tool-windows`
- Affected Verify, Hardware, Export, `classroom:gate`, and `build:unified`
- Before/after screenshots under `.redbyte/product-immersion/student-task-completion/2026-06-19/`.

Acceptance:

- Selecting a normal Design node exposes readable direct edit controls and type-swap options at `1366x768` and `1440x900`.
- The Design canvas remains the dominant work object beside the proportional Inspector.
- The same browser proof continues through Verify PASS/FAIL/repair/PASS, Hardware map visibility, and Export E0 handoff.
- No simulation, Verify result, Compare rule, expected-output meaning, pin mapping, import parser/apply behavior, generated artifact, project format, goldens, Vivado proof, or Basys3 physical-proof semantics change.

## Phase 12ab - Release Solidification v2 / Verify Actions + Project Orientation

Status: Closed 2026-06-19 by `ide:gate:release-solidification-v2`.

Goal: Remove the next live browser release-polish blockers after the student task slice: Project first-launch help blocking launch actions, and Verify PASS/repair continuation actions being clipped out of the useful viewport.

Why: Live browser inspection at `8bc9a28` ranked Verify post-run action visibility as the highest student/professor confidence risk and Project first-launch Workflow Orientation as the second contained normal-use obstruction. Export package clarity was comparatively stronger and remains guarded by v1 gates.

Proof:

- `ide:gate:release-solidification-v2`
- `ide:gate:interaction-affordance`
- `ide:gate:verify-postrun-workbench-usability`
- `ide:gate:verify-evidence-workbench-integrity`
- `ide:gate:release-solidification-v1`
- Affected Project/Export/student-task gates, `classroom:gate`, and `build:unified`
- Before/after screenshots under `.redbyte/product-immersion/release-solidification-2/2026-06-19/`.

Acceptance:

- First-launch Workflow Orientation is integrated, readable, and does not overlap Build Fresh, starter, or primary launch controls.
- Verify Compare PASS and repair PASS expose Continue to Hardware / Open Export / Back to Design in the first viewport.
- Intentional expected-output FAIL keeps first failing-check action visible and returns lower height to the evidence workspace instead of reserving blank result space.
- No simulation, Verify result, Compare rule, expected-output meaning, pin mapping, import parser/apply behavior, generated artifact, project format, goldens, Vivado proof, or Basys3 physical-proof semantics change.

## Phase 12ac - Authoring Depth + Release Safety Harness

Status: Closed 2026-06-19 by `ide:gate:authoring-depth-release-safety`; implementation commit `9a9b3eb34340281f968c402c79f4b454fda4e58d` was pushed, GitHub-green, and deployed with matching SHA proof.

Goal: Make the repeated-use blank authoring path continue like a workbench after Build Fresh, and harden final closeout proof so stale builds or dirty worktrees cannot masquerade as current evidence.

Why: Live browser inspection at `70813ee` showed the highest contained product defect in normal authoring depth: after Build Fresh and Add boundary I/O, Design had only input/output nodes and no visible direct Add gate/Wire continuation because the blank starter affordance disappeared and the Library remained collapsed. The same sprint also addressed the process failure where final screenshots/checks could be captured from the starting build instead of the final commit.

Proof:

- `ide:gate:authoring-depth-release-safety`
- `ide:gate:final-current-build-smoke`
- `ide:gate:blank-canvas-product-proof`
- `ide:gate:from-scratch-general-workflow`
- `ide:gate:design-workbench-v1`
- `ide:gate:design-workbench-integrity`
- `ide:gate:student-task-completion-flow`
- `ide:gate:design-workspace-crash-proof`
- `ide:gate:workbench-stability-overhaul`
- Focused Design placement/selection/authoring/runtime-history Vitest
- `classroom:gate` and `build:unified`
- Before/after screenshots under `.redbyte/product-immersion/authoring-depth-release-safety/2026-06-19/`.
- Final current-build smoke under `.redbyte/product-immersion/authoring-depth-release-safety/2026-06-19/final/`; deployed `/os/version.json` reported the implementation SHA.
- The local `verify:gates:classroom` attempt timed out at the outer runner and is classified as broad-suite timeout handling, not a focused gate failure; syntax and new/affected gates were checked separately.

Acceptance:

- Build Fresh -> Add boundary I/O leaves direct Add AND, Wire, and Open Verify continuation visible in the canvas at `1366x768` and `1440x900`.
- Direct Add AND increases the partial blank circuit from boundary I/O only to a gate-bearing authoring state without reopening the Library.
- Starter Design select/duplicate/delete/undo and wire delete/undo remain usable.
- Project continuity and Verify/Hardware/Export/Import reload smoke remain clean.
- Final closeout proof requires a clean tracked worktree by default and verifies visible build badge plus `/os/build.json` against current Git HEAD.
- No simulation, Verify result, Compare rule, expected-output meaning, pin mapping, import parser/apply behavior, generated artifact, project format, goldens, Vivado proof, or Basys3 physical-proof semantics change.

## Phase 12ad - Release Candidate Shakedown / Loaded Project Flow Auto-Collapse

Status: Closed locally 2026-06-19 by the strengthened `ide:gate:interaction-affordance`.

Goal: Make loaded Project feel like a command surface after real work exists instead of reopening with the full teaching-orientation card by default.

Why: Release-candidate browser shakedown at `5d4f048` covered Project first launch/loaded Project, Build Fresh, Design blank/starter authoring, Verify observe/compare/fail/repair/pass, Hardware mapping, Export handoff, Import recovery, navigation, reload, fresh context, and dirty context. The highest contained defect was loaded Project inheriting the full Workflow Orientation card after a starter was loaded, which kept the home surface in a card-heavy teaching state even though the `Flow` reopen affordance already existed.

Proof:

- `ide:gate:interaction-affordance`
- Focused OnboardingOverlay Vitest
- Affected Project/release gates, `classroom:gate`, and `build:unified`
- Before/after screenshots under `.redbyte/product-immersion/release-candidate-shakedown/2026-06-19/`.

Acceptance:

- First-launch/no-circuit Project still auto-shows integrated Workflow Orientation.
- Loaded Project does not auto-show the full Workflow Orientation card after real work exists.
- `Flow` remains visible as the explicit reopen control.
- Reopened help stays integrated and does not overlap loaded Project entry paths at `1366x768` and `1440x900`.
- No simulation, Verify result, Compare rule, expected-output meaning, pin mapping, import parser/apply behavior, generated artifact, project format, goldens, Vivado proof, or Basys3 physical-proof semantics change.

## Phase 12ae - Release Candidate Decision / Mode History + Node 20 Status

Status: Closed locally 2026-06-19 by the strengthened `ide:gate:active-mode-reload-recovery`, the release-candidate aggregate gate names, and `docs/product/RED_BYTE_RELEASE_CANDIDATE_DECISION.md`.

Goal: Decide whether RedByte is approaching a browser E0 release candidate, repair any release-safety blocker found by live Project/Verify audit, and record pinned Node proof status honestly.

Why: The release-candidate audit showed Project and Verify are functionally close enough for browser E0 proof, but browser Back/Forward after mode navigation could leave the RedByte shell because in-app mode changes used URL replacement. The same sprint needed to stop treating Node 20.19.0 proof as implicit when this shell only exposes Node 24.

Proof:

- Strengthened `ide:gate:active-mode-reload-recovery`
- `ide:gate:release-candidate-decision`
- `ide:gate:project-loaded-command-center-final`
- `ide:gate:verify-evidence-clarity-final`
- `ide:gate:node20-proof-status`
- `ide:gate:release-final-sha-discipline`
- Before/after screenshots and observations under `.redbyte/product-immersion/release-candidate-decision/2026-06-19/`.
- Node proof attempt under `.redbyte/product-immersion/release-candidate-decision/2026-06-19/node20-proof.txt`.

Acceptance:

- Project -> Design -> Verify mode navigation writes route state and browser Back/Forward restores RedByte surfaces instead of leaving the app shell.
- Reload still restores the active mode after Project starter load and left-rail navigation.
- Release-candidate report states current E0 browser posture, not-shippable items, final-SHA discipline, Node 20 status, and the no-E1/E2/E3 proof boundary.
- Node status is honest: either Node `20.19.0` is active, or the exact local blocker is recorded.
- No simulation, Verify result, Compare rule, expected-output meaning, pin mapping, import parser/apply behavior, generated artifact, project format, goldens, Vivado proof, or Basys3 physical-proof semantics change.

## Phase 12af - Pinned Runtime + Browser E0 Release Proof

Status: Closed locally 2026-06-19 by `docs/product/RED_BYTE_BROWSER_E0_RELEASE_PROOF.md` and Node `20.19.0` proof.

Goal: Stop the repeated `.nvmrc` proof gap by running a meaningful RedByte browser E0 release subset under Node `20.19.0`.

Why: Previous release-candidate work was locally green under Node `v24.15.0` while the repo pins Node `20.19.0`. Release confidence needed either direct Node 20 proof or an exact durable blocker.

Proof:

- Official Node `20.19.0` portable runtime under ignored `.redbyte/tools/node-v20.19.0/`
- SHA-256 verification against official `SHASUMS256.txt`
- `corepack pnpm install --frozen-lockfile`
- `build:unified`
- `ide:gate:release-candidate-decision`
- `ide:gate:release-final-sha-discipline`
- `ide:gate:authoring-depth-release-safety`
- `ide:gate:student-task-completion-flow`
- `classroom:gate`
- `rb:doc:validate`
- `rb:encoding:check`
- `git diff --check`

Acceptance:

- Node `v20.19.0` is active for proof commands.
- The full release/classroom subset passes under Node 20.
- Portable tools remain ignored and uncommitted.
- Browser E0 proof is documented separately from Vivado/Basys3 E1-E3 proof.
- No simulation, Verify result, Compare rule, expected-output meaning, pin mapping, generated artifact, project format, goldens, Vivado proof, or Basys3 physical-proof semantics change.

## Phase 12ag - Release Proof Fork / Browser E0 Verify Evidence Density

Status: Closed locally 2026-06-20 by the strengthened `ide:gate:verify-postrun-workbench-usability`.

Goal: Follow the release-proof fork honestly: attempt the Vivado/Basys3 path first, and when local prerequisites are absent, close one browser E0 product-proof defect without making hardware claims.

Why: Vivado, `xsct`, `hw_server`, Xilinx/Vivado environment variables, and a Basys3/Digilent/Xilinx-like USB device were unavailable in this shell, so E1/E2/E3 proof could not run. Live Project/Verify inspection still found a contained browser E0 release-polish defect: post-run Verify PASS/FAIL/repair left waveform evidence starting too low with too little visible chart area in the first viewport.

Proof:

- Hardware blocker recorded in `.redbyte-brain/hardware-proof-blocker.md`.
- Before/after browser proof under `.redbyte/product-immersion/browser-e0-polish/2026-06-20/`.
- `ide:gate:verify-postrun-workbench-usability` now checks waveform evidence top offset and viewport-visible chart height at `1366x768` and `1440x900`.
- Local proof ran under portable Node `v20.19.0` / pnpm `10.24.0`.

Acceptance:

- No Vivado build, bitstream, Basys3 programming, or physical observation proof is claimed.
- Verify Compare PASS, induced expected-output FAIL, and repair PASS keep the waveform evidence high and useful in the first viewport.
- The change is presentation/gate-only: no simulation, Verify result, Compare rule, expected-output meaning, pin mapping, import parser/apply behavior, generated artifact, project format, goldens, Vivado proof, or Basys3 physical-proof semantics change.

## Phase 12ah - Project Loaded Command Center + Browser E0 Packaging Readiness

Status: Closed locally 2026-06-20 by the strengthened `ide:gate:project-loaded-command-surface`, the new `ide:gate:browser-e0-packaging-readiness`, and `docs/product/RED_BYTE_BROWSER_E0_PACKAGING_CHECKLIST.md`; final commit, deployed-SHA proof, and GitHub green remain required for closeout.

Goal: Make loaded Project feel like a shippable command center instead of a status/card page, and give Browser E0 package/demo review a tracked checklist with enforceable no-overclaim boundaries.

Why: Live browser inspection at `53e0481` found the core Project/Design/Verify/Hardware/Export/Import spine usable, but loaded Project still exposed six boxed metric cards and read like a dashboard/report surface. The same package-readiness audit found Browser E0 proof spread across release docs without one checklist for final SHA, deploy, hardware, commercial, and exact no-overclaim language.

Proof:

- Before/after browser proof under `.redbyte/product-immersion/project-packaging-readiness/2026-06-20/`.
- `ide:gate:project-loaded-command-surface`
- `ide:gate:browser-e0-packaging-readiness`
- `ide:gate:release-candidate-decision`
- `classroom:gate`
- `build:unified`
- Docs validation, encoding check, and diff check

Acceptance:

- Loaded Project shows current identity, current next action, direct Design / Verify / Map Pins / Export routes, secondary starter/recovery paths, and compact evidence without boxed metric-card stacks.
- The Browser E0 packaging checklist records what E0 proves, what it does not prove, final/deployed SHA rules, Cloudflare/custom-domain checks, hardware blockers, commercial/licensed blockers, and exact no-overclaim language.
- The after flow covers Design edit return, Verify PASS/FAIL/repair, Hardware, Export, Import, reload, and Back/Forward continuity with visible build-hash proof, no root overflow, and no console/page errors.
- No simulation, Verify result, Compare rule, expected-output meaning, pin mapping, import parser/apply behavior, generated artifact, project format, goldens, Vivado proof, or Basys3 physical-proof semantics change.

## Phase 1 - V1 Contract Reset

Goal: Establish current research, visual audit, target contract, delete/demote/rebuild inventory, and execution order.

Why now: The previous queue was technically coherent but strategically premature. The live product still needs a workbench hierarchy reset before course-pack data extraction becomes the highest leverage slice.

Inputs:

- Current cockpit docs.
- Official/primary-source research.
- Current-HEAD screenshots at `1366x768`, `1440x900`, `1920x1080`.

Output artifacts:

- `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md`
- `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md`
- `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`
- `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md`
- `docs/plans/RED_BYTE_V1_EXECUTION_PROGRAM.md`
- Cockpit/current-truth/work-queue/issue-index/doc-index updates.

Acceptance criteria:

- Docs validate.
- Encoding check passes.
- `git diff --check` passes.
- No app source, tests, gates, goldens, or hardware proof changed.

Rollback:

- Revert the docs commit only.

## Phase 1.5 - Under-The-Hood Mastery Sprint

Goal: Build source-level ownership of RedByte internals before more reactive product patching.

Why: The Design zoom bug was fixed, but the fact that normal Fit controls could forward a React event into camera math showed that RedByte needed explicit invariants around state authorities, canvas geometry, trust derivation, persistence, and gate truth.

Output artifacts:

- `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`
- `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`
- `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md`
- `docs/audits/2026-06-13-redbyte-normal-use-breakage-audit.md`
- `docs/development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md`
- `ide:gate:design-workbench-integrity`
- `ide:gate:shell-layout-integrity`

Acceptance:

- At least two high-value invariant gates are part of `classroom:gate` and `verify:gates:classroom`.
- Normal-use audit records console/page errors, blank screens, invisible graphs, incorrect trust labels, state mismatch, overflow, and deferred product findings.
- No simulation, export generation, Basys3 mapping semantics, goldens, lab profiles, SaaS/accounts, or visual redesign changes are mixed into the sprint.

Rollback:

- Revert docs/gate commit only; no data migrations or generated artifact changes.

## Phase 1.6 - Export Trust Integrity

Status: Closed 2026-06-13 by `ide:gate:export-trust-integrity`.

Goal: Prove that Export's visible trust state and generated artifact evidence agree in a normal student workflow.

Why: The normal-use breakage audit reached generated-artifact state but did not find an obvious artifact preview. Earlier V1 evidence also showed mapping-summary contradiction risk. Export is the most consequential handoff, so its summary, artifact count, preview, ZIP bytes, README/provenance, Draft/Trusted labels, and proof-tier language must agree.

Implementation slices:

- Add focused Export trust integrity browser proof.
- Make the visible artifact preview unavoidable in the normal workflow if the gate proves it is missing.
- Verify downloaded ZIP entries and README/provenance against visible artifact state.
- Preserve export generation bytes unless a source-explained generator bug is found.

Proof:

- New `ide:gate:export-trust-integrity` or equivalent.
- Existing export artifact explorer, download, ready, blockers, and e2e gates.
- ZIP entry inspection.
- No E1/E2/E3 overclaim in browser-only proof.

Acceptance:

- Draft Export cannot look Trusted.
- Trusted Export requires current Compare PASS, current mapping, and current bundle.
- Artifact preview matches ZIP contents.
- Export does not claim Vivado build, programming, or physical observation.
- The 2026-06-13 closeout also fixed the mapped board I/O summary contradiction and made generated previews visible by default without changing generated artifact bytes.

Rollback:

- Revert Export trust slice; do not update goldens unless generator bytes intentionally changed and are source-explained.

## Phase 2 - Shell And Workbench Layout Reset

Status: Closed 2026-06-13 by `ide:gate:shell-workbench-hierarchy`.

Goal: Create one compact shell/status authority and a stable first-viewport workbench frame for all core surfaces.

Why: Current shell repeats stage state across top ribbon, left rail, surface headers, evidence box, right rail, and bottom status. This weakens first-viewport hierarchy and makes every surface harder to fix.

Implementation slices:

- Rebuilt global workflow/status ownership into the compact proof ribbon.
- Demoted bottom footer to support chrome and left rail to navigation without visible `OK` completion labels.
- Normalized the first-viewport workbench frame so the shell boundary starts at `y=96` at the classroom viewport.
- Preserved route/mode behavior.

Proof:

- Before/after screenshots for Project, Design, Verify PASS, Verify FAIL, Hardware, Export draft, Export ready, Import at `1366x768`.
- `ide:gate:shell-workbench-hierarchy`.
- Cross-viewport no-overflow geometry from `ide:gate:shell-layout-integrity`.
- Existing product-immersion, viewport, Verify, Hardware, Export gates green.

Acceptance:

- Each surface has one obvious job object and one primary next action.
- No behavior/export/hardware semantics changed.
- After screenshot summary recorded proof ribbon `48px`, evidence capsule `30px`, support footer `20px`, workbench top `96px`, and no root horizontal overflow at `1366x768`.

Rollback:

- Revert shell/layout commit; no data migrations.

## Phase 3 - Verify Evidence Workbench

Status: Closed 2026-06-13 by `ide:gate:verify-evidence-workbench-integrity`. This phase landed before the shell reset because the preceding control checkpoint selected Verify as the trust-critical next slice.

Goal: Rebuild Verify around stimulus, expected output, observed output, mismatch/pass, waveform, and repair action.

Why: The evidence loop is the learning loop. Current behavior is strong, but visual density still reads as a control deck.

Implementation slices:

- Evidence hierarchy.
- Failure repair first viewport.
- Waveform and tick/case readability.
- Expected-output editing containment.

Proof:

- `ide:gate:verify-evidence-workbench-integrity`.
- `ide:gate:verify-fail-edit-repair`.
- Verify workbench and contract gates.
- PASS and FAIL screenshots at `1366x768`, `1440x900`, `1920x1080`.

Acceptance:

- Observe/Compare distinction remains visible.
- First mismatch is easier to inspect.
- No simulation or Verify result semantics changed unless the ticket explicitly targets behavior and tests prove it.
- First-run starter vectors no longer hide the expected-output editor behind a collapsed strip.

Rollback:

- Revert Verify presentation slice; behavior tests protect semantics.

## Phase 4 - Project Command Center

Status: Closed locally 2026-06-13 by the Project Command Center slice.

Goal: Make Project the command center for blank, starter, saved, import/recovery, and future instructor lab paths.

Why: Project currently remains starter/course-first. V1 needs a product-general command center before course packs become first-class.

Implementation slices:

- Neutral no-circuit state.
- Blank/starter/saved/import path hierarchy.
- Current lab status and next action.
- Course-specific copy demotion.

Proof:

- Clean first-launch and loaded-project screenshots at `1366x768` and `1440x900`.
- `ide:gate:project-command-center`, Project readiness/overview gates, shell hierarchy gate, and classroom gate.
- Product immersion project path under `.redbyte/product-immersion/project-command-center/after/`.

Acceptance:

- No-circuit state does not report false mapping failure.
- A new student can identify the next action without scrolling.

Rollback:

- Revert Project surface copy/layout slice.

## Phase 5 - Export Handoff Station

Status: Closed 2026-06-14 by `ide:gate:export-handoff-station`.

Goal: Make Export the single source for draft/E0-ready package trust and Vivado handoff.

Why: Export is the most consequential handoff. Trust integrity is gate-backed, and the surface now presents package readiness, mapping/provenance, artifact workspace, evidence boundary, and Vivado next steps as one handoff station.

Implementation slices:

- One trust state.
- Mapping summary correction already closed by Phase 1.6; preserve it.
- Artifact provenance.
- Vivado next steps and E0/E1/E2/E3 ladder.

Proof:

- Export draft and ready screenshots.
- `ide:gate:export-handoff-station`.
- Export download/artifact explorer/ready/trust gates.
- Package generation tests if generation code changes.

Acceptance:

- No regression of the fixed mapped board I/O summary.
- E0 ready never implies E1/E2/E3.
- Ready/Trusted station primary action remains build/download, not a hardware proof claim.
- The 2026-06-14 closeout changed Export presentation and station action routing only; no VHDL/XDC/testbench/Tcl/ZIP/golden bytes were changed.

Rollback:

- Revert Export surface slice; no golden update unless artifact bytes intentionally changed and are source-explained.

## Phase 6 - Hardware / Basys3 Workbench

Status: Closed 2026-06-14 by `ide:gate:hardware-basys3-workbench`.

Goal: Make Map Pins a direct Basys3 binding workbench.

Why: This is RedByte's FPGA differentiation: project signal to board resource to package pin to XDC.

Implementation slices:

- E0 handoff wording tightened so Hardware ready state does not imply Vivado build, bitstream programming, or board observation.
- Selected-row signal/table/board hierarchy now exposes project signal -> board resource -> package pin -> XDC consequence.
- Basys3 resource summary remains visible without displacing the board/table workbench.
- Clock/resource language now stays mapping/XDC-oriented.

Proof:

- `ide:gate:hardware-basys3-workbench`.
- Hardware visual credibility gate.
- Map Pins recovery gate.
- Export trust/handoff gates.
- Before/after screenshots at `1366x768` and `1440x900`.

Acceptance:

- Students see signal rows and board together.
- The selected signal -> board resource -> package pin -> XDC chain is visible.
- No hardware-ready claim without E1/E2/E3 proof.
- The 2026-06-14 closeout changed Hardware presentation, gate coverage, and tests only; no VHDL/XDC/testbench/Tcl/ZIP/golden bytes were changed.

Rollback:

- Revert Hardware presentation slice; pin mapping tests protect semantics.

## Phase 7 - Design Workbench

Status: Closed 2026-06-14 by `ide:gate:design-workbench-v1`.

Goal: Make the circuit graph the first object in Design.

Why: RedByte cannot be credible as a lab workbench if the loaded circuit is not visible immediately.

Implementation slices:

- Canvas-first first viewport.
- Palette and toolbar compaction.
- Starter/context demotion.
- Inspector demotion unless selection exists.

Proof:

- Starter Design screenshot shows meaningful nodes/connections at `1366x768`.
- `ide:gate:design-workbench-v1`.
- Design workbench, placement, wire interaction, zoom integrity, and focused gates green.
- Before/after screenshots at `1366x768` and `1440x900`.

Acceptance:

- A student can inspect the loaded circuit before scrolling.
- No circuit graph/editor behavior regression.
- The 2026-06-14 closeout changed Design presentation, browser gate coverage, and focused tests only; no simulation, Verify, pin mapping, VHDL/XDC/testbench/Tcl/ZIP/golden bytes were changed.

Rollback:

- Revert Design layout slice.

## Phase 8 - Import / Recovery

Status: Closed 2026-06-14 by `ide:gate:import-recovery-contract`.

Goal: Make Import a trustworthy utility path for RedByte project recovery and representative Vivado/HDL inputs.

Why: Project exposes Import / Recover entry points, but Import needed representative RedByte manifest restore, Vivado/HDL reconstruction-limit copy, failure recovery, and review-before-apply safety proof. Import remains useful but not the main V1 spine.

Implementation slices:

- Clarify the loaded-project Import / Recover utility path.
- Prove good-package import fidelity and corrupt/unsupported package recovery messages.
- Keep active projects from being replaced before review/apply.
- Preserve Export generation, Verify, simulation, and mapping semantics.

Proof:

- `ide:gate:import-recovery-contract`.
- Existing import/export recovery and focused Import/project-format tests.
- Project/Import screenshots under `.redbyte/product-immersion/import-recovery-contract/`.
- Classroom gate.

Acceptance:

- A student or instructor can find Import / Recover from the current product flow.
- Import review is explicit before replacing active work.
- Failure messages are recoverable and do not corrupt the current project.
- RedByte manifest restore is labeled highest fidelity; Vivado ZIP/VHDL is labeled reconstruction-limited.
- Imported Verify proof is not automatically trusted.

Closeout:

- The 2026-06-14 closeout changed Import/Project utility copy, browser gate coverage, one ECE141 helper, and docs only; no parser breadth, generated bytes, Verify semantics, simulation semantics, pin semantics, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert Import utility slice; no golden update unless import/export bytes intentionally change and are source-explained.

## Phase 9 - Lab Profile / Course Pack Data Seam

Status: Closed 2026-06-14 by `lab:profile-contract`.

Goal: Introduce the first small data seam for professor-authored labs and course packs.

Why: Course packs are important, but should build on a stable workbench contract.

Implementation slices:

- Added one data-only profile-backed seam under `packages/rb-apps/src/apps/ide/labProfiles/`.
- Added built-in profiles for Logic Gates, Half Adder, 2-Bit Counter, and the Lab 8 Security Lock scaffold.
- Kept course/profile metadata separate from runtime circuit state and kept no-solution policy explicit.

Proof:

- `lab:profile-contract`.
- Existing starter/example references are validated against the IDE catalog.
- No-solution policy rejects solved Lab 8 starter evidence.

Acceptance:

- A supported lab shape can be represented as profile metadata without editing core board/export semantics.
- Basys3 resource and proof-tier logic stays core.
- No browser, Vivado, Basys3, generator, golden, or project-format claim changed in this phase.

Rollback:

- Revert data seam; starter behavior remains intact.

## Phase 10 - Student/Instructor Quickstarts

Status: Closed 2026-06-14 by the current course quickstart docs under `docs/course/`.

Goal: Create public-facing quickstarts that do not depend on agent context.

Why: Classroom adoption requires readable instructions and support boundaries.

Implementation slices:

- Student first lab: `docs/course/STUDENT_QUICKSTART.md`.
- Instructor setup/support: `docs/course/INSTRUCTOR_QUICKSTART.md`.
- TA troubleshooting and support triage: `docs/course/TA_TROUBLESHOOTING_GUIDE.md`.
- Windows setup and launch reference: `docs/course/windows-quickstart.md`.
- Known limitations and proof tiers.

Proof:

- Docs validation.
- Encoding check.
- Diff whitespace check.
- Manual cross-check against current cockpit, product manual, release readiness, certification matrix, proof-tier docs, and current IDE surface specs.

Acceptance:

- A student can follow the first lab without internal docs.
- An instructor can understand E0/E1/E2/E3 requirements.
- A TA can triage setup, Verify, Hardware, Export, Vivado, board observation, and Import issues without OS-era quickstarts.
- Import stays a utility path and no new Vivado/Basys3 proof is claimed.

Rollback:

- Revert docs.

## Phase 10.5 - Workbench Space Utilization / Rail Collapse v1

Status: Closed 2026-06-14 by `ide:gate:workbench-space-utilization`.

Goal: Reclaim first-viewport space so the primary work object owns the screen.

Why: After the surface-specific V1 slices, the app still looked unfinished because persistent support rails, right inspectors, and hidden dock columns boxed in Design and Verify while leaving other surfaces feeling scaffold-heavy. The highest-impact contained fix was to collapse/demote support rails by default and prove cross-surface geometry rather than redesign every page.

Implementation slices:

- Design Canvas mode now starts with Library and Inspector collapsed but restorable.
- Verify starts with the Signals support rail collapsed so waveform/evidence has more useful width.
- Hidden/collapsed right docks no longer reserve a phantom grid column.
- Collapsed rail labels are compact vertical restore affordances instead of horizontal text squeezed into a narrow slot.

Proof:

- `ide:gate:workbench-space-utilization`.
- Before/after screenshots and metrics under `.redbyte/product-immersion/workbench-space-utilization/`.
- Affected Design, Verify, shell, Project, Hardware, Export, and Import gates.
- Classroom gate.

Acceptance:

- Design canvas, Verify waveform/evidence, and Hardware board/table meet useful minimum geometry at `1366x768`, `1440x900`, and `1920x1080`.
- Project, Export, and Import primary actions remain visible and not buried behind chrome.
- Collapsed rails can still be opened when needed.
- No simulation, Verify result, pin mapping, export generation, project data, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the rail/layout slice; behavior and generator tests protect non-layout semantics.

## Phase 10.6 - Workbench Visual Finish / Import Empty-State Composition v1

Status: Closed 2026-06-15 by `ide:gate:workbench-visual-finish`.

Goal: Remove the clearest remaining unfinished empty-state composition after the rail-pressure fix.

Why: Import first-look repeated the same RedByte restore message in the command strip and hero, hid viable recovery paths behind a disclosure, and pushed recovery guidance too low in the first viewport. This made the product still feel scaffold-heavy without requiring parser, export, Verify, hardware, or data-model changes.

Implementation slices:

- Suppressed the Import command strip only for the first-look restore state.
- Kept the RedByte Project/Vivado ZIP action as the dominant primary action.
- Moved Paste HDL, structural sample, and blocked-example recovery paths into visible first-look alternatives.
- Tightened Import first-look spacing and guidance cards so the recovery object fits above the fold at classroom/desktop/wide widths.

Proof:

- Intentional red `ide:gate:workbench-visual-finish` caught the duplicate first-look command strip at `1366x768`, `1440x900`, and `1920x1080`.
- Passing `ide:gate:workbench-visual-finish` after the fix with screenshots and metrics under `.redbyte/product-immersion/workbench-visual-finish/`.
- Focused Import first-look Vitest coverage.
- Import recovery, Project command center, Export handoff station, Workbench Space Utilization, and classroom gates.

Acceptance:

- Import first-look has exactly one visible restore headline and no redundant command strip.
- RedByte ZIP, Paste HDL, structural sample, and blocked example paths are visible without opening a disclosure.
- Recovery guidance fits in the first viewport with no root overflow at `1366x768`, `1440x900`, and `1920x1080`.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Import first-look layout slice and remove the visual-finish gate wiring; Import recovery contract protects parser/apply safety separately.

## Phase 10.7 - Active Mode Reload Recovery v1

Status: Closed 2026-06-15 by `ide:gate:active-mode-reload-recovery`.

Goal: Preserve the visible active workspace across browser refresh after in-app navigation.

Why: Browser-first review found that loading a Project starter moved the visible app to Design while the URL still said `mode=project`. A normal refresh therefore reopened Project instead of the active Design workbench. This is a continuity and trust defect, not a layout redesign.

Implementation slices:

- Synchronize the `mode` query when the normalized active IDE mode changes.
- Preserve existing proof/query parameters such as `e2e`, `gate`, and `ownership`.
- Keep default no-query Project launch unchanged.
- Add one focused browser gate for Project starter load and left-rail Verify reload recovery.

Proof:

- Intentional red `ide:gate:active-mode-reload-recovery` caught starter-loaded Design at stale `mode=project`.
- Passing `ide:gate:active-mode-reload-recovery` after the fix.
- Before/after screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/`.
- Classroom gate.

Acceptance:

- Project starter load writes `mode=design` before refresh.
- Reload restores Design after starter load.
- Left-rail Verify navigation writes `mode=verify` before refresh.
- Reload restores Verify after left-rail navigation.
- No Project layout, starter data, simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the route-sync hook and active-mode reload gate wiring; route/layout gates protect boot and visible shell behavior separately.

## Phase 10.8 - Verify Saved Checks Default / Compare Intent v1

Status: Closed 2026-06-15 by `ide:gate:verify-saved-checks-default`.

Goal: Make starter saved-check proof intent visible and correct before the first Verify run.

Why: Browser-first review found that the Logic Gates starter had saved expected outputs available, but the first-run control still looked Observe-first and the primary action did not name Compare. That undercut student and professor confidence because the starter appeared to need a manual mode switch before producing trusted comparison evidence.

Implementation slices:

- Default Verify next-run intent to Compare when there is no previous run and saved expected outputs exist.
- Preserve explicit student Observe-only and Compare-checks switching.
- Reset untouched run intent when the vector collection changes.
- Update compact command copy so saved-check runs say `Run Compare` / `Update Compare` when Compare is armed.
- Add one focused browser gate for the Logic Gates starter saved-check first-run path at `1366x768` and `1440x900`.

Proof:

- Intentional red `ide:gate:verify-saved-checks-default` caught saved checks available while Observe-only was armed and the action read `Run`.
- Passing `ide:gate:verify-saved-checks-default` after the fix with screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/after/verify-saved-checks-default/`.
- Focused Verify Vitest coverage.
- Affected Verify gates and classroom gate.

Acceptance:

- Starter saved checks are available and armed before the first run.
- The primary action and explainer name Compare when saved checks are armed.
- Clicking Run without manually switching mode reaches Compare PASS.
- Compare remains armed after PASS, and explicit Observe-only / Compare switching still works.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Verify next-run intent and focused gate wiring; existing Verify contract and evidence-workbench gates continue to protect result semantics separately.

## Phase 10.9 - Hardware Basys3 Vertical Hierarchy / Board Starts Too Low v1

Status: Closed 2026-06-15 by `ide:gate:hardware-first-viewport`.

Goal: Keep the Hardware Map Pins board/table and selected binding chain first-order in the classroom viewport.

Why: Browser-first review found that the Logic Gates starter Hardware workbench was semantically correct but still felt visually unfinished because the main board/table mapping object started too low at `1366x768`. This was a product hierarchy defect, not a pin-mapping, generated-artifact, or hardware-proof defect.

Implementation slices:

- Added one focused browser gate for the Logic Gates starter Hardware first-viewport path at `1366x768` and `1440x900`.
- Tightened Hardware-only workbench header/canvas spacing so the Basys3 board/table starts higher.
- Preserved the selected SW0 -> board resource -> package pin -> XDC consequence chain and the E0-only Hardware wording.

Proof:

- Intentional red `ide:gate:hardware-first-viewport` caught the loaded starter board/table below the tightened first-viewport threshold.
- Passing `ide:gate:hardware-first-viewport` after the fix with before/after screenshots and observations under `.redbyte/product-immersion/browser-first-ownership/2026-06-15/hardware-first-viewport/`.
- `ide:gate:hardware-basys3-workbench`, Map Pins recovery, Export handoff, Workbench Space Utilization, focused Hardware/mapping tests, and classroom gate.

Acceptance:

- The board workspace, mapping table, Basys3 board, and selected binding chain are visible high enough at `1366x768` and `1440x900`.
- SW0 and `PACKAGE_PIN V17` remain visible in the Hardware proof path.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Hardware layout slice and focused gate wiring; Hardware workbench and mapping tests protect non-layout semantics separately.

## Phase 10.10 - Export First-Viewport Artifact Visibility v1

Status: Closed 2026-06-16 by `ide:gate:export-first-viewport-artifacts`.

Goal: Keep concrete generated artifact files visible inside the ready-to-build Export handoff station at classroom and desktop viewport sizes.

Why: Browser-first review found that Export asked students and professors to inspect files below, but the actual generated artifact names were below the first viewport in the normal ready-to-build path. This weakened the handoff at the exact moment professors need confidence that RedByte produced a real Vivado package.

Implementation slices:

- Added one focused browser gate for the Logic Gates ready-to-build Export path at `1366x768` and `1440x900`.
- Added a compact artifact strip to the existing Export handoff station using the existing generated artifact list.
- Kept the downstream artifact explorer present and unchanged.

Proof:

- Intentional red `ide:gate:export-first-viewport-artifacts` caught the missing first-viewport artifact filenames at both required viewports.
- Passing `ide:gate:export-first-viewport-artifacts` after the fix with before screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/before/` and after screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/after/export-first-viewport-artifacts/`.
- Export handoff, artifact explorer, download, e2e, trust-integrity, focused Export Vitest, and classroom gates.

Acceptance:

- `README.txt`, `top.vhd`, `top.xdc`, `testbench.vhd`, and `vivado_import.tcl` are visible in the handoff station at `1366x768` and `1440x900`.
- The artifact explorer still renders below the station.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Export presentation slice and focused gate wiring; existing Export trust and artifact gates protect generated-package semantics separately.

## Phase 10.11 - Project Interaction Affordance v1

Status: Closed 2026-06-16 by `ide:gate:interaction-affordance`.

Goal: Make Project identity and first-run workflow help directly actionable instead of passive chrome.

Why: Browser-first review and user feedback found that the top-bar project title looked like important identity but could not be clicked to rename, and the first-launch Workflow Orientation overlay was in the way but had no visible way to reopen after dismissal. This was a normal-use interaction defect, not a Project data-format or workflow-semantics change.

Implementation slices:

- Added one focused browser gate for Project first-launch interaction affordance at `1366x768`.
- Made the top-bar project title an inline rename control with Escape cancel and Enter/blur save.
- Saved committed title changes through the existing project snapshot/session restore path.
- Added a compact `Flow` top-bar affordance to reopen Workflow Orientation after dismissal.

Proof:

- Intentional red `ide:gate:interaction-affordance` caught the missing Workflow Orientation reopen affordance.
- Passing `ide:gate:interaction-affordance` after the fix with before/after screenshots and observations under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/interaction-affordance/`.
- Project command center, active-mode reload recovery, persistence, focused Project Vitest, and classroom gates.

Acceptance:

- Workflow Orientation can be dismissed and reopened from visible UI.
- Clicking the top-bar title opens inline rename.
- Escape cancels a rename.
- Enter saves a rename, updates both top-bar and Project identity copy, and persists after reload.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the top-bar interaction slice and focused gate wiring; existing Project command-center and persistence gates protect broader Project state separately.

## Phase 10.12 - Project Identity Editing v1

Status: Closed 2026-06-16 by `ide:gate:project-identity-editing`.

Goal: Make the visible Project/lab title behave like real editable project identity after a project or starter is loaded.

Why: User feedback and live browser inspection showed the previous Project Interaction Affordance slice was still incomplete: the loaded Project title looked like the obvious identity label, but double-clicking it did not open rename. The product still felt too static because the primary identity surface was informational instead of functional.

Implementation slices:

- Added one focused browser gate for Project identity editing at `1366x768` and `1440x900`.
- Kept the top-bar title double-click editable and added explicit loaded Project title and upper Project identity strip edit paths.
- Reused existing project rename/persistence state so Enter, blur, route navigation, and reload keep the saved title.
- Added a distinct loaded starter source label so the starter/lab name remains visible without competing with the user-owned project title.
- Added repo-local frontend surface, interaction-affordance, and Obsidian brain skills, plus an ignored `.redbyte-brain/` scratchpad policy.

Proof:

- Intentional red `ide:gate:project-identity-editing` caught the loaded Project title not opening inline rename on double-click.
- Passing `ide:gate:project-identity-editing` after the fix with before/after screenshots and observations under `.redbyte/product-immersion/project-identity-editing/`.
- Interaction affordance, Project command center, persistence, focused Project/runtime Vitest, and classroom gates.

Acceptance:

- Top-bar, upper Project identity strip, loaded Project title, and adjacent Rename affordances open rename.
- Escape cancels without saving.
- Enter and blur save through existing project persistence.
- Project/top-bar/strip titles agree after rename.
- Starter/source label stays distinct from the renamed project title.
- Navigation and browser reload preserve the saved title.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Project identity editing slice and focused gate wiring; existing Project command-center, interaction-affordance, and persistence gates protect broader Project state separately.

## Phase 10.13 - Side Dock Affordance v1

Status: Closed 2026-06-16 by `ide:gate:side-dock-affordance`.

Goal: Make collapsed side docks behave like compact restore controls instead of awkward sideways scaffolding.

Why: Browser-first inspection at `1366x768` and `1440x900` showed the most frequent side-dock defect was not open-panel content yet; it was the collapsed rail presentation. Design, Verify, Hardware, and Export exposed `Library`, `Signals`, or `Inspector` as vertical labels, and Verify reserved an oversized `56px` collapsed rail.

Implementation slices:

- Added one focused browser gate for side-dock affordance across Project, Design, Verify, Hardware, Export, and Import.
- Standardized collapsed dock rail slots to `48px`.
- Replaced visible sideways labels with compact horizontal `+ / Show / Lib|Sig|Info` restore controls while preserving full accessible labels.
- Added a final Design-specific grid override so legacy `26px` collapsed-right columns honor the resolved shell slot variables.
- Kept open dock content, support dock policy, simulation, Verify semantics, mapping, export generation, project format, and goldens unchanged.

Proof:

- Intentional red `ide:gate:side-dock-affordance` caught vertical collapsed labels and the oversized Verify rail.
- Passing `ide:gate:side-dock-affordance` after the fix with before/after screenshots and observations under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/side-dock-affordance/`.
- Workbench space utilization, shell workbench hierarchy, Design Workbench v1, Verify evidence workbench, Hardware first viewport, Export first-viewport artifacts, Import recovery, focused shell Vitest, and classroom gates.

Acceptance:

- Collapsed support docks are focusable restore buttons with clear `Show` copy.
- Collapsed labels are horizontal and readable, not vertical or sideways.
- Collapsed rails fit inside a compact `48px` slot.
- Opening a dock reveals readable support content.
- Closing a dock restores workbench space.
- Project, Design, Verify, Hardware, Export, and Import focal work objects remain visible at classroom and desktop viewports.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the side-dock rail markup/CSS and focused gate wiring; existing workbench-space and shell-hierarchy gates protect broader shell geometry separately.

## Phase 10.14 - Open Side Panel Density v1

Status: Closed 2026-06-16 by `ide:gate:open-side-panel-density`.

Goal: Keep compact open side panels proportional so support tools stay beside the workbench instead of becoming large bottom cards.

Why: Browser-first inspection after Side Dock Affordance v1 showed the next contained side-panel defect at `1366x768`: Hardware opened its right inspector as a `1017px` bottom band and Export opened as a `1089px` bottom band. That made the product feel like stacked information cards rather than a work surface with useful tools.

Implementation slices:

- Added one focused browser gate for Hardware and Export open right inspectors at `1366x768` and `1440x900`.
- Added a final compact-layout CSS override so open right docks use the resolved right slot as a side column.
- Preserved collapsed rail behavior, open/close state, Hardware/Export content, simulation, Verify semantics, mapping, export generation, project format, and goldens.

Proof:

- Intentional red `ide:gate:open-side-panel-density` caught the compact Hardware/Export bottom-card failure.
- Passing `ide:gate:open-side-panel-density` after the fix with before/after screenshots and observations under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/open-side-panel-density/`.
- Affected side-dock, Hardware first-viewport, Export first-viewport artifacts, shell hierarchy, workbench space, focused shell Vitest, and classroom gates.

Acceptance:

- Compact Hardware and Export right inspectors open as proportional full-height side tools.
- Workspace height remains intact and the focal work object remains visible.
- Closing the inspector restores the right rail.
- No root overflow or console/page errors at classroom and desktop viewports.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the compact open-right-dock CSS override and focused gate wiring; existing side-dock and workbench-space gates protect collapsed rails and focal-object geometry separately.

## Phase 10.15 - Export Artifact Direct Preview v1

Status: Closed 2026-06-16 by `ide:gate:export-artifact-direct-preview`.

Goal: Turn Export generated-file cues from passive labels into direct preview controls.

Why: Browser-first inspection showed the ready-to-build Export handoff now exposes generated file names in the first viewport, but those file cues still looked selectable while doing nothing. The actual artifact preview stayed below the first viewport, so the handoff still felt like static information cards instead of a usable file workspace.

Implementation slices:

- Added one focused browser gate for the ready-to-build Logic Gates Export path at `1366x768` and `1440x900`.
- Converted the first-viewport generated-file cues to button controls with preview labels, keyboard reachability, focus/hover/selected styling, and `aria-pressed` selected state.
- Reused the existing artifact workspace and selected artifact state so clicking `top.vhd` or keyboard-activating `top.xdc` selects and reveals the same preview already used by the downstream artifact explorer.
- Preserved generated artifact bytes, export trust semantics, download behavior, Verify semantics, pin mapping, project format, goldens, and E1/E2/E3 proof boundaries.

Proof:

- Intentional red `ide:gate:export-artifact-direct-preview` caught `top.vhd` rendering as a passive `span` at both required viewports.
- Passing `ide:gate:export-artifact-direct-preview` after the fix with before screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/direct-manipulation/before/` and after screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/direct-manipulation/after/`.
- Export first-viewport artifacts, artifact explorer, handoff station, trust integrity, open side-panel density, focused Export Vitest, classroom gate, and unified build.

Acceptance:

- `top.vhd` and `top.xdc` generated-file cues are real controls in the handoff station.
- Click and keyboard activation update `ide-export-preview-path` and reveal the artifact workspace.
- Selected generated-file cues expose selected state.
- No root overflow or browser E1/E2/E3 proof claim appears at classroom or desktop viewports.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Export handoff cue interaction/CSS and focused gate wiring; existing Export trust, handoff, first-viewport artifact, and artifact explorer gates protect broader Export semantics separately.

## Phase 10.16 - Workflow Orientation Integrated v1

Status: Closed 2026-06-16 by strengthened `ide:gate:interaction-affordance`.

Goal: Keep Workflow Orientation recoverable without letting it cover the loaded Project work path.

Why: Browser-first inspection showed the reopened top-bar `Flow` help still used the older bottom overlay after a project loaded. At `1440x900`, that overlay covered `ide-project-entry-paths`, matching user feedback that Workflow Orientation was in the way and felt like static chrome.

Implementation slices:

- Strengthened the existing Project interaction gate with a loaded Project path: load Logic Gates, return to Project, reopen `Flow`, and assert the orientation panel does not overlap Project entry paths.
- Kept first launch using the fuller teaching card.
- Added loaded-project placement for `OnboardingOverlay` so reopened `Flow` uses a compact top-right callout with shorter contextual copy.
- Preserved project format, persistence semantics, Verify semantics, pin mapping, export generation, goldens, and E1/E2/E3 proof boundaries.

Proof:

- Intentional red `ide:gate:interaction-affordance` caught the old bottom overlay covering Project entry paths.
- Passing `ide:gate:interaction-affordance` after the fix with before screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/browser-first-c09d6258-live/before/` and after screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/browser-first-c09d6258-live/after/workflow-orientation-integrated/`.
- Project command center, Project identity editing, shell workbench hierarchy, workbench space utilization, focused OnboardingOverlay Vitest, classroom gate, and unified build.

Acceptance:

- First-launch Workflow Orientation remains dismissible and can open Design.
- Dismissed orientation remains recoverable from `Flow`.
- Loaded Project `Flow` uses compact contextual copy and does not overlap Project entry paths.
- No root overflow or browser E1/E2/E3 proof claim appears.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the OnboardingOverlay placement/copy changes and the strengthened loaded Project gate assertion; existing Project identity and command-center gates protect the surrounding Project behavior separately.

## Phase 10.17 - Workbench Obstruction Usability v1

Status: Closed 2026-06-16 by `ide:gate:workbench-obstruction-usability`.

Goal: Keep Hardware Map Pins support chrome from obstructing the board/table mapping workbench on entry.

Why: Browser-first inspection showed Hardware Map Pins still opened with the Map support dock visible by default. At normal classroom and desktop viewports, that made the board/table mapping object lower and less dominant than the support guide, matching the user's complaint that interactive side panels take strange, disproportionate space.

Implementation slices:

- Added one focused browser gate for Hardware Map Pins obstruction and support-dock recovery at `1366x768` and `1440x900`.
- Changed Hardware Map Pins to start with the Map support dock collapsed, with a compact `Map` restore rail.
- Reduced Hardware open-left dock width caps and tightened Hardware command-strip spacing so the board/table mapping work starts higher.
- Updated existing Hardware/student-loop gates to open support docks explicitly before asserting dock-only content.
- Preserved pin mapping semantics, Hardware proof-tier wording, Verify semantics, export generation, project format, goldens, and E1/E2/E3 proof boundaries.

Proof:

- Intentional red `ide:gate:workbench-obstruction-usability` caught Hardware opening with the Map support dock visible on entry.
- Passing `ide:gate:workbench-obstruction-usability` after the fix with before screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/workbench-obstruction/before/` and after screenshots under `.redbyte/product-immersion/browser-first-ownership/2026-06-16/workbench-obstruction/after/`.
- Side-dock affordance, open side-panel density, workbench space utilization, shell hierarchy, Design Workbench v1, Verify evidence workbench, Hardware first-viewport, student-loop, Hardware Basys3 workbench, focused shell/Hardware Vitest, classroom gate, and unified build.

Acceptance:

- Hardware Map Pins entry starts with Map support collapsed.
- The compact `Map` rail can reopen the guide.
- Board/table mapping remains first-order at `1366x768` and `1440x900`.
- Left and right support docks open proportionally and close back to restored workbench space.
- No root overflow or console/page errors appear.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Hardware left-dock default/width and command-strip layout changes plus focused gate wiring; existing Hardware first-viewport, Basys3 workbench, side-dock, and open-panel gates protect adjacent behavior separately.

## Phase 10.18 - Design Canvas Direct Workbench v1

Status: Closed 2026-06-16 by `ide:gate:design-canvas-direct-workbench`.

Goal: Keep loaded Design starter authoring unobstructed by default while preserving on-demand View tools.

Why: Browser-first inspection showed the loaded Design canvas still felt like cards and scaffolding over the workspace: the zoom/view-tools HUD and minimap sat over the graph by default at normal classroom and desktop viewports. This was a frequent, contained direct-workbench defect that was more gateable than broad visual taste work.

Implementation slices:

- Added one focused browser gate for Design canvas direct-workbench obstruction at `1366x768` and `1440x900`.
- Changed loaded Design View tools to start as a compact `View` control with expanded controls/presets available on demand.
- Hid the minimap by default in the Design workbench.
- Updated existing Design zoom/workbench gates to open View tools before asserting Fit/Center/preset behavior.
- Preserved simulation, Verify semantics, pin mapping semantics, export generation, project format, goldens, Vivado proof, and Basys3 proof boundaries.

Proof:

- Intentional red `ide:gate:design-canvas-direct-workbench` caught the missing compact View toggle and default HUD/minimap obstruction.
- Passing `ide:gate:design-canvas-direct-workbench` after the fix with before screenshots under `.redbyte/product-immersion/workbench-usability-overhaul/2026-06-16/before/` and after screenshots under `.redbyte/product-immersion/workbench-usability-overhaul/2026-06-16/after/`.
- Design Workbench v1, Design canvas zoom integrity, Design workbench integrity, affected shell/Hardware/Export gates, focused Design Vitest, classroom gate, unified build, doc validation, encoding check, and diff check.

Acceptance:

- Loaded Design starts with compact View tools instead of expanded zoom HUD.
- The minimap is not visible by default.
- Students can open View tools and use zoom presets/Fit/Center when needed.
- Loaded graph remains visible and unobstructed at `1366x768` and `1440x900`.
- No root overflow or console/page errors appear.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Design View-tools compact default, minimap default, and focused gate wiring; existing Design Workbench v1 and zoom integrity gates protect adjacent Design behavior separately.

## Phase 10.19 - Workbench Stability Overhaul v1

Status: Closed 2026-06-16 by `ide:gate:design-workspace-crash-proof` and `ide:gate:workbench-stability-overhaul`.

Goal: Keep the core RedByte workbench recoverable when a visible workspace hits a stale or failed lazy-surface load.

Why: Live browser evidence showed a prior Design tab could retain a stale `DesignSurface-*.js` request and render `Design workspace encountered an error`. The existing shared boundary offered generic retry/destructive reset controls, but a rejected React lazy import needs a non-destructive page reload path.

Implementation slices:

- Classified dynamic import / chunk load failures as `surface-load` boundary errors.
- Added a non-destructive `Reload App` action for recoverable surface-load errors while keeping `Reset Workspace` available as the destructive escape hatch.
- Added one crash-proof browser gate that aborts the first production Design surface chunk and one normal workbench-stability browser gate for Project/Design/Verify/Map Pins navigation and reload continuity.

Proof:

- Intentional red `ide:gate:design-workspace-crash-proof` caught missing surface-load classification.
- Passing `ide:gate:design-workspace-crash-proof` and `ide:gate:workbench-stability-overhaul` after the fix with before/after evidence under `.redbyte/product-immersion/workbench-stability-overhaul/2026-06-16/`.
- Focused ErrorBoundary Vitest covers ordinary Try Again recovery and surface-load reload affordance.

Acceptance:

- Failed Design lazy-surface load no longer requires clearing the workspace to recover.
- Normal Project -> Design -> Verify -> reload -> Map Pins -> Design path has no error boundary, stuck loading state, route/mode mismatch, root overflow, or console/page errors.
- No simulation, Verify result, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the ErrorBoundary classification/UI change and the two focused gate additions; existing active-mode reload and Design workbench gates remain adjacent coverage.


## Phase 10.20 - Verify Workbench Rebuild v1

Status: Closed 2026-06-17 by `ide:gate:verify-testbench-usable-layout` and `ide:gate:verify-workbench-layout-reset`.

Goal: Make the Verify first-run testbench the primary work surface before waveform evidence exists.

Why: Browser-first review and user feedback showed the first-run Logic Gates testbench was squeezed into a narrow split-pane lane beside an empty waveform placeholder. At `1366x768`, the stimulus editor was about `460px` wide and needed horizontal scrolling to inspect the rest of the input and expected-output bench.

Implementation slices:

- Added an explicit Verify workflow phase so pre-run Verify can use `stimulus-focus` while post-run Verify keeps the existing evidence/workbench split behavior.
- Rebuilt the pre-run Verify lab grid into a stimulus-first vertical layout: testbench above, compact waveform readiness below.
- Added compact stimulus canvas density for post-run Verify so the table remains usable beside waveform evidence after PASS/FAIL/repair.
- Added one pre-run usable-layout gate and one pass/fail/repair layout-reset gate.

Proof:

- Intentional red `ide:gate:verify-testbench-usable-layout` caught old pre-run `split` mode.
- Intentional red `ide:gate:verify-workbench-layout-reset` caught old pre-run split geometry and horizontal grid overflow.
- Passing `ide:gate:verify-testbench-usable-layout`, `ide:gate:verify-workbench-layout-reset`, focused Verify workspace/layout/workstation Vitest, and after screenshots under `.redbyte/product-immersion/verify-workbench-rebuild/2026-06-17/after/`.

Acceptance:

- First-run Logic Gates Verify shows all starter expected-output cells and all four case headers without horizontal testbench overflow at `1366x768` and `1440x900`.
- Compare PASS, intentional FAIL, repair, and final PASS keep usable stimulus/waveform geometry.
- No simulation, Verify result, Compare rule, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Verify pre-run layout phase/style changes, compact stimulus-canvas density, and the two focused gate additions; existing Verify evidence and fail-edit-repair gates remain adjacent coverage.


## Phase 10.21 - Shell and Navigation De-Scaffold v1

Status: Closed 2026-06-17 by `ide:gate:shell-navigation-overhaul`, `ide:gate:primary-work-object-dominance`, and `ide:gate:nested-scroll-regression`.

Goal: Reduce global shell/navigation scaffold pressure so the primary workbench object owns normal classroom and desktop viewports.

Why: Browser-first review after the Verify rebuild showed the remaining unfinished feel was cross-surface, not one panel only: persistent shell chrome, simultaneous support docks, and small nested scroll regions still made RedByte feel like cards arranged around work instead of a compact engineering workbench.

Implementation slices:

- Tightened the persistent shell tax around the compact left rail, proof ribbon, status footer, and collapsed support restore controls.
- Made focused workbench support docks exclusive outside wide layout so both side panels cannot simultaneously squeeze the primary work object.
- Kept Verify's embedded stimulus canvas compact in the Verify workbench and tightened compact stimulus column widths.
- Added one shell/navigation gate, one primary-work-object dominance gate, and one nested-scroll regression gate.

Proof:

- Intentional red/debug runs caught stale build proof, proof-ribbon height drift, non-exclusive support docks, Verify pre-run squeeze, Verify post-run mini horizontal scroll, and an outdated Import navigation assumption.
- Passing `ide:gate:shell-navigation-overhaul`, `ide:gate:primary-work-object-dominance`, `ide:gate:nested-scroll-regression`, affected shell/Verify/Hardware/Export/Import gates, focused shell/Verify Vitest, classroom gate, unified build, doc validation, encoding check, and diff check.
- Before/after browser screenshots and observations live under `.redbyte/product-immersion/shell-navigation-overhaul/2026-06-17/`.

Acceptance:

- Compact shell/navigation geometry is proven at `1366x768` and `1440x900`.
- Import remains a utility route and reload-recoverable path, not a permanent workflow rail item.
- Design, Verify, Hardware, Export, and Import keep a dominant primary work object.
- Focused support docks are exclusive outside wide layout.
- No meaningful Verify/Hardware mini-scroll traps, root overflow, or console/page errors appear.
- No simulation, Verify result, Compare rule, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the shell CSS compaction, support-dock exclusivity callbacks, compact Verify stimulus density adjustments, and the three focused gate additions; existing shell hierarchy, side-dock, open-panel, Verify layout, and Hardware workbench gates remain adjacent coverage.

## Phase 10.22 - Verify Post-Run Workbench Usability v1

Status: Closed 2026-06-17 by `ide:gate:verify-postrun-workbench-usability`.

Goal: Keep Verify's post-run PASS/FAIL/repair workbench usable after waveform evidence appears.

Why: Browser-first inspection after the shell/navigation de-scaffold pass showed the loaded Logic Gates Verify repair loop still had only a `460px` editable checks lane at both `1366x768` and `1440x900`. Students could pass, intentionally fail, and repair the workflow, but the core testbench/checks object still felt like a cramped slot beside waveform evidence.

Implementation slices:

- Added a focused post-run Verify browser gate that runs Compare PASS, induces an expected-output FAIL, repairs to PASS, and asserts usable checks-lane width/share, waveform width, visible failure action, no mini-scroll trap, build-hash identity, no root overflow, and no console/page errors at `1366x768` and `1440x900`.
- Rebalanced post-run Verify split geometry and compact padding so the editable checks lane is no longer trapped at `460px` while waveform evidence remains first-order.
- Updated adjacent dominance, nested-scroll, and workbench-space gates to encode the balanced evidence/repair contract.
- Preserved simulation, Verify result semantics, Compare rules, expected-output meaning, pin mapping semantics, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, and Basys3 proof.

Proof:

- Intentional red `ide:gate:verify-postrun-workbench-usability` caught the old `460px` post-run checks lane after Compare PASS and at `1440x900`.
- Passing `ide:gate:verify-postrun-workbench-usability`, affected Verify/shell/workbench gates, focused Verify Vitest, classroom gate, unified build, doc validation, encoding check, and diff check.
- Before/after browser screenshots and observations live under `.redbyte/product-immersion/core-product-acceleration/2026-06-17/`.

Acceptance:

- Compare PASS, induced expected-output FAIL, and repair PASS keep the editable checks lane usable beside waveform evidence at `1366x768` and `1440x900`.
- The waveform lane remains wide enough to explain evidence without owning Verify trust.
- No meaningful stimulus-grid mini-scroll, root overflow, or console/page errors appear.
- No simulation, Verify result, Compare rule, expected-output, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the post-run Verify split/padding changes and focused gate wiring; existing Verify evidence, fail-edit-repair, workbench-layout-reset, nested-scroll, and dominance gates remain adjacent coverage.

## Phase 10.23 - Core Product Acceleration Sprint 2

Status: Closed 2026-06-17 by `ide:gate:verify-no-circuit-task-first` and `ide:gate:project-loaded-paths-first-viewport`.

Goal: Make normal entry states feel like actionable workbench paths instead of apparatus or static card stacks.

Why: Browser-first inspection after Verify post-run usability found two high-frequency entry defects. Fresh direct Verify showed no-circuit/no-signal users mapping/testbench apparatus before any circuit existed. Loaded Project placed its real action paths too low in the first viewport, below identity/metrics content, reinforcing the page-of-cards feel.

Implementation slices:

- Added a focused direct Verify gate for the fresh no-circuit state at `1366x768` and `1440x900`.
- Added a focused loaded Project gate for first-viewport action-path placement and route behavior at `1366x768` and `1440x900`.
- Rebuilt direct Verify no-circuit presentation around Open Design, Load starter, and Import / Recover actions, and hid waveform/testbench apparatus until a circuit exists.
- Reordered/tightened loaded Project hierarchy so Continue, Build Fresh, Course Starter, Import / Recover, and Open Recent sit above lower metrics/support content.
- Preserved simulation, Verify result semantics, Compare rules, expected-output meaning, pin mapping semantics, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, and Basys3 proof.

Proof:

- Intentional red `ide:gate:verify-no-circuit-task-first` caught the old missing task-first direct Verify state.
- Intentional red `ide:gate:project-loaded-paths-first-viewport` caught loaded Project paths starting too low at `1366x768`.
- Passing focused gates, affected Verify/Project gates, classroom gate, unified build, doc validation, encoding check, and diff check are required for closeout.
- Before/after browser screenshots and observations live under `.redbyte/product-immersion/core-product-acceleration-2/2026-06-17/`.

Acceptance:

- Fresh direct Verify no-circuit entry has an obvious next action without Hardware/Map Pins/no-IO confusion.
- Loaded Project exposes all five action paths in the useful first viewport and preserves Continue, Import, and guarded Build Fresh behavior.
- No root overflow or console/page errors appear in the covered viewports.
- No simulation, Verify result, Compare rule, expected-output, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Verify no-circuit presentation, loaded Project ordering/tightening, and focused gate wiring; existing Project command-center and Verify layout/evidence gates remain adjacent coverage.


## Phase 10.24 - Workbench Reconstruction v1

Status: Closed 2026-06-18 by `ide:gate:workbench-reconstruction-v1`, `ide:gate:design-dual-tool-windows`, `ide:gate:verify-task-plane-usability`, `ide:gate:hardware-board-dominance`, `ide:gate:action-first-entry-surfaces`, and `ide:gate:root-overflow-regression`.

Goal: Establish a durable workbench shell and task-plane model so RedByte feels like an engineering workbench rather than cards arranged around work.

Why: Browser-first inspection after Core Product Acceleration Sprint 2 showed the remaining unfinished feel was structural. The shared shell still taxed every surface, Hardware Map Pins still delayed the board/table binding task behind non-action chrome, and future surface work needed a written model for shell chrome, side tools, and task-plane ownership.

Implementation slices:

- Added `docs/architecture/RED_BYTE_WORKBENCH_MODEL.md` as the current shell, side-tool, task-plane, Hardware board-first, and proof-boundary model.
- Updated the workbench shell so an empty auto console no longer reserves bottom layout space; existing console entries, blocking console state, or pinned console state still render it.
- Updated Hardware Map Pins so the normal mapped board/table workbench does not render the non-action summary command strip above the task plane.
- Tightened compact shell/proof/status geometry and Hardware task-plane CSS so work starts higher in the first viewport.
- Added six focused browser gates and wired them into classroom and broad classroom gates.

Proof:

- Browser before/after screenshots and observations under `.redbyte/product-immersion/workbench-reconstruction/2026-06-18/`.
- Passing `ide:gate:workbench-reconstruction-v1`, `ide:gate:design-dual-tool-windows`, `ide:gate:verify-task-plane-usability`, `ide:gate:hardware-board-dominance`, `ide:gate:action-first-entry-surfaces`, `ide:gate:root-overflow-regression`, affected surface gates, focused shell Vitest, classroom gate, unified build, doc validation, encoding check, and diff check are required for closeout.

Acceptance:

- Empty auto console does not consume workbench height.
- Hardware Map Pins normal mapped path starts with the board/table task plane first-order at `1366x768` and `1440x900`.
- Project, Design, Verify, Hardware, Export, and Import preserve visible task-plane/action ownership without root horizontal overflow or console/page errors.
- No simulation, Verify result, Compare rule, expected-output, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the shell console visibility change, Hardware command-strip visibility change, compact CSS authority block, workbench model doc, and the six focused gate additions; existing shell/navigation, workbench space, Hardware first-viewport, Verify, Export, Import, and Project gates remain adjacent coverage.


## Phase 10.25 - Import Guided Recovery Workflow v1

Status: Closed 2026-06-18 by `ide:gate:import-guided-recovery-workflow`.

Goal: Make active Import recovery states behave like a workstation instead of a first-look card stack.

Why: Product reconstruction inspection found Import active recovery states were the worst current live defect. After a user chose Paste HDL or an unsupported sample, the old layout still kept intro guidance above the editor/review area and pushed the actual recovery work object down the viewport.

Implementation slices:

- Added `docs/product/RED_BYTE_DREAM_APP_TARGET.md` to define the stricter Basys3-first workbench target and the "work object owns the screen" law.
- Added a focused browser gate that fails if active Import lacks a compact taskbar, keeps first-look guidance visible above the active work object, buries the editor/review area, creates root overflow, logs console/page errors, or overclaims Vivado/Basys3 proof.
- Rebuilt Import active states so Paste HDL, XDC, Apply Pins Only, Review Import, and Start fresh in Design actions live in a compact recovery taskbar.
- Kept first-look Import guided and kept existing review/apply behavior intact.
- Updated stale Import gate/test assumptions that referenced removed disclosure toggles or old navigation selectors.

Proof:

- Intentional red `ide:gate:import-guided-recovery-workflow` caught stale dist hash first, then caught the old missing active taskbar for Paste HDL.
- Passing `ide:gate:import-guided-recovery-workflow`, affected Import gates, workbench gates, focused Import Vitest, classroom gate, unified build, doc validation, encoding check, and diff check are required for closeout.
- Before/after browser screenshots and observations live under `.redbyte/product-immersion/product-reconstruction/2026-06-18/`.

Acceptance:

- Import first-look remains guided.
- Active Paste HDL shows the HDL editor in the useful first viewport at `1366x768` and `1440x900`.
- Unsupported examples show blocker honesty and review evidence in the useful first viewport with direct next actions.
- No root overflow or console/page errors appear.
- No simulation, Verify result, Compare rule, expected-output, pin mapping, import parser/apply behavior, export generation, project data format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the Import active taskbar presentation changes, Import active CSS, stale gate/test selector updates, target doc, and focused gate wiring; existing Import recovery, workbench visual finish, action-first entry, and workbench reconstruction gates remain adjacent coverage.


## Product Trust Reset v2 - Phase 2 Student Chrome / Workspace Foundation

Status: Closed locally 2026-06-20 on draft PR branch `product/redbyte-trust-reset-v2`; pending final commit, push, and PR check verification.

Goal: Make the normal app stop reading like an internal proof harness by removing raw build badges, E-tier labels, and generic side rails from student chrome while preserving diagnostics and existing product semantics.

Implementation slices:

- Added Help / About / Diagnostics as the student-accessible diagnostics boundary.
- Removed normal visible build hash and E-tier workflow/status language from the browser shell.
- Hid generic HIDE / SHOW INFO dock affordances from normal Project, Verify, Hardware, Export, and Import paths.
- Marked real surfaces with V2 workspace primitives: course workspace, fixed tool palette, testbench workspace, board mapping workspace, artifact workspace, and step workflow.
- Rewrote stale V1 gates that required visible build badges, E-tier browser copy, restore rails, or closed-rail Design canvas budgets.

Proof:

- `ide:gate:v2-student-chrome`
- Full `classroom:gate` under portable Node `20.19.0`
- After screenshots and observations under `.redbyte/product-immersion/product-trust-reset-v2/phase-2/after/`

Acceptance:

- Normal student UI shows no raw build badge, E0/E1/E2/E3 labels, HIDE, or SHOW INFO side rails on the checked browser paths.
- Diagnostics exposes full build fingerprint and plain external-proof boundary when explicitly opened.
- No simulation, Verify semantics, expected-output meaning, mapping semantics, import parser/apply behavior, export generation bytes, project format, goldens, Vivado proof, or Basys3 proof changed.

Rollback:

- Revert the shell/status/help changes, V2 dock-mode routing, Phase 2 CSS overrides, V2 gate aliases, and stale gate rewrites as one branch slice. Do not revert Phase 1 contracts unless the whole Product Trust Reset branch is abandoned.

## Phase 11 - Vivado/Basys3 Proof Restoration

Goal: Restore fresh E1/E2/E3 proof on a machine with Vivado 2024.2 and Basys3 hardware.

Why: Hardware claims are the riskiest public claims and cannot be renewed on this desktop.

Implementation slices:

- Environment check.
- Vivado build proof.
- Board programming proof.
- Board observation notes.
- Release docs update.

Proof:

- Vivado logs.
- Programming logs.
- E3 observation procedure and evidence.

Acceptance:

- Every hardware-safe claim points to named evidence.

Rollback:

- Revert docs/evidence claim updates; do not erase raw generated proof unless explicitly requested.

## Phase 12 - Packaging / Commercial Readiness

Goal: Decide public hosted, campus support, local package, license/privacy, and support posture.

Why: Commercial packaging depends on product trust, proof, and quickstarts.

Implementation slices:

- Public/free hosted evaluation posture.
- Instructor/campus support package.
- Local/campus deploy package notes.
- Privacy/license/support review.

Proof:

- Deploy proof when applicable.
- Support docs.
- License/privacy review.

Acceptance:

- No SaaS/accounts unless concrete hosted-data need is proven.
- "Pushed to GitHub" is not called "live for students" unless deployment proof confirms it.

Rollback:

- Revert packaging docs/config; preserve source truth.

## Attribution

Connor Angiel
