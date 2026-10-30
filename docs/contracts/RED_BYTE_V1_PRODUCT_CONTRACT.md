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

## Approved target: the intentional workbench (2026-09-07)

> **This section is the approved target, not a description of what has shipped.** Where it
> disagrees with current code, tests, screenshots or DOM structure, this section wins and those
> are the things that change. Code and focused tests remain the authority on what the product
> *currently does*; they are not a veto on what it *should* do.

### The navigation model

RedByte is **one project** seen through five task workspaces: Project, Design, Simulate, Board,
Package. They are not wizard steps and they do not each get a copy of the project.

- **The left rail owns workspace navigation.** Visiting a workspace must not add a tab anywhere.
- **A tab is another object inside the workspace that owns it** — a second module or source in
  Design, another scenario in Simulate, a file preview or the report in Package. Project and Board
  have no root tab. A workspace's own default view is the workspace, not a closable tab.
- **A scenario is one workbench.** `Default — Cases`, `Default — Timing` and `Default — Waveform`
  were three documents for one experiment; they become one **scenario document** whose table /
  timing / waveform presentation is view state belonging to that scenario.
- **Opening a tab focuses an existing object.** Creating or duplicating a scenario, module or
  project is an explicit operation. **Closing a view never deletes** the scenario, source, run or
  project behind it.
- Persisted navigation carries descriptors and view preferences only. Existing `cases`, `timing`
  and `waveform` descriptors migrate to their scenario's workbench rather than disappearing.

### Run, playback, and what a result means

- **A scenario is authored stimulus. A run is an immutable recording of executing it.** A run is
  bound to its scenario, its design/source revision and its engine; it is never rewritten.
- **Run and Play are different operations.** Run executes; Play walks recorded data. Playback
  speed changes presentation speed — never a clock frequency and never simulated circuit time.
- **A run must never start, navigate, or open anything on its own.** Finishing a run does not
  create a document, does not expand a panel, and does not begin playback.
- **Observation is a complete task.** One primary Run works on a scenario with no expected
  outputs. Result language names what happened: "Run complete — no checks configured",
  "14 checks passed", "1 check failed", "Results are from an earlier version". A failed assertion
  and a failed execution are different conditions and are named differently.
- **A percentage without a defined denominator is not a result.** Coverage belongs in run details
  when its measure is defined, never in the headline.
- **Editing preserves history.** Changing stimulus or design leaves the previous run intact and
  marks the comparison stale. Editing an expected value never rewrites an observed one.
- **Unrecorded is not zero.** Missing sample, unknown, unsupported and logic zero are four
  different drawings.

### What each workspace opens on

| Workspace | Opens on | Tabs |
|---|---|---|
| Project | Start when nothing is open, the project's Overview when something is | none by default; project-browser documents when opened |
| Design | the active module's schematic | other modules and sources |
| Simulate | the active scenario's workbench | other scenarios |
| Board | one mapping surface with contextual detail | none |
| Package | **the operational package landing** — identity, one primary action, plain state, the file list, the next external step | file previews and the report |

### Superseded defaults

These are replaced at their owners, not restyled:

1. Separate Timing and Waveform documents as the ordinary author/run workflow.
2. Any automatic navigation, panel expansion or playback on run completion.
3. Report-first Package navigation (`handoff` as the export default).
4. Generic run / tick / speed controls in the Design toolbar whose data source is not stated.
5. The global tab strip that accumulates one tab per workspace visited.
6. A mandatory Board Guided/Expert fork. Board is one surface with progressive detail.

### Composition rules that apply to every workspace

- The work object — the circuit, the timeline, the board — gets the room. Controls do not consume
  the first several lanes of the thing they control.
- Whitespace is allowed; stranded content is not. Density is allowed; unprioritized density is not.
- Every region states who sizes it and who scrolls it. `overflow: hidden` is not an overflow fix,
  and the application never scrolls sideways to reach an ordinary control.
- One primary action per surface, made primary by the restraint around it.
- Contextual detail appears when it becomes useful, and is not permanently resident.

### What this does not change

Project identity, saved work, import isolation, scenario ownership, immutable run evidence,
explicit staleness, the supported-construct boundary, honest mapping and export states, and the
distinction between browser evidence and physical hardware proof all stand exactly as they are.

---

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

### 2026-09-07 - One experiment has one primary working area

