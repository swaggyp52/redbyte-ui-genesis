# RedByte Product Manual — Claim Audit

**Document:** RB-AUDIT-001 v1.2
**Date:** 2026-07-22
**Auditor:** Connor Angiel
**Scope:** Material claims in `RedByte_Product_Manual.md` v1.2 reconciled against current code, tests, architecture docs, and Unified Workbench v3 RC source evidence.

---

## Audit Method

Three parallel audit passes were run against the repo:

1. **Logic-core & primitives audit** — Verified gate registry, simulation engine, connection format, determinism claims.
2. **FPGA pipeline & export audit** — Verified Vivado export filenames, XDC generation, testbench entity names, pin counts, submission packaging.
3. **UX surface & import audit** — Verified surface names, tab labels, import fidelity levels, hint counts, example catalog.

Each claim is rated:

| Status | Meaning |
|--------|---------|
| **VERIFIED** | Claim matches code exactly. No change needed. |
| **CORRECTED** | The audit found an incorrect or stale claim and the current Markdown/print manuals now match source truth. |
| **PARTIAL** | Claim is directionally correct but imprecise. Needs tightening. |
| **NEEDS EDIT** | Claim is factually wrong. Must be corrected. |
| **RESULT-DEPENDENT** | Semantic wording is prepared, but final exact-tree source/test evidence has not yet been recorded here. |

---

## Findings

### Batch 1 Addendum (2026-04-30)

| Field | Value |
|-------|-------|
| **Claim** | Manual now states that RedByte is a deterministic FPGA learning/project-building environment with draft, trusted, and external proof states. |
| **Sections** | §2.1, §4.1, §11 |
| **Status** | **VERIFIED** |
| **Source** | `docs/contracts/RedByte_Product_Contract.md`, `docs/IDE_SYSTEM_MAP.md`, `projectWorkflowAuthority.ts`, `projectTruth.ts`, `docs/release/vivado-basys3-certification-matrix.md` |
| **Proof** | `pnpm lab:vivado:cert:custom -- --case b1-mixed ...` and `--case b1-counter ...` passed E1; browser gate drift is tracked separately in `docs/release/product-hardening-ticket-2026-04-30-browser-rehearsal-gates.md`. |
| **Correction** | Replaced old linear workflow wording with the exact RedByte-owned Project -> Design -> Verify -> Map Pins -> Export spine, identified Vivado build, board programming, and board observation as downstream proof activities, and removed "all rights reserved" boilerplate per legal attribution rules. |

---

### 1. XDC Filename

| Field | Value |
|-------|-------|
| **Claim** | Manual references `constraints.xdc` as the generated constraints file. |
| **Sections** | §11.1 (Generated Files table), §14, Appendix C, multiple inline references |
| **Status** | **CORRECTED** |
| **Source** | `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts` line 191: filename is `top.xdc` |
| **Tests** | Basys3 bundle tests confirm `top.xdc` output |
| **Correction** | Replace all instances of `constraints.xdc` with `top.xdc`. |

---

### 2. Testbench Entity Name

| Field | Value |
|-------|-------|
| **Claim** | Manual references testbench entity as `top_tb`. |
| **Sections** | §11.1, Appendix C, inline code references |
| **Status** | **CORRECTED** |
| **Source** | `packages/rb-apps/src/fpga/boards/basys3/testbenchGenerator.ts` lines 292–293, 402–403: entity is `tb_top`. Confirmed by `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts` line 36: `const TESTBENCH_TOP_MODULE = 'tb_top'`. |
| **Tests** | Testbench generator tests assert `tb_top` entity name |
| **Correction** | Replace all instances of `top_tb` with `tb_top`. |

---

### 3. Import Recovery Sequence

