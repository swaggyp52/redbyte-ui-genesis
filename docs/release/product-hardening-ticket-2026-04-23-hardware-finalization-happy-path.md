# Product Hardening Ticket: Hardware Finalization / Happy-Path Cleanup

## Ticket

- Title: Hardware finalization and happy-path cleanup
- Date: 2026-04-23
- Owner: Connor Angiel
- Surface: Hardware
- Journey segment: Design -> Verify -> Map Pins -> Export
- Mode: Student IDE
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: Chromium target via local gates
  - Node: local repo environment
  - pnpm: local repo environment
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - Hardware opens on Map Pins, but top-level workflow/bundle/program messaging still competes with the mapping workspace.
  - The after-mapping stage rail appears before the board, so later steps visually outrank the actual mapping action.
  - Signal selection and board-click assignment work, but the selected signal -> board control -> package pin loop needs stronger confirmation.
  - The right rail repeats mapping status/help instead of focusing on the current selected signal and result.
- Expected behavior:
  - Map Pins owns the first-view center of gravity.
  - Later board-check / pre-flight / simulation guidance remains available but secondary.
  - The default loop is self-evident: select a signal row, click a valid board control, see board resource and package pin.
- Why this matters:
  - Hardware is where students bridge their circuit to physical board behavior. The first view must look like a mapping tool, not a workflow dashboard.
- Severity: high / classroom friction

## Reproduction

- Exact repro steps:
  1. Load a starter project or a project with boundary I/O.
  2. Open Hardware / Map Pins.
  3. Observe command strip, workflow ribbon, after-mapping stage rail, right dock, signal list, and board visual.
  4. Select a signal row and click a board control.
- Reproducibility: always
- First known version or date: 2026-04-23 after blocker truth and hardware reset slices

## Evidence

- Screenshot / recording: user-provided Hardware screenshots from 2026-04-23
- Console excerpt: none
- Test / gate output:
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareBoard2D.interaction.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareMappingV2EditorModel.test.ts packages/rb-apps/src/__tests__/basys3BoardView.test.tsx` -> PASS (`39 passed`)
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectRuntime.mapping-authority.test.ts packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx packages/rb-apps/src/apps/ide/__tests__/projectWorkflowAuthority.test.ts` -> PASS (`20 passed`)
  - `pnpm -s ide:gate:hardware-checklist-contract` -> PASS
  - `pnpm -s ide:gate:bringup-contract` -> PASS
  - `pnpm -s ide:gate:shell-chrome-contract` -> PASS
  - `pnpm -s ide:gate:shell-density-contract` -> PASS
  - `pnpm -s ide:gate:workbench-layout-contract` -> PASS after updating stale shell expectations for the current Project/Hardware/Export layout model
  - `pnpm -s build:unified` -> PASS
  - `pnpm -s repo:status` -> FAIL at the out-of-scope `IDE Design Workbench Contract` (`canvas starts too low in the design workspace (offsetY=221.0)`)
- Additional artifacts:
  - `docs/release/proof/hardware-finalization-2026-04-23.png`

## Audit Answers

1. Elements above Map Pins still competing: command strip with verify/export/build state, full workflow ribbon, after-mapping stage rail, and contextual callouts that can render before the board.
2. Necessary on first view: a small instruction, mapping count/missing state, selected signal cue, board target, and the mapping rows/board visual.
3. Collapse/demote/move lower: Verify -> Export -> Program ribbon, after-mapping mode rail, and 7-seg/debounce/later-stage guidance.
4. Selection loop is functional but not strong enough: row selection changes CSS and mapped board aliases highlight, but there is no persistent selected-signal confirmation card near the board.
5. Workflow-manager feel comes from top-level lifecycle/state chrome before the board, plus repeated readiness language across command strip, ribbon, dock, and inspector.
6. Minimum top messaging: "Map project signals to Basys3 controls" plus one sentence: select a row, click a valid board control, confirm board resource/package pin.
7. Right rail useful part: missing/mapped status and selected signal details. Less useful: repeated generic selection help.
8. Roughness: row selection is too subtle, board valid targets are not emphasized enough for an unmapped selected row, and the stage rail consumes first-view space.
9. Existing tests: `hardwareSurface.readiness.test.tsx`, `hardwareBoard2D.interaction.test.tsx`, `hardwareMappingV2EditorModel.test.ts`, Basys3 board view tests, hardware/checklist/bringup gates, shell chrome/density gates.
10. Manual proof: a screenshot of the default Hardware view showing compact top messaging, dominant signal list + board, selected row/board target feedback, and after-mapping tools below the board.

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` Hardware promise and screenshot-worthy bar
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` Hardware mapping model and workflow
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` Hardware mapping clarity and visual professionalism
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` Hardware chrome and Map Pins-first workspace
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` Phase 4 Hardware mapping

## Acceptance Proof

- Minimum acceptance proof:
  - Map Pins workspace appears before after-mapping workflow chrome.
  - Hardware command strip in map mode does not foreground export/program state.
  - Selected mapping row has stronger visual state.
  - Board view emphasizes valid targets while a row is selected.
  - Right rail shows selected signal -> board control -> package pin.
- Required test / gate command(s):
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareBoard2D.interaction.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareMappingV2EditorModel.test.ts packages/rb-apps/src/__tests__/basys3BoardView.test.tsx`
  - `pnpm -s ide:gate:hardware-checklist-contract`
  - `pnpm -s ide:gate:bringup-contract`
  - `pnpm -s ide:gate:shell-chrome-contract`
  - `pnpm -s ide:gate:shell-density-contract`
  - `pnpm -s build:unified`
- Required manual proof: screenshot of final Hardware default view
- Screenshot or recording expectation: first view is recognizably a mapping surface; after-mapping workflow is secondary.

## Docs Review

- Docs reviewed:
  - `docs/contracts/RedByte_Product_Contract.md`
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/roadmap/RedByte_Gap_Audit.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/ide/SURFACE_CONFORMANCE.md`
  - `docs/STUDENT_UX_LAYER.md`
- Docs that must be updated if behavior changes:
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/STUDENT_UX_LAYER.md` if student-facing Hardware rules change
  - `AI_STATE.md`

## Disposition

- Status: fixed locally; pending commit and push
- Fix PR / commit: pending
- Notes:
  - Hardware map mode now keeps export/program lifecycle state below the board workspace.
  - The selected signal -> board control -> physical pin loop is visible in the board workspace and right inspector.
  - The shared workbench layout gate had stale expectations from older shell behavior and now reflects current Project/Hardware/Export defaults.
  - Remaining risks: proof used the local Chromium preview and starter mapping path; no physical Basys3 programming rehearsal was run in this slice. Full `repo:status` still stops on the existing Design workbench canvas-offset gate, which was not reopened for this Hardware slice.

## Attribution

Connor Angiel