**Decided.** A scenario is one experiment. It is drawn one way at a time, in one region, and the
reader chooses which way with a VIEW switch that sits in whichever region is currently the primary
one. Timeline is the default for a clocked circuit, Table for a combinational one, and Waveform is
the recorded trace; the reader's choice is remembered for that scenario while it is open. The
switch never opens a second document and never a second tab.

Under the instrument is the run line: what the last run did, where the cursor is, what failed, and
the actions that follow from it. It is one strip, in every representation, and it is capped at a
third of the workspace. Before a run it says so in the line it already occupies.

What belongs to a representation goes with it. Case stepping, the tick range, the radix, the
expected overlay, the scrubber, playback and the view/measure tools all describe a drawn trace, so
they are drawn with the trace. The cursor, the readout, the failure focus and the tail actions
describe the experiment, so they are in the run line.

**Measured at 1280x650, the two-bit counter after a run:** primary 376px / run line 91px, against
88px / 255px+ before. The timeline's lanes are 244px; they were 88px in a region whose run line was
being drawn inside a 1px box.

**Rejected, and why:**

| Alternative | Why not |
|---|---|
| The Cases/Evidence deck with a resizable splitter, collapse, and maximize-either-pane | It exists because two instruments are on screen at once and have to be given room at each other's expense. One primary area has nothing to split. The controls, the persisted share and the collapsed strip went with it. |
| Keeping the trace toolbar on screen in every representation | It is a command bar for a canvas that is not there. Measured, it was the difference between a 244px timeline and an 88px one. |
| Cases, Timing and Waveform as three documents with three tabs | It says the reader has three experiments open. They have one, looked at three ways. |
| A percentage `max-height` on the run-line region | A percentage max-height on a grid ITEM resolves against the area the item is sizing, so it measured 34% of itself: a 91px line drawn inside a 31px box. The cap belongs to the track (`fit-content(34%)`). |
| A 255px placeholder before the first run | The primary area is already the instrument the reader is working in. Unrecorded is not zero, but it is one line, not a panel. |

### 2026-09-07 - Design explores; Simulate records

**Decided.** Design has no clock of its own. Live mode is exploration: drive an input and the values
settle, apply one clock edge when you ask for one, reset the values, and the surface says
"Exploring - not recorded" while you do. A circuit with no state is offered no clock edge, because
there is nothing for one to move. The way to evidence is named on the surface: run a scenario in
Simulate.

**Rejected, and why:**

| Alternative | Why not |
|---|---|
| Run / Pause on a wall-clock interval with a speed in Hz | It advanced a counter. On a combinational circuit stepping changed nothing at all; on a clocked one it applied edges at a rate unrelated to the scenario's clock policy, against no stimulus, with no expected values and no verdict. It looked like running a simulation and recorded nothing. |
| Keeping the "tick N" readout | A tick number with no schedule behind it is a number. "3 clock edges applied" is a fact about what the reader did. |
| Removing Live mode entirely | Exploring a circuit by driving its inputs is real and useful. What was false was the clock, not the exploration. |

### 2026-09-08 - Operational Package landing; report opened explicitly

**Current decision, superseding the 2026-09-07 dossier-first decision.** The
`package` workspace root presents project/board identity, draft or checked state,
the primary Generate and download ZIP operation, generated files, and the Vivado
next step. Handoff overview is an explicit secondary document. Technical details
and receipt history remain inspectable without occupying the initial working area.

An allowed draft package remains available without configured checks. A checked
package identifies its supporting current run. After project changes, an older
receipt remains historical and is not relabeled current. Report waveforms are
actual recorded samples with gaps preserved; inputs, expectations, or a current
draft are not substitutes for observations. Browser generation proves artifact
content only, not Vivado execution or hardware behavior.

### 2026-09-08 - One retained experiment, multiple investigation views

Simulate can show its immutable recording beside the matching real schematic,
using Design's symbols and net router without starting another engine. The
scenario, run, signal, and selected tick stay shared when focusing either pane.
New recordings retain a detached circuit snapshot. A legacy recording lacking a
matching topology says so rather than painting its values onto a changed design.

Full recordings are retained separately from summary ledger entries (bounded to
50). The recording picker is scoped to the active scenario; scenario view state
is scoped to project and scenario. Save/reopen retains current observation-only
runs as well as checked runs. Missing samples remain unavailable. Register
explanations use recorded rising edges and actual prior samples; they do not
infer capture from falling edges or unchanged inputs from an unchanged output.

