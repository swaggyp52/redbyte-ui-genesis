---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: sync rules between canonical repo docs and the RedByte Obsidian vault
---

# RedByte Obsidian Sync Rules

These rules keep the repo docs and the Obsidian vault aligned without duplicating current product truth.

---

## 1. Repo docs vs Obsidian

| Canonical home | Put it here | Do not put it here |
|---|---|---|
| Repo docs (`docs/`, `AI_STATE.md`) | current product truth, release posture, proof matrix, operating rules, work queue, public claims, manual behavior, hardening tickets | transient brainstorming, local debugging scraps, duplicate architecture summaries |
| Obsidian vault | working memory, architecture notes, ADR context, session handoffs, local routing and investigation notes | competing current-truth product definitions, second release matrix, stale copies of repo docs |

Rule: if a fact changes what RedByte claims publicly or operationally, the repo doc owns it first.

---

## 2. When to update the Engineering Brain

Update `01 Dashboard/RedByte Engineering Brain.md` when any of these change:

- top priorities or blocked items
- next concrete action for the next session
- a stable truth that future sessions must preserve
- a new control rule that changes how agents should route work

Keep the dashboard short. Link out to repo docs instead of restating them.

---

## 3. When to create or update a decision note

Create or update an ADR in `04 Decisions/` when the change introduces a lasting rule such as:

- a new cross-surface workflow boundary
- a new truth-layer rule
- a new state-vocabulary rule
- a durable authority move between surfaces or systems
- a durable tooling boundary that future agents must preserve

Do not create ADRs for one-off bug fixes or temporary queues.

---

## 4. When to update the Session Log

Update `08 Agents + Prompts/Session Log.md` at the end of a meaningful session when there is a useful handoff.

Every entry should answer:

- what changed
- what is true now
- what is still open
- exact next action

If the Session Log already has unrelated dirty changes and the current slice must stay isolated, do not bundle those unrelated edits into the commit just to satisfy bookkeeping. In that case:

1. add the factual `AI_STATE.md` entry
2. mention the skipped Session Log update in the slice summary
3. add the Session Log handoff in the next clean docs pass

---

## 5. How to avoid stale duplication

- Do not create a second "current truth" note in Obsidian when a repo doc already owns that truth.
- When a vault note needs current product truth, link to the repo doc instead of copying paragraphs.
- If a vault note conflicts with the manual, release-readiness docs, or this control pack, the repo doc wins and the vault note must be updated or marked stale.
- Before creating a new vault note, follow `08 Agents + Prompts/Canonical Notes Policy.md`.

---

## 6. Suggested sync map

| Change type | Repo docs to update first | Obsidian follow-up |
|---|---|---|
| Product behavior change | manual, surface spec, `AI_STATE.md` | dashboard + relevant architecture note |
| Release or proof change | `docs/STUDENT_RELEASE_READINESS.md`, certification matrix, proof docs, `AI_STATE.md` | dashboard + session handoff |
| New work ordering or process rule | `docs/ACTIVE_WORK.md`, this control pack, `AI_STATE.md` | dashboard |
| Architecture truth change | `docs/IDE_SYSTEM_MAP.md`, relevant spec or contract, `AI_STATE.md` | architecture note + ADR if durable |

---

## 7. Memory bridge workflow

For Obsidian/memory/traceability tasks, use the repo-local bridge commands:

```bash
pnpm rb:memory:doctor
pnpm rb:memory:index
pnpm rb:memory:search -- "RedByte product truth"
pnpm rb:memory:trace -- "Map Pins does not replace Verify proof"
pnpm rb:memory:sync-plan
```

Rules:

- The bridge may read configured vault Markdown notes.
- The bridge may write generated reports only under `.redbyte/agent/runs/` and generated indexes only under `.redbyte/agent/memory/index/`.
- The bridge must not write to the vault in v0.
- A sync plan is a proposal, not an applied Obsidian edit.
- Repo current-state docs win over vault memory when they conflict.

See `docs/product/RED_BYTE_OBSIDIAN_MEMORY_BRIDGE.md` and `docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md`.

---

## 8. Current rule for this control-pack slice

This control-pack is canonical in the repo. Obsidian should reference it as the agent-routing layer instead of recreating a second product-control summary.
