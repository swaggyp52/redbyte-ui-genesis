# Classroom Quickstart (Instructor/TA) — Basys3 Lab 4 ALU

## Pre-class ritual (run 10 minutes before lab)

```bash
pnpm -s classroom:rehearse:lab4
```

This runs three checks and prints a single verdict:

| Check       | What it verifies                                                      | If FAIL                                                                                                   |
| ----------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| SMOKE       | Starter scaffold loads, sanity fixture exports, bundle is deterministic | Starter JSON may be corrupt — re-checkout `packages/rb-apps/src/examples/19_lab4-alu-starter-basys3.json` |
| NO-SOLUTION | Starter has no pre-wired solution (gates, connections)                 | Someone committed a solved circuit — reset starter to scaffold-only                                       |
| HW          | FPGA bridge + Basys3 board reachable (non-blocking)                    | Board not connected or bridge not running — simulation-only is still valid                                 |

**FINAL: PASS** means you are go for class. **FINAL: FAIL** means smoke or no-solution failed — do not proceed until fixed.

### Full gate suite (optional, takes longer)

```bash
pnpm -s verify:gates
```

## Required mapping standard
- `EN` → `SW8`
- `A` → `SW5`
- `B` → `SW4`
- `S2` → `SW3`
- `S1` → `SW2`
- `S0` → `SW1`
- `F` → `LD1`

## In-class flow
- Students load the Lab 4 ALU fixture.
- Students validate opcode truth behavior in simulation.
- Students export Basys3 bundle and program board.
- Students demonstrate enable-gated output (`EN=0` forces `F=0`).

## TA spot-check vectors
- `EN=1, A=1, B=1, S=000` => `F=1` (AND)
- `EN=1, A=1, B=1, S=001` => `F=0` (NAND)
- `EN=1, A=0, B=1, S=100` => `F=1` (XOR)
- `EN=1, A=1, B=1, S=111` => `F=1` (CARRY)
- `EN=0, A=1, B=1, S=111` => `F=0` (gated off)

## Gate-level readiness
- `pnpm -s ui:dev-guards-contract-gate`
- `pnpm -s verify:gates`

## If a student export fails
- Confirm `top` is the selected top module.
- Confirm `top.xdc` contains the required SW/LD aliases.
- Re-export from the same fixture without manual pin edits.