| Field | Value |
|-------|-------|
| **Claim** | Manual presents Import as a horizontal Upload -> Review -> Apply recovery sequence, with ZIP, Paste HDL, conditional Paste XDC, and samples as source choices inside Upload. |
| **Sections** | §7.6, §12 |
| **Status** | **VERIFIED** |
| **Source** | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` and `import-recovery-workspace-v3.css`: horizontal stepper, source switch inside Upload, XDC choice after parsed HDL, reviewed candidate, cancel preservation, and explicit in-app apply confirmation. |
| **Correction** | Replaced the predecessor tab model with the current recovery sequence and described HDL/XDC as Upload-source choices rather than workflow tabs. |

---

### 4. NOR and XNOR Gate Availability

| Field | Value |
|-------|-------|
| **Claim** | Manual lists NOR and XNOR as available primitive gates and distinguishes student-palette visibility from runtime registry size. |
| **Sections** | §2.2, §7.2 (Component Palette), Appendix A |
| **Status** | **CORRECTED** |
| **Source** | `packages/rb-logic-core/src/index.ts` registers both `NORBehavior` and `XNORBehavior`; `componentSupportRegistry.ts` marks both authoring/classroom capable; `DesignSurface.tsx` includes both palette cards. `index.ts` performs 27 direct primitive registrations and then 4 composite registrations (`RSLatch`, `DLatch`, `FullAdder`, `Counter4Bit`) for 31 registry additions. |
| **Correction** | Restored NOR/XNOR to the current palette reference, added Register1/RegisterBus/StateBank, removed the generic Clock card from current palette guidance, and documented 27 direct plus 4 composite registry additions without equating registry presence to palette availability. |

---

### 5. Verification Hint Count

| Field | Value |
|-------|-------|
| **Claim** | Manual states the verify engine provides "up to 7 fact-grounded diagnostic hints." |
| **Sections** | §9 |
| **Status** | **CORRECTED** |
| **Source** | `packages/rb-apps/src/apps/ide/verifyHints.ts` lines 48–121: the HINTS array contains **14 diagnostic conditions**. |
| **Correction** | Replace "up to 7" with "14 diagnostic conditions" or "over a dozen diagnostic conditions." |

---

### 6. COMPONENT_MAP Size (Import Pipeline)

| Field | Value |
|-------|-------|
| **Claim** | Manual states the import pipeline maps "26 HDL component types." |
| **Sections** | §12, Appendix D/E |
| **Status** | **CORRECTED** |
| **Source** | `packages/rb-apps/src/import/hdlToCircuit.ts` lines 60–97: COMPONENT_MAP contains **37 HDL name variants** (e.g., `and2`, `AND`, `and_gate` all map to the same type) that resolve to **9 distinct RedByte node types**. |
| **Correction** | Replace "26 HDL component types" with "37 HDL name variants mapping to 9 RedByte node types." |

---

### 7. VHDL Keyword Validation

| Field | Value |
|-------|-------|
| **Claim** | Manual states the export pipeline validates entity names against VHDL reserved keywords. |
| **Sections** | §11 |
| **Status** | **CORRECTED** |
| **Source** | No VHDL keyword checking logic found in `basys3Bundle.ts`, `vhdlGenerator.ts`, or `vivadoProjectFolder.ts`. The entity name defaults to `'top'` (line 247 of basys3Bundle.ts) with an optional override, but no keyword validation exists. |
| **Correction** | Remove the VHDL keyword validation claim, or soften to "the default entity name `top` avoids VHDL reserved words." |

---

### 8. SubmissionInspectorApp

| Field | Value |
|-------|-------|
| **Claim** | Manual describes SubmissionInspectorApp as a functioning application context for instructors. |
| **Sections** | §3 (Application Contexts), §13 |
| **Status** | **CORRECTED** |
| **Source** | `docs/ARCHITECTURE.md` defines SubmissionInspectorApp as one of four application contexts. However, no standalone `SubmissionInspectorApp.tsx` implementation file was found. The submission inspection UI appears to be integrated into IdeApp's Project surface rather than existing as a separate app. |
| **Correction** | Clarify that SubmissionInspectorApp is an architecturally defined context whose inspector functionality is currently delivered through the IDE's Project surface. Do not claim it as a separate launchable application. |

---

### 9. Vivado Export ZIP Contents

| Field | Value |
|-------|-------|
| **Claim** | Manual states the export ZIP contains three files: `top.vhd`, `constraints.xdc` (see finding #1), `testbench.vhd`. |
| **Sections** | §11.1, §14, Appendix C |
| **Status** | **CORRECTED** |
| **Source** | `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts` generates a ZIP containing: `top.vhd`, `top.xdc`, `testbench.vhd`, `vivado_import.tcl`, `README.txt`, `BRINGUP.md`, `EXPECTED_IO.json`, `program_and_test.tcl`, `project.rbproj.json`. |
| **Correction** | List all generated files. The three HDL/XDC files are the primary deliverables; the remaining files are support/automation files. Describe both tiers. |

---

### 10. Import Fidelity Levels

| Field | Value |
|-------|-------|
| **Claim** | Manual uses fidelity labels "Full," "Reconstructed," "Partial." |
| **Sections** | §12, Appendix D/E |
| **Status** | **VERIFIED** |
| **Source** | Internal code uses `'full' | 'ports-only' | 'empty'` (`hdlToCircuit.ts` line 43). The UI layer in `IdeApp.tsx` line 101 maps these to `'full' | 'reconstructed' | 'partial'`. The manual correctly documents the user-facing labels. |
| **Correction** | None needed. Optionally add a developer note about the internal mapping. |

---

### 11. Starter Examples

| Field | Value |
|-------|-------|
| **Claim** | Manual lists 5 starter examples: Signal Tour, Logic Gates, Half Adder, Full Adder, Two-Bit Counter. |
| **Sections** | §5.3 |
| **Status** | **VERIFIED** |
| **Source** | `packages/rb-apps/src/apps/ide/examplesCatalog.ts` contains exactly these 5 examples: `signal-tour`, `logic-gates`, `half-adder`, `full-adder`, `two-bit-counter`. Additionally, `packages/rb-apps/src/fpga/boards/basys3/examples.ts` has 3 board-specific examples (Switches→LEDs, Seven-Seg Counter, Debounced Button Toggle) which are separate from the IDE examples. |
| **Correction** | None needed for IDE examples. Consider mentioning the 3 Basys3-specific examples separately. |

---

### 12. Five Stages Plus Import Utility

| Field | Value |
|-------|-------|
| **Claim** | Manual documents five horizontal workflow stages—Project, Design, Verify, Map Pins, Export—and Import / Recover as an unnumbered utility. |
| **Sections** | §6, §7.1–7.6 |
| **Status** | **VERIFIED** |
| **Source** | `workflowStages.ts` retains six internal modes; `IdeStageNav.tsx` renders exactly five stages and `IdeTopBar.tsx` exposes Import as a utility. `ide-unified-workbench-v3-flow.mjs` rejects a permanent workflow rail and sixth numbered stage. |
| **Correction** | Replaced the predecessor six-entry left-rail claim with the five-stage horizontal authority plus Import utility. |

---

### 13. Map Pins Workspace

| Field | Value |
|-------|-------|
| **Claim** | Manual describes Map Pins as a table-first assignment workspace with a stable selected-signal editor and secondary board reference. |
| **Sections** | §7.4, §10 |
| **Status** | **VERIFIED** |
| **Source** | `HardwareSurface.tsx`, `hardware-mapping-workspace-v3.css`, and `ide-hardware-mapping-conflict-repair.mjs` cover progress, mapping rows, selected resource/package-pin/XDC consequence, conflict repair, and secondary Basys3 reference. |
| **Correction** | Removed the predecessor four-tab claim from the current student path. |

---

### 14. Basys 3 Pin Counts

| Field | Value |
|-------|-------|
| **Claim** | 16 switches, 16 LEDs, 5 buttons, 7-segment display, CLK100MHZ at W5. |
| **Sections** | §10, Appendix B |
| **Status** | **VERIFIED** |
| **Source** | `basys3Bundle.ts` pin definitions match these counts. W5 clock confirmed. LVCMOS33 I/O standard confirmed at line 158. |
| **Correction** | None. |

---

### 15. Connection Format

| Field | Value |
|-------|-------|
| **Claim** | Manual documents nested connection format `{ id, from: { nodeId, portName }, to: { nodeId, portName } }`. |
| **Sections** | §4, developer references |
| **Status** | **VERIFIED** |
| **Source** | `CLAUDE.md` explicitly states this is the canonical format. `normalizePortRef` in `projectFormat.ts` enforces it. |
| **Correction** | None. |

---

### 16. SHA-256 Submission Hashing

| Field | Value |
|-------|-------|
| **Claim** | Submission packaging uses SHA-256 deterministic hashing. |
| **Sections** | §13, §14 |
| **Status** | **VERIFIED** |
| **Source** | `packages/rb-apps/src/export/submissionBundle.ts` lines 114–120, 284–291: uses `crypto.subtle.digest('SHA-256', bytes)`. |
| **Correction** | None. |

---

### 17. Deterministic Simulation (Topological Sort)

| Field | Value |
|-------|-------|
| **Claim** | Simulation uses topological sort (Kahn's algorithm) for deterministic evaluation. |
| **Sections** | §4.2 |
| **Status** | **VERIFIED** |
| **Source** | Logic core implements topological sort for node evaluation ordering. Determinism contract documented in `docs/00-canon/02-determinism-contract.md`. |
| **Correction** | None. |

---

### 18. Five-Layer Architecture

| Field | Value |
|-------|-------|
| **Claim** | Five layers: A (Logic Core), B (Verification), C (Vivado Adapter), D (Submission Engine), E (Student UX Shell). |
| **Sections** | §4.4 |
| **Status** | **VERIFIED** |
| **Source** | `docs/ARCHITECTURE.md` confirms the five-layer model with these exact names and responsibilities. |
| **Correction** | None. |

---

### 19. Verify Repair Actions

| Field | Value |
|-------|-------|
| **Claim** | The manual names the current failure-repair actions: Edit expected for a wrong saved check, Inspect Design for a circuit mismatch, and Open Design for a structural preflight failure. |
| **Sections** | §7.3, §9 |
| **Status** | **VERIFIED** |
| **Source** | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` renders `ide-verify-repair-edit-expected`, `ide-verify-repair-open-design` with visible label `Inspect Design`, and `ide-verify-structural-open-design` with visible label `Open Design`. |
| **Correction** | Removed the stale `Jump to failing node` action from the current workflow. |

