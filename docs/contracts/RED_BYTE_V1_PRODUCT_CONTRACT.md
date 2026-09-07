---
doc_status: current
last_validated: 2026-07-27
owner: Connor Angiel
used_by_claude: true
role: V1 product contract reset for RedByte
---

# RedByte V1 Product Contract

This is the V1 product contract reset. It supersedes stale queue assumptions for near-term RedByte product work, but it does not rewrite shipped behavior by itself. Current behavior still lives in code, tests, `docs/manuals/RedByte_Product_Manual.md`, and proof docs.

## Product Identity

RedByte V1 is a browser-based Basys3 digital-logic lab workbench.

It helps a student:

1. Start a blank, starter, saved, or instructor-defined lab project.
2. Build a supported digital-logic circuit visually.
3. Run authored stimulus, inspect waveform/circuit Replay, and add optional expected-output checks when validation is required.
4. Map project signals to Digilent Basys3 board resources and package pins.
5. Export a coherent Vivado-ready package.
6. Continue in Vivado for synthesis, implementation, bitstream generation, programming, and observation when those proof tiers are required.

RedByte V1 is not:

- A Vivado replacement.
- A universal HDL IDE.
- A universal FPGA-board abstraction.
- A SaaS classroom-management platform.
- A hidden-answer lab system.
- A hardware-proof product without Vivado and board evidence.

## V1 Audience

| Audience | V1 promise |
|---|---|
| Student | Understand the next lab action, build and debug a circuit, verify behavior, map board IO, and export a handoff package without needing agent context. |
| Instructor / TA | See the proof boundary, assign supported Basys3 labs, inspect student artifacts, and understand what RedByte proves versus what Vivado/board observation must prove. |
| Maintainer | Use one cockpit, one work queue, one product contract, and one proof language without reviving stale OS-era docs. |

## V1 Product Spine

The RedByte-owned spine is:

```text
Project -> Design -> Verify -> Map Pins -> Export
```

The external proof spine is:

```text
Export -> Vivado build -> Program Basys3 -> Observe board behavior
```

Import is a utility entry point. It is not part of the primary student spine.

The current supported sequential boundary is Register1 with one clock,
rising-edge capture, active-high asynchronous reset, and supported enable
semantics. RegisterBus, StateBank, falling-edge capture, multi-clock designs,
and unsupported register modes remain blocked.

## V1 Proof Tiers

| Tier | Name | Meaning | Owner |
|---|---|---|---|
| E0 | RedByte/browser/package proof | RedByte generated or verified browser artifacts for the current project state. | RedByte |
| E1 | Vivado build proof | Vivado synthesis, implementation, and bitstream generation completed for a named export. | External Vivado run |
| E2 | Board programming proof | A generated bitstream was programmed onto a Basys3 target. | External Vivado/Hardware Manager run |
| E3 | Board observation proof | Physical board behavior was observed against an explicit procedure. | Human or recorded lab proof |

V1 invariant: E0 can support a Vivado handoff, but E0 never proves E1, E2, or E3.

## Product State Vocabulary

| State | Contract meaning |
|---|---|
| No circuit | There is no design boundary to verify, map, or export. Do not show mapping failure copy. |
| Draft design | A circuit exists, but downstream proof may be missing or stale. |
| Simulation complete | Runtime outputs and replay ticks were recorded for the current design/scenario. This is useful behavioral evidence, not an assertion-pass claim. |
| No checks configured | Simulation completed with no expected-output assertions. This is never a failure and does not authorize trusted Export. |
| Assertions passing | Current observed outputs match all configured expected outputs for the current design/testbench authority. |
| Assertions failing | At least one expected-output assertion differs from observed output. The first mismatch must be inspectable while simulation evidence remains available. |
| Pins mapped | Required top-level signals have board resource/package pin assignments. |
| Draft export | A package can be generated or inspected, but trusted proof is missing or stale. |
| E0 ready export | Design, mapping, current passing assertions, and export state are coherent for browser/package handoff. |
| Hardware proof pending | Vivado build, board programming, or board observation remains external. |

## Surface Contracts

### Global Shell

The shell must make the active job, next action, and proof boundary visible without competing status authorities.

Must:

- Use one compact workflow/status authority.
- Keep Project, Design, Verify, Map Pins, and Export navigation stable.
- Preserve E0 versus E1/E2/E3 language.
- Avoid implying hardware readiness from browser state.

Must:

- Keep one bottom panel that exists on every workspace. Whether there is anything to report is the
  panel's answer to give, not a reason for it to disappear; an empty ledger says so.
- Let the problems count open the panel, and let the panel be put away and got back.
- Keep dock preferences per surface. Opening Problems on Project is not a statement about Design;
  what must hold is that each workspace restores what it was left in, and that a changing problem
  count never silently overrides a reader's choice.
- Report the state of the reader's work honestly. With nothing open there is no work to save, and
  the frame says so rather than reporting unsaved changes to a placeholder.
- Survive a shortage of room in both of its forms: a large text setting inside a fixed viewport,
  and browser zoom, which shrinks the CSS viewport under the whole frame. They fail at different
  settings and both are measured.

