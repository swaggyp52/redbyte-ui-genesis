# Performance Budgets

These budgets define the thresholds enforced by CI perf checks. Builds failing to stay within 15% of any budget should be blocked.

| Scenario | Budget | Notes |
| --- | --- | --- |
| Window drag | ≤ 16ms per frame | Measured while dragging active window chrome. |
| Logic core tick | ≤ 50ms max tick @ 2k nodes | Uses rb-logic-core random circuit simulation at 20Hz. |
| Rendering framerate | 60fps target | Assumed on modern hardware for canvas pan/zoom + wire drag. |

## Benchmarks
- **rb-logic-core**: benchmark 2k-node random circuit simulation at 20Hz; fail if >15% above budget.
- **rb-logic-view**: canvas pan/zoom and wire dragging scenarios measured for 60fps parity.
- **Windowing**: drag budget validated during interactive drag traces.

## CI Expectations
- Perf tests run in CI alongside lint/unit/a11y.
- CI fails when measurements exceed budget * 1.15.
- Perf summaries are uploaded as artifacts for inspection.