### 2026-09-07 - A metric is not offered where it would not be true

**Decided.** "Input combinations N of M" is stated for a combinational circuit and withheld for a
clocked one. For a combinational circuit the truth table IS the specification and 2^n is its size,
so the count is a fact the reader can act on. A counter's output depends on the state it is in, not
only on the inputs applied at that tick, and two of the "inputs" the count included were the clock
and the reset - a schedule, not a stimulus space. On the two-bit counter it read "3 of 8" against a
denominator that does not describe the experiment.

### 2026-09-07 - A name that means two things names neither

**Decided.** Where a normalised signal name is claimed by more than one thing in the circuit, it
resolves to nothing, and it cannot credit a lane to the boundary. Only a lane carrying the
boundary's own display name may do that; everything else is internal.

The two-bit counter is the case that named it. Its io row for the board pin is
`{ id: 'q0', label: 'LD0' }`, and the D flip-flop driving that pin is an instance the student sees
labelled `Q0`. Normalised, the io row's id and the register's label are the same string. The
direction map is keyed by both a row's id and its label - correct until an id collides with
something else - so the register answered to a boundary key. The rail read
**"Outputs 4 (LD0 LD1 Q0 Q1) / Internal 0 - No internal lanes"** while the timeline, which draws
the boundary from the io rows, drew two output lanes: two representations of one experiment
disagreeing about how many outputs the circuit has. It now reads
**Inputs 3 / Outputs 2 (LD0 LD1) / Internal 2 (Q0 Q1)**, which is the circuit.

The alias authority already computed the ambiguity and threw it away, resolving only names with
exactly one owner. `buildWaveformSignalAliasOwners` returns the owners;
`buildCanonicalWaveformSignalAliases` is the subset that resolves;
`buildAmbiguousWaveformSignalKeys` is the subset that does not.

**Rejected, and why:**

| Alternative | Why not |
|---|---|
| Drawing the two "missing" lanes on the timeline | They are not missing. The extra waveform keys are the registers, not aliases of the pins - drawing them as boundary outputs produced two empty duplicates of LD0 and LD1 and was reverted. |
| Resolving `q0` to the boundary because an io row claims it | It is equally claimed by the register. Picking one is a guess, and a guess about signal identity is how evidence stops being evidence. |
| Renaming the lab's io rows so the ids stop colliding | It fixes one fixture and leaves the product wrong for the next circuit whose register shares a pin's id. |

### 2026-09-07 - A control is where a reader can reach it, and a number is the number

**Decided.** Four rules, each one written after a measurement contradicted it.

**A pane that shrinks re-fits what it draws.** Mounting a dock takes width from the sheet without
moving the camera. Design's contextual inspector took 280px and left the two-bit counter's output
pins 96px past the schematic frame and 80px under the dock: six of nine sampled points inside the
LD0 symbol hit it before, none after, and a click aimed at LD1 pressed the inspector's Delete node
button. The camera belongs to the reader, so this is not a re-fit on every resize - only when the
pane has shrunk AND that shrink has put the circuit outside the sheet.

**Every column an instrument draws can hold its cursor, and its decoration does not take the
click.** The timing ruler drew eleven columns for an eight-cycle run and four of them left the
cursor on t0 while the readout, the header chip and the observed values reported t7..t10. The tick
number, the grid line and the edge marker are drawn after the hit rect and sat on top of it, so
clicking the number - the most obvious way to select a tick - did nothing at all.

**An alternate editor does not destroy the editor it is an alternative to.** "Generators and full
event editor" took the 662px its content wanted, squeezed the timeline from 476px to 1px, and
painted over the composer bar: every control along the top answered `elementFromPoint` with the
disclosure's own summary. An alternate editor takes a bounded, scrolling share; the instrument
keeps a floor.

**Two numbers on the same screen are the same number, or they are two different things and say
so.** The package dossier read "4 warnings" 262px from a status bar reading "3 problems". The
extra one is an evidence advisory built in Export and never entered into the shared ledger. It is
said as an advisory now; the Warnings count is the ledger's count.

**Rejected, and why:**

