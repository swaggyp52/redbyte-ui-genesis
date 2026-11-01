---
doc_status: current
last_validated: 2026-08-01
owner: Connor Angiel
used_by_claude: true
role: RedByte Product System v3 architecture and Milestone A contract
---

# RedByte Product System v3

## Product definition

RedByte is a visual, local-first FPGA project workbench and Vivado companion for digital-logic education. RedByte owns project organization, supported visual authoring, supported behavioral simulation, scenario and evidence work, supported Basys3 assignment, HDL/XDC/testbench generation, and browser-package validation. Vivado owns full HDL and IP behavior, synthesis, implementation, timing analysis, bitstream generation, programming, hardware debug, and physical observation.

Milestone A changes the product system, workspace, persistence cues, and visual identity. Its draft candidate uses a warm light-first ivory/graphite foundation with coral, teal, amber, and blue semantic accents plus a complementary dark theme; the prior washed-out gray/lavender treatment is not the v3 identity. It does not broaden the proven logic, HDL, board, or hardware boundary.

## Information architecture

The visible workbench spine is:

```text
Project -> Design -> Simulate -> Board & Constraints -> Build & Export -> Vivado
```

The compatible internal route IDs remain `project`, `design`, `verify`, `hardware`, `export`, and utility route `import`. Import / Recover is not a numbered stage. The shell carries project identity, target, storage state, commands, theme, and development identity. Each stage owns its primary work object and its state-changing actions.

| Surface | Owned work |
|---|---|
| Project | Project identity, current project truth, next action, project lifecycle, source/module/constraint summaries, recent projects, recovery |
| Design | Circuit graph authoring, selection, component discovery, real project outline, contextual board assignment, Design-local problems |
| Simulate | Named scenarios, stimulus, optional checks, waveform, replay, current-versus-stale evidence |
| Board & Constraints | Global signal assignment, resource compatibility, conflicts, clock/reset intent, package pins, I/O standards, XDC consequences |
| Build & Export | Package readiness, design/simulation/constraint source sets, generated files, validation report, Vivado handoff boundary |
| Import / Recover | Review-gated restore and external-source inspection without implicit replacement |

## Project lifecycle and persistence

P2.6C keeps ProjectRepository and the existing project runtime as the persistence authorities. Complete project snapshots, named scenarios, retained recordings, package receipts, imported VCD evidence and working-session metadata use transactional IndexedDB records. The portable RBProject design remains format 1. Preferences remain separate from project semantics.

Storage policy:

- Durable project snapshots: the existing versioned repository records in IndexedDB. Snapshot and index changes commit together; revision checks reject a stale tab instead of overwriting a newer save.
- Legacy migration: copy recognized localStorage records, commit, and verify exact readback. Original bytes remain intact, including malformed records. Tombstones prevent a deleted migrated project from resurfacing.
- Small preferences: localStorage through the existing versioned preferences service.
- Recorded evidence: complete immutable runs retain design, authored input, schedule, topology, native samples, configuration/output identities and verdict. Reopening does not execute a run or change its provenance. Currentness is derived against the current project; missing evidence remains unrecorded.
- Working-session recovery: deferred serialization coalesces successive complete snapshots behind an active write. It does not merge executions or prune retained recordings. Save waits for serialization and durable transaction completion.
- Recovery: repository-created snapshot before replacement, plus explicit confirmation before restore.
- External backup: the Download session backup action produces a complete .rb-session.json envelope containing format-1 project data, scenarios, recordings and receipts. Ordinary .rbproj export remains compatible and distinct from the complete session backup.

The UI states are `Autosaving`, `Saving`, `Saved`, `Save failed`, and `Recovery available`, with a real last-saved time and storage location. Save As creates a new project identity; Duplicate copies the durable project and local authored scenario state without inventing fresh proof.

Corrupt repository indexes are reconstructed from valid durable snapshots. A failed transaction preserves the previous committed save and the open in-memory work, and exposes the session backup action. Browser storage is device/profile-local and subject to browser capacity and eviction policy; durable completion is not a remote backup or an unlimited retention promise. Validation and measured workload results belong to the current delivery record in ACTIVE_WORK.

Reload must preserve the active project, active surface, theme, layout preset and dimensions, panel visibility, toolbar preference, scenarios, probes, checks, and mapping. It must not promote stale or transient simulation evidence.

## Workspace model

One shared shell owns theme, command palette, stage navigation, project menu, and compact status bar. Workspace preferences are versioned and independent of project semantics.

Presets are `Authoring`, `Simulation`, `Board`, and `Code`. A preset selects panel visibility and dimensions only. Manual resize/collapse overrides are persistent and resettable. Controls remain keyboard reachable, required safety actions cannot be hidden, and root/nested scroll traps are defects.

Design's Milestone A composition is:

- Left dock tabs: Components, Hierarchy, Sources, Board.
- Center views: Canvas, Code, Split.
- Right dock tabs: Inspector, Properties, Constraints.
- Bottom dock tabs: Problems, Console, Simulation / Waveform.

Only tabs backed by current data are populated. Hierarchy means the current top plus actual component/custom-block instances; it does not claim nested module editing.

## Command model

