# Phase II — Product-Core Convergence Resume

## Session facts (2026-08-30)
- PR #82 branch `claude/redbyte-desktop-build-m5ryqw`, base `product/redbyte-workbench-v3` (0 behind).
- Safety tags: `safety/pre-product-core-phase-2` @ 9b84f56; `safety/pre-nested-authoring-core` @ a4cdc3d (both unpublished).
- **Pinned Node 20.19.0 obtained on Linux via nvm** (`nvm install 20.19.0`; prepend `~/.nvm/versions/node/v20.19.0/bin` to PATH per Bash call). Under pinned Node both classroom golden Basys3 export gates pass BYTE-IDENTICAL — the prior Node-version SHA-drift caveat does NOT reproduce at 20.19.0 here.
- Dev: `corepack pnpm run dev` (5173). Large-file HMR can go stale — restart dev server before browser-verifying DesignSurface/projectHierarchy edits.

## Delivered this phase (pushed, tests green)
- [x] Bit-selected vector top ports in the structural hierarchy VHDL (`A => A(0)`, `SUM(0) <=`).
- [x] ModulePort widened to width:number + range + per-bit bits; helpers; normalize + clone preserve them.
- [x] Nested hierarchy: `elaborateProjectHierarchy` iterated to a fixed point (deep flatten, composed instance paths); `hierarchyCycleModules` DAG check; cycle rejection in `updateActiveModuleCircuit`; nested-module guard lifted.
- [x] Hierarchical adder SIMULATES (A+B) and survives save/reload + re-sim.
- [x] Module creation + drill-in + breadcrumb proven through the real UI (PII-1, PII-2).
- [x] **P0-1 vector MODULE ports** (`4826501`): `createModuleFromSelection` fuses sibling
  bus-member boundaries (same direction+busBase, ≥2) into one width-N vector port with
  `range`+`bits`; `normalizeModuleCircuit` emits one boundary node per bit (`Port[i]`);
  `generateModuleSource` emits `modulePortVhdlType` + per-bit bindings; structural top map
  bit-selects. `vectorModulePorts.test.ts`: fuse → VHDL vector decl → elaborate+sim (A=11→Y=01).
- [x] **P1 Chapter E — Project Architecture** (`523d850`): Project explorer surfaces the
  Phase-II model — each module shows its port signature (`A, B, CIN → SUM, COUT`, vectors as
  ranges) and a BUSES section lists top-level first-class buses (`A[3:0] input · 4 bits`).
  Browser-verified.
- [x] **P1 Chapter F — Simulate vector word lanes** (`e778e06`): `sim/busWordLanes.ts` pure
  timeline→word projection (MSB-first, X/Z-preserving, missing bit = unknown); `BusWordLanesPanel`
  dark-instrument readout above the waveform (hex+binary+decimal, per-tick strip, tick-aware,
  input=cyan/output=teal). 6 unit + 2 component tests; live 2-bit sweep renders `A[1:0]=0x3` end
  to end (PII-4).

## Nested authoring core (2026-08-30, cloud session — this batch)
- [x] **Nested module placement** (`7c3e09f`): runtime `placeModuleInstance` no longer bails
  off-top — when a definition is open the instance drops into THAT definition's circuit
  (mirrors `updateActiveModuleCircuit`), with `hierarchyCycleModules` rejection and undo.
  `projectRuntime.nestedPlacement.test.ts`: place-in-definition, deep flatten (top→Mid→Leaf→4 NOTs),
  cycle rejection unchanged-state, undo. Elaboration/cycle-detector were ALREADY nested-ready.
- [x] **Design UI nested placement** (`ce38140`): library-rail "Use" + palette "Place instance"
  render while editing a definition (self excluded); usage counts against the active circuit.
  Added testid `ide-design-palette-place-<moduleId>`.
- [x] **Nested HDL** (`df28e07`): a definition that instantiates another module now emits a
  STRUCTURAL architecture (`entity work.<Child>` port maps); primitive-only modules keep the
  byte-identical netlist path; module sources ordered leaf-first (topological). `hierarchicalVhdlNested.test.ts`.
- [x] **PII-5 — full blank→4-bit ripple-carry adder through the REAL UI** (`packages/rb-e2e/nested-adder-journey.mjs`):
  authored FullAdder (10 nodes placed via palette, 12 wires via wire tool, 5 signals renamed,
  module created from selection) → cleared top (Ctrl+A/Delete) → A[3:0]/B[3:0] input + SUM[3:0]
  output buses + CARRY + Ground via dialogs → 4 instances placed + renamed u_fa0..u_fa3 → all
  **17 top-level wires** (bus bits + carry chain + Ground→CIN) via the wire tool + dense-port
  endpoint picker (`logic-port-cluster` / `logic-port-picker-choice`) — 17/17, ZERO wrong.
  Simulate A=0xA,B=0xD → **SUM=0x7, CARRY=1** (pass). Save+reload preserves module+4 instances+17
  conns+buses. No store injection for authoring (store read only to locate DOM targets/assert).

## Remaining P0 / next
- [ ] In-journey generated-VHDL read (Stage F) needs board pins mapped for `ioMapping`; nested/4-bit
  structural VHDL itself is proven by `hierarchicalVhdl.test.ts` + `hierarchicalVhdlNested.test.ts`.
