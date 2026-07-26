---
doc_status: current
last_validated: 2026-07-22
owner: Connor Angiel
used_by_claude: true
role: surface change governance
---

# RedByte IDE Surface Conformance Governance

**Document:** RB-SURF-CONF-001 v1.0
**Original issue date:** 2026-04-21
**Last validated:** 2026-07-22
**Applies to:** IDE surface work in `packages/rb-apps/src/apps/ide/**`

---

## Purpose

This document extends the repo's manual-governance model to product legitimacy work. It defines:

1. which files and docs are authoritative for each IDE surface
2. which proof docs must be reviewed when a surface changes
3. how complaints become enforceable hardening work
4. what evidence is required before surface work is considered done

---

## Four Truth Layers

RedByte product work must keep these truth layers separate:

| Layer | Meaning | Canonical source |
|---|---|---|
| Current truth | What the product does today | `docs/manuals/RedByte_Product_Manual.md`, current runtime behavior |
| Target truth | What the product must become | `docs/contracts/RedByte_Product_Contract.md` |
| Gap truth | What is still wrong or unproven | `docs/roadmap/RedByte_Gap_Audit.md` |
| Proof truth | What has been demonstrated with evidence | `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/rehearsal/failure-ticket-template.md`, screenshots, recordings, test/gate output |

Working memory, architecture notes, and bug context may live in the Obsidian vault, but they do not replace these source docs.

---

## Canonical Read Order

Before proposing or implementing any product, UX, workflow, or surface change, read:

1. `docs/contracts/RedByte_Product_Contract.md`
2. `docs/manuals/RedByte_Product_Manual.md`
3. `docs/roadmap/RedByte_Gap_Audit.md`
4. `docs/IDE_SYSTEM_MAP.md`
5. this document
6. the relevant proof doc:
   - `docs/release/manual-assignment-qa-script.md`
   - `docs/release/v1-release-checklist.md`
   - `docs/release/product-hardening-ticket-template.md`
   - `docs/rehearsal/failure-ticket-template.md`

Do not use the stale / OS-era docs listed in `docs/DOC_INDEX.md` as default context unless the task explicitly targets historical cleanup or legacy shell behavior.

---

## Surface Authority Map

| Surface / shared owner | Primary code | Must review | Proof focus |
|---|---|---|---|
| Project | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` | Product contract Project surface promise, current manual, gap audit workflow/coherence items, IDE system map, manual QA Phase 1, release checklist startup / first-run clauses | next action obvious, readiness truthful, starter/load path coherent |
| Design | `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`, `packages/rb-logic-view/src/components/NodeView.tsx` | Product contract Design promise, current manual, gap audit design-legitimacy items, IDE system map Design chrome, manual QA Phase 2 | authoring clarity, live issue visibility, selection/wiring confidence; direct sparse port targets at least `24x24`, dense clusters at least `32x24`, keyboard operation; `62%` laptop canvas conformance floor with `70%` retained as an unmet strategic target |
| Verify | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, `verifyScenario.ts`, `verifyScenarioSteps.ts`, `projectRuntime.ts`, `sim/simEngineCore.ts` | Product contract Verify promise, current manual, gap audit verify-trust items, IDE system map Verify chrome, manual QA Phase 3 | truthful current/missing/stale/failed trust; per-document combinational/sequential authorship; durable policy and pulse semantics; authored manual/custom clock execution with rising-edge-only capture; waveform/report/check agreement; separate `Edit expected` versus `Inspect Design` / `Open Design` repair paths |
| Map Pins (internal hardware mode) | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`, `packages/rb-apps/src/fpga/boards/basys3/basys3ExportContract.ts` | Product contract Map Pins promise, current manual, gap audit hardware-clarity items, IDE system map Map Pins workspace, manual QA Phase 4, release / rehearsal hardware docs | grouped Inputs/Outputs/Clock-Reset rows; logical/artifact/resource/pin domains labeled separately; inline conflict repair names all affected signals; Export and generated package consume the same semantic projection |
| Export | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`, `exportTrustState.ts`, `verifyClockPolicy.ts`, `buildExportViewModel.ts`, `testbenchGenerator.ts` | Product contract Export promise, current manual, gap audit export-trust items, IDE system map export path, manual QA Phase 5 | exact structural/`verificationTrust`/action enums stay distinct; shared materialized execution vectors plus resolved clock/schedule projection control generated `testbench.vhd` and package freshness; exact current receipt required for downloaded state; manifest/package projections agree; technical evidence and Vivado proof remain secondary/external |
| Import utility | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`, `zipImport.ts`, `importPortIdentity.ts` | Product contract Import promise, current manual, gap audit fidelity items, IDE system map import path, manual QA Phase 6 | manifest-first ZIP authority; strict scalar/vector-bit identity; embedded-XDC-only pin restore; loose sibling XDC non-authoritative; explicit Apply confirmation and cancel-without-replacement |
| Shell / workflow spine | `packages/rb-apps/src/apps/IdeApp.tsx`, `packages/rb-apps/src/apps/ide/workflowStages.ts`, `packages/rb-apps/src/apps/ide/components/IdeStageNav.tsx`, `packages/rb-apps/src/apps/ide/components/IdeTopBar.tsx`, `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx` | Unified Workbench v3 contract, Product Contract Global Shell Contract, current manual workflow language, gap audit coherence items, IDE system map, release checklist startup / determinism clauses | surfaces agree on done / attention / blocked / next / why; five horizontal stages; Import remains a utility; no permanent workflow side rail, passive orientation overlay, core workflow disclosure, contradictory CTA, duplicate status authority, required-work clipping, or unreachable actions; one `main`, named canvas, and deliberate result announcement/focus |

