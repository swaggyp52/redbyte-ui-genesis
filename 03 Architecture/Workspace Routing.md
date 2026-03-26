---
type: architecture
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[Claude Session Mode]]"
  - "[[Canonical Notes Policy]]"
  - "[[RedByte Engineering Brain]]"
  - "[[Note Schema]]"
---

# Workspace Routing

Three work modes for RedByte development. Each mode has a fixed set of notes to open, a defined update target, and a pre-coding review requirement.

---

## Verify Debug

**When:** Investigating verify failures, tuning hint priority chain, debugging simulation output, writing verify contract tests.

**Pin these notes in Obsidian:**
1. `01 Dashboard/RedByte Engineering Brain.md`
2. `03 Architecture/Verify Engine.md`
3. `03 Architecture/Verify Hint System.md`
4. `05 Bugs/` — any open verify-area bugs

**Claude updates most often:**
- Bug notes with `area: verify`
- `Verify Hint System.md` when priority chain changes
- `Verify Engine.md` when simulation pipeline understanding improves
- Dashboard (open bug count, active work status)

**Human reviews before coding:**
- Open verify-area bugs — what's already known?
- `Verify Hint System.md` → priority chain table — which conditions exist?
- Test baseline for `verifyHints` and `verifyScenario` suites

**Critical constraint:** When adding a new `HINTS` priority condition, always audit catch-all branches below it. See [[BUG-002 VerifyHints Priority Inconsistency]].

---

## Export + Vivado

**When:** Export pipeline, authority chain contracts, FPGA mapping, Vivado TCL, Basys3 XDC, hardware deployment.

**Pin these notes in Obsidian:**
1. `01 Dashboard/RedByte Engineering Brain.md`
2. `03 Architecture/Connection Model.md`
3. `03 Architecture/Export Contracts.md`
4. `04 Decisions/ADR-001 Enforce Structured Connection Format.md`

**Claude updates most often:**
- Bug notes with `area: export` or `area: vivado`
- `Connection Model.md` when new consumption sites are found
- `Export Contracts.md` when authority chain shape changes
- ADRs when format or constraint decisions are made

**Human reviews before coding:**
- `Connection Model.md` → canonical shape and validator rules
- `ADR-001` → why flat shape is forbidden
- Test baseline for `export-authority-chain-contract`

**Critical constraint:** Connection shape is always `{ from: { nodeId, portName }, to: { nodeId, portName } }`. Flat shape (`fromNodeId`, `toNodeId`) is never valid. See [[Connection Model]].

---

## Architecture + Planning

**When:** Designing new features, expanding stub notes, creating handoffs, reviewing system state before a sprint.

**Pin these notes in Obsidian:**
1. `01 Dashboard/RedByte Engineering Brain.md`
2. `08 Agents + Prompts/Canonical Notes Policy.md`
3. `03 Architecture/Note Schema.md`
4. All `04 Decisions/` ADRs

**Claude updates most often:**
- Stub architecture notes being promoted to full notes
- Dashboard (active work table, architecture map)
- New ADRs for decisions made during planning
- Handoff notes in `08 Agents + Prompts/`

**Human reviews before coding:**
- Dashboard "next action" section — what was left unfinished?
- Canonical Notes Policy — what notes exist? What are stubs?
- Open bugs in all areas — do any block the planned work?

**Critical constraint:** Check Canonical Notes Policy before creating any note. Stubs exist for Verify Engine, Export Contracts, Signal Inventory, Authority Chain, Bridge Protocol, Basys 3 Mapping — expand in place, do not create duplicates.

---

## Setting up Obsidian Workspaces

1. Open Obsidian
2. Open Command Palette (`Cmd/Ctrl + P`)
3. Type "Manage workspaces" → Create new workspace
4. Name it exactly: `Verify Debug`
5. Open the four priority notes listed above and arrange tabs
6. Return to Manage Workspaces → Save as `Verify Debug`
7. Repeat for `Export + Vivado` and `Architecture + Planning`

To switch: Command Palette → "Load workspace" → pick mode.

---

## Declaring your work area to Claude

At session start, say:

> "I'm working in [Verify Debug | Export + Vivado | Architecture + Planning] today."

Claude will use this to route hub note updates and vault change reports to the correct workspace.
