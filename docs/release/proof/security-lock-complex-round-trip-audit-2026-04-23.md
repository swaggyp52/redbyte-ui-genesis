# Audit: ECE141 Digital Security Lock (complex Vivado package) + round-trip truth

**Anchor path (lab machine):** `C:\Users\Administrator\Downloads\project_packages\Project_A_ECE141_Final_Security_Lock\`  
**Date:** 2026-04-23

## 1. Package contents (inventory)

| Artifact | Role |
|----------|------|
| `security_lock.xpr` | Vivado project |
| `vhdl/security_lock_top.vhd` | Top entity — vectors `sw`, `led`, `seg`, `an`, `clk_100`, `btnc`; hierarchy instantiates debounce, FSM, counters, SSD driver |
| `vhdl/security_lock_pkg.vhd` | Package / constants |
| `vhdl/debounce_oneshot.vhd`, `sequence_detector_fsm.vhd`, `bit_counter.vhd`, `detection_counter.vhd`, `ssd_driver.vhd` | Subsystems |
| `vhdl/security_lock.xdc` | Basys3 constraints |
| `vhdl/tb_system.vhd`, `vhdl/tb_fsm.vhd` | Testbenches |
| `security_lock.srcs/`, `.runs/`, `.sim/` | Vivado layout + artifacts |

**Design intent:** Manual clock via debounced BTNC into sequential logic; 100 MHz only in debounce; seven-segment + FSM complexity.

## 2. What RedByte can import faithfully today

- **Top + XDC selection:** Improved heuristics prefer `*_top.vhd` / `top.vhd` and `constrs_1` XDC.
- **Ports + pin map:** Top entity ports parsed; XDC `get_ports` merged into `ioMapping` / `hardwareMappingV2` where names align.
- **Multi-file RTL:** **New:** non–testbench companion `.vhd` files are **embedded in `project.hdl.sources`** (ordered: `*_pkg.vhd` first, then other companions, then top) for Code/split fidelity and future export.
- **Testbenches:** Detected (e.g. `tb_*.vhd`) and **listed in import inspection**; **not** embedded (simulation remains Vivado-first).

## 3. Meaningful visualization

- **Canvas:** Only **structural** subset of imported HDL reconstructs to gates; behavioral FSM/SSD internals do **not** become a full native schematic.
- **Ports:** INPUT/OUTPUT nodes reflect top ports; internal hierarchy is **not** expanded as nested canvas macros from this import path alone.

## 4. Not reconstructed natively

- FSM state registers as student-editable graph from RTL.
- Full debounce + one-shot + SSD **behavior** in Verify without dedicated lab fixtures.
- **Bus-native** authoring for `std_logic_vector` top ports (export still treats wide top ports as **unsupported** for RedByte-generated Open Project in v1).

## 5. Schematic equivalence to Vivado

- **No:** RedByte does not duplicate Elaborated Design hierarchy browser for this class of project.
- **Partial:** Port-level + optional partial gate reconstruction; companion source text preserved.

## 6. Testbench intent in RedByte

- **Imported truth:** Listed on Import surface; not executed as native Verify vectors.
- **Students:** Run `tb_*` in Vivado for sign-off simulation.

## 7. Product spine gaps (before this slice)

- Project landing did not state **workflow ownership** vs example gallery.
- ZIP import dropped companion VHDL — **round-trip text fidelity** loss.

## 8. Project before / after start

- **Before:** Landing focuses on starters + import; limited explicit “spine” copy.
- **After:** **Workflow spine** callout on Project Home: Design → Verify → Map Pins → Export → Hardware; multi-file finals start in Import.

## 9. Simple-only assumptions (still real)

- Parsed `std_logic_vector` top ports are expanded to per-bit names in the importer; `validateTopPortWidths` is not the primary fence for typical `security_lock_top`-style sources.
- **Preserved multi-file handoff (new):** when `meta.projectKind === 'import'`, `multi-file-hdl` is tagged, **`fpga.constraints` still holds the imported XDC**, and expanded VHDL port names align with `[get_ports …]` in that XDC, export can emit **verbatim imported top + companions + imported XDC** into the Open Project ZIP (companions under `sources_1/imported/`, Tcl `add_files` lists them before `new/top.vhd`). This bypasses the synthesized netlist stub for the top module.
- Handoff **does not** run if HDL/XDC port alignment fails (stay on netlist path or fix mapping/constraints).
- Verify **clocked_macro** semantics align with teaching labs, not arbitrary `btn_pulse` clocks.

## 10. Realistic support tier for this slice

| Tier | Applies |
|------|---------|
| **Imported faithfully** | Top file choice, XDC text, companion RTL text, TB path list |
| **Partial native** | Port scaffolding + any reconstructable structural glue |
| **Export-preserving** | **Partial:** preserved-import handoff when imported XDC ↔ expanded top ports align; companion RTL included in Open Project. Timing Tcl beyond regenerated pin constraints is still Vivado-first. |
| **Unsupported** | Full native schematic, native TB sim, turnkey export |

## 11. Gates / blockers

- Export gate on **wide top** remains a **hard fence** for “RedByte ZIP only” finals.
- No new layout gate failures introduced by this slice (verify in CI).

## 12. Honest claim after this slice

**RedByte can ingest multi-file security-lock–style ZIPs, preserve companion RTL in the project record, surface testbench files honestly, and explain import authority on the Import screen.**  
**When the imported XDC still matches the expanded top-level port names, export can produce an Open Project ZIP that includes preserved companion VHDL + verbatim top + imported pin constraints (multi-file handoff), so Vivado can elaborate the real design instead of a RedByte netlist stub.**  
**Remaining gaps:** native Verify against imported `tb_*`, full timing-constraint preservation beyond pin `set_property`, and any project whose imported XDC no longer matches the top entity after mapping edits in RedByte.

## 13. Code / product changes (this slice)

- `zipImport.ts` — companion RTL collection; TB heuristics; `*_top.vhd` scoring; inspection fields `preservedRtlCompanionPaths`, `detectedTestbenchPaths`; `detectedTopPath` uses override-aware top.
- `importCompiler.ts` — `companionHdls`, ordered `hdl.sources`, `meta.projectKind: 'import'`, `multi-file-hdl` tag.
- `importSurfaceZipAuthority.ts` — bullets for companions + testbenches.
- `ProjectSurface.tsx` — **Workflow spine** callout on Project Home.
- Tests: `zipImport.multifile-rtl.test.ts`.
- **Preserved-import handoff:** `preservedImportHandoff.ts`, `basys3ExportService.ts` (handoff + `success` = no error-severity diagnostics), `buildExportViewModel.ts` (companion artifacts + Tcl path list), `vivadoProjectFolder.ts` (extra `sources_1/imported/*.vhd` in ZIP, `.xpr`, consistency checks). Test: `preservedImportHandoff.export.test.ts`.