One registry supplies stable IDs, group, label, keywords, shortcut, availability, disabled reason, and execution. UI buttons and the command palette invoke existing authority callbacks; commands do not create parallel state mutations. `Ctrl+K` opens fuzzy search with keyboard navigation. Surface switching, project lifecycle, theme, layout, Design edit/camera actions, simulation, board handoff, package handoff, Import, and Help are registered as context permits.

## Component model

A versioned `ComponentDefinition` facade describes stable ID, display name, category, description, symbol, ports, direction, width, signal type, parameters/defaults, simulation capability, export capability, HDL ownership, compatibility tier, documentation, and deprecation. It is layered over the current runtime/support registries so Milestone A does not change circuit semantics.

Board resources are not logic primitives. Custom components and existing macros remain actual project data. Full hierarchy, buses, code-backed module editing, parameter propagation, and recursive-cycle protection are future contracts.

## Board and constraint model

One versioned Basys3 profile is the board-fact source for resource IDs/labels, package pins, direction/capability, I/O standard, clock metadata, compatibility class, board coordinates, documentation, and provenance. The existing semantic mapping projection remains the assignment/export authority. Design's inline assignment is another view over that authority, never another store.

Official-source baseline retrieved 2026-08-01:

| Source | Version | Affected contract |
|---|---|---|
| [Digilent Basys 3 Resource Center](https://digilent.com/reference/programmable-logic/basys-3/start) | living product resource center, retrieved 2026-08-01 | canonical board resource index, official document routing, FPGA part reference |
| [Digilent Basys 3 FPGA Board Reference Manual](https://digilent.com/reference/_media/reference/programmable-logic/basys-3/basys3_rm.pdf) | Revised 2019-07-10, Basys3 rev. C, DOC 502-183 | board identity, XC7A35T-1CPG236C, supported physical resources, 100 MHz oscillator on W5 |
| [Digilent Basys-3-Master.xdc](https://github.com/Digilent/digilent-xdc/blob/master/Basys-3-Master.xdc) | current upstream master retrieved 2026-08-01 | package pins, LVCMOS33 defaults, clock constraint reference |
| [Digilent Basys 3 Public Schematic](https://digilent.com/reference/_media/reference/programmable-logic/basys-3/basys-3-sch-public-rev-d.pdf) | Rev D.1, DOC 500-183, 2021-02-05, retrieved 2026-08-01 | physical-resource and grouping cross-check; future differential-resource reference |
| [AMD UG892, Vivado Design Suite User Guide: Design Flows Overview](https://docs.amd.com/r/2024.2-English/ug892-vivado-design-flows-overview/Understanding-Project-Mode-and-Non-Project-Mode) | 2024.2, 2024-11-13 | Project/Tcl handoff and Vivado-owned flow stages |
| [AMD UG895, Vivado Design Suite User Guide: System-Level Design Entry](https://docs.amd.com/r/2024.2-English/ug895-vivado-system-level-design-entry/Introduction) | 2024.2, 2024-11-13 | source sets, top module, constraints, IP/block-design boundary |
| [AMD UG900, Vivado Design Suite User Guide: Logic Simulation](https://docs.amd.com/r/2024.2-English/ug900-vivado-logic-simulation/Exporting-Simulation-Files-and-Scripts) | 2024.2, 2024-11-13 | simulation-source/testbench handoff boundary |
| [AMD UG901, Vivado Design Suite User Guide: Synthesis](https://docs.amd.com/r/2024.2-English/ug901-vivado-synthesis/Overview) | 2024.2, 2024-12-11 | synthesis remains external |
| [AMD UG903, Vivado Design Suite User Guide: Using Constraints](https://docs.amd.com/r/2024.2-English/ug903-vivado-using-constraints/Reporting-Features-Available-When-the-Wizard-is-Open) | 2024.2, 2024-12-20 | XDC organization, timing constraints, constraint-set boundary |

## Simulation and handoff models

Simulate owns an authored scenario with stimulus and optional checks, one Run action, and retained recording inspection. Reproduce executes the selected recording's retained configuration. Simulation completion, recorded-output identity and assertion verdict remain separate: zero configured checks never imply PASS. A restored recording retains its identity; currentness and package trust are recomputed by their existing authorities.

Build & Export presents design sources, simulation sources, constraints, top module, generated files, compatibility findings, Vivado 2024.2 target, Tcl handoff, and package validation using current artifacts only. Browser E0 can prove RedByte state and package bytes; it cannot prove Vivado execution or hardware.

## Terminology

Use `Project`, `Design`, `Simulate`, `Board & Constraints`, `Build & Export`, `Import / Recover`, `Autosaving`, `Saved`, `Recovery available`, `Simulation complete`, `No checks configured`, `Assertions passing`, `Assertions failing`, `Draft export`, and `E0 ready export`. Reserve Vivado built, board programmed, and board observed for external E1/E2/E3 evidence.

## Milestone A non-claims

Milestone A does not implement full hierarchy, buses/named nets, generic/parameter authoring, code-backed module editing, arbitrary HDL support, multiple constraint sets, AMD IP, block designs, synthesis, implementation, timing closure, bitstream generation, programming, or physical observation.

## Attribution

Connor Angiel
