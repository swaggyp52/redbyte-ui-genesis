# Milestone C browser evidence

This folder records one bounded Browser-E0 walkthrough of the Product System v3
Scenario + Testbench Composer on `product/redbyte-workbench-v3`, starting from
`58209450ea49a6f7bfbc2e5d8aee78b373faf29c`.

## Capture context

- Product route: local Vite app at `http://localhost:5173/`
- Project: Full Adder with the existing `HalfAdder` hierarchy
- Primary scenario: `Full Adder Exhaustive`
- Scenario state: 8 ordered events, 16 optional checks, combinational ticks t0-t7
- Application theme: Studio Light
- Canvas theme: Dark canvas (independently persisted; Design is not pictured here)
- Primary viewport: `window.innerWidth=1440`, `window.innerHeight=900`
- Compact viewport: `window.innerWidth=1366`, `window.innerHeight=768`
- Browser zoom: 100% (unchanged); the browser API reported DPR `0.9` under Windows display scaling
- Capture raster: 1600x1000 for the primary viewport and 1518x853 for the compact viewport
- Evidence tier: Browser-E0 only

## Captures

1. `01-scenario-timeline-1440x900.png` — the selected eight-event scenario,
   horizontal event rail, direct time/input editing, and event inspector.
2. `02-check-authoring-1440x900.png` — the Checks lens with two optional output
   checks for the selected Full Adder event.
3. `03-passing-waveform-1440x900.png` — real circuit replay with 8 run cases,
   16 passing checks, 0 failures, and 100% authored-case coverage.
4. `04-generated-testbench-1440x900.png` — the read-only generated
   `testbench.vhd` projection shown inside Simulate.
5. `05-project-simulation-sources-1440x900.png` — Project Center showing the
   active scenario and generated simulation source in the project explorer.
6. `06-export-testbench-source-1440x900.png` — Build & Export previewing the
   same packaged `testbench.vhd` with current, verified-pass provenance.
7. `07-failing-check-1440x900.png` — an intentionally wrong `SUM` expectation
   at t7, with expected `0`, observed `1`, input vector, failure count, and
   separate expectation-versus-design repair actions.
8. `08-simulate-compact-1366x768.png` — the same named scenario after reload,
   retained as 8 events / 16 checks, with prior evidence truthfully marked stale,
   a one-row command bar, and no root horizontal overflow.

## Exercised workflow

The walkthrough duplicated a persisted eight-row Full Adder document, renamed
it `Full Adder Exhaustive`, inspected all eight input combinations, authored the
correct `SUM` and `CARRY` checks for every event, and ran the actual current
circuit. The result was 16/16 passing checks. One `SUM` expectation was then
changed from `1` to `0`; the next run failed at case 8 / t7 and displayed the
expected value, observed value, and `A=1, B=1, Cin=1` stimulus. `Use observed
cell` repaired only that check, a rerun returned to 16/16 passing, and Build &
Export reported the generated testbench as verified current. Browser reload
preserved the scenario, events, and checks while intentionally invalidating the
prior in-memory evidence to `Stale`.

## Proof boundary

These captures and interactions prove only the browser behaviors described
above. They do not prove Vivado parsing, compilation, synthesis,
implementation, timing closure, bitstream generation, Basys3 programming,
physical I/O behavior, deployment, or classroom reliability.
