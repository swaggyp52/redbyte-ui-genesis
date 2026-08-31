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

## P2.5 slice proofs (landed this checkpoint)

| Journey | Proves | Viewports |
|---|---|---|
| `shell-status-authority-journey.mjs` | Slice 1 — footer is support-context only; the stage-nav is the single per-stage status authority; no overflow | 1440×900, 1366×768 |
| `project-landing-proof.mjs` | Slice 2 — one dominant primary over a subordinate alternatives cluster; no restating summary; no overflow | 1440×900, 1366×768 |
| `compare-verdict-journey.mjs` | Slice 3 — the Compare repair loop shows a real verdict: PASS (pass-hero) → break gate → FAIL → undo → PASS | 1440×900, 1366×768 |

## P2.5 acceptance journeys

- **Journey A** — Full Adder native lab. **NOT YET PROVEN as a student journey.**
  What is earned so far, by `compare-verdict-journey.mjs`, is narrower than a
  Journey-A claim: **the Compare verdict transition** — a run presents PASS
  (visible pass-hero), a deliberately changed design presents FAIL (visible
  "Compare failed"), and undo + rerun returns to PASS — one shell / one main, no
  overflow, no page errors, at 1440×900 and 1366×768. That script also drives the
  runtime store directly (`loadExample`, `autoSuggestMapping`, a store gate-lookup
  to choose the delete target, and a force-click), which the acceptance contract
  forbids; it stands as a **focused verdict proof**, not Journey A. Still UNPROVEN
  through the UI: first-use → Start a Lab → Lab 3 selection; authoring a check; a
  runnable wrong-logic edit; concrete case/tick/signal/expected/observed mismatch
  evidence; Trace-in-Design; scenario preservation across the repair loop;
  stale-then-current proof; Board mapping; trusted export; HDL/XDC/testbench
  inspection; browser download; reload/resume. Those are the next increment.
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
