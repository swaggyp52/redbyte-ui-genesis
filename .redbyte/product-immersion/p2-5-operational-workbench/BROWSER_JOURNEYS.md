# P2.5 Browser Journeys

Real-UI Playwright journeys under `packages/rb-e2e/`. All drive the actual UI; the
acceptance journeys (A–E) forbid store injection to bypass the student action
being claimed. Run against `pnpm --filter @redbyte/playground dev` on
`http://localhost:5173`, chromium at `/opt/pw-browsers/chromium`, Node 20.19.0.

## Inherited from P2 (still passing after the Slice-3 density fix)

| Journey | Proves | Viewports |
|---|---|---|
| `vcd-analyzer-journey.mjs` | compact affordance → load → three zones → cursor/radix/pin/search → reload persistence → honest error → no overflow | 1440×900, 1366×768 |
| `sim-provider-journey.mjs` | provider selection + honest provenance; imported disabled until loaded | 1440×900, 1366×768 |
| `crossprobe-journey.mjs` | 5-tier quality legend + bidirectional highlight | 1440×900, 1366×768 |
| `constraint-sets-journey.mjs` | seed/activate/rename/reload/remove | 1440×900, 1366×768 |
| `parity-journey.mjs` | one shell, one `<main>`, all five stages | 1440×900, 1366×768 |
| `migration-journey.mjs` | update-required dialog, byte-identical backup, cancel | 1440×900, 1366×768 |
| `a11y-scale-journey.mjs` | one main landmark, 500-signal bounding, keyboard, reduced-motion, effective 200% | 1440×900, 1366×768 |
| `complex-import-journey.mjs` | 23-step real-UI import spine, no store injection | 1440×900 |

## P2.5 acceptance journeys (to write)

- **Journey A** — Full Adder native lab: start → objective clear → Design edit →
  Compare authored → intentional FAIL → inspect mismatch → navigate to Design/
  source context → repair → return + rerun → PASS → map → trusted export →
  inspect HDL/XDC/testbench → download → reload preserves state. One shell, one
  main, no overflow, no page errors. **1440×900 + 1366×768.** *(first-checkpoint gate)*
- **Journey B** — 2-bit counter: CLK100MHZ as board clock, deterministic
  sequential verify, waveform, Compare, map + clock, package, free-running-clock
  testbench, Browser-E0 boundary.
- **Journey C** — imported multi-file project: import review (inspect/cancel-no-
  mutation/apply-once), one shell/authority, filesets + compile order, cross-probe,
  Imported VCD provider, back to Browser Logic de-emphasis, constraint sets, Board
  + Export, reload survives, no duplicate parser/store/app.
- **Journey D** — five-lab launch + first-action smoke (both viewports, no leaked
  solution).
- **Journey E** — first use / return / destructive-replace cancel+confirm /
  starter / resume-into-last-surface / migration backup / corrupted-state recovery.