| Alternative | Why not |
|---|---|
| Clipping the schematic to its frame instead of re-fitting | It stops the click landing on Delete node and leaves the pin unreachable. The pin is the thing the reader wants. |
| Re-fitting whenever the pane resizes | A reader who has zoomed in has content outside the pane on purpose. The trigger is the pane shrinking AND the content leaving, not the pane changing. |
| Letting the ruler grow spare columns around the cursor | It re-fitted the tick width on every move and slid every column out from under the pointer that had just clicked one. The axis is the experiment's. |
| Printing "4 warnings (3 in Problems)" | Two numbers with a parenthesis is still two numbers. One of them was not a ledger problem. |

### 2026-09-12 - Determinism made visible; Design and Simulate as partners

**Decided.** Design is the editor. Explore is an explicit, unrecorded probe with a single
clock-edge operation only for stateful circuits and Reset values. Recorded Design context is
entered only from an immutable recording, identifies scenario/run/tick, and offers return to
current authoring and the experiment. Test this design carries meaningful signal/instance context
to the active scenario without running it.

Simulate owns one Run: execute authored stimulus and evaluate any configured optional checks.
Zero checks produces a useful recording, never PASS. Rerun uses the current design and scenario;
Reproduce executes the retained design/stimulus/engine configuration and compares output digests.
The recording displays those three identities in short form with full values available. A changed
input is named. Identical repetitions are counted within the retained ledger; any divergence is
an alarm with the first differing signal/tick, not a silent new row. Engine identity is versioned
independently from presentation builds. External VCD evidence never claims internal execution.

The sequential primary instrument unifies authored stimulus, generated clock schedule, recorded
outputs, internal watches, cursor and optional checks. A detailed event editor is contextual.
Table remains the combinational default. One Details region owns signal/tick, checks, failures
and run details. Linked circuit inspection is a primary split with the same recording, cursor
and signal; its causal hops come from retained topology and actual samples and stop at missing
evidence. Current editable topology is never silently substituted for recorded topology.

Project's explorer owns Overview, Sources, Architecture, Runs and Compile Order. Only secondary
source objects earn Project tabs. The inspector follows the active object, not an unrelated
persistent selection. Runs groups repeated identities/digests without losing individual evidence.
The Problems dock owns the ledger; the global footer does not repeat a historical run verdict.

The shell sizes support regions and each region owns its scroll. At ordinary widths the primary
object stays dominant; at 1280px or enlarged text only one auxiliary panel is resident. Split
Design gives circuit and source the initial width, with panels explicitly recoverable. Explicit
dock choices persist per workspace; reset restores the defaults. The bottom dock rests collapsed.

**Rejected, and why:**

| Alternative | Why not |
|---|---|
| Edit / Live / Replay as peer modes | Authoring is Design's purpose; exploration is not recorded evidence and a recording must have an owner. |
| Observe versus Compare as permanent run intent | Optional checks are data on one experiment, not two executions a student must distinguish. Legacy trace recordings retain their original meaning. |
| Report hash alone, or a new row for every unexplained rerun | Neither exposes the three inputs nor proves repeated outputs. Output identity excludes timestamps, labels and display settings. |
| Timeline and Waveform as independent sequential destinations | They divide stimulus from its consequence; one experiment needs one time axis. |
| A new global investigation or simulation store | Project, hierarchy, scenarios, recordings and selection already own the facts; coordination is derived. *Superseded 2026-10-20 for the Meridian studio by a coordinate-only kernel; see "One Moment" below.* |
| Permanent library, inspector and bottom analysis deck beside Split | They take the room from the two objects the reader explicitly chose. |
| Five Project destinations in both explorer and tabs | Two owners ask the reader to choose which navigation is real. |
| Global Simulation failing while editing or mapping | A historical experiment's result is not the active workspace's status. |
| A narrated cause without recorded samples | Connectivity is evidence of a path, not proof of a state transition. |

### 2026-10-04 - The circuit is the product

**Decided (implemented locally; not yet accepted by the owner).** The presentation is organised
around building and understanding a circuit, not around how RedByte stores it. Engineering stays
on screen; implementation bookkeeping moves behind an explicit control.

Type. One rem scale owned by `theme/redbyte-type.css`: 15px ordinary text and commands, 14px
signal names and dense values, 13px secondary readouts, 12px ornament only, 16px prominent
labels, and 18 / 20 / 24px headings. Controls are 32px, toolbars 44px. These are design
targets, not an accessibility claim. No rule may force a size with `!important` to work around
the scale.

One drawing. Project's overview and the Start previews draw the project with the same symbols,
pin geometry and router as Design, read-only, in the student's own placement
(`components/SchematicProjection.tsx`). The block diagram remains as the explicitly chosen
Architecture / "Block view". The palette shows each part's schematic symbol.

