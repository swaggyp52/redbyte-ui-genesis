---
type: architecture
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[Hook Integration Plan]]"
  - "[[Skill Installation Guide]]"
  - "[[Claude Session Mode]]"
  - "[[Workspace Routing]]"
  - "[[RedByte Engineering Brain]]"
---

# Automation Strategy

This note documents the automation architecture for the RedByte vault + Claude Code integration. The goal is to make documentation passes automatic — not dependent on memory — and to make vault views queryable without manual curation.

---

## Layers

### Layer 1 — Persistent instructions (active)

**What:** `CLAUDE.md` in repo root
**Effect:** Claude reads this at session start. Enforces connection shape, test runner constraint, and Obsidian integration rule automatically.
**Status:** Done. In place.

### Layer 2 — Reusable skill (draft ready)

**What:** `.claude/skills/redbyte-obsidian-maintainer/SKILL.md`
**Effect:** Claude can be invoked by name to run a structured maintenance pass. Auto-triggers when relevant.
**Status:** Draft at `08 Agents + Prompts/redbyte-obsidian-maintainer SKILL.md`. Not yet installed.
**Next step:** Copy draft to `.claude/skills/redbyte-obsidian-maintainer/SKILL.md` when ready.

### Layer 3 — Lifecycle hooks (planned)

**What:** `.claude/hooks/post-test.sh` or equivalent
**Effect:** After any test run, automatically triggers Post-Run Extraction without requiring a manual prompt.
**Status:** Not yet implemented. Blocked on confirming Claude Code hook support for this project.
**Next step:** See `08 Agents + Prompts/Hook Integration Plan.md`.

### Layer 4 — Structured queries (active)

**What:** Obsidian Properties on all notes + Dataview/Bases queries in Dashboard
**Effect:** Vault is queryable by `type`, `status`, `area`, `priority`. Dashboard shows live views.
**Status:** Active. All 13 notes have Properties frontmatter. Three Dataview blocks in Dashboard.
**Maintenance rule:** Never invent new property names — Bases/Dataview break silently on drift.

### Layer 5 — Obsidian URI automation (future)

**What:** Obsidian URI scheme (`obsidian://open`, `obsidian://new`)
**Effect:** External scripts can open notes, append to session logs, or create handoff notes from outside the UI.
**Status:** Not yet implemented. Reserved for when human workflow is stable.
**Note:** Do not build this until Layers 1–4 are working consistently.

---

## Automation readiness checklist

| Layer | Status | Blocking on |
|---|---|---|
| CLAUDE.md instructions | ✅ Active | — |
| Obsidian-maintainer skill | 🟡 Draft ready | Manual install to `.claude/skills/` |
| Post-test hooks | 🔴 Not started | Hook implementation |
| Structured queries (Bases/Dataview) | ✅ Active | — |
| Obsidian URI automation | 🔴 Not started | Layer 1–4 stability |

---

## What to automate vs. what to keep manual

**Automate:**
- Documentation passes after test runs
- Bug status updates when a fix is confirmed
- Hub note updates after canonical note changes

**Keep manual (human review required):**
- Creating new ADRs (decisions need deliberate framing)
- Merging or deleting notes
- Modifying `CLAUDE.md` (change to instructions = change to Claude behavior)
- Updating `Canonical Notes Policy.md` (adding new canonical notes)

---

## Guiding principle

Build the automation in order. Each layer makes the next one more reliable:
1. Persistent instructions → Claude reads the rules
2. Skill → Claude has a reusable behavior
3. Hooks → the behavior fires automatically
4. Queries → the vault is always explorable
5. URI → the vault is scriptable from outside

Don't skip layers.
