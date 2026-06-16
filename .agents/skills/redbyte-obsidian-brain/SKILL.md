---
name: redbyte-obsidian-brain
description: Use when RedByte work should consult or update the Obsidian engineering brain, repo-local working memory, or product-brain routing docs.
---

# RedByte Obsidian Brain

Use this skill when a task asks to use the Obsidian brain, update local product memory, or reconcile product direction with the docs backbone.

## Authority

Canonical truth is still code, tests, `AGENTS.md`, `AI_STATE.md`, `docs/ACTIVE_WORK.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, `docs/product/RED_BYTE_WORK_QUEUE.md`, surface specs, and release proof docs. Obsidian notes and `.redbyte-brain/` are working memory. They must not override current source or canonical docs.

## Read Paths

For product work, read the relevant canonical docs first, then consult:

- `01 Dashboard/RedByte Engineering Brain.md`
- `08 Agents + Prompts/Claude Session Mode.md`
- `08 Agents + Prompts/Canonical Notes Policy.md`
- Relevant `03 Architecture/*.md` notes for the touched surface

## Local Scratchpad

`.redbyte-brain/` is allowed only as ignored local working memory. Keep it small and link back to canonical docs. Do not stage or commit it unless the user explicitly approves.

Recommended scratchpad files:

- `README.md`
- `DASHBOARD.md`
- `current-sprint.md`
- `product-issues.md`
- `frontend-affordance-ledger.md`
- `next-task.md`

## Update Rules

When implementation or proof changes product truth, update canonical docs first. Update Obsidian/dashboard notes only when they add routing value, capture a real decision, or prevent repeated drift. Prefer updating existing notes over creating duplicates.
