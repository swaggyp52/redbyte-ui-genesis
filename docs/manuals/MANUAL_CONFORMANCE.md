# RedByte Product Manual — Conformance Governance

**Document:** RB-CONF-001 v1.2
**Date:** 2026-07-22
**Applies to:** `docs/manuals/RedByte_Product_Manual.md` and `docs/manuals/RedByte_Product_Manual_print.html`

---

## Purpose

This document defines the rules that keep the product manual accurate as the codebase evolves. It establishes:

1. Which source files are authoritative for each class of manual claim.
2. Which sections of the manual must be reviewed when specific source files change.
3. The process for updating the manual on each type of change.
4. The audit cadence.

---

## Authoritative Source Map

The following table is the canonical mapping between codebase artifacts and the manual sections they govern. When a source file changes, all corresponding manual sections must be reviewed.

| Source File | Governs Manual Section(s) | Critical Claims |
|-------------|--------------------------|-----------------|
| `packages/rb-logic-core/src/builtins.ts` | §2.3, §7.2, Appendix A | Primitive behaviors and port names, including NOR/XNOR |
| `packages/rb-logic-core/src/index.ts` | §7.2, Appendix A | 27 direct primitive registrations plus 4 composite registrations (31 registry additions) |
| `packages/rb-logic-core/src/analysis/componentSupportRegistry.ts` | §7.2, Appendix A | Student authoring/classroom palette eligibility versus runtime-only or compatibility support |
| `packages/rb-apps/src/apps/ide/workflowStages.ts` | §4.1, §6, §7 | Surface names, IdeMode values |
| `packages/rb-apps/src/apps/ide/verifyHints.ts` | §7.3, §9 | Hint count (currently 14), hint conditions |
| `packages/rb-apps/src/apps/ide/projectRuntime.ts`, `sim/simEngineCore.ts` | §4.3, §4.4, §7.3, §9 | Freshness/staleness triggers; authored manual/custom clock execution; rising-edge-only capture; runtime report/waveform/check agreement |
| `packages/rb-apps/src/apps/ide/verifyScenario.ts`, `verifyScenarioSteps.ts` | §7.3, §9 | Named-document lifecycle, authored steps, per-document sequential execution policy |
| `packages/rb-apps/src/apps/ide/exportTrustState.ts` | §4.1, §7.5, §13 | Structural/verification/action trust axes and current package receipt authority |
| `packages/rb-apps/src/apps/ide/verifyClockPolicy.ts`, `viewmodels/buildExportViewModel.ts` | §4.3, §4.4, §4.6, §7.3, §7.5, §9, §11, §14 | Shared execution-vector materialization, resolved clock/schedule projection, Export freshness, and generated artifact agreement |
| `packages/rb-apps/src/apps/ide/importPortIdentity.ts`, `zipImport.ts` | §4.7, §7.6, §12, Appendix E | Manifest-first recovery, exact scalar/vector-bit identity, sibling-file authority |
| `packages/rb-apps/src/apps/ide/examplesCatalog.ts` | §5.3 | Starter example names and IDs |
| `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` | §7.4, §10 | Map Pins table/editor/board labels, mapping state, proof boundaries |
| `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | §7.3, §9 | Observe/Compare authority and Edit expected / Inspect Design / Open Design repair actions |
| `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | §7.5, §11, §13 | Trusted versus draft downloads, file browser/preview, technical-evidence dialog, repair routing |
| `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` | §7.6, §12 | Upload source choices, Review/Apply sequence, fidelity, cancel preservation, and replacement UI strings |
| `packages/rb-apps/src/apps/IdeApp.tsx` | §3.4, §4.7 | Application contexts, IdeImportFidelity enum |
| `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts` | §10, §11, §14, Appendix B, C | XDC filename, entity name, pin definitions, LVCMOS33 |
| `packages/rb-apps/src/fpga/boards/basys3/basys3ExportContract.ts`, `basys3ExportModel.ts`, `basys3ExportService.ts` | §4.6, §7.4, §7.5, §10, §14 | Semantic mapping projection, canonical artifact/manifest projection, package receipt inputs |
| `packages/rb-apps/src/fpga/boards/basys3/testbenchGenerator.ts` | §4.6, §11.4, Appendix C | Testbench entity name (`tb_top`) and auto-versus-manual/custom clock-drive structure |
| `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts` | §11.2, §14.2 | ZIP file contents, testbench top module |
| `packages/rb-apps/src/import/hdlToCircuit.ts` | §4.7, §12, Appendix E | COMPONENT_MAP size, internal fidelity levels |
| `packages/rb-apps/src/export/submissionBundle.ts` | §13, §14 | SHA-256 hashing, manifest structure |
| `packages/rb-apps/src/apps/ide/components/IdeStageNav.tsx`, `IdeTopBar.tsx`, `IdeWorkbenchShell.tsx` | §6 | Horizontal stage entries, Import utility, persistent shell regions |
| `packages/rb-logic-view/src/components/NodeView.tsx`, `packages/rb-apps/src/apps/ide/surfaces/design-workbench-v3.css` | §7.2 | Port target geometry, keyboard affordance, Design workbench occupancy |
| `docs/ARCHITECTURE.md` | §3.4, §4.4 | Five-layer architecture, application contexts |
| `docs/STUDENT_UX_LAYER.md` | §3.1, §3.2, §7 | UX constraints, diagnostic visibility rules |
| `docs/VIVADO_INTEGRATION.md` | §11 | Vivado workflow, generated file purposes |

