# RedByte UI Hierarchy Sprint 2

## Ticket

- Title: RedByte UI Hierarchy Sprint 2
- Date: 2026-05-12
- Owner: Connor Angiel
- Surface: RedByte IDE Project, Design, Verify, Hardware / Map Pins, Export, and Import surfaces
- Journey segment: Project -> Design -> Verify -> Hardware / Map Pins -> Export -> Vivado / board evidence
- Mode: Product hardening
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: Playwright Chromium
  - Node: pending validation
  - pnpm: pending validation
- Obsidian note:
- Linked GitHub issue:

## Problem

- Observed behavior: After the art-direction pass, the RedByte IDE has the lab-workbench visual direction, but several surfaces still compete for attention with dense secondary navigation, advanced panels, or starter choices.
- Expected behavior: Each surface should expose one primary focal object, one secondary context layer, one advanced or collapsed detail layer, and one obvious next action.
- Why this matters: ECE141 students need to understand the next lab action quickly without confusing E0 package evidence with external E1/E2/E3 evidence or treating advanced diagnostics as the primary workflow.
- Severity: P1/P2 product hierarchy hardening.

## Reproduction

- Exact repro steps:
  1. Start RedByte from a clean browser profile.
  2. Open Project and review starter hierarchy.
  3. Load the Logic Gates starter.
  4. Review Design, Verify before run, Verify pass, Hardware / Map Pins, Export E0 ready, Import recovery, and a narrow viewport.
- Reproducibility: always
- First known version or date: 2026-05-12 after Sprint 6 UI art-direction merge.

## Evidence

- Screenshot / recording: `.redbyte/product-immersion/sprint7-ui-hierarchy-2/`
- Console excerpt: severe console errors fail `pnpm -s ide:gate:ece141-ui-hierarchy`.
- Test / gate output: `pnpm -s ide:gate:ece141-ui-hierarchy` passed after the hierarchy fixes.
- Additional artifacts: Playwright screenshots for Project, Design, Verify before run, Verify pass, Hardware / Map Pins, Export E0 ready, Import recovery, and narrow viewport.

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md`
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`, `docs/ide/SURFACE_CONFORMANCE.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/release/product-hardening-ticket-template.md`, `docs/rehearsal/failure-ticket-template.md`

## Acceptance Proof

- Minimum acceptance proof: Browser gate proves each core surface has a visible primary focal region, visible next action, visible context layer, and collapsed or recessed advanced layer.
- Required test / gate command(s):
  - `pnpm -s ide:gate:ece141-ui-hierarchy`
  - Existing ECE141 browser gate stack
  - `pnpm -s ui:lab-starter-load-gate`
  - Relevant focused Vitest suites
  - `pnpm rb:doc:validate`
  - `pnpm rb:encoding:check`
  - `git diff --check`
  - `pnpm typecheck`
- Required manual proof: Human review of sprint 7 screenshots.
- Screenshot or recording expectation: Project, Design, Verify before run, Verify pass, Hardware / Map Pins, Export E0 ready, Import recovery, and narrow viewport screenshots captured under the sprint 7 path.

## Audit Table

| Surface | Primary focal object | Secondary context layer | Advanced/collapsed layer | Obvious next action | Problem | Severity | Fix now? |
|---|---|---|---|---|---|---|---|
| Project | Certified course path starter column | Status chips plus recent/reopen context | All lab starters disclosure | Logic Gates starter | Recent work and secondary starts could outrank the certified path | P2 | Yes |
| Design | Circuit canvas | Design toolbar and inspector context | Starter brief/details and inspector details | Open Verify | Canvas needed stronger focal ownership while metadata receded | P2 | Yes |
| Verify before run | Compare/run command bar | Stimulus/workbench context | Session details | Run / Compare checks | Raw stimulus and mode details could compete with the run action | P2 | Yes |
| Verify pass | Compare result/pass state and continue action | Waveform/workbench context | Session/proof facts | Continue to Hardware or Map Pins | Proof details needed to stay secondary to the run result | P2 | Yes |
| Hardware / Map Pins | Basys3 board mapping workbench | Mapping table | Structured editor and resource catalog | Open Export when mapping is ready | Board, mapping list, stage rail, and dock copy competed for attention | P2 | Yes |
| Export E0 ready | E0 handoff readiness hero | E0/E1/E2/E3 evidence ladder | Pipeline/build details | Build or rebuild the E0 Vivado package | Dense diagnostics and artifact details could hide the E0 action | P2 | Yes |
| Import recovery | Import/restore hero | Workflow rail and guidance cards | Other ways to start | Select Vivado ZIP or review import | Secondary manual import paths needed clearer separation | P2 | Yes |
| Narrow viewport | Project certified starter path | Lab-flow/proof context | Starter gallery disclosure | Logic Gates starter | Long launch copy and secondary starts consumed the first viewport | P2 | Yes |

