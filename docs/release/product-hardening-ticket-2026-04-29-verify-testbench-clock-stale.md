# Product Hardening Ticket: Verify Testbench Clocking And Stale Evidence

- Title: Verify testbench clocking and stale evidence loop
- Date: 2026-04-29
- Owner: Connor Angiel
- Surface: Verify
- Journey segment: Design -> Verify -> Export
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

- Observed behavior: after inserting a board clock pattern and pressing Update Run, Verify could immediately ask for Update Run again. Sequential clock stimulus was also presented as a small helper instead of first-class testbench state.
- Expected behavior: clock helper stimulus should become current evidence after the run, and the testbench editor should show the clock/timing pattern before the run.
- Why this matters: Export trust depends on current assertion-backed Verify evidence, and students need to see clock edges before expecting register outputs to change.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Open a sequential design with a board/system clock input.
  2. Open Verify.
  3. Insert a board clock pattern.
  4. Run Compare checks / Update Run.
  5. Observe whether Verify settles current or immediately asks for another update.
- Reproducibility: intermittent/manual report
- First known version or date: 2026-04-29 manual takeover session

## Evidence

- Screenshot / recording: not captured
- Console excerpt: not captured
- Test / gate output: see `AI_STATE.md` change log for focused regression tests
- Additional artifacts: `verifyProjectHash.stale-loop.test.ts`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` Verify and Export promises
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`, `docs/ide/03-verify.md`, `docs/ide/04-export.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` Verify trust / sequential clock language
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/product-hardening-ticket-template.md`

## Acceptance Proof

- Minimum acceptance proof: clock helper vectors no longer cause phantom stale state; sequential Verify shows a clock/timing panel and previews rising/falling edges before a run; trusted Export can consume a current Compare PASS.
- Required test / gate command(s): focused Verify hash/UI tests, workflow authority tests, Export trust tests, `pnpm -s build:unified`, `pnpm verify:gates`
- Required manual proof: open a sequential design, insert clock pattern, run Compare, confirm Verify does not immediately stale without another edit
- Screenshot or recording expectation: optional for this code slice

## Docs Review

- Docs that must be reviewed if behavior changes: `docs/ide/03-verify.md`, `docs/ide/04-export.md`, `docs/IDE_SYSTEM_MAP.md`, `docs/ACTIVE_WORK.md`, `AI_STATE.md`
- Docs that must be updated if behavior changes: same as above

## Disposition

- Status: fixed
- Fix PR / commit: pending
- Notes: broad `vitest run verify` remains a noisy harness signal due unrelated stopship and jsdom cleanup issues.

## Attribution

Connor Angiel
