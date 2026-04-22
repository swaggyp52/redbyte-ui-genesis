# Product Hardening Ticket: Project Mapping / Export Authority for Renamed Sequential Designs

## Ticket

- Title: Project mapping / export authority for renamed sequential designs
- Date: 2026-04-21
- Owner: Connor Angiel
- Surface: Project + Hardware + Export + shared shell / workflow spine
- Journey segment: Verify -> Project / Map Pins -> Export
- Mode: Student
- Environment:
  - Fresh machine / clean browser profile: targeted; reproduction will use a clean Playwright browser context against the local dev server
  - OS: Windows
  - Browser: Chromium (Playwright/local)
  - Node: pending runtime capture
  - pnpm: pending runtime capture
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - A student can complete Verify on a nontrivial sequential design, then hit a confusing pin-mapping/export blocker.
  - The dark outlined mapping region on Project looks interactive, but may not actually provide truthful or working mapping interaction.
  - Renamed signals or renamed pins may be causing valid exportable ports to disappear, mismatch, or fail selection.
- Expected behavior:
  - A student can verify a realistic clocked design, rename ports in human-helpful ways, map valid top-level ports, and export without fighting stale state, dead hit targets, or invisible naming rules.
- Why this matters:
  - This is a trust break in the classroom-critical handoff from verified design truth to hardware/export truth.
  - If Project, Hardware, and Export disagree about what is mappable, students cannot trust RedByte’s workflow even when their circuit is valid.
- Severity: SEV-1 classroom blocker

## Reproduction

- Exact repro steps:
  1. Boot the IDE in a clean browser context.
  2. Create or load a realistic sequential design with a clocked path and multiple named signals.
  3. Verify the design.
  4. Rename ports/signals in a human-helpful way where relevant.
  5. Return to Project and inspect the mapping region.
  6. Attempt to select and map intended ports.
  7. Continue into Export and confirm whether export sees the same mapping truth.
- Reproducibility: pending runtime reproduction
  - Confirmed on 2026-04-21 against `http://127.0.0.1:5173/os/?mode=project` in a clean Chromium Playwright context.
- First known version or date: reported by user on 2026-04-21

## Evidence

- Screenshot / recording:
  - `artifacts/project-mapping-export-authority-after-fix.png`
- Console excerpt:
  - Runtime replay before fix: renamed `CLK` -> `ENTER CLK`, then Project mapping edit `U18` snapped back to `W5`; Export showed split authority with one mapped renamed row plus a second missing required `enter_clk` row.
- Test / gate output:
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectRuntime.mapping-authority.test.ts` -> pass
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/buildExportViewModel.canonical-naming.test.ts packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx` -> pass
  - `pnpm build:unified` -> success
- Additional artifacts: local runtime inspection against `http://127.0.0.1:5173/`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md`
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`

## Acceptance Proof

- Minimum acceptance proof:
  - Mapping UI is interactable anywhere it visually appears interactable.
  - Valid exportable ports can be selected and mapped reliably after Verify on a realistic sequential flow.
  - Human-friendly renaming does not silently poison valid mapping/export authority.
  - Internal or non-exportable nodes are clearly separated or explained.
  - Export consumes the same authoritative mapping truth the UI presents.
- Required test / gate command(s):
  - targeted Project / Hardware / Export regression test(s)
  - affected workspace validation/build commands
- Required manual proof:
  - runtime replay of Verify -> Project / Map Pins -> Export on a realistic sequential design
- Screenshot or recording expectation:
  - capture or explicit runtime confirmation of Project mapping interaction and downstream Export truth

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/release/manual-assignment-qa-script.md`
  - `AI_STATE.md`
- Docs that must be updated if behavior changes:
  - this ticket
  - any current-truth doc whose mapping/export behavior changes
  - `AI_STATE.md`

## Disposition

- Status: fixed
- Fix PR / commit: none
- Notes:
  - Root cause was authoritative-state drift, not a CSS dead-zone. Boundary-node rename churn updated live `projectIoRows`, but `hardwareMappingV2` kept the old scalar entry id / label / portName. Project mapping then edited the new live row id while Export still consumed the stale old mapping entry, producing non-sticky Project edits and split old/new port rows in Export.
  - Fix implemented in `projectRuntime.ts` + `hardwareMappingBridge.ts`: runtime commit paths now resynchronize scalar `hardwareMappingV2` entries to the live boundary rows after rename/delete churn, and renamed clock/reset-style rows keep meaningful Basys3 suggestions instead of falling back to generic switch suggestions.
  - Manual runtime proof after fix: renamed `CLK` -> `ENTER CLK`, ran Verify, returned to Project, changed the pin from `W5` to `U18`, and confirmed Export now shows one current renamed clock row with the same `U18` mapping and no ghost `enter_clk` blocker row.

## Attribution

Connor Angiel
