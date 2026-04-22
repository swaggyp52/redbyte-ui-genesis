# Product Hardening Ticket: IDE Shell / Rails / Workspace Coherence

## Ticket

- Title: IDE shell / rails / workspace coherence across student flows
- Date: 2026-04-21
- Owner: Connor Angiel
- Surface: Shared shell / workflow spine (`IdeApp.tsx`, `IdeLeftRail.tsx`, `IdeTopBar.tsx`, `IdeWorkbenchShell.tsx`, `workflowStages.ts`, shell CSS)
- Journey segment: Fresh entry -> starter load -> Design -> Verify -> Project -> Hardware -> Export
- Mode: Student lab machine
- Environment:
  - Fresh machine / clean browser profile: targeted; runtime replay will use a fresh Playwright browser context against the local preview server
  - OS: Windows
  - Browser: Chromium (Playwright/local)
  - Node: `v20.19.0`
  - pnpm: `10.24.0`
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - Even after accepted surface fixes, the always-visible IDE frame may still feel rough, cramped, and internally named.
  - The left rail may be too narrow or cropped, selected-state hierarchy may be too weak, and shell labels may not read as student-facing product language.
  - The right dock may start closed when key flows need continuity and context to stay visible.
  - Surface transitions may still read like jumps between separate tools instead of one guided IDE workspace.
- Expected behavior:
  - RedByte should feel like one coherent IDE with a stable workflow spine, legible rails, obvious active surface, helpful default panel states, and clear next-step continuity across Project, Design, Verify, Hardware, and Export.
- Why this matters:
  - This is a shell-level legitimacy problem, not a single-surface styling issue.
  - Weak shell defaults can directly undermine the accepted improvements already made in Project, Verify, Hardware, and Export.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Boot the IDE on the default student route in a fresh browser context.
  2. Audit first impression, shell hierarchy, rail legibility, and default panel states.
  3. Load a realistic starter from Project and continue through Design, Verify, Project, Hardware, and Export.
  4. At each transition, record whether the shell makes the current step and next action obvious.
- Reproducibility: consistent on local preview replay before fix; verified improved after fix on the same preview flow
- First known version or date: reported by user on 2026-04-21

## Evidence

- Screenshot / recording:
  - `artifacts/ide-shell-coherence-flow-a-fresh-entry-postpatch.png`
  - `artifacts/ide-shell-coherence-flow-b-design-postpatch.png`
  - `artifacts/ide-shell-coherence-flow-c-verify-postpatch.png`
  - `artifacts/ide-shell-coherence-flow-d-project-after-verify-postpatch.png`
  - `artifacts/ide-shell-coherence-flow-e-hardware-postpatch.png`
  - `artifacts/ide-shell-coherence-flow-e-export-postpatch.png`
- Console excerpt:
  - `artifacts/ide-shell-coherence-console-warnings.txt`
  - Playwright-observed warnings during replay: `RB_APPS_REGISTER_TIMEOUT (IDE) {ms: 5000}`
