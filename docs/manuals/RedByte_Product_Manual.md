# RedByte Product Manual

**Version 1.0** · March 2026
**Platform Version:** RedByte IDE v1
**Attribution:** Connor Angiel
**License:** RedByte Proprietary License (RPL-1.0)

---

## Document Control

| Field | Value |
|-------|-------|
| Document ID | RB-MAN-001 |
| Version | 1.0 |
| Date | 2026-03-31 |
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
   - 7.3 Verify Surface
   - 7.4 Hardware Surface
   - 7.5 Export Surface
   - 7.6 Import Surface
8. [Circuit Design Workflow](#8-circuit-design-workflow)
9. [Verification Workflow](#9-verification-workflow)
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

- **Surface names** are capitalized (Project, Design, Verify, Hardware, Export, Import) and refer to the six primary screens of the RedByte IDE.
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

RedByte eliminates this fragmentation. The canonical workflow — design, verify, map pins, export — happens within a single browser window. The transition from simulation to physical hardware is a continuous, guided process rather than a disjointed series of manual file operations.

### 2.3 Core Capabilities

RedByte provides these capabilities in a single integrated environment:

**Circuit Design.** A visual drag-and-drop canvas for constructing digital circuits from logic primitives. Users place gates, input switches, output lamps, flip-flops, and timing elements, then connect them with wires. The system validates connections in real time and reports design issues.

**Deterministic Simulation.** A tick-based simulation engine that evaluates circuits using topological sorting to guarantee deterministic signal propagation. The same circuit with the same inputs produces the same outputs on every run, on every machine.

**Truth Table Verification.** An automated verification engine that runs the student's circuit against expected truth table vectors and reports pass/fail results per vector row. Verification supports both combinational circuits (single-tick evaluation) and sequential circuits (multi-tick clocked evaluation).

**Hardware Pin Mapping.** A dedicated surface for assigning circuit input and output ports to physical Basys 3 board pins — switches, LEDs, push buttons, seven-segment display segments, and the on-board clock.

**Vivado Export.** A complete export pipeline that generates synthesizable VHDL (`top.vhd`), pin constraints (`top.xdc`), and a VHDL testbench (`testbench.vhd`), along with automation scripts and documentation files, packaged in a ZIP file ready for import into AMD Vivado.

**Project Import.** Support for importing VHDL source files, Xilinx constraint files (XDC), and RedByte project archives, with explicit fidelity reporting that tells the user exactly what was and was not preserved during import.

**Submission Packaging.** A deterministic submission export system that bundles the student's project, verification results, and integrity hashes into a tamper-evident archive for instructor review.

### 2.4 Design Philosophy

RedByte operates under several core principles that shape its behavior:

**Determinism by design.** Every simulation tick is reproducible. The same initial state and the same input sequence always produce the same output. There is no hidden randomness, no race condition, and no undefined behavior. This is enforced architecturally through topological-sort evaluation, integer-only signal values, and explicit state management.

**One truth, many views.** The circuit exists as a single source of truth. Every surface — the design canvas, the verification table, the hardware mapping panel, the generated HDL — is a projection of the same underlying circuit data. When the circuit changes in one view, all views reflect that change.

**Truth over simplification.** RedByte simulates real digital logic behavior. Gates have propagation delay (one tick minimum). Combinational circuits stabilize over multiple ticks. Sequential circuits still depend on real clock edges, but Basys3 board-clocked designs can have those edges auto-generated by Verify and the exported testbench instead of forcing students to hand-author oscillator pulses. Students learn correct mental models rather than oversimplifications.

**Local-first operation.** All computation happens in the browser. No server is required, no account is needed, and no data leaves the user's machine unless explicitly exported. RedByte works offline after the initial page load.

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
| **IdeApp** | Full six-surface IDE for lab assignments | Students |
| **SubmissionInspectorApp** | Grading tool with full diagnostic detail | Instructors, TAs |

The IdeApp is the primary context documented in this manual. The SubmissionInspectorApp is an architecturally defined context whose inspector functionality is currently delivered through the IDE's Project surface; it exposes diagnostic information that the student view intentionally hides.

> **Note:** LogicPlaygroundApp and LabWorkspaceApp are defined in the architecture as additional application contexts but are not separately documented here. Their capabilities are delivered through the IdeApp.

---

## 4. Core Concepts and Operating Model

### 4.1 The Canonical Workflow

RedByte organizes work into a product spine that carries a project from browser authoring to real FPGA evidence:

```
Project -> Design -> Verify -> Map Pins / Hardware -> Export -> Vivado -> Program Board -> Observe
```

The IDE surfaces cover the RedByte-owned portion of that spine: Project, Design, Verify, Hardware / Map Pins, Export, and Import. Vivado build, board programming, and physical observation happen outside RedByte but are part of the product proof model.

The workflow proceeds as follows:

1. **Project.** The user creates or opens a project, reviews its metadata, and selects a starter example if desired.
2. **Design.** The user constructs a digital circuit on the visual canvas by placing logic primitives and wiring them together.
3. **Verify.** The user runs the circuit against test vectors. The verification engine reports pass or fail for each vector row and highlights failures.
4. **Map Pins / Hardware.** The user maps each circuit input and output port to a physical Basys 3 board resource and package pin (switches, LEDs, buttons, clock).
5. **Export.** The system generates synthesizable VHDL, pin constraints, a testbench, Tcl, README/bring-up files, and the project manifest. The user downloads a ZIP file for use in Vivado.
6. **Vivado.** The user opens/builds the exported project in Vivado; synthesis, implementation, and bitstream generation are Vivado responsibilities.
7. **Program Board.** The user programs a Basys 3 target with the Vivado-generated bitstream when E2 proof is required.
8. **Observe.** The user records board behavior against an explicit procedure when E3 proof is required.

Users may navigate between surfaces freely. The system tracks which stages have been completed and displays readiness indicators.

### 4.1.1 Draft, Trusted, and Proven States

RedByte intentionally separates readiness levels:

| State | What it means |
|-------|---------------|
| **Draft design** | A circuit exists, but it may not have current testbench, mapping, or export proof. |
| **Simulated** | The design has been observed in RedByte simulation; this is useful inspection, not a pass/fail claim. |
| **Testbench configured** | Stimulus and expected output checks exist for the current design intent. |
| **Compare passed** | Current observed outputs match current expected outputs. This is the Verify proof needed for trusted handoff. |
| **Pins mapped** | Required top-level ports are assigned to board resources/package pins. |
| **Draft export** | A structurally valid Vivado package can be generated or downloaded, but proof is missing or stale. |
| **Trusted export** | Current Compare PASS, current mapping, and current export bundle all describe the same project state. |
| **Vivado built** | Vivado synth/implementation/bitstream completed for the exported project. |
| **Board programmed** | A Basys 3 board was programmed with the generated bitstream. |
| **Board observed** | Physical behavior was recorded against an agreed observation procedure. |

### 4.2 Circuits and Nodes

A **circuit** in RedByte consists of **nodes** and **connections**. A node is any logic element: a gate, a flip-flop, an input switch, an output lamp, a clock source, or a delay element. Each node has named **ports** — inputs and outputs through which signals flow.

A **connection** links one node's output port to another node's input port. Connections are directional: signals flow from output ports to input ports. A single output port may fan out to multiple input ports.

The canonical connection format is:

```
{ id, from: { nodeId, portName }, to: { nodeId, portName } }
```

### 4.3 Simulation Model

RedByte's simulation engine operates on discrete **ticks**. Each tick, the engine evaluates every node in the circuit in **topological order** — nodes whose inputs depend only on already-evaluated nodes are evaluated first. This ordering guarantees that signal propagation is deterministic and race-free.

For **combinational circuits** (circuits with no flip-flops or other sequential elements), evaluation typically stabilizes within one or two ticks. The engine supports a stabilization loop that continues ticking until no signals change, up to a configurable maximum.

For **sequential circuits** (circuits containing flip-flops), the engine detects clock edges by comparing the current clock value against the previous tick's value. A rising edge (0 → 1 transition) triggers data capture in flip-flops. All flip-flops sharing the same clock capture simultaneously within a single tick.

### 4.4 Verification Model

Verification compares the circuit's actual outputs against expected outputs defined in an authored testbench. Each authored row specifies a set of input values and the corresponding expected output values for one tick or test step.

RedByte supports two verification schedules:

- **Combinational schedule.** For circuits without sequential elements. The engine applies inputs, ticks once to let signals propagate, and reads outputs.
- **Clocked / sequential schedule.** For circuits containing flip-flops or latch controls. Each authored row is still one sampled tick, but the active clock source is now policy-driven: Basys3 `CLK100MHZ` / `W5` and explicit clock components auto-run by default, while manual clock/control lanes remain available as an override for switch/button-clocked designs.

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

There is one generation path — the HDL preview shown on the Export surface displays the exact bytes that appear in the downloaded ZIP.

### 4.7 Import Fidelity Model

When importing external files, RedByte reports one of three **fidelity levels** describing how completely the import preserved the original content:

| Level | Name | What Is Preserved |
|-------|------|-------------------|
| 1 | **Full** | All circuit state, node positions, I/O mapping, test vectors, and metadata. Achieved when importing a RedByte project archive (`.rbproj.json`). |
| 2 | **Reconstructed** | Circuit topology reconstructed from structural VHDL with component instantiation. Node layout is auto-assigned. Test vectors must be re-authored. |
| 3 | **Partial** | Only I/O port names and directions extracted. Achieved when importing behavioral VHDL or RedByte's own exported `top.vhd` (which uses concurrent signal assignments). |

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

```bash
git clone <repository-url>
cd redbyte-ui
pnpm install
pnpm dev
```

The development server starts on `http://localhost:5173` by default.

### 5.3 First Launch

On first launch, the user sees the **Project** surface with the option to start a new project or open a starter example. Five built-in examples are available:

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
2. Click **Open Design Mode** or select the **Design** tab in the left rail.
3. From the component palette on the left, drag two **Switch** nodes and one **AND** gate onto the canvas.
4. Drag one **Lamp** node onto the canvas.
5. Wire the output of each Switch to one input of the AND gate.
6. Wire the output of the AND gate to the input of the Lamp.
7. Navigate to the **Verify** surface.
8. Build a small testbench or load the starter rows for AND logic.
9. Click **Run Compare checks**. Observe PASS/FAIL results per row.
10. Navigate to the **Hardware** surface.
11. Assign each Switch port to a Basys 3 slide switch (e.g., SW0, SW1).
12. Assign the Lamp port to an LED (e.g., LD0).
13. Navigate to the **Export** surface.
14. Review the readiness checklist. All items should show as complete.
15. Click **Download Vivado Kit**.
16. Extract the downloaded ZIP. It contains `top.vhd`, `top.xdc`, `testbench.vhd`, automation scripts, and documentation files (see Section 11.2 for the complete file list).

Result: A draft or trusted Vivado-ready project, depending on whether Compare and mapping proof are current. See Section 11 for instructions on importing these files into Vivado and programming the board.

---

## 6. Workspace and Interface Overview

### 6.1 Global Shell

The RedByte IDE shell is present on every surface and consists of four persistent regions:

**Top Bar.** Displays the RedByte product mark on the left, the current project name and save state in the center, and contextual action buttons on the right (Run, Export, Help).

**Left Rail.** Contains five mode entries corresponding to the primary surfaces: Project, Design, Verify, Hardware, and Export, plus the Import surface. An active marker indicates the current surface. A simple progress indicator shows which workflow stages have been completed.

**Main Content Area.** Occupies the center of the screen and displays the active surface's primary content. This area changes entirely when switching surfaces.

**Status Bar.** A minimal strip at the bottom displaying the application version and the last verification status.

### 6.2 Navigation Model

Surface switching is explicit through the left rail and surface CTAs. Certain Project actions intentionally carry the user into the next surface when they load a starter or use a direct recovery path. Those transitions must state what loaded and what the next action is so the active workflow remains unambiguous.

### 6.3 Empty States

Every surface provides a clear empty state when no relevant data is present. Empty states include a headline describing the situation, a primary call-to-action button directing the user to the next logical step, and one or more secondary actions. For example, the Design surface's empty state shows "Build your first circuit" with a primary CTA of "Add input/output pins."

### 6.4 Status Indicators

Each surface displays a maximum of three status pills summarizing the current state. The allocation priority is: circuit/project health, verification result, and export readiness. Status values use deterministic language: PASS, FAIL, READY, BLOCKED.

---

## 7. Detailed Surface Reference

### 7.1 Project Surface

**Mode ID:** `project`

**Purpose.** The Project surface provides a project-level overview and acts as the entry point for the workflow. It displays project metadata, readiness status, and provides access to starter examples.

**When to Use.** At the beginning of a session, when creating a new project, when reviewing project readiness before export, or when changing project metadata.

**Major UI Regions.**

- *Main area:* Summary cards showing project identity (name, description), Basys 3 target confirmation, last verification result, and IO mapping completeness.
- *Secondary content:* Starter examples panel with pre-built circuits, file manifest panel, vector summary panel.
- *Right inspector:* Project settings and warnings.

**Primary Controls.**

- Edit project name and description.
- Open a starter example (with overwrite confirmation if unsaved work exists). Loading a starter opens Design immediately after the starter becomes authoritative.
- Review readiness indicators for IO mapping, test vectors, and export status.
- Use the Project mapping table as the same authoritative pin map consumed by Hardware and Export; if a top-level port is renamed in Design, the renamed port remains the current mapping target instead of creating a second hidden/export-only port identity.

**Typical Workflow.** Create or open a project → review metadata → optionally load a starter example → Design opens with the loaded starter name and next action.

**Outputs.** Updated project metadata. Readiness assessment for downstream surfaces.

**Student-Facing Content.** Students see the lab name, their name input field, a submission preview (last verify status, pass/fail counts), and an "Export Submission" button. Manifest hashes and bundle identifiers are available only in a collapsed Advanced panel.

**Common Mistakes.**

- Opening a starter example without saving current work. The system prompts for confirmation before overwriting.
- Proceeding to Export without completing IO mapping. The Project surface displays blocking-issue callouts with direct navigation links.

---

### 7.2 Design Surface

**Mode ID:** `design`

**Purpose.** The Design surface is the primary circuit editor. Users construct digital circuits by placing logic primitives on a visual canvas and connecting them with wires.

**When to Use.** Whenever the circuit needs to be created or modified. This is where all structural changes to the circuit occur.

**Major UI Regions.**

- *Main center:* Circuit canvas with a lightweight tool row (select, wire, delete, zoom controls).
- *Starter handoff:* When Design opens from Project with a starter, a starter-loaded banner identifies the active starter, expected behavior, and next action.
- *Left panel:* Searchable component palette listing all available gates, I/O elements, and timing components.
- *Right inspector:* Properties of the selected element, including port details and configuration options for IO nodes.

**Primary Controls.**

- **Place a component:** Drag from the palette onto the canvas, or use keyboard shortcuts.
- **Wire two ports:** Click an output port, drag to an input port, and release. The system validates the connection before committing it.
- **Select and move:** Click a node to select it; drag to reposition. Multi-select with a selection box.
- **Delete:** Select one or more elements and press Delete, or use the delete tool.
- **Undo/Redo:** Standard keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z). History supports up to 100 levels.

**Available Components.** The component palette contains the following categories:

| Category | Components |
|----------|-----------|
| Basic Gates | AND, OR, NOT, NAND, XOR |
| 3-Input Gates | AND3, OR3, NAND3, NOR3, XOR3 |
| Sequential | D Flip-Flop, T Flip-Flop, JK Flip-Flop |
| I/O | Switch (input toggle), Lamp (output indicator), INPUT, OUTPUT |
| Signal Sources | Power Source (constant 1), Ground (constant 0) |
| Timing | Clock (configurable period), Delay (configurable tick count) |
| Pass-Through | Wire |

See Appendix A for a complete reference of each primitive, including port names and behavior.

**Wiring Rules.**

- Valid connections: output port → input port.
- Invalid connections: input → output, output → output, input → input, self-loops.
- A single output port may connect to multiple input ports (fan-out).
- An input port accepts at most one connection.

**Diagnostic Callouts.** When navigating to Design from a failing verification result, the system displays a diagnostic callout identifying the failing gate and suggesting the user check its inputs. This callout uses student-appropriate language.

**Circuit Health.** The Design surface provides live circuit health feedback through two systems:

1. **Authoring issues** (status bar + node glow): Detects multiple drivers on a single input (blocking error), unconnected inputs (draft), and floating outputs (draft). Affected nodes glow and ports highlight with severity colors. The status bar shows "Blocking circuit issue," "Circuit needs review," "Draft wiring in progress," or "Ready to build."

2. **Compiler diagnostics** (bottom drawer): The IR elaborator runs on every circuit change and detects structural errors including unknown primitives (IR001), multiple driver conflicts (IR002), floating output ports (IR003), missing clock connections on sequential elements (IR004), disconnected required inputs (IR005), and combinational feedback loops (IR006). Each diagnostic shows severity, code, title, hint, and a focus button to navigate to the affected node.

The inspector panel shows per-selection health: primary issue with severity pill, fix hint, and focus button. Issues found during design will also block Verify and Export downstream.

**Common Mistakes.**

- Leaving output ports unconnected. The system flags floating outputs as issues.
- Attempting to wire an output to another output. The system rejects the connection.
- Forgetting to add INPUT/OUTPUT nodes for ports that must map to hardware pins.

---

### 7.3 Verify Surface

**Mode ID:** `verify`

**Purpose.** The Verify surface runs the student's circuit against an authored testbench and presents a clear pass/fail verdict with detailed failure analysis.

**When to Use.** After building or modifying a circuit, before proceeding to hardware mapping or export. Verification confirms that the circuit produces the correct outputs for all test inputs.

**Major UI Regions.**

- *Command deck:* Run controls, Observe-only versus Compare-checks selector, session status, and deterministic run metadata.
- *Build testbench panel:* Unified authoring surface for stimulus inputs, expected output checks, clock/timing guidance, and a compact summary of what the next run will do.
- *Waveform and evidence region:* Observed waveform, mismatch details, and failure analysis after a run.
- *Signal rail / inspector:* Signal selection plus supporting drill-down when the waveform or a failure is in focus.

**Primary Controls.**

- **Run Observe only / Run Compare checks:** Execute the current testbench against the circuit.
- **Jump to failing node:** From a failing row, navigate directly to the Design surface with the relevant gate highlighted and a diagnostic callout.
- **Inspect failure diffs:** View expected versus actual values for each failing signal.
- **Edit testbench:** Click directly in the unified grid to change stimulus inputs or expected outputs.
- **Edit the clock lane:** In sequential manual/custom modes, use the highlighted clock/control lane actions (`Alternating`, `Add pulse`, `Hold low`, `Hold high`) or hand-edit cells directly. Board-clocked designs default to auto mode instead of requiring an authored pulse row.

**Testbench Authoring Model.** Verify rows are authored ticks or steps, not whole clock cycles. For sequential circuits, Basys3 board clocks and explicit clock components may be auto-driven by policy while data inputs stay authored in the grid. Manual/custom clock modes still expose the clock/control lane inside the same grid as the other inputs. Expected output cells are always visible in the lower half of the grid. Leaving an expected-output cell blank means "observe only" for that signal on that tick.

**Clock / timing guidance.** Sequential designs show an inline clock/timing banner above the grid. It names the active clock or latch-control signal, reports whether the source is auto board clock, manual pulses, or a custom pattern, and highlights the authoritative lane only when manual authoring is actually required. If the active clock is the Basys 3 oscillator, RedByte treats `CLK100MHZ` on `W5` as an auto board clock source by default rather than as a manual switch-style input.

**Hint System.** On a FAIL result, the system evaluates 14 diagnostic conditions and displays matching fact-grounded hints to guide the student toward the error. Hints reference specific circuit behaviors — such as unconnected outputs, inverted logic, or missing clock connections — rather than generic advice.

**PASS waveform visibility.** On PASS runs with mapped I/O, the waveform viewport auto-expands mapped stimulus inputs alongside observed outputs by default, so students can read input-to-output cause/effect without expanding hidden signal groups. On FAIL runs, mismatch-focused output lanes remain the default emphasis.

**Sequential Circuit Banner.** When the circuit contains D flip-flops, latches, or other sequential elements, the inline guidance banner explains what timing activity is needed before state can advance.

**Freshness Tracking.** The Verify surface tracks whether the circuit has been modified since the last verification run. If the circuit changes, the previous verification result is marked stale. Renaming or re-describing a project does not stale the verification — only changes that affect circuit truth (topology, node types, scenario authority) trigger staleness.

**Common Mistakes.**

- Running verification without any testbench rows defined. The surface displays an empty state directing the user to add cases.
- Ignoring the stale indicator after modifying the circuit. Always re-verify after design changes.
- Expecting a sequential circuit with no detected clock source to advance anyway. Board-clocked designs auto-run, but switch/button-clocked or latch-controlled designs still need the required timing activity before checking outputs.

---

### 7.4 Hardware Surface

**Mode ID:** `hardware`

**Purpose.** The Hardware surface maps circuit input and output ports to physical pins on the Basys 3 development board. This mapping is required before the export pipeline can generate valid constraint files.

**When to Use.** After the circuit is designed and (ideally) verified. Pin mapping must be complete before exporting the Vivado kit.

**Major UI Regions.**

- *Mode toggle bar:* Tabs for Map Pins, Prepare Board, Program Checklist, and Live Details. The mode tabs appear at the top of the surface, above the hero card.
- *Callout strip:* Displays project status, Compare status, and Export status. Compare and Export status are always visible regardless of the active tab.
- *Hero card:* Contextual next-action guidance based on the current workflow state.
- *Main content:* Port-to-pin mapping table (Map Pins tab) with port name, assigned Basys 3 pin, and physical board label.
- *Provenance strip:* Last Verify evidence details (visible on Prepare Board and Program Checklist tabs).

**Primary Controls.**

- **Assign a pin:** For each circuit port, select a Basys 3 pin from the dropdown. Available pins are filtered by direction (inputs map to switches or buttons; outputs map to LEDs or display segments).
- **Pin preset selector:** Pre-configured mappings for common assignments (e.g., "2 switches, 1 LED" for simple gate circuits).
- **Clear mapping:** Remove all pin assignments to start over.

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

**Mapping Status.** The surface displays one of two states: "Mapping complete" (all ports assigned) or "Pins missing" (one or more ports unassigned). Export is blocked until mapping is complete.

**Live Details.** The Live Details tab shows simulation state. When no simulation has been run, it displays "Not started" rather than "Sim paused," accurately reflecting the system state.

**Common Mistakes.**

- Leaving ports unmapped. The system clearly indicates which ports still need pin assignments.
- Assigning an input port to an LED (output-only pin). The system filters available pins by direction.
- Forgetting to assign the clock pin for sequential circuits. The clock port must be mapped to CLK100MHZ (W5).

---

### 7.5 Export Surface

**Mode ID:** `export`

**Purpose.** The Export surface validates export readiness, previews generated artifacts, and produces the Vivado Kit ZIP file containing synthesizable VHDL, constraint files, and a testbench.

**When to Use.** After the circuit has been designed, verified, and all pins have been mapped in the Hardware surface.

**Major UI Regions.**

- *Top readiness strip:* Displays READY, WARNING, or BLOCKED status with a count of blocking issues.
- *Main center:* Artifact tree with preview panes for `top.vhd`, `top.xdc`, and `testbench.vhd`. Each file is viewable in full and supports copy-to-clipboard.
- *Right inspector:* Pin table, validation details, and warning list.
- *"Open in Vivado" panel:* Collapsible step-by-step instructions for using the exported files in Vivado (shown after download).

**Primary Controls.**

- **Download Vivado Kit:** Primary action button. Downloads the ZIP file containing all generated artifacts. A structurally valid project may download as a draft package; RedByte labels the handoff as trusted only when Compare, mapping, and export evidence are current.
- **Copy to clipboard:** Available for each generated file individually.
- **View generated HDL:** Always-on preview of the exact VHDL that will appear in the ZIP.

**Readiness Checklist.** The surface displays a plain-language checklist:

- Circuit built? (Has the design been created?)
- Simulation passed? (Has verification completed with PASS?)
- Pins mapped? (Are all ports assigned to Basys 3 pins?)

**Export Blocking Conditions.** Export is blocked when:

- Required I/O mapping is incomplete.
- The circuit contains nodes that cannot be synthesized (e.g., analog-only nodes).
- Top-level port constraints are missing or invalid.

Each blocking issue includes a direct navigation link to the surface where the issue can be resolved.

**Scaffold Warnings.** For certain starter examples and projection-only exports, the system may display informational warnings about HDL/XDC port mismatches. These are expected for INPUT/OUTPUT-only circuits and do not block export. The system correctly classifies these as scaffold warnings rather than errors.

**Student vs. Advanced Views.** Students see the readiness checklist, download button, and generated HDL. Manifest hashes, bundle hashes, and file byte counts are available in a collapsed Advanced panel.

**Common Mistakes.**

- Attempting to export before mapping all pins. The system blocks export and displays the missing mappings.
- Modifying the circuit after export without re-exporting. The previously downloaded files no longer match the current circuit.

---

### 7.6 Import Surface

**Mode ID:** `import`

**Purpose.** The Import surface allows users to bring external HDL source files, constraint files, or previously exported RedByte projects into the current workspace.

**When to Use.** When starting from existing VHDL code, when importing constraint files from another project, when restoring a previously exported RedByte project, or when re-importing a Vivado-exported ZIP.

**Major UI Regions.**

- *Left input panel:* Three tabs — "Upload ZIP" (drag-and-drop or file picker for ZIP archives), "Paste HDL" (paste VHDL source), and "Paste XDC" (paste constraint file content).
- *Main center:* Parsed ports table showing detected port names, directions, and widths. Schematic preview panel showing the reconstructed circuit topology.
- *Right inspector:* Diagnostics list (parse errors, warnings, suggestions) and Basys 3 pin suggestions for detected ports.

**Primary Controls.**

- **Paste or upload input:** Enter VHDL text, upload a ZIP file, or paste XDC content.
- **First-look quick demos:** The first-look shell exposes one-click sample demos for both structural import and blocked behavioral examples, so students can immediately see what reconstructs versus what is intentionally blocked.
- **Review parsed ports:** Inspect the detected ports and their properties.
- **Apply import:** Commit the imported content to the current project.

**Import Sources and Fidelity.**

| Source | Expected Fidelity | Notes |
|--------|-------------------|-------|
| RedByte project archive (`.rbproj.json` inside ZIP) | Full | All state restored: circuit, layout, vectors, probes, mappings. |
| Structural VHDL with component instantiation | Reconstructed | Circuit topology correct. Node positions auto-assigned. Test vectors must be re-authored. |
| Behavioral VHDL (process blocks, concurrent assignments) | Partial | Only I/O port names and directions extracted. Internal logic not reconstructable. |
| RedByte-exported `top.vhd` | Partial | Uses concurrent signal assignments, not component instantiation. Use the `.rbproj.json` from the same ZIP for full-fidelity re-import. |
| XDC constraint file | N/A (constraints only) | Pin assignments imported. Requires existing circuit for mapping. |

**Submission Detection.** When importing a ZIP file that contains a RedByte submission, the system displays a callout identifying it as a submission package and reports the integrity verification status.

**Parse Error Handling.** Import errors are displayed in plain language (e.g., "Entity not found — check port names") rather than internal error codes. The Error Message Matrix maps all internal codes to student-appropriate messages.

**Common Mistakes.**

- Attempting to re-import RedByte's own exported `top.vhd` expecting full reconstruction. The exported VHDL uses concurrent signal assignments for Vivado synthesis, which cannot be reconstructed into gate-level topology. Use the `.rbproj.json` file from the same export ZIP for full-fidelity re-import.
- Importing behavioral VHDL and expecting the full circuit to appear. Behavioral code only yields port-level information.
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

When building circuits that include flip-flops:

1. Place the flip-flop (e.g., D Flip-Flop) on the canvas.
2. Connect the data input (D port) to the source signal.
3. Connect the clock input (CLK port) to a Clock node or a Switch designated as the clock source.
4. Optionally connect the enable (EN) and reset (RST) ports.
5. Connect the Q output to downstream logic or output indicators.

The D flip-flop captures the value at its D input on the rising edge of the clock signal (0→1 transition). Between clock edges, the output Q holds its value. The complementary output Q̄ is also available.

For T flip-flops, the T input controls toggling: T=1 toggles Q on each clock edge; T=0 holds Q.

For JK flip-flops: J=1,K=0 sets Q to 1; J=0,K=1 resets Q to 0; J=1,K=1 toggles Q; J=0,K=0 holds Q.

**Sequential Support Boundary.** RedByte v1 supports a single-clock, rising-edge, active-high-reset sequential model. The following patterns are explicitly not supported and will be blocked by the Verify and Export surfaces:

- Falling-edge clock triggers
- Multiple clock domains (more than one clock source)
- Active-low resets (signal names like `reset_n` or `rst_n`, or reset through a NOT gate)

All reset ports (RST, CLR) are asynchronous and active-high: asserting RST=1 immediately forces Q=0 regardless of the clock state. Synchronous reset is not available.

The DLatch is level-sensitive, not edge-triggered: it is transparent when EN=1 and holds when EN=0. It does not use a clock.

For the full boundary specification, see `docs/contracts/Sequential_Support_Boundary.md`.

### 8.5 Saving Work

Projects are auto-saved to browser local storage. The save state indicator in the top bar confirms that the project is saved. Explicit save actions are also available. For portable storage, export the project as a RedByte project archive from the Project surface.

---

## 9. Verification Workflow

### 9.1 Building The Testbench

The Verify surface uses a tick-based testbench. Each row is one authored step. Inputs are edited in the top half of the grid and expected output checks are edited in the lower half of the same grid.

Navigate to the Verify surface. The Build testbench grid displays one row per authored tick. For each row:

1. Set the input values (0 or 1) for each input signal.
2. Set the expected output values for each output signal. Leave a cell blank to skip checking that signal on that row.
3. For sequential circuits, author data inputs per tick. If Verify detects `CLK100MHZ` / `W5` or an explicit clock component, RedByte auto-runs that clock by default. If the design intentionally clocks from a switch or button, switch to manual/custom mode and author the required clock/control activity in the highlighted lane.

Starter examples include pre-defined testbench rows. For custom circuits, the user authors rows directly in the grid or uses the advanced starter and sweep tools.

### 9.2 Running Verification

1. Navigate to the Verify surface.
2. Choose **Observe only** or **Compare checks**.
3. Click **Run**.
4. The engine runs the current testbench against the circuit.
5. Results appear in the waveform and evidence panels. Each row shows the authored inputs, the saved expected outputs, the observed outputs, and a pass/fail indicator where checks were saved.

Result: A PASS verdict if all saved checks match. A FAIL verdict if any saved check mismatches.

### 9.3 Interpreting Results

**PASS.** All saved checks produced the expected outputs. The circuit behaves correctly for the tested cases.

**FAIL.** One or more saved checks produced incorrect outputs. The Verify surface highlights failing rows and identifies which output signals did not match. The hint system evaluates 14 diagnostic conditions and displays matching fact-grounded suggestions for diagnosing the failure.

### 9.4 Navigating from Failure to Design

From a failing verification row, click "Jump to failing node" to navigate directly to the Design surface. The system highlights the relevant gate and displays a diagnostic callout (e.g., "Gate X failed — check its inputs"). This allows the student to fix the issue without manually searching the circuit.

### 9.5 Verification Determinism

Verification results are deterministic. Running the same circuit with the same authored testbench produces the same pass/fail results every time, on every machine. The Verify surface displays a deterministic run hash to confirm reproducibility.

---

## 10. Hardware Mapping and Physical Board Preparation

### 10.1 Understanding Hardware Mapping

Hardware mapping is the process of assigning each circuit port to a physical pin on the Basys 3 FPGA board. This determines which physical switch controls which circuit input, and which LED or display segment shows which circuit output.

The mapping is stored as part of the project and used by the export pipeline to generate the XDC constraint file.
Renaming a top-level input or output does not create a second mapping identity. Project, Hardware, and Export all continue to reflect the same live port record after the rename.

### 10.2 Mapping Procedure

1. Navigate to the **Hardware** surface.
2. Select the **Map Pins** tab.
3. For each circuit port listed in the mapping table:
   a. Click the pin assignment dropdown.
   b. Select the appropriate Basys 3 pin. Input ports show available switches, buttons, and clock; output ports show available LEDs and display segments.
4. Repeat until all ports are assigned.

Result: The mapping status changes to "Mapping complete."

> **Note:** For sequential circuits, the clock port must be assigned to CLK100MHZ (pin W5). This is the on-board 100 MHz oscillator.
> Human-friendly labels such as `ENTER CLK` or `Main Reset` do not change that requirement; RedByte still treats those renamed top-level ports as the same clock/reset mapping authority.

### 10.3 Pin Presets

For common circuit configurations, the Hardware surface offers pin presets that automatically assign ports to standard pin configurations. Presets are available for typical lab assignments (e.g., 2 switches + 1 LED, 4 switches + 4 LEDs).

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

RedByte generates a complete file set for AMD Vivado. The student downloads a ZIP file, opens or creates the Vivado project from the exported artifacts, and runs the standard synthesis/implementation/bitstream flow to program the Basys 3 board. The Vivado flow and hardware programming boundary follows AMD Vivado project-mode Tcl and Hardware Manager guidance; RedByte documents that boundary rather than pretending the browser generated a bitstream.

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

1. **Download the Vivado Kit** from the Export surface.
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

The testbench exercises all truth table rows in sequence. When a Basys3 board clock is detected, it includes a dedicated free-running clock process and samples each vector with `rising_edge(...)` waits so the Vivado simulation follows the same board-clocked behavior RedByte verified.

### 11.5 Common Vivado Errors

| Vivado Error | Likely Cause | Resolution |
|--------------|-------------|------------|
| "Port X not found in entity" | Port name mismatch between XDC and top.vhd | Return to Hardware surface, re-map, and re-export. |
| "Multiple drivers on net" | Combinational loop in circuit | Fix the loop in the Design surface, re-verify, and re-export. |
| "No valid object(s) found for PACKAGE_PIN" | Incorrect pin number in XDC | Check Hardware surface mapping against Basys 3 pin reference. |
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

1. Navigate to the Import surface.
2. Select the "Upload ZIP" tab.
3. Upload the `.rbproj.zip` or submission archive.
4. The system detects the `rb-project.json` manifest and restores all circuit state, layout, vectors, probes, and mappings.
5. Click "Apply" to load the project.

Result: Full fidelity import. All circuit elements, positions, test vectors, and pin mappings are restored exactly as exported.

### 12.2 Importing Structural VHDL

To reconstruct a circuit from VHDL that uses component instantiation:

1. Navigate to the Import surface.
2. Select the "Paste HDL" tab.
3. Paste or type the VHDL source.
4. The parser detects component instantiation patterns (e.g., `U1: AND2 port map (...)`) and maps them through a component library that recognizes 37 HDL name variants (e.g., `and2`, `AND`, `and_gate`) resolving to 9 distinct RedByte node types.
5. Review the parsed ports table and reconstructed schematic preview.
6. Click "Apply."

Result: Reconstructed fidelity. Circuit topology is correct, but node positions are auto-assigned and test vectors must be re-authored.

### 12.3 Importing Constraint Files

To import pin assignments from an XDC file:

1. Navigate to the Import surface.
2. Select the "Paste XDC" tab.
3. Paste the constraint file content.
4. The parser extracts pin assignments and maps them to the current circuit's ports.
5. Review and apply.

Result: Pin assignments imported. Requires an existing circuit with matching port names.

---

## 13. Submission, Review, and Instructor Workflows

### 13.1 Student Submission

Students export their work as a submission package that includes the project state, verification results, and integrity information.

1. Complete the circuit design and verification.
2. Navigate to the Project surface.
3. Click **Export Submission**.
4. The system generates a deterministic ZIP containing the project JSON, verify ledger, gate verdict, run counts, and a file manifest with content-addressed hashes.
5. Upload the downloaded file to the institutional LMS (e.g., Blackboard).

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
| `pnpm install` fails | Node.js version mismatch | Ensure Node.js 18 or later and pnpm 8 or later are installed. |
| Dev server does not start | Port 5173 in use | Terminate the process occupying the port or start with `--port 5174`. |
| TypeScript errors in test output | React 19 compatibility issue | Known pre-existing condition. Does not affect runtime behavior. |

### 15.2 Circuit Design

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Wire will not connect | Invalid connection direction | Verify that the source is an output port and the target is an input port. |
| Circuit health shows "Issues found" | Floating outputs or missing I/O | Check for unconnected output ports and ensure all required I/O nodes are present. |
| Flip-flop output does not change | Clock signal not toggling | Ensure a Clock node is connected to the CLK port and that the clock value transitions from 0 to 1. |

### 15.3 Verification

| Symptom | Cause | Resolution |
|---------|-------|------------|
| All vectors fail | Circuit not wired correctly | Return to Design and trace signal paths from inputs to outputs. |
| Sequential circuit fails unexpectedly | Missing clock activity in the authored testbench | Ensure the active clock/control lane contains the required edge or enable activity before checking outputs. |
| Stale verification indicator | Circuit modified after last verify | Re-run verification to update results. |

### 15.4 Hardware Mapping

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Pin dropdown shows no options | Port direction mismatch | Verify that input ports are being mapped to input-capable pins (switches, buttons) and output ports to output-capable pins (LEDs). |
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
- For sequential circuits, always include a dedicated Clock node rather than toggling a Switch manually.
- Keep combinational logic depth reasonable. Deeply nested gate chains increase stabilization time and may cause timing failures in Vivado.

### 16.2 Verification

- Define test vectors before building complex circuits. Having a clear specification of expected behavior guides the design process.
- Test edge cases: all-zero inputs, all-one inputs, and boundary conditions.
- For sequential circuits, author multiple ticks and deliberately place rising edges where state should advance.
- Re-verify after every design change. The stale indicator reminds users when results are outdated.

### 16.3 Hardware Mapping

- Use pin presets for standard lab assignments to avoid manual mapping errors.
- Assign clock ports first for sequential designs. The 100 MHz on-board clock (CLK100MHZ, pin W5) is the standard clock source for the Basys 3.
- Verify that the number of mapped inputs and outputs matches the circuit's I/O count before exporting.

### 16.4 Export and Vivado

- Always use the `.rbproj.json` for re-importing projects into RedByte, not the exported `top.vhd`. The VHDL export uses concurrent signal assignments optimized for synthesis, not for re-import.
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

**Clocked / sequential schedule.** The verification schedule used for sequential circuits. Students author the clock or control lane tick by tick, and state advances only when the authored activity includes the required edge or level change.

**Combinational circuit.** A circuit whose outputs depend only on current inputs, with no memory or feedback. Contains no flip-flops or latches.

**Connection.** A directional link from one node's output port to another node's input port. Defined by `{ from: { nodeId, portName }, to: { nodeId, portName } }`.

**Determinism.** The property that identical initial states and identical input sequences always produce identical results, across runs and across machines.

**Fidelity level.** A classification of import quality: Full (all state restored), Reconstructed (topology correct, layout and vectors lost), or Partial (ports only).

**Gate verdict.** The submission system's summary judgment of whether a student's work meets lab requirements. Displayed as "Ready to submit" / "Submission needs attention" in the student view.

**Import.** The process of bringing external HDL, constraint files, or project archives into RedByte.

**LVCMOS33.** The I/O voltage standard used by the Basys 3 board (3.3V low-voltage CMOS). All generated XDC constraints specify this standard.

**Node.** Any logic element in the circuit: a gate, flip-flop, switch, lamp, clock, or other primitive.

**Port.** A named input or output connection point on a node. Signals flow into input ports and out of output ports.

**Rising edge.** A clock signal transition from 0 to 1. RedByte flip-flops capture data on the rising edge.

**Sequential circuit.** A circuit whose outputs depend on both current inputs and stored state. Contains flip-flops or other memory elements.

**Surface.** One of the six primary screens in the RedByte IDE: Project, Design, Verify, Hardware, Export, Import.

**Test vector.** A row in the verification truth table specifying input values and expected output values for one test case.

**Tick.** One discrete time step of the simulation engine. All nodes are evaluated once per tick in topological order.

**Topological sort.** The algorithm RedByte uses to determine the evaluation order of nodes. Guarantees that a node is evaluated only after all its input dependencies have been evaluated.

**Vivado Kit.** The ZIP file produced by the Export surface, containing `top.vhd`, `top.xdc`, `testbench.vhd`, automation scripts (`vivado_import.tcl`, `program_and_test.tcl`), and documentation files.

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
- **Ports:** Match the student's circuit ports as named in the Hardware surface.
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
- **Structure:** Drives each truth table input row as a sequence of signal assignments. Asserts expected output after propagation delay.
- **Clock period:** 10 ns (matching 100 MHz) for sequential circuits.
- **Completion:** Testbench halts after exercising all vectors.

---

### Appendix D: Keyboard Shortcuts

**Global**

| Action | Shortcut |
|--------|----------|
| Switch to Design | 1 |
| Switch to Verify | 2 |
| Switch to Export | 3 |
| Switch to Map Pins | 4 |
| Switch to Import | 5 |
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

**Verify Surface**

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
| Behavioral VHDL (process, concurrent) | Partial | No (ports only) | No | No | No |
| RedByte-exported `top.vhd` | Partial | No (ports only) | No | No | No |
| XDC file | N/A | N/A | N/A | N/A | Yes (if ports match) |

---

*End of RedByte Product Manual*

*Attribution: Connor Angiel.*
*RedByte Proprietary License (RPL-1.0)*
