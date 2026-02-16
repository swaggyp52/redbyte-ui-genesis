# Lab 4 — ALU with Opcode Control (Basys3-first)

## Objective

Build a 1-bit opcode-controlled ALU with enable gating and verify it in simulation and on Basys3.

## Required Basys3 Mapping

- `EN` → `SW8`
- `A` → `SW5`
- `B` → `SW4`
- `S2` → `SW3`
- `S1` → `SW2`
- `S0` → `SW1`
- `F` → `LD1`

## Opcode Table

- `000` → `AND`
- `001` → `NAND`
- `010` → `OR`
- `011` → `NOR`
- `100` → `XOR`
- `101` → `XNOR`
- `110` → `SUM` (`A ⊕ B`)
- `111` → `CARRY` (`A ∧ B`)

## Enable Rule

- If `EN=0`, output `F=0` regardless of opcode.
- If `EN=1`, `F` follows the selected opcode operation.

## Build Checklist

- Implement all 8 operations.
- Implement 3-bit opcode decode/select.
- Gate final output with `EN`.

## Simulation Checklist

- Run at least one vector per opcode.
- Validate `EN=0` force-off behavior for at least two opcode values.

## Hardware Checklist

- Apply Basys3 mapping exactly as listed above.
- Confirm `LD1` behavior for at least 4 opcode cases with `EN=1`.
- Confirm `LD1=0` for the same cases with `EN=0`.

## Submission

- Export Basys3 bundle (`top.v`, `top.xdc`, `README.txt`).
- Include simulation evidence with opcode coverage and enable-gating proof.
