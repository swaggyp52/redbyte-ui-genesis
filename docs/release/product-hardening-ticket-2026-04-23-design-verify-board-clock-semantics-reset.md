# Product Hardening Ticket - Design + Verify board-clock semantics reset

## Ticket

- Title: Design + Verify - treat the Basys3 board clock as a real board clock
- Date: 2026-04-23
- Owner: Connor Angiel
- Surface: Design, Verify, shared runtime signal-role derivation
- Journey segment: Design clock insertion -> Hardware clock binding -> Verify sequential stimulus
- Mode: Basys3 classroom flow
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: Edge / localhost
  - Node: repo local
  - pnpm: repo local
- Obsidian note: none linked
- Linked GitHub issue: none linked

## Problem

- Observed behavior:
  - Hardware now exposes `CLK100MHZ` on `W5`, but Design and Verify still allow the board clock to leak back into generic input semantics.
  - Shared role derivation is still partly heuristic (`clk` / `clock` naming), not strictly board-resource-backed.
  - Verify still presents the sequential path as generic stimulus editing plus clock-helper insertion, even when the signal is mapped to the real Basys3 board clock.
  - Cross-surface board highlighting currently ignores the clock because the shared board-signal context only supports switches, LEDs, and buttons.
- Expected behavior:
  - A signal bound to `CLK100MHZ` is treated as a clock-class board resource across Design, Hardware, Verify, and export/XDC proof.
  - Design distinguishes the board clock from ordinary manual inputs.
  - Verify does not treat a board-clock-bound signal like a switch/button-style editable stimulus lane.
  - Verify explains that the board clock is modeled as a deterministic clock source for simulation.
- Why this matters:
  - Students should not learn that a real board oscillator is "just another toggleable input."
  - The current behavior is weaker than Vivado's board-planner + testbench mental model and undermines trust in RedByte's hardware truth.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Add sequential logic in Design.
  2. Insert or map a project clock signal to Basys3 `CLK100MHZ`.
  3. Open Verify for the sequential design.
  4. Observe that the clock path is still framed primarily as generic authored stimulus with clock-helper tooling rather than a board-clock source.
- Reproducibility: always
- First known version or date: present after the hardware board-planner / pinout truth reset on 2026-04-23

## Evidence

- Screenshot / recording:
  - prior local screenshots from the hardware/planner reset sequence
  - new Design + Verify screenshot proof required for this slice
- Console excerpt:
  - none required for repro
- Test / gate output:
  - existing Verify tests still assert "clock helper inside the stimulus pane" for sequential entry states
- Additional artifacts:
  - this ticket
  - `AI_STATE.md`
  - `docs/release/manual-assignment-qa-script.md`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md`
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/rehearsal/failure-ticket-template.md`
- External board truth:
  - Digilent Basys 3 reference manual: onboard 100 MHz oscillator on `W5`
  - Digilent Basys-3 Master XDC: `PACKAGE_PIN W5` and `create_clock -period 10.00`
  - AMD Basys3 board page: confirms 100 MHz oscillator, 16 switches, 16 LEDs, 5 pushbuttons, 4-digit seven-segment display

## Audit

1. Where is signal role/type derived today?
   - `packages/rb-apps/src/apps/ide/ioSignalRoles.ts` via `deriveIoSignalRoles`
   - live roles are computed in `IdeApp.tsx` and passed to Verify / Hardware
   - run roles also live in `RuntimeVerifyRun.report.signalRoles`

2. Does the app currently know when a project signal is bound to the Basys3 board clock resource?
   - Partially yes.
   - `packages/rb-apps/src/fpga/boards/basys3/basys3Pins.ts` models `CLK100MHZ` on `W5`.
   - Export/testbench logic already recognizes `CLK100MHZ` / `W5`.
   - Design / Verify still do not consume that truth strongly enough.

3. How is the board clock represented in Design today?
   - Design has both a generic `Clock` palette item and a Basys3 board-resource item `CLK100MHZ`.
   - `resolveNodeIoPresentation` still classifies many clock cases through token heuristics instead of authoritative board-resource lookup.

4. How is that same signal treated in Verify today?
   - Verify identifies clock names from schedule guidance, live roles, and prior run metadata.
   - Sequential UX is still centered on authored stimulus plus helper actions like `Alternating clock`, `Hold low`, and `Single pulse`.

