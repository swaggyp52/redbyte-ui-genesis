# RedByte Lab-Day Vivado + Basys3 Readiness

This document defines the release bar for "students can use this today" on the ECE141 lab path.

**Companion (certified starter matrix + what is safe *this week*):** [`STUDENT_RELEASE_READINESS.md`](./STUDENT_RELEASE_READINESS.md)  
**RC1 freeze (tool vs board truth):** [`RC1_STUDENT_RELEASE_FREEZE.md`](./RC1_STUDENT_RELEASE_FREEZE.md)

## Finish line

RedByte is lab-day ready only when all of these are true on a real lab machine:

1. A student can create or reopen a project and not lose work on reload.
2. A student can build the supported logic subset, run deterministic Verify, and understand what failed.
3. A student can export a Vivado Project Mode ZIP, unzip it, and open the `.xpr` cleanly in Vivado.
4. A student can generate a bitstream, program a real Basys3, and observe correct hardware behavior.
5. The same exported ZIP can be imported back into RedByte with manifest-first truth and a clear fidelity label.

The release bar is two real proofs, not just tests:

- one combinational proof
- one sequential proof using `CLK100MHZ` on `W5`

Current live-bench truth on 2026-04-29:

- `signal-tour` now has real E2 + E3 proof on Basys3.
- `golden-basys3-switch-and` now has fresh E1 + E2 after a real fixture blocker fix; final E3 note is still pending.
- Custom blank-shaped projects now have a repo-owned certification harness and multiple real E1 rows under `out/vivado-cert/custom-projects/`.

## Supported scope contract

### Fully supported today

- Vivado + Basys3 only
- Deterministic Verify for:
  - combinational circuits
  - `DFlipFlop`-based clocked circuits using the existing `clocked_macro` path
- Basys3 IO mapping and export for:
  - `CLK100MHZ`
  - `SW*`
  - `LED*` / `LD*`
  - `BTN*`
  - `SEG0..SEG6`
  - `AN0..AN3`
  - `DP`
- Student-safe export/import loop:
  - Open Project ZIP with `.xpr`
  - manifest-first roundtrip import
  - hard stop on corrupted manifest
  - ignore Vivado binary noise
- Supported Basys3 synth/export subset:
  - IO nodes
  - `AND`, `OR`, `XOR`, `NOT`, `NAND`, `NOR`, `XNOR`
  - `FullAdder`
  - `MUX4`
  - `DFlipFlop`

### Final-project (security lock) class — honest tier

Reference package: **ECE141 Digital Security Lock** (multi-file VHDL, package, FSM, debounce, SSD, TBs, full Vivado tree).

- **Import:** Top detection prefers `*_top.vhd` / `top.vhd`; companion RTL (non-`tb_*`) is **preserved in `project.hdl.sources`**; testbench paths are **surfaced but not embedded**. See `docs/release/proof/security-lock-complex-round-trip-audit-2026-04-23.md`.
- **Design canvas:** Partial reconstruction only — not a full Vivado elaborated schematic.
- **Export (RedByte Open Project):** **Blocked** for typical wide-vector tops until bus-native top export is supported; students keep **Vivado as source of truth for bitstream** for that class unless the top is refactored to scalar ports.
- **Verify:** Native deterministic Verify is **not** a substitute for `tb_system` / `tb_fsm` in Vivado for this complexity.

### Partially supported today

- Hierarchy and reuse:
  - custom components exist in project/runtime
  - they are not frozen as a proven Open Project export/import student path for lab day
- Multi-bit behavior:
  - import/export and mapping understand vector-style ports
  - canvas authoring is still single-bit and bit-slice oriented, not bus-native
- Seven-seg workflows:
  - board pins and aliases exist
  - student authoring/mapping is still manual and needs guided validation
- Generic Vivado ZIP import without manifest:
  - topology/ports/XDC reconstruction works
  - layout, vectors, and full-fidelity project semantics do not survive
- Sequential labs beyond `DFlipFlop`:
  - some codegen/runtime pieces exist for latch/T/JK forms
  - they are not the frozen Basys3 export subset

### Not supported for today's lab

- Original ISE / Project Navigator flow from the lab PDFs
- Behavioral HDL import as a student-safe path
- Guaranteed lab-day support for decoder / tri-state-specific implementations
- Guaranteed lab-day support for hierarchical macro export as student-authored Vivado submodules
- Vivado archive fidelity matching `.runs/.cache/.hw/.sim`

## `swaggy.zip` structural comparison

Reference ZIP inspected from `C:\Users\conno\Downloads\swaggy.zip`.

