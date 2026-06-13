---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte - Active Work Cockpit

**Branch:** main
**Canonical desktop clone:** `C:\Users\conno\redbyte-ui-genesis-main`
**Historical/local source clone:** `C:\Users\conno\OneDrive\Documents\RedByte FPGA`
**Remote:** `https://github.com/swaggyp52/redbyte-ui-genesis.git`
**Audited commit:** `afc26f63`
**Latest local product audit:** `docs/audits/2026-06-12-redbyte-general-lab-workbench-audit.md`
**Latest local implementation slice:** Verify fail-edit-repair browser proof
**Target hardware:** Basys3 (`xc7a35tcpg236-1`)
**Vivado target:** 2024.2

RedByte is an FPGA educational IDE. The current product spine is Project -> Design -> Verify -> Map Pins / Hardware -> Export. Import is a utility. Board programming is an external handoff after Export. Primary package: `packages/rb-apps`.

---

## Top Priorities

1. **Start the first lab-profile/course-pack implementation seam next.** `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md` defines the target boundary; it is not implemented yet.
2. **Keep remaining Verify density / evidence workbench cleanup as a later visual slice.** The visual-system integrity sprint reduced the worst command/Export/handoff overflow, and RB-VERIFY-001 now covers the behavior loop, but it did not close every Verify workbench polish issue.
3. **Restore Vivado/Basys3 proof only on a machine with the right tools.** Fresh E1/E2/E3 proof still requires Vivado 2024.2 and hardware access.
4. **Write student/instructor quickstarts after UX/proof posture stabilizes.** Do not jump to commercial packaging, accounts/SaaS, or broad polish.

Do not jump to new features, accounts/SaaS, or commercial packaging. The current operating loop is audit -> issue index or visual plan -> narrow implementation slice -> proof -> docs update.

---

## Current Blockers / Risks

| Item | Current truth | Next action |
|------|---------------|-------------|
| Product UX baseline | `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md` is the current whole-app student/product baseline. Tests passing did not prove product readiness. | Use `docs/plans/2026-06-12-redbyte-product-issue-index.md` to route implementation slices. |
| Visual direction baseline | `docs/audits/2026-06-12-redbyte-visual-product-direction-audit.md` remains the direction baseline, and `docs/audits/2026-06-12-redbyte-visual-system-integrity-audit.md` records the latest bounded implementation proof. RedByte is directionally credible but not visually finished. | Use `docs/audits/2026-06-12-redbyte-ui-architecture-inventory.md` and `docs/plans/2026-06-12-redbyte-visual-design-hardening-plan.md` for any later visual-system cleanup slice. |
| First-viewport product blockers | Fixed in the first-viewport repair slice: Project actions and recommended starter, Design canvas/graph, Hardware map table/board, Export primary action, and Export ready-to-build rail wording are visible/aligned at 1366x768. | Keep regressions covered by `ide:gate:ece141-first-viewport`; do not reopen without fresh failing screenshot or gate evidence. |
| Hardware / Map Pins visual credibility | Fixed in the Hardware visual credibility slice: the left Map Pins guide no longer wraps authority copy word-by-word, the board/table remain the focal workbench, and `ide:gate:ece141-hardware-visual-credibility` guards the geometry at 1366x768. Local screenshots and geometry live under `.redbyte/product-immersion/hardware-visual-credibility/`. | Keep regressions covered by the new Hardware visual credibility gate and existing Map Pins recovery smoke. |
| Visual system integrity | Fixed in the visual-system integrity slice: Export handoff/evidence/action content is first-viewport visible, Draft Export no longer claims ready-to-build, Verify command/header overflow is removed, expected-output cells remain editable in the compact workbench, and `ide:gate:ece141-visual-system-integrity` guards cross-surface layout. Local screenshots and geometry live under `.redbyte/product-immersion/visual-system-integrity/`. | Keep regressions covered by `ide:gate:ece141-visual-system-integrity` plus existing hierarchy, first-viewport, product-immersion, Hardware, and Verify workbench gates. |
| General lab workbench / gate truth | Sprint 0 repaired stale Verify/Export gate assumptions and added `ide:gate:from-scratch-general-workflow`, proving a blank two-input AND project through Verify PASS, Map Pins, post-map Verify PASS, and Export artifacts/README at E0 browser level. | Keep from-scratch workflow covered; next separate architecture slice is lab-profile/course-pack implementation. |
| Verify fail-edit-repair loop | Covered 2026-06-12. `ide:gate:verify-fail-edit-repair` proves Compare PASS -> expected-output edit/stale -> rerun FAIL -> expected-output repair/stale -> rerun PASS, with Project showing PASS/CLEAN and Export showing current Verify evidence / ready-to-build. No product source fix was needed. | Keep covered by `ide:gate:verify-fail-edit-repair`; keep visual/density cleanup separate. |
| Commercial readiness | RedByte is technically credible but not commercially ready for unsupervised paid classroom use. | Keep accounts/SaaS deferred; package support/licensing only after UX, proof, and quickstarts are stronger. |
| Fresh Vivado/Basys3 proof on this desktop | Vivado 2024.2 was not found at `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`; no board proof was run here. | Use a machine with Vivado 2024.2 and a Basys3 board before making new E1/E2/E3 claims. |
| E3 observation closure | Prior controlled proof classifies rows as E2 until physical behavior is observed and recorded. | Use the existing observation templates when hardware is available. |
| Generated proof-pack availability | `.redbyte/bench/runs/**`, `out/vivado-cert/**`, `dist/**`, `test-results/**`, and `playwright-report/**` are local/ignored generated outputs and may be absent in clean clones. | Treat tracked release/proof docs as portable evidence; regenerate raw packs only when needed. |
| Lab 8 / SSD-heavy / hierarchical-bus starters | Not RC1 turnkey; complexity exceeds the current supported classroom matrix. | Keep out of scope unless the user explicitly starts that slice. |

