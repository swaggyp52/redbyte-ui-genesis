# Evidence: Signal Journey on the hierarchical adder (2026-11-02)

Branch `claude/redbyte-signal-journey`, stacked on `claude/redbyte-flipflop-pin-truth`. Captured
in a cloud container under Node 22, browser E0 only. There is no Vivado, programming or board
observation. The CI result on the pushed commits is the authoritative Node 20.19.0 run.

Each image shows the same steps on two builds at 1440x900. On the left is PR #88's head
(1b9ab05); on the right is c3561b7. The steps:
1. Load `four-bit-adder-hierarchical`, enable evaluation steps and Run.
2. Select CARRY at t3 (15 + 1) and Follow signal.
3. Open Board boundary.
4. In Design, delete FullAdderCell's `a2 -> o1` wire and Run.
5. Select CARRY's failing case and follow its driver.

What each image shows:
- `1-carry-t3-before-after.png`: the evidence line is new. It says the recording is current for
  the design being edited, the value of CARRY in this case, and that 6 checks on CARRY all match.
  The capture (c3561b7) reads "0 -> 1 at t3"; after the independent review a combinational
  recording says "1 in case 4 (t3); cases are independent" instead, as its ticks are separate cases.
- `2-board-before-after.png`: the board lens sets the recorded LD4 · W18 against the live mapping.
- `3-failing-result-before-after.png`: Simulate's selected failing result now offers Trace cause.
- `4-cause-o1-before-after.png`: the cause at o1 in u_fa3.
  - Before: "A complete input/output relationship is not recorded here", and Input B and Input b
    were both "unrecorded".
  - After: "0 OR 0 = 0", Input B reads 0 and is marked not connected, and the panel states "Input
    B is not connected; the simulator reads an unconnected b as 0."

`scripts/gates/ide-signal-journey-acceptance.mjs` runs the same demonstration through visible
controls and asserts it. It goes on to undo the deletion and run again, after which the new
recording is current and the failing one historical.

Local validation at c3561b7:
- Classroom chain 71/71, including the golden exports and determinism.
- `design-workbench-v1`, `design-wire-interaction-contract`, `complex-build-signal-trace-debugging`.
- Signal Journey hierarchy, counter, first-use and acceptance proofs.
- The nested-adder, Meridian-preview and recorded-investigation journeys.
- Unit tests: 4,615 passed.

Scope: this is a qualified vertical slice on the hierarchical 4-bit adder. The counter and first-use
proofs pass, but other circuit classes are not established by this evidence.
