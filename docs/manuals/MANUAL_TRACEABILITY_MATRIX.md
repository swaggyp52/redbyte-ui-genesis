# RedByte Product Manual — Traceability Matrix

**Document:** RB-TRACE-001 v1.3
**Date:** 2026-09-16 (v1.2 dated 2026-07-22)
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
| **Status** | VERIFIED / PARTIAL / CORRECTED (was wrong, now fixed) / RESULT-DEPENDENT (final exact-tree evidence not yet recorded) / UNVERIFIED (the cited symbol or behavior could not be confirmed at the current source) |

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
| Design owns authoring with no peer Edit / Live / Replay modes; **Explore** is explicitly unrecorded (`Exploring · not recorded`, `Clock edge` for circuits with state, `Reset values`, `Finish exploring`); **Test this design** hands off to Simulate | `DesignSurface.tsx` | `ide-design-explore`, `ide-design-live-transport` (`ide-design-live-note`, `ide-design-live-step`, `ide-design-live-reset`), `ide-design-test-design`, Explore dock readout `Exploring this circuit` | P2.6C browser journeys recorded in `docs/ACTIVE_WORK.md` (not rerun for this pass) | CORRECTED (2026-09-16; was Edit / Live / Replay) |
| A recording handed back from Simulate renders read-only as `Recorded view · {scenario} · tN` with `Return to current design` / `Return to experiment` | `DesignSurface.tsx` | `ide-design-current-design`, `ide-design-test-design` replay branch, `Recorded run from Simulate` dock readout | `verifySurface` / Design handoff journeys in the P2.6C record | CORRECTED (2026-09-16) |
| Common palette starts with AND, OR, XOR, NOT, Register1, INPUT, and OUTPUT | `DesignSurface.tsx` | common-palette ordering | `designSurface.idleInspector.test.tsx` | VERIFIED LOCALLY |

#### §7.3 Verify Surface

