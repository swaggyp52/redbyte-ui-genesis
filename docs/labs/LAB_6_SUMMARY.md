# Lab 6 Summary — Latches and Flip-Flops

**Source PDF:** `labs/fac_jung002_ECE141_Lab6.pdf`

---

## Learning Objectives

- Understand the difference between level-sensitive latches and edge-sensitive flip-flops
- Test D latch, D flip-flop, T flip-flop, and JK flip-flop characteristic behavior
- Simulate clocked storage behavior and observe state retention

## Storage Elements Required

| Element | ISE Primitive | Characteristic |
|---|---|---|
| D Latch | ld | Q+ = G'Q + GD (level-sensitive) |
| D Flip-Flop | fd | Q+ = D (rising edge only) |
| T Flip-Flop | ftc | Q+ = T XOR Q (toggle on rising edge) |
| JK Flip-Flop | fjkc | Q+ = JQ' + K'Q (set/reset/toggle/hold) |

## Current RedByte Gap

RedByte has DFlipFlop. DLatch, TFlipFlop, JKFlipFlop nodes do not exist yet.

**Workaround for current semester:** Run Lab 6 with DFF only. Demonstrate:
- State retention between clock ticks (data stable when clock=0)
- Q changes only on rising clock edge
- D=0 at rising edge → Q=0; D=1 at rising edge → Q=1

**Full implementation requires:** Adding DLatch, TFlipFlop, JKFlipFlop to
`@redbyte/rb-logic-core` node registry. This is the P1 modernization action.

## What Is Outdated

- ISE IBUF on clock path — ISE/ModelSim hardware constraint; not needed in RedByte simulation
- Digilab D2SB-DIO4 board — replaced by Basys3 (or no board for Lab 6)
- ModelSim HDL Bencher editor (Copy to Word tip) — replaced by submission ZIP

## Modern Workflow (DFF-only workaround)

- Starter: `21_lab6-flipflop-starter` (DFF pre-placed)
- Student wires D and clock inputs; runs simulation with clock toggle pattern
- Must show: Q unchanged between edges; Q = D value at rising edge
- Gate: `clock-evidence` — clock-related probe required
- Waveform display (future feature): would show step-function Q transitions