---

## Change Impact Matrix

When a PR touches any of these file patterns, the manual must be reviewed for the indicated sections:

| Changed File Pattern | Must Review | Likely Change Type |
|---------------------|-------------|-------------------|
| `**/builtins.ts`, `**/index.ts`, `**/componentSupportRegistry.ts` | §7.2, Appendix A | New/removed behavior, registry-count change, or palette/support change |
| `**/workflowStages.ts` | §4.1, §6 | New surface or renamed mode |
| `**/verifyHints.ts` | §9 | Hint count change |
| `**/verifyScenario.ts`, `**/verifyScenarioSteps.ts`, `**/projectRuntime.ts`, `**/simEngineCore.ts` | §4.3, §4.4, §7.3, §9 | Named-document lifecycle, sequential policy, persistence/freshness, or manual/custom runtime execution change |
| `**/exportTrustState.ts`, `**/buildExportViewModel.ts` | §4.6, §7.4, §7.5, §10, §13, §14 | Trust axes, receipt, mapping/package projection change |
| `**/basys3ExportContract.ts`, `**/basys3ExportModel.ts`, `**/basys3ExportService.ts` | §4.6, §7.4, §7.5, §10, §14 | Generated artifact/manifest/mapping agreement change |
| `**/zipImport.ts`, `**/importPortIdentity.ts` | §4.7, §7.6, §12, Appendix E | Manifest authority or scalar/vector-bit identity change |
| `**/NodeView.tsx`, `**/design-workbench-v3.css` | §7.2 | Port affordance, interaction target, or Design geometry change |
| `**/basys3Bundle.ts` | §10, §11, Appendix B/C | Pin change, filename change |
| `**/verifyClockPolicy.ts`, `**/testbenchGenerator.ts` | §4.3, §4.4, §4.6, §11.4, Appendix C | Shared vector materialization, Auto cycle/reset semantics, or generated-testbench structure change |
| `**/vivadoProjectFolder.ts` | §11.2, §14.2 | ZIP content change |
| `**/hdlToCircuit.ts` | §12, Appendix E | Import behavior change |
| `**/submissionBundle.ts` | §13 | Submission format change |
| `**/ImportSurface.tsx` | §7.6, §12 | Upload-source, recovery-step, fidelity, or replacement-label change |
| `**/HardwareSurface.tsx` | §7.4, §10 | Map Pins table/editor/board or mapping-state change |
| `**/VerifySurface.tsx` | §7.3, §9 | Repair action, run authority, or evidence wording change |
| `**/ExportSurface.tsx` | §7.5, §11, §13 | Download trust, file workspace, or technical-evidence change |
| `**/IdeStageNav.tsx`, `**/IdeTopBar.tsx`, `**/IdeWorkbenchShell.tsx` | §6 | Shell or navigation composition change |
| `**/IdeApp.tsx` | §3.4 | Context or enum change |
| `docs/ARCHITECTURE.md` | §3.4, §4.4 | Architecture change |

---

## Update Process

### For any code change that touches a file in the Authoritative Source Map:

1. **Identify impact.** Use the Change Impact Matrix to determine which manual sections are affected.
2. **Review sections.** Open `RedByte_Product_Manual.md` and read all affected sections against the new code.
3. **Apply corrections.** Edit both `RedByte_Product_Manual.md` and `RedByte_Product_Manual_print.html` to match the new ground truth.
4. **Record the correction.** Add a row to `MANUAL_CLAIM_AUDIT.md` under a new "Change Log" section with: date, changed source file, old claim, new claim, section updated.
5. **Regenerate PDF.** Run `pnpm docs:manual:pdf` to regenerate `RedByte_Product_Manual.pdf`.
6. **Update traceability.** If a new claim was added, add a row to `MANUAL_TRACEABILITY_MATRIX.md`.

For an explicitly documented RC source slice, Markdown and print HTML may land before the final PDF only when the candidate note names the exact source SHA and records PDF generation/visual inspection as pending for the reconstructed final candidate SHA. The released manual must still include a regenerated and visually verified PDF.