Must not:

- Repeat contradictory state across ribbon, rail, panels, and CTAs.
- Let debug/build chrome dominate the student path.
- Use "ready" without naming the proof tier.
- Let any control draw outside its own box, take a click meant for its neighbour, or shrink one of
  the six frame priorities to make room for something that is not one of them.

### Project Command Center

Project is the command center, not a starter gallery.

**Project answers a different question depending on whether work is open (2026-09-07).** These are
two experiences on one route, and which one appears is a fact about the project's lifecycle, not
about its contents:

| | Start | Overview |
|---|---|---|
| The question | What am I going to work on? | What is this project, where did I leave it, what needs attention? |
| Shown when | nothing is open | a project is open |
| Strongest element | the reader's own saved work | the circuit |
| Ways on | blank · course lab · starter · saved · import · recover | one continuation, plus the circuit and each state line |

Must:

- Decide between the two states from the lifecycle owner - whether a project is open - and never
  from whether the circuit has components, whether there are problems, or what the project is
  named. The launcher placeholder nobody chose is not open work; a blank project a person
  deliberately created is.
- Show blank start, certified starter, saved project, import/recovery, and future instructor lab
  entry as peer paths with clear priority. When the reader has saved work, that is the primary path.
- Let a reader read a lab, a starter or a saved project without applying it. Browsing is reading.
- Give the active Overview one dominant object (the circuit), one continuation that follows where
  the reader last worked, and its state beside it - simulation, mapping, package - each linking to
  the workspace that owns it. Everything else is one closed disclosure away and nothing is deleted.
- Keep the reader's own identity editable where it is shown, not behind a disclosure.
- Keep no-circuit state neutral, and say plainly that the sheet is empty rather than implying a
  circuit that does not exist.
- Show the recommended next action without requiring scroll at common laptop sizes.
- Preserve work across close and resume: closing saves and returns to Start, and resuming from
  Start reopens that project - not a fresh copy of the lab it came from.
- Avoid hardcoding ECE141 as the product identity.

Must not:

- Treat starter loading as the only serious path.
- Report mapping failures before a circuit exists.
- Invent a recent project the reader never created, including on reload.
- Hide a saved project because of what it is called.
- Nominate itself as the continuation, or impose a Design -> Simulate -> Board -> Package march.
- Calculate readiness a second time. The status lines read the facts the project already derives.

### Design Workbench

Design is where the circuit graph is the object.

Must:

- Make the actual circuit graph visible and primary in the first viewport after loading a starter or project.
- Keep palette, toolbar, health, inspector, and starter context supportive.
- Keep authoring controls stable enough for repeated student edits.
- Surface circuit issues before export when possible.

Must not:

- Let banners, inspectors, or chrome displace the schematic.
- Hide circuit evidence behind dashboard cards.

### Verify Evidence Workbench

Verify is the evidence and repair loop.

Must:

- Use the student loop `Scenario -> Run simulation -> Inspect replay -> Optional checks`.
- Keep simulation status and assertion status distinct; a completed run with no checks must say `No checks configured`, never FAIL.
- Show stimulus, observed outputs, replay controls, optional expected outputs, first mismatch, and repair path in that hierarchy.
- Keep waveform/tick evidence readable, tied to the selected case, and available after a failed assertion.
- Open recorded ticks on the real Design canvas as a read-only circuit replay.
- Let a student add or edit expected outputs, rerun, and reach assertion PASS/FAIL without changing the meaning of simulation completion.

Must not:

- Present a dense control panel where the evidence is secondary.
- Show assertion PASS when checks are absent, stale, or mismatched.
- Treat a failing optional assertion as a failed or missing simulation.

### Hardware / Basys3 Workbench

Hardware is the Basys3 mapping workbench.

Must:

- Show project signal -> board resource -> package pin -> XDC consequence.
- Keep the board and mapping rows visible together.
- Name Basys3 resources in student-readable terms and trace them to physical pins.
- Keep E1/E2/E3 proof external unless evidence exists.

Must not:

- Say or imply that browser state programmed or observed hardware.
- Hide mapping rows below generic hardware guidance.

### Export Handoff Station

Export is the Vivado handoff station.

Must:

- Show one current trust state: draft, needs review, E0 ready, or blocked.
- Show the primary package action in the first viewport.
- Show generated artifacts and their provenance.
- Explain what Vivado must still do.
- Keep mapping summary language consistent with the active project mapping state.

Must not:

- Say "ready to build" without E0/E1/E2/E3 boundary language.
- Contradict mapped/unmapped state in the same viewport.

### Import / Recovery

Import is a review-gated utility.

Must:

- Keep upload, parse, map ports, review schematic, and apply import as explicit steps.
- Make fidelity and warnings understandable.
- Avoid replacing the current project before review.

Must not:

- Become the default student route.
- Claim broad HDL migration fidelity without representative proof.

## V1 Work Order

The approved execution order is:

