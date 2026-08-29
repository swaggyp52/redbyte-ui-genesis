# Product-Core Convergence — Session Resume

## Session facts (recorded at start, 2026-08-29)

- Repo: `swaggyp52/redbyte-ui-genesis`
- PR: #82 (open, draft, mergeable clean) — https://github.com/swaggyp52/redbyte-ui-genesis/pull/82
- PR head branch: `claude/redbyte-desktop-build-m5ryqw`
- Starting head: `9b730be52d6256f37bd0b72f3285c309fcfd8680`
- Base: `product/redbyte-workbench-v3` @ `ab5c1e0` — ahead/behind: 25/0
- Worktree at start: clean
- Safety tag (local, unpublished): `safety/pre-product-core-convergence` @ `9b730be`
- Container Node: v22.22.2 (pinned repo runtime is 20.19.0 — golden export SHA gates known to drift under non-pinned Node; do not rebaseline)
- pnpm: 10.24.0 via corepack
- Dev server: `corepack pnpm run dev` → `@redbyte/playground` (Vite, port 5173)
- Full-suite baseline per PR #82 body: 148 failed / 2426 passed pre-existing on the union base; focused battery 90/92 with 2 pre-existing reds.

## Program state

- [x] Chapter 0: source-truth recovery, safety tag, notes scaffolding
- [x] Wave 1: first-class vector model — DONE and product-integrated
  - Core `BusDeclaration` model + authority (`bus.ts`): create/rename/delete/connect, taps, slices, words, validation BUS001-007, migration
  - Persistence: decode-only legacy migration, deletion-safe demotion, fingerprint + clone fixes
  - IR: `IRBusPort` resolution + IR007; HDL export emits declared vector ports (asc/desc), byte-identical goldens
  - Sim: `busValues` projection (observed word == scalar bits), engine-proven
  - Board: declared-bus grouping authority; `setMappingPins` structure-safe
  - Design: `createDesignBus` action + Create-bus dialog + Library "New bus…"; browser-proven A[3:0]
- [ ] Wave 2: hierarchy depth (nested definitions, vector module ports, params)
- [~] Wave 3: Design workbench — visual language DONE (light technical canvas, professional schematic nodes via NodeView `appearance` prop, neon overrides scoped to dark, oversized labels reduced, shell tab hover-title). Remaining: wiring/semantic-zoom/physical-leak deeper items.
- [x] Wave 6: Virtual Basys3 board (Browser E0) — DONE, browser-proven drive→observe (SW→mapped input→LED). Board aliasing now pin-derived.
- [ ] Wave 4: Project control center
- [ ] Wave 5: Simulate convergence (Bench/Analyzer/Runs)
- [ ] Wave 6: Virtual board (Browser E0)
- [ ] Wave 7: Board pin planner + XDC cross-probe
- [ ] Wave 8: Package operational workspace
- [ ] Wave 9: Import review + parity
- [ ] Wave 10: New Project flow
- [ ] Wave 11: visual system migration (shrink-only)
- [ ] Wave 12: scale + a11y
- [ ] Signature journeys 1-3 via browser

## Delivered this session (all pushed to PR #82, tests green, browser-proven)

17 commits on `safety/pre-product-core-convergence..HEAD`:
- Wave 1 first-class bus model: schema, authority (`rb-logic-core/src/bus.ts`),
  persistence+migration, IR `IRBusPort`+IR007, declared vector VHDL export
  (byte-identical goldens), sim word projection, board grouping, Design
  `createDesignBus` authoring, bus inspector identity.
- Wave 3 (partial): light technical canvas + `appearance`-aware `NodeView`
  schematic nodes, neon overrides scoped to dark, shell tab hover-title.
- Wave 6: Virtual Basys3 board (Browser E0), drive→observe proven.
- Wave 7 (partial): bus-planner meaningful action states (defect J).
- 55 new tests + both golden gates green together; regression baseline verified
  clean vs 9b730be.

## Exact continuation (next chapters, in value order)

1. **Analyzer bus lanes** (Wave 5E): the verify report groups scalar member
   signals into declared buses and the `WaveformInstrument`
   (`surfaces/verify/WaveformInstrument.tsx:705`) renders word-valued lanes with
   a radix (today any multi-char value draws as a LOW rail — add a word-render
   branch BEFORE emitting bus samples). Entangled with `verifyReport.ts`
   `VerifyWaveSample` generation; VerifySurface has many PRE-EXISTING failures —
   bisect against baseline before treating any as a regression.
2. **Hierarchy depth** (Wave 2): nested module definitions/instances, vector
   module ports (`projectHierarchy.ts` `ModulePort.width` is a literal `1` — the
   audit R11 lists the width-eraser sites), parameters. Enables the FullAdder
   step of the signature journey.
3. **Simulate convergence** (Wave 5): Bench/Analyzer/Runs primary structure;
   audit the unpushed desktop Simulate work before rebuilding.
4. **Project control center** (Wave 4), **Import parity** (Wave 9), **New Project
   flow** (Wave 10), scale/a11y (Wave 12).

If resuming cold: `git checkout claude/redbyte-desktop-build-m5ryqw`, read this
file, read BUS_MODEL_AUDIT.md and BROWSER_JOURNEYS.md, check
`git log --oneline safety/pre-product-core-convergence..HEAD`, and continue at
chapter 1 above. Dev server: `corepack pnpm run dev` (large-file HMR can go
stale — restart the dev server before browser-verifying edits to DesignSurface).
