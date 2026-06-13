---
doc_status: current
last_validated: 2026-06-13
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte - Active Work Cockpit

**Branch:** main
**Canonical desktop clone:** `C:\Users\conno\redbyte-ui-genesis-main`
**Historical/local source clone:** `C:\Users\conno\OneDrive\Documents\RedByte FPGA`
**Remote:** `https://github.com/swaggyp52/redbyte-ui-genesis.git`
**Audited base commit for this reset:** `2d176550`
**Latest product/control slice:** V1 Product Contract Reset
**Target hardware:** Basys3 (`xc7a35tcpg236-1`)
**Vivado target:** 2024.2

RedByte V1 is a browser-based Basys3 digital-logic lab workbench. The current RedByte-owned spine is:

```text
Project -> Design -> Verify -> Map Pins / Hardware -> Export
```

Import is a utility. Vivado build, board programming, and board observation are external proof tiers after Export.

## Top Priorities

1. **Close the V1 Contract Reset docs/control slice.** This slice creates the V1 research, visual audit, product contract, delete/demote/rebuild inventory, execution program, and cockpit routing.
2. **Next code slice: Shell and Workbench Layout Reset.** Use `fix: reset RedByte workbench shell layout`. The shell/status frame must be reset before deeper surface work.
3. **Then rebuild Verify as an evidence workbench.** Behavior is already credible; density and repair hierarchy need workbench-level treatment.
4. **Then rebuild Project, Export, Hardware, and Design in the V1 order.** Design graph visibility remains a P1, but it should follow the shell reset so the frame is stable.
5. **Keep lab-profile/course-pack work as item 8.** It is important, not next.
6. **Keep Vivado/Basys3 proof and commercialization gated.** No new hardware or commercial claim comes from this docs slice.

Do not jump to accounts/SaaS, website polish, pilot/commercial packaging, broad UI cleanup, Vivado proof, or lab-profile extraction unless the user explicitly reprioritizes.

## Current Blockers / Risks

| Item | Current truth | Next action |
|---|---|---|
| V1 product contract | New V1 contract reset is the active target route. The older `RedByte_Product_Contract.md` remains broad/historical target context. | Use `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md` for near-term V1 surface work. |
| Runtime screenshot identity | Existing `localhost:5173` responded but showed stale UI build `a4fc624`. The audit screenshots were recaptured on `127.0.0.1:5174` and show build `2d17655`, matching HEAD `2d176550`. | For future screenshot proof, verify the UI build hash before using an existing server. |
| Shell/status hierarchy | Shell repeats state across top ribbon, left rail, evidence box, surface hero, right rail, and bottom status. | Next slice resets shell/workbench frame with screenshot proof and no semantics changes. |
| Design first viewport | Current `1366x768` screenshot still does not make the actual circuit graph the first-viewport focal object. | Fix after shell reset in the Design Workbench slice. |
| Verify evidence density | Verify PASS/FAIL behavior is strong, but the evidence/repair loop is visually dense. | Rebuild as Verify Evidence Workbench after shell reset. |
| Export mapping summary | Current screenshots show risk of same-viewport contradiction: `5/5 mapped` can coexist with "No required board I/O for this export." | Fix in Export Handoff Station slice. |
| Hardware proof language | Hardware / Map Pins is visually stronger, but "ready to build hardware" can be read beyond E0. | Tighten wording in Hardware / Basys3 Workbench slice. |
| Lab profile/course-pack seam | Target model exists, but implementation is intentionally demoted to queue item 8. | Do not start until workbench hierarchy slices land or user reprioritizes. |
| Fresh Vivado/Basys3 proof | Vivado 2024.2 and board proof were not run in this reset. | Use a Vivado 2024.2 + Basys3 machine before making new E1/E2/E3 claims. |
| Node pinned runtime | `.nvmrc` is `20.19.0`; current local proof uses Node `v24.15.0` and pnpm `10.24.0`. | Label Node 24 evidence honestly; rerun pinned-runtime proof when available. |

## Next Technical Task

**Target:** Shell and Workbench Layout Reset.

Structured hardening ticket fields to start from:

- Title: Reset RedByte workbench shell layout.
- Surface: Global shell and first-viewport frame across Project, Design, Verify, Hardware, Export, Import.
- Journey segment: first lab start through verified mapped export.
- Observed behavior: repeated shell/status authorities and surface-local chrome compete with the work object.
- Expected behavior: one compact shell/status authority; each surface first viewport focuses on the current job.
- Minimum acceptance proof: before/after screenshots at `1366x768`, `1440x900`, `1920x1080`; no root overflow; existing behavior gates green; no simulation/export/golden/hardware changes.

Suggested commit:

```text
fix: reset RedByte workbench shell layout
```

## Latest Verified Evidence

