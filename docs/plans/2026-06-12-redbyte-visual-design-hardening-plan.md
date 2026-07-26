---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: visual design hardening plan for RedByte IDE
---

# RedByte Visual Design Hardening Plan - 2026-06-12

## Direction

RedByte should look and feel like a Course Lab Workbench:

- serious enough for an ECE course
- focused on circuit, proof, board, and export artifacts
- dense enough for repeated lab work
- calm enough for students to scan
- honest about Vivado and hardware boundaries
- specific to FPGA education, not generic SaaS

## Design Principles

1. Every surface gets one dominant object.
2. The workflow spine stays visible but does not compete with the active task.
3. Primary actions are visible in the first viewport.
4. Trust states use consistent visual grammar across Project, Verify, Hardware, and Export.
5. Domain objects carry the product: circuit graph, waveform, Basys3 board, Vivado package.
6. Cards frame repeated items and tools only; avoid nested page-card composition.
7. Typography explains hierarchy before color does.
8. Dense controls must be grouped by task, not by implementation history.

## Surface Targets

| Surface | Target feel | Main object |
|---|---|---|
| Project | course mission control | current lab/project state and recommended next action |
| Design | circuit authoring workbench | graph canvas |
| Verify | proof bench | Compare result plus waveform evidence |
| Hardware / Map Pins | physical binding bench | Basys3 board plus binding table |
| Export | Vivado handoff bench | package artifact and trust state |
| Import | recovery utility | incoming project identity and validation |

## Implementation Sequence

### Phase 1 - Token And Primitive Audit

- decide authoritative token names for IDE chrome
- map repeated panel, chip, action, evidence-row, and empty-state patterns
- identify raw colors that should become tokens
- produce a short migration checklist

Proof:

- no product source behavior changes
- docs or small primitive-only source diff
- `corepack pnpm rb:doc:validate`
- focused unit/build checks only if source changed

### Phase 2 - Shared Panel, Chip, And Action Primitives

- consolidate visual-only panel/card/action/status patterns
- keep existing test IDs stable
- preserve keyboard and ARIA behavior

Proof:

- focused React tests for primitive rendering if needed
- browser screenshot comparison for Project and Export
- `git diff --check`

### Phase 3 - Project Mission Control

- reduce landing-page framing
- make resume/dirty/stale state first-class
- make recommended next action visually dominant
- keep course starters compact

Proof:

- first-viewport Project browser gate
- clean and dirty/resume screenshots at `1366x768` and `1440x900`

### Phase 4 - Design Canvas Priority

- keep the graph visible and dominant at `1366x768`
- demote palette and inspector to tool status
- normalize toolbar and zoom controls

Proof:

- Design first-viewport browser gate
- starter circuit visible with at least one node and connection
- no circuit semantics changed

### Phase 5 - Hardware Board Priority

- make Basys3 board and binding table the primary composition
- increase board contrast and reduce clipping
- move explanatory copy into compact contextual help

Proof:

- Hardware/Map Pins first-viewport browser gate
- board and mapped rows visible at `1366x768`
- no mapping semantics changed

### Phase 6 - Export Handoff Object

- make the Vivado package concrete through artifact rows
- make build/download action dominant
- remove blank summary area

Proof:

- Export ready and draft screenshots
- export download contract still passes
- no VHDL/XDC/TCL output changes

### Phase 7 - Verify Proof Hierarchy

- promote current PASS/FAIL/stale proof state
- make waveform evidence readable before detailed editing controls
- make repair path visually distinct

Proof:

- Verify fail-edit-repair browser regression
- Verify pass and fail screenshots
- no simulator behavior changed except approved bug fix

### Phase 8 - Import Utility Simplification

- keep import as utility, not workflow peer
- emphasize validation, identity, and recovery
- reduce generic explanatory cards

Proof:

- import recovery browser gate
- no project format or zip semantics changed

### Phase 9 - Broader Workflow Review

- rerun student path screenshots
- rerun relevant ECE141 browser gates
- update cockpit docs with remaining visual debt

Proof:

- Project -> Design -> Verify -> Map Pins -> Export walkthrough evidence
- no new Vivado/Basys3 claims unless those tools were actually run

## Guardrails

- Do not combine visual hardening with export generator changes.
- Do not change classroom golden artifacts during UI cleanup.
- Do not change TS/TSX without keeping required JS mirrors aligned.
- Do not call tests passing "product ready."
- Do not claim hardware evidence from browser screenshots.

## Next Slice Recommendation

Start with Phase 1 and Phase 2 as one small architecture cleanup commit if the diff stays mechanical. If the source diff becomes broad, split Phase 1 docs/inventory from Phase 2 primitives.
