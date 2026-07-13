# Product Hardening Ticket: Professional Rebrand and Surface Recomposition

## Ticket

- Title: Replace competing dashboard chrome with one professional classroom workbench hierarchy
- Date: 2026-07-10
- Owner: Connor Angiel
- Surface: Start, shell, Project, Design, Verify, Hardware, Export, Import
- Journey segment: Start -> Design -> Verify -> Map Pins -> Export, with Import as a utility
- Mode: Student IDE
- Environment:
  - Fresh machine / clean browser profile: no; production was inspected in the active in-app browser with persisted project state
  - OS: Windows
  - Browser: Codex in-app Chromium browser
  - Node: production build unknown; local validation must use 20.19.0
  - pnpm: local validation must use Corepack pnpm 10.24.0
- Obsidian note: none
- Linked GitHub issue: none; local-only program

## Problem

- Observed behavior: RedByte renders several competing command and status authorities, uses a neon/game-HUD visual system, reduces routine text and controls below classroom-legibility targets, and frequently lets support chrome dominate the surface's work object. Production also failed to switch Verify back to Compare checks after an Observe run.
- Expected behavior: RedByte presents one professional product bar, one compact workflow navigator, one page-owned command area, and one dominant work object per surface. Each state exposes one primary action, at most one recovery action, and truthful but visually secondary proof language.
- Why this matters: Students must understand the next lab action quickly, and professors must be able to trust the product as a deliberate engineering tool rather than a game dashboard or internal proof console.
- Severity: P1 program with a P0 deployed Verify interaction finding.

## Reproduction

- Exact repro steps:
  1. Open `https://redbyteapps.dev/start` at 1366x768, 1440x900, 1920x1080, and the 1366x768-equivalent 125% stress viewport.
  2. Open the IDE and traverse Project, Design, Verify, Map Pins, Export, and Import.
  3. Count competing action/status regions and inspect rendered type and click-target sizes.
  4. In Verify, add a custom case, enter expected outputs, run Observe only, then try to select Compare checks.
  5. In Hardware, create a duplicate SW2/W16 mapping and inspect recovery.
  6. In Import, load the blocked behavioral sample and inspect recovery/non-replacement guidance.
- Reproducibility: always for visual hierarchy; production Verify mode-switch defect reproduced with pointer, visible-screen, keyboard, and page round-trip attempts in the audited session
- First known version or date: production build `e8b5ff7`, audited 2026-07-10

## Evidence

- Screenshot / recording: `.redbyte/product-immersion/professional-rebrand/before/`
- Console excerpt: no production page-level errors were captured
- Test / gate output: pending implementation
- Additional artifacts: `.redbyte/product-immersion/professional-rebrand/findings.json`

## Truth Sources

- Target truth clauses: `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md` global shell and surface contracts; `docs/contracts/RedByte_Product_Contract.md`
- Current truth docs: `docs/manuals/RedByte_Product_Manual.md`
- Gap truth references: `docs/roadmap/RedByte_Gap_Audit.md` visual professionalism and screenshot-freeze debt
- System map / ownership references: `docs/IDE_SYSTEM_MAP.md`, `docs/ide/SURFACE_CONFORMANCE.md`
- QA / rehearsal clauses: `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/rehearsal/failure-ticket-template.md`

## Acceptance Proof

- Minimum acceptance proof: All seven entry/surface views use the professional theme, one primary action per tested state, legible type and targets, no root overflow, one workflow authority, and a dominant task object. Verify can round-trip Observe -> Compare and preserve truthful PASS/STALE/FAIL hierarchy. Hardware, Export, and Import retain their semantic/proof boundaries.
- Required test / gate commands: `ide:gate:professional-rebrand-flow`, all focused gates named in the user program, focused Vitest, Playground build, `classroom:gate`, docs validation, encoding check, and `git diff --check`
- Required manual proof: production-before and local-after cursor-driven review at all requested viewports, including success, blocked/error, and empty-state coverage where fixtures support it
- Screenshot or recording expectation: before/after images under `.redbyte/product-immersion/professional-rebrand/`, with contact sheets if practical

## Docs Review

- Docs that must be reviewed if behavior changes: V1 product contract, product manual, gap audit, IDE system map, surface conformance, manual assignment QA, release checklist
- Docs that must be updated if behavior changes: `AI_STATE.md`, `docs/ACTIVE_WORK.md`, `docs/IDE_PRODUCT_DEBT_REGISTER.md`, and any current manual/system-map language contradicted by the final composition

## Disposition

- Status: in progress
- Fix PR / commit: local-only stack pending
- Notes: Simulation, mapping identity/conflict semantics, project format, export bytes, and E0/E1/E2/E3 proof boundaries are out of scope. No push or deploy is authorized.

## Attribution

Connor Angiel
