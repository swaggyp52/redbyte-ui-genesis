---
type: handoff
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[Claude Session Mode]]"
  - "[[Hook Integration Plan]]"
  - "[[Skill Installation Guide]]"
  - "[[Automation Strategy]]"
  - "[[RedByte Engineering Brain]]"
---

# Operational Readiness Review

*Reviewed: 2026-03-25*

---

## Ready right now — use immediately

| Item | Location | State |
|---|---|---|
| `CLAUDE.md` persistent instructions | `redbyte-ui/CLAUDE.md` | ✅ In repo root. Claude reads this at session start. |
| Note schema | `03 Architecture/Note Schema.md` | ✅ All 13 notes have correct Properties. |
| Canonical notes policy | `08 Agents + Prompts/Canonical Notes Policy.md` | ✅ Maps every system area to one source-of-truth note. |
| Session Mode prompt | `08 Agents + Prompts/Claude Session Mode.md` | ✅ Full operating contract. Paste or say "Enter Session Mode." |
| Post-Run Extraction prompt | `08 Agents + Prompts/Post Run Extraction.md` | ✅ Use after every test paste. |
| Session Startup Checklist | `08 Agents + Prompts/Session Startup Checklist.md` | ✅ 5-step startup. Run it. |
| Session Shutdown Checklist | `08 Agents + Prompts/Session Shutdown Checklist.md` | ✅ 5-step shutdown. Non-negotiable. |
| Dashboard | `01 Dashboard/RedByte Engineering Brain.md` | ✅ Operational entry point. Open first every session. |
| Dataview queries | In dashboard | ✅ Functional once Dataview plugin is installed. |
| Bug notes (×3) | `05 Bugs/` | ✅ BUG-001 fixed, BUG-002 fixed, BUG-003 open. |
| Architecture notes (×5 active) | `03 Architecture/` | ✅ Connection Model, Verify Hint System, Test Infrastructure, Note Schema, Workspace Routing. |
| Decision notes (×1) | `04 Decisions/` | ✅ ADR-001 active. |

---

## Requires manual install — do this next

| Item | What to do | Why it matters |
|---|---|---|
| `redbyte-obsidian-maintainer` skill | ✅ Installed at `.claude/skills/redbyte-obsidian-maintainer/SKILL.md` | — |
| Obsidian Dataview plugin | Install from Obsidian Community Plugins | Activates all query blocks in the dashboard. Without it, blocks render as raw code. |
| Obsidian Workspaces | Command Palette → "Manage workspaces" → create Verify Debug, Export + Vivado, Architecture + Planning | Saves layout per work mode. Makes context-switching fast. |

---

## Can wait — do after the loop is stable

| Item | Location | Why it can wait |
|---|---|---|
| Post-test hooks | `08 Agents + Prompts/Hook Integration Plan.md` | Hooks amplify a working habit. Automate something broken = automated chaos. Use checklists manually for 3–5 sessions first. |
| Obsidian URI automation | `03 Architecture/Automation Strategy.md` → Layer 5 | External scripting is only valuable once vault layout is stable. It isn't stable yet. |
| Stub architecture notes | `03 Architecture/Verify Engine.md`, `Export Contracts.md`, etc. | Stubs are fine until work actually touches those areas. Expand when needed, not speculatively. |
| `redbyte-test-runner` skill | Not yet drafted | Useful but not blocking. Build after `redbyte-obsidian-maintainer` is proven. |
| Obsidian Bases | Built-in (Obsidian 1.8+) | Bases is the long-term replacement for Dataview. Switch after Dataview queries are verified stable. |

---

## Should not be automated yet

| What | Why not |
|---|---|
| ADR creation | Decisions require deliberate framing. Auto-generated ADRs will be low-quality. |
| Note merging or deletion | Structural changes need human review. |
| Modifying `CLAUDE.md` | Changing instructions = changing Claude behavior every session. Only update manually. |
| Updating `Canonical Notes Policy.md` | Adding a canonical note is a permanent commitment. Not a task for automation. |
| Overwriting architecture note `## Overview` sections | These require judgment. Claude can append/update subsections, not overwrite overviews. |

---

## The single most important install

**Copy the skill draft.**

`08 Agents + Prompts/redbyte-obsidian-maintainer SKILL.md` → `.claude/skills/redbyte-obsidian-maintainer/SKILL.md`

This is the highest-leverage install because it makes "maintain the vault" a named, invocable, auto-triggering behavior instead of a long prompt you have to remember to paste. Everything else in the system is already working — this is the only missing piece between "prompt-based discipline" and "installed behavior."
