# Product Hardening Ticket: Hardware Surface Reset

## Ticket

- Title: Hardware / Map Pins student workflow reset
- Date: 2026-04-23
- Owner: Connor Angiel
- Surface: Hardware (`HardwareSurface.tsx`)
- Journey segment: Design / Verify -> Hardware Map Pins -> Export
- Mode: Student IDE
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: Chromium target via existing gates
  - Node: local repo environment
  - pnpm: local repo environment
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - Hardware opened as a multi-stage board lab instead of a direct pin-mapping surface.
  - The default Map Pins view surfaced structured entry internals first: raw entry ids, HDL port fields, mapping kind, alias, direction, and comma-separated pin entry.
  - Rows did not make the student relationship `signal -> board control -> physical pin` obvious.
  - Package pins such as `V17` did not resolve back to board controls such as `SW0` in the default mapping row.
- Expected behavior:
  - Hardware should open on Map Pins.
  - Students should select a project signal, click the matching Basys3 control, and immediately see board control plus physical package pin.
  - Advanced structured mapping remains available only behind an explicit advanced disclosure.
- Why this matters:
  - Pin mapping is blocking students from exporting and seeing their projects on hardware.
  - A student-facing mapping workflow cannot read like schema maintenance.
- Severity: high / classroom blocker

## Audit Answers

1. Needed for the student mapping job: `mappingRows`, `selectedMappingRowId`, `onSetMappingPin(row.id, alias)`, `Basys3BoardView`, readiness counts, package-pin resolution, and shared `hardwareMappingV2`/`projectIoRows` authority.
2. Dead weight / fake structure: the dominant four-stage rail, repeated authority callouts, default-visible structured entry editor, and schema-first pin CSV form.
3. Binding writes happen through `onSetMappingPin` in `HardwareSurface`, wired in `IdeApp.tsx` to `setMappingPin`, which updates `hardwareMappingV2` and materialized `projectIoRows`.
4. Raw entry fields were visible because the V2 structured editor rendered before the student signal rows.
5. `iom-in0` style labels leak through `getStudentFacingIoLabel` because generated `iom-*` ids were not normalized for display.
6. Minimal loop: select signal -> click board control -> save alias -> show board control + package pin + mapped/missing/conflict.
7. Map Pins is implemented and necessary. Board Check / Pre-flight / Simulation exist, but they should be secondary after mapping instead of page-level ownership.
8. Advanced editor can be hidden behind a disclosure without breaking workflows because its state remains mounted and edits still call `onApplyHardwareMappingEdit`.
9. Rows should use friendly signal labels such as `IN0`, `RESET`, `LOCK`, with board control (`SW0`, `LD0`) and package pin (`V17`, `U16`) shown together.
10. Existing proof lives in `hardwareSurface.readiness.test.tsx`, `hardwareBoard2D.interaction.test.tsx`, `hardwareMappingV2EditorModel.test.ts`, and gates `ide-bringup-contract` / `ide-hardware-checklist-contract`.

## Reproduction

- Exact repro steps:
  1. Open Hardware with any design containing I/O rows.
  2. Observe that Map Pins is not presented as the primary job.
  3. Observe raw structured mapping fields before the normal student row list.
  4. Try mapping an input by clicking a board switch.
- Reproducibility: always
- First known version or date: 2026-04-23 audit

## Evidence

- Screenshot / recording: not captured in this slice
- Console excerpt: none
- Test / gate output: focused hardware vitest suite
- Additional artifacts: this ticket and updated tests

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` Hardware promise
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` hardware mapping model
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` hardware mapping clarity
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` Hardware chrome
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` Phase 4

## Acceptance Proof

- Minimum acceptance proof:
  - Default Hardware opens on Map Pins.
  - Rows show friendly signal, board control, physical pin, and simple status.
  - Board click writes mapping through the existing shared authority.
  - Advanced structured mapping editor is collapsed by default.
- Required test / gate command(s):
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareBoard2D.interaction.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareMappingV2EditorModel.test.ts`
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/__tests__/basys3BoardView.test.tsx`
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectRuntime.mapping-authority.test.ts packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx packages/rb-apps/src/export/__tests__/hardwareMappingV2.export.test.ts`
  - `pnpm -s ide:gate:bringup-contract`
  - `pnpm -s ide:gate:hardware-checklist-contract`
  - `pnpm -s ide:gate:export-ready-contract`
  - `pnpm build:unified`
- Required manual proof: Hardware Map Pins visual pass
- Screenshot or recording expectation: signal list left, board visual central, advanced editor collapsed

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/contracts/RedByte_Product_Contract.md`
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/STUDENT_UX_LAYER.md`
- Docs that must be updated if behavior changes:
  - `docs/IDE_SYSTEM_MAP.md`
  - `AI_STATE.md`

## Disposition

- Status: fixed
- Fix PR / commit: this slice commit
- Notes: Map Pins is now the first Hardware mode; advanced structured editing is retained but contained. Focused hardware tests, Basys3 board component tests, mapping/export integrity tests, hardware gates, export-ready gate, and unified build pass.

## Attribution

Connor Angiel
