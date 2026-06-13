---
doc_status: current
last_validated: 2026-06-13
owner: Connor Angiel
used_by_claude: true
role: ordered near-term RedByte V1 work queue for agents and maintainers
---

# RedByte Work Queue

This is the ordered near-term queue after the V1 product contract reset, Under-the-Hood Mastery Sprint, Export Trust Integrity, Verify Evidence Workbench, and Shell and Workbench Layout Reset closeout. The next implementation slice should be selected from the current issue index, not from gut feel.

## Queue

| # | Slice | Why it matters now | Source docs | Expected commit type | Done criteria |
|---|---|---|---|---|---|
| 1 | V1 Contract Reset | Establish the research, visual evidence, contract, delete/demote/rebuild inventory, and execution program before more product code. | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`, `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md`, `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md` | `docs:` | Closed before this queue update. |
| 2 | Under-the-Hood Mastery Sprint | Build the source/state/proof model and add invariant gates so normal user actions do not break trust silently. | `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`, state authority matrix, invariant matrix, normal-use audit, gate ownership doc | `test:` / `docs:` | Subsystem map, state matrix, invariant matrix, normal-use audit, and at least two invariant gates committed and pushed; classroom and deploy checks green. |
| 3 | Export Trust Integrity | The normal-use audit found generated artifacts but no obvious artifact preview, and earlier V1 evidence found mapping-summary contradiction risk. | `docs/audits/2026-06-13-redbyte-normal-use-breakage-audit.md`, `RB-EXPORT-TRUST-001`, `RB-EXPORT-HANDOFF-001` | `test:` or `fix:` | Closed 2026-06-13: `ide:gate:export-trust-integrity` proves handoff summary, artifact count, visible preview, downloaded ZIP entries, README/provenance, Draft/Trusted labels, and E0/E1/E2/E3 wording agreement. |
| 4 | Verify Evidence Workbench | Verify behavior was strong, but the evidence/repair loop still read like a dense instrument panel. | V1 contract Verify section, visual audit, `RB-VERIFY-EVIDENCE-001` in the issue index | `fix:` | Closed 2026-06-13: `ide:gate:verify-evidence-workbench-integrity` proves first-run expected-output editing, Compare PASS, intentional expected-output FAIL, first mismatch expected/observed evidence, waveform controls, repair PASS, and no meaningful evidence-region overlap. |
| 5 | Shell and Workbench Layout Reset | The shell repeated too many status authorities and every surface inherited that first-viewport problem. | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`, `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md`, visual audit | `fix:` | Closed 2026-06-13: `ide:gate:shell-workbench-hierarchy` proves one compact proof/status authority, support-only footer, rail navigation without `OK` status labels, and visible workbench objects across Project/Design/Verify/Hardware/Export/Import. |
| 6 | Project Command Center | Project should be a command center for blank, starter, saved, import/recovery, and future instructor lab paths, not a starter gallery. | V1 contract Project section, visual audit, `RB-PROJECT-CC-001` | `fix:` | No-circuit copy is neutral; next action visible without scroll; ECE141-specific identity is demoted. |
| 7 | Export Handoff Station | After trust integrity is proven, finish the visual/workbench handoff station around the same authority. | V1 contract Export section, visual audit, `RB-EXPORT-HANDOFF-001` | `fix:` | Draft/E0-ready states are singular in the first-viewport hierarchy; mapping summary remains aligned with actual mapping; export gates and artifact checks pass. |
| 8 | Hardware / Basys3 Workbench | Keep the board/table direction but make E0 handoff language impossible to confuse with hardware proof. | V1 contract Hardware section, visual audit, `RB-HARDWARE-WB-001` | `fix:` | Signal -> board resource -> package pin -> XDC chain is visible; no E1/E2/E3 overclaim. |
| 9 | Design Workbench | The circuit graph must become the first object after a starter or project loads. | V1 contract Design section, visual audit, `RB-DESIGN-WB-001` | `fix:` | Meaningful nodes/connections are visible at `1366x768`; palette/toolbar/inspector support the graph instead of displacing it. |
| 10 | Import / Recovery | Import stays a utility but needs access contract alignment and representative fidelity/recovery proof. | V1 contract Import section, normal-use audit, `RB-IMPORT-001`, `RB-IMPORT-ACCESS-001` | `fix:` or `test:` | Documented Import utility path is visible, failed import does not replace current project, and representative import/recovery paths prove fidelity messages. |
| 11 | Lab Profile / Course Pack Data Seam | Course-pack data is important, but it should follow the workbench/proof contract so the data seam plugs into a stable product shell. | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`, general lab audit, `RB-LAB-001` | `refactor:` or `feat:` | One small profile-backed lab path; Basys3 logic stays core; no-solution policy remains enforced. |
| 12 | Student/Instructor Quickstarts | Classroom readiness requires public-facing docs after UI/proof posture stabilizes. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`, release docs, V1 contract | `docs:` | Student first-lab and instructor setup/support quickstarts exist and match current app truth. |
| 13 | Vivado/Basys3 Proof Restoration | Student-safe hardware claims require fresh proof on a machine with Vivado 2024.2 and hardware access. | `docs/STUDENT_RELEASE_READINESS.md`, certification matrix, proof docs | `docs:` or `chore:` | E1/E2/E3 evidence updated only from Vivado/board runs; no screenshots-only hardware claim. |
| 14 | Packaging/Commercial Readiness | Commercial packaging belongs after product trust, quickstarts, and hardware proof. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`, V1 execution program | `docs:` or `chore:` | Hosted/support/local package posture reviewed; accounts/SaaS deferred unless concrete hosted-data need is proven. |

## Recently Closed / Historical Items

| Item | Status |
|---|---|
| Shell and Workbench Layout Reset | Closed 2026-06-13: `ide:gate:shell-workbench-hierarchy` is wired into focused, classroom, and broad classroom gates; after screenshots and geometry summary are under `.redbyte/product-immersion/shell-workbench-layout-reset/after/`. |
| Verify Evidence Workbench | Closed 2026-06-13: first-run Verify editor remains visible for starter checks; post-run stimulus and waveform chrome are condensed; `ide:gate:verify-evidence-workbench-integrity` is wired into focused, classroom, and broad classroom gates with PASS -> FAIL -> repair PASS evidence and overlap checks. |
| Export Trust Integrity | Closed 2026-06-13: generated file previews open by default, mapped board I/O summary no longer contradicts actual mapping, and `ide:gate:export-trust-integrity` is wired into focused, classroom, and broad classroom gates. |
| Design canvas zoom integrity | Closed 2026-06-13: root cause was React click event forwarded to `fitToCircuit`; `ide:gate:design-canvas-zoom-integrity` guards non-finite camera and blank graph regression. |
| Under-the-Hood Mastery Sprint | Closed 2026-06-13: created source/state/proof docs, normal-use audit, and invariant gates. |
| Nightly FPGA Bridge Proof port isolation | Closed and green on GitHub before this reset: `Classroom Truth Gates`, deploy, and manual Nightly Heavy Suites were green for commit `2d176550`; optional manual screenshot/UI smoke jobs were skipped by design. |
| Verify fail-edit-repair regression | Done 2026-06-12: `ide:gate:verify-fail-edit-repair` proves PASS -> expected-output edit/stale -> FAIL -> repair/stale -> PASS, Project PASS/CLEAN, and Export Checks match / READY TO BUILD. |
| General Lab Workbench Sprint 0 / gate truth | Done 2026-06-12: stale Verify/Export gate assumptions repaired; `ide:gate:from-scratch-general-workflow` added; blank-project IO/export aliasing defects fixed; lab profile target model documented. |
| Visual system integrity | Done 2026-06-12: Export handoff/evidence/action content is first-viewport visible, Draft Export no longer claims ready-to-build, Verify command/header overflow is removed, expected-output cells remain editable, and `ide:gate:ece141-visual-system-integrity` guards cross-surface layout. |
| Hardware / Map Pins visual credibility | Done 2026-06-12: left Map Pins guide no longer wraps copy word-by-word; board/table remain focal; Hardware visual credibility and Map Pins recovery gates passed locally. |
| First-viewport repair | Done 2026-06-12: Project, Design, Hardware/Map Pins, and Export first viewport hierarchy improved and covered by `ide:gate:ece141-first-viewport`; no simulation/export/Vivado semantics changed. |
| GitHub Classroom Truth Gates repair | Done 2026-06-12: required check was repaired rather than removed; branch protection still requires `Classroom Truth Gates`. |
| Canonical worktree establishment | Done 2026-06-12: `C:\Users\conno\redbyte-ui-genesis-main` is the canonical clone for `https://github.com/swaggyp52/redbyte-ui-genesis.git`. |
| Golden export SHA investigation | Done 2026-06-12 under available Node 24.15.0 runtime: drift was source-explained as intended README evidence-boundary byte change; two SHA fixtures re-blessed; classroom golden gates passed. |
| Whole-app product immersion audit | Done 2026-06-12 in commit `5a55957b`; no app source, tests, goldens, or baselines changed. |

## Queue Rules

- The next code slice after Shell and Workbench Layout Reset is `fix: rebuild RedByte project command center`.
- Lab profile / course-pack work is intentionally deferred, not cancelled.
- Do not mix shell reset, Verify workbench, Project command center, Export handoff, Hardware, Design, lab profile, Import, Vivado proof, or commercialization slices unless a direct dependency is proven.
- Do not change simulation, Verify result semantics, pin mapping semantics, VHDL, XDC, testbench, Tcl, ZIP, project data format, or goldens in layout-only slices.
- Do not update goldens or screenshots as a substitute for explaining behavior.
- Screenshots prove layout. Tests prove behavior. Vivado/hardware runs prove downstream handoff.
- Accounts/SaaS remain deferred until a real hosted-data or classroom-management need exists.
