---
doc_status: current
last_validated: 2026-06-21
owner: Connor Angiel
used_by_claude: true
role: RedByte state authority and mutation matrix
---

# RedByte State Authority Matrix

This matrix exists to stop "surface truth" from drifting away from runtime truth. When changing behavior, update the state owner or a derived view of it. Do not create a second authority inside a surface.

Base audited for this matrix: `d235823a` on `main`.

## Matrix

| State | Canonical owner | Mirrors / derived views | Main mutation paths | Persistence | Required invalidation | Current proof |
|---|---|---|---|---|---|---|
| Current project identity, name, metadata | `useProjectRuntime` in `projectRuntime.ts` | `IdeTopBar`, Project cards, Export headers | starter load, blank project, import apply, archive restore | `rb.ide.project-runtime.v1`, `.rbproj` | reset run/export health when loaded project changes | persistence contract/tests, project overview gates |
| Active mode and workflow stage | `IdeApp.tsx` plus `workflowStages.ts` derived from runtime | left rail, top bar, surface root markers | mode rail click, URL query, surface CTA | URL query and React state | none for proof by itself | route/layout/shell gates |
| Circuit graph and layout | runtime `circuit` in `projectRuntime.ts` | `circuitStore.circuit`, Design canvas, HDL preview, Export model | Design edit callbacks, starter load, import apply, undo/redo | runtime persist and project files | stale Verify and Export after structural edits | circuitStore tests, design gates, projectRuntime tests |
| Editor graph cache | `stores/circuitStore.ts` | `window.__RB_CIRCUIT_STORE__` for gates/debug, Design view | palette/place/wire/delete/move updates mirrored from runtime callbacks | not final IDE authority | must reconcile from runtime on project load/navigation | circuitStore canonical/fingerprint tests |
| Canvas camera, zoom, pan | `packages/rb-logic-view/src/useLogicViewStore.ts` | SVG transform, zoom display, fit/center controls | wheel, preset zoom, Fit, Center, resize, navigation | view-local only | never affects project proof | design canvas zoom integrity, design workbench integrity |
| Selection and transient interaction | `useLogicViewStore.ts` | inspector, wire/node highlight, selection badge | click, marquee, drag, wire start/cancel, delete | view-local only | must not create project proof | wire interaction, multiselect, inspector, design workbench integrity |
| Design undo/redo | runtime `designPast` and `designFuture` | undo/redo buttons; circuitStore history as cache support | committed graph mutations, Ctrl+Z/Ctrl+Y | runtime persist | restore graph and stale proof consistently | `projectRuntime.history-authority.test.tsx`, design workbench integrity |
| Circuit diagnostics and build health | `projectHealth.ts` and derived compiler/simulation result | Design health row, Project blockers, Export blockers | circuit edits, compile/sim checks | derived plus runtime health core | stale after graph/vector/mapping change | project health tests, diagnostics jump gate |
| Verify scenarios and vectors | runtime `scenarios`, `projectVectors`, selected scenario fields | `StimulusCanvas`, Verify panels | add/edit rows, edit inputs/expected outputs, starter load | runtime persist | stale compare/export proof after edits | verify authority tests, verify fail-edit-repair gate |
| Verify truth-state model and runtime adapter | `verifyTruthState.ts` pure model plus `verifyTruthAdapter.ts` fed by runtime/scenario/hash owners | Future V2 Verify workbench, Verify viewmodels, Project verify state, Export readiness selectors | design/scenario/check edits, run request/completion/failure, Course check duplicate, My check edit, failure selection, runtime run/ledger/hash updates | none directly; runtime persists the source records | PASS/FAIL only from current Compare revisions; design/hash edits stale design unless scenario/check hashes prove stale testbench; Observe never becomes trusted PASS/FAIL | `verify:truth-integration-gate` |
| Observed output rows | runtime `verifyLastRun` and history | Verify observed columns, waveform, Project summaries | Observe or Compare run | runtime run history | not sufficient for PASS unless Compare checked expected outputs | verify contract/reality/summary gates |
| Expected output grid | runtime scenario/vector expected values | `StimulusCanvas` cells, repair controls | save observed as expected, manual expected edit | runtime persist | stale old PASS after edit | expected-output tests, verify fail-edit-repair |
| Compare PASS/FAIL/STALE | `projectHealthCore.lastVerify` and `deriveProjectWorkflowAuthority` | Project, Verify, Export, top-level status | Compare run, source edits | runtime health core | stale on circuit/vector/mapping edits | projectWorkflowAuthority tests, verify gates |
| Waveform and tick/case display | derived from verify run | waveform instrument, tick controls, failure detail | run verify, select signal/tick | derived view | no independent trust authority | verify workbench/summary gates |
| Pin mapping V2 | runtime `hardwareMappingV2` | Hardware table, board view, Export mapping summary | map/unmap resource, starter load, import apply | runtime persist | stale Export trust after mapping change | mapping authority tests, hardware gates |
| Flat project IO rows | runtime `projectIoRows` projection/compat path | Hardware table compatibility, Export aliases | derived or synchronized from mapping model | runtime persist for compatibility | must sync with V2 mapping | mapping bridge/editor tests |
| Board profile and package pins | Basys3 board source modules | board UI, Hardware guidance, XDC generation | source data only, not user mutated | source files | N/A | Basys3 tests, export tests |
| Export package state | runtime `projectHealthCore.lastExport` and export records | Export handoff, Project/Export status | build current bundle, download draft/trusted ZIP | runtime health core plus ZIP | stale after circuit/vector/mapping changes | export ready/download/e2e gates |
| Generated artifact hashes | Basys3 export services | Export artifact lists, README, ZIP manifest | build/export generation | ZIP/files/hash records | must match source state and generator version | golden export, vivado artifact, determinism tests |
| Import candidate | local state in `ImportSurface.tsx` and `zipImport.ts` parse result | Import review UI | upload, parse, inspect, apply | no project mutation until apply | current project unchanged until explicit apply | zip import tests/gates |
| Import applied project | `useProjectRuntime` after apply | Project/Design/Verify/Hardware/Export surfaces | Apply import candidate | runtime persist | load routes to Design and invalidates trust as needed | import-navigates-to-design test, zip import gates |
| Starter/example catalog | `examples/**`, `examplesCatalog.ts`, `starterKits/**` | Project starter cards, lab paths | source edits, starter load | source JSON and runtime after load | no-solution policy applies | examples/no-solution/lab starter tests |
| Local storage archive/recovery | runtime persist and project persistence helpers | Project recovery cards, autosave behavior | autosave, recovery load, reset | localStorage/archive files | must not restore stale trusted proof incorrectly | persistence tests/gates |
| E0/E1/E2/E3 proof state | release docs plus runtime E0 workflow authority | Export/Hardware wording, release docs | browser compare/export, Vivado build, board program, physical observation | docs/proof artifacts | E1-E3 only from real Vivado/board evidence | release docs, certification matrix |
| GitHub/deploy state | GitHub Actions and deploy checks | final closeouts, current-truth docs | push, workflow run, deploy | GitHub run history | local green is not remote green | GitHub operations doc and live checks |

## Ambiguities To Keep Visible

### Circuit Runtime vs Circuit Store

The IDE uses both `projectRuntime.ts` and `circuitStore.ts`. Treat runtime as the project authority and circuitStore as the editor mutation/cache layer. If a bug is a project-trust bug, fix runtime/authority. If it is an editor gesture/rendering bug, fix circuitStore or logic-view, then prove runtime reconciliation.

### Import Access

Import is intentionally demoted from the primary student spine, but current docs and UI are not fully aligned. The manual still says the left rail includes Import, while the loaded Project normal-use audit did not expose a visible Import entry point. This is now a product-control issue, not a gate failure to paper over.

### Export Artifact Preview

The normal-use audit reached Export and saw generated-artifact counts, draft readiness, and no overclaiming Vivado language. It did not find an obvious artifact preview in the normal workflow. Export trust and generated bytes may still be correct, but the workbench does not yet make the artifact evidence obvious enough.

### E0 vs Hardware Proof

Browser Compare PASS plus current mapping plus current Export can justify E0 package readiness. It cannot justify Vivado synthesis, implementation, programming, or board observation. Keep this distinction in surface copy and closeouts.

## Attribution

Connor Angiel
