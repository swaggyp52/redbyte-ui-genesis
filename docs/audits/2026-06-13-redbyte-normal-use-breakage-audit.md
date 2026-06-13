---
doc_status: current
last_validated: 2026-06-13
owner: Connor Angiel
used_by_claude: true
role: normal-use breakage audit for RedByte under-the-hood sprint
---

# RedByte Normal-Use Breakage Audit - 2026-06-13

## Scope

This audit intentionally used RedByte like a normal student/professor would, after the Design zoom repair, to find trust-killing failures that tests alone might miss.

It is an audit plus gate-hardening slice. It did not change product source, simulation semantics, Verify result semantics, pin mapping semantics, export generation, generated HDL/XDC/testbench/Tcl/ZIP bytes, goldens, Vivado proof, or Basys3 proof.

## Environment

| Item | Value |
|---|---|
| Repo | `C:\Users\conno\redbyte-ui-genesis-main` |
| Branch | `main` |
| Audited base | `d235823a` |
| Runtime | Node `v24.15.0`, pnpm `10.24.0` |
| Fresh server used for evidence | `http://127.0.0.1:5175/` |
| Visible UI build | `Buildd235823` |
| Stale server avoided | `http://127.0.0.1:5174/?mode=design&e2e=1` rendered older `Build9a639a4` |
| Evidence root | `.redbyte/product-immersion/break-redbyte-normal-use/` |

Evidence root contents are local/generated and intentionally ignored by git:

- `audit-results.json`
- `dev-5175.*.log`
- `screenshots/*.png`

## Normal-Use Coverage

| Path | Result | Notes |
|---|---|---|
| Boot current build | PASS | Loaded fresh server and confirmed `Buildd235823`. |
| Load Logic Gates starter | PASS | Starter project reached the IDE spine. |
| Design zoom, Fit, Center, dense/classroom, resize, navigation, reload | PASS | No blank canvas, no non-finite camera/SVG attributes. |
| Design select, drag, delete, undo, wire cancel, view modes | PASS | Graph stayed visible and runtime/editor graph stayed finite. |
| Verify Observe, Compare FAIL, repair, Compare PASS, persistence | PASS | Normal proof loop behaved coherently. |
| Hardware / Map Pins table and board alignment | PASS | Mapped rows and board stayed synchronized in the exercised path. |
| Multi-viewport first-viewport geometry | PASS | Project, Design, Verify, Hardware, and Export stayed within root width at audited viewports. |
| Export draft/trusted artifact inspection | FAIL | Export reported generated artifacts but the normal workflow did not expose an obvious artifact preview. |
| Import open/cancel from loaded Project | FAIL | A loaded Project state did not expose a visible Import entry point, while current manual text still describes Import in the left rail. |

The audit recorded no console errors and no page errors.

## Finding 1 - Export artifact preview is not obvious in the normal workflow

- Title: Make Export artifact evidence visible and internally consistent.
- Date: 2026-06-13.
- Owner: Connor Angiel.
- Surface: Export.
- Journey segment: Verified/mapped project to Vivado handoff.
- Mode: IDE, E0 browser evidence.
- Severity: P1.
- Observed behavior: Export reached a generated-artifact state and showed counts such as `9/9 artifacts`, but the normal-use audit did not find an obvious artifact preview surface. The handoff did not overclaim Vivado proof, but artifact evidence was not inspectable enough in the primary workflow.
- Expected behavior: Export should make generated artifact evidence explicit. The handoff summary, artifact count, artifact preview, downloaded ZIP entries, README/provenance, and trust label should agree in one obvious workflow.
- Repro path: Load Logic Gates starter, run Verify Compare, map required pins, open Export, build/download draft or current package, look for the generated artifact preview without relying on hidden test selectors.
- Truth sources: `ExportSurface.tsx`, export primitives, `projectWorkflowAuthority.ts`, Basys3 export services, export artifact/download/e2e gates.
- Acceptance proof: Add `ide:gate:export-trust-integrity` or equivalent. It should prove Draft and Trusted paths, artifact count, visible preview, downloaded ZIP entries, README/provenance, and no E1/E2/E3 overclaim.
- Status: Open. Not fixed in this slice.

## Finding 2 - Import utility access is ambiguous after a project is loaded

- Title: Align Import utility access with the product manual and current V1 spine.
- Date: 2026-06-13.
- Owner: Connor Angiel.
- Surface: Project / Import.
- Journey segment: loaded project to recovery/import utility.
- Mode: IDE, E0 browser evidence.
- Severity: P2.
- Observed behavior: In the loaded Project state, the audit did not find a visible Import rail button or obvious Project import utility entry point. Existing tests and code intentionally demote Import from the primary rail, but `docs/manuals/RedByte_Product_Manual.md` still says the left rail includes Import.
- Expected behavior: If Import is a utility, the documented utility path should be visible and tested. If Import is not available from a loaded project, the manual and product contract should say so plainly.
- Repro path: Load Logic Gates starter, return to Project, search the visible rail and Project commands for Import, then try to open/cancel the Import surface from the normal loaded-project workflow.
- Truth sources: `IdeApp.tsx`, `ProjectSurface.tsx`, `ImportSurface.tsx`, `docs/manuals/RedByte_Product_Manual.md`, `ideApp.import-navigates-to-design.test.tsx`, zip import gates.
- Acceptance proof: Resolve the product contract first, then add `ide:gate:import-utility-access` or equivalent proving the documented path and review-before-apply safety.
- Status: Open. Not fixed in this slice.

## Gate Hardening Completed From This Audit

Two invariant gates were added because the zoom bug proved a narrow gate was not enough:

- `ide:gate:design-workbench-integrity`
- `ide:gate:shell-layout-integrity`

Both are wired into:

- `classroom:gate`
- `verify:gates:classroom`

The gates cover rendered graph integrity, finite camera/SVG state, Design edit/delete/undo behavior, navigation/reload persistence, primary surface layout integrity, no root overflow, and first-viewport focal object visibility across Project, Design, Verify, Hardware, and Export.

## Non-Claims

- No fresh Vivado 2024.2 build proof was run.
- No Basys3 programming or physical observation proof was run.
- No export bytes or goldens were changed.
- No product source behavior was changed beyond tests/gates/docs in this slice.

## Attribution

Connor Angiel