---

### 20. Export Workspace and Trust Actions

| Field | Value |
|-------|-------|
| **Claim** | Export separates trusted Download Package from untrusted Download draft, keeps a stable file browser/preview, and opens diagnostics/provenance in a secondary technical-evidence dialog. |
| **Sections** | §7.5, §11, §13 |
| **Status** | **VERIFIED** |
| **Source** | `ExportSurface.tsx` renders `ide-export-package-download-v1`, `ide-export-draft-download-v1`, `ide-export-file-browser`, and the `ide-export-technical-dialog` opened by `Open technical evidence`; Project/Map Pins use `Open Export` for routing. |
| **Correction** | Removed stale `Export Submission`, advanced-panel, and predecessor Export-control wording from the current student path. |

---

### 21. Clock Authoring Boundary

| Field | Value |
|-------|-------|
| **Claim** | The current Design palette does not expose a generic Clock block; FPGA clock intent uses the Basys3 `CLK100MHZ` resource, while pure simulation can use an automatically injected internal clock. |
| **Sections** | §2.3, §7.2, §8.4, §10, §15, §16, Appendix A |
| **Status** | **VERIFIED** |
| **Source** | `DesignSurface.tsx` explicitly removes the Sim Clock palette entry; `componentSupportRegistry.ts` marks `Clock` non-authorable and identifies it as legacy/sim; `verifySchedule.ts` and current Verify clock policy own automatic simulation clock behavior. |
| **Correction** | Removed instructions to place a Clock node from the current Design palette and kept the registered legacy/runtime behavior clearly separate from student authoring. |