- [ ] Semantic-zoom projection; multi-level breadcrumb path stack; create-from-selection while nested.

## P1 — Operational Workbench Convergence (2026-08-30, started)
Safety tag `safety/pre-operational-workbench-convergence` @ 6d9bef4 (parent). Full owner
census in `OWNER_CENSUS_P1.md` (extend these owners; never add a second writable authority).

Delivered this block:
- [x] **Set Active Top** (`6d9bef4`): the Overview "Top" fact is now a validated command
  over the existing `fpgaConfig.top` authority (HDL-identifier validation, error on invalid,
  persists as `fpga.top`, survives save/reload — browser-proven). NOTE: `fpgaConfig` is still
  an IdeApp `useState` (ephemeral, hydrated from the saved project); the census flags folding
  it into `useProjectRuntime` as a persisted slice + `setActiveTop` action (convergence hazard).
- [x] **P1-D Shared Bench↔Virtual Board experiment** (`c9eb19d` bench, `19a1079` proof):
  `ManualBench.tsx` — a 5th "Bench" tab in Simulation Studio that is a PURE READ-MODEL over
  `useProjectRuntime().sim` (drives via `actions.sim.setInput` through `planBusWordDrive`,
  reads `sim.signals` via `readBusValue`/`readBusMemberBit`). Because the Design canvas and
  Virtual Board (`useIoBus`) read/write the SAME store, all three auto-synchronize — no second
  authority, no glue. Word drive supports hex/dec/bin + per-bit toggles; explicit opt-in
  "Add to sequence" is the only durable write (existing scenario authority). Reset uses
  `actions.sim.reset`. Stable `EMPTY_BUSES` avoids a useSyncExternalStore loop.
  PROVEN: `bench-board-sync-journey.mjs` (real UI, both directions: bench→board and
  board→bench on the Half Adder, no scenario/run mutation) + 6 component tests through the real
  engine — Half Adder (drive+measure+external-drive reflect), 4-bit adder A=0xA/B=0xD→SUM=0x7,
  CARRY=1 (hex/bin/dec word drive), Register1 rising-edge capture both directions.

- [x] **Active-top consolidation** (`da0b4f8`): `fpgaConfig.top` (IdeApp useState) is GONE.
  The store now owns persisted `activeTop` + validated `setActiveTop` (empty→derived default,
  invalid rejected, change marks export-dirty), seeded on all loads + restored by merge with a
  name-derived fallback. Shared `topEntity.ts` derivation (duplicated IdeApp copies deleted);
  `fpgaConfig` is a derived projection; 8 setFpgaConfig sites + bootstrap effect/ref removed.
  Type-clean vs baseline; persistence(33)+createBus(4)+activeTop(8) green; browser-proven
  (`active-top-authority-probe.mjs`): project chip projects the store value, UI set updates the
  one authority, invalid rejected, reload restores.

Exact next chapters (each: extend the named owner, browser-prove, commit — no new authority):
- **NEXT → engineering-location history** — location is split across IdeApp `currentMode`
  useState / `hierarchy.activeModuleId` / useLogicViewStore; no multi-level path, no
  Back/Forward/Up. Add a location-path projection + a bounded history stack (read-model over
  the existing owners; navigation is UI interaction state — allowed).
- **Canonical Runs document** — surface `verifyRunHistory` (50-entry ring) as a Runs list.
- **P1-F Package history** — `recordExport` (projectRuntime L2046) OVERWRITES a single
  `projectHealthCore.lastExport`. Add a bounded persisted `exportHistory[]` (append + digests
  from ProjectHealthExportResult), surface a history list + prev/current comparison + stale
  reason in ExportSurface (single generator `buildExportViewModel`).
- **P1-E Pin planner** — mapping authority `hardwareMappingV2` (setMappingPin/setMappingPins/
  applyHardwareMappingEdit/autoSuggestMapping); electrical facts in `basys3Pins.ts`
  BASYS3_BOARD_PROFILE. Add a swap_pins/resolve_conflict op to `hardwareMappingV2EditorModel.ts`
  union; build the assignment table + conflict-repair + XDC diff (buildTopXdc) in HardwareSurface.
- **P1-B Project docs actionable** — surface `verifyRunHistory` (50-entry ring, L358) as a Runs
  list; wire Recovery row to `projectRepository.checkpoint()`/recover.
- **P1-G Location/nav** — location split across currentMode useState / hierarchy.activeModuleId /
  useLogicViewStore; no multi-level path, no Back/Forward except mode. Needs a location-path
  projection + history stack.

Reminder: `LoadedProjectOverview` (the operational Project view) renders only when
`readiness.hasCircuit` — browser probes must populate a circuit before asserting Project controls.

## Continuation
`git checkout claude/redbyte-desktop-build-m5ryqw`; read this + BROWSER_JOURNEYS.md + `.redbyte/product-immersion/product-core-convergence/BUS_MODEL_AUDIT.md`; `git log --oneline safety/pre-product-core-phase-2..HEAD`. The module-port owner audit (this session's workflow) mapped every width site — see the audit summary in the session transcript.