---

## Change Impact Matrix

When a change touches one of these file patterns, the corresponding review and proof work is mandatory.

| Changed file pattern | Must review | Minimum proof |
|---|---|---|
| `**/ProjectSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 1 | targeted tests plus a project-entry replay or screenshot showing obvious next action |
| `**/DesignSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 2 | targeted tests plus a design replay showing visible authoring / issue behavior |
| `**/VerifySurface.tsx` or `**/verify/**` | contract + manual + gap audit + system map + manual QA Phase 3 | targeted tests plus a verify replay showing run / tick / mismatch evidence behavior |
| `**/HardwareSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 4 + relevant rehearsal doc | targeted tests plus a mapping replay or screenshot proving synchronized feedback |
| `**/ExportSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 5 | targeted tests plus artifact or screenshot proof of handoff/readiness behavior |
| `**/ImportSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 6 | targeted tests plus import replay or screenshot proving fidelity messaging |
| `**/IdeApp.tsx`, `**/workflowStages.ts`, `**/IdeStageNav.tsx`, `**/IdeTopBar.tsx`, `**/IdeWorkbenchShell.tsx` | Unified Workbench v3/global shell contract + affected surface rows + release checklist | cross-surface proof that horizontal stages, active surface, primary action, status language, Import utility boundary, stable work regions, internal/root clipping, nominal-center pointer hitability, keyboard reachability, one `main`, named canvas, and result announcement/focus stay coherent |
| `**/verifyScenario*.ts`, `**/projectRuntime.ts`, `**/simEngineCore.ts` sequential-scenario paths | Verify manual/spec + system map + manual QA Phase 3 | focused scenario/runtime tests plus standalone `ide:gate:sequential-testbench-authority`; prove save/reload, duplicate/rename, Design repair, Import recovery, flat-clock hold, rising-edge-only capture, and report/waveform/check agreement |
| `**/basys3ExportContract.ts`, `**/buildExportViewModel.ts`, `**/testbenchGenerator.ts`, `**/basys3ExportService.ts` | Map Pins/Export/Import manual/specs + system map | mapping and testbench-projection tests plus standalone `ide:gate:mapping-preview-package-agreement`; preview, package, embedded manifest, and re-import must agree |
| `**/exportTrustState.ts`, Export download receipt paths | Export manual/spec + traceability + readiness docs | trust-axis unit tests and current-receipt tests; a draft download must remain draft and stale package bytes must revoke action authority |
| `**/importPortIdentity.ts`, manifest ZIP projection paths | Import manual/spec + traceability + manual QA Phase 6 | strict identity unit tests plus vector-manifest Review/Apply and `ide:gate:zip-import-recovery-contract` |

---

## Hardening Ticket Requirement

Before coding a product complaint, convert it into a structured hardening ticket. Use one of:

- `docs/release/product-hardening-ticket-template.md`
- `.github/ISSUE_TEMPLATE/product-hardening.yml`

Every ticket must capture:

1. journey segment
2. surface and mode
3. environment and whether it reproduces on a fresh machine / clean profile
4. observed behavior
5. expected behavior
6. exact repro steps
7. evidence
8. violated contract / QA / current-truth clause
9. minimum acceptance proof
10. docs that must be reviewed or updated if the behavior changes

No "make it better" work starts without this structure.

---

## Update Process

For any surface change:

1. Classify the problem in a hardening ticket.
2. Read the canonical docs in the required order.
3. Identify which truth layers are affected:
   - current truth
   - target truth
   - gap truth
   - proof truth
4. Implement the smallest reversible fix.
5. Run focused proof for the touched surface.
6. Update impacted docs if behavior, wording, or proof obligations changed.
7. Add a factual `AI_STATE.md` Change Log entry for meaningful changes.

---

## Closure Standard

Surface work is not done when tests merely pass. It is done when:

- the implementation is correct
- the affected surface still matches the contract
- the current-truth docs remain honest
- the relevant QA / rehearsal proof still passes or is updated
- the hardening ticket's acceptance proof is satisfied
- required actions are not internally clipped, their nominal centers are pointer-hittable, and they remain keyboard reachable
- landmark, canvas-name, and simulation-result announcement/focus obligations are explicitly replayed when affected

For an RC claim, focused proof is necessary but not sufficient. The final docs-complete tree must be reconstructed on a clean non-main branch, match the approved source tree exactly, and run the complete acceptance program on one exact SHA. A source-slice pass, an earlier browser capture, or a successful download cannot be carried forward as final-SHA certification after the tree changes.

---

## Invariants

These rules apply across all surfaces:

1. The next correct action must be obvious.
2. No surface may imply readiness that does not exist.
3. Status, CTA language, and stage ownership must agree across surfaces.
4. The five student stages - Project, Design, Verify, Map Pins, and Export - must state the next student action in the owning workspace. Import must remain a separate utility, and neither the stages nor the utility may inject a competing global guidance panel or claim unproven readiness.
5. Visual cleanup without proof does not count as hardening.
6. Historical shell / OS narratives are not current product truth.
7. Batch 1 product-state vocabulary is canonical across surfaces: draft design, simulated, testbench configured, Compare passed, pins mapped, draft export, trusted export, Vivado built, board programmed, board observed.
8. Observe runs may explain behavior, but only current Compare PASS can complete the Verify proof stage for a trusted Export handoff; Map Pins owns only assignment coherence and does not reclassify Verify evidence.
9. Required work and actions may have neither root overflow nor masked internal clipping.
10. Required action centers must be pointer-hittable and the same actions must remain keyboard reachable.
11. The active product exposes exactly one `main` landmark and the primary circuit canvas has an accessible name.
12. Verify run results are announced and focus remains deliberate rather than being lost behind post-run chrome.
13. A sequential execution policy belongs to one named browser-local testbench document. It must survive document lifecycle/recovery and must not silently become a portable `RBProject` field. Authored rows and policy are materialized into the shared execution vectors consumed by runtime Verify, bring-up expectations, and generated `testbench.vhd` together with the resolved clock/schedule projection. Auto `runCycles`, automatic reset behavior, resolved clock data, starting level, and authored stimulus may change derived package bytes, Export freshness, and old-receipt authority.
14. Logical signal identity, artifact port identity, board-resource identity, and package-pin identity must remain separate and traceable through one semantic mapping projection.
15. Export structural state (`blocked` / `downloadable`), `verificationTrust` (`unverified` / `draft` / `trusted`), and action (`not-downloaded` / `downloaded`) are independent. Verify evidence currentness stays upstream. Only an exact current receipt can report the current package as downloaded, and download alone cannot promote trust.
16. Manifest-first Import may restore projected vector-bit pins from the manifest's embedded XDC only. Loose sibling HDL/XDC cannot override the manifest.
17. RC release claims require exact-SHA proof after docs and reconstruction, including separate invocations of `ide:gate:sequential-testbench-authority` and `ide:gate:mapping-preview-package-agreement`, the uninterrupted 72-step classroom aggregate, and required human/reviewer dispositions. The aggregate does not replace either standalone gate.

Fresh frozen unified-gate metrics generated at `2026-07-15T16:47:52.947Z` record available three-region Design workbench canvas share (`canvas / (canvas + library + inspector)`) of `64.81%` at `1366x768`, `66.67%` at `1440x900`, and `75.16%` at `1920x1080`. The `62%` laptop floor conforms; the strategic `70%` laptop target remains unmet debt.

---

## Related Docs

- `docs/contracts/RedByte_Product_Contract.md`
- `docs/manuals/RedByte_Product_Manual.md`
- `docs/roadmap/RedByte_Gap_Audit.md`
- `docs/IDE_SYSTEM_MAP.md`
- `docs/release/manual-assignment-qa-script.md`
- `docs/release/v1-release-checklist.md`
- `docs/release/product-hardening-ticket-template.md`
- `docs/rehearsal/failure-ticket-template.md`

## Attribution

Connor Angiel