**Resolved current blocker:** Classroom golden ZIP SHA drift was investigated on 2026-06-12. The current output was stable across repeated runs, the old SHAs were reproduced by removing only the intended README evidence-boundary section added in `4bced313`, and both golden gates pass after re-blessing the two SHA fixture files. Node 20.19.0 was not available in this shell, but the drift is source-explained rather than runtime-random.

**Resolved current blocker:** GitHub required check debt was investigated on 2026-06-12. `Classroom Truth Gates` exists as an active workflow/job and required branch-protection context; the blocker was real gate failure, not a missing workflow or stale required status. Local `classroom:gate` now passes, the workflow-equivalent no-solution/golden/dev-guard gates pass, and the Lab 8 starter is restored to an unsolved no-connection scaffold.

**Resolved/stale blocker:** `build:unified` root `dist/` lock/redirect drift is no longer a current blocker in this cockpit. `AI_STATE.md` and `docs/release/course-edition/08-validation-log.md` record later passing `pnpm build:unified` / dist verification on merged `main`. Reopen only with fresh failing evidence.

**Resolved current blocker:** The stale `ide:gate:export-ready-contract` and `ide:gate:verify-contract` caveats from the visual-system integrity closeout were repaired on 2026-06-12. The export-ready gate now uses the shared Verify-vector readiness helper, and the Verify contract now targets the current starter-backed Verify workflow instead of the retired blank banner path.

---

## Next Technical Task

**Target:** First lab-profile/course-pack data seam.

```powershell
corepack pnpm rb:doc:validate
corepack pnpm rb:encoding:check
```

For the lab-profile slice, start from `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`, `docs/audits/2026-06-12-redbyte-general-lab-workbench-audit.md`, and `RB-LAB-001` in `docs/plans/2026-06-12-redbyte-product-issue-index.md`. Keep Basys3 board semantics and proof-tier logic in core; do not mix this with remaining Verify visual/density cleanup, Vivado proof, goldens, or hardware proof.

---

## Latest Verified Evidence