| Evidence | Result |
|---|---|
| V1 contract reset screenshot capture | 30 screenshots captured under `.redbyte/product-immersion/v1-contract-reset/screenshots/` across Project, Design, Verify observation, Verify PASS, Verify FAIL, Hardware, Export draft, Export ready, Import, and public start states at `1366x768`, `1440x900`, and `1920x1080`. Capture summary recorded zero console/page errors, zero root horizontal overflow, base URL `http://127.0.0.1:5174`, and UI build `2d17655` matching HEAD `2d176550`. |
| V1 competitive/workflow research | Official/primary-source research covered AMD Vivado UG892/UG908, Digilent Basys3/XDC, CircuitVerse, Logisim Evolution, Digital, HDLBits, and public university Basys3/Vivado lab workflows. |
| GitHub main pre-reset health | Before this docs slice, `main` at `2d176550` was in sync with `origin/main`. GitHub check-runs for `Classroom Truth Gates`, deploy, and manual Nightly Heavy Suites were green; optional manual screenshot/UI smoke jobs were skipped by design. |
| Nightly FPGA Bridge Proof repair | Done before this reset. Bridge proof stayed enabled, dynamic CI proof ports were used, broad port killing was removed, and GitHub Nightly Heavy Suites was green for the repaired commit. |
| Verify fail-edit-repair proof | `ide:gate:verify-fail-edit-repair` proves Compare PASS -> expected-output edit/stale -> rerun FAIL -> repair/stale -> rerun PASS, then Project PASS/CLEAN and Export current-Verify/ready-to-build truth. |
| General Lab Workbench Sprint 0 | `ide:gate:from-scratch-general-workflow` proves blank project -> two inputs -> AND -> output -> Verify Compare PASS -> Map Pins -> post-map Verify Compare PASS -> Export artifacts/README at E0 browser level. |
| Visual-system integrity history | Prior gates proved Project/Design bounded work areas, Verify command/evidence containment, Hardware guide/board/table visibility, and Export draft/ready handoff/evidence/action visibility. Current V1 screenshots still show higher-level contract issues, especially Design graph priority and Verify density. |

## Tracked Proof vs Local Generated Proof

Portable/tracked proof lives in docs:

- `docs/STUDENT_RELEASE_READINESS.md`
- `docs/release/vivado-basys3-certification-matrix.md`
- `docs/release/redbyte-bench-evidence-model.md`
- `docs/release/vivado-basys3-bench-intelligence-2026-05-05.md`
- `docs/release/proof/**`
- `docs/release/course-edition/08-validation-log.md`

Local/generated proof packs may be useful but are not guaranteed in a clean clone:

- `.redbyte/bench/runs/**`
- `.redbyte/product-immersion/**`
- `out/vivado-cert/**`
- `dist/**`
- `test-results/**`
- `playwright-report/**`

If a doc references a generated pack that is missing locally, do not treat the tracked doc as false. Regenerate raw packs only when the approved slice needs them.

## In-Flight Work

| Status | Item | Evidence |
|---|---|---|
| Current | V1 Product Contract Reset. | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`; research; visual audit; inventory; execution program. |
| Next | Shell and Workbench Layout Reset. | `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md`; V1 visual audit. |
| Later | Verify Evidence Workbench. | `RB-VERIFY-EVIDENCE-001` in issue index after reset. |
| Later | Project Command Center. | `RB-PROJECT-CC-001` in issue index after reset. |
| Later | Export Handoff Station. | `RB-EXPORT-HANDOFF-001` in issue index after reset. |
| Later | Hardware / Basys3 Workbench. | `RB-HARDWARE-WB-001` in issue index after reset. |
| Later | Design Workbench. | `RB-DESIGN-WB-001` in issue index after reset. |
| Later | Lab Profile / Course Pack Data Seam. | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`; queue item 8. |
| Board-gated | Vivado/Basys3 proof restoration. | Requires Vivado 2024.2 and Basys3 hardware. |

## Cockpit Links

| What | Where |
|---|---|
| Startup truth hierarchy | `AGENTS.md`, `AI_STATE.md`, `docs/DOC_INDEX.md` |
| Compact current truth | `docs/product/RED_BYTE_CURRENT_TRUTH.md` |
| Ordered V1 work queue | `docs/product/RED_BYTE_WORK_QUEUE.md` |
| V1 product contract | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md` |
| V1 research | `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md` |
| V1 visual audit | `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md` |
| V1 delete/demote/rebuild inventory | `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md` |
| V1 execution program | `docs/plans/RED_BYTE_V1_EXECUTION_PROGRAM.md` |
| Product issue index | `docs/plans/2026-06-12-redbyte-product-issue-index.md` |
| Lab profile target model | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md` |
| Product manual | `docs/manuals/RedByte_Product_Manual.md` |
| Release readiness / TA surface | `docs/STUDENT_RELEASE_READINESS.md` |
| Certification matrix | `docs/release/vivado-basys3-certification-matrix.md` |
| GitHub operations | `docs/development/RED_BYTE_GITHUB_OPERATIONS.md` |

## Operational Commands

```powershell
# Docs-only validation
corepack pnpm rb:doc:validate
corepack pnpm rb:encoding:check
git diff --check

# Local dev server in this Windows shell
pnpm run dev

# Fallback if the bare pnpm shim is missing
corepack pnpm run dev

# Fresh screenshot identity check before browser proof
git rev-parse --short HEAD
Invoke-WebRequest -Uri 'http://localhost:5173/?mode=project&e2e=1' -UseBasicParsing
```

## Update Rules

After every meaningful batch:

1. Reorder Top Priorities.
2. Add or resolve Blockers / Risks with evidence.
3. Replace Next Technical Task with the next concrete action.
4. Prepend Latest Verified Evidence when new validation or proof lands.
5. Keep generated/local proof clearly separate from tracked proof.
6. Bump `last_validated`.

This file is imported into `CLAUDE.md` via `@docs/ACTIVE_WORK.md`. Every agent session should treat it as the current cockpit after `AI_STATE.md`.
