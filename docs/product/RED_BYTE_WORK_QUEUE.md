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
| 1 | Docs/backbone reconciliation | Future agents need to trust the right repo, startup docs, current cockpit, stale-zone routing, and proof-pack boundaries before implementation resumes. | `AGENTS.md`, `CLAUDE.md`, `docs/ACTIVE_WORK.md`, `docs/DOC_INDEX.md`, this file | `docs:` | Startup hierarchy aligned; stale claims corrected; audit note added; docs/encoding validation passed; no app source touched |
| 2 | Golden export SHA investigation under repo-pinned runtime | The desktop audit found two classroom golden ZIP SHA failures. These are the first technical blocker before feature work. | `docs/ACTIVE_WORK.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, classroom golden tests, committed golden SHA files | `test:` or `fix:` after root cause is known | Reproduced on Node 20.19.0 / pnpm 10.24.0; ZIP differences inspected; no SHA re-bless unless drift is intentional and accepted |
| 3 | Broader student workflow browser suite | After deterministic artifact truth is stable, confirm the full student path still behaves coherently in browser. | `docs/release/course-edition/08-validation-log.md`, ECE141 Playwright gates, `docs/STUDENT_RELEASE_READINESS.md` | `test:` or `chore:` | Relevant Project -> Design -> Verify -> Map Pins / Hardware -> Export browser gates pass or failures are logged honestly |
| 4 | Vivado/Basys3 proof restoration | Student-safe hardware claims require fresh proof on a machine with Vivado 2024.2 and hardware access. | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/vivado-basys3-certification-matrix.md`, proof docs | `docs:` or `chore:` | Vivado path confirmed; board run captured; E1/E2/E3 claims updated only from evidence; generated packs and tracked proof docs reconciled |
| 5 | Product feature work | Feature work should resume only after docs truth, artifact determinism, browser flow, and proof posture are stable. | Current product docs and explicit user request | `feat:` or `fix:` | Narrow approved slice implemented with focused validation and docs updates |

---

## Recently Closed / Historical Items

| Item | Status |
|------|--------|
| Project `F-P1` next-action semantics | Done. Do not reopen without new evidence. |
| Export `F-E1` / `F-E2` trust language | Done. Do not reopen without new evidence. |
| Map Pins `F-H2` / `F-H3` trust language | Done. Do not reopen without new evidence. |
| Curated starter and example learning path | Done. Do not reopen without new evidence. |
| `build:unified` route/lock drift | Done in later validation logs. Reopen only with a fresh failing run. |

---

## Queue Rules

- Item 2 is the current first technical investigation after this docs pass.
- Item 4 is board/manual-evidence gated and cannot be completed on a desktop without Vivado 2024.2 and Basys3 hardware.
- Do not re-bless golden SHAs during docs/backbone work.
- Do not reopen stricken or historical queue items unless new repo evidence shows the closure was wrong.
- If a new request conflicts with this order, update this file and `docs/ACTIVE_WORK.md` together.
- Do not create a new big roadmap doc when this queue and `docs/ACTIVE_WORK.md` can carry the plan.
