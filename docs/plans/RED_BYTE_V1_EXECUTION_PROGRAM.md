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

Goal: Make Map Pins a direct Basys3 binding workbench.

Why: This is RedByte's FPGA differentiation: project signal to board resource to package pin to XDC.

Implementation slices:

- E0 handoff wording.
- Signal/table/board synchronized hierarchy.
- XDC preview containment.
- Clock/resource language.

Proof:

- Hardware visual credibility gate.
- Map Pins recovery gate.
- Board/table screenshots.

Acceptance:

- Students see signal rows and board together.
- No hardware-ready claim without E1/E2/E3 proof.

Rollback:

- Revert Hardware presentation slice; pin mapping tests protect semantics.

## Phase 7 - Design Workbench

Goal: Make the circuit graph the first object in Design.

Why: RedByte cannot be credible as a lab workbench if the loaded circuit is not visible immediately.

Implementation slices:

- Canvas-first first viewport.
- Palette and toolbar compaction.
- Starter/context demotion.
- Inspector demotion unless selection exists.

Proof:

- Starter Design screenshot shows meaningful nodes/connections at `1366x768`.
- Design workbench, placement, wire interaction, and focused gates green.

Acceptance:

- A student can inspect the loaded circuit before scrolling.
- No circuit graph/editor behavior regression.

Rollback:

- Revert Design layout slice.

## Phase 8 - Lab Profile / Course Pack Data Seam

Goal: Introduce the first small data seam for professor-authored labs and course packs.

Why: Course packs are important, but should build on a stable workbench contract.

Implementation slices:

- One minimal profile-backed lab path.
- Course-specific starter data moved toward data boundary.
- No-solution guard retained.

Proof:

- Profile-backed lab test.
- No-solution policy gate.
- Existing starter paths still work.

Acceptance:

- A professor can define one supported lab shape without editing core board/export semantics.
- Basys3 resource and proof-tier logic stays core.

Rollback:

- Revert data seam; starter behavior remains intact.

## Phase 9 - Import / Recovery

Goal: Make Import a trustworthy utility path for RedByte project recovery and representative Vivado/HDL inputs.

Why: Import is useful but not the main V1 spine.

Implementation slices:

- Fidelity messaging.
- Representative good/corrupt ZIP paths.
- Review-before-apply reinforcement.

Proof:

- Import/export recovery gates.
- Representative import fixtures.
- Screenshots.

Acceptance:

- User understands Full/Reconstructed/Partial before applying import.

Rollback:

- Revert Import slice; no project data migration.

## Phase 10 - Student/Instructor Quickstarts

Goal: Create public-facing quickstarts that do not depend on agent context.

Why: Classroom adoption requires readable instructions and support boundaries.

Implementation slices:

- Student first lab.
- Instructor setup/support.
- Known limitations and proof tiers.

Proof:

- Docs validation.
- Manual walkthrough against current UI.

Acceptance:

- A student can follow the first lab without internal docs.
- An instructor can understand E0/E1/E2/E3 requirements.

Rollback:

- Revert docs.

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
