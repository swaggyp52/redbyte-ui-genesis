# Lab 3 Summary — Seven-Segment Display Driver

**Source PDF:** `labs/fac_jung002_ECE141_Lab3.pdf`

---

## Learning Objectives

- Design a combinational SSD driver (4-bit binary in → 7-segment cathode out)
- Apply K-map minimization to derive simplified Boolean expressions for 7 outputs
- Synthesize and implement the circuit in an FPGA
- Assign FPGA pins and demonstrate on hardware

## Circuit Specification

- Inputs: B3, B2, B1, B0 (4-bit binary, digits 0-9; inputs 10-15 = don't-care)
- Outputs: CA, CB, CC, CD, CE, CF, CG (common-anode cathodes, active-low)
- Output AN1 = constant 0 (enables the one display digit being used)
- For digit "3": input 0011 → CA=0, CB=0, CC=0, CD=0, CE=1, CF=1, CG=0

## Student Pre-Lab Work (Paper, Unchanged)

- Complete truth table for all 16 input rows (10 valid + 6 don't-care)
- Derive K-maps for CA, CB, CC, CD, CE, CF, CG
- Write simplified Boolean expressions for each segment

## Required Hardware/Software (Original)

- Xilinx ISE + ModelSim (simulation)
- Spartan3 (xc3s200, ft256, -4) on Digilab Spartan 3 Starter board
- Parallel cable (J7 connector) + iMPACT

## What Is Outdated

| Item | Problem |
|---|---|
| Spartan3 Digilab board | Replaced by Basys3 |
| ISE PACE pin assignment | Replaced by RedByte-generated XDC |
| iMPACT parallel cable | Replaced by USB-JTAG (built into Basys3) |
| SW4-SW1 labels (Spartan3) | Different on Basys3: SW3-SW0 |
| AN1 active-low via external inverter | Basys3 SSD anodes are active-low directly; AN[0] = W7 |
| xc3s200 FPGA part | xc7a35tcpg236-1 (Artix-7 on Basys3) |

## Basys3 Pin Mapping (Replacement)

| Port | Basys3 Pin | Resource |
|---|---|---|
| B3 (MSB) | W17 | SW3 |
| B2 | W16 | SW2 |
| B1 | V16 | SW1 |
| B0 (LSB) | V17 | SW0 |
| CA | W7 | 7-seg segment a |
| CB | W6 | 7-seg segment b |
| CC | U8 | 7-seg segment c |
| CD | V8 | 7-seg segment d |
| CE | U5 | 7-seg segment e |
| CF | V5 | 7-seg segment f |
| CG | U7 | 7-seg segment g |
| AN[0] | U2 | Rightmost digit anode (active-low) |
| AN[1-3] | Tied high | Disable other 3 digits |

## Modern Workflow

1. Open RedByte; select Lab 3; load seven-segment-driver starter
2. Build decode logic from K-map results using AND/OR/NOT/NAND gates on canvas
3. Enter 10 test vectors in VerifySurface (digits 0-9); verify all PASS
4. Apply Basys3 seven-segment preset in hardware tab
5. Export Submission ZIP → ZIP includes `top.vhd` + `top.xdc` with above pin assignments
6. Open Vivado 2025.1 → create project → add `top.vhd` + `top.xdc`
7. Select part: xc7a35tcpg236-1
8. Run Synthesis → Implementation → Generate Bitstream
9. Hardware Manager → Open Target → Program Device
10. Toggle SW[3:0] and verify digits 0-9 appear on rightmost display digit

## Gate

`basys3-profile` (block): Basys3 board preset must be selected before export.