---

### 22. Named Verify Document Sequential Policy

| Field | Value |
|-------|-------|
| **Claim** | Each named Verify document owns its browser-local sequential policy. One shared materializer produces the execution vectors consumed by runtime Verify, bring-up expectations, and generated `testbench.vhd` together with the resolved clock/schedule projection. Manual/custom rows advance rising-edge state only on authored low-to-high transitions. Auto materializes cycle 0 and `runCycles`, including automatic reset in the visible vector sequence, and samples/asserts every row post-rising-edge. |
| **Sections** | §2.5, §4.3, §4.4, §4.6, §7.3, §9, §11.4, §14.1, Glossary, Appendix C |
| **Status** | **RESULT-DEPENDENT** |
| **Source** | `verifyScenario.ts`, `verifyScenarioSteps.ts`, and `projectRuntime.ts` own document lifecycle/persistence; `verifyClockPolicy.ts` owns shared vector materialization; `simEngineCore.ts` owns execution; `buildExportViewModel.ts` consumes materialized vectors plus the resolved clock/schedule projection; `testbenchGenerator.ts` owns Auto-versus-manual/custom VHDL structure; `exportTrustState.ts` owns resulting freshness/receipt classification. |
| **Tests** | Standalone `ide:gate:sequential-testbench-authority` plus the focused runtime/generated-testbench/freshness test inventory recorded by the exact-tree release program. The 72-step aggregate is not a substitute for the standalone gate. |
| **Correction** | Split browser-local storage from runtime/package authority; added shared vector materialization, rising-edge-only capture, supported authored falling transitions, explicit Auto cycle-0/run-cycle/reset materialization, no hidden runtime reset prelude, post-rising-edge Auto sampling/assertion, and Export-staleness semantics. |

---

### 23. Semantic Mapping Projection

