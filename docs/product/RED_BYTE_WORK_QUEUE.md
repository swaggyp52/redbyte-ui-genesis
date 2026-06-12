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
| 1 | Broader student workflow browser suite | After deterministic artifact truth is stable, confirm the full student path still behaves coherently in browser. | `docs/release/course-edition/08-validation-log.md`, ECE141 Playwright gates, `docs/STUDENT_RELEASE_READINESS.md` | `test:` or `chore:` | Relevant Project -> Design -> Verify -> Map Pins / Hardware -> Export browser gates pass or failures are logged honestly |
| 2 | Vivado/Basys3 proof restoration | Student-safe hardware claims require fresh proof on a machine with Vivado 2024.2 and hardware access. | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/vivado-basys3-certification-matrix.md`, proof docs | `docs:` or `chore:` | Vivado path confirmed; board run captured; E1/E2/E3 claims updated only from evidence; generated packs and tracked proof docs reconciled |
| 3 | Product feature work | Feature work should resume only after docs truth, artifact determinism, browser flow, and proof posture are stable. | Current product docs and explicit user request | `feat:` or `fix:` | Narrow approved slice implemented with focused validation and docs updates |

---

## Recently Closed / Historical Items

| Item | Status |
|------|--------|
| Docs/backbone reconciliation | Done 2026-06-12 in commit `91118512`. |
| Golden export SHA investigation under repo-pinned runtime | Done 2026-06-12 under available Node 24.15.0 runtime: root cause source-explained as intended README evidence-boundary byte change; two SHA fixtures re-blessed; both classroom golden gates pass. Node 20.19.0 was not available in this shell. |
| Project `F-P1` next-action semantics | Done. Do not reopen without new evidence. |
| Export `F-E1` / `F-E2` trust language | Done. Do not reopen without new evidence. |
| Map Pins `F-H2` / `F-H3` trust language | Done. Do not reopen without new evidence. |
| Curated starter and example learning path | Done. Do not reopen without new evidence. |
| `build:unified` route/lock drift | Done in later validation logs. Reopen only with a fresh failing run. |

---

## Queue Rules

- Item 1 is the current first technical investigation after the docs/backbone and golden SHA passes.
- Item 2 is board/manual-evidence gated and cannot be completed on a desktop without Vivado 2024.2 and Basys3 hardware.
- Do not re-bless golden SHAs unless the artifact difference is source-explained and accepted.
- Do not reopen stricken or historical queue items unless new repo evidence shows the closure was wrong.
- If a new request conflicts with this order, update this file and `docs/ACTIVE_WORK.md` together.
- Do not create a new big roadmap doc when this queue and `docs/ACTIVE_WORK.md` can carry the plan.
