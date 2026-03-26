---
name: redbyte-obsidian-maintainer
description: Maintain the RedByte Obsidian vault after test runs, debugging, implementation, or constraint discovery. Updates canonical notes, enforces property schema, and keeps hub notes current. Use when: tests were run, a bug was diagnosed, system behavior changed, or a handoff is needed.
---

# RedByte Obsidian Maintainer

## When this skill runs

After any of:
- test run (pass or fail)
- bug diagnosed or status changed
- implementation that changed system behavior
- new constraint or system truth discovered
- handoff needed for next session

## Step-by-step execution

**1. Check before creating**
Read `08 Agents + Prompts/Canonical Notes Policy.md`. If the new information belongs to an existing canonical note, update it. Do not create a parallel note.

**2. Update canonical notes first**
In order:
- Bug status changes → update `05 Bugs/` note Properties (`status` field)
- System truths → update the most specific architecture note in `03 Architecture/`
- Implicit decisions → create or update `04 Decisions/` ADR
- Handoff needed → create in `08 Agents + Prompts/` with handoff schema

**3. Enforce Properties on every note touched**
Every created or updated note must open with a valid Properties block. Schema is in `03 Architecture/Note Schema.md`. Do not invent field names.

**4. Update the most relevant hub note**
- Verify-area work → `03 Architecture/Verify Engine.md` + dashboard
- Export/connection work → `03 Architecture/Connection Model.md` + dashboard
- Infrastructure work → `03 Architecture/Test Infrastructure.md` + dashboard
- Always → `01 Dashboard/RedByte Engineering Brain.md` (bug links, active work, next action)

**5. Report**

```
## Vault Update — [date]

### Created
- path — reason

### Updated
- path — what changed

### Workspace
[Verify Debug | Export + Vivado | Architecture + Planning]
```

## Hard limits

Never automatically:
- Delete or rename notes
- Overwrite a canonical note's `## Overview`
- Create a note that duplicates an existing canonical note
- Merge notes without user confirmation
- Invent Properties field names not in Note Schema

## Install path

Copy this file to:
```
.claude/skills/redbyte-obsidian-maintainer/SKILL.md
```

Verify with `/skills` — `redbyte-obsidian-maintainer` should appear.
