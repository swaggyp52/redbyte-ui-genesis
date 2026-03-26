---
type: handoff
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[Hook Integration Plan]]"
  - "[[redbyte-obsidian-maintainer SKILL]]"
  - "[[Post Run Extraction]]"
  - "[[Automation Strategy]]"
---

# Hook Payload Spec

A hook-ready specification for wiring Claude's documentation pass into Claude Code's lifecycle. Do not implement hooks until the manual checklist loop has been stable for several sessions.

---

## Trigger events

| Event | Trigger type | When |
|---|---|---|
| Test run completes | Post-test | After `pnpm -w exec vitest run ...` exits |
| Debug session closes | End-of-session | After a multi-step diagnosis sequence |
| Multi-file edit completes | Post-edit batch | After 3+ files changed in one operation |
| New constraint noted inline | Inline | When Claude explicitly says "constraint discovered" |

---

## Required inputs (what the hook receives)

| Input | Source | Required? |
|---|---|---|
| Test output (stdout) | Terminal / Desktop Commander | Yes for post-test |
| List of files changed | Git diff or editor context | Yes for post-edit |
| Work area declaration | Session state | Yes — must be set at session start |
| Current bug list | `05 Bugs/` Properties | Yes — hook reads open bugs before extracting |

---

## Required outputs (what the hook must produce)

| Output | Format | Destination |
|---|---|---|
| Updated bug note(s) | Markdown with Properties | `05 Bugs/` |
| Updated canonical architecture note(s) | Markdown append/update | `03 Architecture/` |
| Updated hub note | Dashboard link + status | `01 Dashboard/RedByte Engineering Brain.md` |
| New ADR (if decision was made) | Full ADR markdown | `04 Decisions/` |
| Vault update report | Plain text | Response to user |

---

## Notes to check first (ordered)

1. `08 Agents + Prompts/Canonical Notes Policy.md` — which note is source of truth for this area?
2. `03 Architecture/Note Schema.md` — is the Properties block valid?
3. Most specific canonical architecture note for the affected area
4. `01 Dashboard/RedByte Engineering Brain.md` — does the hub need a link update?

---

## Forbidden automatic actions

The hook must never:

| Action | Why |
|---|---|
| Delete any note | Structural change requires human review |
| Rename any note | Breaks Obsidian links silently |
| Overwrite `## Overview` sections | Requires judgment; append only |
| Create a note that duplicates a canonical | Check Canonical Notes Policy first |
| Merge two notes | Human review required |
| Modify `CLAUDE.md` | Changing instructions = changing Claude behavior |
| Modify `Canonical Notes Policy.md` | Adding canonical notes is a permanent commitment |
| Invent new Properties field names | Breaks Bases/Dataview queries silently |

---

## Implementation sketch (for when hooks are ready)

```bash
# .claude/hooks/post-test.sh
# Invoked automatically after any vitest run via Desktop Commander
#
# Claude receives:
#   $HOOK_INPUT = test stdout
#   $WORK_AREA  = verify|export|design|infrastructure (set at session start)
#
# Claude should:
#   1. Parse failures from $HOOK_INPUT
#   2. Run redbyte-obsidian-maintainer skill
#   3. Output vault update report
```

Until hooks are implemented, enforce manually: paste test output → say "Run Post-Run Extraction."

---

## Validation checklist (before enabling)

- [ ] Manual checklist loop (startup + shutdown) used consistently for 3+ sessions
- [ ] `redbyte-obsidian-maintainer` skill installed and verified with `/skills`
- [ ] No false positives from skill: no duplicate notes created, no schema drift
- [ ] CLAUDE.md stable (no edits for 2+ sessions)
- [ ] Test baseline confirmed green before enabling hooks