| Field | Value |
|-------|-------|
| **Claim** | Map Pins and Export share one semantic projection across logical signal identity, direction, artifact port, board resource, package pin, I/O standard, exact XDC line, required state, and conflict state. |
| **Sections** | §2.5, §7.4, §10 |
| **Status** | **RESULT-DEPENDENT** |
| **Source** | `HardwareSurface.tsx`, `basys3ExportContract.ts`, `basys3ExportModel.ts`, `basys3ExportService.ts`, and `buildExportViewModel.ts`. |
| **Tests** | Standalone `ide:gate:mapping-preview-package-agreement` plus `ide:gate:hardware-phase5-contract`. The 72-step aggregate is not a substitute for the standalone mapping/package gate. |
| **Correction** | Added the semantic projection contract and row-local conflict language. |

---

### 24. Export Trust Axes and Package Receipt

| Field | Value |
|-------|-------|
| **Claim** | Export separates structural `blocked` / `downloadable`, `verificationTrust` `unverified` / `draft` / `trusted`, and action `not-downloaded` / `downloaded`; Verify evidence currentness (`current`, `missing`, `stale`, or `failed`) remains upstream. A current receipt binds the exact package to source fingerprint, project/Verify hashes, mapping currentness, download kind, trust state, and SHA-256. |
| **Sections** | §2.5, §4.6, §7.5, §11, §13 |
| **Status** | **RESULT-DEPENDENT** |
| **Source** | `exportTrustState.ts`, `ExportSurface.tsx`, `buildExportViewModel.ts`, and `basys3ExportService.ts`. |
| **Tests** | `exportTrustState.test.ts`, `ide:gate:export-submission-answer-contract`, and related Export contract gates. |
| **Correction** | Added the three-axis model, first-viewport submission answer, and exact receipt authority. |

---

### 25. Manifest-first Import and Generated VHDL Reconstruction

| Field | Value |
|-------|-------|
| **Claim** | A RedByte ZIP restores from its embedded manifest; loose siblings cannot override it; supported RedByte-generated concurrent-assignment VHDL reconstructs its supported graph, while arbitrary behavioral/process HDL remains partial or blocked. |
| **Sections** | §4.7, §7.6, §12, §14, §16, Appendix E |
| **Status** | **CORRECTED** |
| **Source** | `zipImport.ts`, `hdlToCircuit.ts`, `importPortIdentity.ts`, and `basys3ExportService.ts`. |
| **Tests** | `zipImport.manifest.test.ts`, `zipImport.roundtrip.test.ts`, `importPortIdentity.test.ts`, and the source expectation repair at `f4f7ca8f35f79258fe8f2ff6ecbc68600784efb7`. |
| **Correction** | Removed the stale claim that RedByte's generated concurrent-assignment `top.vhd` is always ports-only, while preserving the manifest as the only lossless restore path. |

---

### 26. Design Port Targets and Verify Readability Floors

| Field | Value |
|-------|-------|
| **Claim** | Design ports meet 24×24px sparse and 32×24px dense target floors (current dense 32×36px), and Verify waveform lanes use 36×36px targets with at least 13px labels. |
| **Sections** | §2.5, §7.2, §7.3 |
| **Status** | **VERIFIED** |
| **Source** | `packages/rb-logic-view/src/components/NodeView.tsx`, `design-workbench-v3.css`, and Verify surface/style implementation. |
| **Tests** | `NodeView.portTargets.test.tsx`, `ide:gate:design-port-target-authority`, and `ide:gate:verify-postrun-workbench-usability`. |
| **Correction** | Added concrete interaction/readability floors and recorded the unresolved 70% Design occupancy target. |

---

### 27. First-viewport Submission Answer

| Field | Value |
|-------|-------|
| **Claim** | Export answers “What should I submit?” before technical evidence and distinguishes trusted package from draft. |
| **Sections** | §7.5, §13 |
| **Status** | **VERIFIED** |
| **Source** | `ExportSurface.tsx` and `exportTrustState.ts`. |
| **Tests** | `ide:gate:export-submission-answer-contract`. |
| **Correction** | Added the explicit submission-answer step to the student workflow. |

---

## Summary

| Status | Findings |
|--------|----------|
| **NEEDS EDIT / PARTIAL / CORRECTED / VERIFIED** | Existing statuses outside the rows below are retained from the prior audit and were not recalculated by this semantic-only pass. |
| **RESULT-DEPENDENT** | #22–#24 require final exact-tree source/test evidence before their status may be promoted. |

This semantic-only pass does not recalculate status totals or close result-dependent rows.

---

## Correction Priority

Resolve the result-dependent rows only from final exact-tree evidence. Future source changes should follow `MANUAL_CONFORMANCE.md`, update the traceability row, and reopen a finding when a claim no longer matches current code or proof.

---

*End of Audit*
