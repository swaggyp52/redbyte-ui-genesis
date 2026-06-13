---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: ordered near-term RedByte work queue for agents and maintainers
---

# RedByte Work Queue

This is the ordered near-term queue. Do not skip ahead unless the user explicitly reprioritizes.

---

## Queue

| # | Slice | Why it matters now | Source docs | Expected commit type | Done criteria |
|---|---|---|---|---|---|
| 1 | First lab-profile/course-pack seam | Sprint 0 defined the target lab profile model, but ECE141 lab data and starter IDs still live too close to core app source. | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`, `docs/audits/2026-06-12-redbyte-general-lab-workbench-audit.md`, `RB-LAB-001` in the issue index | `refactor:` or `feat:` | One small profile/course-pack data seam exists; Basys3 board logic stays core; no-solution policy remains enforced |
| 2 | Remaining Verify density / evidence workbench cleanup | Verify behavior is now covered by RB-VERIFY-001, but Verify still needs a focused visual pass so waveform/evidence density reads as a repair workbench rather than crowded chrome. The visual-system integrity sprint reduced the worst overflow but did not close all Verify polish debt. | `RB-VERIFY-002`, `RB-WAVE-001` in `docs/plans/2026-06-12-redbyte-product-issue-index.md`, Verify surface specs | `fix:` or `refactor:` | Browser proof at 1366x768 shows clearer evidence hierarchy without changing simulation semantics |
| 3 | Broader student workflow browser suite | After the lab-profile seam and Verify density slice, confirm the full student path behaves coherently in browser. | `docs/release/course-edition/08-validation-log.md`, ECE141 Playwright gates, `docs/STUDENT_RELEASE_READINESS.md` | `test:` or `chore:` | Relevant Project -> Design -> Verify -> Map Pins / Hardware -> Export browser gates pass or failures are logged honestly |
| 4 | Vivado/Basys3 proof restoration | Student-safe hardware claims require fresh proof on a machine with Vivado 2024.2 and hardware access. | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/vivado-basys3-certification-matrix.md`, proof docs | `docs:` or `chore:` | Vivado path confirmed; board run captured; E1/E2/E3 claims updated only from evidence; generated packs and tracked proof docs reconciled |
| 5 | Student and instructor quickstarts | Commercial/classroom readiness requires public-facing instructions, not just agent docs. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`, release docs, manual | `docs:` | Student first-lab quickstart and instructor setup/support quickstart exist and match current app truth |
| 6 | Commercial/license packaging | RedByte is not commercially ready yet; packaging comes after UX, proof, and quickstarts. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md` | `docs:` or `chore:` | License/support/deployment posture reviewed; accounts/SaaS remain deferred unless a real hosted-data need is proven |

---

## Recently Closed / Historical Items

| Item | Status |
|------|--------|
| Verify fail-edit-repair regression | Done 2026-06-12: `ide:gate:verify-fail-edit-repair` proves PASS -> expected-output edit/stale -> FAIL -> repair/stale -> PASS, Project PASS/CLEAN, and Export Checks match / READY TO BUILD. No product source fix was needed. |
| General Lab Workbench Sprint 0 / gate truth | Done 2026-06-12: stale Verify/Export gate assumptions repaired; `ide:gate:from-scratch-general-workflow` added; blank-project IO/export aliasing defects fixed; lab profile target model documented. |
| Visual system integrity | Done 2026-06-12: Export handoff/evidence/action content is first-viewport visible, Draft Export no longer claims ready-to-build, Verify command/header overflow is removed, expected-output cells remain editable, and `ide:gate:ece141-visual-system-integrity` guards cross-surface layout. |
| Hardware / Map Pins visual credibility | Done 2026-06-12: left Map Pins guide no longer wraps copy word-by-word; board/table remain focal; `ide:gate:ece141-hardware-visual-credibility` and existing Map Pins recovery/viewport/product gates pass locally. |
| First-viewport repair | Done 2026-06-12: Project, Design, Hardware/Map Pins, and Export first viewport hierarchy fixed and covered by `ide:gate:ece141-first-viewport`; no simulation/export/Vivado semantics changed. |
| Resident visual stewardship pass | Done 2026-06-12: repo-local RedByte playbooks, browser-backed visual direction audit, UI architecture inventory, visual hardening plan, and local dev-server note added. |
| Product-brain integration | Done 2026-06-12 in commit `4b4e0b3e`; product immersion docs linked into cockpit and issue index created. |
| Docs/backbone reconciliation | Done 2026-06-12 in commit `91118512`. |
| Golden export SHA investigation under repo-pinned runtime | Done 2026-06-12 under available Node 24.15.0 runtime: root cause source-explained as intended README evidence-boundary byte change; two SHA fixtures re-blessed; both classroom golden gates pass. Node 20.19.0 was not available in this shell. |
| Whole-app product immersion audit | Done 2026-06-12 in commit `5a55957b`; no app source, tests, goldens, or baselines changed. |
| Project `F-P1` next-action semantics | Done. Do not reopen without new evidence. |
| Export `F-E1` / `F-E2` trust language | Done. Do not reopen without new evidence. |
| Map Pins `F-H2` / `F-H3` trust language | Done. Do not reopen without new evidence. |
| Curated starter and example learning path | Done. Do not reopen without new evidence. |
| `build:unified` route/lock drift | Done in later validation logs. Reopen only with a fresh failing run. |

---

## Queue Rules

- Item 1 is the next approved architecture/data-boundary slice.
- Item 2 is the next approved visual slice and must stay separate from item 1.
- Item 4 is board/manual-evidence gated and cannot be completed on a desktop without Vivado 2024.2 and Basys3 hardware.
- Do not re-bless golden SHAs unless the artifact difference is source-explained and accepted.
- Do not reopen stricken or historical queue items unless new repo evidence shows the closure was wrong.
- If a new request conflicts with this order, update this file and `docs/ACTIVE_WORK.md` together.
- Do not create a new big roadmap doc when this queue and `docs/ACTIVE_WORK.md` can carry the plan.
- Tests passing is evidence, not product readiness. Use browser workflows, visual inspection, and hardware/Vivado proof for the claims they actually prove.
- Accounts/SaaS remain deferred until a concrete classroom-management or hosted-data requirement exists.
