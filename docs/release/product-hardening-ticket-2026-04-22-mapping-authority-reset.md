# Product Hardening Ticket

## Ticket

- Title: Mapping authority reset across Project, Hardware, and Export
- Date: 2026-04-22
- Owner: Connor Angiel
- Surface: Project / Hardware / Export
- Journey segment: Verify -> Map -> Export
- Mode: `project`, `hardware`, `export`
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: Chromium (Playwright gates)
  - Node: v24.13.0
  - pnpm: 10.24.0
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - `ProjectSurface` exposes a full editable Basys3 pin table.
  - `HardwareSurface` exposes quick-assign mapping and structured mapping edits, but repeatedly says Project is the real mapping authority.
  - `ExportSurface` still allows pin edits and suggestion application when parent mapping callbacks are wired.
  - Students can encounter mapping dirtiness and export/readiness changes from multiple surfaces, making mapping feel like hidden shared state instead of one clear stage.
- Expected behavior:
  - Students should have one authoritative place to edit mapping.
  - Project should summarize readiness and direct the student to Map Pins.
  - Export should preview file readiness and generated files, not act like another mapping editor.
  - Hardware should clearly own logical signal -> board resource -> physical pin editing.
- Why this matters:
  - This is the main cross-surface ownership contradiction in the current student workflow.
  - It makes export failures feel disproportionate and confusing because the student can mutate the same state from multiple places.
  - It breaks the intended Build -> Verify -> Map -> Export story.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Open a mapped or partially mapped project.
  2. Edit pins in Project.
  3. Open Hardware and see copy framing Project as the authoritative pin table.
  4. Open Export and inspect the editable pin review table or apply pin suggestions there.
  5. Observe that mapping and readiness can be changed from multiple surfaces even though the student workflow implies a single Map Pins stage.
- Reproducibility: always
- First known version or date: 2026-04-22 audit

## Evidence

- Screenshot / recording: pending in this slice
- Console excerpt: not required
- Test / gate output:
  - Existing coverage in `projectRuntime.mapping-authority.test.ts`
  - Existing coverage in `hardwareSurface.readiness.test.tsx`
  - Existing coverage in `exportSurface.mapping-trust.test.tsx`
  - Existing gate in `tests/e2e/ide-mapping-pipeline-coherence.spec.ts`
- Additional artifacts:
  - `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
  - `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`
  - `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md`
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/rehearsal/failure-ticket-template.md`

## Acceptance Proof

- Minimum acceptance proof:
  - Mapping edits happen only from Hardware.
  - Project explains readiness and routes to Hardware for mapping.
  - Export shows mapping status and repair handoff, but not editable pin controls.
- Required test / gate command(s):
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectSurface.mapping-legitimacy.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx`
  - `pnpm exec playwright test tests/e2e/ide-mapping-pipeline-coherence.spec.ts --project=chromium`
  - `pnpm build:unified`
- Required manual proof:
  - Verify a student can tell Project is summary-only, Hardware is Map Pins, and Export is file review.
- Screenshot or recording expectation:
  - One Project screenshot showing summary + handoff
  - One Hardware screenshot showing mapping editor ownership
  - One Export screenshot showing file-centric preview without pin editing

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/contracts/RedByte_Product_Contract.md`
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/roadmap/RedByte_Gap_Audit.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/ide/SURFACE_CONFORMANCE.md`
- Docs that must be updated if behavior changes:
  - `docs/IDE_SYSTEM_MAP.md`
  - `AI_STATE.md`

## Disposition

- Status: in progress
- Fix PR / commit: pending
- Notes:
  - This slice intentionally prioritizes ownership clarity over broad visual redesign.
  - Design IO prioritization and Verify usability are separate follow-on slices unless they fit safely after proof.

## Attribution

Connor Angiel
