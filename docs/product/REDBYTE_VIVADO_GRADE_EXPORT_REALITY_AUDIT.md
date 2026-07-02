---
doc_status: current
last_validated: 2026-07-02
owner: Connor Angiel
used_by_claude: true
role: production export package reality audit and Vivado E1 boundary
---

# RedByte Vivado-Grade Export Reality Audit

## 1. Scope

This audit checks whether live RedByte production produces Vivado-grade export packages for the student-critical starter path. It is not a product feature slice and it does not change generated HDL, XDC, testbench, Tcl, ZIP, project format, simulator semantics, or pin mapping.

Production source checked:

- URL: `https://redbyteapps.dev/os`
- Version endpoint SHA: `d515b812aae1625439aa5fd2205af4f8226ee3a7`
- Build endpoint SHA: `d515b81`
- Proof artifact root: `.redbyte/product-immersion/vivado-grade-export-audit/`
- Production proof script: `.redbyte/product-immersion/vivado-grade-export-audit/vivado-grade-export-audit.mjs`
- Audit JSON: `.redbyte/product-immersion/vivado-grade-export-audit/vivado-grade-export-audit.json`

The audit generated and inspected live production ZIPs for:

1. Logic Gates
2. Half Adder
3. Full Adder
4. 4-Bit Ripple Carry Adder
5. 2-Bit Up Counter

## 2. Verdict

Production is browser-E0 export-package credible for these five starters. The generated ZIPs have the expected Vivado project-folder shape, matching `project.rbproj.json`, `README.txt`, `vivado_import.tcl`, `.xpr`, `top.vhd`, `top.xdc`, `testbench.vhd`, and `EXPECTED_IO.json`.

This pass does not prove Vivado E1. Vivado is not installed or discoverable on this machine, so no real `synth_1`, `impl_1`, or `write_bitstream` run happened.

Student confidence: medium to high for downloading and inspecting the right package, with the strongest confidence on simple combinational starters.

Professor confidence: medium. The package structure is inspectable and internally consistent, but a professor should not treat it as hardware-ready until a real Vivado log exists for the same package class and commit.

## 3. Common Package Findings

Every audited package passed these structural checks:

- Required files present: `BRINGUP.md`, `EXPECTED_IO.json`, `README.txt`, `program_and_test.tcl`, `project.rbproj.json`, `top.vhd`, `top.xdc`, `testbench.vhd`, `.xpr`, and `vivado_import.tcl`.
- `project.rbproj.json` is an `rb-project` manifest at version `1`.
- Manifest `sourceExampleId` matches the loaded starter.
- Manifest board is `basys3`.
- `.xpr` uses `xc7a35tcpg236-1`.
- `vivado_import.tcl` names `top.vhd`, `top.xdc`, `testbench.vhd`, and the generated top entity.
- `.xpr` top module matches the VHDL entity.
- Every VHDL top port has an XDC constraint.
- No duplicate `PACKAGE_PIN` use was found.
- `EXPECTED_IO.json` is schema `rb.expected-io.v1`, source `verify-run`, evidence level `E0`.
- `testbench.vhd` has a testbench entity, instantiates the top, and includes assertions.
- README states the E0 boundary and does not claim bitstream, programming, or observed board behavior.
- Clock constraints match design kind: no `create_clock` for combinational starters; `CLK100MHZ/W5` `create_clock` for the counter.

## 4. Package Matrix

| Package | Verify evidence | Top entity | I/O shape | Key pins | Risk |
|---|---:|---|---|---|---|
| Logic Gates | `12/12 match` | `logic_gates_and_or_xor` | 2 inputs, 3 outputs | `SW0=V17`, `SW1=V16`, `LD0=U16`, `LD1=E19`, `LD2=U19` | Low E0 structural risk; E1 unproven |
| Half Adder | `8/8 match` | `half_adder` | 2 inputs, 2 outputs | `SW0_A=V17`, `SW1_B=V16`, `LD0_CARRY=U16`, `LD1_SUM=E19` | Low E0 structural risk; E1 unproven in this pass |
| Full Adder | `16/16 match` | `full_adder` | 3 inputs, 2 outputs | `SW0_A=V17`, `SW1_B=W16`, `SW2_CIN=W15`, `LD0_CARRY=U16`, `LD1_SUM=E19` | Medium E0 structural risk; generated package is coherent but not compiled |
| 4-Bit Ripple Carry Adder | `80/80 match` | `rb_4_bit_ripple_carry_adder` | 8 inputs, 5 outputs | `A0_SW0=V17`, `B0_SW1=V16`, `A3_SW6=W14`, `B3_SW7=W13`, `LD4_CARRY=W18` | Medium E0 depth risk; many ports and carry chain need real Vivado E1 |
| 2-Bit Up Counter | `14/14 match` | `rb_2_bit_up_counter_basys3` | 3 inputs, 2 output bits | `CLK100MHZ=W5`, `SW=V17`, `BTNC=U18`, `LED[0]=U16`, `LED[1]=E19` | Medium-high E0-only risk because sequential timing and visible board behavior remain external |

