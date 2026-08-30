# Phase II — Product-Core Convergence Resume

## Session facts (2026-08-30)
- PR #82 branch `claude/redbyte-desktop-build-m5ryqw`, base `product/redbyte-workbench-v3` (0 behind).
- Phase II safety tag: `safety/pre-product-core-phase-2` @ 9b84f56 (unpublished).
- Node 22 (pinned 20.19.0 — golden SHA caveat). Dev: `corepack pnpm run dev` (5173).
- Large-file HMR can go stale — restart dev server before browser-verifying DesignSurface/projectHierarchy edits.

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

## Remaining P0
- [ ] P0-3 deeper Design authoring: nested instance PLACEMENT inside a module (placeModuleInstance is TOP-only), semantic zoom projection, structured wiring.

## Next chapters (P1+)
virtual-board ↔ Bench sync; pin planner depth + electrical; package history/provenance; import parity + complex fixture; visual-token migration; scale/a11y.

## Continuation
`git checkout claude/redbyte-desktop-build-m5ryqw`; read this + BROWSER_JOURNEYS.md + `.redbyte/product-immersion/product-core-convergence/BUS_MODEL_AUDIT.md`; `git log --oneline safety/pre-product-core-phase-2..HEAD`. The module-port owner audit (this session's workflow) mapped every width site — see the audit summary in the session transcript.
