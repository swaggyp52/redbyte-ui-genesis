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
**Latest local audit commit:** `5a55957b`
**Target hardware:** Basys3 (`xc7a35tcpg236-1`)
**Vivado target:** 2024.2

RedByte is an FPGA educational IDE. The current product spine is Project -> Design -> Verify -> Map Pins / Hardware -> Export. Import is a utility. Board programming is an external handoff after Export. Primary package: `packages/rb-apps`.

---

## Top Priorities

1. **Wire the product immersion findings into the cockpit.** The whole-app product immersion audit is the current student/product UX baseline. This docs-only pass makes its findings operational without duplicating the full audit everywhere.
2. **First-viewport repair is the next approved implementation slice.** Project, Design, Hardware/Map Pins, and Export must show the core work area or next action at 1366x768 without changing simulation, export, VHDL, XDC, or project data semantics.
3. **Add Verify fail-edit-repair proof after the first-viewport slice.** The audit found a stale repair risk after intentional expected-output editing; fix it only behind a focused regression.
4. **Keep broader browser coverage and Vivado/Basys3 proof in order.** Browser gates remain important after the UX slice; fresh E1/E2/E3 proof still requires Vivado 2024.2 and hardware access.

Do not jump to broad polish, new features, accounts/SaaS, or commercial packaging. The current operating loop is audit -> issue index -> narrow implementation slice -> proof -> docs update.

---

## Current Blockers / Risks

| Item | Current truth | Next action |
|------|---------------|-------------|
| Product UX baseline | `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md` is the current whole-app student/product baseline. Tests passing did not prove product readiness. | Use `docs/plans/2026-06-12-redbyte-product-issue-index.md` to route implementation slices. |
| First-viewport product blockers | Project CTA below fold, Design hiding the circuit graph, Hardware hiding board/table, Export action below fold, and Export Draft/Ready conflict are current P1 classroom-support risks. | First approved source slice: first-viewport repair only. |
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

**Target:** Product-brain integration, then first-viewport repair.

```powershell
corepack pnpm rb:doc:validate
corepack pnpm rb:encoding:check
```

For the first source slice, start from:

- `docs/plans/2026-06-12-redbyte-product-issue-index.md`
- `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md`
- `docs/audits/2026-06-12-redbyte-feature-inventory.md`
- `docs/plans/2026-06-12-redbyte-product-hardening-roadmap.md`
- `docs/ide/00-ide-layout.md`
- relevant surface specs under `docs/ide/`

Do not change simulation, export generation, VHDL, XDC, project data semantics, tests/goldens, or Verify stale-state logic during the first-viewport slice unless a focused proof requires a narrow copy/readiness adjustment.

---

## Latest Verified Evidence

| Evidence | Result |
|----------|--------|
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
| Current | Product-brain integration and issue-index routing. | `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md`; `docs/plans/2026-06-12-redbyte-product-issue-index.md` |
| Next implementation | First-viewport repair for Project, Design, Hardware/Map Pins, and Export. | `docs/plans/2026-06-12-redbyte-product-issue-index.md`; `docs/plans/2026-06-12-redbyte-product-hardening-roadmap.md` |
| Next proof slice | Verify fail-edit-repair-pass regression. | `RB-VERIFY-001` in the issue index |
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
