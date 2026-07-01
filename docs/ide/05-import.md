---
doc_status: current
last_validated: 2026-07-01
owner: Connor Angiel
used_by_claude: true
role: Import surface spec
---

# Import Mode Spec

Status: Phase 1 v1 - utility contract closed locally by `ide:gate:import-recovery-contract`
Mode ID: `import`

## Purpose

Import RedByte export ZIPs, Vivado ZIPs, HDL, and XDC safely with explicit fidelity, diagnostics, and Basys3 mapping guidance. Import is a utility path, not the main Project -> Design -> Verify -> Map Pins -> Export spine.

## Primary Actions (max 3)

1. Select Project/Vivado ZIP or paste structural HDL.
2. Review fidelity, parsed ports, mapping gaps, ignored files, and blockers.
3. Confirm Replace Project only after the review state is acceptable.

## Layout

1. Utility start / input panel
- RedByte manifest restore is the highest-fidelity path.
- Vivado ZIP / VHDL is a reconstruction path with explicit fidelity limits.
- HDL input tab.
- XDC input tab.
- ZIP tab for RedByte export ZIPs and Vivado project ZIPs.
- Compact `What do I do next?` guide rail tells students to review imports before replacement.

2. Main center
- Parsed ports table.
- Schematic preview panel.

3. Right inspector
- Diagnostics list (errors, warnings, suggestions).
- Basys3 pin suggestions.

## Empty State

Headline: `Restore a RedByte project first`
Primary CTA: `Select Project/Vivado ZIP`
Secondary action: `Paste HDL`

## Error State

Show deterministic diagnostics:

1. Parse errors with line hints.
2. Unmapped ports list.
3. Unsupported directives.
4. Safe failure message that says no files were changed.
5. Recovery next action: RedByte export ZIP, Vivado re-export, or Paste HDL.

## Success State

`Import Ready` with:

1. Parsed module summary.
2. Mapping completeness percent.
3. Fidelity label: full RedByte manifest restore, reconstructed, or partial.
4. Apply action enabled only through review and explicit confirmation, with visible copy that Cancel keeps current work and Confirm Replace Project applies the reviewed import.

## Batch 1 Product Audit Notes (2026-04-30)

- Supposed to do: import HDL/XDC/ZIP input with honest reconstruction fidelity instead of implying arbitrary HDL becomes a perfect RedByte schematic.
- Current truth: Import is a utility alongside the main product spine, not the primary start point for new FPGA projects.
- Determinism change needed: every import result should keep parsed, skipped, approximated, and blocked details visible enough that downstream Design/Verify/Export trust is not overclaimed.
- Friction found: no new Import proof was run in Batch 1; keep Import out of student-safe hardware claims until a row exists in the proof matrix.

## Import / Recovery Utility Contract v1 (2026-06-14)

- Project exposes Import / Recover as a utility path on first launch and loaded Project states.
- Full-fidelity restore means a RedByte export ZIP containing `project.rbproj.json`; the embedded manifest is the source of truth, and loose HDL/XDC files are reference-only.
- Vivado ZIP / VHDL without a RedByte manifest is fidelity-limited reconstruction. Supported structural sources can rebuild gates and connections; behavioral or unsupported sources can be ports-only or blocked.
- Failed ZIP import does not replace the active project. The visible error state points to RedByte export ZIP, Vivado re-export, or Paste HDL recovery paths.
- Import review does not replace the active project. Replacement happens only after Confirm Replace Project.
- Successful import routes to editable project state, and imported Verify PASS is not automatically treated as current trusted proof.
- After a successful import is applied, Project Build Fresh keeps the same explicit replacement guard as other loaded work: cancel preserves the imported project, and confirm replaces it with a new empty Basys3 blank project so stale imported graph, I/O rows, mapping, import metadata, import URL state, Verify/export state, and identity do not survive.
- Browser proof: `ide:gate:import-recovery-contract`, wired into `classroom:gate` and `verify:gates:classroom`.

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
