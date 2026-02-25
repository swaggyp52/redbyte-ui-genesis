# Lab 1 Summary — Basic Gate Operation

**Source PDF:** `labs/fac_jung002_ECE141_Lab1 (1).pdf`
**Course:** ECE141 Digital Logic Design Lab — Gannon University
**Instructor:** Dr. Jung

---

## Learning Objectives (from PDF)

- Become familiar with FPGA design software (originally Xilinx ISE; now RedByte)
- Draw and simulate simple logic circuits with logic gates using software
- Understand gate-level schematic entry
- Build a truth table for a given circuit
- Verify simulation outputs match the truth table

## Circuit Under Study (Original)

```
A ---[INV]---+
             +---[AND2]---[INV]--- F
B -----------+
```

Function: F = NOT(A' AND B) = NOT(NOT(A) AND B)
Truth table: students derive this themselves as part of the lab.

## Required Hardware/Software (Original)

- Xilinx ISE 8.1i + ModelSim (Embedded System Lab installation)
- Spartan2E FPGA (xc2s200e, pq208, speed -6) — simulation only, no download
- Breadboard + IC chips (mentioned but secondary to simulation)

## Student Steps (Original)

1. Launch ISE 8.1i, create project (Spartan2E target)
2. Add Schematic source "Circuit1"
3. Place INV + INV + AND2 from Logic library; wire with Add Wires; label nets
4. Add I/O markers (input/output pads)
5. Save schematic
6. Create Test Bench Waveform source; set Check outputs delay to 1 ns
7. Set input waveforms for A and B covering all 4 combinations (00, 01, 10, 11)
8. Compile ModelSim simulation library (one-time setup, C:\FPGAdv63LSPS paths)
9. Run "Generate Expected Simulation Results" in ModelSim
10. Observe output F waveform; verify against manually-derived truth table
11. Complete truth table in lab report; write Boolean equation

## Required Deliverables (Original)

1. Lab report (following report format)
2. Lab notebook signed by instructor at end of lab

---

## What Is Outdated / Incompatible

| Item | Problem |
|---|---|
| Xilinx ISE 8.1i | Discontinued. Not available on modern Windows without VM. |
| Spartan2E (xc2s200e) | No longer manufactured. Not in Vivado. |
| ModelSim HDL Bencher paths (C:\FPGAdv63LSPS\...) | Lab-specific install path; does not exist on student machines. |
| "Compile HDL Simulation Libraries" step | ISE-specific one-time setup; entirely replaced by Vivado/RedByte. |
| Breadboard implementation | Retained as optional extra-credit if desired; not required. |
| Lab notebook signature | Paper-based; replaced by digital submission ZIP. |

---

## Modern Basys3 + Vivado + RedByte Equivalent

**No Vivado or Basys3 required for Lab 1. RedByte only.**

### Circuit

Same logical function: F = NOT(NOT(A) AND B).
Students build this on the RedByte canvas using NOT and AND2 gate nodes.

### Workflow

1. Open RedByte browser app; navigate to Project surface
2. Select "Lab 1 - Basic Gate Operation" from lab list
3. Load starter (wire-lamp or blank canvas)
4. On DesignSurface: drag NOT node (for A); drag AND2 node; drag NOT node (for output); wire them
5. Navigate to VerifySurface
6. Enter 4 truth table rows as test vectors (A, B inputs; F expected output)
7. Click "Run Verification" — expect PASS on all 4 rows
8. Export Submission ZIP from ProjectSurface — ZIP contains circuit + verify evidence

### Deliverables

- RedByte Submission ZIP (contains circuit JSON, verify report, grade summary)
- Optionally: screenshot of PASS result for lab report

### Grading Gate

`sim-ran` (block): must run verification at least once before exporting.