5. Which parts of Verify decide whether a signal is editable stimulus?
   - `VerifySurface.tsx` builds `inputFields`, `signalRoleLookup`, `clockSignalNames`, and the sequential helper UI.
   - `ScenarioBuilderPanel.tsx` renders the authored stimulus canvas using the provided `inputFields`.

6. Which parts of Design decide whether a signal is a generic input vs board resource?
   - `DesignSurface.tsx` palette grouping and `projectRuntime.addDesignBoardIo(...)`
   - `resolveNodeIoPresentation(...)`
   - `BoardSignalContext.tsx` for shared board highlighting

7. What current data already exists from the Hardware board-resource catalog that can be reused?
   - `BASYS3_BOARD_RESOURCES`
   - `getBasys3BoardResource`
   - `resolveBasys3BoardAlias`
   - authoritative aliases, categories, package pins, XDC port names, and planner support flags

8. What is the current simulation behavior for sequential circuits and clock advancement?
   - Verify uses `clocked_macro` schedule semantics
   - testbench / vector flow models `0 -> 1 -> 0` clock progression per case
   - internal sim clock is injected only when no real clock net exists

9. Where are the current UX leaks that make the clock look like an ordinary input?
   - `deriveIoSignalRoles` still promotes clock identity partly by naming heuristics
   - `VerifySurface` centers sequential stimulus editing and generic clock helper actions
   - `ScenarioBuilderPanel` treats the sequential path as stimulus authoring with no special board-clock lane semantics
   - `BoardSignalContext` cannot represent `CLK100MHZ`

10. Which tests/gates already cover Design/Verify signal semantics?
   - Verify: `verifySurface.entryState.test.tsx`, `verifySurface.layout-workflow.test.tsx`, `verifySurface.workstation.test.tsx`, `clockAuthority.test.ts`
   - Design: `designSurface.paletteDock.test.tsx`, `designSurface.sequentialInspector.test.tsx`, `designSurface.inspectorTruth.test.tsx`
   - shared runtime: `projectRuntime.verify-authority.test.ts`

## Acceptance Proof

- Minimum acceptance proof:
  - shared role truth recognizes a board-bound `CLK100MHZ` signal as `clock`
  - Design exposes the board clock as a distinct board resource
  - Verify excludes the board clock from ordinary manual-input treatment and explains its simulated clock-source behavior
- Required test / gate command(s):
  - targeted Design tests
  - targeted Verify tests
  - targeted shared runtime / board-role tests
  - relevant hardware/export trust tests if shared truth changes
  - relevant gates
  - unified build
- Required manual proof:
  - one Design screenshot showing the board clock as a first-class board resource
  - one Verify screenshot showing the board clock as a board clock source rather than a generic manual input
- Screenshot or recording expectation:
  - `CLK100MHZ`
  - `W5`
  - explicit board-clock wording
  - deterministic Verify clock semantics

## Validation

- `pnpm vitest run packages/rb-apps/src/fpga/boards/basys3/basys3SignalSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockSemantics.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.paletteDock.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.entryState.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.layout-workflow.test.tsx packages/rb-apps/src/apps/ide/__tests__/designSurface.sequentialInspector.test.tsx packages/rb-apps/src/apps/ide/__tests__/projectRuntime.verify-authority.test.ts packages/rb-apps/src/apps/ide/__tests__/exportSurface.timing-authority.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx` -> pass (77 tests)
- `pnpm ide:gate:verify-workbench-contract` -> pass
- `pnpm ide:gate:hardware-checklist-contract` -> pass
- `pnpm ide:gate:export-ready-contract` -> pass
- `pnpm build:unified` -> pass
- Observed pre-existing / out-of-scope gate failures during proof:
  - `pnpm ide:gate:design-workbench-contract` -> fail (`canvas starts too low in the design workspace (offsetY=221.0)`)
  - `pnpm ide:gate:design-inspector-contract` -> fail (`ide-design-inspector-health` timeout)
- Manual proof:
  - `docs/release/proof/design-board-clock-semantics-2026-04-23.png`
  - `docs/release/proof/verify-board-clock-semantics-2026-04-23.png`

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/STUDENT_UX_LAYER.md`
  - `docs/manuals/RedByte_Product_Manual.md`
- Docs that must be updated if behavior changes:
  - `AI_STATE.md`
  - this ticket
  - any touched system map or manual sections

## Disposition

- Status: fixed
- Fix PR / commit:
- Notes:
  - Keep prior hardware board-planner truth intact.
  - Do not broaden into general Verify redesign.

## Attribution

Connor Angiel
