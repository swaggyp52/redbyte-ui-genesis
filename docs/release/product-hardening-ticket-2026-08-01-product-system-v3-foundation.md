# Product Hardening Ticket: Product System v3 Foundation

## Ticket

- Title: RedByte surfaces do not yet behave as one durable, configurable workbench
- Date: 2026-08-01
- Owner: Connor Angiel
- Surface: Shared shell, Project, Design, Verify, Hardware, Export
- Journey segment: Project open through Vivado handoff preparation
- Mode: `project`, `design`, `verify`, `hardware`, `export`, and the `import` utility
- Environment:
  - Fresh machine / clean browser profile: unknown; reproduced in the current local profile and screenshots
  - OS: Windows
  - Browser: Chromium-family browser
  - Node: 20.19.0
  - pnpm: 10.24.0
- Obsidian note: none; canonical repo docs own this milestone
- Linked GitHub issue: draft PR `RedByte Product System v3`

## Problem

- Observed behavior: The five stages share project data, but theme, layout, commands, persistence cues, project organization, Design support regions, and board assignment do not read as one configurable engineering workspace. The default dark composition is visually compressed; Project reads as a report; Design uses fixed support regions; board assignment is separated from selected top-level I/O; save/recovery authority is scattered across direct storage calls and UI messages.
- Expected behavior: One light-first, themeable workbench shell carries durable project context, honest storage state, central commands, persistent layouts, a real Project Center, configurable Design support regions, and one canonical board-mapping authority across Design and Board & Constraints.
- Why this matters: Students need a reliable mental model for where the project lives, what is saved, what each stage owns, and how visual authoring becomes a conventional Vivado handoff.
- Severity: P1 product-coherence and persistence defect; existing Browser-E0 circuit semantics remain usable.

## Reproduction

- Exact repro steps:
  1. Open a saved Full Adder project at `1366x768`.
  2. Move through Project, Design, Verify, Hardware, and Export.
  3. Compare panel structure, scroll ownership, command placement, and project/storage context.
  4. Select a top-level I/O node in Design and attempt to inspect or change its Basys3 assignment without leaving the surface.
  5. Reload and inspect whether theme, panel dimensions/visibility, and toolbar choices restore.
- Reproducibility: always on the Stable Preview base `57c8a94abd15d1810bf1f85eadf751c116ffbaa6`
- First known version or date: confirmed from the 2026-07-26 screenshots supplied with the program brief

## Evidence

- Screenshot / recording: user-supplied Project, Design, Verify, Map Pins, and Export screenshots from 2026-07-26
- Console excerpt: none required for the visual/system defect
- Test / gate output: baseline validation to be recorded on the product branch
- Additional artifacts: `docs/product/RED_BYTE_V3_PRODUCT_SYSTEM.md` and `docs/product/RED_BYTE_V3_COMPATIBILITY_MATRIX.md`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` sections 1, 3, 4, and 9
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` sections 4 through 7 and 14
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` visual professionalism and Design/runtime-assessment debt
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` surfaces, runtime authorities, and product-state audit
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` phases 1, 2, 4, 5, and 6; `docs/ide/SURFACE_CONFORMANCE.md` closure standard

## Acceptance Proof

- Minimum acceptance proof: Light/Dark/System theme, shell commands, Project Center truth, Design panel preferences, and inline mapping all use current authorities and survive reload where specified without changing circuit, Verify, mapping, Import, or Export semantics.
- Required test / gate command(s): focused v3 preference/repository/registry tests, existing persistence and mapping-authority tests, typecheck, IDE CSS audit, unified build, docs validation, encoding check, and `git diff --check`
- Required manual proof: use the real app at 1366x768, 1440x900, and 1920x1080; confirm theme/layout/toolbar reload and bidirectional mapping synchronization.
- Screenshot or recording expectation: the twelve named captures in the Milestone A brief, in both Workbench Light and Workbench Dark where required.

## Docs Review

- Docs that must be reviewed if behavior changes: Product Contract, Product Manual, IDE System Map, Surface Conformance, manual QA script, Stable Preview current truth
- Docs that must be updated if behavior changes: the three v3 product docs, `AI_STATE.md`, and current manual/system-map text where student-visible names or behavior changed

## Disposition

- Status: in progress
- Fix PR / commit: product branch `product/redbyte-workbench-v3`; draft PR pending first divergent commit
- Notes: Browser-E0 only. No Vivado, bitstream, programming, board-observation, or classroom-reliability claim is authorized.

## Attribution

Connor Angiel
