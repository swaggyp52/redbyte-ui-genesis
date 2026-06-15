---
doc_status: current
last_validated: 2026-06-14
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
