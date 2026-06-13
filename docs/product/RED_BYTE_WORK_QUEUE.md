---
doc_status: current
last_validated: 2026-06-13
owner: Connor Angiel
used_by_claude: true
role: ordered near-term RedByte V1 work queue for agents and maintainers
---

# RedByte Work Queue

This is the ordered near-term queue after the V1 product contract reset. Do not skip ahead unless the user explicitly reprioritizes.

## Queue

| # | Slice | Why it matters now | Source docs | Expected commit type | Done criteria |
|---|---|---|---|---|---|
| 1 | V1 Contract Reset | Establish the research, visual evidence, contract, delete/demote/rebuild inventory, and execution program before more product code. | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`, `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md`, `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md` | `docs:` | Docs/control slice committed and pushed; docs/encoding/diff checks pass; no app source, tests, goldens, or hardware proof changed. |
| 2 | Shell and Workbench Layout Reset | The shell repeats too many status authorities and every surface inherits that first-viewport problem. Fix the frame before deeper surface work. | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`, `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md`, visual audit | `fix:` | One compact shell/status authority; Project/Design/Verify/Hardware/Export/Import screenshots at common viewports; behavior gates still green; no semantics/export/hardware changes. |
| 3 | Verify Evidence Workbench | Verify behavior is strong, but the evidence/repair loop still reads like a dense instrument panel. | V1 contract Verify section, visual audit, `RB-VERIFY-EVIDENCE-001` in the issue index | `fix:` or `refactor:` | PASS/FAIL evidence, first mismatch, expected/observed values, waveform, and repair path are first-order; Verify gates remain green. |
| 4 | Project Command Center | Project should be a command center for blank, starter, saved, import/recovery, and future instructor lab paths, not a starter gallery. | V1 contract Project section, visual audit, `RB-PROJECT-CC-001` | `fix:` | No-circuit copy is neutral; next action visible without scroll; ECE141-specific identity is demoted. |
| 5 | Export Handoff Station | Export must be the one trustworthy Vivado handoff state and currently has visible mapping-summary contradiction risk. | V1 contract Export section, visual audit, `RB-EXPORT-HANDOFF-001` | `fix:` | Draft/E0-ready states are singular; mapping summary agrees with actual mapping; export gates and artifact checks pass. |
| 6 | Hardware / Basys3 Workbench | Keep the board/table direction but make E0 handoff language impossible to confuse with hardware proof. | V1 contract Hardware section, visual audit, `RB-HARDWARE-WB-001` | `fix:` | Signal -> board resource -> package pin -> XDC chain is visible; no E1/E2/E3 overclaim. |
| 7 | Design Workbench | The circuit graph must become the first object after a starter or project loads. | V1 contract Design section, visual audit, `RB-DESIGN-WB-001` | `fix:` | Meaningful nodes/connections are visible at `1366x768`; palette/toolbar/inspector support the graph instead of displacing it. |
| 8 | Lab Profile / Course Pack Data Seam | Course-pack data is important, but it should follow the workbench reset so the data seam plugs into a stable product shell. | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`, general lab audit, `RB-LAB-001` | `refactor:` or `feat:` | One small profile-backed lab path; Basys3 logic stays core; no-solution policy remains enforced. |
| 9 | Import / Recovery | Import stays a utility but needs representative fidelity/recovery proof after the primary spine stabilizes. | V1 contract Import section, `RB-IMPORT-001` | `fix:` or `test:` | Representative import/recovery paths prove fidelity messages and review-before-apply behavior. |
| 10 | Student/Instructor Quickstarts | Classroom readiness requires public-facing docs after UI/proof posture stabilizes. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`, release docs, V1 contract | `docs:` | Student first-lab and instructor setup/support quickstarts exist and match current app truth. |
| 11 | Vivado/Basys3 Proof Restoration | Student-safe hardware claims require fresh proof on a machine with Vivado 2024.2 and hardware access. | `docs/STUDENT_RELEASE_READINESS.md`, certification matrix, proof docs | `docs:` or `chore:` | E1/E2/E3 evidence updated only from Vivado/board runs; no screenshots-only hardware claim. |
| 12 | Packaging/Commercial Readiness | Commercial packaging belongs after product trust, quickstarts, and hardware proof. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`, V1 execution program | `docs:` or `chore:` | Hosted/support/local package posture reviewed; accounts/SaaS deferred unless concrete hosted-data need is proven. |

## Recently Closed / Historical Items

| Item | Status |
|---|---|
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

- The next code slice after this docs/control reset is `fix: reset RedByte workbench shell layout`.
- Lab profile / course-pack work is intentionally demoted to item 8, not cancelled.
- Do not mix shell reset, Verify workbench, Project command center, Export handoff, Hardware, Design, lab profile, Import, Vivado proof, or commercialization slices unless a direct dependency is proven.
- Do not change simulation, Verify result semantics, pin mapping semantics, VHDL, XDC, testbench, Tcl, ZIP, project data format, or goldens in layout-only slices.
- Do not update goldens or screenshots as a substitute for explaining behavior.
- Screenshots prove layout. Tests prove behavior. Vivado/hardware runs prove downstream handoff.
- Accounts/SaaS remain deferred until a real hosted-data or classroom-management need exists.