| Area | `swaggy.zip` | RedByte export | Decision for today |
| --- | --- | --- | --- |
| Root project file | `swaggy/swaggy.xpr` | `<slug>/<slug>.xpr` | Must match pattern only; current RedByte pattern is correct |
| `.srcs` HDL path | `swaggy.srcs/sources_1/new/top.vhd` | `<slug>.srcs/sources_1/new/top.vhd` | Must match; current RedByte export matches |
| `.srcs` constraints path | `swaggy.srcs/constrs_1/new/basys3.xdc` | `<slug>.srcs/constrs_1/new/top.xdc` | Keep `top.xdc` canonical across the flat kit, `.xpr`, and `vivado_import.tcl` |
| Simulation files | empty `sim_1` file set in `.xpr`; no bundled simulation source | optional `sim_1/new/testbench.vhd` when vectors exist | Allowed difference |
| `.xpr` metadata | large Vivado-generated file with absolute machine paths | deterministic file using `$PPRDIR/$PSRCDIR` macros | RedByte behavior is preferred; do not regress to machine paths |
| `.xpr` part/top | `xc7a35tcpg236-1`, `TopModule=top` | same by default, now student-overridable from Project | Must remain explicit and consistent |
| `.xpr` board part | empty `<BoardPart>` | explicit Basys3 board part | Allowed difference |
| Run/cache noise | includes `.runs`, `.cache`, `.hw`, `.sim`, `.ip_user_files` | omitted | Keep omitted |
| Manifest/helper files | none | `project.rbproj.json`, `README.txt`, `vivado_import.tcl`, bring-up files | Keep |
| Constraints familiarity | `basys3.xdc` | `top.xdc` | RedByte stays canonical on `top.xdc`; import still accepts either filename |

### Structural alignment required today

- `.xpr` at the root of the exported project folder
- `.srcs/sources_1/new/top.vhd`
- `.srcs/constrs_1/new/top.xdc`
- `.xpr` and `vivado_import.tcl` must reference the same top and part
- no machine-specific absolute source paths

### Structural differences allowed today

- helper files at the project root
- no `.runs/.cache/.hw/.sim`
- deterministic `.xpr` content instead of a full Vivado-authored `.xpr`

## Lab capability matrix

| Lab | Required capability | Lab-day status | Rule for today |
| --- | --- | --- | --- |
| Lab 1: Basic gates | simple combinational gates, simulate, map to hardware | Supported now | RedByte supports the logic objective on Vivado + Basys3, not the original ISE / breadboard flow |
| Lab 2: 4-bit adder + macros | combinational adder, hierarchy/macro reuse | Partially supported | Flat 4-bit adder is fine; student-authored hierarchical macro flow is not frozen for export/import |
| Lab 4: ALU | gates, add/sub path, mux/decoder/tri-state style control | Partially supported | `MUX4` / gates / `FullAdder` path is viable; decoder/tri-state-specific implementation is not a lab-day guarantee |
| Lab 5: add/sub + SSD | arithmetic unit, hierarchy, buses, 7-seg cathodes/anodes | Partially supported | Core arithmetic and Basys3 7-seg pins exist, but bus-native authoring and hierarchy are still manual |
| Lab 6: latches/flip-flops | D latch, D FF, T FF, JK FF behavior | Partially supported | `DFlipFlop` path is safe; latch/T/JK are not a frozen Basys3 student export promise |
| Lab 7: synchronous counter | DFF counter, CE/load/reset/CEO, clocked behavior | Supported only after real sequential validation | Use `DFlipFlop` + gates, not `Counter4Bit`, as the student export path |
| Lab 8: FSM lock | FSM + counters + 7-seg + manual clock/reset + LEDs | Not ready today as a blanket promise | Starter/spec path exists, but too many partial capabilities stack up for a same-day general claim |

### Specific capability calls

- Hierarchy: partial only
- Buses: partial only
- 7-seg outputs: partial but viable with manual mapping
- Counters: supported when built from `DFlipFlop` + gates and validated on hardware
- FSMs: viable in principle, not a same-day general-lab promise
- Manual clock/reset buttons: usable, but not a debounced abstraction

## Execution order for today

1. Missing wiring
   - wire `onGoToExport`, `fpgaConfig`, `onFpgaConfigChange`, and `importFidelity`
   - make export honor effective top and part
2. Reference ZIP alignment
   - freeze the `.xpr` / `.srcs` / `top.xdc` contract
   - keep `.runs/.cache/.hw` out
3. Supported-scope lock
   - keep this document current
   - keep in-product wording honest
4. Project config visibility
   - board, top, part, import fidelity, mapping completeness, verify freshness, export freshness
5. Combinational real-world validation
   - `SW -> LED`
   - one multi-gate circuit such as a full adder slice
6. Sequential real-world validation
   - one `DFlipFlop`-based clocked design using `CLK100MHZ`
   - confirm `create_clock` is emitted from `W5`
7. Release candidate
   - freeze tests
   - build
   - deploy
   - verify live build identity

## Manual validation checklist

Run this on the actual lab machine:

1. Open RedByte.
2. Create a project.
3. Reload and confirm state persists.
4. Build a tiny `SW0 -> LED0` design.
5. Verify it.
6. Export `Vivado Project (Open Project)`.
7. Unzip and open the `.xpr` in Vivado.
8. Run Synthesis, Implementation, and Generate Bitstream.
9. Program the Basys3 and confirm hardware behavior.
10. Import the same ZIP back into RedByte and confirm the fidelity badge and project content are correct.
11. Repeat with one sequential design using `CLK100MHZ` so `create_clock` is emitted for `W5`.

Lab-day release is blocked until both the combinational and sequential proofs pass on real Vivado + Basys3.
