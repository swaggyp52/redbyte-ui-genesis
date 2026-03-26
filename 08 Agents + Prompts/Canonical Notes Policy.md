---
type: handoff
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[Note Schema]]"
  - "[[RedByte Engineering Brain]]"
  - "[[Claude Session Mode]]"
---

# Canonical Notes Policy

This file defines which notes are the permanent "source of truth" for each system area, and which notes are designated hub notes that must be kept current at all times. Claude must consult this before creating any new note.

---

## Canonical Architecture Notes

These notes must be updated in place. Do not create parallel or competing notes with similar names.

| File | System Area | Status |
|---|---|---|
| `03 Architecture/Connection Model.md` | Wire format, `normalizePortRef`, multi-driver detection | active |
| `03 Architecture/Verify Engine.md` | Full verify pipeline: signal inventory → simulation → hints | stub |
| `03 Architecture/Export Contracts.md` | Export authority chain, format contracts | stub |
| `03 Architecture/Test Infrastructure.md` | Runner, discovery, Windows-only constraint, green baseline | active |
| `03 Architecture/Verify Hint System.md` | 10-level priority chain, ordering rules, wire path | active |
| `03 Architecture/Bridge Protocol.md` | Bridge layer between design and runtime | stub |
| `03 Architecture/Basys 3 Mapping.md` | FPGA port mapping, XDC, Vivado output | stub |
| `03 Architecture/Note Schema.md` | Vault metadata schema, field reference | active |

---

## Canonical Decision Notes

| File | Decision | Status |
|---|---|---|
| `04 Decisions/ADR-001 Enforce Structured Connection Format.md` | Nested connection shape enforced everywhere | active |

---

## Hub Notes

These notes must be updated any time related canonical notes change. Claude must add new links, update status, and add next actions.

| File | Purpose |
|---|---|
| `01 Dashboard/RedByte Engineering Brain.md` | Master entry point, active work, open bugs, architecture map |
| `03 Architecture/Verify Engine.md` | Central hub for all verify-related architecture |
| `03 Architecture/Test Infrastructure.md` | Test baseline, infrastructure issues, runner constraints |
| `08 Agents + Prompts/Claude Session Mode.md` | Operating rules for Claude in this vault |
| `08 Agents + Prompts/Post Run Extraction.md` | Post-run documentation hook |

---

## Creation Rules

Before creating a new note, ask:

1. Does a canonical note already cover this topic? → Update it instead.
2. Is this a genuinely new bug, decision, or architecture concept? → Create a new note.
3. Is this a handoff? → Create in `08 Agents + Prompts/` with handoff schema.

Never create:
- A second note about the same bug
- An architecture note for a concept already covered in a canonical file
- A "summary" or "overview" note that duplicates an existing architecture note

---

## Link Integrity Rules

Every bug note must link to at least one architecture note.

Every architecture note must link to at least one bug or decision if one exists.

Every ADR must link to the architecture note it constrains.

Every handoff must link to the most relevant bug and architecture notes.

When you update the Dashboard, link every new note from the appropriate section.

---

## Workspace Routing

When reporting vault changes to the user, indicate which Obsidian Workspace the changed notes belong to:

| Workspace | Notes |
|---|---|
| **Verify Debug** | Verify Engine, Verify Hint System, verify-area bugs, dashboard |
| **Export + Vivado** | Export Contracts, Basys 3 Mapping, Vivado notes, bridge bugs |
| **Architecture + Planning** | All architecture notes, all ADRs, all handoffs |