Frame. One application bar (it owns Back / Forward and names the board without its part code),
one rail, one status line. A collapsed Problems panel is a handle in the status line and takes
no room of its own; the bottom panel is docked, not floating.

Simulate. The scenario's row carries its recording's state and the one primary Run; Reproduce
sits with the recording. Selection, edge stepping and playback share one instrument toolbar with
the event commands. Recorded output bits that name themselves as one word (LD1, LD0) are also
shown as a number, from recorded samples only: a tick with any member unrecorded has no value.
That word belongs to the recording. Its members, their order and their names come from the
recording's own captured signal roles and execution rows, and its values from that recording's
untranslated samples; the live design's current labels play no part, so renaming or removing an
output cannot change or remove an old recording's lane. Where the design has since renamed a
member the lane says "as recorded". The grouping is an unsigned display reading of numbered
output names, not a claim that they are a counter. The recorded circuit opens on the symbols the
selected signal touches, at a working scale, with the whole circuit one press away.

Design. Schematic labels are 12.5 drawing units for names and values and 10.5 for pins, and a
boundary symbol is as wide as its name needs. The inspector opens on the selection's name, value
control, mapping and tracing actions; Details, Connectivity and Related are named sections that
open on request.

Board. The illustration is drawn on the schematic's plane in the schematic's ink. Assigned,
selected, compatible, conflicting and unavailable each have one look; logic-high is shown only
by the LED or switch itself and only from a recording. No glow. A selected signal states its
assignment in words (signal, resource, pin); the saved-constraint chain and its XDC are exact,
unchanged and one named disclosure away.

Package. The landing is the handoff: the package, its truthful state, one action, the external
Vivado step stated once, and the package's contents by role. No file is selected on arrival and
no source is mounted unasked. Choosing a file - here, from the report, or by any artifact
selection - opens exactly that file with copy and download, and "Back to contents" closes it.
Bytes, hashes and integrity checks are unchanged.

| Superseded | Why |
|---|---|
| 13px ordinary text with 11-12px used for most labels | The product's real reading size was 12px. |
| A block-diagram stand-in on Project and Start | It was not recognisably the student's drawing. |
| A blanket `!important` control size in Design | It hid the scale problem and made Design's buttons disagree with every other workspace. |
| A status line under a second, empty Problems strip | Two strips described one panel. |
| Run and Reproduce as adjacent equal buttons | They read as two ways to execute the same thing. |
| One green glow for assigned, selected and logic-high | Three meanings shared one signal. |
| A recording's word lane grouped by the live design's labels | A later rename removed the lane from a recording that still held the samples. |
| A file's source open on arrival at Package | It made a handoff read as a code editor. |
| The problem code as the first word of Project's attention line | The sentence a student needs is what is wrong; the code identifies it in Problems. |

Not changed: project, runtime, recording, selection, navigation, mapping and export authorities;
generated artifacts and goldens; the supported-construct boundary; the stage names
"Board & Constraints" and "Build & Export" in product language. Open at the time: with the
inspector open on a 1366px window Design's schematic names rendered near 11px, below the 14px
aim. The 2026-10-05 record below closes it.

### 2026-10-05 - A stable working view

Local, uncommitted, not visually accepted by the owner.

The working view is the student's. The Design camera is changed by the student and by Fit, and
by nothing else:

- A resized sheet is never rescaled. Selecting a part opens the inspector and narrows the
  sheet; the zoom stays, and the view slides only as far as it must to keep the selected part
  on the sheet. A part just placed and then released follows the same rule. A framed view
  nobody has touched stays centred, at its zoom, as panes open and close.
- The view is remembered per project and per module for the session, and restored on returning
  from another workspace, on reopening a project from the saved list, and on going into and out
  of a module definition. Save As keeps the student where they are; from then on the copy and
  the original keep separate views. Work not yet looked at is framed once. The memory is view
  state: it is not saved with the project and a reload starts fresh.
- Recorded-circuit viewing in Simulate keeps its own framing and is not part of this.

One composition for Design, with or without the inspector:

- The library is compact and labeled - symbol and name on one row at 208px - and keeps that
  form through selection, wiring and inspection. It does not collapse to icons. Widening it is
  the student's explicit, remembered choice. A long name takes two lines; none is cut off.
