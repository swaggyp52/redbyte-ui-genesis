---
doc_status: current
last_validated: 2026-04-21
owner: Connor Angiel
used_by_claude: true
role: Import surface spec
---

# Import Mode Spec

Status: Phase 1 v1
Mode ID: `import`

## Purpose

Import HDL/XDC safely with explicit diagnostics and Basys3 mapping guidance.

## Primary Actions (max 3)

1. Paste or upload HDL/XDC input.
2. Review parsed ports and mapping gaps.
3. Apply import into project state.

## Layout

1. Left input panel
- HDL input tab.
- XDC input tab.
- ZIP tab reserved/disabled until enabled by scope.

2. Main center
- Parsed ports table.
- Schematic preview panel.

3. Right inspector
- Diagnostics list (errors, warnings, suggestions).
- Basys3 pin suggestions.

## Empty State

Headline: `Import HDL or XDC`
Primary CTA: `Paste module text`
Secondary action: `Use minimal example snippet`

## Error State

Show deterministic diagnostics:

1. Parse errors with line hints.
2. Unmapped ports list.
3. Unsupported directives.

## Success State

`Import Ready` with:

1. Parsed module summary.
2. Mapping completeness percent.
3. Apply action enabled.

## Batch 1 Product Audit Notes (2026-04-30)

- Supposed to do: import HDL/XDC/ZIP input with honest reconstruction fidelity instead of implying arbitrary HDL becomes a perfect RedByte schematic.
- Current truth: Import is a utility alongside the main product spine, not the primary start point for new FPGA projects.
- Determinism change needed: every import result should keep parsed, skipped, approximated, and blocked details visible enough that downstream Design/Verify/Export trust is not overclaimed.
- Friction found: no new Import proof was run in Batch 1; keep Import out of student-safe hardware claims until a row exists in the proof matrix.

## Data Contract (RBProject)

Reads:

1. `name`
2. `description`
3. `circuit`
4. `hdl`
5. `fpga`
6. `ioMapping`
7. `vectors`
8. `layout`
9. `meta`
10. `probes`
11. `oscilloscope`
12. `recorder`
13. `traceMetadata`
14. `submodules`

Writes (guarded):

1. `name`
2. `description`
3. `circuit`
4. `hdl`
5. `fpga`
6. `ioMapping`
7. `vectors`
8. `layout`
9. `meta`
10. `probes`
11. `oscilloscope`
12. `recorder`
13. `traceMetadata`
14. `submodules`
