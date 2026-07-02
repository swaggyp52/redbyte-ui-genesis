---
doc_status: current
last_validated: 2026-07-02
owner: Connor Angiel
used_by_claude: true
role: product reality sprint record for student-usable Vivado-grade builder work
---

# RedByte Product Reality Sprint

## Purpose

This sprint responds to the product complaint that RedByte is stable but still has too much friction for the original promise: students should build digital logic visually, write or repair a testbench, understand failures, map pins, and export a Vivado-ready package without needing to become Vivado or VHDL experts first.

This is not a broad release claim. It is a product-reality checkpoint plus one implemented browser-E0 slice.

## Baseline

- Base branch at sprint start: `main`.
- Base local/remote production identity checked before this work: `9826a77a77c008bc8f5a963051300ac57bc58a5c`.
- Round 14B wrong-build repair was already pushed/deployed before this sprint, even though some current-truth docs still described it as local-only.
- Current browser-E0 strengths include Project start paths, blank authoring depth, scratch testbench repair, wrong direct-driver repair, Hardware mapping, Export E0 trust boundaries, and Import recovery.
- Current open reality: RedByte still does not prove true long-session stability, Vivado E1 for new flows, bitstream E2, board observation E3, broad stale-test cleanup, hosted instructor workflows, or a complete arbitrary-circuit debugger.

## Hardening Ticket

- Title: Complex failed Compare needs upstream signal trace, not only direct-driver facts
- Date: 2026-07-02
- Surface: Verify -> Design
- Journey segment: scratch build -> authored checks -> Compare FAIL -> inspect design
- Environment: Windows local worktree, Node `20.19.0`, pnpm `10.24.0`, browser gate at `1366x768` and `1440x900`
- Observed behavior: Round 14B explains the direct driver of a failed output, but a non-trivial build still leaves the student guessing which upstream gate or input path to inspect next.
- Expected behavior: Design should show a compact upstream signal trace for the failed output, identify the direct driver, list upstream sources, flag open inputs when present, and let the student focus upstream nodes.
- Severity: High, because wrong builds are the normal student path, not an edge case.

## Slice Decision

Chosen slice: **A. Complex Build Debugging and Signal Trace UX**.

Reason: This directly attacks the next failure after Round 14B. Round 14B helped with a one-gate wrong build; students also need help when a failed output is fed by a multi-stage path such as a full-adder-style sum chain. Testbench simplification, scratch wiring polish, Vivado E1 restoration, and instructor review packaging remain important, but they do not remove the immediate "I know the expected value is right, but I cannot find the bad circuit path" blocker.

## Implemented Behavior

- Added a pure signal-trace model in `pathTrace.ts`.
- Added a Design debug trace panel under the existing failed-Compare banner.
- The panel shows:
  - failed output
  - direct driver
  - upstream nodes by depth
  - upstream labels feeding each node
  - open input ports when the graph can detect them
  - Focus buttons for each trace node
- Added focused browser gate `ide:gate:complex-build-signal-trace-debugging`.
- The gate builds a two-stage full-adder-style sum path from scratch, intentionally uses `OR` where the second-stage sum should be `XOR`, authors correct expected outputs, gets Compare FAIL, opens Design, and proves the trace panel includes `SUM_OUT`, `wrong_or_should_be_xor`, `XOR_AB`, `CIN`, `A`, and `B`.

## Proof Boundary

This proves browser-E0 debugging affordance only.

It does not prove:

- formal root-cause localization
- arbitrary large-circuit debugging completeness
- simulator semantic changes
- generated VHDL/XDC/testbench/Tcl/ZIP changes
- Vivado E1
- bitstream E2
- board observation E3
- instructor grading or LMS workflows
- production behavior for this local slice

## Validation Commands

Required closeout commands for this sprint:

- `corepack pnpm --filter @redbyte/playground build`
- `corepack pnpm exec vitest run packages/rb-apps/src/apps/ide/__tests__/pathTrace.debugTrace.test.ts`
- `corepack pnpm -s ide:gate:complex-build-signal-trace-debugging`
- existing wrong-build/testbench/student/export focused gates as regression proof
- `corepack pnpm -s rb:doc:validate`
- `corepack pnpm -s rb:encoding:check`
- `git diff --check`

## Next Product Slice Recommendation

If this slice is green and committed locally, the next product slice should be **B. Testbench Editor Simplification**, specifically reducing friction when a student authors wrong expected outputs and then tries to correct them after experimenting. The next board-gated proof remains Vivado/Basys3 E1/E2/E3 restoration and must not be claimed from browser evidence.

## Attribution

Connor Angiel
