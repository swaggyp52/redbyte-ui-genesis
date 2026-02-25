# Lab 4 Summary — Simplified ALU

**Source PDF:** `labs/fac_jung002_ECE141_Lab4.pdf`

---

## Learning Objectives

- Design an ALU using opcode-driven datapath selection
- Use a MUX to select between multiple functional units
- Synthesize and demonstrate on FPGA hardware

## Opcode Table (Simplified for RedByte — 4 operations vs original 8)

| en | S2 | S1 | S0 | Operation |
|---|---|---|---|---|
| 1 | 0 | 0 | 0 | AND(A,B) |
| 1 | 0 | 0 | 1 | OR(A,B) |
| 1 | 0 | 1 | 0 | XOR(A,B) |
| 1 | 0 | 1 | 1 | ADD(A,B) sum + carry |

## What Is Outdated

- ISE primitives m8_1e (MUX), d3_8e (decoder), bufe (tri-state buffer) — replaced by RedByte MUX4
- Decoder+tristate implementation variant — removed (tri-state not modeled in RedByte)
- NAND, NOR, XNOR operations — removed from scope (reduces to 4 clean operations)

## Modern Workflow

- Starter: `19_lab4-alu-starter-basys3` (pre-places AND3, OR3, XOR3, FA blocks + 4x MUX4)
- Student wires: A/B paths, FA carry chain, opcode select (SW[10:8]) to MUX selects
- Hardware: SW[3:0]=A, SW[7:4]=B, SW[10:8]=S2/S1/S0, LED[3:0]=result, LED[4]=Cout
- Gate: `opcode-coverage` — must test all 4 opcodes in vectors
