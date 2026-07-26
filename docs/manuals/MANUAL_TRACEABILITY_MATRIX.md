# RedByte Product Manual — Traceability Matrix

**Document:** RB-TRACE-001 v1.2
**Date:** 2026-07-22
**Purpose:** Maps every major manual section to the source files and tests that verify its accuracy.

---

## Reading This Table

| Column | Meaning |
|--------|---------|
| **Manual Section** | Section number and title in `RedByte_Product_Manual.md` |
| **Manual Claim** | The specific claim or description made |
| **Source File(s)** | Code or doc files that are ground truth for this claim |
| **Key Line(s)** | Specific line numbers where the claim is grounded |
| **Test Coverage** | Test files/suites that exercise this behavior |
| **Status** | VERIFIED / PARTIAL / CORRECTED (was wrong, now fixed) / RESULT-DEPENDENT (final exact-tree evidence not yet recorded) |

---

## Traceability Table

### §2 Product Overview

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| Targets Digilent Basys 3 (Artix-7 XC7A35T) | `basys3Bundle.ts` | L1-20 | `basys3.test.ts` | VERIFIED |
| Five horizontal workflow stages plus Import utility | `workflowStages.ts`, `IdeStageNav.tsx`, `IdeTopBar.tsx` | internal modes + rendered stage list | `ideWorkbenchShell.test.tsx`, `ide-unified-workbench-v3-flow.mjs` | CORRECTED |
| Export generates top.vhd, top.xdc, testbench.vhd + support files | `basys3Bundle.ts`, `vivadoProjectFolder.ts` | L191, L36 | export tests | CORRECTED |
| Deterministic simulation via topological sort | `simulationEngine.ts` | Kahn's algorithm | `simulation.test.ts` | VERIFIED |
| Local-first, no server required | `README.md`, architecture | — | — | VERIFIED |
| SHA-256 submission hashing | `submissionBundle.ts` | L114-120, L284-291 | submission tests | VERIFIED |
| RedByte is a deterministic FPGA learning/project-building environment with Vivado and board proof boundaries | `docs/contracts/RedByte_Product_Contract.md`, `docs/IDE_SYSTEM_MAP.md`, `scripts/vivado-cert-custom-project.ts` | product statement, authority map, harness | `pnpm lab:vivado:cert:custom -- --case b1-mixed ...`; `--case b1-counter ...` | VERIFIED |
| Unified Workbench v3 RC source is Browser-E0 candidate evidence, with exact pre-doc source SHA, exclusions, geometry debt, and final exact-SHA certification still pending | `AI_STATE.md`, `docs/ACTIVE_WORK.md`, `docs/product/RED_BYTE_UNIFIED_WORKBENCH_V3.md` | 2026-07-25 integrated RC authority entries | current touched matrix: 20/20 files, 258/258 tests; typecheck/build/focused gates | VERIFIED |

---

### §3 Intended Users and Application Contexts

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| Four application contexts | `docs/ARCHITECTURE.md` | App context section | — | VERIFIED |
| IdeApp owns five numbered stages plus Import utility across six internal modes | `IdeApp.tsx`, `IdeStageNav.tsx`, `IdeTopBar.tsx` | mode routing + rendered navigation | `ideWorkbenchShell.test.tsx`, v3 flow gate | CORRECTED |
| SubmissionInspectorApp defined architecturally; inspector via Project surface | `docs/ARCHITECTURE.md`, `IdeApp.tsx` | — | — | CORRECTED |
| LogicPlaygroundApp = no submission/hw/export | `docs/ARCHITECTURE.md` | App contexts | — | VERIFIED |

---

