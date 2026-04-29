# Product Hardening Ticket: Verify Testbench Authoring Is Split And Clocking Is Non-Obvious

- Title: Verify testbench authoring is split, cramped, and non-obvious for clocked designs
- Date: 2026-04-29
- Owner: Connor Angiel
- Surface: Verify
- Journey segment: author testbench -> run compare -> inspect waveform -> fix -> rerun
- Mode: Sequential verification / Compare checks
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: not captured
  - Node: workspace default
  - pnpm: workspace default
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior: the old Verify flow split stimulus inputs, output checks, and clock helpers across nested drawers and detached helper strips. Clock authoring was cramped, expected outputs were hidden behind toggles, and board-clock guidance was easy to miss.
- Expected behavior: one visible testbench editor with direct clock-lane editing, always-visible expected output checks, inline sequential guidance, and enough authoring width to build and rerun a real sequential testbench without hunting for controls.
- Why this matters: Export trust depends on a current Compare PASS with saved checks, and students need to see clock edges and checks in the same place before expecting register outputs to change.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Open a sequential design with a board/system clock input.
  2. Open Verify.
  3. Try to author a sequential testbench with a clock plus expected outputs.
  4. Notice that clock editing, manual entry, and output checks are split across collapsed controls.
  5. Run Compare and return to edit the testbench again.
- Reproducibility: always
- First known version or date: 2026-04-29 manual takeover session

## Evidence

- Screenshot / recording: not captured
- Console excerpt: not captured
- Test / gate output: see `AI_STATE.md` change log for focused Verify UI regression tests
- Additional artifacts: `verifySurface.authoring.test.tsx`, `verifySurface.boardClockSemantics.test.tsx`, `verifySurface.workspaceLayout.test.tsx`, `verifySurface.workstation.test.tsx`, `ScenarioBuilderPanel.progressiveDisclosure.test.tsx`, `StimulusCanvas.rowAuthoringClarity.test.tsx`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` Verify and Export promises
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`, `docs/ide/03-verify.md`, `docs/ide/04-export.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` Verify trust / sequential clock language
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/product-hardening-ticket-template.md`

## Acceptance Proof

- Minimum acceptance proof: sequential Verify shows one unified testbench editor with always-visible expected outputs, a highlighted clock lane with inline pattern actions, visible no-rising-edge guidance, and a run summary that updates immediately from grid edits.
- Required test / gate command(s): focused Verify UI interaction suites plus `pnpm -s build:unified`
- Required manual proof: open a sequential design, identify the clock lane immediately, append a pulse without opening hidden drawers, edit expected outputs in the same grid, and rerun Compare
- Screenshot or recording expectation: optional for this code slice

## Docs Review

- Docs that must be reviewed if behavior changes: `docs/ide/03-verify.md`, `docs/manuals/RedByte_Product_Manual.md`, `docs/IDE_SYSTEM_MAP.md`, `AI_STATE.md`
- Docs that must be updated if behavior changes: same as above

## Disposition

- Status: fixed
- Fix PR / commit: pending
- Notes: this slice keeps the existing verification semantics. Verify rows are authored ticks, not whole cycles, and the inline clock lane now makes that model explicit.

## Attribution

Connor Angiel
