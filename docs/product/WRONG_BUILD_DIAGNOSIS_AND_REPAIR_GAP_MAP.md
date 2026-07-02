# Wrong-Build Diagnosis and Repair Gap Map

Date: 2026-07-02

## Product Complaint

Students can now build a scratch design and repair wrong expected outputs, but a different failure remains painful: the expected outputs can be correct while the circuit is wrong. In that case RedByte must help the student move from a failed Compare result to the exact circuit area that probably caused the mismatch, repair the design, rerun Compare, and only then trust Export.

## Current Baseline

- Round 14A production is live at `4623a7aebd0bd43afb63d5cfb4f25b104f528098`.
- Verify shows a first-mismatch repair strip with failed case, signal, expected value, observed value, input vector, Edit expected, Use observed, Inspect Design, and Rerun Compare.
- Design can accept Verify debug tick context and can show stale replay after the circuit changes.
- The existing repair path is stronger for wrong expected-output values than for wrong circuit builds.

## Gap 1: Wrong Gate

Scenario: the student intends `A XOR B`, places `OR`, authors correct XOR expected outputs, and Compare fails for `A=1, B=1`.

Current risk: the failure can look like a testbench problem because the fastest visible repair is `Use observed`.

Required behavior:
- Verify must explicitly separate "expected/testbench repair" from "circuit/design repair".
- If the student believes the expected value is correct, the UI must point them toward the gate or wire driving the failed output.
- Inspect Design must preserve expected/observed/input-vector context.

## Gap 2: Miswire

Scenario: the student uses the right gate but connects the wrong switch, leaves one gate input driven by the wrong net, or connects the output LED to the wrong signal.

Required behavior:
- Design should focus the failed output when RedByte can resolve it.
- Design should show the direct driver or disconnected state when it can trace that from the graph.
- RedByte must not claim formal root cause; it should say what is directly connected and what to inspect next.

## Gap 3: Disconnected Output

Scenario: Verify expects an output, but the output node is not driven.

Required behavior:
- Design should identify the failed output as having no direct driver when that is true.
- The repair copy should send the student to connect a driver before rerunning Compare.

## Gap 4: Stale Verify After Design Repair

Scenario: the student fixes the circuit after a failed Compare.

Required behavior:
- Verify evidence must become stale after the design mutation.
- The next visible action must be Rerun Compare.
- Export must not present stale Verify evidence as trusted current evidence.

## Round 14B Slice Boundary

This slice proves a browser-E0 wrong-gate repair path:

1. Build a scratch circuit that should be XOR but is wired as OR.
2. Author correct XOR expected outputs.
3. Compare and get a FAIL.
4. Use Inspect Design.
5. See the failed output, expected/observed/input vector, and direct driver facts.
6. Repair OR to XOR with the Design UI.
7. Return to Verify, see stale evidence, rerun Compare, get PASS.
8. Open Export and keep the E0 trust boundary visible.

This does not prove a formal debugger, arbitrary large-design root-cause analysis, Vivado E1, bitstream E2, board observation E3, instructor grading, LMS, auth, or production behavior for Round 14B.
