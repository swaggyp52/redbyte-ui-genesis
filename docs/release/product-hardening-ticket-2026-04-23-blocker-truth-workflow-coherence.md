# Product Hardening Ticket: Blocker Truth + Workflow Coherence Reset

## Ticket

- Title: Blocker truth and workflow coherence reset
- Date: 2026-04-23
- Owner: Connor Angiel
- Surface: Project / Verify / Hardware / Export / Shell
- Journey segment: Design -> Verify -> Map Pins -> Export
- Mode: Student IDE
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: Chromium target via local screenshots / gates
  - Node: local repo environment
  - pnpm: local repo environment
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - Export and Hardware can show `BLOCKED` / `Export Blocked` / `Build the current bundle first` while also showing mapping complete, checks match, no blocking items, and generated artifacts.
  - Missing bundle, stale bundle, failed export attempt, and true prerequisite blockers are conflated.
  - The left rail labels wrap and crop inside the fixed 72px rail, making the workflow spine look broken.
- Expected behavior:
  - `Blocked` is reserved for real prerequisite failures.
  - Missing bundle means the project is ready to build when prerequisites are satisfied.
  - Stale bundle means a previous bundle exists and should be rebuilt, not that the workflow is impossible.
  - Project, Hardware, Export, status bar, and shell rail agree on the same readiness truth.
- Why this matters:
  - Students cannot trust the workflow if one panel says complete while another says blocked.
  - Pin mapping and export are classroom-critical; contradictory blocker state wastes lab time.
- Severity: high / classroom blocker

## Audit Answers

1. Canonical workflow readiness today is split between `projectHealth.ts` and `projectWorkflowAuthority.ts`. `ProjectWorkflowAuthority` is the best shared candidate because `IdeApp.tsx` already passes it to Project, Hardware, and Export.
2. `deriveProjectHealth` derives `blockingIssues`; `deriveHardwareExportFailureTruth` derives Hardware/Export handoff blocked/advisory/ready state; Export also derives `downloadReady`, `exportBlocked`, and visible titles from that handoff truth.
3. Export readiness is derived from `ExportSurface` view model diagnostics, `resolvedWorkflowAuthority.designReady`, `exportPackageCurrent`, `hasSuccessfulExportBundle`, `exportCurrent`, and `deriveHardwareExportFailureTruth`.
4. Verify completion is canonicalized by `deriveProjectVerifyState`, then refined by `deriveProjectWorkflowAuthority` using current verify hashes / ledger entries.
5. Mapping completion comes from `effectiveReadiness.hasIoMapping` in `IdeApp.tsx`, export-required pin gaps from `exportViewModel.pinTable`, and Hardware's local `mappingReady` for board-specific checks.
6. Project, Hardware, and Export still reinterpret readiness locally. Hardware computes `showBlockedHero`; Export computes `downloadReady`, titles, and "blocked" copy; Project still reads `health.blockingIssues` for hero tone and blocker count.
7. The UI can show "blocking items 0" and still say "blocked" because `deriveHardwareExportFailureTruth` marks `export-missing` and `export-stale` as `severity: 'blocked'` even when `ProjectHealth.blockingIssues` is empty.
8. Current distinction:
   - missing bundle: no `lastExport.status === 'ok'`, currently treated as blocked handoff.
   - stale bundle: successful export exists but `exportCurrent` is false, currently treated as blocked handoff.
   - blocked export: `lastExport.status === 'blocked'` or current export diagnostics prevent build.
   - ready to build: not explicit enough; currently hidden behind "blocked" missing-bundle language.
   - ready to download: `exportPackageCurrent` and current bundle hash match.
9. Stale remnants include `RBP2002` as a `blockingIssue`, `Build the current bundle first` as a blocked title, status bar `Preflight Issues` for stale/export-missing paths, and Project export status `BLOCKED` when export is merely unavailable.
10. The left rail roughness is caused by fixed 72px rail geometry combined with always-visible wrapped labels/hints and later CSS overrides that enlarge `.ide-mode-label`; long labels such as `Map Pins` / `Assign board pins` wrap and crop.

## Reproduction

- Exact repro steps:
  1. Open a project with all required pins mapped and passing Verify evidence.
  2. Navigate to Hardware before a successful current export bundle exists, or after changing the project after export.
  3. Observe Hardware/Export blocked copy alongside mapping/check/artifact indicators that imply readiness.
  4. Inspect the left rail at the current desktop viewport.
