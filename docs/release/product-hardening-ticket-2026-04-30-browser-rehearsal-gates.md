# Product Hardening Ticket: Browser Rehearsal Gates Lag Current Product Truth

## Ticket

- Title: Browser rehearsal gates still encode pre-Observe/Compare and pre-Map-Pins-authority assumptions
- Date: 2026-04-30
- Owner: Connor Angiel
- Surface: Project, Verify, Map Pins / Hardware, Export
- Journey segment: production-like browser rehearsal before Vivado handoff
- Mode: IDE preview / Playwright gate scripts
- Environment:
  - Fresh machine / clean browser profile: no
  - OS: Windows lab machine
  - Browser: Playwright Chromium
  - Node: v24.13.0
  - pnpm: 10.24.0
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior: current product UI correctly distinguishes Observe from Compare and moves pin editing to Map Pins / Hardware, but several rehearsal gates still expect older assertion-backed wording or Project-owned pin inputs.
- Expected behavior: browser product-proof gates should rehearse the current product spine: Project -> Design -> Verify Observe -> Expected Outputs -> Compare -> Map Pins / Hardware -> Export, with draft/trusted states named honestly.
- Why this matters: stale proof gates can either fail a good product path or pressure the UI back toward old misleading language.
- Severity: high for proof reliability; not an HDL/Vivado export blocker.

## Reproduction

- Exact repro steps:
  - `pnpm -s ide:gate:export-e2e-contract`
  - `pnpm -s ide:gate:verify-workbench-contract`
  - `pnpm -s ide:gate:verify-reality-contract`
  - `$env:CI='1'; $env:PW_MODE='ci'; pnpm -s e2e:test tests/e2e/ide-mapping-pipeline-coherence.spec.ts --project=chromium`
- Reproducibility: always in this Batch 1 run
- First known version or date: 2026-04-30

## Evidence

- Screenshot / recording: `artifacts/ide-mapping-pipeline-coherence-flow-a-export.png`; `test-results/.../error-context.md` from the timed mapping run
- Console excerpt:
  - `ide:gate:export-e2e-contract` failed with `verify must be assertions-match before export download, got "Checks need review"`
  - `ide:gate:verify-workbench-contract` failed with `rerunning after changing an expected cell must surface a failed compare state, got "OBSERVATION ONLY"`
  - `ide:gate:verify-reality-contract` failed with `status must reflect a completed verify state, got "Observation only"`
  - mapping pipeline Playwright run timed out after reaching Project with "Observation trace is current, but expected-output comparison has not run yet" and no old `ide-project-map-input-sw0` edit path
- Test / gate output:
  - `pnpm -s ide:gate:student-loop-contract` -> pass
  - `pnpm -s ide:gate:seq-sim-contract` -> pass
  - the failing gates above need contract updates
- Additional artifacts: Vivado E1 proof still passed for `b1-mixed` and `b1-counter`, so this is browser proof contract drift rather than build failure.

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md`
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`, `docs/ide/03-verify.md`, `docs/ide/04-export.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/ide/SURFACE_CONFORMANCE.md`, `docs/release/vivado-basys3-certification-matrix.md`

## Acceptance Proof

- Minimum acceptance proof: gates rehearse current UI language and authority without requiring old assertion labels or Project pin inputs.
- Required test / gate command(s):
  - `pnpm -s ide:gate:export-e2e-contract`
  - `pnpm -s ide:gate:verify-workbench-contract`
  - `pnpm -s ide:gate:verify-reality-contract`
  - `pnpm -s e2e:test tests/e2e/ide-mapping-pipeline-coherence.spec.ts --project=chromium`
- Required manual proof: one blank-canvas mixed-gate browser path and one clocked browser path reach Export with draft/trusted state documented.
- Screenshot or recording expectation: Project, Verify, Map Pins, and Export states captured after Compare and before Export.

## Docs Review

- Docs that must be reviewed if behavior changes: Product Contract, Product Manual, IDE System Map, surface specs, Student Release Readiness.
- Docs that must be updated if behavior changes: the same docs plus this ticket's disposition.

## Disposition

- Status: open
- Fix PR / commit: pending
- Notes: Batch 1 intentionally did not rewrite these gates because the app behavior and Vivado outputs are not blocked; this is the recommended next coding batch.

## Attribution

Connor Angiel
