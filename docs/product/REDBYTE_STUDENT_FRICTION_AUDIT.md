---
doc_status: current
last_validated: 2026-07-02
owner: Connor Angiel
used_by_claude: true
role: ranked student friction audit for RedByte product reality sprint
---

# RedByte Student Friction Audit

## Scope

This audit ranks the current student friction after the deployed Round 14B baseline and the local Product Reality Sprint slice. It uses current source/docs, current focused gate coverage, and browser-E0 proof at `1366x768` and `1440x900`. It is not a substitute for a 60-minute live student session, Vivado, or board proof.

## Verdict

RedByte is materially closer to the original dream than it was before Rounds 14A and 14B, but it still feels more like a stabilized engineering workbench than a low-friction student product. The highest remaining friction is not "can the code simulate"; it is whether a student can recover confidently after building the wrong thing.

## Ranked Issues

| Rank | Issue | Severity | Current evidence | Recommended slice |
|---:|---|---|---|---|
| 1 | Wrong-build debugging is still shallow for multi-stage circuits. | High | Round 14B proved direct-driver facts; this sprint adds upstream trace proof for a two-stage failed sum path. | Continue Option A with disconnected/miswire cases after this slice. |
| 2 | Testbench editing still has too many modes and too much hidden state for a novice. | High | Round 14A made wrong expected-output repair possible, but the editor remains dense and students can still confuse Observe, saved checks, stale checks, and Compare. | Option B. |
| 3 | Scratch wiring still requires too much hunting for common continuation actions. | High | Blank adder authoring depth is proven, but complex manual builds still depend on palette/tool-window fluency. | Option C. |
| 4 | Export is browser-E0 trustworthy but not currently Vivado-grade for new claims. | High | Export trust gates prove package and wording; new slices are not Vivado E1 proven. | Option D, board/tool gated. |
| 5 | Instructor review/submission remains underspecified for real class operations. | Medium | Manual describes submission/review concepts, but hosted grading/LMS/auth remain intentionally deferred. | Option E after student flow. |
| 6 | Production docs can drift behind release reality. | Medium | Current cockpit docs still said Round 14B was local-only even after production identity was verified at `9826a77`. | Keep release-reality updates in every slice. |
| 7 | Long-session reliability remains unproven. | Medium | Prior Round 7/R7R2 60-minute work improved confidence, but true 60-minute/3-hour session proof remains a separate open item. | Stability pass after sync. |
| 8 | Accessibility at headed 125 percent remains unproven for this slice. | Medium | Existing viewport gates are strong but not a substitute for a headed 125 percent audit. | Dedicated accessibility pass. |

## Surface Notes

### Project

Project is no longer the main product blocker. Start paths, Build Fresh guards, loaded Project actions, and starter access are covered by focused gates. Remaining friction is more about making the chosen path feel like a course assignment rather than a tool dashboard.

### Design

Design has the right foundations: visible graph, direct edit controls, labels, wiring, undo, and live issues. The remaining student pain is debugging scale. A direct driver is useful, but students need traceable upstream logic, open-input clues, and quick focus actions while the failed Verify case is still fresh.

### Verify

Verify is powerful but cognitively heavy. The Observe/Compare distinction is honest and necessary, but the UI still asks students to understand run mode, saved checks, expected cells, stale evidence, waveform proof, mismatch repair, and design repair at once. The next simplification should keep the truth model but reduce the number of visible concepts during first failure repair.

### Hardware

Hardware mapping is currently stronger than earlier audits. The board/table chain and E0 boundary are guarded. Remaining risk is real-board proof, not browser UI proof.

### Export

Export is honest about E0 versus Vivado/board proof and has strong artifact visibility. The product dream still requires Vivado E1 to be fresh for representative scratch and sequential exports; browser gates cannot answer that.

### Import

Import is properly scoped as a recovery utility. It should not pull priority away from the student Design -> Verify -> Hardware -> Export path unless a real course workflow needs it.

## Implemented This Sprint

The first issue received a narrow implementation:

- `buildDesignDebugSignalTrace()` computes a bounded fan-in path from the failed output.
- Design renders `ide-design-debug-trace-panel` during failed-Compare handoff.
- `ide:gate:complex-build-signal-trace-debugging` proves the path at `1366x768` and `1440x900`.

## Still Not Proven

- True 60-minute / 3-hour student-session stability.
- Vivado E1 for this new trace-backed workflow.
- Bitstream E2.
- Board observation E3.
- Full disconnected-output and wrong-wire debugging coverage.
- Broad stale-test sweep.
- Headed 125 percent accessibility.
- Production behavior for the local Product Reality Sprint slice.

## Attribution

Connor Angiel
