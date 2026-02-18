# Master RedByte IDE Rebuild Plan

Date: 2026-02-18
Owner: Connor Angiel

This document defines the single rebuild plan to transform RedByte into one product: RedByte IDE. It is written for implementation agents and is executable, ordered, and scoped.

---

## A) Repo Understanding (current state, proven by sources)

### A1) Repo map (apps and packages)

Apps (top-level builds):
- apps/playground: Primary web app build. Boot logic picks IDE by default and Shell only with `?launcher=1`. (apps/playground/src/boot/full-bootstrap.ts, apps/playground/src/boot/ide-bootstrap.ts)
- apps/lab3-webapp: Standalone Lab 3 tool with its own simulator, waveform viewers, and Verilog export. (apps/lab3-webapp/src/*)
- apps/manual-site: Marketing / manual site. (apps/manual-site/*)
- apps/studio: Thin export wrapper for rb-shell. (apps/studio/src/index.ts)
- apps/docs: Placeholder.

Packages (selected, core to IDE):
- packages/rb-apps: All RedByte apps, components, export/import, lab logic, project format, app registry. (packages/rb-apps/src/*)
- packages/rb-shell: Window manager / OS chrome and launcher. (packages/rb-shell/src/Shell.tsx)
- packages/rb-logic-core: Deterministic simulator (CircuitEngine, TickEngine). (docs/SIMULATION_ENGINE_ARCHITECTURE.md)
- packages/rb-logic-view: 2D canvas editor and wiring. (packages/rb-logic-view/src/LogicCanvas.tsx)
- packages/rb-logic-3d: 3D viewer (React Three Fiber). (packages/rb-logic-3d/README.md)
- packages/rb-logic-adapter: View adapter for isometric/3D (referenced in 3D integration and LogicPlaygroundApp).
- packages/rb-instruments: Probe/oscilloscope dock panels. (packages/rb-instruments/src/*)
- packages/rb-fpga-toolchain: Toolchain orchestration and constraints exports. (packages/rb-fpga-toolchain/*)
- packages/rb-fpga-bridge, rb-fpga-proof-core, rb-fpga-signing: Hardware bridge, proof, and signing pipeline. (docs/RB_FPGA_MVP_SPEC.md)
- packages/rb-utils, rb-protocol, rb-board-profiles: Shared utilities, schemas, board metadata.

Legacy OS (not the current app build):
- src/os/* and src/kernel/* implement the older RedByte OS shell, app registry, and project context. This is referenced in docs/APP_MAP.md and docs/ARCHITECTURE.md but is not the current build path for apps/playground.

### A2) Core truth engines (current sources)

Simulation engine(s):
- Deterministic simulation core is CircuitEngine and TickEngine in packages/rb-logic-core. (docs/SIMULATION_ENGINE_ARCHITECTURE.md)

Netlist representation:
- Netlist format and conversion from Circuit in packages/rb-apps/src/export/netlistExport.ts.

Exporters:
- VHDL: packages/rb-apps/src/export/vhdlExport.ts.
- Verilog: packages/rb-apps/src/export/verilogExport.ts.
- Basys3 bundle (VHDL + XDC + README): packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts.
- Vivado handoff panel and TCL builder: packages/rb-apps/src/components/HdlEditorPanel.tsx.
- Evidence capsule export/import (.rbx.zip): packages/rb-shell/src/Shell.tsx and docs/EXPORT_IMPORT_IMPLEMENTATION.md.

Importers/parsers:
- VHDL parser: packages/rb-apps/src/import/vhdlImport.ts.
- Verilog parser: packages/rb-apps/src/import/verilogImport.ts.
- Parsed HDL to Circuit (component mapping + auto-layout): packages/rb-apps/src/import/hdlToCircuit.ts.
- Import UI: packages/rb-apps/src/components/ImportPanel.tsx.

Waveform/oscilloscope modules:
- Oscilloscope view and probe sampling: packages/rb-apps/src/components/OscilloscopeView.tsx.
- Probe store and right dock integration: packages/rb-apps/src/components/RightDock.tsx.
- Instrument panels: packages/rb-instruments/src/*.

2D schematic/canvas modules:
- LogicCanvas editor: packages/rb-logic-view/src/LogicCanvas.tsx.
- Schematic view (symbolic): packages/rb-apps/src/components/SchematicView.tsx.

3D modules:
- 3D viewer scaffolding: packages/rb-logic-3d (React Three Fiber). (packages/rb-logic-3d/README.md)

### A3) Major UI apps and where the OS shell is tied in

Current primary IDE surface:
- LogicPlaygroundApp: packages/rb-apps/src/apps/LogicPlaygroundApp.tsx (2D editor + sim + oscilloscope + right dock).
- RightDock includes HDL and Import tabs: packages/rb-apps/src/components/RightDock.tsx, HdlEditorPanel.tsx, ImportPanel.tsx.

Window manager (OS shell):
- rb-shell is the OS chrome, windowing, and launcher. (packages/rb-shell/src/Shell.tsx)
- apps/playground boot chooses:
  - IDE direct render (no shell) via apps/playground/src/boot/ide-bootstrap.ts.
  - Shell only when `?launcher=1` via apps/playground/src/boot/full-bootstrap.ts.

### A4) Duplicated/overlapping features

- Separate standalone lab tool in apps/lab3-webapp with its own simulator and waveform viewers. (apps/lab3-webapp/src/*)
- Legacy OS implementation in src/os/* and src/kernel/* (older shell, app registry, and project model) overlaps with rb-shell/rb-apps.
- Multiple export systems: evidence capsule export (rb-shell), HDL export (rb-apps), lab3-webapp Verilog export, and Basys3 bundle export. (docs/EXPORT_IMPORT_IMPLEMENTATION.md, packages/rb-apps/src/export/*, apps/lab3-webapp/src/verilog.tsx)

### A5) Student-facing surfaces and routes

Current default:
- Root URL loads IDE directly (LogicPlaygroundApp) via apps/playground/src/boot/ide-bootstrap.ts.

Current OS shell access:
- `?launcher=1` loads rb-shell and the windowed OS UI. (apps/playground/src/boot/full-bootstrap.ts)

Other student-facing builds:
- apps/lab3-webapp is a separate, publicly hostable app.
- apps/manual-site is public documentation.

Docs already describing product direction:
- docs/PRODUCT_SURFACES.md (Surface 1-3 contract: 2D editor is source of truth, 3D is viewer).
- docs/app-consolidation.md (App consolidation and student workflow surface reduction).
- docs/REDBYTE_2_REDESIGN_SPEC.md (Product spec and app map consolidation).
- docs/IDE_SOVEREIGNTY_VERIFICATION.md (IDE first load and launcher opt-in rules).
- docs/SIMULATION_ENGINE_ARCHITECTURE.md (deterministic simulation).
- docs/EXPORT_IMPORT_IMPLEMENTATION.md (evidence import/export pipeline).
- docs/PROJECT_MODEL.md (legacy project model in src/os context; will be superseded).

Checkpoint: Does this repo understanding map correctly to what you expect for RedByte IDE?

---

## B) Target Product Definition (one tool)

### B1) Primary workflow (scratch -> export)

1. Create new project in RedByte IDE (blank or template).
2. Build circuit in 2D schematic editor.
3. Simulate deterministically with the CircuitEngine + TickEngine.
4. View waveforms and schematic side-by-side; optionally open 3D viewer (read-only).
5. Map IO to Basys3 pins and export Vivado-ready artifacts.

### B2) Secondary workflow (import -> inspect -> re-export)

1. Paste or upload VHDL/Verilog and optional XDC from Vivado.
2. Parse HDL to circuit model (best-effort), auto-layout schematic, keep HDL as original source text.
3. Simulate deterministically and view waveforms.
4. Allow edits in schematic for supported subset; re-export to VHDL + XDC + README.

### B3) Explicit v1 scope

In scope:
- Basys3 only.
- Vivado export must be real and deterministic (top.vhd, top.xdc, README, optional TCL).
- VHDL-first for export; Verilog import supported (structural subset).
- Deterministic simulation and waveform capture.
- One IDE surface and one project model.

Out of scope for v1:
- Collaboration, accounts, cloud sync.
- Multi-board support beyond Basys3.
- Full HDL round-trip for behavioral code.
- Full 3D editing (3D stays read-only viewer).

Checkpoint: Is this v1 scope aligned with the required product intent?

---

## C) Architecture Proposal (clean layers)

### C1) Project Model (single source of truth)

Proposed single model: RBProject (packages/rb-apps/src/export/projectFormat.ts) with extensions to cover HDL and IO mapping.

Required fields (v1):
- circuit: Circuit (2D schematic, source of truth for scratch build)
- hdl: ToolchainProjectInput (top module, VHDL/Verilog sources, original import text)
- fpga: RBFpgaConfig (board=basys3, constraints, preset id, top name)
- ioMapping: from LabProjectV1 (inputs/outputs mapping to board pins)
- simulation: tickRate, determinism settings, probes
- probes/oscilloscope settings: existing fields in RBProject
- metadata: projectId, labId, tags, appSurface, timestamps

Rationale:
- RBProject already exists, is deterministic and serialized with stable ordering. (packages/rb-apps/src/export/projectFormat.ts)
- LabProjectV1 is currently used for evidence capsules; adapter already exists. (packages/rb-apps/src/utils/labProjectRbprojAdapter.ts)

### C1b) RBProject File Manifest (Vivado mental model)

IDE must expose a file tree that mirrors expected Vivado artifacts. These are logical files, even if generated:
- /top.vhd (generated from netlist)
- /top.xdc (generated from ioMapping)
- /testbench.vhd (generated from vectors)
- /README.txt (export instructions and pin map)
- /submodules/* (generated or user-authored HDL blocks)

Rules:
- Each IDE mode reads/writes these artifacts (even if generated on the fly).
- File tree is always visible in Project mode.

### C1c) IDE Mode Contract (Project / Design / Verify / Export / Import)

Mode seam requirements:
- Project: manage project metadata, file tree, import/export status, and base settings.
- Design: 2D schematic editor and component palette only.
- Verify: deterministic sim, probe setup, waveform inspection, and vector runner results.
- Export: Basys3 bundle generation and Vivado handoff.
- Import: HDL and XDC import surfaces, plus Vivado zip import (v1.5).

Shared context (single provider): RBProject and derived views. Each mode is a module with strict inputs/outputs to avoid monolith growth.

### C2) Import Pipeline

Flow:
1. Detect language (VHDL or Verilog).
2. Parse into ParsedHDL using vhdlImport.ts or verilogImport.ts.
3. Convert to Circuit using hdlToCircuit.ts (component mapping + auto-layout).
4. Preserve original HDL in RBProject.hdl.sources and mark import metadata.
5. Parse XDC if provided:
   - v1: parse only `get_ports` lines and map to ioMapping.
   - if missing or unsupported, mark as warnings and keep HDL-only view.

Degradation rules:
- Unsupported components remain as warnings in ImportPanel.
- If circuit reconstruction fails, show HDL-only view (no schematic) but still allow waveform from testbench if provided.

### C3) Schematic Model + Editor

Sync strategy for v1: one-way for authoring, best-effort for import.
- Scratch build: schematic is source of truth; HDL is generated from netlist export.
- Import: HDL is parsed into schematic; after that, schematic edits are allowed only for supported node types and will regenerate HDL, overwriting the imported HDL unless user chooses lock mode.

Justification:
- Determinism and simplicity. 2-way HDL <-> schematic is too costly for v1.

### C4) Simulation + Waveforms

Use the existing deterministic engine:
- CircuitEngine + TickEngine drive all simulations. (docs/SIMULATION_ENGINE_ARCHITECTURE.md)
- OscilloscopeView samples deterministic tick-driven signals. (packages/rb-apps/src/components/OscilloscopeView.tsx)
- Probe model persists in RBProject for replay and export.

Trace format:
- Use existing run recording/proof pack pipeline in rb-apps for deterministic trace capture.

### C4b) Verify Pipeline (vectors + testbench)

Requirements:
- Test vector schema (combinational truth tables and sequential tick vectors).
- Deterministic vector runner in IDE that produces trace samples and pass/fail status.
- Generated testbench.vhd (minimal) that mirrors the vector runner so Vivado sim matches IDE Verify.

### C5) Export Pipeline

Artifacts (v1):
- top.vhd: generated from netlist with deterministic ordering. (vhdlExport.ts, basys3Bundle.ts)
- top.xdc: generated from ioMapping only, Basys3 pins only. (basys3Bundle.ts)
- README.txt: Basys3 quick steps and pin map. (basys3Bundle.ts)
- optional: synth_check.tcl for Vivado batch. (HdlEditorPanel.tsx)
- optional: testbench.vhd (only if test vectors are provided).

Vivado expectations:
- top module name = `top`.
- part = xc7a35tcpg236-1.
- ports derived from ioMapping and constraints parity checks.

### C6) Determinism Contract

Deterministic by definition:
- Simulation tick order and results (CircuitEngine, TickEngine).
- Export ordering and naming (netlist, VHDL, XDC, README).
- Trace data and vector-run outputs.

Allowed to vary:
- UI layout, window sizes, and view settings.
- Auto-placement if it is seeded by stable ordering; if not, make it deterministic.

### C7) Basys3 IO Contract v1

Must explicitly support:
- Switches: SW0..SW15
- LEDs: LD0..LD15
- Buttons: BTNC, BTNU, BTNL, BTNR, BTND
- Clock: CLK100MHZ

Rules:
- Any imported XDC referencing unsupported pins yields warnings and partial map.
- Export only uses supported pins; unsupported are dropped with explicit warnings.

### C8) HDL Import Subset v1

Supported:
- module/entity + port declarations
- structural instantiations with port maps
- simple assign pass-through (signal to signal)
- recognized gate primitives and named modules in COMPONENT_MAP

Unsupported (v1):
- behavioral always/process blocks
- generate loops, inferred RAMs, complex expressions
- non-structural FSMs

Fallback:
- HDL-only view + warnings; no schematic reconstruction.

### C9) Vivado Import v1.5 (zip sources)

v1: Paste HDL + XDC in Import mode.
v1.5: Upload zip of sources (no .xpr required). Detect *.vhd, *.v, *.xdc, choose top, import and map deterministically.

### C10) Super IDE Contracts (missing pieces)

#### C10a) HDL ↔ RedByte Compatibility Tiers

Tier 0: Ports-only
- Parse entity/module ports, ignore internals.
- Generate IO mapping and allow waveform from generated testbench if expected outputs are provided.

Tier 1: Structural
- Instances + port maps + simple assigns reconstruct schematic.

Tier 2: Behavioral-lite (v1.5)
- Recognize common patterns (always_ff/process clk flop, inferred mux/adder) as macro blocks.
- Render as macro blocks, not gates.

#### C10b) Top Selection Rules (import)

Deterministic top selection:
- If XDC exists, pick module/entity whose ports match XDC get_ports.
- Else if entity/module named top exists, pick that.
- Else pick the module/entity not instantiated by any other (root of DAG).
- If ambiguous, show a Pick Top dialog.

#### C10c) Constraints + Clocking Rules

Clock constraints:
- If CLK100MHZ is present, optionally emit create_clock with 100 MHz.
- If not emitted, document that Vivado timing is user responsibility.

IDE clock UX:
- Clock input is explicit in Project and Export modes when sequential logic is used.

#### C10d) Project Templates (guardrails)

Templates must exist:
- Combinational template (no clock)
- Sequential template (clock + reset macro)
- Basys3 IO demo (switch to LED)
- Lab templates (starter circuits)

#### C10e) Wiring + Validation UX Contract

Editor guarantees:
- No invalid wire states
- Port compatibility checks (direction, width)
- Warnings for unconnected required outputs
- Live Verify diagnostics (e.g., output never driven)

#### C10f) Waveform Data Model

Define a stable trace schema:
- signals: id, name, width
- samples: tick, phase (before/after), values
- deterministic sampling points
- persistence in RBProject
- optional VCD export (v1.5)

#### C10g) Bus and Bit-Width Strategy

Staged bus support:
- v1: fixed-width macro blocks (4-bit adders, mux, register)
- v1.5: generic bus wires, split/merge blocks

#### C10h) HDL Output Decision

Export policy:
- v1: VHDL only
- v1.5: optional Verilog export
- import supports both from day 1

#### C10i) Macro Library Strategy

Verified macro blocks:
- DFF/register
- adder/subtractor
- mux (2:1, 4:1)
- decoder/encoder
- comparator
- ALU block (lab-specific)

Each macro has:
- known-good simulation semantics
- known-good HDL templates
- deterministic layout footprint

#### C10j) CI Gates for Determinism

CI gates must enforce:
- RBProject serialization stable ordering
- Export bundle stable ordering (same SHA)
- Vector-run trace stability
- Import -> export roundtrip checksum for fixtures

#### C10k) Performance and Scale Limits

Define v1 limits:
- max nodes (target 300-500)
- max probes and trace length
- tick rate caps
- auto-throttle waveform updates
- optional WebWorker plan (v2)

#### C10l) Evidence Bundle Alignment

Evidence export is a Submit action:
- Includes RBProject, trace, export bundle hash, optional screenshots
- Linked to Project/Export mode as TA-ready artifact

#### C10m) Fixtures Requirement

Require a fixtures folder:
- 10 real Vivado-like mini projects (HDL + XDC)
- Used for import/export regression gates

### C11) Operational Guarantees (semester-safe)

#### C11a) Support + Maintenance Contract

Supported browsers:
- Chrome / Edge latest only

Supported inputs:
- Paste HDL/XDC
- Zip of sources (*.vhd, *.v, *.xdc)
- Not supported: .xpr or full Vivado project folders

Fallback rule:
- If unsupported, user still gets Ports-only + export + warnings

#### C11b) Release + Rollback Plan

Policy:
- Versioned deployments (tags/releases)
- One-command rollback to previous release
- Stable vs beta channel (beta can be a separate URL)

#### C11c) Telemetry + Crash Reporting (privacy-safe)

Minimum capture:
- client uncaught exceptions and promise rejections
- import failures by tier
- export failures (parity mismatch, missing mapping)
- performance warnings (node count, trace length)

#### C11d) Student-safe Reset + Recovery

Requirements:
- Reset workspace button (clears local storage and reloads)
- Autosave with version history (at least last 10 snapshots)
- Export/import raw RBProject JSON

#### C11e) Export Sanity Checker (Vivado-ready gate)

Pre-export validator must check:
- top entity/module exists and name matches
- ports are legal identifiers and unique
- XDC maps only supported Basys3 IO and matches ports
- CLK100MHZ present when sequential logic is used
- required outputs are not floating (if lab requires)

Export rule:
- Hard-block on errors, allow warnings with explicit messaging

#### C11f) Vector Runner Truth Spec

Lock semantics:
- sampling phase (pre-tick, post-tick, or both)
- reset behavior
- clock representation (implicit tick vs explicit clock signal)
- sequential vector timing (ticks per vector)

#### C11g) Baseline Lab Coverage Matrix

Define lab coverage vs capabilities:
- Lab 1: combinational truth table (v1 OK)
- Lab 2: 4-bit adder (needs bus/macro)
- Lab 3: registers/counters (needs clock + vector runner)
- Lab 4: FSM (tier 0/2 only)

#### C11h) Basys3 Pin Map Source of Truth

Rules:
- Basys3 board profile is the only authority
- Pin map changes require tests to update
- XDC templates are treated as fixtures

#### C11i) Security / Abuse Surface

Protections:
- zip bomb protection (file size and file count limits)
- strip path traversal (../) in zips
- limit paste sizes to prevent browser death

#### C11j) UI System Contract

Rules:
- single component library choice
- single code editor choice
- keyboard shortcuts spec
- layout spec (panels, docking, tabs)

#### C11k) VCD Export Priority

Decision:
- Promote VCD export to v1 if feasible

#### C11l) Stability Exit Criteria (Milestone 7)

Definition of stable:
- 10 fixture projects import -> simulate -> export with matching checksums
- 0 open P0/P1 bugs
- export sanity checker blocks known bad states
- crash rate below threshold
- rollback plan validated

Checkpoint: Is this layered architecture and sync direction acceptable for v1?

---

## D) Execution Plan (ordered, executable)

Guiding rule (non-negotiable):
- No whack-a-mole fixes. Any stabilization must be root-cause with centralized helpers only. No `any` or `ts-ignore` unless justified in doc.

Milestone order is strict to avoid monolith drift.

### Milestone 1: Surface + OS quarantine (hard removal from default build)

Dependency: Milestone 0.

Changes:
- Remove rb-shell from the default build graph for apps/playground.
- Ensure apps/playground can build and deploy without rb-shell installed or compiled.
- `?launcher=1` remains, but is a lazy-loaded bundle via dynamic import so students never pay for OS.

Definition of Done:
- Default build does not depend on rb-shell in package.json or runtime imports.
- IDE loads without any rb-shell bundles in network trace.
- `?launcher=1` fetches rb-shell only on demand.

Acceptance gates:
- IDE sovereignty gates pass.
- Build succeeds with rb-shell removed from default dependencies.

### Milestone 2: IDE mode decomposition (Project/Design/Verify/Export/Import seams)

Dependency: Milestone 1.

Changes:
- Decompose LogicPlaygroundApp into mode modules.
- Define a shared project context and explicit mode seam props.

Definition of Done:
- Five mode modules exist with strict inputs/outputs.
- Shared context is the only source of truth across modes.

Acceptance gates:
- New IDE mode navigation test passes.

### Milestone 3: RBProject truth model + file tree

Dependency: Milestone 2.

Changes:
- Adopt RBProject as single project model in all IDE modes.
- Implement file tree view with canonical artifacts: top.vhd, top.xdc, testbench.vhd, README.txt, submodules/*.

Definition of Done:
- RBProject is saved/loaded in IDE only.
- File tree shows canonical artifacts and their provenance.

Acceptance gates:
- rbproj roundtrip gate passes.

### Milestone 4: Export canonical Basys3 bundle

Dependency: Milestone 3.

Changes:
- Use basys3Bundle as the single export authority.
- Enforce VHDL/XDC parity and Basys3 IO contract in export.

Definition of Done:
- Export produces top.vhd, top.xdc, README.txt, optional synth_check.tcl.
- Export parity errors are explicit and blocking.

Acceptance gates:
- Basys3 bundle gates pass.
- `ide:gate:export-generates-hdl` passes.

### Milestone 5: Verify pipeline (vectors + traces + testbench)

Dependency: Milestone 4.

Changes:
- Add test vector schema and deterministic runner.
- Generate testbench.vhd from vectors.
- Ensure Verify mode outputs trace and pass/fail results.

Definition of Done:
- Verify mode produces deterministic traces that match testbench.vhd.
- Waveform output is reproducible from vectors.

Acceptance gates:
- New vector runner and testbench tests pass.

### Milestone 6: Import (HDL+XDC, then zip)

Dependency: Milestone 5.

Changes:
- v1: Paste HDL + XDC with subset support.
- v1.5: Upload zip of HDL/XDC sources, auto-detect top, import deterministically.

Definition of Done:
- Import reconstructs schematic when supported, otherwise falls back to HDL-only view with warnings.
- Zip import produces the same RBProject as paste flow.

Acceptance gates:
- `ide:gate:import-renders-schematic` passes.
- New zip import tests pass.

### Milestone 7: Cleanup / retire duplicates + docs

Dependency: Milestone 6.

Changes:
- Archive or delete duplicate apps (lab3-webapp, legacy OS sources) per Deletion Matrix.
- Update docs and manual-site to match the single IDE surface.

Definition of Done:
- CI no longer builds archived apps.
- Docs and manual-site match actual IDE behavior.

Acceptance gates:
- manual-site sanity check passes.

---

## Deletion / Isolation Plan for RedByte OS

Decision: Keep OS shell only behind `?launcher=1` for internal/dev use.

Delete or quarantine candidates:
- Legacy OS at src/os/* and src/kernel/* -> move to archive or mark as legacy-only (no build references).
- apps/lab3-webapp -> retire or move to /archive with explicit deprecation (duplicate exporters and sim).
- apps/studio -> remove if it only re-exports shell and is not used by IDE.

Keep (but hidden by default):
- packages/rb-shell for dev-only shell access via `?launcher=1`.
- Launcher-related apps for internal workflows (not student-facing).

Route rewrite plan:
- Root `/` always loads IDE.
- `?launcher=1` remains for dev OS access.
- No other routes surface the old OS apps unless explicitly wired for dev.

---

## Unification Plan

One IDE entrypoint:
- Use apps/playground with IDE bootstrap only.
- Remove separate entrypoints for lab, workspace, and standalone lab3.

One Project Model:
- RBProject becomes the single source of truth, with adapters for LabProjectV1 and evidence bundles.

One Export system:
- Basys3 bundle (VHDL + XDC + README) is canonical for Vivado export.
- Evidence export remains for submission but must consume RBProject.

One Import system:
- ImportPanel + hdlToCircuit + XDC parser pipeline, output RBProject.

---

## Risk Register

1) HDL to schematic reconstruction is partial
- Risk: Behavioral HDL cannot be reconstructed.
- Mitigation: Structural-only import; show HDL-only view and warnings when unsupported.

2) Waveform correctness vs determinism
- Risk: sampling drift or nondeterminism.
- Mitigation: Use tick-driven sampling only; keep wall-clock for UI only (current OscilloscopeView behavior).

3) 3D performance
- Risk: 3D view can be heavy or unstable in headless contexts.
- Mitigation: Keep 3D optional and read-only; load after core IDE; allow feature flag to disable.

4) Export parity (VHDL vs XDC)
- Risk: mismatched ports break Vivado.
- Mitigation: Continue XDC vs VHDL parity checks and fail export with actionable error.

---

## Timebox Strategy

V1 should be achievable without perfection by freezing scope:
- Only Basys3.
- Structural HDL import only; no behavioral reconstruction.
- 3D remains read-only and optional.
- Deterministic sim and export take priority over UI polish.

Definition of "good enough":
- Student can build and export a Basys3 design with determinism and correct pin mapping.
- Student can import a structural HDL design and see a usable schematic + waveforms.

---

## E) Concrete Deliverables (by milestone)

Each milestone lists concrete file paths and tests.

### Milestone 1 Deliverables (Surface + OS quarantine)

Files to modify:
- apps/playground/package.json (remove rb-shell from default dependencies)
- apps/playground/src/boot/full-bootstrap.ts (lazy-load rb-shell only for `?launcher=1`)
- apps/playground/src/boot/ide-bootstrap.ts (IDE-only boot path)

Tests to add or update:
- IDE sovereignty gates remain.

Migration steps:
- Keep `?launcher=1` for dev access but isolate it in a separate lazy bundle.

### Milestone 2 Deliverables (IDE mode decomposition)

Files to modify:
- packages/rb-apps/src/apps/LogicPlaygroundApp.tsx (split into mode modules)
- NEW: packages/rb-apps/src/apps/ide/modes/* (Project, Design, Verify, Export, Import)
- NEW: packages/rb-apps/src/apps/ide/IdeContext.tsx

Tests to add:
- packages/rb-apps/src/__tests__/ide-workflow-nav.test.tsx

Migration steps:
- Keep old props shimmed until all modes are wired.

### Milestone 3 Deliverables (RBProject + file tree)

Files to modify:
- packages/rb-apps/src/export/projectFormat.ts
- packages/rb-apps/src/utils/labProjectRbprojAdapter.ts
- packages/rb-apps/src/components/FileTree.tsx (new or repurposed)
- packages/rb-apps/src/apps/ide/modes/ProjectMode.tsx

Tests to add:
- packages/rb-apps/src/__tests__/rbproject-roundtrip-ide.test.ts
- packages/rb-apps/src/__tests__/file-tree-manifest.test.ts

Migration steps:
- Provide adapters so LabProjectV1 exports continue to load.

### Milestone 4 Deliverables (Export Basys3 bundle)

Files to modify:
- packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts
- packages/rb-apps/src/components/HdlEditorPanel.tsx
- packages/rb-apps/src/export/vhdlExport.ts

Tests to add:
- Basys3 bundle gate updates as needed.
- VHDL/XDC parity test if ioMapping changes.

Migration steps:
- Keep export UI stable; replace internals with basys3Bundle output.

### Milestone 5 Deliverables (Verify pipeline)

Files to modify:
- packages/rb-apps/src/verify/vectorSchema.ts (new)
- packages/rb-apps/src/verify/vectorRunner.ts (new)
- packages/rb-apps/src/verify/testbenchGenerator.ts (new)
- packages/rb-apps/src/verify/traceSchema.ts (new)
- packages/rb-apps/src/verify/vcdExport.ts (optional v1.5)
- packages/rb-apps/src/apps/ide/modes/VerifyMode.tsx

Tests to add:
- packages/rb-apps/src/verify/__tests__/vector-runner.test.ts
- packages/rb-apps/src/verify/__tests__/testbench-generator.test.ts
- packages/rb-apps/src/verify/__tests__/trace-schema.test.ts

Migration steps:
- Keep existing oscilloscope; add deterministic vector outputs alongside it.

### Milestone 6 Deliverables (Import v1 + v1.5 zip)

Files to modify:
- packages/rb-apps/src/components/ImportPanel.tsx
- packages/rb-apps/src/import/hdlToCircuit.ts
- packages/rb-apps/src/import/vhdlImport.ts
- packages/rb-apps/src/import/verilogImport.ts
- packages/rb-apps/src/import/xdcImport.ts (new)
- packages/rb-apps/src/import/zipImport.ts (new)

Tests to add:
- packages/rb-apps/src/import/__tests__/vhdlImport.test.ts
- packages/rb-apps/src/import/__tests__/verilogImport.test.ts
- packages/rb-apps/src/import/__tests__/xdcImport.test.ts
- packages/rb-apps/src/import/__tests__/zipImport.test.ts

Migration steps:
- Import supports HDL-only; XDC optional.

### Milestone 7 Deliverables (Cleanup + docs)

Files to modify:
- docs/PRODUCT_SURFACES.md
- docs/app-consolidation.md
- apps/manual-site/src/content/mvpFacts.ts
- apps/lab3-webapp/* (archive or delete)
- src/os/*, src/kernel/* (archive or delete)
- packages/rb-apps/src/macros/* (macro library location)
- packages/rb-apps/src/fixtures/import/* (new fixtures)

Tests to add:
- manual-site sanity gate remains.
- packages/rb-apps/src/__tests__/rbproject-stability-gate.test.ts
- packages/rb-apps/src/__tests__/export-stability-gate.test.ts
- packages/rb-apps/src/__tests__/vector-trace-stability-gate.test.ts
- packages/rb-apps/src/__tests__/import-export-fixture-roundtrip-gate.test.ts

Migration steps:
- Remove from CI build targets or archive with clear README.

---

## Appendix A) IDE Mode Contract

Modes and responsibilities:
- Project: file tree, metadata, configuration, import/export status.
- Design: schematic editor only.
- Verify: deterministic sim, probes, vectors, traces.
- Export: Basys3 bundle + Vivado handoff.
- Import: HDL/XDC paste and zip import.

Shared context:
- Single RBProject provider and derived selectors.

---

## Appendix B) RBProject File Manifest

Canonical paths:
- /top.vhd
- /top.xdc
- /testbench.vhd
- /README.txt
- /submodules/*

Rules:
- All generated artifacts must be deterministic and stable in ordering.

---

## Appendix C) Basys3 IO Contract v1

Allowed IO:
- Switches: SW0..SW15
- LEDs: LD0..LD15
- Buttons: BTNC, BTNU, BTNL, BTNR, BTND
- Clock: CLK100MHZ

Rules:
- Unsupported pins produce warnings and are ignored in export.
- Export uses only supported pins.

---

## Appendix D) HDL Import Subset v1

Supported:
- module/entity + port declarations
- structural instantiations with port maps
- simple assign pass-through (signal to signal)
- recognized gate primitives and mapped modules

Unsupported:
- behavioral always/process blocks
- generate loops, inferred RAMs, complex expressions

Fallback:
- HDL-only view + warnings; no schematic reconstruction.

---

## Appendix E) Vivado Import v1.5 (zip sources)

Scope:
- Upload zip containing *.vhd, *.v, *.xdc
- Detect top module and map deterministically
- Same RBProject output as paste flow

---

## Appendix F) Deletion Matrix

Keep (core):
- packages/rb-apps
- packages/rb-logic-core
- packages/rb-logic-view
- packages/rb-logic-3d (viewer only, optional)
- apps/playground

Archive or delete (duplicate/legacy):
- apps/lab3-webapp (archive or delete; do not build in CI)
- apps/studio (delete if unused)
- src/os/*, src/kernel/* (legacy OS sources)

Dev-only (lazy):
- packages/rb-shell (load only with `?launcher=1`)

---

End of plan.