- Under the list, a strip of fixed height names the part in focus and its ports. It follows
  keyboard focus and the pointer, replaces the tooltip as the way to read a part's interface,
  and does not move the list.
- Fit, Selection and zoom are on the sheet, in its lower left corner, in one group. They are
  always visible, they do not move when the inspector opens, and they are not in the toolbar.
- The command row is one row of one height. A status chip takes only the room the commands
  leave and gives way before they do. Exploring has a strip of its own, as wiring does, so the
  height changes when the student changes mode and not when they select something.
- For one selected part the inspector reads in the order of use, in the markup as on screen:
  value, then net tracing, then editing. Details, Connectivity, Evidence and Related are closed
  until opened; their content is hidden, not merely collapsed, and each opens from the keyboard.

Names. An instruction to go to a workspace uses the name on the rail: "Open Board",
"Continue to Package". The long stage labels remain the formal titles (the mapping document's
heading inside Board, the command palette, the shortcut list, the public start page) and remain
the stage authority in `workflowStages.ts`. Package's state for a design whose current run
passes and whose package has not been generated reads "the current simulation passes its
checks"; it says nothing of Vivado or a board.

Project's explorer keeps Compile Order and the generated files in one group, "Technical files",
closed until opened and found by the filter. Nothing was removed.

| Superseded | Why |
|---|---|
| Refitting the whole circuit whenever the sheet changed size while the view was still the fitted one | Selecting a part is such a change: names went from 16px to 11px at the moment a student looked closely. |
| Framing the whole circuit on every entry to Design | It discarded a deliberate zoom on each return from Simulate. |
| Fit and zoom in the toolbar, folding into the View menu as the bar narrowed | They were the first things hidden when a pane opened, and they made the row wrap. |
| A 248px library whose port summary was a mouse tooltip | A keyboard could not read a part's interface. |
| Edit commands ahead of tracing in the inspector | The value a student sets and the trace that explains it are used first. |
| "Continue to Build & Export", "Open Board & Constraints" in running copy | The rail calls the workspaces Board and Package. |
| "Package not built yet - evidence validated" | It named no state a student could check. |
| Compile Order among the Project documents, Generated Files as its own group | Both are for inspecting the build. |

### 2026-10-05 - Milestone 4: see the behavior, find the mistake

Local, uncommitted candidate; production verification and exact identity are recorded in
`docs/ACTIVE_WORK.md`. Owner visual acceptance remains open.

Simulate composes one experiment header, one primary Table/Time instrument, and one selected
result. The selected result names the exact case/tick/signal, retained expected/observed values,
recorded inputs and one failure navigator. History and Reproduce are secondary recording
actions. Opening the recorded circuit preserves the instrument and selected context. Missing
samples are missing; observations without checks are not passing tests. A draft check edit and
an editable Design handoff are separate actions and leave old recordings immutable.

The circuit is inspectable through retained topology, names and actual sampled gate pins.
Highlighted upstream connectivity indicates where to inspect, not a root cause. Supported local
logic is explicitly derived; sequential prior/current state and sampled clock edges are shown
only when retained samples support them. Whole-circuit and module-instance access remain
ordinary controls. Shared primitive label placement avoids local wire collisions without
changing connections, saved positions, junctions or the Design camera. Successful routine
wiring is evident on the canvas; duplicate celebration/action toasts are retired. Escape
cancels a transient operation first and otherwise clears ordinary selection while preserving
explicitly pinned investigation state.

Save As asks for a validated noncolliding friendly name. Cancel and failed saves leave the
original work open; pending saves cannot submit twice. Identity changes only after the existing
repository transaction succeeds. The independent copy retains scenarios and recordings under
the existing session-copy contract. Friendly names do not rename HDL entities, ports or XDC
constraints. The current Simulate session view is copied to the new independent preference scope.

The canonical workspace names are **Project, Design, Simulate, Board, Package** in navigation,
titles, command palette, shortcuts and help. `workflowStages.ts` owns these labels. Stable route
IDs remain `project/design/verify/hardware/export`; engineering references to constraints and
export remain valid. This explicitly supersedes the earlier short-name/formal-title distinction.

### 2026-10-20 - One Moment: a coordinate kernel for the Meridian studio

**Decided by the owner's approval of the Meridian architecture plan; implemented locally as a
flag-gated P1 slice (`/os/?studio=meridian`); owner visual acceptance remains open.**

