---
type: handoff
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[Session Shutdown Checklist]]"
  - "[[Claude Session Mode]]"
  - "[[Canonical Notes Policy]]"
  - "[[RedByte Engineering Brain]]"
---

# Session Startup Checklist

Run this at the start of every RedByte coding session. Takes 2–3 minutes. Prevents repeated mistakes and context loss.

---

## 1. Read CLAUDE.md

`CLAUDE.md` is the repo root. It contains:
- test runner constraints (Windows-only pnpm)
- connection format rule (nested, never flat)
- Obsidian integration rules
- known bugs

Verify these haven't changed since last session. If they have, update them before starting work.

---

## 2. Inspect the Dashboard

Open: `01 Dashboard/RedByte Engineering Brain.md`

Check:
- Active work table — what was in progress?
- Open bugs section — what's still unresolved?
- Architecture map — which stubs need expansion?

---

## 3. Read relevant canonical notes for today's work area

| Work area | Notes to read |
|---|---|
| Verify / hints / simulation | `03 Architecture/Verify Engine.md`, `03 Architecture/Verify Hint System.md` |
| Export / contracts | `03 Architecture/Connection Model.md`, `03 Architecture/Export Contracts.md` |
| Test suite | `03 Architecture/Test Infrastructure.md` |
| Hardware / Vivado | `03 Architecture/Basys 3 Mapping.md` |
| Architecture planning | `04 Decisions/`, `03 Architecture/` hub notes |

---

## 4. Confirm current work area

Say explicitly:
> "I'm working in [verify | export | design | infrastructure | hardware] today."

This activates workspace routing — Claude will prioritize the right canonical notes and hub updates.

---

## 5. Enter Session Mode

Say:
> "Enter Session Mode."

Claude will acknowledge and activate documentation pass discipline.

---

## If starting fresh after a gap

Also:
- Check `05 Bugs/` for any open bugs
- Check `08 Agents + Prompts/` for any queued handoff notes
- Run test baseline to confirm green: `pnpm -w exec vitest run` (from Windows)
