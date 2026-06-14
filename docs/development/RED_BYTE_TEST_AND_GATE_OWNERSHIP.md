---
doc_status: current
last_validated: 2026-06-14
owner: Connor Angiel
used_by_claude: true
role: RedByte test and gate ownership guide
---

# RedByte Test And Gate Ownership

Use this guide when adding or changing RedByte proof. Tests passing is useful evidence, but each proof layer answers a different question.

## Proof Layers

| Layer | Owns | Best for | Required when |
|---|---|---|---|
| Pure unit/integration tests | deterministic source behavior | runtime state, graph authority, Verify trust, export bytes, import parser, mapping sync | a state transition, generator, parser, or authority function changes |
| Focused browser gate | one rendered workflow invariant | normal student actions, selectors, visible geometry, console/page errors, reload/navigation behavior | a product surface, workbench, mode route, or browser-only trust path changes |
| Classroom gate | required lightweight release confidence | source-delivered classroom flow before push | a hardening slice touches browser behavior, product trust, or any gate-critical path |
| Broad classroom verifier | wider regression breadth | local/nightly confidence and historical contracts | CI/nightly ownership changes or invariant coverage changes |
| Screenshot/audit proof | visual quality and first-viewport hierarchy | product hardening tickets, before/after review, design direction | the complaint is visual, workflow, density, or trust-language based |
| Generated artifact tests | Vivado handoff bytes | VHDL/XDC/testbench/Tcl/ZIP determinism and parity | export generation, aliases, scheduler, mapping, or README/provenance changes |
| Vivado/Basys3 proof | E1/E2/E3 downstream truth | synth/implementation, programming, physical observation | making or renewing hardware readiness claims |

## Current Required Classroom Additions

The following under-the-hood invariant gates are required in both `classroom:gate` and `verify:gates:classroom`:

- `ide:gate:design-canvas-zoom-integrity`
- `ide:gate:design-workbench-integrity`
- `ide:gate:design-workbench-v1`
- `ide:gate:export-handoff-station`
- `ide:gate:export-trust-integrity`
- `ide:gate:hardware-basys3-workbench`
- `ide:gate:import-recovery-contract`
- `ide:gate:project-command-center`
- `ide:gate:shell-layout-integrity`
- `ide:gate:shell-workbench-hierarchy`
- `ide:gate:verify-evidence-workbench-integrity`

Why:

- Design zoom integrity protects the exact blank-canvas / non-finite camera failure class.
- Design workbench integrity proves the graph stays visible and mutable through normal student actions.
- Design Workbench v1 proves blank guidance, loaded graph priority, selection, wiring, movement, delete/undo, split/code, and zoom/fit/center at classroom and desktop viewports.
- Export handoff station proves Draft/Ready/Trusted station hierarchy, one repair/build/download primary action, artifact workspace, README E0 boundary, mapping agreement, Vivado next steps, no overclaim, and no overlap/overflow.
- Export trust integrity proves visible generated previews, downloaded ZIP entries, README/provenance, Draft/Trusted labels, and proof-tier language agree for the mapped/verified handoff path.
- Hardware Basys3 workbench proves selected signal -> board resource -> package pin -> XDC hierarchy at classroom/desktop viewports and keeps ready-state copy E0-only.
- Import recovery contract proves Project utility discoverability, RedByte manifest restore as highest fidelity, Vivado/VHDL reconstruction limits, corrupt import safety, imported Verify proof invalidation, and no Vivado/hardware overclaim.
- Project command center proves neutral Project launch copy, peer blank/starter/saved/import paths, loaded-project entry paths, and a guarded loaded Build Fresh action.
- Shell layout integrity proves the core Project, Design, Verify, Hardware, and Export surfaces keep a visible work object with no root overflow across classroom/desktop/wide sizes.
- Shell workbench hierarchy proves the global shell has one compact proof/status authority, a support-only footer, rail navigation without visible completion-status copy, and a visible workbench object across Project, Design, Verify, Hardware, Export, and Import.
- Verify evidence workbench integrity proves visible first-run expected-output editing, Compare PASS, intentional expected-output FAIL, first mismatch expected/observed evidence, waveform controls, repair PASS, and no meaningful evidence-region overlap.

