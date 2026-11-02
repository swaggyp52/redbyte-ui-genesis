# Evidence: flip-flop pin truth and false attachments (2026-11-02)

Branch `claude/redbyte-flipflop-pin-truth`, stacked on PR #88 (`1b9ab05`). Captured in a cloud
container under Node 22, browser E0 only. The CI result on the pushed commits is the authoritative
Node 20.19.0 run.

- `lab8-reset-wires-before-after.png`: the Lab 8 starter in Design at 1600x1000.
  - Before, at 1b9ab05: the eight `sw_reset -> *_ff.RST` wires are dashed stubs into each
    flip-flop's corner, and the flip-flop draws only D and CLK.
  - After, at 379f1ae: DFlipFlop draws RST and EN, and all eight resets end on their RST pins.
    The flip-flops are re-spaced so that no symbol covers another's pins.
- `fulladdercell-routing-before-after.png` and `four-bit-adder-routing-before-after.png`: these are
  router output rendered offline, one colour per net, PR head (1b9ab05) against ede7766.
  - FullAdderCell: `a1 -> o1` no longer crosses a2 on a2's input row.
  - Flat 4-bit adder: no carry or `and1 -> or` wire crosses another part on one of its pin rows.

Measured against 1b9ab05 (runs through another part; any shared line, misplaced dot or dot on a
crossing; wire length; routing time):

| Drawing | Through other parts | Shared lines / dots | Length | Time |
|---|---|---|---|---|
| FullAdderCell | 1 -> 0 | 0 | +1% | 0.19 ms |
| Flat 4-bit adder | 13 -> 0 | 0 | +6% | 2.9 ms |
| Lab 8 | 8 -> 2 | 0 | +7% | 0.26 ms |
| 2-Bit Counter | 1 -> 0 | 0 | +16% | 3.0 ms |

Local validation at 379f1ae (pin fix, before the routing commit):
- Classroom chain 70/71. `design-workbench-v1` failed in the chain while a parallel typecheck
  loaded the machine, then passed standalone on the same build.
- The design gates, the nested-adder and Meridian-preview journeys, and 4,613 unit tests pass.

The routing commit ede7766 is validated as part of the Signal Journey branch, which contains it:
classroom chain 71/71 and 4,615 unit tests at c3561b7.
