---
doc_status: current
last_validated: 2026-07-22
owner: Connor Angiel
used_by_claude: true
role: Import surface spec
---

# Import Mode Spec

Status: Unified Workbench v3 RC source contract - browser E0 only; final reconstructed exact-SHA certification pending
Mode ID: `import`

## Purpose

Import RedByte export ZIPs, Vivado ZIPs, HDL, and XDC safely with explicit fidelity, diagnostics, and Basys3 mapping guidance. Import is a utility path, not the main Project -> Design -> Simulate -> Board & Constraints -> Build & Export spine.

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
6. Source-specific failure copy: archive-level failures name the ZIP/archive problem and must not show HDL/XDC port-reconstruction guidance unless the ZIP was actually readable and reconstruction reached the HDL/XDC layer.

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
- Non-ZIP and unreadable/corrupt archive failures are archive-level errors: they say no files were changed, require a readable `.zip` archive, and do not tell students to fix HDL ports or XDC LOC/PACKAGE_PIN constraints before an archive has actually opened far enough for reconstruction.
- Import review does not replace the active project. Replacement happens only after Confirm Replace Project.
- Successful import routes to editable project state, and imported Verify PASS is not automatically treated as current trusted proof.
- After a successful import is applied, Project Build Fresh keeps the same explicit replacement guard as other loaded work: cancel preserves the imported project, and confirm replaces it with a new empty Basys3 blank project so stale imported graph, I/O rows, mapping, import metadata, import URL state, Verify/export state, and identity do not survive.
- Browser proof: `ide:gate:import-recovery-contract`, wired into `classroom:gate` and `verify:gates:classroom`.

## Unified Workbench v3 RC authority (2026-07-22)

- A RedByte ZIP containing `project.rbproj.json` is manifest-first. The embedded manifest is the only restore authority; loose sibling HDL or XDC files cannot silently override it.
- The manifest is a generated package projection. Its embedded `top.vhd` and `top.xdc` bytes must agree exactly with the generated artifacts in the same package before the candidate may be treated as a coherent RedByte restore.
- Scalar and vector-bit ports retain exact logical identity across parse, review, apply, mapping, and re-export. Names such as `SW[1]` and `LED[1]` must not collapse into a different scalar or ghost port.
- Supported RedByte-generated concurrent-assignment VHDL can reconstruct the full supported circuit graph. This is still a reconstruction path: layout, authored Verify documents, mapping, and other RedByte metadata require the manifest for lossless restore.
- Arbitrary behavioral/process HDL remains partial or blocked. Import must not imply that unsupported behavioral code becomes an editable RedByte schematic.
- The active project remains unchanged until explicit Apply confirmation. Cancel and all parse/archive failure paths preserve the active project.
- Focused source gates: `ide:gate:zip-import-recovery-contract` and the Import review/apply recovery gate. Both pass on integrated pre-doc checkpoint `0788044cbdf2699520d90a3428f2e5034dc73cab`, alongside the touched 20-file/258-test authority matrix. Historical `f4f7ca8f3` passed the earlier 36-file/477-test matrix; the final reconstructed exact-SHA release run is still required.
- Cross-surface authority requirement: run `ide:gate:mapping-preview-package-agreement` as a standalone gate outside the uninterrupted 72-step `classroom:gate`. It is the exact proof that Board & Constraints mapping, package bytes, the embedded manifest, and manifest-first recovery agree; the aggregate does not substitute for it.

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