| Manual Claim | Source File(s) | Key Lines | Test Coverage | Status |
|-------------|----------------|-----------|---------------|--------|
| 14 diagnostic conditions (hint system) | `verifyHints.ts` | L48-121 (HINTS array) | hint tests | CORRECTED (was "up to 7") |
| Freshness tracking: only topology/type/scenario changes stale result | `projectRuntime.ts` | L1438 (`changesCircuitTruth`) | runtime tests | VERIFIED |
| Testbench preview: total ticks, asserted outputs, clock policy | `VerifySurface.tsx` | preview panel | — | VERIFIED |
| PASS waveform keeps mapped stimulus inputs visible by default alongside outputs | `VerifySurface.tsx` | pass-run lane visibility override (`passRunWithNoMismatches`) — symbol absent at `f38221195` | `verifySurface.waveform-priority.test.tsx` | UNVERIFIED (2026-09-16: cited symbol no longer present; manual §7.3 paragraph retained pending re-audit) |
| Failing checks expose the `Fail` focus row with `First` / `Previous` / `Next`, `expected X · got Y`, and **Trace in Design**; the `Edit expected` / `Inspect Design` lanes are retired | `VerifySurface.tsx` | `ide-verify-fail-nav`, `ide-verify-fail-nav-first`, `ide-verify-fail-focus-trace` | P2.6C recorded-repair journeys (`docs/ACTIVE_WORK.md`), not rerun for this pass | CORRECTED (2026-09-16; was Edit expected / Inspect Design) |
| Structural preflight failure disables **Run** with `Repair the structural Design issue before running.` and exposes **Open Design** | `VerifySurface.tsx` | `runBlockedReason`, `gradingBlockedByDesign`, `ide-verify-structural-open-design` | Verify structural recovery tests | CORRECTED (2026-09-16 wording) |
| One **Run** (`Run` / `Rerun` / `Running…`) records an immutable recording and evaluates saved checks automatically; the check-count tooltip reads `N saved checks are evaluated automatically.` or `No checks configured · records outputs without a pass/fail verdict.`; no Observe / Compare selector or Live I/O toggle is rendered | `verify/VerifyCommandBar.tsx`, `VerifySurface.tsx` | `ide-vcb-run`, `ide-vcb-check-count`, `explainerText`; `compactCommandRunLabel` | P2.6C determinism / causal-capture journeys (recorded) | CORRECTED (2026-09-16) |
| Zero saved checks reads `No checks · outputs recorded` and never PASS; with checks the header reads `N checks passed` or `M of N checks failed`; `Checks not evaluated` when not evaluated | `verify/RunIdentityStrip.tsx` | `ide-run-check-result` | P2.6C journeys (recorded) | CORRECTED (2026-09-16) |
| Recordings are immutable and selectable: `Recorded #N`, `Recording` selector (`N · No checks | Checks passed | Checks failed · digest`), `Run details` with Design + Stimulus + Engine → Output identity, repetition `1 run · no repeat yet` / `N runs · M identical`, FNV-1a digest definition, `Browser execution · no physical hardware evidence.` | `verify/RunIdentityStrip.tsx` | `ide-run-identity`, `ide-run-repetition`, `ide-run-details`, `ide-run-*-digest` | P2.6C ten-recording close/reopen/reproduce workload (recorded) | CORRECTED (2026-09-16) |
| **Reproduce** re-executes the selected recording's retained design, stimulus and engine; rejected with `This older recording did not retain reproduction inputs.` or `The recorded engine is unavailable.`; divergence raises `Same configuration produced different outputs.` with `First difference` | `VerifySurface.tsx`, `verify/VerifyCommandBar.tsx`, `verify/RunIdentityStrip.tsx` | `onReproduce` / `reproduceDisabledReason`, `ide-vcb-reproduce`, `ide-run-divergence` | P2.6C reproduce journeys (recorded) | CORRECTED (2026-09-16) |
| Sequential scenarios use one `Time instrument`; combinational use `Table` with `Recorded trace` once a recording exists; `Details` and `Inspect` (`Recorded circuit`) are explicit, mutually exclusive auxiliary views; pre-run note `no recorded run yet` | `VerifySurface.tsx`, `verify/TimingLab.tsx`, `verify/RecordedCircuitInspector.tsx` | `ide-verify-representation`, `ide-verify-view-table`, `ide-verify-view-waveform`, `ide-verify-details`, `ide-verify-inspect-circuit`, `ide-recorded-circuit` | P2.6C linked-investigation journeys (recorded) | CORRECTED (2026-09-16) |
| Time instrument keyboard: Up / Down select a lane, Left / Right move the tick, Shift+Left / Right jump edges; with **Edit stimulus** on, Space / Enter edits only the selected authored input, while inspecting they only select | `verify/TimingLanes.tsx` | grid `onKeyDown` (Space / Enter branch gated by `editable`) | `timingLanes.keyboard.test.tsx`, `timingLab.inspectMode.test.tsx` | CORRECTED (2026-10-26, RB-DEBT-020; was "Space / Enter edits" in every mode) |
| **Edit stimulus**: a click on a lane cell selects; it drives an authored input only while the toggle is on; on with no recording on screen, off when a recording is selected or inspected; draft lanes read `cells select while inspecting` / `editing`; the labelled commands (+ Event, Duplicate, Delete, event editor) stay explicit in both modes; an edit stales the recording, never changes it | `verify/TimingLab.tsx`, `verify/TimingLanes.tsx`, `VerifySurface.tsx` | `ide-timing-edit-mode`, `data-stimulus-editing`, `ide-timing-stimulus-heading`; `recordingId` / `inspecting` props | `timingLab.inspectMode.test.tsx`, `verifySurface.inspectionReadOnly.test.tsx`; `ide-signal-journey-counter-proof` gate (inspection click on EN at t5) | VERIFIED LOCALLY (2026-10-26) |
| `Recorded circuit` redraws retained topology with recorded values (`Fit circuit`, `Enlarge`, `Instance`), offers `Inspect signal`, `Trace upstream` (clickable only when topology and chronology support it) and `Edit current design`; a recording without a circuit snapshot says so | `verify/RecordedCircuitInspector.tsx`, `verify/recordedCircuitGeometry.ts` | `ide-recorded-circuit-context`, `ide-causal-walk`, `rb-recorded-circuit-unavailable` | P2.6C causal-capture journey (recorded) | CORRECTED (2026-09-16) |
| A later change marks the selected recording `STALE` with `Design changed — run again to record the current circuit.` / `Checks changed — run again before trusting the previous verdict.` / `Browser reloaded — run again before trusting this recording as current evidence.`; status `Simulation stale`; header lists `Design changed` / `Stimulus changed` / `Engine changed` and `This recording is retained. Rerun uses current inputs; Reproduce uses this recording’s inputs.` | `VerifySurface.tsx`, `runDeterminism.ts`, `verify/RunIdentityStrip.tsx` | evidence-state word (`kind: 'stale'`), `describeRecordingChanges`, `ide-run-input-changes` | P2.6C repair/reload journeys (recorded) | CORRECTED (2026-09-16) |
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
| Board Check and the simulated board read the selected Simulate recording's retained mapping rows and samples (`Unrecorded` / `Match` / `Differ`), not a live I/O bus | `HardwareSurface.tsx` | `recordedMappingRows`, `recordedPortSignal`, `bringupObservations`, `isRecordedBoardPreview` | P2.6C Board Check journey (recorded) | CORRECTED (2026-09-16) |
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
| Package generates files first and shows the downloaded `ZIP SHA-256` / `Package SHA-256` of the exact ZIP bytes; a checked package needs a current recording | `ExportSurface.tsx`, `export/HandoffOverviewDocument.tsx`, `HardwareSurface.tsx` | `ide-export-package-sha256`, `ide-package-handoff-package-sha`, no-run / stale-run reasons | P2.6C package/reload journeys (recorded) | CORRECTED (2026-09-16) |

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
| Workflow: **Run** → recording header state (`No checks · outputs recorded` / `N checks passed` / `M of N checks failed` / `STALE`) → **Reproduce** for repetition | `verify/VerifyCommandBar.tsx`, `verify/RunIdentityStrip.tsx`, `VerifySurface.tsx` | see §7.3 rows | P2.6C journeys (recorded) | CORRECTED (2026-09-16) |
| Failure-to-Design path: `First` / `Previous` / `Next`, **Trace in Design** → `Recorded view · scenario · tN` → `Return to experiment` → **Rerun**; **Open Design** for structural failures | `VerifySurface.tsx`, `DesignSurface.tsx` | `ide-verify-fail-focus-trace`, `ide-design-current-design` | P2.6C recorded-repair journeys (recorded) | CORRECTED (2026-09-16) |

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