- Test / gate output:
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/ideLeftRail.stageGrammar.test.tsx packages/rb-apps/src/apps/ide/__tests__/workflowStages.authority.test.tsx packages/rb-apps/src/apps/ide/__tests__/ideWorkbenchShell.test.tsx` -> PASS
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectSurface.continuity.test.tsx packages/rb-apps/src/apps/ide/__tests__/projectSurface.launchpadRemoval.test.tsx packages/rb-apps/src/apps/ide/__tests__/projectSurface.submission.test.tsx` -> PASS
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.workstation.test.tsx` -> PASS
  - `pnpm --filter @redbyte/playground build` -> PASS
  - `pnpm build:unified` -> PASS
- Additional artifacts:
  - Required runtime audit flows:
    - Flow A - fresh entry
    - Flow B - starter to design
    - Flow C - design to verify
    - Flow D - verify to project mapping
    - Flow E - project to hardware/export
  - Runtime measurements:
    - before final CSS fix, Playwright measured the left rail at `72px` even though the shell grid had widened
    - after final CSS fix, Playwright measured the left rail at `92px` (`--ide-rail-width: 92px`, `railRectWidth: 92`)

## Runtime Audit Summary

- Flow A - fresh entry:
  - The shell now opens with a readable global workflow spine instead of cropped rail labels competing with Project content.
  - Remaining roughness: the default entry still lands on a populated starter state while the top bar says `Untitled Project`, which is a startup-truth issue outside this slice.
- Flow B - starter to design:
  - The widened rail and hint copy make `Design / Build circuit` read like a guided step inside the same IDE.
  - Design keeps its right inspector visible, so the shell still feels anchored instead of dropping chrome.
- Flow C - design to verify:
  - Verify still uses its deliberate compact signal rail, but the global left rail keeps the active step unmistakable and preserves continuity across the switch.
- Flow D - verify to project:
  - Project no longer renders a duplicate left-side stage rail inside the surface.
  - The shell hierarchy is cleaner: one global workflow spine, one Project body, one current-focus card.
- Flow E - project to hardware/export:
  - Hardware and Export now open with the right inspector visible by default instead of a narrow collapsed sliver.
  - Hardware language is more student-facing: `Board Check` reads better in the staged bring-up flow than `Test on Board`.

## Root Problems Found

- The global left rail was still runtime-cramped and low-signal.
- Project was rendering a second workflow rail, making the shell feel like overlapping tools instead of one IDE.
- Hardware and Export defaulted their right dock closed even when those surfaces depend on immediate context and readiness cues.
- Some shell labels still read like internal stage names instead of student-facing product guidance.

## Fix Summary

- Added step hints to the global left rail so each mode now reads as action + intent, not icon + cramped label only.
- Widened the always-visible left rail and increased button/readability spacing so the workflow spine is legible at first glance.
- Hid the duplicate Project surface dock so Project relies on the global rail instead of competing navigation.
- Opened Hardware and Export with the right inspector visible by default, while keeping collapse affordance available.
- Renamed the hardware stage language from `Test on Board` to `Board Check` to improve student-facing terminology in the shared shell.

## Files Changed

- `packages/rb-apps/src/apps/ide/workflowStages.ts`
- `packages/rb-apps/src/apps/ide/components/IdeLeftRail.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`
- `packages/rb-apps/src/apps/ide/__tests__/projectSurface.continuity.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/projectSurface.launchpadRemoval.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/projectSurface.submission.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/exportSurface.workstation.test.tsx`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` §3 Product Pillars, §4.1 Global Shell Contract, §9.1 Workflow, §9.8 Visual polish
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` §4.1 canonical workflow, §5.3 first launch, §6 workspace and interface overview
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` workflow coherence, visual professionalism, screenshot-worthiness framing
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` shell owners, Design/Verify/Hardware chrome sections, runtime authorities
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` Phase 1 through Phase 5, `docs/release/v1-release-checklist.md` product gates

## Acceptance Proof

- Minimum acceptance proof:
  - The shell meaningfully improves first impression, rail legibility, active-surface clarity, and next-step continuity across the required flows.
  - Left and right rail defaults help common student flows instead of hiding important context.
  - Labels and hierarchy read like one student product rather than internal tooling.
- Required test / gate command(s):
  - pending after runtime audit identifies touched shell owners
- Required manual proof:
  - runtime replay of Flows A-E against the running app
- Screenshot or recording expectation:
  - capture the shell at fresh entry plus at least one mid-flow and one downstream flow state after hardening

## Remaining Roughness

- The startup route still presents a real starter-derived project body under the `Untitled Project` top-level title, so first-launch truth is better than before but not fully clean.
- Verify still keeps its internal left `Signals` tray collapsed, which is intentional, but the waveform area is visually sparse before a run populates it.
- The top bar still communicates current mode mostly through breadcrumbs and chips; a later slice could strengthen the active-workspace title without reopening the whole shell.

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/release/manual-assignment-qa-script.md`
  - `AI_STATE.md`
- Docs that must be updated if behavior changes:
  - this ticket
  - any current-truth doc whose described shell / workflow behavior changes
  - `AI_STATE.md`

## Disposition

- Status: implemented and validated locally; commit + push pending closeout
- Fix PR / commit: pending
- Notes:
  - This ticket intentionally covers the shared product frame and cross-surface continuity, not internal logic already accepted in prior hardening slices.
  - Runtime replay identified the highest-leverage issues as rail legibility, duplicate shell navigation in Project, and wrong default inspector state in Hardware / Export.

## Attribution

Connor Angiel
