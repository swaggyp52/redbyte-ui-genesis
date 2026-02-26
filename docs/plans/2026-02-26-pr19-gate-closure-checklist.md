# PR19 Gate Closure Checklist (2026-02-26)

## Scope
Remaining failing gates were classified from the latest reduced failure set (`.tmp_gate_fails2.txt`, 34 gates) before additional code/script edits.

## Bucket A — Selector / Contract Drift
- `ide:gate:canvas-legibility-contract`
- `ide:gate:canvas-lod-contract`
- `ide:gate:design-build-contract`
- `ide:gate:design-fit-contract`
- `ide:gate:diagnostics-jump-contract`
- `ide:gate:evidence-capsule-contract`
- `ide:gate:export-artifact-explorer-contract`
- `ide:gate:export-blockers-contract`
- `ide:gate:export-download-contract`
- `ide:gate:export-generates-hdl`
- `ide:gate:export-ready-contract`
- `ide:gate:hardware-checklist-contract`
- `ide:gate:import-renders-schematic`
- `ide:gate:primary-cta-contract`
- `ide:gate:project-continue-cta-contract`
- `ide:gate:project-health-live-contract`
- `ide:gate:project-overview-contract`
- `ide:gate:verify-contract`
- `ide:gate:verify-no-trace-guard-contract`
- `ide:gate:verify-reality-contract`
- `ide:gate:verify-summary-contract`
- `ide:gate:verify-workbench-contract`
- `ide:gate:viewport-overflow-contract`

## Bucket B — Behavior / Spec Drift
- `ide:gate:design-inspector-contract` (primitive count changed with sequential primitives)
- `ide:gate:design-workbench-contract` (palette + geometry expectations stale)
- `ide:gate:project-readiness-contract` (checklist row count changed from 4 to 5)
- `ide:gate:layout-contract` (left rail width changed; old contract stale)
- `ide:gate:fullscreen-no-chrome` (boot path assumption changed; shell/launcher flow updated)

## Bucket C — Infra / Timing / Flake
- `ide:gate:console-autocollapse-contract` (console state checked before mode settle)
- `ide:gate:persistence-contract` (autosave/hash settle timing)
- `ide:gate:shell-chrome-contract` (console state timing + mode-init timing)
- `ide:gate:shell-density-contract` (console state timing + mode-init timing)
- `ide:gate:lab4-load-fast` (readiness signal timing + outdated root readiness probe)

## Bucket D — Screenshot Baseline Drift
- `ide:gate:screenshots`

## Execution Order
1. Project/examples
2. Import
3. Design
4. Verify
5. Export/Hardware
6. Screenshots (last, one-time rebaseline)
