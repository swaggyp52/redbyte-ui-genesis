---
type: handoff
status: active
area: infrastructure
updated: 2026-04-26
related:
  - "[[Session Startup Checklist]]"
  - "[[Session Log]]"
  - "[[Post Run Extraction]]"
  - "[[Claude Session Mode]]"
  - "[[RedByte Engineering Brain]]"
---

# Session Shutdown Checklist

Run this before ending every RedByte coding session. Non-negotiable — this is what makes the vault useful in the next session.

---

## 1. Run Post-Run Extraction

Say:
> "Run Post-Run Extraction."

Claude will extract bugs, system truths, architecture updates, and implicit decisions from everything that happened in this session.

Do not skip this even if the session felt uneventful. Constraints discovered silently are the most dangerous ones.

---

## 2. Update bug statuses

For every bug touched this session:
- If fixed: update `status` to `fixed` in the bug note Properties
- If partially fixed or understood better: update `status` to `investigating` and add notes
- If newly discovered: create a new bug note using the schema from `03 Architecture/Note Schema.md`

---

## 3. Update canonical architecture notes

For every system truth learned:
- Find the relevant canonical note in `08 Agents + Prompts/Canonical Notes Policy.md`
- Update it in place — do not create a parallel note
- If the information doesn't fit any canonical note, create a new architecture note with Properties

---

## 4. Update hub notes

For every meaningful change:
- Update `01 Dashboard/RedByte Engineering Brain.md` — Active Work table, bug links, next actions
- Update `03 Architecture/Verify Engine.md` if verify-area work was done
- Update `03 Architecture/Test Infrastructure.md` if test baseline changed

---

## 5. Update the Session Log

Open `08 Agents + Prompts/Session Log.md`.

Add a new entry at the top using today's date. Fill in:
- What changed
- What is true now
- What failed / is still open
- Exact next action

Remove the oldest entry if count exceeds 5.

Also update the Active Work Board in `01 Dashboard/RedByte Engineering Brain.md` — move done items to Done, add new Next items.

---

## 6. Capture the next action explicitly

End with one explicit statement in the session note:
> "Next session should start with: [specific task]"

This becomes the first item in the next `Session Startup Checklist` run.

---

## Hard rule

If you skip shutdown, the vault drifts. After two sessions without shutdown, you're back to a pile of markdown. Do not skip it.