| Evidence | Result |
|----------|--------|
| Verify fail-edit-repair proof | Added `ide:gate:verify-fail-edit-repair` and a focused workflow-authority regression. The browser gate proves Logic Gates Compare PASS -> rendered expected-output cell edit -> stale Verify -> rerun FAIL -> repair expected-output cell -> stale Verify -> rerun PASS, then Project diagnostics show PASS/CLEAN and Export provenance shows Checks match / READY TO BUILD. Before/after screenshots live under `.redbyte/product-immersion/verify-fail-edit-repair/`. No simulation, pin mapping, export generation, Vivado, Basys3, project format, or golden behavior changed. |
| General Lab Workbench Sprint 0 | Added `docs/audits/2026-06-12-redbyte-general-lab-workbench-audit.md` and `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`; repaired stale Verify/Export gate truth; fixed blank-project IO naming and export aliasing defects exposed by the new from-scratch workflow; added `ide:gate:from-scratch-general-workflow`. Local E0 proof shows blank project -> two inputs -> AND -> output -> Verify Compare PASS -> Map Pins -> post-map Verify Compare PASS -> Export artifact tabs/README with no visible Export diagnostics. No Vivado or Basys3 board proof was run. |
| Canonical worktree control | `C:\Users\conno\redbyte-ui-genesis-main` is now the canonical Git clone for `https://github.com/swaggyp52/redbyte-ui-genesis.git`. The prior non-git folder contents were preserved at `C:\Users\conno\redbyte-ui-genesis-main.archive-20260612-133417`, then the GitHub repo was cloned into the canonical path and fast-forwarded from the OneDrive clone through `fa116f90`. |
| Canonical dev command | `pnpm install --frozen-lockfile` passed after a user-level `pnpm@10.24.0` shim repair under `C:\Users\conno\AppData\Roaming\npm`. `pnpm run dev` served `http://localhost:5173/` with HTTP 200 in the canonical clone. |
| Visual direction stewardship audit | Browser capture covered 22 screenshots and 22 DOM summaries across public start, Project, Design, Verify, Hardware/Map Pins, Export, Import, and dirty Project resume states at `1366x768`, `1440x900`, and `1920x1080`. No console messages were recorded. The current visual direction is Course Lab Workbench; the next visual implementation path is shared token/panel/chip/action primitive cleanup before broad surface polish. Local artifacts live under ignored `.redbyte/product-immersion/visual-direction-audit/2026-06-12/`. |
| Local dev server repair | `corepack enable` still fails with `EPERM` on `C:\Program Files\nodejs\pnpm`, but the user-level pnpm shim now makes bare `pnpm run dev` work. The root dev scripts still call `corepack pnpm --filter ...`, so `corepack pnpm run dev` remains a fallback. |
| Visual system integrity repair | `ide:gate:ece141-visual-system-integrity` passed (`4` tests), proving Project/Design bounded first-viewport work areas, Verify command/evidence containment, Hardware guide/board/table visibility, and Export draft/ready handoff/evidence/action visibility. After artifacts under `.redbyte/product-immersion/visual-system-integrity/after/` show Export handoff summary fully visible at `1366x768`, evidence diagnostics materially higher in the viewport, and Verify header horizontal overflow removed. Existing hierarchy (`2`), first-viewport (`4`), product-immersion (`4`), Hardware visual credibility (`2`), Map Pins recovery (`1`), Verify workbench contract, Export download/artifact explorer contracts, viewport overflow contract, and `build:unified` passed. Later Sprint 0 work repaired the stale `export-ready-contract`, stale `verify-contract`, and focused Verify/Export Vitest expectations that were still caveats at this visual-slice closeout. |
| First-viewport repair | `ide:gate:ece141-first-viewport` passed (`4` tests), proving Project launch actions/recommended starter, Design starter canvas/node, Hardware map table/board, and Export primary action/ready wording in the 1366x768 first viewport. `ide:gate:ece141-ui-hierarchy` passed (`2` tests), `ide:gate:ece141-product-immersion` passed (`4` tests), `build:unified` passed, and preview-backed Project/Design/Hardware/Export download/viewport contracts passed. `ide:gate:export-ready-contract` still fails before Export in Verify setup with `verify had neither a visible generate-basics action nor an existing ready-vector state`; track separately unless new evidence ties it to this slice. |
| Hardware visual credibility repair | `ide:gate:ece141-hardware-visual-credibility` first failed on the old 115px Map Pins dock, then passed after the fix (`2` tests). After artifacts under `.redbyte/product-immersion/hardware-visual-credibility/after/` show the 1366x768 dock at about 187px, authority copy at 4 lines with no overflow, and the board/table still visible. Existing first-viewport, product-immersion, hierarchy, Map Pins recovery, focused Hardware Vitest, docs, encoding, diff, and unified build checks passed locally. |
| GitHub classroom truth gate repair | GitHub inspection proved `Classroom Truth Gates` is an active required workflow/job, not stale protection. Focused repaired gates passed, full `pnpm -s classroom:gate` passed all steps, and the workflow-equivalent no-solution/golden/dev-guard commands passed locally after restoring the Lab 8 starter to `connections: []`. |
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
| Done | GitHub Classroom Truth Gates repair and operations playbook. | `.agents/skills/redbyte-github-ops/SKILL.md`; `docs/development/RED_BYTE_GITHUB_OPERATIONS.md`; `classroom:gate`; workflow-equivalent no-solution/golden/dev-guard gates |
| Done | Hardware / Map Pins visual credibility repair. | `tests/e2e/ece141-hardware-visual-credibility.spec.ts`; `.redbyte/product-immersion/hardware-visual-credibility/after/` |
| Done | Visual system integrity repair for cross-surface first-viewport density, Export handoff, and Verify command containment. | `tests/e2e/ece141-visual-system-integrity.spec.ts`; `.redbyte/product-immersion/visual-system-integrity/after/`; `docs/audits/2026-06-12-redbyte-visual-system-integrity-audit.md` |
| Done | General Lab Workbench Sprint 0 and gate-truth repair. | `docs/audits/2026-06-12-redbyte-general-lab-workbench-audit.md`; `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`; `ide:gate:from-scratch-general-workflow` |
| Done | Verify fail-edit-repair-pass regression. | `scripts/gates/ide-verify-fail-edit-repair.mjs`; `.redbyte/product-immersion/verify-fail-edit-repair/after/` |
| Current implementation | First lab-profile/course-pack data seam. | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`; `RB-LAB-001` in the issue index |
| Next visual slice | Verify density / evidence workbench cleanup. | `RB-VERIFY-002`, `RB-WAVE-001` in the issue index |
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
| General lab workbench audit | `docs/audits/2026-06-12-redbyte-general-lab-workbench-audit.md` |
| Lab profile target model | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md` |
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
pnpm run dev

# Fallback if the bare pnpm shim is missing
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