This supersedes, for the studio, the rejected alternative "A new global investigation or
simulation store". The reason for that rejection still holds: project, hierarchy, scenarios,
recordings and selection own the facts. What changed is that coordination is no longer derived
separately by each surface.

**What the kernel holds.** `packages/rb-studio-kernel` holds **coordinates, never facts**:
- the selected object (`ObjectRef`, lossless against `EngineeringObjectRef` and
  `JourneySelection`);
- the inspection anchor;
- hover;
- the focused lens;
- one Moment: `null` in Edit, live in Explore, or recorded `{runId, tick, published|event, eventOrder}`.

**What it does not hold.** It holds no circuit, recording, scenario or mapping. It never writes
the project, and adds no persisted state. The sheet camera stays session-only.

**Kept unchanged.** "Edit / Live / Replay as peer modes" remains rejected. Live and recorded are
attributes of the Moment, not modes. Design still explores and Simulate still records.

**Recorded values on the live sheet.** They paint only while the current design digest
(computed exactly as `buildRunIdentity` computes it) equals the recording's design identity; a
recording without an identity never paints. PASS/FAIL currency stays with the workbench's run
scope (`deriveRunScope` with the run ledger and current project hash). After an undo, values may
repaint with a chip: "recorded on this design · rerun to count as evidence".

**Runs follow the workbench's rules.** A studio Run carries the same live schedule contract as a
workbench Run, and a Design issue that blocks checked runs in the workbench turns checks off in
the studio too; the Run still records. A link to an example never replaces a working session
without asking.

**Scope.** The classic workbench is unchanged and keeps its own owners until a later phase
migrates it with written deletion deadlines. IdeApp code moved verbatim into shared modules: `buildCurrentVerifyReplayHash` and its helpers (`verifyReplayHash.ts`, re-exported by IdeApp) and three private export-project helpers (`ideExportProject.ts`), so the studio can build the same Run
request and export project (RB-DEBT-026, deadline P4). The
design authority is `docs/ide/studio/MERIDIAN_DESIGN_SYSTEM.md`.

### 2026-10-30 - The circuit gets the room, and selecting moves nothing

Owner direction for PR #88; not yet visually accepted. RedByte gives the space to what the
student is doing: while designing, the circuit has the most room; while inspecting, the
inspector stays readable without taking the workspace. Selecting a part must not shift the
canvas or make controls overlap. A classroom gate is not lowered to pass; the product meets it.

Space, with the library and the inspector both open:

- The sheet keeps at least 60% of the window, the classroom gates' measure. The inspector takes
  what is left up to 256px and never less than 240px: 1366x768 gives a 250px inspector and an
  828px sheet, 1440x900 256px and 896px, 1920x1080 256px and 1376px.
- The rail is 64px and keeps its icons and 13px labels. The library keeps 208px. The sheet's
  side gutters are 8px at desktop widths.
- The status line is 28px. Two lines of the Wire cue still fit in it (set at about 12.4px at
  100% text, port names at the cue's own size), so a cue or a refusal never changes its height.
- Inspector labels and values wrap rather than being cut, and the inspector's term column grows
  with enlarged text.

The camera, by kind of change:

- A view switch (Schematic, Split, Code) keeps the world point in the middle of the sheet in the
  middle of the new sheet, at the student's zoom. An untouched frame is framed again for the new
  sheet. This is the 2026-07-14 rule, kept for view switches.
- A panel opening or closing beside the sheet moves nothing on the screen: the inspector opening
  with a selection, or the library shown or hidden (the camera takes up the sheet's moved edge).
  A part is slid back on only when the resize itself would hide it, and by the least amount.
- The inspector never moves a framed view nobody has touched, opening or closing.

| Superseded | Why |
|---|---|
| Every real resize, the library and inspector included, keeping the world point at the middle of the sheet (2026-07-14) | With the inspector beside the sheet it slid every part half the inspector's width whenever a part was selected. |
| Keeping a selected part's 72px neighbourhood on the sheet on every resize | It nudged a part that was fully visible and covered by nothing. |
| Re-centring an untouched frame when the inspector closed | Each select and release walked the drawing right by half the inspector. |
| An 80px rail, a 280px inspector and a 32px status line at laptop widths | They left the sheet 766px at 1366x768, under the classroom gates' 820px. |
| Inspector labels cut with an ellipsis at a fixed 96px | Long part names and "Board resource" could not be read with enlarged text. |

## Attribution

Connor Angiel