### For new features:

1. **Draft new section.** Add documentation to the manual covering the new feature.
2. **Add traceability rows.** Every new claim must have a corresponding row in `MANUAL_TRACEABILITY_MATRIX.md` with the source file and line numbers.
3. **Run audit pass.** Verify new claims against the code before merging.

---

## Audit Cadence

| Trigger | Action |
|---------|--------|
| Any PR that touches a file in the Source Map | Targeted review of affected sections (see Update Process) |
| Major version release | Full audit pass — re-verify all rows in the Traceability Matrix |
| Quarterly (or every 3 sprints) | Spot audit — randomly sample 10 claims and verify against code |
| New engineer onboarding | Full manual read to ensure understanding of documented behaviors |

---

## Invariants (Never-Change Claims)

These claims have been stable since the first version and should only change if the corresponding architectural decision is explicitly reversed:

1. **Connection format is nested** — `{ from: { nodeId, portName }, to: { nodeId, portName } }`. Enforced by `normalizePortRef`. Never use flat format.
2. **Simulation is deterministic** — same state + same inputs = same outputs, every run, every machine.
3. **Local-first** — all computation in browser. No server dependency for core functions.
4. **One truth, many views** — circuit is the single source; all surfaces are projections.
5. **LVCMOS33 I/O standard** for all Basys 3 ports.
6. **Top entity name is `top`** — default entity name; overridable but `top` is the canonical default.
7. **Testbench entity pattern is `tb_<topModule>`** — currently `tb_top`.
8. **Five numbered stages only** — Project, Design, Verify, Map Pins, Export; Import / Recover is a separate utility.
9. **Named Verify sequential policy is document-owned and browser-local** — do not silently promote it into portable `RBProject` authority. Its authored rows and policy may nevertheless change the shared materialized execution vectors and resolved clock/schedule projection that control generated `testbench.vhd`, package bytes, Export freshness, and receipt authority.
10. **Mapping is one semantic projection** — logical signal, artifact port, board resource, package pin, I/O standard, XDC line, and conflict state must agree across Map Pins and Export.
11. **A trusted receipt describes the exact downloaded package** — source/project/Verify/mapping/download/trust/hash inputs cannot be reused after authority changes.
12. **RedByte ZIP recovery is manifest-first** — loose siblings cannot override a valid embedded manifest, and scalar/vector-bit identities remain exact.
13. **Sequential and mapping authority gates are standalone RC requirements** — run `ide:gate:sequential-testbench-authority` and `ide:gate:mapping-preview-package-agreement` separately from the uninterrupted 72-step classroom aggregate; the aggregate does not substitute for either gate.

---

## Prohibited Manual Claims

The following categories of claim are prohibited in the manual because they cannot be verified from code:

- Claims about runtime performance (latency, throughput) unless benchmarked and cited.
- Claims about browser compatibility beyond "any modern browser with JavaScript."
- Claims that NOR and XNOR are unavailable or merely type-defined; both are registered, support-matrix approved, and present in the current palette.
- Claims that registry count equals palette count; the runtime has 27 direct plus 4 composite registry additions, while the support registry governs student visibility.
- Instructions to place a generic Clock block from the current Design palette; use Basys3 `CLK100MHZ` for FPGA intent or the automatic internal simulation clock policy.
- Claims that the normal Map Pins flow assigns by clicking the board graphic, selecting a preset, or using a global clear; the row action, selected-signal resource selector, and Save assignment are authoritative.
- Claims that trusted and draft Export downloads are interchangeable, or that current diagnostics live in an Advanced panel instead of the technical-evidence dialog.
- Claims that a named Verify document or its sequential policy is portable across archives/browsers merely because browser-local persistence works.
- Claims that loose HDL/XDC siblings may override a valid RedByte manifest, or that vector-bit identities may be normalized into different scalar ports.
- Claims that every RedByte-generated concurrent-assignment `top.vhd` is ports-only; the supported generated subset reconstructs its graph, while arbitrary behavioral/process HDL remains partial or blocked.
- Claims that Browser-E0 source evidence proves Vivado build, bitstream generation, board programming, or physical behavior.
- Claims about VHDL reserved-word keyword validation (not implemented).
- Claims that SubmissionInspectorApp is a separate launchable application (it is an architectural context, inspector delivered via Project surface).
- Claims about the number of hint conditions unless `verifyHints.ts` is re-audited.

---

## Contacts

| Role | Responsibility |
|------|---------------|
| Manual owner | Connor Angiel — approves all manual changes |
| Code reviewer | Any PR reviewer touching Source Map files must check manual impact |

---

*End of Conformance Governance*