1. V1 Contract Reset.
2. Under-the-Hood Mastery Sprint.
3. Export Trust Integrity.
4. Verify Evidence Workbench.
5. Shell and Workbench Layout Reset.
6. Project Command Center.
7. Export Handoff Station.
8. Hardware / Basys3 Workbench.
9. Design Workbench.
10. Import / Recovery.
11. Lab Profile / Course Pack Data Seam. Closed locally 2026-06-14.
12. Student/Instructor Quickstarts. Closed locally 2026-06-14.
13. Vivado/Basys3 Proof Restoration.
14. Packaging/Commercial Readiness.

## Non-Negotiables

- Do not weaken tests to match a design plan.
- Do not change simulation, Verify result semantics, pin mapping semantics, export generation, project data format, goldens, or hardware proof in layout-only slices.
- Do not claim live/student deployment from a GitHub push unless deployment evidence confirms it.
- Do not add accounts/SaaS before a concrete hosted-data requirement exists.
- Do not treat course packs or lab profiles as more urgent than the core workbench hierarchy.
- Do not make a hardware claim without E1/E2/E3 evidence for the named project class.

## Definition Of Done For A Product Slice

A V1 product slice is done only when:

- The product complaint is translated into the hardening ticket fields.
- The smallest reversible code or docs change is made.
- Focused tests/gates pass.
- Browser proof covers the affected surface at common viewports.
- Current-truth docs and cockpit docs are updated.
- The slice is committed and pushed when requested.
- GitHub required checks are inspected from live GitHub evidence.

## Decision Record

### 2026-09-07 - Project as two experiences

**Decided.** Project shows Start when nothing is open and the project's own Overview when something
is. The choice is made by the lifecycle owner. The Overview is composed - identity, circuit, state,
attention, then disclosures - rather than tabulated.

**Rejected, and why:**

| Alternative | Why not |
|---|---|
| One screen deciding by whether the circuit has components | Neither question. It sent a blank project a person deliberately made back to the catalogue, and it would have shown a specification sheet to somebody who had not chosen anything yet. |
| A specification-sheet Project (the 12-cell fact grid across the top) | It answers "what are this project's attributes", which is not what a reader arrives asking. Measured at 1280x650 it put 776px of content in a 566px pane; the circuit was third in reading order and there was no way to continue. The facts are all still there, one disclosure away. |
| The gallery as the home of an active project | Browsing is what you do before you have chosen. Once work is open, a catalogue is an interruption. |
| Metadata-first hierarchy on the Overview | The project's own drawing is the thing a reader recognises. Metadata is what you consult, not what you land on. |
| A hidden bottom panel that appears when there are problems | Whether there is anything to report is the panel's answer to give. A count in the status bar that opens nothing is worse than a panel that says "no problems". |
| A second readiness calculation for the Overview's status lines | Two authorities disagree eventually. The lines read the facts the project already derives, in a different register. |
| Making dock preferences global so all surfaces share one panel state | Rejected for this slice by explicit direction: opening Problems on Project does not need to open it on Design. Per surface, restored on return. |

### 2026-09-07 - The shared bottom panel

**Decided.** One panel, on every workspace including an empty Board. Its resting state is present
and collapsed - a 28px strip that names itself and carries the control that puts it away. The status
bar's problems count opens it expanded. Hiding it is the reader's choice; a layout reset undoes that
choice. Preferences are per surface. The problem count is the panel's content, never its state.

**Rejected, and why:**

| Alternative | Why not |
|---|---|
| A panel that appears when there are problems | It takes its own strip with it, and leaves a status-bar count that is a button doing nothing. An empty ledger saying "no problems" is an answer. |
| A default of hidden-with-a-restore-bar | It contradicted the four surfaces that ask for `collapsed`, and it made "a layout reset recovers the panel" false - a reset restores the default, and the default was the generic bar. |
| Global dock preferences shared by all surfaces | Rejected by explicit direction for this slice: opening Problems on Project is not a statement about Design. |
| Forcing the panel open when the count changes | The count is content. Blocking diagnostics still force it into view, which is a different thing and does not write the preference. |

### 2026-09-07 - Shortage of room is measured in both forms

**Decided.** Text zoom and browser zoom are separate failures and both are asserted: a large root
font inside a fixed viewport, and a CSS viewport shrunk under the whole frame. A control must own
its own box, never take a click meant for its neighbour, and never shrink one of the six frame
priorities to make room for something that is not one of them. Where a region cannot hold its
content, it scrolls; a floor that cannot be met is a scroll, not an overflow, and never a strip
collapsed to nothing.

**Rejected, and why:**

| Alternative | Why not |
|---|---|
| Treating the existing 200%-text coverage as covering zoom | Its own header says otherwise. The panel failed at 200% browser zoom while every text-zoom case passed. |
| Capping a panel on the element inside a taller track | It leaves an inert strip of reserved space. The cap belongs to the track. |
| Percentage caps with no floors on stacked strips | At a short window the floored neighbour takes everything and the capped strips resolve to zero. Measured on Board: `41px / 85.5px / 44.5px` with 623px of the side pane unreachable, and `0px 160px 0px` once the column scrolled without floors. |

## Attribution

Connor Angiel
