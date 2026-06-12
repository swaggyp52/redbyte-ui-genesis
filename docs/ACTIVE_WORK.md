---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte - Active Work Cockpit

**Branch:** main
**Desktop clone:** `C:\Users\conno\OneDrive\Documents\RedByte FPGA`
**Remote:** `https://github.com/swaggyp52/redbyte-ui-genesis.git`
**Audited commit:** `5a55957b`
**Latest local visual audit:** `docs/audits/2026-06-12-redbyte-visual-product-direction-audit.md`
**Latest local implementation slice:** first-viewport repair for Project, Design, Hardware/Map Pins, and Export
**Target hardware:** Basys3 (`xc7a35tcpg236-1`)
**Vivado target:** 2024.2

RedByte is an FPGA educational IDE. The current product spine is Project -> Design -> Verify -> Map Pins / Hardware -> Export. Import is a utility. Board programming is an external handoff after Export. Primary package: `packages/rb-apps`.

---

## Top Priorities

1. **Start visual design-system cleanup from the new visual baseline.** The user explicitly reprioritized visual stewardship after the first-viewport repair. Begin with tokens, shared panel/chip/action primitives, and browser-backed geometry proof before broad surface polish.
2. **Keep Verify fail-edit-repair as the next behavior/proof slice.** Do not mix the Verify stale-state regression with visual-system cleanup unless the user explicitly asks for that combined risk.
3. **Keep broader browser coverage current after the next focused source slice.** The product-immersion and hierarchy gates are green for the first-viewport slice, but the broader suite still matters after visual or Verify changes.
4. **Restore Vivado/Basys3 proof only on a machine with the right tools.** Fresh E1/E2/E3 proof still requires Vivado 2024.2 and hardware access.
5. **Write student/instructor quickstarts after UX/proof posture stabilizes.** Do not jump to commercial packaging, accounts/SaaS, or broad polish.

Do not jump to new features, accounts/SaaS, or commercial packaging. The current operating loop is audit -> issue index or visual plan -> narrow implementation slice -> proof -> docs update.

---

## Current Blockers / Risks

| Item | Current truth | Next action |
|------|---------------|-------------|
| Product UX baseline | `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md` is the current whole-app student/product baseline. Tests passing did not prove product readiness. | Use `docs/plans/2026-06-12-redbyte-product-issue-index.md` to route implementation slices. |
| Visual direction baseline | `docs/audits/2026-06-12-redbyte-visual-product-direction-audit.md` is the current visual baseline after first-viewport repair. It classifies RedByte as directionally credible but not visually finished. | Use `docs/audits/2026-06-12-redbyte-ui-architecture-inventory.md` and `docs/plans/2026-06-12-redbyte-visual-design-hardening-plan.md` for the next visual-system cleanup slice. |
| First-viewport product blockers | Fixed in the first-viewport repair slice: Project actions and recommended starter, Design canvas/graph, Hardware map table/board, Export primary action, and Export ready-to-build rail wording are visible/aligned at 1366x768. | Keep regressions covered by `ide:gate:ece141-first-viewport`; do not reopen without fresh failing screenshot or gate evidence. |
| Verify fail-edit-repair risk | Intentional expected-output edit produced a clear failure, but repair attempts in a dirty browser context could leave stale/run-disabled state. | Add a focused fail-edit-repair-pass regression after first-viewport work. |
| Commercial readiness | RedByte is technically credible but not commercially ready for unsupervised paid classroom use. | Keep accounts/SaaS deferred; package support/licensing only after UX, proof, and quickstarts are stronger. |
| Fresh Vivado/Basys3 proof on this desktop | Vivado 2024.2 was not found at `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`; no board proof was run here. | Use a machine with Vivado 2024.2 and a Basys3 board before making new E1/E2/E3 claims. |
| E3 observation closure | Prior controlled proof classifies rows as E2 until physical behavior is observed and recorded. | Use the existing observation templates when hardware is available. |
| Generated proof-pack availability | `.redbyte/bench/runs/**`, `out/vivado-cert/**`, `dist/**`, `test-results/**`, and `playwright-report/**` are local/ignored generated outputs and may be absent in clean clones. | Treat tracked release/proof docs as portable evidence; regenerate raw packs only when needed. |
| Lab 8 / SSD-heavy / hierarchical-bus starters | Not RC1 turnkey; complexity exceeds the current supported classroom matrix. | Keep out of scope unless the user explicitly starts that slice. |

**Resolved current blocker:** Classroom golden ZIP SHA drift was investigated on 2026-06-12. The current output was stable across repeated runs, the old SHAs were reproduced by removing only the intended README evidence-boundary section added in `4bced313`, and both golden gates pass after re-blessing the two SHA fixture files. Node 20.19.0 was not available in this shell, but the drift is source-explained rather than runtime-random.

**Resolved/stale blocker:** `build:unified` root `dist/` lock/redirect drift is no longer a current blocker in this cockpit. `AI_STATE.md` and `docs/release/course-edition/08-validation-log.md` record later passing `pnpm build:unified` / dist verification on merged `main`. Reopen only with fresh failing evidence.

