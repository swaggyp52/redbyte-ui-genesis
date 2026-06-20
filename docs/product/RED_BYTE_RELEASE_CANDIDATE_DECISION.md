# RedByte Release Candidate Decision

Last updated: 2026-06-19

## Decision

RedByte is approaching a browser E0 student/classroom release candidate, but it is not yet packageable as a full release. The current browser app can support the core Project -> Design -> Verify -> Map Pins -> Export classroom loop with local evidence, and the required release subset now has direct Node 20.19.0 proof. Packaging should still wait for final deployed-SHA proof on the proof-package commit and one more product-owner pass on remaining density/card composition.

Current proof tier: E0 browser proof only. This does not claim Vivado build success, bitstream programming, Basys3 behavior, or physical board observation.

## What Is Close Enough For E0 Browser Use

- Project first launch and loaded Project are functional command surfaces with visible identity, rename, current next action, direct route actions, reload continuity, and no root overflow in the current audit.
- Verify no-circuit, pre-run, Compare PASS, intentional FAIL, first failing check, repair PASS, Signals open/closed, reload, and return-to-Project flows complete in browser evidence without console/page errors.
- Hardware, Export, and Import remain reachable from normal navigation and Project actions in the release-candidate audit.
- Browser mode reload and back/forward now preserve the RedByte app shell instead of stranding the student outside the app.

## What Is Still Not Shippable

- Node 20.19.0 status: passed via a repo-local portable runtime under ignored `.redbyte/tools/node-v20.19.0/`. The official Windows x64 zip checksum matched `be72284c7bc62de07d5a9fd0ae196879842c085f11f7f2b60bf8864c0c9d6a4f`, and the release subset passed under Node `v20.19.0` / pnpm `10.24.0`.
- Project still trends dashboard-like: the loaded Project surface is usable, but metrics/status composition remains visually heavier than ideal.
- Verify evidence is functionally clear enough for E0, but it still has dense instrument/report sections and should keep improving toward a more direct evidence-and-repair tool.
- Commercial/licensed delivery is out of scope until legal/licensing, distribution packaging, support docs, and production operational ownership are explicitly closed.

## Main Release Blockers

1. Final deployed-SHA proof: after the proof-package commit, rebuild, run final-current build smoke, push, and verify deployed `/os/build.json` or `/os/version.json` reports the final commit.
2. Remaining visual maturity: reduce card/status heaviness in Project and Verify without changing simulation, Verify truth, pin mapping, import/export semantics, or generated artifacts.
3. Commercial/package readiness: close legal/licensing, distribution packaging, support docs, and operational ownership before paid/unsupervised classroom claims.
4. Hardware proof boundary: Vivado/Basys3 E1-E3 claims still require explicit Vivado build, bitstream, and physical-board evidence.

## Before Packaging

- Run the release-candidate decision gate, focused Project/Verify gates, `classroom:gate`, `build:unified`, docs validation, encoding check, and diff check.
- Run `ide:gate:release-final-sha-discipline` only after the worktree is clean and the app is rebuilt for the final commit.
- Record a clean GitHub `Classroom Truth Gates`, deploy, and Cloudflare Pages result for the final pushed commit.
- Confirm deployed SHA from the live site before calling the release candidate current.

## Before Vivado/Basys3 Claims

- Run Vivado on the generated handoff and record the exact tool version, project, logs, and generated outputs.
- Program or observe a Basys3 only when hardware is physically available and evidence is collected.
- Keep E1/E2/E3 claims separate from browser E0 proof.

## Current Evidence

- Base commit audited: `f0ba2925ea2d3d3fa3ba7b8b6fcedc3663e354e1`.
- Browser proof: `.redbyte/product-immersion/release-candidate-decision/2026-06-19/before/` and `.redbyte/product-immersion/release-candidate-decision/2026-06-19/after/`.
- Node proof attempt: `.redbyte/product-immersion/release-candidate-decision/2026-06-19/node20-proof.txt`.
- Pinned-runtime proof package: `docs/product/RED_BYTE_BROWSER_E0_RELEASE_PROOF.md`.
- Portable Node proof artifact: `.redbyte/product-immersion/pinned-runtime-release-proof/2026-06-19/node20-portable-setup.txt`.
- Node 20 release subset: `build:unified`, `ide:gate:release-candidate-decision`, `ide:gate:final-current-build-smoke`, `ide:gate:authoring-depth-release-safety`, `ide:gate:student-task-completion-flow`, `classroom:gate`, docs validation, encoding check, and diff check all passed under Node `v20.19.0`.
- Strengthened gate: `ide:gate:active-mode-reload-recovery`.
- Release aggregate: `ide:gate:release-candidate-decision`.