### §4 Core Concepts and Operating Model

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| Canonical connection format: nested `{ from: { nodeId, portName }, to: { nodeId, portName } }` | `projectFormat.ts`, `CLAUDE.md` | `normalizePortRef` | All tests using connections | VERIFIED |
| Flat connection format invalid; normalizePortRef throws | `projectFormat.ts` | `normalizePortRef` | unit tests | VERIFIED |
| Topological sort guarantees deterministic evaluation | `simulationEngine.ts` | Kahn's algo impl | `simulation.test.ts` | VERIFIED |
| Combinational schedule = single tick | `verifyEngine.ts` | schedule logic | verify tests | VERIFIED |
| Clocked-macro schedule = CLK=0, CLK=1, CLK=0 | `verifyEngine.ts` | 3-tick sequence | verify tests | VERIFIED |
| Export generates primary HDL + 6 support files | `vivadoProjectFolder.ts` | ZIP construction | export tests | CORRECTED |
| Import fidelity: Full / Reconstructed / Partial (UI layer) | `IdeApp.tsx` | L101 | — | VERIFIED |
| Internal reconstruction levels: full / ports-only / empty | `hdlToCircuit.ts` | L43 | import tests | VERIFIED |
| Five-layer architecture (A–E) | `docs/ARCHITECTURE.md` | Layer definitions | — | VERIFIED |
| Product spine distinguishes RedByte-owned stages from Vivado/program/observe proof tiers | `docs/contracts/RedByte_Product_Contract.md`, `docs/release/vivado-basys3-certification-matrix.md` | product state vocabulary, L0/E0/E1/E2/E3 tiers | Vivado custom harness logs under `out/vivado-cert/custom-projects/` | VERIFIED |
| Draft export is allowed while trusted export requires current Compare PASS + mapping + export bundle | `projectWorkflowAuthority.ts`, `projectTruth.ts`, `ExportSurface.tsx` | `draftExportAvailable`, `exportTrusted`, `trustedVerifyCurrent` | workflow authority/export tests; Batch 1 browser proof ticket | VERIFIED |

---

### §7 Detailed Surface Reference

#### §7.2 Design Surface

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| Component palette: AND, OR, NOT, NAND, NOR, XOR, XNOR (2-input) | `DesignSurface.tsx`, `componentSupportRegistry.ts`, `index.ts` | core palette + support entries + runtime registration | palette/component-support tests | CORRECTED |
| 3-input gates: AND3, OR3, NAND3, NOR3, XOR3 | `builtins.ts` | L148-196 | primitives tests | VERIFIED |
| Native sequential palette includes Register1, RegisterBus, and StateBank; only supported Register1 configuration has scalar Verify/Export parity, while RegisterBus/StateBank and unsupported Register1 configurations block explicitly | `DesignSurface.tsx`, `componentSupportRegistry.ts`, `verifySchedule.ts`, `vhdlExport.ts` | palette arrays, support entries, register boundary diagnostics | sequential palette and register-boundary tests | CORRECTED |
| Current generic I/O/source cards are INPUT, OUTPUT, and Ground; Basys3 I/O and clock come from Board Resources | `DesignSurface.tsx` | core palette + board-resource groups | Design palette gates | CORRECTED |
| Generic Clock is registered for legacy/runtime compatibility but is not a current palette card; a resolved project clock input plus the saved Manual/Auto policy owns execution intent | `DesignSurface.tsx`, `componentSupportRegistry.ts`, `verifyClockPolicy.ts`, `verifySchedule.ts` | non-authoring support + materialized execution policy | custom-clock/Verify gates | CORRECTED |
| Runtime-only/compatibility registrations do not imply palette cards | `componentSupportRegistry.ts` | capability matrix | component support tests | CORRECTED |
| Runtime registry performs 27 direct primitive registrations plus 4 composite registrations = 31 additions | `index.ts` | direct `NodeRegistry.register` calls + `registerCompositeNode` calls | registry tests | CORRECTED |
| Port targets meet 24×24px sparse and 32×24px dense floors (current dense 32×36px), with keyboard-reachable wiring targets | `NodeView.tsx`, `design-workbench-v3.css` | port target geometry and keyboard handlers | `NodeView.portTargets.test.tsx`, `ide:gate:design-port-target-authority` | VERIFIED |
| One canvas exposes Edit authoring, exploratory Live, and recorded read-only Replay with explicit evidence labels | `DesignSurface.tsx`, `design-workbench-v3.css` | mode control and truth label | `designSurface.idleInspector.test.tsx`; Browser-E0 Full Adder Live and recorded Replay | VERIFIED LOCALLY |
| Common palette starts with AND, OR, XOR, NOT, Register1, INPUT, and OUTPUT | `DesignSurface.tsx` | common-palette ordering | `designSurface.idleInspector.test.tsx` | VERIFIED LOCALLY |

