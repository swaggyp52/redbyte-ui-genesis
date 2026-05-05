---
doc_status: current
last_validated: 2026-05-04
owner: Connor Angiel
used_by_claude: true
role: canonical operating rules for Claude and Copilot sessions working on RedByte
---

# RedByte Agent Operating Rules

This file defines how agent sessions choose work, avoid stale context, and keep commits bounded.

---

## 1. Non-negotiables

- Read current truth before coding.
- Prefer the smallest reversible slice.
- One logical change per commit.
- No broad rewrites.
- No speculative cleanup.
- No public claims beyond the current proof matrix.
- No pushing unless the user explicitly asks.
- Do not touch unrelated dirty files just because they are present.
- Do not delete files or whole areas without a dependency audit.

---

## 2. Mandatory read order before coding

Always read:

1. `AI_STATE.md`
2. `docs/ACTIVE_WORK.md`
3. `docs/STUDENT_RELEASE_READINESS.md`
4. `docs/manuals/RedByte_Product_Manual.md`
5. `docs/contracts/RedByte_Product_Contract.md`

For product, UX, workflow, or surface work also read:

6. `docs/IDE_SYSTEM_MAP.md`
7. `docs/ide/SURFACE_CONFORMANCE.md`
8. `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md` if the task touches UX semantics, surface hierarchy, or next-action language
9. the relevant proof or hardening doc for the touched surface

For Obsidian or note-sync work also read:

- `08 Agents + Prompts/Canonical Notes Policy.md`
- `01 Dashboard/RedByte Engineering Brain.md`

Do not use stale or OS-era docs from the stale zone in `docs/DOC_INDEX.md` as default context.

---

## 3. How to choose the next slice

When the user does not specify a slice, choose work in this order:

1. Resolve or isolate dirty concurrent work if it threatens commit hygiene.
2. Close proof gaps that limit honest student-safe claims.
3. Fix workflow-language contradictions on the active student path.
4. Curate examples and onboarding only after proof and trust language are honest.
5. Touch website or pilot materials only after the app truth supports those claims.

Priority rule:

`proof closure > workflow-language consistency > example curation > onboarding > website > pilot`

---

## 4. Stale-roadmap guards

Do not restart these without new failing proof:

- README/manual overclaim cleanup
- sequential-boundary enforcement
- Project first-load black-screen fix (`F-P2`)
- board-clock semantics reset
- import visibility fix after successful import
- old-app cleanup claims from stale briefs

Do not treat `PRODUCT.md` as the current owner of route or product truth when it conflicts with newer docs.

Do not start broad website or public-brand work while proof closure and current workflow-language debt remain open.

---

## 5. Work categories

| Category | What it covers | Primary docs |
|---|---|---|
| Proof closure | E1/E2/E3 certification, bench logs, release truth | `docs/STUDENT_RELEASE_READINESS.md`, certification matrix, proof docs |
| UX semantics | Next actions, trust language, stage ownership, student-facing flow | `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md`, `docs/IDE_PRODUCT_DEBT_REGISTER.md`, surface specs |
| Docs truth | Current-truth wording, control docs, manuals, routing docs | `docs/manuals/*`, `docs/DOC_INDEX.md`, this control pack |
| Examples | Starter/example learning path, descriptions, honest labels | `packages/rb-apps` examples, release readiness docs |
| Website | Public copy, screenshots, install/download path | current-truth docs plus website truth docs |
| Pilot | Instructor pitch, classroom packet, demo script | release readiness docs, instructor docs, proof docs |
| Infra | Gates, doc validation, build/process hygiene | `docs/ai-usage-rules.md`, `AI_STATE.md`, scripts/gates |

---

## 6. Tool and integration boundaries

- GitHub tools are valid for repo-aware work, issues, PR status, and remote context.
- Foundry-related tooling is opt-in only. Use it when the task explicitly touches Foundry-backed code or `services/redbyte-intelligence`, not as a default repo tool.
- Do not start parallel integrations just because they exist in the repo.

---

## 7. Required updates after coding

Update `AI_STATE.md` for every meaningful completed slice.

Update the smallest set of additional docs that the slice actually changes:

- `docs/ACTIVE_WORK.md` when priorities, blockers, or latest proof change
- `docs/STUDENT_RELEASE_READINESS.md` when certification tiers or student-safe claims change
- relevant `docs/ide/*.md` surface spec when user-visible surface behavior changes
- `docs/manuals/RedByte_Product_Manual.md` when current product behavior changes materially
- `docs/DOC_INDEX.md` when canonical document routing changes
- Obsidian dashboard / handoff notes when canonical notes policy says the change needs hub-note sync

If a bookkeeping file already has unrelated dirty changes, do not co-stage that file accidentally. Either:

- avoid touching it for the current slice, or
- make the touch explicit and keep the staged diff isolated

---

## 8. Done means

A RedByte slice is done only when:

1. the requested behavior or docs change is complete
2. focused validation has been run and read
3. affected canonical docs are updated honestly
4. the diff is isolated to the intended slice
5. one bounded local commit exists if the user asked for a commit

"Done" does not mean:

- the code compiles in theory
- the roadmap sounds better
- the UI looks cleaner without proof
- unrelated dirty files were bundled together

---

## 9. Commit discipline

- Use the smallest truthful prefix for the slice: `fix:`, `feat:`, `docs:`, `chore:`.
- Prefer `docs:` for control-pack, routing, or truth-layer updates.
- Commit only files that belong to the current slice.
- Leave unrelated worktree changes untouched.