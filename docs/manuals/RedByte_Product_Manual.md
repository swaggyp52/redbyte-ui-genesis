# RedByte Product Manual

**Version 1.4** - August 2026
**Platform Version:** RedByte Stable Preview - Browser-E0
**Attribution:** Connor Angiel
**License:** RedByte Proprietary License (RPL-1.0)

---

## Document Control

| Field | Value |
|-------|-------|
| Document ID | RB-MAN-001 |
| Version | 1.4 |
| Date | 2026-08-01 |
| Release posture | Stable Preview - Browser-E0; no Vivado, bitstream, board, or classroom-reliability claim |
| PDF artifact | Generated and visually inspected from the synchronized print source during stable-preview closeout |
| Classification | Product Reference |
| Repository | `redbyte-ui` monorepo |
| Primary Package | `packages/rb-apps` |
| Target Board | Digilent Basys 3 (Artix-7 XC7A35T) |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Product Overview](#2-product-overview)
3. [Intended Users and Usage Contexts](#3-intended-users-and-usage-contexts)
4. [Core Concepts and Operating Model](#4-core-concepts-and-operating-model)
5. [Getting Started](#5-getting-started)
6. [Workspace and Interface Overview](#6-workspace-and-interface-overview)
7. [Detailed Surface Reference](#7-detailed-surface-reference)
   - 7.1 Project Surface
   - 7.2 Design Surface
   - 7.3 Simulate Surface
   - 7.4 Board & Constraints Surface
   - 7.5 Build & Export Surface
   - 7.6 Import Surface
8. [Circuit Design Workflow](#8-circuit-design-workflow)
9. [Simulation and Verification Workflow](#9-simulation-and-verification-workflow)
10. [Hardware Mapping and Physical Board Preparation](#10-hardware-mapping-and-physical-board-preparation)
11. [Vivado Export and External Tool Workflow](#11-vivado-export-and-external-tool-workflow)
12. [Import and Reuse Workflows](#12-import-and-reuse-workflows)
13. [Submission, Review, and Instructor Workflows](#13-submission-review-and-instructor-workflows)
14. [Files, Packages, and Generated Outputs](#14-files-packages-and-generated-outputs)
15. [Troubleshooting and Error Resolution](#15-troubleshooting-and-error-resolution)
16. [Best Practices](#16-best-practices)
17. [Glossary](#17-glossary)
18. [Appendices](#18-appendices)
   - A. Logic Primitive Reference
   - B. Basys 3 Pin Reference
   - C. Generated File Specifications
   - D. Keyboard Shortcuts
   - E. Import Fidelity Reference

---

## 1. Introduction

### 1.1 Purpose of This Manual

This manual is the canonical product reference for RedByte, a browser-based digital logic design, simulation, verification, and FPGA hardware-preparation environment. It describes the product as it exists, explains its operating model, documents each major surface and workflow, and provides reference material for students, instructors, evaluators, and developers.

### 1.2 How to Use This Manual

Students beginning their first project should read Sections 2 through 6, then follow the workflow sections (8 through 11) in order. Instructors and graders should additionally read Section 13 for submission and review workflows. Evaluators and developers will find the appendices and glossary useful as standing reference material.

### 1.3 Conventions

Throughout this manual, the following conventions apply:

- **Stage names** are capitalized (Project, Design, Simulate, Board & Constraints, Build & Export) and refer to the five RedByte-owned workflow stages. **Import / Recover** is a recovery/restore utility, not a sixth progress stage.
- **Bold terms** on first use indicate entries defined in the Glossary (Section 17).
- Procedural steps are numbered. Substeps use letters.
- "Result:" after a procedure indicates what the user should observe upon completion.
- Notes, warnings, and cautions are marked explicitly.

---

## 2. Product Overview

### 2.1 What RedByte Is

RedByte is a deterministic FPGA learning and project-building environment that runs entirely in a web browser. It provides a unified workspace where users create supported combinational and sequential projects, verify behavior with authored testbench checks, map top-level ports to physical FPGA board pins, export a complete file set for AMD Vivado, and record proof when Vivado or board behavior matters.

RedByte targets the **Digilent Basys 3** development board (Xilinx Artix-7 XC7A35T FPGA). It reduces the fragmented workflow of separate schematic editors, simulation tools, and manual constraint-file authoring, but it does not replace Vivado, perform timing closure, or guarantee arbitrary HDL/hardware success. Vivado remains the tool that synthesizes, implements, generates bitstreams, and programs hardware.

### 2.2 The Problem RedByte Solves

Digital logic education traditionally requires students to work across multiple disconnected tools: a schematic or HDL editor, a logic simulator, a constraint-file editor, and a synthesis toolchain. Each tool has its own learning curve, its own file formats, and its own failure modes. Students spend significant time on tool mechanics rather than learning digital logic.

RedByte eliminates this fragmentation. The canonical workflow — design, simulate, assign board constraints, build, and export — happens within a single browser window. The transition from simulation to physical hardware is a continuous, guided process rather than a disjointed series of manual file operations.

### 2.3 Core Capabilities

RedByte provides these capabilities in a single integrated environment:

**Circuit Design.** A visual drag-and-drop canvas for constructing digital circuits from supported logic primitives, boundary I/O, and sequential elements. Users place gates, inputs, outputs, registers, flip-flops, and reusable blocks, then connect them with wires. The current Design palette does not expose a generic Clock block: FPGA clock intent comes from the Basys3 `CLK100MHZ` board resource, while pure browser simulation can use RedByte's automatic internal simulation clock.

**Deterministic Simulation.** A tick-based simulation engine that evaluates circuits using topological sorting to guarantee deterministic signal propagation. The same circuit with the same inputs produces the same outputs on every run, on every machine.

**Truth Table Verification.** An automated verification engine that runs the student's circuit against expected truth table vectors and reports pass/fail results per vector row. Verification supports both combinational circuits (single-tick evaluation) and sequential circuits (multi-tick clocked evaluation).

**Hardware Pin Mapping.** The Board & Constraints stage assigns circuit input and output ports to physical Basys 3 board resources and package pins — switches, LEDs, push buttons, seven-segment display segments, and the on-board clock.

**Vivado Export.** A complete export pipeline that generates synthesizable VHDL (`top.vhd`), pin constraints (`top.xdc`), and a VHDL testbench (`testbench.vhd`), along with automation scripts and documentation files, packaged in a ZIP file ready for import into AMD Vivado.

**Project Import.** Support for importing VHDL source files, Xilinx constraint files (XDC), and RedByte project archives, with explicit fidelity reporting that tells the user exactly what was and was not preserved during import.

**Submission Packaging.** A deterministic submission export system that bundles the student's project, verification results, and integrity hashes into a tamper-evident archive for instructor review.

### 2.4 Design Philosophy

RedByte operates under several core principles that shape its behavior:

**Determinism by design.** Every simulation tick is reproducible. The same initial state and the same input sequence always produce the same output. There is no hidden randomness, no race condition, and no undefined behavior. This is enforced architecturally through topological-sort evaluation, integer-only signal values, and explicit state management.

**One truth, many views.** The circuit exists as a single source of truth. Every surface — the design canvas, the verification table, the hardware mapping panel, the generated HDL — is a projection of the same underlying circuit data. When the circuit changes in one view, all views reflect that change.

**Truth over simplification.** RedByte simulates real digital logic behavior. Gates have propagation delay (one tick minimum). Combinational circuits stabilize over multiple ticks. Sequential circuits still depend on real clock edges, but Basys3 board-clocked designs can have those edges auto-generated by Simulate and the exported testbench instead of forcing students to hand-author oscillator pulses. Students learn correct mental models rather than oversimplifications.

**Local-first operation.** All computation happens in the browser. No server is required, no account is needed, and no data leaves the user's machine unless explicitly exported. RedByte works offline after the initial page load.

### 2.5 Product System v3 Candidate Authority Summary

The current candidate unifies the student flow as **Project -> Design Edit / Live / Replay -> Simulate Scenario / Replay / Checks -> Board & Constraints -> Build & Export**, with **Import / Recover** as a separate recovery utility. Internal `verify`, `hardware`, and `export` route IDs remain for compatibility; current student-facing copy uses the Product System v3 stage names.

- Project explains the loaded student's design, proof, mapping, package state, and one recommended next action.
- Design keeps the circuit grid dominant and gives ports direct, keyboard-reachable wiring targets.
- Simulate owns named scenarios, authored stimulus, optional checks, per-document sequential execution policy, run transport, waveform evidence, Replay, and current-versus-stale validation authority.
- Board & Constraints owns a semantic signal-to-resource projection that must agree with generated XDC and Build & Export.
- Build & Export separates structural `blocked` / `downloadable`, `verificationTrust` `unverified` / `draft` / `trusted`, and action `not-downloaded` / `downloaded`; the current download receipt identifies the exact package.
- Import is manifest-first for RedByte ZIPs and preserves exact scalar/vector-bit identities through recovery.

Named sequential policy remains browser-local and outside portable `RBProject`, but it is not package-neutral. RedByte materializes authored rows and policy into one shared execution-vector sequence consumed by runtime Verify, bring-up expectations, and generated `testbench.vhd` together with the resolved clock/schedule projection. Auto `runCycles`, automatic reset behavior, resolved clock data, starting level, and authored stimulus may therefore change package bytes, stale Export, and invalidate a prior receipt. UI status, waveform, and Compare-result objects do not generate bytes. This remains Browser-E0/software-artifact behavior; it is not Vivado or board proof.

The prior v2B Stable Preview evidence included 157 focused tests plus workspace typecheck, IDE CSS audit, unified build, and browser evidence at `1366x768` and `1440x900` under Node 20.19.0 / pnpm 10.24.0. It remains historical Browser-E0/local package evidence, not authority for the current candidate and not Vivado execution, bitstream generation, board programming, physical observation, or unsupervised classroom reliability. Guided 4-bit, Mapping Assistant v2, RegisterBus, and StateBank execution remain deferred.

---

## 3. Intended Users and Usage Contexts

### 3.1 Students

Students are the primary users of RedByte. They use the IDE to complete lab assignments that involve designing digital circuits, verifying correctness against provided test vectors, mapping circuits to the Basys 3 board, and exporting files for synthesis in Vivado.

The student experience is designed around a simplified, student-appropriate vocabulary. Diagnostic details such as manifest hashes, bundle identifiers, and internal pipeline states are hidden behind optional advanced panels. The default view presents clear, actionable information: build your circuit, verify it passes, map the pins, download the Vivado kit.

### 3.2 Instructors and Teaching Assistants

Instructors use RedByte in two contexts. First, they may use the IDE directly to prepare lab starter circuits, define test vectors, and verify reference solutions. Second, they use the **Submission Inspector** — a separate application context within RedByte — to review student submissions, verify integrity, inspect gate verdicts, and view detailed diagnostic information including hash verification and tamper detection.

### 3.3 Evaluators and Reviewers

Professors, accreditation reviewers, and other evaluators may examine RedByte as a platform. This manual provides them with a complete picture of what the product does, how its workflows operate, and what guarantees it makes about determinism, correctness, and integrity.

### 3.4 Application Contexts

RedByte runs in four application contexts, each suited to a different usage scenario:

| Context | Purpose | Primary User |
|---------|---------|-------------|
| **IdeApp** | Five-stage lab IDE with a separate Import / Recover utility | Students |
| **SubmissionInspectorApp** | Grading tool with full diagnostic detail | Instructors, TAs |

The IdeApp is the primary context documented in this manual. The SubmissionInspectorApp is an architecturally defined context whose inspector functionality is currently delivered through the IDE's Project surface; it exposes diagnostic information that the student view intentionally hides.

> **Note:** LogicPlaygroundApp and LabWorkspaceApp are defined in the architecture as additional application contexts but are not separately documented here. Their capabilities are delivered through the IdeApp.

---

## 4. Core Concepts and Operating Model

### 4.1 The Canonical Workflow

RedByte organizes work into a product spine that carries a project from browser authoring to real FPGA evidence:

```
Project -> Design -> Simulate -> Board & Constraints -> Build & Export -> Vivado -> Program Board -> Observe
```

The five numbered IDE stages cover the RedByte-owned portion of that spine: Project, Design, Simulate, Board & Constraints, and Build & Export. The implementation retains `verify`, `hardware`, and `export` route IDs for compatibility; they are not the student-facing stage names. Import / Recover is a separate utility for restoring RedByte work or inspecting external HDL/XDC; it is not a stage-completion requirement. Vivado build, board programming, and physical observation happen outside RedByte but are part of the product proof model.

The workflow proceeds as follows:

1. **Project.** The user creates or opens a project, reviews its metadata, and selects a starter example if desired.
2. **Design.** The user constructs a digital circuit on the visual canvas by placing logic primitives and wiring them together.
3. **Simulate.** The user authors stimulus, runs the circuit, and inspects waveform or circuit replay. Expected-output assertions are optional; when present, the engine evaluates them independently and highlights mismatches.
4. **Board & Constraints.** The user maps each circuit input and output port to a physical Basys 3 board resource and package pin (switches, LEDs, buttons, clock).
5. **Build & Export.** The system generates synthesizable VHDL, pin constraints, a testbench, Tcl, README/bring-up files, and the project manifest. The user downloads a ZIP file for use in Vivado.
6. **Vivado.** The user opens/builds the exported project in Vivado; synthesis, implementation, and bitstream generation are Vivado responsibilities.
7. **Program Board.** The user programs a Basys 3 target with the Vivado-generated bitstream when E2 proof is required.
8. **Observe.** The user records board behavior against an explicit procedure when E3 proof is required.

Users may navigate between surfaces freely. The system tracks which stages have been completed and displays readiness indicators.

### 4.1.1 Draft, Trusted, and Proven States

RedByte intentionally separates readiness levels:

| State | What it means |
|-------|---------------|
| **Draft design** | A circuit exists, but it may not have current testbench, mapping, or export proof. |
| **Simulated** | The current design/scenario has a completed RedByte run with waveform and replay evidence. Assertions may be absent or failing; this tier is not a validation claim. |
| **Testbench configured** | Stimulus and expected output checks exist for the current design intent. |
| **Validated** | Current observed outputs match all configured expected outputs. This is the Verify proof needed for trusted handoff. |
| **Pins mapped** | Required top-level ports are assigned to board resources/package pins. |
| **Draft export** | A structurally valid Vivado package can be generated or downloaded, but proof is missing or stale. |
| **Trusted export** | Current passing assertions, current mapping, and the current export bundle all describe the same project state. |
| **Vivado built** | Vivado synth/implementation/bitstream completed for the exported project. |
| **Board programmed** | A Basys 3 board was programmed with the generated bitstream. |
| **Board observed** | Physical behavior was recorded against an agreed observation procedure. |

### 4.2 Circuits and Nodes

A **circuit** in RedByte consists of **nodes** and **connections**. A node is any supported logic element, sequential element, boundary input/output, board resource, reusable block, or backward-compatible serialized element. Each node has named **ports** — inputs and outputs through which signals flow.

A **connection** links one node's output port to another node's input port. Connections are directional: signals flow from output ports to input ports. A single output port may fan out to multiple input ports.

The canonical connection format is:

```
{ id, from: { nodeId, portName }, to: { nodeId, portName } }
```

### 4.3 Simulation Model

RedByte's simulation engine operates on discrete **ticks**. Each tick, the engine evaluates every node in the circuit in **topological order** — nodes whose inputs depend only on already-evaluated nodes are evaluated first. This ordering guarantees that signal propagation is deterministic and race-free.

For **combinational circuits** (circuits with no flip-flops or other sequential elements), evaluation typically stabilizes within one or two ticks. The engine supports a stabilization loop that continues ticking until no signals change, up to a configurable maximum.

For **sequential circuits** (circuits containing flip-flops), the engine detects clock edges by comparing the current clock value against the previous tick's value. A rising edge (0 → 1 transition) triggers data capture in flip-flops. All flip-flops sharing the same clock capture simultaneously within a single tick.

In manual/custom mode, each authored row is one settled sample and drives the resolved clock input from the authored value. Only a low-to-high transition advances the supported rising-edge state model. Repeated high, high-to-low, repeated low, and a flat-low lane hold rising-edge state. An authored falling transition is valid stimulus, but it does not enable falling-edge-triggered capture. The persisted `activeEdge` field is normalized to `rising` in this RC; it is not a switch for falling-edge capture. Manual/custom execution adds no hidden reset; reset follows authored stimulus unless an explicitly selected automatic policy says otherwise.

### 4.4 Verification Model

Simulation always executes the authored stimulus and records observed outputs. Expected outputs are optional assertions attached to authored rows. A run with no assertions completes as **Simulation complete / No checks configured** and never reports FAIL. When assertions exist, RedByte compares them with observed outputs and reports assertion PASS or FAIL independently from the completed simulation.

RedByte supports two verification schedules:

- **Combinational schedule.** For circuits without sequential elements. The engine applies inputs, ticks once to let signals propagate, and reads outputs.
- **Clocked / sequential schedule.** For circuits containing flip-flops or latch controls. The named document selects the policy, then one shared materializer produces the execution vectors used by runtime, bring-up expectations, and testbench generation. Auto board-clock mode starts at cycle 0 and materializes `max(runCycles, authored-row count, 1)` rows; every Auto report row and generated VHDL assertion is sampled post-rising-edge. When automatic reset applies, reset assertion appears in materialized cycle 0 and deassertion in later cycles rather than in a hidden runtime prelude. Manual/custom mode treats each authored row as one settled sample, drives the clock from that row, and advances rising-edge state only on low-to-high transitions.

The verification engine automatically detects which schedule to use based on the presence of flip-flop nodes in the circuit.

### 4.5 Hardware Mapping Model

Hardware mapping assigns each circuit port to a physical pin on the Basys 3 board. RedByte maintains a complete pin database for the Basys 3, including 16 slide switches, 16 LEDs, 5 push buttons, 7-segment display cathodes and anodes, a decimal point, and the 100 MHz on-board clock.

Pin mapping is a prerequisite for export. The export pipeline uses the mapping to generate correct XDC constraint lines.

### 4.6 Export Model

The export pipeline converts the circuit graph, pin mapping, and test vectors into a ZIP file containing three primary HDL/constraint files and several support files:

**Primary files:**

- **`top.vhd`** — Synthesizable VHDL describing the circuit as a top-level entity.
- **`top.xdc`** — Xilinx constraint file mapping ports to Basys 3 physical pins with LVCMOS33 I/O standard.
- **`testbench.vhd`** — A VHDL testbench that exercises the truth table vectors for simulation in Vivado.

**Support files:**

- **`vivado_import.tcl`** — Tcl script for automated Vivado project creation.
- **`program_and_test.tcl`** — Tcl script for programming and testing the board.
- **`README.txt`** — Quick-start instructions for the Vivado import workflow.
- **`BRINGUP.md`** — Detailed board bring-up guide.
- **`EXPECTED_IO.json`** — Machine-readable I/O expectations for automated verification.
- **`project.rbproj.json`** — RedByte project snapshot for round-trip import.

There is one generation path — the HDL/XDC previews, downloaded ZIP, semantic mapping projection, and the `project.rbproj.json` embedded artifact projection must agree on the exact generated bytes. A package receipt binds that generated package to its source fingerprint, project/Verify hashes, mapping currentness, download kind, trust state, and SHA-256.

For sequential exports, that generation path consumes the shared materialized execution vectors plus the resolved clock/schedule projection. Auto board-clock testbenches use a free-running generator and wait for a rising edge before each materialized row's assertion, including cycle 0. Manual/custom testbenches omit that scaffold, assign the clock from each materialized authored vector, and use the deterministic settle interval. Auto `runCycles`, automatic reset behavior, resolved clock data, starting level, and authored stimulus may change `testbench.vhd`, the package fingerprint, Export freshness, and receipt currentness.

### 4.7 Import Fidelity Model

When importing external files, RedByte reports one of three **fidelity levels** describing how completely the import preserved the original content:

| Level | Name | What Is Preserved |
|-------|------|-------------------|
| 1 | **Full** | All circuit state, node positions, I/O mapping, test vectors, and metadata. Achieved when importing a RedByte project archive (`.rbproj.json`). |
| 2 | **Reconstructed** | Circuit topology reconstructed from supported structural VHDL or the supported RedByte-generated concurrent-assignment subset. Node layout is auto-assigned; authored Verify documents, mapping, and RedByte metadata require the manifest. |
| 3 | **Partial** | Only I/O port names and directions extracted. Achieved when importing arbitrary behavioral/process HDL or unsupported constructs. |

---

## 5. Getting Started

### 5.1 System Requirements

RedByte runs in any modern web browser with JavaScript enabled. Recommended browsers: Google Chrome, Microsoft Edge, or Mozilla Firefox (current versions).

For FPGA synthesis and board programming, the following additional software is required on the host machine:

- **AMD Vivado ML Standard Edition** (2024.1 or later), free download from AMD/Xilinx.
- A USB connection to the Basys 3 board for programming.

RedByte itself requires no installation and no server. It runs entirely client-side.

### 5.2 Development Installation

For development or local hosting:

```powershell
git clone <repository-url>
cd redbyte-ui-genesis-main
corepack pnpm install --frozen-lockfile
corepack pnpm run dev
```

The development server starts on `http://localhost:5173` by default.

### 5.3 First Launch

At the public Start entry, the user sees a concise RedByte explanation, the five-stage workflow, and one primary action to open the browser workbench. Product readiness, project metrics, and advanced IDE controls do not appear on this entry page.

Inside the IDE, the user arrives at the **Project** surface with one dominant start action plus secondary Build Fresh, Open Starter, Import Project, and Open Existing paths. Built-in examples remain available through the starter browser:

| Example | Description | Circuit Type |
|---------|-------------|-------------|
| Signal Tour | Four-wire passthrough (SW→LD) | Combinational |
| Logic Gates | AND, OR, XOR with 2 switches and 3 LEDs | Combinational |
| Half Adder | Sum and carry from two inputs | Combinational |
| Full Adder | One-bit addition with carry-in and carry-out | Combinational |
| Two-Bit Counter | 2-bit binary counter with clock and reset | Sequential |

Selecting a starter example loads a pre-built circuit with test vectors, pin mappings, and learning goals, then opens the Design surface with a starter-loaded handoff that names the active starter and the next action. The user can modify the circuit freely after loading.

### 5.4 Quick Walkthrough: First Circuit to Vivado Export

This walkthrough produces a working AND gate, verifies it, maps it to hardware, and exports it for Vivado.

1. Open RedByte and navigate to the **Project** surface.
2. Click the recommended **Continue Design** action or select **Design** in the horizontal stage navigator.
3. From the component palette on the left, drag two **Switch** nodes and one **AND** gate onto the canvas.
4. Drag one **Lamp** node onto the canvas.
5. Wire the output of each Switch to one input of the AND gate.
6. Wire the output of the AND gate to the input of the Lamp.
7. Navigate to the **Simulate** surface.
8. Build a small stimulus scenario or load the starter rows for AND logic.
9. Click **Run simulation** and inspect the replay. Add expected-output checks if a trusted handoff is required, then rerun and confirm that all assertions pass.
10. Navigate to **Board & Constraints**.
11. Assign each Switch port to a Basys 3 slide switch (e.g., SW0, SW1).
12. Assign the Lamp port to an LED (e.g., LD0).
13. Navigate to the **Build & Export** surface.
14. Review the readiness checklist. All items should show as complete.
15. Click **Download Package**.
16. Extract the downloaded ZIP. It contains `top.vhd`, `top.xdc`, `testbench.vhd`, automation scripts, and documentation files (see Section 11.2 for the complete file list).

Result: A draft or trusted Vivado-ready project, depending on whether assertion and mapping proof are current. See Section 11 for instructions on importing these files into Vivado and programming the board.

---

## 6. Workspace and Interface Overview

### 6.1 Global Shell

The RedByte IDE shell is present on every surface and consists of three persistent regions:

**Top Bar.** Displays the RedByte product mark, editable current-project identity, board target, save state, Import / Recover utility, and Help. Run, mapping, and export actions remain inside the surfaces that own them.

**Horizontal Stage Navigator.** Contains exactly five workflow stages: Project, Design, Simulate, Board & Constraints, and Build & Export. Each stage may show current, complete, attention, or blocked. Import / Recover appears separately in the top bar and never receives a stage number or completion state.

**Main Content Area.** Occupies the remaining workbench and displays the active surface's primary work object. The shell does not add a proof ribbon, bottom status footer, or injected product-spine header above every surface; readiness and result decisions stay with the surface that owns them.

### 6.2 Navigation Model

Surface switching is explicit through the horizontal stage navigator and surface CTAs. Certain Project actions intentionally carry the user into the next surface when they load a starter or use a direct recovery path. Those transitions state what loaded and what the next action is so the active workflow remains unambiguous.

### 6.3 Empty States

Every surface provides a clear empty state when no relevant data is present. Empty states include a headline describing the situation, a primary call-to-action button directing the user to the next logical step, and one or more secondary actions. For example, the Design surface's empty state shows "Build your first circuit" with a primary CTA of "Add input/output pins."

### 6.4 Status Indicators

Pills are reserved for a small number of semantic states such as PASS, FAIL, stale, and blocked. Ordinary project facts appear as headings, rows, labels, or sentences. A command region shows no more than two dominant status indicators and one state-appropriate primary action.

---

## 7. Detailed Surface Reference

### 7.1 Project Surface

**Mode ID:** `project`

**Purpose.** The Project surface is the action-first entry point for starting, opening, or continuing circuit work. It keeps project identity and the current next action visible without turning the first viewport into a readiness dashboard.

**When to Use.** At the beginning of a session, when creating a new project, when reviewing project readiness before export, or when changing project metadata.

**Major UI Regions.**

- *First launch:* `Start your circuit` with one primary lab/start action and secondary Build Fresh, Open Starter, Import Project, and Open Existing paths.
- *Loaded project:* A live engineering overview for identity, Design, Simulate, Board & Constraints, Build & Export, blocker, and one recommended next action.
- *Project-changing actions:* Start Lab, Build Fresh, Open Starter, Import, and Open Existing remain together in one secondary section.

**Primary Controls.**

- Edit project name and description.
- Open a starter example (with overwrite confirmation if unsaved work exists). Loading a starter opens Design immediately after the starter becomes authoritative.
- Review readiness, mapping, testbench, and export summaries directly in the loaded-project overview without turning them into competing cards or first-viewport actions.
- Use the Project mapping summary as the same authoritative pin map consumed by Board & Constraints and Build & Export; if a top-level port is renamed in Design, the renamed port remains the current mapping target instead of creating a second hidden/export-only port identity.

**Typical Workflow.** Create or open a project → review metadata → optionally load a starter example → Design opens with the loaded starter name and next action.

**Outputs.** Updated project metadata. Readiness assessment for downstream surfaces.

**Student-Facing Content.** Students see project/lab identity, board target, saved state, a read-only live circuit snapshot, design size, current testbench evidence, mapping progress, package state, and one next action. Manifest hashes and low-level developer diagnostics do not occupy the normal workspace.

**Common Mistakes.**

- Opening a starter example without saving current work. The system prompts for confirmation before overwriting.
- Proceeding to Export without completing IO mapping. The Project surface displays blocking-issue callouts with direct navigation links.

---

### 7.2 Design Surface

**Mode ID:** `design`

**Purpose.** The Design surface is the primary circuit editor. Users construct digital circuits by placing logic primitives on a visual canvas and connecting them with wires.

**When to Use.** Whenever the circuit needs to be created or modified. This is where all structural changes to the circuit occur.

**Major UI Regions.**

- *Main center:* The Circuit canvas, which owns the majority of the workbench.
- *Core toolbar:* Select, Wire, Undo, Redo, and workspace-view controls remain in the primary authoring bar. Fit, Zoom, Reset view, and Center selection remain reachable camera actions; at viewport widths of `1400px` and below, lower-frequency camera actions move under **More tools** instead of competing with the core editing controls.
- *Workspace mode:* **Edit**, **Live**, and **Replay** describe the same canvas without implying that exploratory switching is saved verification evidence. Edit owns structural authoring, Live is exploratory simulation, and Replay is enabled only for a recorded Verify run and is read-only.
- *Left library:* Stable `200-220px` searchable component library with compact categories and distinct board resources.
- *Right inspector:* Contextual selection support rather than a permanent third column. Idle Design keeps the Inspector closed so the canvas receives that width; selecting a circuit object or supported workspace asset opens the bounded Inspector with the relevant properties, constraints, and health detail. At constrained widths selected details move below the canvas automatically.

The frozen RC laptop measurements describe the three-region selected-object state, not idle Design: with the contextual Inspector open, the circuit grid occupied 63.1% of the 1366px viewport and 65.0% of the 1440px viewport. Both clear the 62% selected-context release floor; neither meets the longer-term 70% target, which remains future layout debt.

**Primary Controls.**

- **Place a component:** Drag from the palette onto the canvas, or use keyboard shortcuts.
- **Wire two ports:** Click an output port, drag to an input port, and release. The system validates the connection before committing it.
- **Select and move:** Click a node to select it; drag to reposition. Multi-select with a selection box.
- **Delete:** Select one or more elements and press Delete, or use the delete tool.
- **Undo/Redo:** Standard keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z). History supports up to 100 levels.
- **Target a port directly:** Node ports expose explicit wiring targets. Sparse layouts use at least 24×24px targets; dense layouts use at least 32×24px targets (the current dense target is 32×36px). Port targeting and wiring remain keyboard reachable.

**Available Components.** The palette starts with a compact Common group containing AND, OR, XOR, NOT, Register1, INPUT, and OUTPUT, followed by the complete categorized library:

| Category | Components |
|----------|-----------|
| Basic Gates | AND, OR, NOT, NAND, NOR, XOR, XNOR |
| 3-Input Gates | AND3, OR3, NAND3, NOR3, XOR3 |
| Native Sequential | Register1 (1-bit), RegisterBus, StateBank |
| Legacy / Theory Sequential | D Flip-Flop, T Flip-Flop, JK Flip-Flop, RS Latch, D Latch |
| I/O and Sources | INPUT, OUTPUT, Ground; Basys3 inputs, outputs, and `CLK100MHZ` are selected from Board Resources |
| Reusable Blocks | FullAdder plus user-authored custom components |

This is the student-authoring palette, not the runtime-registry count. The logic runtime performs **27 direct `NodeRegistry.register(...)` additions** and **4 composite registrations** (`RSLatch`, `DLatch`, `FullAdder`, `Counter4Bit`) for **31 registry additions**. Registry presence does not imply palette availability: `Clock`, `Delay`, `Wire`, and the stub `Counter4Bit` remain available only to the compatibility/runtime paths allowed by the support registry. See Appendix A for the current student-facing reference and compatibility notes.

**Wiring Rules.**

- Valid connections: output port → input port.
- Invalid connections: input → output, output → output, input → input, self-loops.
- A single output port may connect to multiple input ports (fan-out).
- An input port accepts at most one connection.

**Diagnostic Callouts.** When navigating to Design from a failing verification result, the system displays a diagnostic callout identifying the failing gate and suggesting the user check its inputs. This callout uses student-appropriate language.

**Circuit Health.** The Design surface provides live circuit health feedback through two systems:

1. **Authoring issues** (workspace + inspector): Detects multiple drivers on a single input (blocking error), unconnected inputs (draft), and floating outputs (draft). Affected nodes and ports show severity without requiring a permanent footer.

2. **Compiler diagnostics** (dedicated diagnostics view): The IR elaborator runs on every circuit change and detects structural errors including unknown primitives (IR001), multiple driver conflicts (IR002), floating output ports (IR003), missing clock connections on sequential elements (IR004), disconnected required inputs (IR005), and combinational feedback loops (IR006). Each diagnostic shows severity, code, title, hint, and a focus action.

The inspector panel shows per-selection health: primary issue with severity pill, fix hint, and focus button. Issues found during design will also block Simulate and Build & Export downstream.

**Common Mistakes.**

- Leaving output ports unconnected. The system flags floating outputs as issues.
- Attempting to wire an output to another output. The system rejects the connection.
- Forgetting to add INPUT/OUTPUT nodes for ports that must map to hardware pins.

---

### 7.3 Simulate Surface

**Mode ID:** `verify`

**Purpose.** The Simulate surface is a Simulation & Replay Studio: author stimulus, run the circuit, inspect waveform or circuit replay, and add expected-output assertions when useful.

**When to Use.** After building or modifying a circuit. Simulation helps students understand behavior immediately; optional assertions validate that behavior before a trusted export.

**Major UI Regions.**

- *Scenario workspace:* Named testbench documents appear as visual scenario cards showing combinational/sequential type, event count, optional check count, timing cycles when present, and a compact signal preview. The Timeline lens directly adds, duplicates, deletes, selects, retimes, and edits stable-ID events; several input values may change together at one tick, while duplicate ticks are rejected. The default Timeline view does not require expected values.
- *Workbench lenses:* Timeline owns stimulus, Waveform owns replay evidence, Checks owns optional output expectations, and Testbench shows the generated read-only `testbench.vhd`. The Testbench lens consumes the exact Build & Export artifact and is not an independent editor or static sample.
- *Integrated signal shelf:* Current inputs, outputs, and available internal lanes stay inside the Simulate workbench above the lab grid. Simulate does not reserve a separate left Signals rail; the shelf keeps relevant lanes visible with an explicit path to show the broader signal set.
- *Run controls:* One stable **Run simulation** authority. Scenario, Replay, and Checks are workspace lenses rather than competing run modes.
- *Replay / results:* Quiet before a run; after a run it shows selected case/time, observed values, readable waveform evidence, circuit-replay handoff, and a separate assertion state.

**Primary Controls.**

- **Run simulation:** Execute the current scenario and record deterministic ticks. With no expected values the result is **Simulation complete** and **No checks configured**. With checks, the same run also evaluates them and reports assertion PASS or FAIL separately.
- **Open circuit replay:** Open the recorded run on the real Design canvas. Playback is read-only and provides first/previous/play/next/last controls, a scrubber, speed choices, and keyboard transport.
- **Checks:** Add or edit optional expected-output assertions without obscuring the stimulus-first Scenario view.
- **Choose a repair lane:** Use **Edit expected** when the saved expected value is wrong. Use **Inspect Design** when the expected value is correct and the circuit needs inspection. Structural preflight failures expose **Open Design** so the missing connection can be repaired before Compare runs.
- **Inspect failure diffs:** View expected versus actual values for each failing signal.
- **Edit testbench:** Click directly in the unified grid to change stimulus inputs or expected outputs.
- **Edit the clock lane:** In sequential manual/custom modes, use the dedicated actions **Rows**, **Alternating**, **Rising edge**, **Falling edge**, **Hold high**, and **Hold low**, or hand-edit cells directly. Board-clocked designs default to auto mode instead of requiring an authored pulse row.

**Testbench Authoring Model.** Simulate rows are authored ticks or steps, not whole clock cycles. For sequential circuits, Basys3 board clocks may be auto-driven by policy while data inputs stay authored in the grid. Manual/custom clock modes expose the clock/control lane inside the same grid as the other inputs; each row drives the authored clock value and is sampled after settling. Only low-to-high transitions advance rising-edge state. Falling, repeated-high, repeated-low, and flat-low steps hold it. Expected output cells live in the optional Checks lens. Leaving an expected-output cell Unset means no assertion for that output on that row; simulation and replay remain available.

**Per-document sequential policy.** Every named Verify document may retain its own execution override, run-cycle count, active edge, reset behavior, clock source type, and execution model, together with the resolved signal identity/label and starting level when available. Save, autosave, reload, duplicate, rename, compatible Design repair, and Import recovery must preserve or explicitly repair this policy with the document. Automatic board clock, manual pulses, and custom pattern are distinct authored choices; changing documents changes the policy and authored rows from which the shared runtime/bring-up/testbench execution vectors are materialized.

**Authorship and Design repair.** The named document identity, active document, cases, stimulus, expected values, and sequential steps are authored workspace state. A stimulus-only document with no expected-output checks remains stimulus-only through compatible Design edits, undo, and redo; RedByte does not manufacture checks from the circuit's observed outputs. Moving nodes without changing circuit behavior preserves both the authored document and current run evidence. A compatible truth-affecting Design edit preserves or rekeys the same authored document but revokes current Compare observations and PASS/FAIL authority; references to removed signals remain visible so the student can review or repair them. A structural break reports **DESIGN BLOCKED** until the circuit is repaired. The student then reruns the same document. Prior runs remain available as history, not current proof.

**Clock / timing guidance.** Sequential designs show an inline clock/timing banner above the grid. It names the active clock or latch-control signal, reports whether the source is auto board clock, manual pulses, or a custom pattern, and highlights the authoritative lane only when manual authoring is actually required. If the active clock is the Basys 3 oscillator, RedByte treats `CLK100MHZ` on `W5` as an auto board clock source by default rather than as a manual switch-style input.

**Hint System.** On a FAIL result, the system evaluates 14 diagnostic conditions and displays matching fact-grounded hints to guide the student toward the error. Hints reference specific circuit behaviors — such as unconnected outputs, inverted logic, or missing clock connections — rather than generic advice.

**PASS waveform visibility.** On PASS runs with mapped I/O, the waveform viewport auto-expands mapped stimulus inputs alongside observed outputs by default, so students can read input-to-output cause/effect without expanding hidden signal groups. On FAIL runs, mismatch-focused output lanes remain the default emphasis. Waveform lanes use a 36×36px interaction target and signal labels remain at least 13px so transport and trace meaning stay readable.

**Sequential Circuit Banner.** When the circuit contains D flip-flops, latches, or other sequential elements, the inline guidance banner explains what timing activity is needed before state can advance.

**Freshness Tracking.** Simulate uses a semantic Design fingerprint. Node position/layout, project rename, and project description edits do not change circuit truth and do not revoke current evidence. Topology, node type, logical I/O, and testbench-authority changes stale or clear the current result and require a fresh run.

Simulate keeps `current`, `missing`, `stale`, and `failed` evidence currentness distinct. Observe-only traces are useful inspection but do not support Build & Export `verificationTrust: trusted`. A policy or authored-stimulus edit makes prior evidence stale; a current mismatch remains failed; structural preflight remains blocked until Design is repaired. These labels are not values of the `verificationTrust` enum.

**Common Mistakes.**

- Running verification without any testbench rows defined. The surface displays an empty state directing the user to add cases.
- Ignoring the stale indicator after modifying the circuit. Always re-verify after design changes.
- Expecting a sequential circuit with no detected clock source to advance anyway. Board-clocked designs auto-run, but switch/button-clocked or latch-controlled designs still need the required timing activity before checking outputs.
- Treating a flat manual clock as an implicit pulse. A flat-low lane and repeated levels must hold rising-edge state; outputs that advance in that condition cannot authorize Export.

---

### 7.4 Board & Constraints Surface

**Mode ID:** `hardware`

**Purpose.** Board & Constraints maps circuit input and output ports to physical resources and package pins on the Basys 3 development board. This mapping is required before the export pipeline can generate valid constraint files.

**When to Use.** After the circuit is designed and (ideally) verified. Pin mapping must be complete before exporting the Vivado kit.

**Major UI Regions.**

- *Mapping table:* The primary work object, grouped by Inputs, Outputs, and Clock / Reset, with signal, purpose, resource, package pin, status, and action.
- *Selected-signal editor:* A stable support region for direction, requirement, current binding, compatible resources, assignment, and inline conflict repair.
- *Board reference:* A useful but secondary, non-assignment Basys 3 view. It visualizes the selected/current binding, while the resource selector in the selected-signal editor is the sole assignment authority.
- *No-signal state:* One direct Open Design recovery action; inactive board and mapping apparatus are not presented as available work.

**Primary Controls.**

- **Assign or edit a signal:** Select **Assign**, **Edit mapping**, or **Resolve** in a mapping-table row.
- **Choose a resource:** Use the selected signal's **Basys3 resource** selector. Options are filtered by direction and occupied resources are disabled.
- **Save assignment:** Apply the selected resource with **Save assignment**. The package pin and `top.xdc` consequence update from the same authority.
- **Clear one assignment:** Use **Clear** in the selected-signal editor when the current row already has a saved resource.

**Basys 3 Pin Categories.**

| Category | Quantity | Example Pins |
|----------|----------|-------------|
| Slide Switches | 16 | SW0 (V17) through SW15 |
| LEDs | 16 | LD0 (U16) through LD15 |
| Push Buttons | 5 | BTNC (U18), BTNU (T18), BTNL (W19), BTNR (T17), BTND (U17) |
| 7-Segment Cathodes | 7 | CA through CG |
| 7-Segment Anodes | 4 | AN0 through AN3 |
| Decimal Point | 1 | DP |
| Clock | 1 | CLK100MHZ (W5) |

See Appendix B for the complete pin reference table.

**Mapping Status.** Progress and each row distinguish assigned, unassigned, needs-review, and conflict states. Export cannot become a trusted current handoff until required assignments are coherent.

**Semantic mapping projection.** Each mapping row carries one coherent projection of logical signal ID/label, direction, generated artifact port name, board resource ID/label, package pin, I/O standard, exact XDC line, required state, and conflict state. The preview, saved mapping, generated `top.xdc`, embedded manifest, and Export receipt must agree. Conflicts are attached to the affected row and name the conflicting resource or identity.

**Proof Boundary.** Board & Constraints proves the saved signal-to-resource-to-package-pin assignment used for XDC generation. It does not prove Vivado build, programming, or physical board behavior.

**Common Mistakes.**

- Leaving ports unmapped. The system clearly indicates which ports still need pin assignments.
- Assigning an input port to an LED (output-only pin). The system filters available pins by direction.
- Forgetting to map a top-level FPGA clock signal. When a sequential hardware design exposes a clock port, assign it to `CLK100MHZ` (W5). Pure browser simulation can instead use RedByte's automatic internal simulation clock and does not require a Design-palette Clock block.

---

### 7.5 Build & Export Surface

**Mode ID:** `export`

**Purpose.** The Build & Export surface validates package readiness, previews generated artifacts, and produces the Vivado Kit ZIP file containing synthesizable VHDL, constraint files, and a testbench.

**When to Use.** After the circuit has been designed, simulated, and all required signals have been assigned in Board & Constraints.

**Major UI Regions.**

- *Readiness decision:* The first and only handoff authority for blocked, draft, ready-to-build, and trusted/current states, with one state-appropriate repair, build, or download action.
- *Submission answer:* The first viewport explicitly answers **What should I submit?** for the current state before technical details.
- *Package workspace:* When a meaningful draft or ready package exists, a stable file list shows role/state and a selected-file preview shows exact generated content.
- *Technical evidence:* **Open technical evidence** opens a separate dialog for readiness gates, diagnostics, hashes, and provenance; it stays secondary to the student handoff and file browser.
- *Blocked state:* Direct recovery guidance replaces the package browser when prerequisites are missing; no unavailable package is presented as ready.

**Primary Controls.**

- **Open Build & Export:** Stage-owned actions elsewhere in the product route package work into this workspace rather than duplicating package controls.
- **Download Package:** Primary action for a trusted current package. A structurally valid but untrusted project exposes the separate **Download draft** action; a draft download never inherits trusted labeling.
- **File browser:** Select a generated file to preview its exact content, then use **Copy file** or **Download file** for that file.
- **Open technical evidence:** Open and close the secondary evidence dialog without hiding or replacing the package decision and file browser.

**Readiness Checklist.** The surface displays a plain-language checklist:

- Circuit built? (Has the design been created?)
- Simulation passed? (Has verification completed with PASS?)
- Pins mapped? (Are all ports assigned to Basys 3 pins?)

**Three trust axes.** Export evaluates structural `blocked` / `downloadable`, `verificationTrust` `unverified` / `draft` / `trusted`, and action `not-downloaded` / `downloaded`. Verify evidence currentness (`current`, `missing`, `stale`, or `failed`) is upstream and must not be substituted for `verificationTrust`. A downloadable package may remain `draft`; download action cannot promote it to `trusted`.

**Package receipt.** A current download receipt binds the exact package source fingerprint, project hash, Verify hash, mapping currentness, download kind, trust state, and SHA-256. The receipt cannot be reused after any authority input changes.

**Manifest agreement.** `project.rbproj.json` is generated as part of the same canonical package projection and embeds the exact generated `top.vhd` and `top.xdc` content. The preview, ZIP files, semantic mapping projection, and embedded manifest must agree byte-for-byte where the contract requires exact content.

**Export Blocking Conditions.** Export is blocked when:

- Required I/O mapping is incomplete.
- The circuit contains nodes that cannot be synthesized (e.g., analog-only nodes).
- Top-level port constraints are missing or invalid.

Each blocking issue includes a direct navigation link to the surface where the issue can be resolved.

**Scaffold Warnings.** For certain starter examples and projection-only exports, the system may display informational warnings about HDL/XDC port mismatches. These are expected for INPUT/OUTPUT-only circuits and do not block export. The system correctly classifies these as scaffold warnings rather than errors.

**Student vs. Technical Evidence.** Students see the readiness decision, repair/build/download action, file list, and selected preview. Manifest hashes, bundle hashes, and detailed proof-tier metadata remain secondary technical evidence.

**Common Mistakes.**

- Attempting to export before mapping all pins. The system blocks export and displays the missing mappings.
- Modifying the circuit after export without re-exporting. The previously downloaded files no longer match the current circuit.

---

### 7.6 Import Surface

**Mode ID:** `import`

**Purpose.** The Import surface allows users to restore RedByte export ZIPs, inspect Vivado ZIPs, or bring external HDL/XDC source into the current workspace without replacing active work before review and explicit confirmation.

**When to Use.** When starting from existing VHDL code, when importing constraint files from another project, when restoring a previously exported RedByte project, or when re-importing a Vivado-exported ZIP.

**Major UI Regions.**

- *Horizontal stepper:* Upload -> Review -> Apply. It is a recovery sequence, not a second workflow rail.
- *Upload:* One primary ZIP chooser, with **Paste HDL**, **Paste XDC** (after HDL is parsed), and sample choices inside the same Upload step.
- *Review:* Detected identity, design summary, ports/mappings, warnings, fidelity limits, and replacement consequences.
- *Apply:* Explicit confirmation; Cancel preserves current work and replacement occurs only after confirmation.

**Primary Controls.**

- **Choose an Upload source:** Choose a ZIP, switch to **Paste HDL**, or add **Paste XDC** after HDL is parsed. These are source choices inside Upload, not separate workflow tabs or stages.
- **First-look quick demos:** The first-look shell exposes one-click sample demos for both structural import and blocked behavioral examples, so students can immediately see what reconstructs versus what is intentionally blocked.
- **Review parsed ports:** Inspect the detected ports and their properties.
- **Apply import:** Commit the imported content to the current project.

**Import Sources and Fidelity.**

- **Highest fidelity:** RedByte export ZIP with `project.rbproj.json`. RedByte restores the embedded manifest as the source of truth; loose sibling HDL/XDC cannot override it.
- **Reconstruction:** Vivado ZIP or HDL without a RedByte manifest. RedByte reconstructs supported gate-level structure, including its supported generated concurrent-assignment subset, and reports metadata/layout/testbench limits.
- **Partial / blocked:** Behavioral or unsupported HDL may recover ports only or stay blocked. The current project is not replaced on failure.

Scalar and vector-bit ports retain exact logical identity through parse, Review, Apply, Board & Constraints, and re-export. For example, `SW[1]` and `LED[1]` must not collapse into different scalar or ghost ports.

| Source | Expected Fidelity | Notes |
|--------|-------------------|-------|
| RedByte project archive (`.rbproj.json` inside ZIP) | Full | All state restored: circuit, layout, vectors, probes, mappings. |
| Structural VHDL with component instantiation | Reconstructed | Circuit topology correct. Node positions auto-assigned. Test vectors must be re-authored. |
| Arbitrary behavioral/process VHDL or unsupported concurrent constructs | Partial / blocked | Ports may be recovered, but unsupported internal behavior is not presented as an editable schematic. |
| Supported RedByte-exported `top.vhd` | Reconstructed | The supported concurrent-assignment subset rebuilds the graph. Use the manifest from the same ZIP for lossless layout, authored Verify documents, mapping, and metadata. |
| XDC constraint file | N/A (constraints only) | Pin assignments imported. Requires existing circuit for mapping. |

**Submission Detection.** When importing a ZIP file that contains a RedByte submission, the system displays a callout identifying it as a submission package and reports the integrity verification status.

**Parse Error Handling.** Import errors are displayed in plain language (e.g., "Entity not found — check port names") rather than internal error codes. The Error Message Matrix maps all internal codes to student-appropriate messages.

**Common Mistakes.**

- Treating reconstructed RedByte-generated `top.vhd` as a lossless project restore. The supported graph can reconstruct, but layout, authored Verify documents, mapping, and metadata require the manifest from the same ZIP.
- Importing arbitrary behavioral/process VHDL and expecting the full circuit to appear. Unsupported code may yield port-level information or remain blocked.
- When behavioral constructs trigger an import blocker, use the callout action `Start fresh in Design` to recover directly in the schematic editor before re-verifying and exporting.

---

## 8. Circuit Design Workflow

### 8.1 Planning a Circuit

Before placing components, consider the following:

1. Identify all input signals (switches, buttons, clock).
2. Identify all output signals (LEDs, display segments).
3. Determine whether the circuit is combinational or sequential.
4. For sequential circuits, identify which flip-flop type is appropriate (D, T, or JK) and whether a clock and/or reset signal is needed.

### 8.2 Placing Components

Open the Design surface. The component palette on the left lists all available primitives organized by category. To place a component:

1. Locate the desired component in the palette. Use the search field to filter by name.
2. Drag the component from the palette onto the canvas.
3. Release to place. The component appears with its port indicators visible.

Repeat for all required components.

### 8.3 Wiring Components

To connect two ports:

1. Click on an output port (appears on the right side of a gate or the output of a Switch).
2. Drag to the target input port (appears on the left side of a gate or the input of a Lamp).
3. Release on the target port.

Result: A wire appears connecting the two ports. The signal now flows from the source to the destination.

The system validates connections in real time:

- Output-to-input connections are accepted.
- Output-to-output, input-to-input, and input-to-output connections are rejected.
- Self-loops (connecting a node to itself) are rejected.

### 8.4 Working with Sequential Elements

For the supported stable-preview sequential path:

1. Place **Register1** on the canvas.
2. Connect the data input (D port) to the source signal.
3. For an FPGA design, connect the clock input (CLK port) to a top-level clock input created from the Basys3 `CLK100MHZ` board resource. For simulation-only work, RedByte can inject an internal simulation clock automatically; the current Design palette does not expose a generic Clock block.
4. Optionally connect the enable (EN) and reset (RST) ports.
5. Connect the Q output to downstream logic or output indicators.

The D flip-flop captures the value at its D input on the rising edge of the clock signal (0→1 transition). Between clock edges, the output Q holds its value. The complementary output Q̄ is also available.

For T flip-flops, the T input controls toggling: T=1 toggles Q on each clock edge; T=0 holds Q.

For JK flip-flops: J=1,K=0 sets Q to 1; J=0,K=1 resets Q to 0; J=1,K=1 toggles Q; J=0,K=0 holds Q.

**Sequential Support Boundary.** The stable preview supports Register1 with one clock, rising-edge capture, active-high asynchronous reset, and supported enable semantics. RegisterBus, StateBank, falling-edge capture, multi-clock designs, active-low reset, and unsupported register modes are explicitly blocked by Simulate and Build & Export.

Register1 captures D on the rising clock transition and holds Q between rising
edges. An authored high-to-low transition is valid stimulus but must hold
rising-edge state.

- Falling-edge clock triggers
- Multiple clock domains (more than one clock source)
- Active-low resets (signal names like `reset_n` or `rst_n`, or reset through a NOT gate)

All reset ports (RST, CLR) are asynchronous and active-high: asserting RST=1 immediately forces Q=0 regardless of the clock state. Synchronous reset is not available.

The DLatch is level-sensitive, not edge-triggered: it is transparent when EN=1 and holds when EN=0. It does not use a clock.

For the full boundary specification, see `docs/contracts/Sequential_Support_Boundary.md`.

### 8.5 Saving Work

Projects are auto-saved to browser local storage. The save state indicator in the top bar confirms that the project is saved. Explicit save actions are also available. The browser-local saved-project snapshot combines the portable `RBProject` JSON with a testbench sidecar containing named `scenarios` and the active document. Explicit save, autosave, before-unload recovery, saved-project restore, and previous-session restore use that snapshot, and the top-bar save state includes testbench changes. The sidecar is local IDE workspace state, not a new portable `RBProject` field. For portable storage, export the project as a RedByte project archive from the Project surface.

---

## 9. Simulation and Verification Workflow

### 9.1 Building The Testbench

The Simulate surface uses a tick-based scenario. Each row is one authored step. Inputs are edited in Scenario; optional expected-output assertions are edited in Checks.

Navigate to Simulate and choose or create a named testbench document. Scenario cards summarize the document type, authored events, optional checks, timing cycles, and signal preview before selection. The testbench grid then displays one row per authored tick. For each row:

1. Set the input values (0 or 1) for each input signal.
2. Run the scenario and inspect waveform or circuit replay.
3. If the lab needs validation, open Checks and set expected output values. Leave a cell blank to skip asserting that signal on that row.
4. For sequential circuits, author data inputs per tick, then review the document-owned execution policy: automatic/manual/custom mode, run cycles, active edge, reset behavior, source type, execution model, resolved clock identity, and starting level. If Simulate detects the Basys3 `CLK100MHZ` / `W5` board clock, RedByte can auto-run it. If the design intentionally clocks from a switch or button, choose manual pulses or a custom pattern and author the required clock/control activity in the highlighted lane. In manual/custom mode, only low-to-high transitions advance rising-edge state; flat or falling steps hold it.

Starter examples include pre-defined testbench rows. For custom circuits, the user authors rows directly in the grid or uses the advanced starter and sweep tools.

### 9.2 Running Simulation

1. Navigate to Simulate.
2. Choose the named scenario and author stimulus.
3. Click **Run simulation**.
4. The engine runs the current scenario against the circuit and records deterministic ticks.
5. Results appear in Replay. Each row shows authored inputs and observed outputs; configured assertions, if any, receive a separate pass/fail result.

The active named document determines both the authored rows and the sequential execution policy used by the run. Switching documents must not leak policy from another testbench. Runtime summary, waveform, expected-check sampling, PASS/FAIL, and counts must all describe the same execution sequence.

Result: **Simulation complete** whenever the scenario runs successfully. With no assertions, the check status is **No checks configured** and the behavioral tier is Simulated. Current passing assertions raise the tier to Validated; missing, stale, and failed assertion evidence cannot support Export `verificationTrust: trusted`.

### 9.3 Interpreting Results

**PASS.** All saved checks produced the expected outputs. The circuit behaves correctly for the tested cases.

**FAIL.** One or more saved checks produced incorrect outputs. Simulate highlights failing rows and identifies which output signals did not match. The hint system evaluates 14 diagnostic conditions and displays matching fact-grounded suggestions for diagnosing the failure.

### 9.4 Navigating from Failure to Design

When an assertion fails, first decide whether the authored expectation or the circuit is wrong. Choose **Edit expected** for an incorrect saved check. Choose **Inspect Design** for a suspected circuit error; RedByte carries the failed signal, tick, expected/observed bits, and available driver context into Design. Structural failures that prevent simulation expose **Open Design** to repair the missing connection. Return to Simulate and rerun after either repair.

### 9.5 Verification Determinism

Verification results are deterministic. Running the same circuit with the same authored testbench produces the same pass/fail results every time, on every machine. Simulate displays a deterministic run hash to confirm reproducibility.

---

## 10. Hardware Mapping and Physical Board Preparation

### 10.1 Understanding Hardware Mapping

Hardware mapping is the process of assigning each circuit port to a physical pin on the Basys 3 FPGA board. This determines which physical switch controls which circuit input, and which LED or display segment shows which circuit output.

The mapping is stored as part of the project and used by the export pipeline to generate the XDC constraint file.
Renaming a top-level input or output does not create a second mapping identity. Project, Board & Constraints, and Build & Export all continue to reflect the same live port record after the rename.

### 10.2 Mapping Procedure

1. Navigate to **Board & Constraints**.
2. In the assignment table, choose **Assign**, **Edit mapping**, or **Resolve** for one signal.
3. In the stable selected-signal editor, choose a compatible **Basys3 resource**. Inputs show switches, buttons, and clock resources; outputs show LEDs and display segments. Occupied resources are disabled.
4. Review the resource, package pin, and generated `top.xdc` consequence, then choose **Save assignment**.
5. Repeat until all required rows are assigned and no conflicts remain.
6. Confirm the semantic preview agrees on logical signal identity, direction, artifact port, board resource, package pin, I/O standard, and exact XDC line.

Result: The mapping status changes to "Mapping complete."

> **Note:** For sequential circuits, the clock port must be assigned to CLK100MHZ (pin W5). This is the on-board 100 MHz oscillator.
> Human-friendly labels such as `ENTER CLK` or `Main Reset` do not change that requirement; RedByte still treats those renamed top-level ports as the same clock/reset mapping authority.

### 10.3 Board Reference and Assignment Authority

The smaller Basys3 board graphic is a physical reference. It reflects mapped and selected resources, but clicking it does not assign a pin. The selected-signal **Basys3 resource** selector plus **Save assignment** are the sole normal-use assignment controls.

### 10.4 Clock Handling for Sequential Exports

When the export pipeline detects switch or button inputs in a sequential circuit, it automatically emits `CLOCK_BUFFER_TYPE NONE` constraints for those ports in the XDC file. This prevents Vivado from inserting illegal BUFG clock-buffer paths on non-clock-capable I/O pins — a common synthesis failure.

### 10.5 Port Naming

Top-level entity ports in the generated VHDL follow these naming rules:

- Port names use lowercase letters and underscores only.
- Hyphens, spaces, and special characters are not permitted.
- The default entity name `top` avoids VHDL reserved words. Port names derived from labels are sanitized but not validated against the full VHDL reserved-word list.
- Label-derived port names are sanitized: repeated underscores are collapsed, leading/trailing underscores are trimmed, and names that do not begin with a letter receive a safe prefix.
- If sanitization produces an empty string, the system falls back to a canonical identifier based on the node ID and port name.

---

## 11. Vivado Export and External Tool Workflow

### 11.1 Overview

RedByte generates a complete file set for AMD Vivado. Export first answers what the student should submit and whether the available download is trusted/current or a draft. The student then downloads a ZIP file, opens or creates the Vivado project from the exported artifacts, and runs the standard synthesis/implementation/bitstream flow to program the Basys 3 board. The Vivado flow and hardware programming boundary follows AMD Vivado project-mode Tcl and Hardware Manager guidance; RedByte documents that boundary rather than pretending the browser generated a bitstream.

### 11.2 Generated Files

| File | Type | Purpose |
|------|------|---------|
| `top.vhd` | Design Source | Synthesizable VHDL top-level entity matching the student's circuit. |
| `top.xdc` | Constraints | Pin assignments for all mapped ports with LVCMOS33 I/O standard. |
| `testbench.vhd` | Simulation Source | VHDL testbench generated from truth table vectors. |
| `vivado_import.tcl` | Automation | Tcl script for automated Vivado project creation. |
| `program_and_test.tcl` | Automation | Tcl script for board programming and test. |
| `README.txt` | Documentation | Quick-start instructions for the Vivado import workflow. |
| `BRINGUP.md` | Documentation | Detailed board bring-up guide. |
| `EXPECTED_IO.json` | Metadata | Machine-readable I/O expectations for automated verification. |
| `project.rbproj.json` | Project | RedByte project snapshot for round-trip import. |

The `top.vhd` entity is always named `top`. The `testbench.vhd` entity is always named `tb_top`.

### 11.3 Step-by-Step: Importing into Vivado

Prerequisites: Vivado 2024.2 or later installed for the current lab proof path. Basys 3 board available for programming/observation proof.

1. **Download Package** from Export for a trusted current handoff, or deliberately choose **Download draft** when an untrusted but structurally buildable package is appropriate.
2. **Extract the ZIP** to a working directory.
3. **Open Vivado** and click "Create Project."
4. **Set project type** to "RTL Project." Click Next.
5. **Add design source:**
   a. Click "Add Files."
   b. Select `top.vhd` from the extracted directory.
   c. Ensure it is classified as "Design Sources."
6. **Add constraints:**
   a. Click "Add Files."
   b. Select `top.xdc`.
   c. Ensure it is classified as "Constraints."
7. **Select the target part:**
   a. In the "Default Part" screen, search for `xc7a35t-1cpg236-1`.
   b. Alternatively, select "Boards" and choose "Basys3."
8. **Click Finish** to create the project.
9. **Run Synthesis:** Flow Navigator → Synthesis → Run Synthesis.
10. **Run Implementation:** Flow Navigator → Implementation → Run Implementation.
11. **Generate Bitstream:** Flow Navigator → Program and Debug → Generate Bitstream.
12. **Program the board:**
    a. Connect the Basys 3 via USB.
    b. Open Hardware Manager.
    c. Click "Auto Connect" to detect the board.
    d. Click "Program Device" and select the generated `.bit` file.

Result: The FPGA is programmed. Toggle the physical switches and observe the LEDs to verify the design matches the simulation.

### 11.4 Using the Testbench in Vivado

The testbench file is for simulation only — it is not synthesized. To run it:

1. In Vivado, add `testbench.vhd` as a "Simulation Source."
2. Set `tb_top` as the simulation top module.
3. Flow Navigator → Simulation → Run Behavioral Simulation.
4. Observe waveforms in the Wave window.

The testbench exercises the same materialized execution-vector sequence used by runtime Verify and bring-up expectations, together with the resolved clock/schedule projection:

- **Auto board clock:** includes the dedicated free-running `clock_gen` and `CLK_HALF_PERIOD`, then waits for `rising_edge(...)` before each materialized row's assertion. Cycle 0 is a real materialized row; selected `runCycles` and automatic reset assertion/deassertion are reflected in the vector sequence and bytes.
- **Manual/custom:** omits the free-running clock generator and rising-edge-wait scaffold, assigns the resolved clock from each materialized authored vector, and samples after the deterministic settle interval.

Changing Auto `runCycles`, automatic reset behavior, resolved clock/schedule data, starting level, or authored stimulus may change `testbench.vhd` and package bytes, so Export becomes stale and any previous receipt stops describing the current package. The automatic reset sequence is materialized, not injected as a hidden runtime prelude. This generated structure is Browser-E0/software-artifact authority only; it does not claim that Vivado has executed the testbench.

### 11.5 Common Vivado Errors

| Vivado Error | Likely Cause | Resolution |
|--------------|-------------|------------|
| "Port X not found in entity" | Port name mismatch between XDC and top.vhd | Return to Board & Constraints, re-map, and re-export. |
| "Multiple drivers on net" | Combinational loop in circuit | Fix the loop in the Design surface, re-verify, and re-export. |
| "No valid object(s) found for PACKAGE_PIN" | Incorrect pin number in XDC | Check Board & Constraints assignments against the Basys 3 pin reference. |
| "Timing not met" | Excessive combinational logic depth | Simplify the circuit or add pipeline registers. |

### 11.6 Official References Used for Vivado Truth

RedByte's Vivado and Basys 3 language should stay aligned with official sources:

- AMD UG903, Vivado Design Suite User Guide: Using Constraints, for XDC and timing constraints including primary clock constraints: https://docs.amd.com/r/en-US/ug903-vivado-using-constraints/Timing-Constraints
- AMD UG892/UG895 family guidance for Vivado project-mode Tcl commands: https://docs.amd.com/r/2023.2-English/ug892-vivado-design-flows-overview/Using-Project-Mode-Tcl-Commands
- AMD UG908, Vivado Design Suite User Guide: Programming and Debugging, for hardware device programming flow: https://docs.amd.com/r/en-US/ug908-vivado-programming-debugging/Programming-the-Hardware-Device
- Digilent Basys 3 master XDC for board labels, package pins, and the `CLK100MHZ` / `W5` board constraint reference: https://github.com/Digilent/digilent-xdc/blob/master/Basys-3-Master.xdc

---

## 12. Import and Reuse Workflows

### 12.1 Importing a RedByte Project Archive

To restore a previously exported project with full fidelity:

1. From Project, choose **Import / Recover**.
2. In the Upload step, choose the ZIP file.
3. Upload the RedByte export ZIP or submission archive.
4. The system detects the `project.rbproj.json` manifest, verifies its embedded generated HDL/XDC projection against the same package, and restores circuit state, layout, vectors, probes, and mappings from that manifest. Loose sibling HDL/XDC cannot override the manifest authority.
5. Review the detected project, then use the explicit Apply confirmation to replace the current project.

Result: Full fidelity import. All circuit elements, positions, test vectors, and pin mappings are restored exactly as exported.

### 12.2 Importing Structural VHDL

To reconstruct a circuit from VHDL that uses component instantiation:

1. From Project, choose **Import / Recover**.
2. In the Upload step, choose **Paste HDL** as the source.
3. Paste or type the VHDL source, then choose **Parse HDL**.
4. The parser detects component instantiation patterns (e.g., `U1: AND2 port map (...)`) and maps them through a component library that recognizes 37 HDL name variants (e.g., `and2`, `AND`, `and_gate`) resolving to 9 distinct RedByte node types.
5. Review the parsed ports table and reconstructed schematic preview.
6. Choose **Review replacement**, inspect the Apply summary, then choose **Confirm replacement**. Cancel preserves the current project.

Result: Reconstructed fidelity. Circuit topology is correct, but node positions are auto-assigned and test vectors must be re-authored.

Supported RedByte-generated concurrent-assignment `top.vhd` follows this same reconstructed-fidelity path: the supported circuit graph is rebuilt, but the manifest is still required for lossless layout, authored Verify documents, mapping, and metadata. Arbitrary behavioral/process HDL may remain ports-only or blocked.

### 12.3 Importing Constraint Files

To import pin assignments from an XDC file:

1. From Project, choose **Import / Recover**.
2. In the Upload step, choose **Paste HDL**, parse the structural source, then choose **Paste XDC**.
3. Paste the constraint file content and choose **Parse XDC**.
4. The parser extracts pin assignments and maps them to the current circuit's ports.
5. Review and apply.

Result: Pin assignments imported. Requires an existing circuit with matching port names.

---

## 13. Submission, Review, and Instructor Workflows

### 13.1 Student Submission

Students use Build & Export for the normal downloadable project handoff. The generated project ZIP includes the RedByte project snapshot and the current browser-E0 artifact set; any separate LMS or instructor acceptance rule remains course policy.

1. Complete the circuit design and verification.
2. Navigate to Build & Export, or use a state-owned **Open Build & Export** action.
3. Confirm whether the package is trusted/current or draft. Choose **Download Package** for the trusted current handoff; choose **Download draft** only when the course accepts an explicitly untrusted package.
4. Read **What should I submit?** and verify that the available action matches the course requirement.
5. The Build & Export file browser shows the nine generated project files before download; **Open technical evidence** exposes secondary diagnostics and provenance.
6. Check the package receipt for the selected download kind, trust state, source fingerprint, project/Verify hashes, mapping currentness, and SHA-256.
7. Upload the downloaded project ZIP according to the institutional LMS or course instructions.

The submission package is deterministic: the same project state always produces the same bytes. This enables tamper detection.

### 13.2 Instructor Review with Submission Inspector

Instructors use the Submission Inspector context (accessed through the IDE's Project surface) to review student submissions:

1. Open the Submission Inspector.
2. Import the student's `.rb-lab.zip` or `.rbproj.zip`.
3. The system verifies integrity by recomputing file hashes and comparing them against the manifest.
4. Review:
   - Gate verdict and grade summary (pass/fail per lab requirement).
   - Student name, submission timestamp.
   - Hash/integrity verification result.
   - Full manifest with file hashes and sizes.
   - Bundle ID and submission ID.
   - Tamper detection details.

The Submission Inspector shows all diagnostic information that the student view intentionally hides, including raw hash values, capsule state, and pipeline details.

### 13.3 Integrity Guarantees

The submission system provides these integrity properties:

- **Deterministic packaging:** Same project state produces identical bytes in the output ZIP.
- **Content-addressed hashing:** Every file in the submission is SHA-256 hashed and recorded in a manifest.
- **Tamper detection:** Any modification to any file in the archive invalidates the manifest checksums.
- **Optional signing:** Instructors can sign submissions using Ed25519 keys. Unsigned submissions are accepted but marked as "Unsigned."

### 13.4 Gate Verdicts

The submission system computes a **gate verdict** summarizing whether the student's work meets the lab requirements. The verdict is presented differently depending on the context:

| Context | Presentation |
|---------|-------------|
| Student view (IdeApp) | "Ready to submit" or "Submission needs attention" |
| Instructor view (Submission Inspector) | Raw gate verdict (PASS/FAIL) with detailed breakdown |

---

## 14. Files, Packages, and Generated Outputs

### 14.1 Project File Format

RedByte projects are stored as JSON objects conforming to the `RBProject` interface. Key fields include:

| Field | Type | Description |
|-------|------|-------------|
| `kind` | `'rb-project'` | Format identifier. |
| `version` | `1` | Schema version. |
| `name` | string | Project display name. |
| `circuit` | Circuit | Node and connection graph. |
| `hdl` | ToolchainProjectInput | Optional VHDL/Verilog sources. |
| `fpga` | RBFpgaConfig | Board configuration (Basys 3, part number, top entity). |
| `ioMapping` | IoMapping | Port-to-pin assignments. |
| `vectors` | TestVector[] | Test vectors for verification. |
| `macros` | MacroDefinition[] | User-defined composite components. |
| `meta` | object | Metadata: app version, student name, project kind, scenario authority. |

Projects are serialized with stable key ordering for deterministic output.

Named testbench documents are stored in the browser-local IDE snapshot sidecar; `vectors` remains the portable compatibility field in `RBProject`. The local sidecar behavior does not by itself prove named-document transfer through archive import or between browsers. The active document's authored rows and policy may still change the shared materialized execution vectors and resolved clock/schedule projection used by generated `testbench.vhd`; browser-local storage does not imply package neutrality.

The Vivado-kit `project.rbproj.json` is a generated package projection. It embeds the exact generated `top.vhd` and `top.xdc` content used by the same package; Import validates that authority before a full restore. Browser-local named-document sidecar state remains outside the portable `RBProject` contract unless explicitly included by a future portable format.

### 14.2 Vivado Kit ZIP Structure

```
vivado-kit.zip
├── top.vhd                Synthesizable VHDL
├── top.xdc                Basys 3 pin constraints
├── testbench.vhd          Simulation testbench
├── vivado_import.tcl      Automated Vivado project creation
├── program_and_test.tcl   Board programming and test script
├── README.txt             Quick-start instructions
├── BRINGUP.md             Board bring-up guide
├── EXPECTED_IO.json       Machine-readable I/O expectations
└── project.rbproj.json    RedByte project snapshot
```

### 14.3 Submission Package Structure

```
submission.rbproj.zip
├── rb-project.json       Complete project state
├── verify-ledger.json    Verification results
├── manifest.json         File hashes and integrity data
└── [additional files]    Gate verdicts, run metadata
```

---

## 15. Troubleshooting and Error Resolution

### 15.1 Build and Development

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `corepack pnpm install --frozen-lockfile` fails | Runtime version mismatch | Use the repo-pinned Node 20.19.0 and pnpm 10.24.0. |
| Dev server does not start | Port 5173 in use | Terminate the process occupying the port or start with `--port 5174`. |
| TypeScript errors in test output | React 19 compatibility issue | Known pre-existing condition. Does not affect runtime behavior. |

### 15.2 Circuit Design

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Wire will not connect | Invalid connection direction | Verify that the source is an output port and the target is an input port. |
| Circuit health shows "Issues found" | Floating outputs or missing I/O | Check for unconnected output ports and ensure all required I/O nodes are present. |
| Flip-flop output does not change | No effective clock activity | For FPGA intent, connect a top-level clock input and map it to `CLK100MHZ` (W5). For simulation-only intent, confirm Simulate reports the automatic internal clock policy or provide the required manual control activity. |

### 15.3 Verification

| Symptom | Cause | Resolution |
|---------|-------|------------|
| All vectors fail | Circuit not wired correctly | Return to Design and trace signal paths from inputs to outputs. |
| Sequential circuit fails unexpectedly | Missing clock activity in the authored testbench | Ensure the active clock/control lane contains the required edge or enable activity before checking outputs. |
| Outputs advance while a manual/custom clock lane stays flat | Invalid execution evidence: rising-edge state advanced without an authored low-to-high transition | Treat the run as non-authoritative, repair the clock stimulus or product regression, rerun simulation, and do not use the prior result to authorize Export. |
| Stale verification indicator | Circuit modified after last verify | Re-run verification to update results. |
| Testbench is still present after a Design edit but validation/waveform disappeared | Design behavior changed, so prior evidence is no longer current | Repair any Design blocker and rerun simulation; authored cases were retained and previous evidence is archival only. |

### 15.4 Hardware Mapping

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Basys3 resource selector shows no options | Port direction mismatch or all compatible resources are occupied | Verify that input ports map to input-capable resources and outputs map to output-capable resources; resolve any existing duplicate assignment. |
| "Mapping incomplete" status persists | Unmapped ports remain | Check the mapping table for ports without assignments. |

### 15.5 Export

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Export button disabled / status BLOCKED | Missing prerequisites | Complete circuit design, verification, and pin mapping. Check readiness checklist for specific issues. |
| "HDL ports missing in XDC" warning | Scaffold warning for simple circuits | Expected for INPUT/OUTPUT-only circuits using projection export. Does not block export. |
| Port name error in generated VHDL | Invalid characters in port label | Edit the port label in the Design surface to use only lowercase letters and underscores. |

### 15.6 Vivado

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Synthesis fails with "Port not found" | Port name mismatch | Re-export from RedByte and re-import into Vivado. |
| Implementation fails with routing errors | Complex combinational logic | Simplify the circuit or check for combinational loops. |
| Board does not respond after programming | Wrong part selected in Vivado | Ensure the project targets `xc7a35t-1cpg236-1` or the "Basys3" board file. |

---

## 16. Best Practices

### 16.1 Circuit Design

- Begin with INPUT and OUTPUT nodes to define the circuit boundary before adding internal logic.
- Use meaningful labels for nodes. Labels propagate to exported HDL port names and make debugging easier.
- For FPGA sequential circuits, expose a top-level clock input and map it to the Basys3 `CLK100MHZ` resource. Do not look for a generic Clock block in the current Design palette; simulation-only designs can use RedByte's automatic internal clock.
- Keep combinational logic depth reasonable. Deeply nested gate chains increase stabilization time and may cause timing failures in Vivado.

### 16.2 Verification

- Define test vectors before building complex circuits. Having a clear specification of expected behavior guides the design process.
- Test edge cases: all-zero inputs, all-one inputs, and boundary conditions.
- For sequential circuits, author multiple ticks and deliberately place rising edges where state should advance. Include falling and flat steps to confirm rising-edge state holds.
- Re-verify after every design change. The stale indicator reminds users when results are outdated.

### 16.3 Hardware Mapping

- Assign each signal through its table row, the selected-signal Basys3 resource selector, and **Save assignment**; use the board graphic as reference only.
- Map top-level clock ports to the 100 MHz on-board clock (`CLK100MHZ`, pin W5) for sequential FPGA designs.
- Verify that the number of mapped inputs and outputs matches the circuit's I/O count before exporting.

### 16.4 Export and Vivado

- Use the manifest for lossless RedByte restore. Supported RedByte-generated concurrent-assignment `top.vhd` can reconstruct its graph, but it does not carry layout, authored Verify documents, mapping, or the rest of the project metadata.
- Keep the exported ZIP file alongside the Vivado project as a record of the source design.
- If Vivado reports timing errors, check the combinational logic depth in the Design surface.

### 16.5 Submissions

- Fill in the student name field before exporting. This metadata is embedded in the submission package.
- Export the submission only after verification passes. The gate verdict reflects the last verification result.
- Do not manually modify files inside the submission ZIP. Any change invalidates the integrity hashes.

---

## 17. Glossary

**Basys 3.** The Digilent Basys 3 FPGA development board, built around the Xilinx Artix-7 (XC7A35T) FPGA. The target hardware platform for RedByte exports.

**Circuit.** A collection of nodes and connections representing a digital logic design. The circuit is the single source of truth in RedByte; all surfaces render projections of it.

**Clocked / sequential schedule.** The named Verify document's execution policy for sequential circuits, including automatic/manual/custom mode, run cycles, active edge, reset behavior, source type, execution model, resolved clock identity, and starting level. Manual/custom rows drive the authored clock value; only low-to-high transitions advance rising-edge state.

**Combinational circuit.** A circuit whose outputs depend only on current inputs, with no memory or feedback. Contains no flip-flops or latches.

**Connection.** A directional link from one node's output port to another node's input port. Defined by `{ from: { nodeId, portName }, to: { nodeId, portName } }`.

**Determinism.** The property that identical initial states and identical input sequences always produce identical results, across runs and across machines.

**Fidelity level.** A classification of import quality: Full (all state restored), Reconstructed (topology correct, layout and vectors lost), or Partial (ports only).

**Gate verdict.** The submission system's summary judgment of whether a student's work meets lab requirements. Displayed as "Ready to submit" / "Submission needs attention" in the student view.

**Import.** The process of bringing external HDL, constraint files, or project archives into RedByte.

**LVCMOS33.** The I/O voltage standard used by the Basys 3 board (3.3V low-voltage CMOS). All generated XDC constraints specify this standard.

**Node.** Any supported logic, sequential, boundary-I/O, board-resource, reusable, or backward-compatible element in a circuit.

**Port.** A named input or output connection point on a node. Signals flow into input ports and out of output ports.

**Rising edge.** A clock signal transition from 0 to 1. RedByte flip-flops capture data on the rising edge.

**Falling transition.** An authored clock change from 1 to 0. It is valid manual/custom stimulus and holds rising-edge state; it is not falling-edge-triggered capture.

**Sequential circuit.** A circuit whose outputs depend on both current inputs and stored state. Contains flip-flops or other memory elements.

**Stage.** One of the five student workflow destinations in the horizontal navigator: Project, Design, Simulate, Board & Constraints, or Build & Export. Import / Recover is a separate utility backed by an internal application mode, not a sixth stage.

**Test vector.** A row in the verification truth table specifying input values and expected output values for one test case.

**Tick.** One discrete time step of the simulation engine. All nodes are evaluated once per tick in topological order.

**Topological sort.** The algorithm RedByte uses to determine the evaluation order of nodes. Guarantees that a node is evaluated only after all its input dependencies have been evaluated.

**Vivado Kit.** The ZIP file produced by Build & Export, containing `top.vhd`, `top.xdc`, `testbench.vhd`, automation scripts (`vivado_import.tcl`, `program_and_test.tcl`), and documentation files.

**XDC.** Xilinx Design Constraints file format. Specifies physical pin assignments and I/O standards for FPGA synthesis.

---

## 18. Appendices

### Appendix A: Logic Primitive Reference

#### A.1 Basic Logic Gates

| Primitive | Inputs | Output | Behavior |
|-----------|--------|--------|----------|
| AND | a (in1), b (in2) | out | Output is 1 only when both inputs are 1. |
| OR | a (in1), b (in2) | out | Output is 1 when at least one input is 1. |
| NOT | in | out | Output is the complement of the input. |
| NAND | a (in1), b (in2) | out | Output is 0 only when both inputs are 1. |
| NOR | a (in1), b (in2) | out | Output is 1 only when both inputs are 0. |
| XOR | a (in1), b (in2) | out | Output is 1 when inputs differ. |
| XNOR | a (in1), b (in2) | out | Output is 1 when inputs match. |

#### A.2 Three-Input Gates

| Primitive | Inputs | Output | Behavior |
|-----------|--------|--------|----------|
| AND3 | a, b, c | out | Output is 1 only when all three inputs are 1. |
| OR3 | a, b, c | out | Output is 1 when at least one input is 1. |
| NAND3 | a, b, c | out | Output is 0 only when all three inputs are 1. |
| NOR3 | a, b, c | out | Output is 0 when at least one input is 1. |
| XOR3 | a, b, c | out | Output is 1 for odd parity (odd number of 1-inputs). |

#### A.3 Sequential Elements

| Primitive | Inputs | Outputs | Behavior |
|-----------|--------|---------|----------|
| Register1 | D, CLK, optional EN/RST | Q | Supported one-bit register: one clock, rising-edge capture, active-high asynchronous clear, and supported active-high enable semantics. Other configurations block explicitly. |
| RegisterBus | D[i], CLK, optional EN/RST | Q[i] | Design-canvas bus register; Verify and Export are intentionally blocked in this stable preview because runtime/VHDL parity is incomplete. |
| StateBank | D[i], CLK, optional EN/RST | Q[i] | Design-canvas grouped state abstraction; Verify and Export are intentionally blocked in this stable preview because runtime/VHDL parity is incomplete. |
| D Flip-Flop | D, CLK, EN (optional), RST (optional) | Q, Q̄ | Captures D on rising edge of CLK. RST forces Q=0 asynchronously. EN gates the capture. |
| T Flip-Flop | T, CLK, CLR | Q, Q̄ | T=1 toggles Q on rising CLK edge. T=0 holds Q. CLR resets Q=0. |
| JK Flip-Flop | J, K, CLK, CLR | Q, Q̄ | J=1,K=0: set. J=0,K=1: reset. J=K=1: toggle. J=K=0: hold. |

#### A.4 I/O Elements

| Primitive | Ports | Behavior |
|-----------|-------|----------|
| Switch | out | User-toggled input. Value is 0 or 1, controlled interactively. |
| Lamp | in, out | Visual output indicator. Mirrors input value. |
| INPUT | out | External input source for the circuit boundary. |
| OUTPUT | in | Terminal output sink for the circuit boundary. |

#### A.5 Signal Sources and Timing

| Primitive | Ports | Behavior |
|-----------|-------|----------|
| Power Source | out | Constant output of 1. |
| Ground | out | Constant output of 0. |
| Clock | out | Periodic oscillation. Configurable period (default: 10 ticks). |
| Delay | in, out | Passes input to output with a configurable delay (default: 1 tick). |
| Wire | in, out | Pass-through element. Output equals input. |

`Clock` remains a registered runtime behavior for legacy serialized projects and simulation internals, but it is not a current student-authoring palette card. Students choose Basys3 `CLK100MHZ` for FPGA clock intent; pure simulation may use an automatically injected internal clock. Across the runtime registry there are 27 direct primitive registrations plus 4 composite registrations, for 31 registry additions; palette visibility is narrower and governed separately by the component support registry.

---

### Appendix B: Basys 3 Pin Reference

#### B.1 Slide Switches

| Signal | Pin | FPGA Ball |
|--------|-----|-----------|
| SW0 | V17 | V17 |
| SW1 | V16 | V16 |
| SW2 | W16 | W16 |
| SW3 | W17 | W17 |
| SW4–SW15 | (See Basys 3 Reference Manual) | — |

#### B.2 LEDs

| Signal | Pin | FPGA Ball |
|--------|-----|-----------|
| LD0 | U16 | U16 |
| LD1 | E19 | E19 |
| LD2 | U19 | U19 |
| LD3 | V19 | V19 |
| LD4–LD15 | (See Basys 3 Reference Manual) | — |

#### B.3 Push Buttons

| Signal | Pin | Location |
|--------|-----|----------|
| BTNC | U18 | Center |
| BTNU | T18 | Up |
| BTNL | W19 | Left |
| BTNR | T17 | Right |
| BTND | U17 | Down |

#### B.4 Seven-Segment Display

| Signal | Function |
|--------|----------|
| CA–CG | Cathode segments A through G |
| AN0–AN3 | Anode digit select (active low) |
| DP | Decimal point |

#### B.5 Clock

| Signal | Pin | Frequency |
|--------|-----|-----------|
| CLK100MHZ | W5 | 100 MHz |

#### B.6 Part Number

| Attribute | Value |
|-----------|-------|
| Device | xc7a35t |
| Package | cpg236 |
| Speed Grade | -1 |
| Full Part String | `xc7a35t-1cpg236-1` |

---

### Appendix C: Generated File Specifications

#### C.1 top.vhd

- **Entity name:** `top`
- **Architecture:** Structural VHDL or concurrent signal assignments depending on circuit complexity.
- **Ports:** Match the student's circuit ports as named in Board & Constraints.
- **Synthesizable:** Yes. No behavioral `process` blocks that prevent synthesis.
- **I/O Standard:** All ports expect LVCMOS33 (defined in XDC, not in VHDL).

#### C.2 top.xdc (Pin Constraints)

- **Format:** One `set_property PACKAGE_PIN` line per mapped port.
- **I/O Standard:** `LVCMOS33` for all pins.
- **Clock buffering:** Switch and button input ports include `CLOCK_BUFFER_TYPE NONE` to prevent illegal BUFG insertion.
- **Comments:** XDC policy comments explaining constraint rationale.

#### C.3 testbench.vhd

- **Entity name:** `tb_top` (pattern: `tb_` + top module name)
- **Simulation only:** Not synthesized.
- **Structure:** Drives the shared materialized execution vectors used by runtime and bring-up expectations. Auto board-clock mode uses a free-running generator and asserts every materialized row post-rising-edge, including cycle 0; `runCycles` and automatic reset affect the materialized sequence. Manual/custom mode assigns the authored clock value per row, settles deterministically, and omits the Auto scaffold.
- **Clock period:** 10 ns (matching 100 MHz) for the auto board-clock generator. Manual/custom mode uses the deterministic settle interval instead of a free-running clock period.
- **Completion:** Testbench halts after exercising all vectors.

---

### Appendix D: Keyboard Shortcuts

**Global**

| Action | Shortcut |
|--------|----------|
| Switch to Design | 1 |
| Switch to Simulate | 2 |
| Switch to Build & Export | 3 |
| Switch to Board & Constraints | 4 |
| Save project | Ctrl+S |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |
| Show keyboard shortcuts | ? |

**Design Surface**

| Action | Shortcut |
|--------|----------|
| Select tool | S |
| Wire tool | W |
| Toggle grid snap | G |
| Rotate selected gate | R |
| Delete selected | Delete / Backspace |
| Select all | Ctrl+A |
| Copy selection | Ctrl+C |
| Paste | Ctrl+V |
| Duplicate selection | Ctrl+D |
| Escape / deselect | Esc |
| Pan canvas | Space+drag |

**Simulate Surface**

| Action | Shortcut |
|--------|----------|
| Next failure | J / Down arrow |
| Previous failure | K / Up arrow |
| Fit waveform to view | F |
| Step through ticks | Left / Right arrow |

---

### Appendix E: Import Fidelity Reference

| Import Source | Fidelity | Circuit Restored | Layout Restored | Vectors Restored | Pin Mapping Restored |
|--------------|----------|------------------|-----------------|------------------|---------------------|
| `.rbproj.json` from RedByte ZIP | Full | Yes | Yes | Yes | Yes |
| Structural VHDL (component instantiation) | Reconstructed | Yes (topology) | No (auto-layout) | No | No |
| Arbitrary behavioral/process VHDL or unsupported concurrent constructs | Partial / blocked | Ports only or blocked | No | No | No |
| Supported RedByte-exported `top.vhd` | Reconstructed | Yes (supported graph) | No (auto-layout) | No | No |
| XDC file | N/A | N/A | N/A | N/A | Yes (if ports match) |

---

*End of RedByte Product Manual*

*Attribution: Connor Angiel.*
*RedByte Proprietary License (RPL-1.0)*
