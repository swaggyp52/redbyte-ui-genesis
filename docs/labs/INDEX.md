# ECE141 Lab Document Index

Generated: 2026-02-25

This index organizes all discovered documents by category for the
Gannon University ECE141 Digital Logic Design Lab modernization effort.

---

## Lab PDFs (Course Expectations — Ground Truth)

All 8 original lab PDFs found. Instructor: fac_jung002 (Dr. Jung).
All use Xilinx ISE + Spartan2E/3. All require modernization for Basys3 + Vivado + RedByte.

| Lab | Title | PDF Path | RedByte Lab ID |
|---|---|---|---|
| Lab 1 | Basic Gate Operation | `labs/fac_jung002_ECE141_Lab1 (1).pdf` | `lab-1` |
| Lab 2 | Simple Logic Circuit Design (4-bit Adder) | `labs/fac_jung002_ECE141_Lab2.pdf` | `lab-2` |
| Lab 3 | Seven-Segment Display Driver | `labs/fac_jung002_ECE141_Lab3.pdf` | `lab-3` |
| Lab 4 | Simplified ALU | `labs/fac_jung002_ECE141_Lab4.pdf` | `lab-4` |
| Lab 5 | 2's Complement Adder/Subtractor | `labs/fac_jung002_ECE141_Lab5.pdf` | `lab-5` |
| Lab 6 | Latches and Flip-Flops | `labs/fac_jung002_ECE141_Lab6.pdf` | `lab-6` |
| Lab 7 | Synchronous Counter | `labs/fac_jung002_ECE141_Lab7.pdf` | `lab-7` |
| Lab 8 | Sequential Network Design (Security Lock FSM) | `labs/fac_jung002_ECE141_Lab8.pdf` | `lab-8` |

Additional lab material:
- `Ece 141 – Digital Logic Lab 1 Assignment.docx` — Word version of Lab 1
- `labs/Basys3_Lab3_Manual.docx` — Instructor-authored Basys3 Lab 3 update
- `labs/Lab 2 Manual.docx` — Instructor-authored Lab 2 manual
- `labs/Lab 3 Manual_ Seven-Segment Display Driver.docx` — Instructor Lab 3 manual
- `labs/ECE141 Lab Report Template.docx` — Grading report template

---

## Basys3 Hardware References

| Document | Path | Notes |
|---|---|---|
| Basys3 Reference Manual | `basys3_rm.pdf` | Authoritative. Pin assignments, switches, LEDs, SSD wiring, USB-JTAG |
| Basys3 Reference Manual (copy) | `basys3_rm (1).pdf` | Duplicate |

Key Basys3 facts from RM relevant to lab modernization:
- FPGA: Artix-7 XC7A35T-1CPG236C
- 16 slide switches (SW0–SW15), 16 LEDs (LD0–LD15)
- 5 pushbuttons (BTNC, BTNU, BTND, BTNL, BTNR)
- 4-digit 7-segment display (common-anode, active-low)
- USB-JTAG (no separate parallel cable needed)
- Onboard 100 MHz clock (W5 pin)

---

## Vivado Workflow References

| Document | Path | Notes |
|---|---|---|
| Vivado 2025.1 Getting Started Guide | `vivado-getting-started-en-us-2025.1.pdf` | Current. Project creation, RTL analysis, simulation, bitstream |

Key workflow changes from ISE to Vivado:
- Project creation: Vivado New Project Wizard (replaces ISE Navigator)
- Simulation: xsim (replaces ModelSim HDL Bencher)
- Synthesis/Implementation: Vivado flow (replaces ISE XST)
- Pin assignment: XDC constraints file (replaces UCF PACE tool)
- Programming: Vivado Hardware Manager + USB-JTAG (replaces iMPACT + parallel cable)

---

## VHDL/Verilog Language References

| Document | Path | Notes |
|---|---|---|
| VHDL Quick-Start Reference | `ECE348_GECE598_Refer_VHDL_quick_start.pdf` | Good for ECE141 student level; covers entity/architecture/process |

RedByte exports structural VHDL. Students should understand:
- `entity` / `architecture` blocks
- `port map` for component instantiation
- `process` with `clk'event` for sequential logic (Labs 6-8)

---

## VHDL Language References (In-Repo)

- `FullAdderHDL.txt` — Example structural VHDL full adder (usable as Lab 2 reference)

---

## RedByte Lab Definitions (In-Repo)

Defined in: `packages/rb-apps/src/labs/labDefinitions.ts`

| RedByte ID | Title | Basys3 Required | Key Gate |
|---|---|---|---|
| `lab-1` | Lab 1 - Basic Gate Operation | No | sim-ran (block) |
| `lab-2` | Lab 2 - Hierarchical 4-bit Adder | No | probe-carry (block) |
| `lab-3` | Lab 3 - Seven-Segment Display Driver | Yes | basys3-profile (block) |
| `lab-4` | Lab 4 - ALU with Opcode Control | Yes | opcode-coverage (block) |
| `lab-5` | Lab 5 - 2's Complement Add/Sub | Yes | addsub-coverage (block) |
| `lab-6` | Lab 6 - Latches and Flip-Flops | No | clock-evidence (block) |
| `lab-7` | Lab 7 - Synchronous Counter | Yes | sequence-proof (block) |
| `lab-8` | Lab 8 - Security Lock FSM | Yes | fsm-paths (block) |
| `freeplay` | Freeplay - Build Anything | No | none |

All 8 original labs have corresponding RedByte lab definitions. Alignment is 1:1.

---

## Other

| Document | Notes |
|---|---|
| `Labs.zip` | Archive; contents not inspected in this pass |
| `test-submission.rb-lab.zip` | RedByte submission bundle test artifact |
| `labs/basys3_mvp_lab/` | Directory — virtual lab content (not a PDF) |
| `labs/lab2_adder/`, `labs/virtual_lab_blink/` etc. | Virtual lab directories |
