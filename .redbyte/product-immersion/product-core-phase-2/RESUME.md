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

## Next chapters (P1+)
Project operational control center (tops/sources/filesets/compile-order/sim-sets/constraint-sets/runs/recovery);
virtual-board ↔ Bench sync; pin planner depth + electrical; package history/provenance; import parity.

## Continuation
`git checkout claude/redbyte-desktop-build-m5ryqw`; read this + BROWSER_JOURNEYS.md + `.redbyte/product-immersion/product-core-convergence/BUS_MODEL_AUDIT.md`; `git log --oneline safety/pre-product-core-phase-2..HEAD`. The module-port owner audit (this session's workflow) mapped every width site — see the audit summary in the session transcript.
