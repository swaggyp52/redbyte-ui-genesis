# Product Hardening Ticket

## Ticket

- Title: Browser rehearsal gates still encode pre-consolidation Verify / Map Pins / Export assumptions
- Date: 2026-04-30
- Owner: Connor Angiel
- Surface: Verify, Hardware / Map Pins, Export, Project browser proof gates
- Journey segment: Design -> Verify -> Map Pins / Hardware -> Export browser rehearsal
- Mode: IDE browser gates / Playwright proof
- Environment:
  - Fresh machine / clean browser profile: yes
  - OS: Windows dev machine
  - Browser: Chromium via Playwright
  - Node: local repo toolchain
  - pnpm: workspace runner
- Obsidian note: n/a
- Linked GitHub issue: n/a

## Problem

- Observed behavior: Priority browser gates still expected legacy compare selectors, observation-only export trust, Project-side pin editing, and older assertion wording.
- Expected behavior: Browser gates must prove the current RedByte student truth: Observe -> Expected outputs -> Compare, Compare PASS for trusted export, draft export still available when structurally buildable, and Map Pins / Hardware as the mapping authority.
- Why this matters: Stale gates produce false failures and false proof. They can block current product truth while still missing real regressions in the current student flow.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Run `pnpm -s ide:gate:export-e2e-contract`
  2. Run `pnpm -s ide:gate:verify-workbench-contract`
  3. Run `pnpm -s ide:gate:verify-reality-contract`
- Reproducibility: always
- First known version or date: 2026-04-30 reconciliation session after truth consolidation commit `3c4c10ee34c816a54112763ae8e59034227d03f2`

## Evidence

- Screenshot / recording: browser proof captured through Playwright and gate reruns in this session
- Console excerpt:
  - `ide:gate:export-e2e-contract` -> `verify must be assertions-match before export download, got "Checks need review"`
  - `ide:gate:verify-workbench-contract` -> `rerunning after changing an expected cell must surface a failed compare state, got "OBSERVATION ONLY"`
  - `ide:gate:verify-reality-contract` -> `status must reflect a completed verify state, got "Observation only"`
- Test / gate output:
  - `pnpm -w exec playwright test tests/e2e/ide-mapping-pipeline-coherence.spec.ts --project chromium`
  - priority and related `ide:gate:*` commands listed in Acceptance Proof
- Additional artifacts: none

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md`
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`, `docs/ide/01-project.md`, `docs/ide/03-verify.md`, `docs/ide/04-export.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/product-hardening-ticket-template.md`

## Old Assumption -> New Truth -> Required Gate Change

| Old gate assumption | New product truth | Required gate change |
|---|---|---|
| Legacy compare selector / observation-only export trust | Verify command deck exposes `Observe only` and `Compare checks`; trusted export requires a current Compare PASS | Update browser gates to use current run-mode selectors and require Compare PASS before trusted export proof |
| Browser proof can treat the first Verify run as the export trust path | Student flow is Observe -> Expected outputs -> Compare, but compare-ready starters may already have saved checks | Split gate coverage: workbench gate proves Observe/save/Compare flow, trusted-export gates use current Compare-ready starter checks |
| Primary student wording can still reference older assertion language | Student UI should prefer `Expected outputs`, `Output checks`, and `Compare checks` | Assert current visible labels and reject stale primary-path wording like `manual assertions` and `Output assertions (optional)` |
| Project owns live pin editing | Map Pins / Hardware is the mapping authority; Project mirrors saved binding read-only | Replace Project input-edit browser proof with Map Pins board interaction, then re-check Project and Export mirrors |
| Browser mapping proof can mutate a text pin field directly | Real student assignment path is signal row -> board region | Update Playwright mapping proof to click a Map Pins row and a Basys3 board region |
| Verify workbench needs older fixed pixel splits | Current layout truth is a real workbench share plus a dominant but not oversized waveform companion | Keep layout share checks, relax stale over-constrained preview thresholds to the current desktop layout truth |

## Acceptance Proof

- Minimum acceptance proof: All priority browser gates and the touched related browser proofs pass against the current product truth without product-model rewrites.
- Required test / gate command(s):
  - `pnpm -s ide:gate:export-e2e-contract`
  - `pnpm -s ide:gate:verify-workbench-contract`
  - `pnpm -s ide:gate:verify-reality-contract`
  - `pnpm -s ide:gate:student-loop-contract`
  - `pnpm -s ide:gate:export-ready-contract`
  - `pnpm -s ide:gate:primary-cta-contract`
  - `pnpm -w exec playwright test tests/e2e/ide-mapping-pipeline-coherence.spec.ts --project chromium`
  - `pnpm -s build:unified`
  - `pnpm verify:gates`
  - `git diff --check`
- Required manual proof: none for this slice
- Screenshot or recording expectation: browser proof should exercise the real student flow, not internal or stale terminology

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/ACTIVE_WORK.md`
  - `AI_STATE.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/ide/03-verify.md`
  - `docs/ide/04-export.md`
- Docs that must be updated if behavior changes:
  - `docs/ACTIVE_WORK.md`
  - `AI_STATE.md`
  - this ticket

## Disposition

- Status: fixed
- Fix PR / commit: local session batch before commit
- Notes: Product code did not need a broad flow rewrite. The reconciliation stayed focused on browser proof gates/specs so they now match the current product truth.

## Attribution

Connor Angiel
