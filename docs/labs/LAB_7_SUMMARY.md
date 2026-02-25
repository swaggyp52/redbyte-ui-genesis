# Lab 7 Summary — Synchronous Counter

**Source PDF:** `labs/fac_jung002_ECE141_Lab7.pdf`

---

## Learning Objectives

- Design a 4-bit synchronous binary counter from D flip-flops and combinational logic
- Implement Load, CE (Count Enable), CEO (Count Enable Output), reset control signals
- Create a BCD counter (0-9) as a variant
- Connect counter to seven-segment display

## Counter Specification

| reset | Load | CE | Action |
|---|---|---|---|
| 1 | X | X | Async clear (Q=0000) |
| 0 | 1 | X | Sync load (Q=Data) |
| 0 | 0 | 0 | Hold |
| 0 | 0 | 1 | Count (increment) |

Count sequence: 0000 → 0001 → ... → 1111 → 0000.
BCD variant: 0000 → ... → 1001 → 0000 (detect 1001, load 0).
CEO = high when Q=1111 and CE=1.

## What Is Outdated

- ISE bus wiring (Q(3:0) bus + bus taps) — ISE schematic-specific; not needed in RedByte
- Digilab FPGA board manual clock via push button with IBUF — Basys3 button replaces this
- Manual pin assignment table in ISE PACE — replaced by RedByte-generated XDC

## Modern Workflow

- Starter: `22_lab7-sync-counter-starter-basys3` (4x DFF pre-placed)
- Student derives D equations from state table; wires AND/OR combinational logic
- BCD: adds NAND2 gate detecting Q3=1, Q0=1 → triggers load of 0000
- Simulation: verify count sequence and control signal overrides over 16+ ticks
- Gate: `sequence-proof` — must show at least one full count window
- Hardware: EN<-SW8, CLK<-BTNC, RST<-SW6, Q[3:0]->LED[3:0]
- SSD display: optional — starter may connect to SSD for digit display
