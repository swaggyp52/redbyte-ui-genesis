- Title: Verify workspace legitimacy reset — authoring width + post-run result compression
- Date: 2026-04-22
- Owner: Connor Angiel
- Surface: Verify
- Journey segment: author scenario -> run -> inspect -> fix -> return to Design
- Mode: student-facing Verify surface
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: Chromium via Playwright gate
  - Node: unknown
  - pnpm: unknown
- Obsidian note:
- Linked GitHub issue:

## Problem

- Observed behavior: `pnpm ide:gate:verify-workbench-contract` fails because the Stimulus Workbench owns only `37.0%` of the desktop Verify workspace at `1366x768`, below the contract floor of `38%`. Verify also keeps a substantial post-run proof block above the workspace, so scenario editing and output inspection compete with extra top-stack chrome.
- Expected behavior: Verify should preserve a dominant waveform/result area while still giving scenario authoring a real first-class desktop lane, with pass/fail truth and the next action obvious.
- Why this matters: Students need a usable author -> run -> inspect -> fix loop. If scenario editing is spatially cramped and post-run proof copy consumes workspace attention, Verify becomes a dense internal dashboard instead of a trustworthy instrument.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Run `pnpm ide:gate:verify-workbench-contract` from repo root.
  2. Gate opens IDE, loads starter project, navigates to Verify, runs a verify pass, saves observed outputs, edits an expected cell, reruns into compare-fail.
  3. Gate measures `ide-verify-region-stimulus` and `ide-verify-region-waveform` inside `ide-verify-workspace` at desktop viewport.
- Reproducibility: always
- First known version or date: 2026-04-22 current main baseline

## Evidence

- Screenshot / recording:
- Console excerpt: `verify workbench must own a real share of the workspace at desktop widths (share=0.370)`
- Test / gate output: `pnpm ide:gate:verify-workbench-contract` -> FAIL
- Additional artifacts:
  - `packages/rb-apps/src/apps/ide/ide-root.css`: desktop Verify split currently `grid-template-columns: minmax(360px, 0.78fr) minmax(0, 1.42fr)`
  - `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`: `scenarioWorkbenchExpanded` is parent-owned and forced expanded post-run, so width policy is the limiting factor rather than a hidden collapse bug

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` section 4.4 Verify Surface; section 9.3 Verify
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` sections 7.3 and 9
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`, `docs/ide/SURFACE_CONFORMANCE.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` Phase 3; `docs/release/v1-release-checklist.md`

## Acceptance Proof

- Minimum acceptance proof:
  - Stimulus Workbench owns a legitimate desktop share without demoting waveform dominance.
  - Verify keeps one clear author -> run -> inspect path with pass/fail truth intact.
  - Post-run failure guidance remains direct and Design handoff stays obvious.
- Required test / gate command(s):
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.workspaceLayout.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.layout-workflow.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.panelOwnership.test.tsx`
  - `pnpm ide:gate:verify-workbench-contract`
  - any adjacent Verify/layout gate affected by the change
  - `pnpm build:unified`
- Required manual proof:
  - Verify reviewer can point to the main workspace, the current run state, and the first recovery move without opening secondary chrome.
- Screenshot or recording expectation:
  - Desktop Verify after a compare-fail shows a real two-zone workspace with an obviously readable waveform/result area and a non-token scenario authoring lane.

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/contracts/RedByte_Product_Contract.md`
- Docs that must be updated if behavior changes:
  - `docs/IDE_SYSTEM_MAP.md`
  - `AI_STATE.md`

## Disposition

- Status: in progress
- Fix PR / commit:
- Notes:

## Attribution

Connor Angiel
