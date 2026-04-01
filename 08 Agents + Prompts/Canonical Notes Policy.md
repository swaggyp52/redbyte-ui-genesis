---
type: handoff
status: active
area: infrastructure
updated: 2026-04-01
related:
  - "[[Note Schema]]"
  - "[[RedByte Engineering Brain]]"
  - "[[Claude Session Mode]]"
---

# Canonical Notes Policy

This file defines which notes are the permanent "source of truth" for each system area, and which notes are designated hub notes that must be kept current at all times. Claude must consult this before creating any new note.

---

## Product Manual (External Canonical Source)

The canonical user-facing product reference lives at `docs/manuals/` in the repo — not in this vault. The vault architecture notes are internal engineering notes; the manual is the external product record.

| File | Purpose | Status |
|---|---|---|
| `docs/manuals/RedByte_Product_Manual.md` | Canonical product reference — all surfaces, workflows, export, import, submission | verified v1.0 |
| `docs/manuals/MANUAL_CLAIM_AUDIT.md` | Fact-audit record | v1.0 (2026-03-31) |
| `docs/manuals/MANUAL_TRACEABILITY_MATRIX.md` | Claim → source file mapping (49 claims) | v1.0 |
| `docs/manuals/MANUAL_CONFORMANCE.md` | Rules for keeping manual current | v1.0 |

When a manual section contradicts a vault architecture note, the manual takes precedence for user-facing claims; the vault note should be updated to align.

---

## Product Contract and Gap Audit (Target-State Sources)

These documents define the target product standard and the gap between current reality and that target. They live in `docs/` and are separate from the current-state manual.

| File | Purpose | Status |
|---|---|---|
| `docs/contracts/RedByte_Product_Contract.md` | Target-state blueprint — what RedByte must become | draft v0.1 |
| `docs/roadmap/RedByte_Gap_Audit.md` | Brutally honest product-legitimacy audit | complete v1 (2026-04-01) |

The manual documents current truth. The product contract defines target truth. When these disagree, it means there is work to do — not that either document is wrong.

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
| `03 Architecture/Design Surface.md` | Design editor architecture, tools, interaction model | active |
| `03 Architecture/Workspace Routing.md` | Obsidian workspace configuration and note routing | active |
| `03 Architecture/Automation Strategy.md` | Build, CI, and automation approach | active |
| `03 Architecture/Signal Inventory.md` | Signal tracking and inventory model | stub |
| `03 Architecture/Authority Chain.md` | Decision authority and ownership chain | stub |

---

## Canonical Decision Notes

| File | Decision | Status |
|---|---|---|
| `04 Decisions/ADR-001 Enforce Structured Connection Format.md` | Nested connection shape enforced everywhere | active |
| `04 Decisions/ADR-002 Truth Table Selection Does Not Auto-Switch Tabs.md` | Truth table selection preserves current tab | active |

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