---

## Next Technical Task

**Target:** Visual design-system/token/primitive cleanup, then surface-by-surface first-viewport hardening.

```powershell
corepack pnpm rb:doc:validate
corepack pnpm rb:encoding:check
```

For the visual source slice, start from:

- `docs/audits/2026-06-12-redbyte-visual-product-direction-audit.md`
- `docs/audits/2026-06-12-redbyte-ui-architecture-inventory.md`
- `docs/plans/2026-06-12-redbyte-visual-design-hardening-plan.md`
- `.agents/skills/redbyte-design-direction/SKILL.md`
- `.agents/skills/redbyte-browser-proof/SKILL.md`
- `docs/ide/style-guide.md`
- `docs/ide/design-system-v1.md`

Do not mix visual-system cleanup with export generation, VHDL, XDC, project data semantics, goldens, or Vivado proof. Preserve Verify fail-edit-repair as a separate behavior/proof slice unless the user explicitly reprioritizes it again.

---

## Latest Verified Evidence

| Evidence | Result |
|----------|--------|
| Visual direction stewardship audit | Browser capture covered 22 screenshots and 22 DOM summaries across public start, Project, Design, Verify, Hardware/Map Pins, Export, Import, and dirty Project resume states at `1366x768`, `1440x900`, and `1920x1080`. No console messages were recorded. The current visual direction is Course Lab Workbench; the next visual implementation path is shared token/panel/chip/action primitive cleanup before broad surface polish. Local artifacts live under ignored `.redbyte/product-immersion/visual-direction-audit/2026-06-12/`. |
| Local dev server repair | Bare `pnpm` remains unavailable on PATH in this shell and `corepack enable` failed with `EPERM` on `C:\Program Files\nodejs\pnpm`. The root dev scripts now call `corepack pnpm --filter ...`, and `corepack pnpm run dev` served `http://localhost:5173/` with HTTP 200. |
| First-viewport repair | `ide:gate:ece141-first-viewport` passed (`4` tests), proving Project launch actions/recommended starter, Design starter canvas/node, Hardware map table/board, and Export primary action/ready wording in the 1366x768 first viewport. `ide:gate:ece141-ui-hierarchy` passed (`2` tests), `ide:gate:ece141-product-immersion` passed (`4` tests), `build:unified` passed, and preview-backed Project/Design/Hardware/Export download/viewport contracts passed. `ide:gate:export-ready-contract` still fails before Export in Verify setup with `verify had neither a visible generate-basics action nor an existing ready-vector state`; track separately unless new evidence ties it to this slice. |
| Whole-app product immersion audit | Commit `5a55957b` added the current product UX baseline: whole-app audit, feature inventory, hardening roadmap, product-brain architecture, and commercialization readiness. It found concrete P1 product blockers in first viewport hierarchy, Verify failure repair, Hardware visibility, and Export action/trust wording; no app source, tests, goldens, or baselines changed. |
| Classroom golden SHA investigation | Under Node `v24.15.0` / pnpm `10.24.0`, both golden gate failures reproduced twice with stable actual hashes. Removing only the README evidence-boundary section added in `4bced313` recreated both old expected SHAs exactly. The two SHA fixture files were re-blessed to current deterministic output; both classroom golden gates then passed (`2` files, `2` tests), and adjacent export/Vivado contracts passed (`4` files, `35` tests). |
| Desktop clone preflight | `main` at `08a324cf`; `git status --short` clean; remote `origin` is `https://github.com/swaggyp52/redbyte-ui-genesis.git`; runtime observed as Node `v24.15.0`, pnpm `10.24.0`. |
| Dependency/doc checks from audit | `corepack pnpm install --frozen-lockfile` passed; `corepack pnpm -s rb:doc:validate` passed (`36` passed, `0` failed); `corepack pnpm -s rb:encoding:check` passed. |
| Runtime checks from audit | Direct `corepack pnpm -r --if-present run typecheck` passed; root `corepack pnpm typecheck` failed only because the package script invoked bare `pnpm` and the shim was not on PATH; `Start-RedByte.ps1 -SmokeTest -NoOpen -SkipInstall -Port 5197` passed with HTTP 200 after Corepack fallback. |
| Focused docs/product support checks from audit | `corepack pnpm -s rb:site:start:test` passed; `corepack pnpm -s rb:bench:evidence:test` passed; focused ECE141 browser gate passed after installing the local Playwright Chromium cache. |
| Focused classroom gate audit | Earlier audit passed `basys3-bundle-gate`, `verilog-determinism-gate`, and `lab-starter-load-gate`; the two golden ZIP gates failed before the 2026-06-12 rebaseline above. |
| Prior merged-main validation | `docs/release/course-edition/08-validation-log.md` records later passing `pnpm typecheck`, `pnpm build:unified`, startup smoke, course-script checks, and the full ECE141 browser gate stack on Windows-scripts-merged `main`. |
| Prior Vivado/Basys3 proof history | Tracked release proof docs record earlier Vivado/Basys3 evidence. This desktop pass did not run Vivado or hardware proof because Vivado was absent. |