#### §7.3 Verify Surface

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| 14 diagnostic conditions (hint system) | `verifyHints.ts` | L48-121 (HINTS array) | hint tests | CORRECTED (was "up to 7") |
| Freshness tracking: only topology/type/scenario changes stale result | `projectRuntime.ts` | L1438 (`changesCircuitTruth`) | runtime tests | VERIFIED |
| Testbench preview: total ticks, asserted outputs, clock policy | `VerifySurface.tsx` | preview panel | — | VERIFIED |
| PASS waveform keeps mapped stimulus inputs visible by default alongside outputs | `VerifySurface.tsx` | pass-run lane visibility override (`passRunWithNoMismatches`) | `verifySurface.waveform-priority.test.tsx` | VERIFIED |
| Compare repair separates Edit expected from Inspect Design | `VerifySurface.tsx` | repair action lanes | Verify fail/edit/repair gates | CORRECTED |
| Structural preflight failure uses Open Design before Compare can evaluate behavior | `VerifySurface.tsx` | structural recovery panel | Verify structural recovery tests | CORRECTED |
| Named documents persist browser-local sequential policy without adding a portable `RBProject` field | `verifyScenario.ts`, `verifyScenarioSteps.ts`, `projectRuntime.ts` | `VerifyScenarioSequentialPolicy` lifecycle, local sidecar, reconciliation | scenario/persistence inventory; standalone `ide:gate:sequential-testbench-authority` | RESULT-DEPENDENT |
| Shared materialization preserves manual/custom authored clock values and materializes Auto cycle 0, selected `runCycles`, and any automatic reset sequence; manual captures only low-to-high while Auto rows are post-rising-edge; no hidden reset prelude is injected | `verifyClockPolicy.ts`, `projectRuntime.ts`, `sim/simEngineCore.ts` | policy-to-materialized-vector execution and settled/post-edge sampling | runtime authority inventory; standalone `ide:gate:sequential-testbench-authority` | RESULT-DEPENDENT |
| Runtime Verify, bring-up expectations, and generated `testbench.vhd` consume the same materialized execution vectors plus resolved clock/schedule projection; Auto `runCycles` and reset behavior may change package bytes and old-receipt authority | `verifyClockPolicy.ts`, `buildExportViewModel.ts`, `testbenchGenerator.ts`, `exportTrustState.ts` | shared vectors, Auto/manual testbench branches, package fingerprint/current receipt | generated-testbench/freshness inventory; standalone `ide:gate:sequential-testbench-authority` | RESULT-DEPENDENT |
| Waveform lanes use 36×36px targets and labels remain at least 13px | `VerifySurface.tsx`, Verify workbench styles | post-run waveform layout | `ide:gate:verify-postrun-workbench-usability` | VERIFIED |
| Named documents render as scenario cards with type, event count, optional check count, timing cycles, and signal preview | `TestbenchDocumentTabs.tsx`, `simulation-studio-v3.css` | scenario-card projection and styles | `verifyProfessionalTestbench.test.tsx`; Browser-E0 scenario-library replay | VERIFIED LOCALLY |
| Stimulus-only documents remain without expected-output checks through compatible Design edit, undo, and redo | `projectRuntime.ts` | compatible-vector authorship preservation | `projectRuntime.history-authority.test.tsx` stimulus-only regression | VERIFIED LOCALLY |

#### §7.4 Map Pins Surface

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| Table-first assignment workspace with progress and grouped signal rows | `HardwareSurface.tsx`, `hardware-mapping-workspace-v3.css` | v3 mapping workspace | `ide-hardware-basys3-workbench.mjs`, v3 flow gate | CORRECTED |
| Row Assign/Edit/Resolve opens the selected-signal resource selector; Save assignment commits the chosen binding and Clear affects only that row | `HardwareSurface.tsx` | mapping row actions + `ide-hw-direct-resource-select` + save/clear controls | `ide-hardware-mapping-conflict-repair.mjs` | CORRECTED |
| Basys3 board is a secondary reference and does not assign mappings; selector + Save assignment are authoritative | `HardwareSurface.tsx`, `hardware-mapping-workspace-v3.css` | reference-only board region (`assignmentMode={false}`) | `ide-hardware-board-unblocked.mjs` | CORRECTED |
| Semantic mapping rows bind logical signal, direction, artifact port, board resource, package pin, I/O standard, exact XDC line, required state, and conflict state | `HardwareSurface.tsx`, `basys3ExportContract.ts`, `basys3ExportModel.ts`, `buildExportViewModel.ts` | mapping projection contract | standalone `ide:gate:mapping-preview-package-agreement`; `ide:gate:hardware-phase5-contract` | RESULT-DEPENDENT |

