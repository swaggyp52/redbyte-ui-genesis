# Product Hardening - Vivado Export Fidelity + Board Rehearsal Reset

## Ticket

- Title: Vivado export fidelity + board rehearsal reset
- Date: 2026-04-23
- Owner: Connor Angiel
- Surface: Export / Hardware handoff / Vivado package generation
- Journey segment: Verify -> Map Pins -> Export -> Open in Vivado -> synthesize -> implement -> bitstream -> program
- Mode: student
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: Edge / Chromium-class browser in local IDE work
  - Node: repo local
  - pnpm: repo local
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - RedByte emits a coherent-looking Vivado package, but the repo still proves structure and determinism more strongly than real Vivado handoff fidelity.
  - The primary board clock is emitted as `create_clock` for `W5`, but generated-clock policy is absent.
  - The flat artifact set uses `top.xdc`, while the Vivado project-folder builder renames the constraints file to `basys3.xdc`; this is consistent in code paths that know about the rename, but it is still a contract split.
  - Export validation is strong on file presence, naming agreement, and deterministic packaging, but there is not yet a repo-owned non-interactive Vivado rehearsal proving synth -> impl -> bitstream on a matrix of nontrivial projects.
  - Bus/vector export support exists in the generated top-level binding model, but HDL-import / HDL-top projection paths still block vector top ports as unsupported for the synth subset.
- Expected behavior:
  - A student export should behave like a real Vivado handoff artifact, not just a plausible ZIP.
  - Port naming, board mapping, clock constraints, testbench content, Tcl import script, `.xpr`, and helper docs must agree on one canonical design truth.
  - Unsupported complexity such as generated clocks must be explicitly detected and surfaced, not silently omitted.
  - The repo should prove more than toy examples and should move closer to "open in Vivado and it works."
- Why this matters:
  - The actual classroom promise is not "Export says ready." It is "student can synthesize, implement, generate bitstream, and program Basys3 from the exported project."
  - Any clock, naming, or constraint drift shows up late and expensively in Vivado.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Inspect the export pipeline from `buildExportViewModel()` through `exportProjectAsBasys3()`, `exportBasys3Bundle()`, and `buildVivadoProjectFolderZip()`.
  2. Compare emitted flat artifacts (`top.vhd`, `top.xdc`, `testbench.vhd`, `vivado_import.tcl`, `README.txt`) with the `.xpr` project-folder export path.
  3. Inspect current tests and gates for whether they validate actual Vivado execution or only artifact structure.
  4. Inspect sequential and clock semantics for whether only `create_clock` on the top-level board clock is supported.
- Reproducibility: always
- First known version or date: 2026-04-23 audit

## Evidence

- Screenshot / recording: pending implementation proof
- Console excerpt: none yet
- Test / gate output:
  - Current repo tests/gates already cover deterministic export pack structure, artifact agreement, and selected classroom goldens.
