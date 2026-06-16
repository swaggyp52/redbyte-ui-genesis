---
doc_status: current
last_validated: 2026-06-16
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
