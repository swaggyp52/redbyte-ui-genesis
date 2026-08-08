# Product Hardening Ticket — Workbench Geometry Stabilization

## Ticket

- Title: Primary work is clipped by persistent panes and nested scroll owners
- Date: 2026-08-08
- Owner: Connor Angiel
- Surface: Shared shell, Project, Simulate, Build & Export
- Journey segment: Project -> Design -> Simulate -> Board & Constraints -> Build & Export
- Mode: Product System v3 candidate, Studio Light
- Environment:
  - Fresh machine / clean browser profile: no; resumed browser-local Full Adder project
  - OS: Windows
  - Browser: connected Chromium browser
  - Node: 24.15.0 (repository pin is 20.19.0)
  - pnpm: 10.24.0
- Obsidian note: none
- Linked GitHub issue: draft PR #80 review feedback

## Problem

- Observed behavior: At 1440x900 the Simulate workbench permanently reserves a scenario rail and inspector, duplicates run and stale status actions, clips the waveform, overlays scenario actions on scenario cards, and creates nested scroll regions while unused viewport space remains below the workbench. Project and Build & Export use the same fixed-height/nested-scroll pattern, shrinking the circuit preview and truncating source names.
- Expected behavior: The active engineering object owns the remaining viewport. Timeline and Checks may keep a compact scenario explorer; Waveform and Testbench become full-width focus modes; secondary detail is contextual; one page-level scroll owner controls vertical movement; one run/status authority remains; Project and Export size intrinsically and use their available width.
- Why this matters: Students cannot comfortably author, inspect, or repair a scenario when controls cover documents and the primary waveform/source is narrowed by redundant context. The layout reads as a prototype even though the underlying feature exists.
- Severity: P1 interaction/layout defect with P2 visual-system debt.

## Reproduction

- Exact repro steps:
  1. Open the saved Full Adder project at `/?mode=verify&e2e=1&manual=milestone-c1`.
  2. Set the browser inner viewport to 1440x900 at 100% zoom.
  3. Reload so the previous simulation evidence becomes stale.
  4. Inspect the scenario rail, Waveform, inspector, stale banner, and run controls.
  5. Switch to Timeline, Checks, Testbench, Project, and Build & Export.
- Reproducibility: always in the supplied state
- First known version or date: Product System v3 Milestone C review, 2026-08-08

## Evidence

- Screenshot / recording: user-supplied Milestone C review screenshots; bounded after-captures under `.redbyte/product-immersion/milestone-c1-geometry/`
- Console excerpt: none required for the visible geometry defect
- Test / gate output: focused geometry assertions and final bounded validation recorded at closeout
- Additional artifacts: final viewport geometry JSON beside the captures

## Truth Sources

- Target truth clause(s): Product Contract 4.1, 4.4, 6.2, 9.1, 9.3, 9.8
- Current truth doc(s): Product Manual 6.1-6.4, 7.1, 7.3, 7.5, 9
- Gap truth reference(s): Gap Audit 4.3 and Phase 7
- System map / ownership reference(s): IDE System Map surface and runtime authority maps
- QA / rehearsal clause(s): manual-assignment QA phases 1, 3, and 5

## Acceptance Proof

- Minimum acceptance proof: At both 1440x900 and 1366x768, no root horizontal overflow; no scenario action overlays; eight Full Adder events fit without horizontal scrolling; Waveform and Testbench do not reserve the scenario explorer or inspector; only one direct run/rerun action is visible; fail/stale/pass use correct semantic tones; Project and Export expose their primary work object without fixed-height child clipping.
- Required test / gate command(s): focused changed tests, `corepack pnpm -s typecheck`, `corepack pnpm -s css:audit:ide`, `corepack pnpm -s build:unified`, `git diff --check`
- Required manual proof: one Project -> Simulate Timeline -> Waveform -> Testbench -> Build & Export walkthrough
- Screenshot or recording expectation: exact inner viewport captures at 1440x900 and 1366x768, 100% zoom

## Docs Review

- Docs that must be reviewed if behavior changes: `docs/ACTIVE_WORK.md`, `docs/manuals/RedByte_Product_Manual.md`, `docs/ide/SURFACE_CONFORMANCE.md`
- Docs that must be updated if behavior changes: `AI_STATE.md`, `docs/ACTIVE_WORK.md`, this ticket

## Disposition

- Status: fixed
- Fix PR / commit: draft PR #80 / `feat(workbench): stabilize workspace geometry`
- Notes: Exact 1366x768 and 1440x900 Browser-E0 review confirms no root horizontal overflow, eight events without horizontal scrolling, contextual Waveform/Testbench focus, one direct rerun action, complete Export filenames, and no scenario-action obstruction. This slice changes composition and presentation only. Simulation, scenario, mapping, export-generation, and proof-tier semantics remain authoritative.

## Attribution

Connor Angiel
