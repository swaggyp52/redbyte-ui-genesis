# Classroom Quickstart (Student) — Basys3 Lab 4 ALU

## 1) Load the Lab 4 ALU starter
- Open RedByte Logic Playground.
- Load the classroom fixture `golden-basys3-alu` (Lab 4 ALU Basys3).

## 2) Verify the required pin map
- `EN` → `SW8`
- `A` → `SW5`
- `B` → `SW4`
- `S2` → `SW3`
- `S1` → `SW2`
- `S0` → `SW1`
- `F` → `LD1`

## 3) Test opcode behavior in simulation
- Set `EN=1`.
- Try opcodes `000..111` and confirm expected `F`.
- Set `EN=0` and confirm `F=0` for multiple opcode values.

## 4) Export hardware bundle
- Export Basys3 bundle.
- Confirm bundle includes `top.v`, `top.xdc`, and `README.txt`.

## 5) Program board and verify
- Program Basys3 with generated bitstream.
- Toggle `SW8/SW5/SW4/SW3/SW2/SW1` and verify `LD1` output.

## Troubleshooting
- If output is wrong for all opcodes, re-check switch mapping first.
- If behavior is right in sim but wrong on board, re-check `top.xdc` pin map.
- If `LD1` never lights, verify `EN` is set to `1`.