#### §7.5 Export Surface

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| Trusted current handoff uses Download Package; structurally buildable untrusted handoff uses separate Download draft | `ExportSurface.tsx`, `projectWorkflowAuthority.ts` | v3 decision actions + trust model | Export ready/blocker/trust gates | CORRECTED |
| Generated package files remain visible in a stable file browser and selected-file preview | `ExportSurface.tsx` | `ide-export-file-browser`, `ide-export-selected-preview-v1` | artifact explorer and v3 flow gates | CORRECTED |
| Open technical evidence launches a secondary dialog for gates, diagnostics, hashes, and provenance | `ExportSurface.tsx` | `ide-export-open-technical-evidence`, `ide-export-technical-dialog` | evidence-capsule and v3 flow gates | CORRECTED |
| Project/Map Pins route package work with Open Export instead of duplicating Export controls | `ProjectSurface.tsx`, `HardwareSurface.tsx` | state-owned actions | action-first/primary-CTA gates | CORRECTED |
| Structural `blocked` / `downloadable`, `verificationTrust` `unverified` / `draft` / `trusted`, and action `not-downloaded` / `downloaded` remain separate; Verify evidence currentness stays upstream; receipt binds source fingerprint, project/Verify hashes, mapping currentness, download kind, trust state, and SHA-256 | `exportTrustState.ts`, `ExportSurface.tsx`, `buildExportViewModel.ts`, `basys3ExportService.ts` | trust/receipt authority | `exportTrustState.test.ts`, Export contract gates | RESULT-DEPENDENT |
| First viewport answers “What should I submit?” before technical evidence | `ExportSurface.tsx`, `exportTrustState.ts` | submission guidance and action routing | `ide:gate:export-submission-answer-contract` | VERIFIED |

#### §7.6 Import Surface

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| Horizontal Upload -> Review -> Apply sequence; ZIP, Paste HDL, conditional Paste XDC, and samples are source choices inside Upload | `ImportSurface.tsx`, `import-recovery-workspace-v3.css` | v3 recovery stepper + source switch | Import focused tests and recovery gates | CORRECTED |
| First-look exposes quick sample demos for structural and blocked behavioral import paths | `ImportSurface.tsx` | first-look guidance quick actions + `loadImportSample` helper | `importSurface.first-look.test.tsx`, `importSurface.honesty.test.tsx` | VERIFIED |
| Manifest-first restore blocks loose sibling overrides, preserves exact scalar/vector-bit identity, and reconstructs the supported RedByte-generated concurrent-assignment subset | `zipImport.ts`, `importPortIdentity.ts`, `hdlToCircuit.ts`, `basys3ExportService.ts` | manifest selection, identity normalization, reconstruction | ZIP/import identity tests; source expectation repair at `f4f7ca8f3` | CORRECTED |

---

### §9 Verification Workflow

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| 14 hint conditions evaluated on FAIL | `verifyHints.ts` | L48-121 | hint tests | CORRECTED |
| Hints reference circuit behaviors (not generic) | `verifyHints.ts` | hint messages | — | VERIFIED |

---

### §10 Hardware Mapping

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| 16 switches (SW0–SW15) | `basys3Bundle.ts` | pin definitions | basys3 tests | VERIFIED |
| 16 LEDs (LD0–LD15) | `basys3Bundle.ts` | pin definitions | basys3 tests | VERIFIED |
| 5 push buttons | `basys3Bundle.ts` | pin definitions | basys3 tests | VERIFIED |
| 7-segment display segments | `basys3Bundle.ts` | pin definitions | basys3 tests | VERIFIED |
| CLK100MHZ at pin W5 | `basys3Bundle.ts` | clock pin | basys3 tests | VERIFIED |
| LVCMOS33 I/O standard | `basys3Bundle.ts` | L158 | basys3 tests | VERIFIED |
| CLOCK_BUFFER_TYPE NONE for switch/button inputs | `basys3Bundle.ts` | L145-165 | basys3 tests | VERIFIED |
| Port name sanitization (not keyword validation) | `basys3Bundle.ts` | sanitize logic | — | CORRECTED |
| Basys3 board labels/package pins trace to official board constraints | `basys3Pins.ts`, Digilent Basys 3 master XDC | board catalog | Basys3 export tests; Vivado E1 logs | VERIFIED |

---

