# Product Hardening Ticket: Hardware Board Planner / Pinout Truth Reset

## Ticket

- Title: Hardware Board Planner / full Basys3 pinout truth reset
- Date: 2026-04-23
- Owner: Connor Angiel
- Surface: Hardware
- Journey segment: Design -> Verify -> Map Pins -> Export/XDC
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
  - Hardware is cleaner than before, but it still does not expose a trustworthy board resource catalog.
  - Clock binding is present in export/pin helpers but not first-class in the board planner UI.
  - The board visual and row details expose only the immediate clicked resource, so students cannot inspect the supported Basys3 pinout or available controls with confidence.
  - Package pin truth is split between UI drawing constants and the flat `basys3Pins.ts` alias resolver.
- Expected behavior:
  - Hardware behaves like a simplified Vivado board planner for the supported Basys3 resource scope.
  - Clock is explicit: `CLK100MHZ`, 100 MHz oscillator, package pin `W5`, and export/XDC clock constraint truth.
  - Students can inspect board resource groups, package pins, current mapped signal, availability, and the XDC-level binding used by Export.
- Why this matters:
  - Students use Hardware to bridge simulation to real board behavior. If the board resource truth is not visible and authoritative, mapping remains guesswork.
- Severity: high / classroom trust blocker

## Reproduction

- Exact repro steps:
  1. Load a Basys3 starter project.
  2. Open Hardware / Map Pins.
  3. Try to answer where the clock binds, which Basys3 resources are supported, which pins are still available, and what exact package pin/XDC truth Export will use.
- Reproducibility: always
- First known version or date: 2026-04-23 after Hardware finalization

## Evidence

- Screenshot / recording: user-provided Hardware screenshots, `docs/release/proof/hardware-finalization-2026-04-23.png`, and final proof `docs/release/proof/hardware-board-planner-pinout-truth-2026-04-23.png`
- Console excerpt: none
- Test / gate output:
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/fpga/boards/basys3/basys3Pins.test.ts packages/rb-apps/src/__tests__/basys3BoardView.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx` -> pass (37 tests)
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/hardwareBoard2D.interaction.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareMappingV2EditorModel.test.ts packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx packages/rb-apps/src/__tests__/basys3-bundle-gate.test.ts` -> pass (19 tests)
  - `pnpm -s ide:gate:hardware-checklist-contract` -> pass
  - `pnpm -s ide:gate:bringup-contract` -> pass
  - `pnpm -s ide:gate:shell-chrome-contract` -> pass
  - `pnpm -s ide:gate:workbench-layout-contract` -> pass
  - `pnpm -s ide:gate:export-ready-contract` -> pass
  - `pnpm -s build:unified` -> pass
- Additional artifacts: this ticket

## Audit Answers

1. Current represented resources: 100 MHz clock pin in export/pin helpers; switches, LEDs, buttons, seven-segment cathodes/anodes/DP in `basys3Pins.ts`; switches/LEDs/buttons/seven-seg in the Hardware SVG; no visible Pmod/VGA/UART resource catalog.
2. Missing/underspecified from official board/XDC: Pmod JA/JB/JC, XADC Pmod, VGA, USB-UART, PS/2, QSPI/config pins are not surfaced in Hardware; clock is not visible on the board planner; resource metadata is not grouped as a catalog.
3. Clock today: `BASYS3_CLOCK_PIN = 'W5'`, aliases `CLK`/`CLK100MHZ`, export emits `create_clock` when package pin `W5` is used, Hardware can allow `CLK100MHZ` for input rows but does not draw or detail it as a board resource.
4. Board-control names/package pins today: `basys3Pins.ts` maps aliases to package pins; Hardware derives labels from row pins and `resolveBasys3BoardAlias`; board SVG redraws aliases from local constants.
5. Current board view: usable for basic switch/LED/button/seven-seg mapping, but not complete enough to answer board-planner questions or show full supported/known Basys3 resources.
6. Default visible resources: clock, switches, buttons, LEDs, seven-seg because they are supported by current mapping/export flows.
7. Expanded catalog resources: Pmods, XADC, VGA, USB-UART, PS/2, QSPI/config resources should be discoverable as official Basys3 XDC resources, even if not the primary student mapping path.
8. Current model basis: package pins match official XDC for common resources, but the UI is driven by ad hoc local SVG constants plus flat alias lookup, not a shared board resource source of truth.
9. Official Basys3 truth not reflected in planner: visible W5 oscillator/clock, full resource inventory counts, Pmod/XADC/VGA/UART/PS2/QSPI catalog, per-resource mapped/available/conflict status, XDC preview for selected binding.
10. Existing tests/gates: `hardwareSurface.readiness.test.tsx`, `hardwareBoard2D.interaction.test.tsx`, `hardwareMappingV2EditorModel.test.ts`, `basys3BoardView.test.tsx`, export mapping trust tests, `ide:gate:hardware-checklist-contract`, `ide:gate:bringup-contract`.

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` Hardware promise and Export clock constraint trust
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` Hardware mapping model and Basys3 pin reference
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` Hardware mapping clarity / Basys3 rehearsal
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` Hardware chrome and export path
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` Phase 4 Hardware mapping
- External board truth:
  - Digilent Basys 3 reference manual
  - Digilent Basys-3 Master XDC
  - AMD Basys3 board page

## Acceptance Proof

- Minimum acceptance proof:
  - Shared Basys3 board resource catalog exists and includes official clock/switch/LED/button/seven-seg package pins.
  - Hardware visibly shows `CLK100MHZ`, `100 MHz oscillator`, `W5`, and clock XDC truth.
  - Resource catalog/details show board control, package pin, group/category, mapped signal, availability/conflict state.
  - Selected mapping shows project signal -> board resource -> package pin -> Export/XDC binding.
- Required test / gate command(s):
  - board resource truth tests
  - Hardware surface tests
  - export mapping trust tests
  - hardware/checklist and bringup gates
  - unified build
- Required manual proof: screenshot of Hardware showing clock resource, selected resource details, resource catalog, and board mapping loop
- Screenshot or recording expectation: Hardware reads as a simplified board planner, not only a click-map.

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
  - `docs/STUDENT_UX_LAYER.md`
  - `AI_STATE.md`

## Disposition

- Status: fixed locally; pending commit and push
- Fix PR / commit: pending
- Notes:
  - Hardware now reads from a shared Basys3 board resource catalog instead of split UI constants and flat alias-only assumptions.
  - Clock is explicit in the planner as `CLK100MHZ` on `W5`, with 100 MHz / 10 ns clock-constraint truth visible in the inspector.
  - Supported planner resources now include switches, LEDs, buttons, seven-segment controls, and an expanded discoverable official catalog for Pmods, XADC, VGA, USB-UART, PS/2, and QSPI.
  - Final manual screenshot proof: `docs/release/proof/hardware-board-planner-pinout-truth-2026-04-23.png`

## Attribution

Connor Angiel