- Additional artifacts:
  - `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts`
  - `packages/rb-apps/src/fpga/boards/basys3/basys3ExportService.ts`
  - `packages/rb-apps/src/fpga/boards/basys3/testbenchGenerator.ts`
  - `packages/rb-apps/src/fpga/boards/basys3/vivadoImportTcl.ts`
  - `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts`
  - `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
  - `packages/rb-apps/src/__tests__/ide-vivado-pack-contract.test.ts`
  - `packages/rb-apps/src/__tests__/ide-vivado-artifact-consistency.test.ts`
  - `packages/rb-apps/src/__tests__/classroom-golden-basys3-export-gate.test.ts`
  - `packages/rb-apps/src/__tests__/classroom-golden-basys3-alu-export-gate.test.ts`
  - `packages/rb-apps/src/__tests__/lab8-export-validation.test.ts`
  - `scripts/classroom-golden-basys3.ts`
  - `scripts/classroom-golden-basys3-alu.ts`
  - `scripts/classroom-smoke-lab4.ts`
  - `docs/lab-day-vivado-basys3-readiness.md`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md`
  - 4.6 Export Surface
  - 5.3 Export Trust
  - 6.1 Product-ready
  - 9.5 Export / Vivado
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`
  - 4.6 Export Model
  - 11 Vivado Export and External Tool Workflow
  - 14.2 Vivado Kit ZIP Structure
  - Appendix C
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
  - export / Vivado trust still partial; hardware rehearsal not yet proven
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
  - Path 3 Export -> Vivado Pack
  - Path 4 Hardware Checklist
- QA / rehearsal clause(s):
  - `docs/release/manual-assignment-qa-script.md`
  - `docs/release/v1-release-checklist.md`
  - `docs/rehearsal/failure-ticket-template.md`
- External authoritative sources:
  - Digilent Basys 3 reference manual
  - Digilent Basys-3 Master XDC
  - AMD Vivado constraints documentation for `create_clock` / `create_generated_clock` ordering and semantics

## Audit

### Current artifact pipeline

1. What exactly is emitted today in the Vivado package?
   - `buildExportViewModel()` emits:
     - `top.vhd`
     - `top.xdc`
     - `testbench.vhd`
     - `vivado_import.tcl`
     - `README.txt`
     - `BRINGUP.md`
     - `EXPECTED_IO.json`
     - `program_and_test.tcl`
     - `project.rbproj.json`
   - `buildVivadoProjectFolderZip()` repackages those into a Vivado project ZIP containing:
     - `<slug>/<slug>.xpr`
     - `<slug>/<slug>.srcs/sources_1/new/top.vhd`
     - `<slug>/<slug>.srcs/constrs_1/new/basys3.xdc`
     - optional `<slug>/<slug>.srcs/sim_1/new/testbench.vhd`
     - root helper files: `README.txt`, `vivado_import.tcl`, `BRINGUP.md`, `EXPECTED_IO.json`, `program_and_test.tcl`, `project.rbproj.json`

2. Which files are authoritative for board/resource/clock truth?
   - Board resource truth: `basys3Pins.ts`
   - Board-clock identity: `basys3SignalSemantics.ts`
   - Top-port authority and XDC/VHDL reference names: `basys3ExportModel.ts`
   - Bundle generation and top-level XDC emission: `basys3Bundle.ts`
   - Export validation and blocking policy: `basys3ExportService.ts`
   - Testbench generation: `testbenchGenerator.ts`
   - Vivado project/folder wrapping: `vivadoImportTcl.ts`, `vivadoProjectFolder.ts`

3. How is the primary board clock currently emitted into XDC?
   - In `basys3Bundle.ts::buildTopXdc()`, when a mapped resource resolves to package pin `W5`, export emits:
     - `set_property PACKAGE_PIN W5 [get_ports {...}]`
     - `set_property IOSTANDARD LVCMOS33 [get_ports {...}]`
     - `create_clock -period 10.000 -name sys_clk -waveform {0.000 5.000} [get_ports {...}]`

4. Are generated clocks represented at all?
   - No repo-owned export path currently emits `create_generated_clock`.
   - No explicit generated-clock support path was found in export emitters.
   - Current policy is implicit absence, not explicit detection/fencing.

5. How are top-level ports named and kept in sync across VHDL, XDC, and Hardware mapping?
   - `basys3ExportModel.ts` derives top ports and per-entry refs from `ioMapping` plus IR boundary direction.
   - `top.vhd` uses `topPorts`, `topInputBindings`, and `topOutputBindings` from that shared model.
   - `top.xdc` uses `inputRefs` / `outputRefs` from the same shared model.
   - `testbenchGenerator.ts` can derive component/signal declarations from the generated entity VHDL to enforce entity/testbench parity.
   - `vivadoProjectFolder.ts` revalidates top/entity/source/constraint/testbench/Tcl agreement before packaging the `.xpr` export.

6. Where could bus naming / hierarchy / generated-clock / derived-clock complexity break the export?
   - Generated clocks / derived clocks: no explicit support or blocking policy today.
   - HDL top-level vector ports: `validateTopPortWidths()` blocks vector ports in imported/source HDL top entities for the synth subset, even though export-model grouping can emit vectors from mapped scalar rows.
   - Authority split: `basys3Bundle.ts` still carries a legacy Verilog export path and some linting against that path; VHDL is the real authority for Vivado handoff.
   - Constraint filename split: flat artifacts use `top.xdc`; Vivado project folder renames to `basys3.xdc`.
   - Board truth duplication: `vivadoProjectFolder.ts` and `ExportSurface.tsx` each keep their own Basys3 valid-pin sets instead of consuming only `basys3Pins.ts`.
   - Hierarchy/macro complexity: export flattens macros before artifact generation; true hierarchical Vivado submodule handoff is still not the proven classroom path.

7. What current tests prove export correctness beyond simple projects?
   - `ide-vivado-pack-contract.test.ts`
   - `ide-vivado-artifact-consistency.test.ts`
   - classroom deterministic goldens:
     - `classroom-golden-basys3-export-gate.test.ts`
     - `classroom-golden-basys3-alu-export-gate.test.ts`
   - `lab8-export-validation.test.ts`
   - UI/e2e and gate checks:
     - `ide-export-e2e-contract.mjs`
     - `ide-export-ready-contract.mjs`
     - `ide-vivado-pack-contract.mjs`

8. Which current examples are strong enough to serve as real Vivado export rehearsal fixtures?
   - Golden switch-and fixture
   - Golden ALU fixture
   - Lab 4 classroom smoke fixture
   - Lab 8 sequential/security-lock export validation
   - Basys3 starter examples in `packages/rb-apps/src/examples/*basys3*.json` are candidate matrix fixtures but are not yet all tied into a stronger rehearsal matrix.

9. Can the exported package actually be driven through Vivado non-interactively for validation?
   - The package includes enough to do it:
     - `vivado_import.tcl`
     - `.xpr`
     - implementation run steps including `write_bitstream`
   - But current repo-owned gates do not run a real Vivado compile. They validate structure, determinism, and internal consistency.
   - `scripts/lab8-vivado-export.ts` documents a manual/non-interactive Vivado invocation path, but it is not a general rehearsal gate.

10. What is the current largest gap between "export looks good" and "Vivado project really works"?
    - The repo proves artifact coherence strongly, but it still lacks a first-class fidelity matrix and a repo-owned rehearsal path for real Vivado synthesis/implementation/bitstream across multiple nontrivial designs.
    - Generated-clock policy is the clearest semantic blind spot.

## Acceptance Proof

- Minimum acceptance proof:
  - Export package preserves correct primary board-clock truth into XDC.
  - Port naming remains synchronized across top HDL, XDC, testbench, Tcl, and `.xpr`.
  - The repo proves more than toy examples with at least one nontrivial combinational and one nontrivial sequential export fixture.
  - Unsupported complexity classes are blocked or called out honestly.
- Required test / gate command(s):
  - targeted vitest for touched export/Vivado files
  - relevant export/hardware/verify tests
  - relevant gates including export/Vivado pack contracts
  - `pnpm build:unified`
- Required manual proof:
  - inspect at least one nontrivial exported project bundle
  - strongly preferred: Vivado smoke or rehearsal evidence
- Screenshot or recording expectation:
  - exported artifact proof and, if feasible, Vivado-oriented proof artifact

## Implementation Summary

- Constraint-file contract was unified so the Vivado project-folder export now keeps `top.xdc` canonical end-to-end instead of renaming it to `basys3.xdc` inside the `.xpr` layout.
- `vivadoProjectFolder.ts` now validates package pins against the shared Basys3 pin catalog instead of a local copy.
- Export now blocks unsupported generated/derived clock directives (`create_generated_clock`, `derive_pll_clocks`, `derive_clocks`, `set_clock_groups`) instead of silently dropping them.
- Bundle validity now follows the authoritative VHDL/XDC handoff contract instead of the legacy raw-Verilog lint path. The old lint warnings remain visible as diagnostics, but they no longer falsely mark classroom VHDL exports invalid.
- Export proof coverage was widened with:
  - a sequential project-folder consistency fixture that preserves `W5` / `create_clock`
  - refreshed ALU golden hash after the stale validity gate was removed
  - existing Lab 8 sequential export validation kept green

## Proof Notes

- Nontrivial manual artifact rehearsal:
  - `pnpm tsx scripts/lab8-vivado-export.ts`
  - generated `out/lab8/top.vhd`, `out/lab8/top.xdc`, `out/lab8/vivado_import.tcl`, `out/lab8/testbench.vhd`
  - deterministic ZIP SHA256: `5000809bda02132c906404171ca66f57fc0c2af514743e453ba514e709704457`
  - exported XDC preserved the expected Lab 8 switch/LED pin map and no active `create_clock` for manual switch clocking
- Project-folder fidelity proof is test-backed in this slice:
  - `ide-vivado-project-folder-contract.test.ts`
  - `ide-vivado-artifact-consistency.test.ts`
  - both now assert canonical `top.xdc` references through `.xpr` and `vivado_import.tcl`

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/contracts/RedByte_Product_Contract.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/lab-day-vivado-basys3-readiness.md`
  - `docs/STUDENT_UX_LAYER.md`
- Docs that must be updated if behavior changes:
  - `AI_STATE.md`
  - this hardening ticket
  - any release/proof doc created by the slice

## Disposition

- Status: implemented / validated locally
- Fix PR / commit:
- Notes:
  - Audit complete before coding.
  - Real Vivado synth/impl/bitstream automation is still not repo-owned in this environment; this slice strengthens the handoff artifact and fences unsupported timing directives honestly.

## Attribution

Connor Angiel