## Choosing The Right Test

| Change type | Minimum local proof |
|---|---|
| Runtime authority, project health, stale/pass/fail, mapping sync | focused Vitest for the authority module plus any existing browser gate affected by the display |
| Project command-center, start paths, loaded-project entry paths | `ide:gate:project-command-center`, Project screenshots, and existing Project readiness/overview gates |
| Design gesture, canvas, zoom, selection, visible graph | `ide:gate:design-workbench-v1` plus focused Design browser gates; add Vitest only if source state semantics change |
| Verify behavior or repair loop | focused runtime tests plus `ide:gate:verify-fail-edit-repair`, `ide:gate:verify-evidence-workbench-integrity`, or a narrower new Verify browser gate |
| Export generation bytes | generator tests, golden/hash proof, export e2e/download gates; screenshots are not enough |
| Export trust or visible handoff | export authority tests plus `ide:gate:export-trust-integrity` or `ide:gate:export-handoff-station` proving visible labels, preview, download, station hierarchy, and no overclaim |
| Hardware/Map Pins layout or E0 proof wording | `ide:gate:hardware-basys3-workbench`, hardware browser screenshots, and mapping tests only if map state changes |
| Import parse/apply behavior | import parser/runtime tests plus `ide:gate:import-recovery-contract` or a narrower zip/import browser gate |
| Lab profile/course-pack metadata | focused Vitest data contract such as `lab:profile-contract`; add browser proof only when profile data changes rendered workflow |
| Shell or first-viewport layout | `ide:gate:shell-layout-integrity`, `ide:gate:shell-workbench-hierarchy`, viewport overflow gate, screenshots at `1366x768`, `1440x900`, `1920x1080` |
| Docs/control-only slice | `pnpm rb:doc:validate`, `pnpm rb:encoding:check`, `git diff --check`; no product claim unless source proof exists |

## Browser Gate Rules

- Always verify the visible build hash before using an existing local server as evidence.
- Start from a realistic path: Project load, starter/blank selection, user actions, navigation, reload.
- Prefer stable `data-testid` selectors only when they point to current product objects. Do not preserve retired selector assumptions.
- Assert visible behavior, not only DOM existence. For layout gates, check bounding boxes intersect the viewport.
- Capture console/page errors and reject `NaN`, `Infinity`, and `-Infinity` in console or SVG geometry when geometry matters.
- Keep gates narrow enough to diagnose a failure. Add one broader classroom aggregator only after the focused gate is reliable.
- Do not hide a product issue by weakening a gate. If the issue is real but outside the slice, record it as an audit/issue finding.

## State Authority Rules

- Runtime state changes belong in `projectRuntime.ts`, `projectHealth.ts`, or `projectWorkflowAuthority.ts`.
- Editor gesture/cache changes belong in `circuitStore.ts`, `DesignSurface.tsx`, or `rb-logic-view`.
- Surface display must read derived authority. It should not create independent PASS, CLEAN, Trusted, mapped, or export-ready claims.
- If a TS/TSX source under `packages/rb-apps/src/**` changes and has a `.js` sibling, keep the JS mirror aligned.

## Closeout Rules

For hardening slices, closeout is not done at local green:

1. Run focused proof and the required aggregate proof for the slice.
2. Update `AI_STATE.md` and the relevant cockpit docs with factual evidence.
3. Stage only the slice files.
4. Commit and push to `origin` unless blocked.
5. Watch GitHub required checks and deploy checks for the pushed commit.
6. Report exact branch, commit, push result, GitHub check result, and production/live impact.

## Current Open Gate Gaps

| Gap | Recommended next gate |
|---|---|
| Fresh Vivado/Basys3 proof is not current in this reset. | Run E1/E2/E3 proof only on a machine with Vivado 2024.2 and Basys3 hardware; update release evidence without promoting browser E0 proof. |

## Attribution

Connor Angiel
