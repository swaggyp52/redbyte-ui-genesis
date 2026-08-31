# RedByte — Session Resume

## Lane

- Branch: `claude/redbyte-desktop-build-m5ryqw` (cloud session, 2026-08-29)
- Base: `513b003cc` — the union of `origin/product/redbyte-workbench-v3`
  (`ab5c1e02`) and all 11 commits of PR #81
  (`claude/redbyte-production-convergence-ynz291`, strictly ahead, zero
  divergence — the "reconcile v3 with PR #81" step was a pure fast-forward).
- Delivery: draft PR #82 → `product/redbyte-workbench-v3`. Merging #82 also
  lands everything in #81 (GitHub will mark #81 merged automatically).
- Desktop boundary: the desktop-local head `65e1ff872` was never pushed and is
  unreachable from cloud sessions (see docs/ACTIVE_WORK.md production
  convergence lane). Nothing in this lane rewrites `product/redbyte-workbench-v3`.
  Desktop reconciliation is one merge:
  `git fetch origin && git merge origin/claude/redbyte-desktop-build-m5ryqw`
  (desktop product code wins on product surfaces; this lane's release/test
  changes win in release files).

## What landed (13 commits on the union)

| Commit | What |
|---|---|
| `86882e1d4` | Project's nested `<main>` → labeled section; 5-surface single-main contract test |
| `76cf6d5ed` | Design dock rail tabs fit the 180px rail (blanket !important carve-out; "Library" label) |
| `1db080e76` | Component library rebuilt on registry truth: port lines, capability chips, collapse persistence, keyboard nav, drag-to-place |
| `ce017c93b` | Full align/distribute set, S hotkey bound, zoom steps unified, zoom % readout |
| `3641e298e` | Node + canvas context menus; on-canvas rename (double-click/F2/menu) |
| `dfc028682` | Fanout junction dots; marquee adopts contained wires (atomic selectMultiple) |
| `c3555dcd4` | Instance-aware breadcrumb (`top / u_fa2 : FullAdder`), per-module camera memory, hierarchy tree opens native modules, Instances action |
| `e50f89437` | Project explorer sources view + derived compile order; Duplicate project operation |
| `ef9e1394d` | ExamplesBrowser activated (search/tags/learning path) with gate-compatible testids; Studio-token restyle |
| `17853c56e` | Board bulk bus mapping over the canonical `Base[N]` convention (preview/reverse/conflicts/revert) |
| `e0239b02f` | Flat Vivado kit download exposed in the ready handoff state |
| `fa74634df` | Waveform lane pin/hide controls activated + hidden-lanes restore chip |
| `64580c8b3` | Bus planner light-surface polish |

## Authority notes

- `ioBusGrouping.ts` reuses the exact explicit-label pattern of
  `basys3ExportModel.parseExplicitVectorLabel` — grouping in Board matches
  export vectorization; no fourth heuristic. The circuit model stays scalar.
- Hierarchy model semantics (no nesting, single-bit module ports, top-only
  board assignment) are milestone-bounded and untouched.
- Golden export SHAs untouched (known Node-drift caveat; container runs
  Node 22 vs pinned 20.19.0).

## Validation at this head

- Full rb-apps vitest baseline at the union base: 148 failed / 2426 passed.
  Every red encountered during this lane was stash-bisected: all remaining
  reds are pre-existing baseline failures; two stale contracts were migrated
  deliberately (palette card copy, arrangement group) and one heading
  assertion updated for the ExamplesBrowser activation.
- ~40 new contract tests across landmark, library rail, context menus,
  wiring semantics, sources/compile-order, duplicate project, bus grouping,
  bus planner, lane controls.
- Browser-proven (Playwright, 1440×900 + 1366×768): loaded Half Adder across
  all five surfaces, node context menu, zoom readout, fanout junctions,
  library search + capability chips, examples browser + learning path,
  bus planner before/after apply. Evidence is session-local
  (Browser-E0 only; no Vivado/hardware claims).

## Next queue

1. Simulate depth: waveform-native lane editing (§27) and run-to-run
   comparison need a run-history model first — both are unbuilt.
2. Board: full pin-planner occupancy table (all resources × owners at a
   glance) — catalog API exists (`listBasys3BoardResources`).
3. Project: unused-prop cut (7 props supplied but unconsumed at the
   ProjectSurface seam) + retire orphaned ProjectOverviewPanel/
   ProjectBridgePanel and their green-but-meaningless tests.
4. Design: LOD → true semantic zoom (overview/working/detail), trace
   upstream/downstream commands, scale fixtures (1k/10k instances).
5. Red list: 148 baseline failures, dominated by stale-era contracts
   (trust-clarity 17/18, workstation-era chrome). Migrate-or-retire per
   surface as those surfaces are touched.
