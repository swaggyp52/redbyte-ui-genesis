---
doc_status: current
last_validated: 2026-05-04
owner: Connor Angiel
used_by_claude: true
role: ordered near-term RedByte work queue for agents and maintainers
---

# RedByte Work Queue

This is the ordered near-term queue. Do not skip from 1-5 to 6-9 unless the user explicitly reprioritizes.

---

## Queue

| # | Slice | Why it matters now | Source docs | Expected commit type | Done criteria |
|---|---|---|---|---|---|
| 1 | Reconcile dirty or concurrent working tree | Prevents mixed commits, hidden scope drift, and accidental staging of unrelated work | `docs/ai-usage-rules.md`, current `git status`, `AI_STATE.md` | `chore:` or no commit if purely coordination | All current changes are understood; the intended slice is isolated; unrelated files stay unstaged or are explicitly coordinated |
| 2 | Finish honest proof closure: `golden` E3, custom-row E2/E3, certification matrix | This is the main blocker on honest student-safe hardware claims | `docs/ACTIVE_WORK.md`, `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/vivado-basys3-certification-matrix.md`, proof docs | `docs:` or `chore:` | Bench logs captured; proof docs updated; certification matrix updated; release-readiness truth stays scoped and honest |
| 3 | Project `F-P1` next-action semantics | The first screen still tells two stories at once; this is the highest-leverage UX contradiction | `docs/ACTIVE_WORK.md`, `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md`, `docs/ide/01-project.md` | `fix:` or `ide:` | Project next-action card headline, status framing, and CTA agree; focused tests and browser proof pass |
| ~~4~~ | ~~Export `F-E1` / `F-E2` trust language~~ | ~~Export still repeats the repair story and blurs summary vs action~~ | — | — | **Done 2026-05-05** — commit `4a248098` (`fix(export): clarify draft versus trusted export`): `summaryStateTitle`, `nextActionTitleDistinct`, `nextActionDetailDistinct` derived per condition; 18 trust-clarity tests + 3 gates pass |
| ~~5~~ | ~~Map Pins `F-H2` / `F-H3` trust language~~ | ~~Students still see stale guidance and warning color without a clear resolution path~~ | — | — | **Done 2026-05-05** — commit `aeda6bc4` (`fix(hardware): clarify mapping versus verified trust`): guide collapses when `mappingReady`; hint names specific Verify action per `failureTruth.condition`; 40 hardware tests pass |
| 6 | Curate starter and example learning path | The circuits exist, but the product still lacks a clear guided path through them | `docs/STUDENT_RELEASE_READINESS.md`, `docs/manuals/RedByte_Product_Manual.md`, examples and lab starter files | `docs:` or `feat:` | Existing starters gain short purpose, learning-goal, and proof-scope copy; no new circuit scope is invented |
| 7 | In-app onboarding | First-run orientation should happen inside the product before website polish or pilot messaging | current-truth docs, `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md`, Project surface spec | `feat:` | First-run users can tell what RedByte is, what to open first, and what Draft vs Trusted means without leaving the app |
| 8 | Public website and download path | Public messaging should follow the proof matrix, not lead it | current-truth docs, release-readiness docs, website truth docs | `docs:` or `feat:` | Website copy, screenshots, and setup path match current product truth exactly; no unsupported claims ship |
| 9 | University pilot package | Pilot outreach should happen after the product and public story stop needing caveats every minute | release-readiness docs, instructor docs, proof docs | `docs:` | Instructor packet, demo script, and pilot ask are scoped to what RedByte can currently prove |

---

## Queue rules

- Items 2-5 are the current truth-preserving core.
- Items 6-9 are distribution and adoption work; they depend on 2-5 being honest first.
- If a new request conflicts with this order, update this file and `AI_STATE.md` together.
- Do not create a new big roadmap doc when this queue and `docs/ACTIVE_WORK.md` can carry the plan.