## Fix Selection

| Issue | Severity | Why it matters | Fix | Files | Gate/test |
|---|---|---|---|---|---|
| Project certified starter path competed with recent work and secondary starts | P2 | Students should know to begin with the course starter path | Reworded Project launch copy, marked certified path as the primary focal object, moved recent work to secondary weight, and kept full starter gallery collapsed | `ProjectSurface.tsx`, `ide-polish-pass.css` | `pnpm -s ide:gate:ece141-ui-hierarchy` |
| Surface hierarchy was implicit and not gateable | P2 | Future UI changes could reintroduce competing layers without a browser failure | Added shared hierarchy role attributes through primitives and per-surface focal/context/advanced/next hooks | `IdePrimitives.tsx`, `SurfaceLayoutPrimitives.tsx`, surface files | `pnpm -s ide:gate:ece141-ui-hierarchy` |
| Design/Verify advanced details were available but not part of an explicit collapsed layer contract | P2 | Advanced details should remain discoverable without being the default student workflow | Marked starter brief, inspector details, and Verify session details as the advanced/collapsed layer and asserted collapsed state | `DesignSurface.tsx`, `VerifyCommandBar.tsx` | `pnpm -s ide:gate:ece141-ui-hierarchy` |
| Hardware board/mapping workbench had too many competing panels | P2 | The board and selected signal should drive Map Pins, with table and catalog supporting it | Marked Basys3 board workbench primary, mapping table context, structured editor/catalog advanced, and Open Export next action; reduced resource-summary clutter | `HardwareSurface.tsx`, `ide-polish-pass.css` | `pnpm -s ide:gate:ece141-ui-hierarchy` |
| Export E0 handoff and external evidence separation needed stronger hierarchy | P2 | RedByte must not imply E1/E2/E3; the E0 handoff action should remain central | Marked E0 handoff primary, evidence ladder context, build details advanced, and primary handoff CTA next action | `ExportSurface.tsx`, `ExportSurfacePrimitives.tsx`, `ide-polish-pass.css` | `pnpm -s ide:gate:ece141-ui-hierarchy` |
| Import recovery had secondary starts near the primary restore path | P2 | Manifest restore and Vivado ZIP import should be calm and obvious | Marked import hero primary, guidance context, other starts advanced/collapsed, and ZIP selection next action | `ImportSurface.tsx` | `pnpm -s ide:gate:ece141-ui-hierarchy` |

## Validation Results

Passed:
- `pnpm install --frozen-lockfile`
- `pnpm start:smoke`
- `pnpm -s ide:gate:ece141-starter-verify-export`
- `pnpm -s ide:gate:ece141-product-immersion` on rerun
- `pnpm -s ide:gate:ece141-counter-clock-export`
- `pnpm -s ide:gate:ece141-map-pins-recovery`
- `pnpm -s ide:gate:ece141-counter-compare-pass`
- `pnpm -s ide:gate:ece141-project-persistence`
- `pnpm -s ide:gate:ece141-import-export-recovery`
- `pnpm -s ide:gate:ece141-vivado-artifacts`
- `pnpm -s ide:gate:ece141-ui-art-direction`
- `pnpm -s ide:gate:ece141-ui-hierarchy`
- `pnpm -s ui:lab-starter-load-gate`
- Focused Sprint 7 surface Vitest suite: 65 passed, 1 skipped
- `pnpm rb:doc:validate`
- `pnpm rb:encoding:check`
- `git diff --check`

Known failures / notes:
- The first `pnpm -s ide:gate:ece141-product-immersion` run blanked before `ide-root` in the empty-project audit. The other three workflows in that run passed, and the immediate rerun passed all four workflows. No product code change was made for this transient startup/navigation miss.
- `pnpm typecheck` still fails in known `@redbyte/rb-lab-engine` / pulled `rb-logic-core` schema, stale fixture, and type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass. No new UI-specific type errors appeared.

## Remaining UI Issues

No remaining P1/P2 UI hierarchy issue has been identified after the selected fixes.

Remaining P3 polish:
- Human screenshot review should still decide whether the Design canvas screenshot needs a follow-up density/framing pass.
- Export's handoff screenshot is gate-valid, but a later polish pass can further reduce right-dock clipping around the action card.

Next recommended sprint:
- Merge `product/redbyte-ui-hierarchy-2` to `main` after review, then run the full-workspace `pnpm typecheck` drift cleanup.

## Disposition

- Status: fixed pending branch push
- Fix PR / commit: pending
- Notes: Do not add product features, change engine behavior, change Vivado artifact logic, or conflate E0/E1/E2/E3.

## Attribution

Connor Angiel
