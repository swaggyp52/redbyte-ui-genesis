---
type: handoff
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[Claude Session Mode]]"
  - "[[Post Run Extraction]]"
  - "[[Skill Installation Guide]]"
  - "[[Canonical Notes Policy]]"
---

# Hook Integration Plan

Documentation passes should be automatic, not remembered. This note defines the hook strategy for wiring vault maintenance into Claude Code's lifecycle.

---

## When documentation passes should trigger

| Event | Trigger | Why |
|---|---|---|
| Test run completes (pass or fail) | Post-test hook | Tests reveal system truths and bug status changes |
| Debug session produces a diagnosis | End-of-session | Diagnoses often contain new architecture understanding |
| Multi-file implementation | Post-edit | Implicit decisions get made during implementation |
| New constraint discovered | Inline | Constraints go stale fast if not captured immediately |
| Failure diagnosed (not just reproduced) | Post-diagnosis | Root cause is the most valuable knowledge artifact |

---

## What a documentation pass must do

In order:

1. Check `08 Agents + Prompts/Canonical Notes Policy.md` to identify if any existing note covers the new information
2. Update canonical notes first — never create a parallel note
3. Add or update Properties frontmatter per `03 Architecture/Note Schema.md`
4. Update at least one hub note with new links and current status
5. Create new notes only when the concept is genuinely new to the vault
6. Report what changed

---

## First-priority notes per event type

| Event | First note to update |
|---|---|
| Test failure on verify area | `05 Bugs/` + `03 Architecture/Verify Hint System.md` |
| Test failure on export area | `05 Bugs/` + `03 Architecture/Connection Model.md` |
| Infrastructure test failure | `05 Bugs/` + `03 Architecture/Test Infrastructure.md` |
| Architecture learning | Most specific canonical architecture note |
| Implicit decision | `04 Decisions/` ADR |
| Any of the above | `01 Dashboard/RedByte Engineering Brain.md` hub link update |

---

## What must NEVER happen automatically

- Deleting notes
- Renaming notes
- Overwriting a canonical note's `## Overview` section without confirmation
- Creating a new architecture note that duplicates a canonical note
- Inventing new property names or values not in `03 Architecture/Note Schema.md`
- Merging two notes without user review

---

## Recommended hook implementation

Once the behavior is stable, register a post-test hook in Claude Code:

```bash
# .claude/hooks/post-test.sh (conceptual)
# Invoked after any test run
# Prompt: "Run Post-Run Extraction on the output above, then update the vault."
```

Until hooks are wired, enforce discipline manually:
- Run Post-Run Extraction after every test paste
- Close no session without running Session Shutdown Checklist

---

## Install path

Hook scripts belong at: `.claude/hooks/` (once Claude Code hooks are available for this project).

See also: `08 Agents + Prompts/Skill Installation Guide.md`
