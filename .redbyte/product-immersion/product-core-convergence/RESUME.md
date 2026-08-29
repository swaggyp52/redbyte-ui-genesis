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
- [ ] Wave 3: Design workbench (visual language, wiring, semantic zoom, physical-leak fix) — IN PROGRESS
  - Next: canvas visual language — kill neon/dark-in-light-shell, oversized nodes at zoom, physical pin leak (U16/E19)
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

## Exact continuation

If resuming cold: `git checkout claude/redbyte-desktop-build-m5ryqw`, read this file,
read BUS_MODEL_AUDIT.md, check `git log --oneline safety/pre-product-core-convergence..HEAD`
for what already landed, and continue at the first unchecked wave above.