- Reproducibility: always for the missing/stale bundle states
- First known version or date: 2026-04-23 screenshots after Hardware reset

## Evidence

- Screenshot / recording: user-provided Hardware screenshots, 2026-04-23
- Console excerpt: none
- Test / gate output: focused Vitest suite, readiness/export/hardware/shell gates, and unified build passed.
- Additional artifacts: this ticket

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` global shell and workflow done definition
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` canonical workflow and export model
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` workflow coherence and export trust
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` runtime authorities and export path
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` Phases 1, 4, 5

## Acceptance Proof

- Minimum acceptance proof:
  - Shared workflow authority distinguishes true blockers from stale/missing bundle states.
  - Missing bundle is ready-to-build, not blocked, when prerequisites are satisfied.
  - Stale bundle is a rebuild advisory, not blocked.
  - Export and Hardware no longer show blocked hero/chips for buildable missing/stale bundle states.
  - Left rail labels no longer crop in the fixed rail.
- Required test / gate command(s):
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectWorkflowAuthority.test.ts packages/rb-apps/src/apps/ide/__tests__/projectHealth.test.ts packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx packages/rb-apps/src/apps/ide/__tests__/ideLeftRail.stageGrammar.test.tsx`
  - `pnpm -s ide:gate:project-readiness-contract`
  - `pnpm -s ide:gate:export-ready-contract`
  - `pnpm -s ide:gate:hardware-checklist-contract`
  - `pnpm -s ide:gate:shell-chrome-contract`
  - `pnpm build:unified`
- Required manual proof: screenshot / runtime pass for Hardware and Export missing-bundle states
- Screenshot or recording expectation: no `BLOCKED` state when all prerequisites are met but no current bundle exists

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/contracts/RedByte_Product_Contract.md`
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/roadmap/RedByte_Gap_Audit.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/STUDENT_UX_LAYER.md`
- Docs that must be updated if behavior changes:
  - `docs/IDE_SYSTEM_MAP.md`
  - `AI_STATE.md`

## Disposition

- Status: fixed locally; commit/push pending at closeout
- Fix PR / commit: pending
- Notes:
  - `deriveHardwareExportFailureTruth` now treats `export-missing` as `READY TO BUILD` and `export-stale` as `STALE`, both advisory states.
  - `deriveProjectHealth` no longer counts `dirtySinceExport` as a structural blocker, so blocker counts cannot disagree with missing/stale bundle copy.
  - Export and Hardware consume the same handoff truth for hero titles, CTAs, package handoff labels, and status chips.
  - The status bar now says `Workflow Ready`, `Workflow Review`, or `Workflow Blocked` instead of preflight language.
  - The fixed left rail clamps collapsed labels and hides long hints to prevent cropped workflow labels.
  - `scripts/gates/ide-export-blockers-contract.mjs` was updated because the old gate encoded stale Project-owned mapping edits. It now creates a missing-pin blocker through Hardware's advanced mapping escape hatch and requires Export's fix path to route to Map Pins.

## Proof Run

- `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectWorkflowAuthority.test.ts packages/rb-apps/src/apps/ide/__tests__/projectHealth.test.ts packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.trust-clarity.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportPackageHandoffModel.test.ts packages/rb-apps/src/apps/ide/__tests__/ideLeftRail.stageGrammar.test.tsx packages/rb-apps/src/apps/ide/__tests__/IdeStatusBar.test.tsx packages/rb-apps/src/apps/ide/__tests__/projectRuntime.persistence.test.ts packages/rb-apps/src/apps/ide/__tests__/projectRuntime.verify-authority.test.ts` -> pass (148 tests)
- `pnpm -s ide:gate:project-readiness-contract` -> pass
- `pnpm -s ide:gate:export-ready-contract` -> pass
- `pnpm -s ide:gate:hardware-checklist-contract` -> pass
- `pnpm -s ide:gate:shell-chrome-contract` -> pass
- `pnpm -s ide:gate:shell-density-contract` -> pass
- `pnpm -s ide:gate:export-blockers-contract` -> pass
- `pnpm -s ide:gate:export-download-contract` -> pass
- `pnpm -s build:unified` -> pass

## Remaining Risk

- No new manual screenshot was captured in this slice; automated Playwright gates and focused surface tests cover the contradictory blocker states and shell rail contract.

## Attribution

Connor Angiel
