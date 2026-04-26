---
type: handoff
status: active
area: infrastructure
updated: 2026-04-26
related:
  - "[[Session Shutdown Checklist]]"
  - "[[Session Log]]"
  - "[[Session Template]]"
  - "[[Claude Session Mode]]"
  - "[[Canonical Notes Policy]]"
  - "[[RedByte Engineering Brain]]"
---

# Session Startup Checklist

Run this at the start of every RedByte coding session. Takes 2–3 minutes. Prevents repeated mistakes and context loss.

---

## 1. Read current truth

`CLAUDE.md` is the repo constitution. It contains:
- truth hierarchy (what to trust in what order)
- product spine and constraints
- @imports `docs/ACTIVE_WORK.md` with current priorities

Also read: `docs/ACTIVE_WORK.md` — priority ladder, in-flight work, RC1 posture.

---

## 2. Open the Dashboard + Session Log

Open: `01 Dashboard/RedByte Engineering Brain.md`

Check:
- Active Work Board — what is Now / Next / Blocked?
- RC1 Release Truth — what's certified vs pending?
- Architecture map — which stubs need expansion?

Then open: `08 Agents + Prompts/Session Log.md` — what exactly happened last session? What's the exact next action?

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

## 4. Open a session note

Copy `01 Dashboard/Session Template.md` → rename to today's date → fill in `goal`, `work_area`, `top_priority`.

This is your session anchor. Keep it open and add notes as you go.

---

## 5. Confirm current work area

Say explicitly:
> "I'm working in [verify | export | design | infrastructure | hardware] today."

This activates workspace routing — Claude will prioritize the right canonical notes and hub updates.

---

## 6. Enter Session Mode

Say:
> "Enter Session Mode."

Claude will acknowledge and activate documentation pass discipline.

---

## If starting fresh after a gap

Also:
- Check `05 Bugs/` for any open bugs
- Check `08 Agents + Prompts/` for any queued handoff notes
- Run test baseline to confirm green: `pnpm -w exec vitest run` (from Windows)