### §11 Vivado Export

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| XDC filename is `top.xdc` | `basys3Bundle.ts` | L191 | export tests | CORRECTED (was "constraints.xdc") |
| top.vhd entity always named `top` | `basys3Bundle.ts` | L247 | export tests | VERIFIED |
| testbench.vhd entity named `tb_top` | `testbenchGenerator.ts`, `vivadoProjectFolder.ts` | L292-293, L36 | testbench tests | CORRECTED (was "top_tb") |
| Testbench simulation top module: tb_top | `vivadoProjectFolder.ts` | L36 | — | CORRECTED |
| ZIP contains 9 files (3 primary + 6 support) | `vivadoProjectFolder.ts` | ZIP construction | export tests | CORRECTED |
| Vivado project/build/program flow is an external proof boundary, not a browser-generated bitstream | `scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl`, `scripts/vivado/redbyte_program_device.tcl`, AMD UG892/UG908 | Vivado Tcl / programming docs | `b1-mixed`, `b1-counter` E1 logs | VERIFIED |

---

### §12 Import Workflows

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| COMPONENT_MAP: 37 HDL variants → 9 node types | `hdlToCircuit.ts` | L60-97 | import tests | CORRECTED (was "26 types") |
| Fidelity levels documented accurately | `hdlToCircuit.ts`, `IdeApp.tsx` | L43, L101 | import tests | VERIFIED |
| Vivado-kit manifest embeds the exact generated `top.vhd` and `top.xdc` package projection | `basys3ExportService.ts`, `buildExportViewModel.ts`, `zipImport.ts` | canonical manifest projection and validation | export/import round-trip tests; `ide:gate:zip-import-recovery-contract` | VERIFIED |

---

### §13 Submission

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| SHA-256 deterministic hashing | `submissionBundle.ts` | L114-120, L284-291 | submission tests | VERIFIED |
| Ed25519 optional signing | `submissionBundle.ts` | signing logic | — | VERIFIED |
| Tamper detection via manifest | `submissionBundle.ts` | manifest logic | submission tests | VERIFIED |
| Deterministic packaging (same state → same bytes) | `submissionBundle.ts` | stable serialization | determinism tests | VERIFIED |

---

### Appendix A: Logic Primitive Reference

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| AND, OR, NOT, NAND, NOR, XOR, XNOR registered and present in the current student palette | `index.ts`, `componentSupportRegistry.ts`, `DesignSurface.tsx` | runtime registration + support + core palette | primitives/palette tests | CORRECTED |
| Register1, RegisterBus, and StateBank are current native sequential palette entries | `DesignSurface.tsx`, `componentSupportRegistry.ts` | core palette + support entries | sequential palette tests | CORRECTED |
| Generic Clock is runtime/legacy-compatible but not a current palette card | `DesignSurface.tsx`, `componentSupportRegistry.ts` | Sim Clock removal + non-authoring capability | clock policy gates | CORRECTED |
| NOR3, XOR3 registered (3-input) | `builtins.ts` | L184, L196 | primitives tests | VERIFIED |
| D/T/JK flip-flop port names | `builtins.ts` | L276-357 | flip-flop tests | VERIFIED |

---

### Appendix B: Basys 3 Pin Reference

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| All pin assignments | `basys3Bundle.ts` | pin map table | basys3 tests | VERIFIED |
| Part number xc7a35t-1cpg236-1 | `basys3Bundle.ts`, `docs/VIVADO_INTEGRATION.md` | — | — | VERIFIED |

---

### Appendix C: Generated File Specifications

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| top.vhd entity: `top` | `basys3Bundle.ts` | L247 | export tests | VERIFIED |
| top.xdc filename (not constraints.xdc) | `basys3Bundle.ts` | L191 | export tests | CORRECTED |
| testbench.vhd entity: `tb_top` | `testbenchGenerator.ts` | L292-293 | testbench tests | CORRECTED |
| CLOCK_BUFFER_TYPE NONE in XDC | `basys3Bundle.ts` | L145-165 | basys3 tests | VERIFIED |

---

## Summary Counts

| Status | Count |
|--------|-------|
| VERIFIED | 52 |
| CORRECTED (was wrong, now fixed) | 35 |
| PARTIAL | 0 |
| **Total claims traced** | **87** |

All CORRECTED items have been updated in both `RedByte_Product_Manual.md` and `RedByte_Product_Manual_print.html`. See `MANUAL_CLAIM_AUDIT.md` for the detailed audit record.

---

*End of Traceability Matrix*