---

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
- `out/vivado-cert/**`
- `dist/**`
- `test-results/**`
- `playwright-report/**`

If a doc references a generated pack that is missing locally, do not treat the tracked doc as false. Treat the raw pack as local evidence that may need regeneration.

---

## In-Flight Work

| Status | Item | Evidence |
|--------|------|----------|
| Done | Docs/backbone reconciliation: align agent startup, active cockpit, product truth, work queue, stale-zone rules, and proof-pack availability. | `docs/audits/2026-06-12-redbyte-backbone-reconciliation.md`; commit `91118512` |
| Done | Golden export SHA investigation and rebaseline. | `AI_STATE.md`; two classroom golden gates passing after SHA fixture update |
| Done | Whole-app product immersion audit. | `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md`; commit `5a55957b` |
| Done | Product-brain integration and issue-index routing. | `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md`; `docs/plans/2026-06-12-redbyte-product-issue-index.md` |
| Done | First-viewport repair for Project, Design, Hardware/Map Pins, and Export. | `tests/e2e/ece141-first-viewport-product-contract.spec.ts`; `ide:gate:ece141-first-viewport` |
| Done | Resident visual stewardship pass: repo-local RedByte playbooks, visual direction audit, UI architecture inventory, visual hardening plan, and local dev-server note. | `.agents/skills/*/SKILL.md`; `docs/audits/2026-06-12-redbyte-visual-product-direction-audit.md`; `docs/development/RED_BYTE_LOCAL_DEV_SERVER.md` |
| Current implementation | Visual design-system/token/primitive cleanup. | `docs/plans/2026-06-12-redbyte-visual-design-hardening-plan.md` |
| Next behavior/proof slice | Verify fail-edit-repair-pass regression and fix. | `RB-VERIFY-001` in the issue index |
| Later proof slice | Broader student workflow browser suite. | Existing ECE141 browser gates and product-immersion screenshots |
| Board-gated | E3 observation closure for controlled rows and custom rows. | `docs/STUDENT_RELEASE_READINESS.md`; tracked proof docs |
| Done / historical | Bench evidence classifier and observation workflow. | `AI_STATE.md` and `docs/release/redbyte-bench-evidence-model.md` |
| Done / historical | Curated v1 learning path, Project/Export/Hardware trust clarity, Project first-load home render fixes. | `AI_STATE.md` change log and cited commits |

---

## Cockpit Links

| What | Where |
|------|-------|
| Startup truth hierarchy | `AGENTS.md`, `CLAUDE.md`, `docs/DOC_INDEX.md` |
| Compact current truth | `docs/product/RED_BYTE_CURRENT_TRUTH.md` |
| Ordered work queue | `docs/product/RED_BYTE_WORK_QUEUE.md` |
| Product-brain routing | `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md` |
| Whole-app product UX baseline | `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md` |
| Visual direction baseline | `docs/audits/2026-06-12-redbyte-visual-product-direction-audit.md` |
| UI architecture inventory | `docs/audits/2026-06-12-redbyte-ui-architecture-inventory.md` |
| Visual hardening plan | `docs/plans/2026-06-12-redbyte-visual-design-hardening-plan.md` |
| Local dev server note | `docs/development/RED_BYTE_LOCAL_DEV_SERVER.md` |
| Feature/control inventory | `docs/audits/2026-06-12-redbyte-feature-inventory.md` |
| Product issue index | `docs/plans/2026-06-12-redbyte-product-issue-index.md` |
| Product-hardening roadmap | `docs/plans/2026-06-12-redbyte-product-hardening-roadmap.md` |
| Commercial readiness | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md` |
| Release readiness / TA surface | `docs/STUDENT_RELEASE_READINESS.md` |
| Certification matrix | `docs/release/vivado-basys3-certification-matrix.md` |
| Course-edition validation log | `docs/release/course-edition/08-validation-log.md` |
| Product manual | `docs/manuals/RedByte_Product_Manual.md` |
| Product contract | `docs/contracts/RedByte_Product_Contract.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Surface specs | `docs/ide/` |

---

## Operational Commands

```powershell
# Docs-only validation
corepack pnpm rb:doc:validate
corepack pnpm rb:encoding:check

# Local dev server in this Windows shell
corepack pnpm run dev

# Focused golden SHA regression
corepack pnpm exec vitest run packages/rb-apps/src/__tests__/classroom-golden-basys3-export-gate.test.ts packages/rb-apps/src/__tests__/classroom-golden-basys3-alu-export-gate.test.ts

# Full gate only when the approved slice affects gates
corepack pnpm verify:gates
```

---

## Update Rules

After every meaningful batch:

1. Reorder Top Priorities.
2. Add or resolve Blockers / Risks with evidence.
3. Replace Next Technical Task with the next concrete action.
4. Prepend Latest Verified Evidence when new validation or proof lands.
5. Keep generated/local proof clearly separate from tracked proof.
6. Bump `last_validated`.

This file is imported into `CLAUDE.md` via `@docs/ACTIVE_WORK.md`. Every agent session should treat it as the current cockpit after `AI_STATE.md`.