## 5. Student And Instructor Interpretation

Logic Gates and Half Adder are the best student-safe export demonstrations from this pass: simple I/O, no clock constraint, readable VHDL entity names, complete testbench assertions, and no duplicate pins.

Full Adder is a reasonable next step: the package is internally consistent and the testbench covers the full 3-input truth table, but it is still only browser-E0 until compiled.

4-Bit Ripple Carry Adder is the deepest audited combinational starter. It now has stronger browser evidence than a four-row smoke: live production reported `80/80 match`. Its ZIP is coherent, but the wider I/O surface and carry chain make it a priority for real Vivado E1.

2-Bit Up Counter is structurally honest: it uses `CLK100MHZ` on `W5`, has a `create_clock`, maps enable/reset/output bits, and keeps E1/E2/E3 external. It is also the riskiest package in this pass because sequential board behavior cannot be inferred from browser proof.

## 6. Vivado E1 Boundary

Local Vivado checks on 2026-07-02:

- `vivado -version`: failed, command not recognized.
- `where.exe vivado`: no files found.
- `Get-Command vivado`: no command found.
- `C:\Xilinx` does not exist.
- Common paths checked and missing:
  - `C:\Xilinx\Vivado\2025.1\bin\vivado.bat`
  - `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`
  - `C:\Xilinx\Vivado\2024.1\bin\vivado.bat`
  - `C:\Xilinx\Vivado\2023.2\bin\vivado.bat`
  - `C:\Xilinx\Vivado\2023.1\bin\vivado.bat`
  - `C:\Program Files\Xilinx\Vivado\2024.2\bin\vivado.bat`

E1 status: blocked by missing Vivado, not failed by RedByte-generated files.

## 7. Commands To Run On A Vivado Machine

Use the exact downloaded packages from the audit or regenerate the same examples from production. For each extracted package:

```powershell
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
$Xpr = "<extracted-package-root>\<package-root>.xpr"
& $Vivado -mode batch `
  -source scripts\vivado\redbyte_batch_synth_impl_bitstream.tcl `
  -notrace `
  -nojournal `
  -log "<audit-output>\vivado_batch_<package-id>.log" `
  -tclargs $Xpr 4
```

Minimum E1 set to close next:

1. Logic Gates
2. Full Adder
3. 4-Bit Ripple Carry Adder
4. 2-Bit Up Counter

Logic Gates proves the simplest combinational package. Full Adder proves nontrivial arithmetic. 4-Bit Ripple Carry Adder proves the deepest current combinational starter. 2-Bit Up Counter proves clocked sequential export with the Basys3 board clock constraint.

## 8. Product Readiness Judgment

This audit improves confidence in RedByte's export handoff, but it does not make the whole RedByte product "done."

What is credible now:

- Production includes the Summer Rescue testbench repair and export-confidence work at `d515b812aae1625439aa5fd2205af4f8226ee3a7`.
- Live production can drive students through Verify and export internally consistent Vivado project ZIPs for the five audited starters.
- Export packages are honest about E0 and do not claim Vivado, bitstream, or board observation proof.

What is still not credible enough:

- RedByte has not freshly proven these exact live production ZIPs in Vivado E1.
- RedByte has not freshly produced bitstreams E2 for these exact live production ZIPs.
- RedByte has not freshly observed Basys3 behavior E3 for these exact live production ZIPs.
- Complex wrong builds, disconnected outputs, and large scratch projects still need more normal-use product proof.
- Professor review still needs a real ZIP walkthrough and Vivado log review, not just browser gate output.

## 9. Recommended Next Slice

Next slice should be Vivado E1 export certification on a machine with Vivado 2024.2, using the production ZIPs or regenerated packages for Logic Gates, Full Adder, 4-Bit Ripple Carry Adder, and 2-Bit Up Counter.

If Vivado remains unavailable, the next browser-only product slice should be wrong/disconnected-build diagnosis for from-scratch designs, because that is the highest remaining student-friction gap after Summer Rescue.
