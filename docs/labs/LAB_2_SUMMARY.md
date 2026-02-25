# Lab 2 Summary — 4-bit Binary Adder (Hierarchical Design)

**Source PDF:** `labs/fac_jung002_ECE141_Lab2.pdf`

---

## Learning Objectives

- Design a 4-bit binary adder from four cascaded full adders
- Create reusable logic circuit Macros (sub-circuits)
- Build and use a hierarchical circuit structure
- Verify binary addition results by simulation

## Circuit

4-bit ripple-carry adder: four full adders (FA) with carry chain.
- Inputs: A[3:0], B[3:0], C0 (carry-in = 0)
- Outputs: S[3:0] (sum), Carry (carry-out from FA3)
- Full adder: 2x XOR2, 2x AND2, 1x OR2 (A XOR B XOR Cin; Carry = AB + ACin + BCin)

## Required Deliverables (Original)

- Simulation results for 4 addition cases (fill-in table: A, B, Sum, Carry)
- Lab report + instructor signature

## Required Test Vectors (from PDF)

| A | B | Expected Sum | Expected Carry |
|---|---|---|---|
| 0100 | 1001 | 1101 | 0 |
| 1100 | 0011 | 1111 | 0 |
| 1110 | 1000 | 0110 | 1 |
| 0011 | 1101 | 0000 | 1 |

## What Is Outdated

| Item | Problem |
|---|---|
| ISE Symbol Wizard (Tool > Symbol Wizard) | ISE-specific; no equivalent in Vivado or RedByte |
| ISE ECS schematic bus wires | Not applicable in RedByte |
| Separate HDL Bencher file for top-level | Replaced by VerifySurface vectors |

## Modern Equivalent

- **Tool:** RedByte only (no Vivado needed)
- **Starter:** `09_4bit-adder` (pre-places 4 full-adder blocks)
- **Student task:** Wire carry chain (FA0.Cout → FA1.Cin → FA2.Cin → FA3.Cin), wire A/B inputs
- **Simulation:** Enter the 4 vectors above in VerifySurface; run verification
- **Gate:** `probe-carry` — must capture at least one carry transition (rows 3 or 4 above)
- **Submission:** Export ZIP
