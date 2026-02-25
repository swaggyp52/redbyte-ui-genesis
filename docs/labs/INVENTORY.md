# ECE141 Lab Document Inventory

Generated: 2026-02-25

## Lab PDFs — Gannon University ECE141 Digital Logic Design Lab

All found in: `C:\Users\conno\redbyte-ui\labs\`

| Filename | Lab Title | Format | Key Tool Referenced | Board Referenced | Relevance |
|---|---|---|---|---|---|
| `fac_jung002_ECE141_Lab1 (1).pdf` | Basic Gate Operation | PDF | Xilinx ISE 8.1i + ModelSim | Spartan2E (xc2s200e) breadboard | **High** — learning objective maps to Lab 1 in RedByte |
| `fac_jung002_ECE141_Lab2.pdf` | Simple Logic Circuit Design (4-bit Adder) | PDF | Xilinx ISE + HDL Bencher | Spartan2E (schematic capture) | **High** — hierarchical adder = Lab 2 in RedByte |
| `fac_jung002_ECE141_Lab3.pdf` | Seven-Segment Display Driver | PDF | Xilinx ISE + iMPACT | Spartan3 Digilab board | **High** — SSD decode = Lab 3 in RedByte; first FPGA hardware lab |
| `fac_jung002_ECE141_Lab4.pdf` | Simplified ALU | PDF | Xilinx ISE schematic (m8_1e MUX + d3_8e Decoder) | Spartan3 Digilab board | **High** — ALU opcode control = Lab 4 in RedByte |
| `fac_jung002_ECE141_Lab5.pdf` | 2's Complement Adder/Subtractor | PDF | Xilinx ISE hierarchical schematic | Spartan3 Digilab board | **High** — add/sub = Lab 5 in RedByte |
| `fac_jung002_ECE141_Lab6.pdf` | Latches and Flip-Flops | PDF | Xilinx ISE (ld, fd, ftc, fjkc primitives) + HDL Bencher | Digilab D2SB-DIO4 | **High** — storage elements = Lab 6 in RedByte |
| `fac_jung002_ECE141_Lab7.pdf` | Synchronous Counter | PDF | Xilinx ISE (fdc primitive) + HDL Bencher | Digilab Spartan3 | **High** — counter design = Lab 7 in RedByte |
| `fac_jung002_ECE141_Lab8.pdf` | Sequential Network Design (Security Lock FSM) | PDF | Xilinx ISE (full system) + HDL Bencher | Digilab Spartan3 | **High** — FSM = Lab 8 in RedByte |

## Supporting Reference Documents — Repo Root (`C:\Users\conno\redbyte-ui\`)

| Filename | Type | Relevance |
|---|---|---|
| `basys3_rm.pdf` | Basys3 Reference Manual (Digilent) | **High** — authoritative pin/peripheral reference for modern board target |
| `basys3_rm (1).pdf` | Duplicate copy of Basys3 RM | Low (duplicate) |
| `vivado-getting-started-en-us-2025.1.pdf` | Vivado 2025.1 Getting Started Guide | **High** — current toolchain documentation |
| `ECE348_GECE598_Refer_VHDL_quick_start.pdf` | VHDL Quick-Start Reference | **High** — language reference for updated handouts |

## RedByte Product / Research Documents — Repo Root

| Filename | Type | Relevance |
|---|---|---|
| `RedByte OS & Logic Playground – Product and Systems Specification.pdf` | Product spec | Med — background on RedByte capabilities |
| `RedByte OS_ A Deterministic Computational Universe for Education and Research.pdf` | Research paper | Med — explains pedagogical model |
| `Deterministic Interactive Computation in the Browser.pdf` (and variants) | Paper drafts | Low — research context |
| `RedByte Project Strategic Plan.pdf` | Strategic plan | Low — planning context |

## Other Files in Repo Root

| Filename | Notes |
|---|---|
| `Ece 141 – Digital Logic Lab 1 Assignment.docx` | Alternate Lab 1 assignment handout (Word format, pre-dates PDF) |
| `Lab-Ready Product Plan (1).docx` | RedByte product planning doc |
| `Labs.zip` | Archive — presumed lab file collection |
| `test-submission.rb-lab.zip` | RedByte submission test artifact |
| `FullAdderHDL.txt` | VHDL source for full adder (sample artifact) |

## Tooling Versions Referenced in Original PDFs (Outdated)

| Original | Modern Replacement |
|---|---|
| Xilinx ISE 8.1i | Vivado 2025.1 (or latest ML) |
| Spartan2E / Spartan3 (xc2s200e, xc3s200) | Artix-7 (xc7a35t) on Basys3 |
| Digilab Spartan 3 Starter / D2SB-DIO4 | Basys3 board (Digilent) |
| ModelSim-SE VHDL | Vivado Simulator (xsim) |
| HDL Bencher / iMPACT / JTAG parallel cable | Vivado sim + Vivado Hardware Manager + USB-JTAG |
| Breadboard + IC chips (Lab 1 original) | Software-only simulation in RedByte (no breadboard needed) |

## Version / Semester Hints

- Instructor: `fac_jung002` (Dr. Jung, Gannon University ECE)
- Course: ECE141 Digital Logic Design Lab, Gannon University
- No explicit semester dates found in PDFs; tooling (ISE 8.1i) suggests mid-2000s origin
- Labs 1-2: combinational only (no hardware upload step)
- Labs 3+: FPGA synthesis + hardware demonstration required
- Labs 6-8: sequential circuits, clock-based simulation needed
