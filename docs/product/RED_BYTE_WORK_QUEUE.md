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
| 1 | Verify fail-edit-repair regression | The audit found that repairing an intentional expected-output mismatch can strand stale/run-disabled state in a dirty browser context. | `RB-VERIFY-001` in `docs/plans/2026-06-12-redbyte-product-issue-index.md`, Verify surface specs | `test:` then `fix:` | Focused browser regression proves fail -> edit repair -> rerun -> PASS before and after the fix |
| 2 | Broader student workflow browser suite | After the first-viewport and Verify repair slices, confirm the full student path behaves coherently in browser. | `docs/release/course-edition/08-validation-log.md`, ECE141 Playwright gates, `docs/STUDENT_RELEASE_READINESS.md` | `test:` or `chore:` | Relevant Project -> Design -> Verify -> Map Pins / Hardware -> Export browser gates pass or failures are logged honestly |
| 3 | Vivado/Basys3 proof restoration | Student-safe hardware claims require fresh proof on a machine with Vivado 2024.2 and hardware access. | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/vivado-basys3-certification-matrix.md`, proof docs | `docs:` or `chore:` | Vivado path confirmed; board run captured; E1/E2/E3 claims updated only from evidence; generated packs and tracked proof docs reconciled |
| 4 | Student and instructor quickstarts | Commercial/classroom readiness requires public-facing instructions, not just agent docs. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`, release docs, manual | `docs:` | Student first-lab quickstart and instructor setup/support quickstart exist and match current app truth |
| 5 | Commercial/license packaging | RedByte is not commercially ready yet; packaging comes after UX, proof, and quickstarts. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md` | `docs:` or `chore:` | License/support/deployment posture reviewed; accounts/SaaS remain deferred unless a real hosted-data need is proven |

---

## Recently Closed / Historical Items

| Item | Status |
|------|--------|
| First-viewport repair | Done 2026-06-12: Project, Design, Hardware/Map Pins, and Export first viewport hierarchy fixed and covered by `ide:gate:ece141-first-viewport`; no simulation/export/Vivado semantics changed. |
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

- Item 1 is the next approved implementation slice.
- Item 3 is board/manual-evidence gated and cannot be completed on a desktop without Vivado 2024.2 and Basys3 hardware.
- Do not re-bless golden SHAs unless the artifact difference is source-explained and accepted.
- Do not reopen stricken or historical queue items unless new repo evidence shows the closure was wrong.
- If a new request conflicts with this order, update this file and `docs/ACTIVE_WORK.md` together.
- Do not create a new big roadmap doc when this queue and `docs/ACTIVE_WORK.md` can carry the plan.
- Tests passing is evidence, not product readiness. Use browser workflows, visual inspection, and hardware/Vivado proof for the claims they actually prove.
- Accounts/SaaS remain deferred until a concrete classroom-management or hosted-data requirement exists.
