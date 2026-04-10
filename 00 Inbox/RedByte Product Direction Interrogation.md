---
type: inbox
status: needs-review
created: 2026-04-10
---

# RedByte Product Direction Interrogation

> This document exists because RedByte has been getting incrementally better without knowing what it's trying to *be*. Every answer here unlocks weeks of aligned implementation, or avoids weeks of wasted implementation. Answer each decision explicitly. Defer only if genuinely blocked — the cost of ambiguity is concrete.

---

## Section 1 — Overall Diagnosis

### What RedByte is right now (observed, not aspirational)

RedByte is a browser-based FPGA educational IDE built around a five-stage workflow: **Design → Verify → Map Pins → Export → Program**. It has:

- A circuit canvas (gates, I/O nodes, wire drawing)
- A verify engine (waveform stimulus, observe-first or compare runs, analysis drawer)
- Pin mapping (Basys3 board I/O assignment)
- A Vivado export pipeline (ZIP bundle with constraints)
- A hardware deployment tab (diff-based assertion checker for physical board)

### What it does not yet know about itself

1. **Who is it for?** — A single student working alone? A classroom of 30? A TA grading? All three require different contracts.
2. **What is the educational moment?** — Is it: "understand logic gates"? "debug your circuit"? "experience the FPGA flow"? "produce a deliverable for a class"?
3. **What is the completion condition?** — Is the app *done* when the student programs the board? Downloads the ZIP? Gets verify to pass? Something else?
4. **What does "trust" mean?** — The verify/export trust signal system is elaborate but its consumer (the student) has no context for what "CHECKS DIFFER" implies about their circuit.
5. **What surfaces should exist?** — Is Hardware a permanent surface or a post-export diagnostic? Is Import primarily for teachers or students?

### Risk level without answers

- **High**: Every future design decision implicitly answers some of these questions inconsistently with prior decisions.
- **Critical**: The five-stage spine is treated as foundational but has never been validated against an actual classroom workflow.

---

## Section 2 — Product Pillars (Explicit Decisions Needed)

These are the load-bearing product bets. Each one has current implicit behavior, but it has never been *declared*.

| # | Pillar | Current implicit bet | Risk if wrong |
|---|--------|---------------------|---------------|
| P1 | Student solo vs. classroom-aware | Solo — no teacher mode, no submission | No TA integration, no grading path |
| P2 | Hardware is required | Program stage always in spine | Students without a Basys3 board have no completion path |
| P3 | Verify is educational, not just correctness | Observe-first, waveform prominence | Students may just click "pass" without understanding |
| P4 | Export is trust-gated | Verify must pass before export is "green" | Unverified exports reach hardware |
| P5 | Design is the primary surface | Most session time spent in Design | If verify is where learning happens, design is just scaffolding |
| P6 | All five stages are sequential | Pipeline strip implies linear progression | Students may skip Verify entirely, may not own hardware |

---

## Section 3 — Surface Question Banks

### 3.1 — Project Surface

**Q1: What is the Project Surface for?**
- Why: Currently has a hero CTA, three launchpad cards (Mapping/Verify/Export), and a completion milestone count. This makes it feel like a dashboard. But is it a launching pad, a progress report, or a course syllabus?
- Current evidence: `ProjectSurface.tsx` renders a hero CTA (`choosePrimaryProjectCta`) and a dock stage item list. The CTA advances the student to their next incomplete stage.
- Options: (A) Launcher — shows progress, CTA gets you moving. (B) Grade sheet — shows completion criteria per stage. (C) Context hub — shows aggregate state (last run, last build). (D) Home screen — minimal, just opens the last-worked-on surface.
- **Decide: What is the Project Surface's one job?**

**Q2: Should the Project Surface ever be the default landing screen?**
- Why: Currently it's shown when `ideMode === 'project'`. New users land here. Returning users land here. Is that right for returning users?
- Options: (A) Always land on Project (current). (B) Reopen last surface. (C) Land on Design always. (D) Land based on completion state.
- **Decide: Where does a returning user land?**

**Q3: Does the "completedMilestoneCount" belong on this surface?**
- Why: It's currently shown as a progress count. But milestones in an educational tool have strong implicit meaning ("graded"). If it's not graded, does counting it add or subtract meaning?
- Options: (A) Keep as progress indicator. (B) Replace with stage completion checklist. (C) Remove entirely.
- **Decide: Is milestone counting meaningful for a student?**

**Q4: When does the project surface become useful vs. when is it noise?**
- Why: On first launch (empty circuit), the Project Surface is the right entry point. On a project with a passing verify run and an export built, it may just be redundant.
- Options: (A) Static regardless of state. (B) Adaptive — shows different content at different stages. (C) Remove/collapse for advanced users.
- **Decide: Does the Project Surface adapt to project maturity?**

**Q5: What are the three launchpad cards: Mapping, Verify, Export?**
- Why: These three specific cards are pinned in the dock. But the spine is 5 stages (Design→Verify→Map Pins→Export→Program). Why not Design and Program?
- Options: (A) Keep as-is (the three "proof" stages). (B) Show all 5 stages. (C) Show only the current stage and next.
- **Decide: Which stages get launchpad cards and why?**

**Q6: Should Import exist as a dedicated surface at all?**
- Why: Import is currently a surface in the workflow. But it's only useful for loading a prior project or teacher-provided template. Is that a workflow step or a utility?
- Options: (A) Keep as surface. (B) Demote to a modal/dialog. (C) Put under File menu concept. (D) Remove entirely.
- **Decide: Import — surface or utility?**

**Q7: What happens when a student has multiple projects?**
- Why: Currently the app assumes a single active project. The import/export model exists but there's no project switcher. Is multi-project in scope?
- Options: (A) Single project, always. (B) Recent projects list on home. (C) Full project management.
- **Decide: Is multi-project in scope for this release cycle?**

**Q8: Does the Project Surface own "start over"?**
- Why: There's no clearly located "clear all" or "start new project" CTA. This matters enormously for classroom use (TA-led resets, student restarts).
- Options: (A) Project Surface owns this. (B) File-level concept (outside surface). (C) Not in scope.
- **Decide: Where does "start over" live?**

---

### 3.2 — Design Surface

**Q1: Is the Design Surface the primary surface or a prerequisite?**
- Why: The spine puts Design first, which implies it's the primary surface. But verify and hardware are where the student sees whether their work is right. Design may be "just scaffolding."
- Options: (A) Design is the primary surface (most time spent here). (B) Design is a step, Verify is the primary. (C) Design and Verify are co-primary. (D) It depends on the student's phase.
- **Decide: What is Design's role in the student's experience?**

**Q2: What is the teaching model for the canvas?**
- Why: Currently the canvas supports drag-and-drop gates, wire drawing, and inspection. That's a creation tool. But does it teach anything? Could it also have guided/constrained modes (e.g., "connect these specific gates to make a half-adder")?
- Options: (A) Free creation tool only. (B) Constrained guided mode (scaffolded). (C) Both, switchable by teacher.
- **Decide: Is Design a free tool or a teaching scaffold?**

**Q3: What is the minimum viable blank state?**
- Why: Currently blank state = empty canvas with a first-run hint. Should blank state instead show a starter circuit, a prompt ("What circuit do you want to build?"), or something else?
- Options: (A) Empty canvas + hint (current). (B) Starter circuit template. (C) Guided first step.
- **Decide: What does blank-state Design show a new student?**

**Q4: What is the inspector for?**
- Why: The inspector has deep state-time and run-time sections, diagnostics, connections, input controls, gate swap, and waveform context. This is a power-user tool. Does a student in their first FPGA class need all of this?
- Options: (A) Inspector is for power users, always full. (B) Inspector is progressive: basic by default, advanced mode toggle. (C) Inspector is removed; diagnostics go to a separate panel.
- **Decide: What is the inspector's audience and scope?**

**Q5: What is the gate palette for?**
- Why: Currently the palette is a fixed list of supported gates. The question is whether the palette should be contextually filtered (show only relevant gates for the current exercise), curated per complexity level, or always full.
- Options: (A) Always full (current). (B) Level-gated (teacher controls availability). (C) Contextually filtered.
- **Decide: Is the gate palette fixed or configurable?**

**Q6: When is the circuit "done" in Design?**
- Why: `deriveStageCompletion()` says Design is done when `hasCircuit` is true. That's one node + one wire. Is that the right definition?
- Options: (A) Current: hasCircuit = any non-empty circuit. (B) Has at least one I/O node. (C) Has no blocking diagnostics. (D) Teacher-defined completion.
- **Decide: What is the Design done condition?**

**Q7: What is undo's scope?**
- Why: Undo is implemented with RAF-batched drag commits. But what is the undo history size? Does it persist across page refresh? Does it span surface transitions?
- Options: (A) Session undo, limited depth. (B) Persist undo across refresh. (C) Per-surface undo.
- **Decide: What is the undo contract?**

**Q8: What happens to the circuit when you run Verify and fail?**
- Why: A failed verify run produces failure evidence. The student is meant to go back to Design and fix it. But the circuit isn't locked, and the failure evidence disappears once they start editing. Is that right?
- Options: (A) Evidence stays until a new run (current implicit). (B) Evidence persists across design edits with a "stale" marker. (C) Evidence drives inline annotations on the canvas.
- **Decide: Does verify failure evidence persist into Design?**

---

### 3.3 — Verify Surface

**Q1: What is the primary educational goal of Verify?**
- Why: Verify has a waveform, a stimulus editor, a truth table, a k-map, and an analysis drawer. That's a lot. What is the *one* thing a student is supposed to understand after using Verify?
- Options: (A) "My circuit is correct / incorrect." (B) "This is what my circuit actually does on each tick." (C) "I can predict circuit behavior before testing hardware." (D) "I can express what I expect and check it."
- **Decide: What is the one educational moment Verify delivers?**

**Q2: Is "Observe" mode going to be the default indefinitely, or is it a scaffold?**
- Why: ADR-004 and the stimulus-first model default to Observe. But Observe produces no correctness claims. The question is whether students will spontaneously evolve to Compare mode, or whether they need to be guided.
- Options: (A) Observe is permanent default; Compare is opt-in for advanced users. (B) Observe is a scaffold; tutorial/prompt nudges students toward Compare. (C) Remove the distinction; auto-detect when expected values exist.
- **Decide: Is the Observe/Compare distinction user-facing or implementation-only?**

**Q3: What does the waveform communicate to a student?**
- Why: The waveform is prominent (takes most of the workspace). But a student in an intro class may not know what a waveform is. Is the waveform screen meant to be understood at a glance, or does it require training?
- Options: (A) Self-explanatory — visualization is the goal. (B) Requires tutorial context. (C) Waveform is secondary; summary is primary.
- **Decide: Is the waveform the primary result visualization or supplementary?**

**Q4: Should Verify have a "sequential" mode that is visible and distinct?**
- Why: Sequential circuits are currently detected automatically and change Verify behavior (clock helper, different tab visibility). But the UI doesn't announce "you're in sequential mode" prominently.
- Options: (A) Auto-detect only, no visible mode label. (B) Prominent "Sequential mode" badge in header. (C) Sequential Verify is a separate surface entry.
- **Decide: Is sequential/combinational mode a visible product concept or internal?**

**Q5: What is the analysis drawer's audience?**
- Why: The analysis drawer (now 3 tabs: Inspect, Checks, Details) contains truth tables, K-maps, and mismatch data. That's advanced content. How many students will use it?
- Options: (A) Drawer is for advanced/optional use; default is waveform only. (B) Drawer is the primary diagnostic interface. (C) Drawer is for TAs/graders only.
- **Decide: Who is the analysis drawer for?**

**Q6: What does "pass" mean?**
- Why: Currently `status: 'pass'` means all assertion checks passed. But in Compare mode with all-pass, does the student understand *why* it passed, or just that it did?
- Options: (A) Pass = correctness stamp, no narrative needed. (B) Pass = opens explanation ("Here's why your circuit worked"). (C) Pass = unlocks export (gate model).
- **Decide: What does "pass" unlock or explain?**

**Q7: Should the verify run button be gated on anything?**
- Why: Currently Run is always available (even with empty vectors). Empty-vector runs in Observe mode produce trivially "correct" observations.
- Options: (A) Run is always available. (B) Run requires at least one vector. (C) Run in Observe mode is always available; Run in Compare mode requires expected outputs.
- **Decide: What are the Run button's preconditions?**

**Q8: Where does the student go after a failing run?**
- Why: The failure evidence is in the drawer and waveform. But the fix is in the Design surface. The link between "my ld0 was wrong at tick 2" and "I need to change this gate" is enormous for a beginner student.
- Options: (A) Student figures out the fix themselves. (B) Verify surface has a "Fix in Design" CTA with signal context (partial: exists now via tick chip). (C) Automated suggestion: "This output is never driven; check this gate."
- **Decide: Does Verify help students navigate back to Design, or do they navigate independently?**

**Q9: Should expected outputs be authored in Verify, in a separate Vectors editor, or both?**
- Why: Currently expected outputs are authored directly in the stimulus canvas. There's also an "Open Project Vectors" path. The student experience of "editing expected values" is split.
- Options: (A) Stimulus canvas only (current). (B) Dedicated vectors editor only. (C) Stimulus canvas primary, vectors editor for bulk.
- **Decide: Where is the canonical expected-output authoring surface?**

---

### 3.4 — Hardware / Map Pins Surface

**Q1: What is "Map Pins" for?**
- Why: Map Pins is currently the third stage in the spine. It assigns board I/O to circuit signals. But in a typical classroom, the TA or teacher pre-assigns pin mappings; students don't touch them. Is this a student task or a teacher task?
- Options: (A) Student task — students learn about FPGA pin assignment. (B) Teacher task — teacher assigns, students just verify. (C) Template-based — import provides pre-mapped pins; student confirms.
- **Decide: Is pin mapping a student learning objective or admin overhead?**

**Q2: What is the "CHECKS MATCH / CHECKS DIFFER" banner for?**
- Why: Hardware surface shows a diff between expected assertions and live board state. This implies the student has the Basys3 connected. Is this a debugging tool, a verification checkpoint, or a celebration moment?
- Options: (A) Debugging tool (find which outputs differ). (B) Completion condition (must match to proceed). (C) Informational only.
- **Decide: What is the CHECKS banner's product purpose?**

**Q3: Should Hardware Surface exist if the student has no Basys3?**
- Why: The Hardware surface is a physical-board tool. Students without a board have a dead surface. Is there a simulation path (emulated board)?
- Options: (A) Hardware is hardware-only; blocked/dimmed without board context. (B) Hardware has a simulation mode. (C) Hardware is gated — only shown when export is built.
- **Decide: Is Hardware surface accessible without a physical board?**

**Q4: Is "Map Pins" done when any pins are mapped, or all relevant pins?**
- Why: `deriveStageCompletion()` uses `hasIoMapping`. What is the definition of "mapped"? One pin? All circuit I/O? All board-relevant I/O?
- Options: (A) hasIoMapping = at least one mapping (current). (B) All circuit I/O signals are mapped. (C) Teacher-defined required mappings.
- **Decide: What is the Map Pins done condition?**

**Q5: Should the Hardware surface show the exported bitstream state?**
- Why: Currently Hardware shows assertions. It does not clearly indicate whether the current bitstream on the board matches the circuit in the editor.
- Options: (A) Hardware is assertions-only. (B) Hardware shows build hash + match status. (C) Hardware shows full deployment chain state.
- **Decide: Does Hardware communicate bitstream currency?**

---

### 3.5 — Export Surface

**Q1: What does a student think they're doing when they click Export?**
- Why: The export pipeline builds a Vivado XPR ZIP. A student in intro FPGA likely has no concept of a Vivado project. What should the Export surface communicate?
- Options: (A) Technical: "Build your bitstream project." (B) Simplified: "Get your files for programming." (C) Abstract: "Lock in your design for the board."
- **Decide: What narrative does Export communicate to a first-year student?**

**Q2: Should Export be gated on Verify passing?**
- Why: Currently the trust signal is three-state (Verified/Needs Review/Blocked). A student can export an unverified circuit. Is that educationally acceptable?
- Options: (A) Export is always available — trust signal is informational. (B) Export requires verify pass (hard gate). (C) Export allows unverified with a friction confirmation.
- **Decide: Is the verify gate on export hard, soft, or informational?**

**Q3: What is the "Download ZIP" action?**
- Why: The ZIP contains a Vivado project. Not a bitstream. The student still needs Vivado to open it. Does the student understand this?
- Options: (A) Download ZIP as-is; student responsibility to know toolchain. (B) ZIP README is the tutorial. (C) Integrated Vivado launch (out of scope?).
- **Decide: What is the intended ZIP recipient persona?**

**Q4: Should the Export surface show historical exports?**
- Why: Currently Export shows the current build. There's no history. If a student rebuilds after a failing change, there's no way back.
- Options: (A) Current build only. (B) Last N builds with timestamps. (C) Build history is out of scope.
- **Decide: Is export history in scope?**

**Q5: What does "Build Details" (formerly Evidence Snapshot) show and why?**
- Why: Build details shows hashes, timestamps, and tool versions. Is that for the student, the TA, or nobody?
- Options: (A) For students (learning about reproducibility). (B) For TAs (verification audit trail). (C) Remove entirely.
- **Decide: Who is "Build Details" for?**

---

### 3.6 — Import Surface

**Q1: Who uses Import and why?**
- Why: Import is in the workflow spine. But what are the real use cases? Student opening their own saved project? Teacher distributing a template? Student importing a classmate's work?
- Options: (A) Student loads their own prior work. (B) Teacher distributes starting templates. (C) Both, with different flows.
- **Decide: What are the canonical import personas?**

**Q2: Should Import be a named surface or an action?**
- Why: Import is currently listed as a stage in the workflow. But it doesn't have a "completion state" the way Design or Verify does. It's an action: you import something and immediately move to another surface.
- Options: (A) Keep as surface (navigation target). (B) Demote to File > Open or modal. (C) Remove from spine entirely.
- **Decide: Import surface vs. import action?**

**Q3: What formats should Import support?**
- Why: Currently Import presumably handles `.rbp` or similar RedByte project format. Should it also import VHDL? External truth tables? Teacher-created exercise templates?
- Options: (A) RedByte project format only. (B) Add truth table CSV import. (C) Add VHDL/Verilog import. (D) Add teacher template format.
- **Decide: What is the import format roadmap?**

---

## Section 4 — Cross-Surface / Global System Questions

**Q1: What is the left rail's job?**
- Why: The left rail shows 5 stage icons. Is it a nav menu, a progress tracker, or both? Currently activating a stage navigates AND changes mode. That conflates navigation with workflow.
- Options: (A) Navigation only — stages are sections. (B) Workflow only — clicking is "moving to next step." (C) Both — nav + progress indicators.
- **Decide: Is the left rail navigation or workflow?**

**Q2: What is the status vocabulary?**
- Why: Across surfaces, the app uses: PASS / FAIL / VERIFIED / NEEDS REVIEW / CHECKS MATCH / CHECKS DIFFER / READY / BLOCKED / IN PROGRESS / COMPLETE. There are 10+ status concepts. Have they been unified into a coherent system?
- Options: (A) Each surface uses its own vocabulary (current implicit). (B) Three global states: done / in-progress / blocked. (C) Full status taxonomy with formal definitions.
- **Decide: Is there a global status vocabulary?**

**Q3: What is the pipeline strip for?**
- Why: The pipeline strip at the top shows all 5 stages with completion icons. Who reads it? When?
- Options: (A) Student orientation (where am I?). (B) TA grading view. (C) Progress celebration. (D) Remove — left rail redundantly covers this.
- **Decide: Is the pipeline strip redundant with the left rail?**

**Q4: What triggers a "stale" state?**
- Why: Stale states exist in Verify (circuit changed after last run) and Export (export doesn't reflect current circuit). But there's no global staleness model. If a student changes their circuit, which indicators update?
- Options: (A) Each surface independently tracks staleness (current). (B) Global staleness — circuit change invalidates all downstream results. (C) No staleness — student bears responsibility.
- **Decide: Is staleness tracked globally or per-surface?**

**Q5: What is the focus / attention model?**
- Why: Currently, clicking a node in Verify can navigate to Design. Clicking "Go to Map Pins" can navigate from Verify. The question is whether cross-surface navigation preserves context (selected node, tick, etc.) or resets it.
- Options: (A) Navigation always resets to default state. (B) Navigation preserves context cues (current: tick chip in VCB). (C) Navigation passes full context packet.
- **Decide: What context is preserved on cross-surface navigation?**

**Q6: Does the app have a "mode" model at all?**
- Why: `ideMode` is the top-level piece of state. The app has 7 modes: `project | design | verify | hardware | export | import | program`. These feel like routes, not modes. Is IdeMode actually a route?
- Options: (A) Modes are routes — treat them as such (history, deep-linking). (B) Modes are states — no URL, no browser history. (C) Hybrid — retain current model.
- **Decide: Are modes routes or states?**

---

## Section 5 — Deep Technical / Product Questions

**Q1: Should RedByte support clocked circuits as a first-class path?**
- Why: Sequential circuits (DFlipFlop, DLatch, etc.) are supported today but are a secondary path. Clock management (hold-low, hold-high, pulse presets) is in the UI. But is "learning sequential logic" a stated learning objective of the course this tool is for?
- Options: (A) Sequential is first-class — full support, full teaching narrative. (B) Sequential is advanced — supported but not prominently surfaced. (C) Sequential is out of scope for V1.
- **Decide: Is sequential logic a core learning objective?**

**Q2: What is the testbench model?**
- Why: The current testbench is a vector table (tick, inputs, expected outputs). This is a simple model. FPGA engineers use SystemVerilog testbenches with self-checking. Is the vector table model sufficient for the educational goals?
- Options: (A) Vector table is the model — keep it. (B) Vector table is a stepping stone — eventually graduate to code-based testbenches. (C) Testbench is not the right mental model — reframe as "experiments."
- **Decide: Is the vector table the permanent testbench model?**

**Q3: What is the pin mapping data model?**
- Why: `basesToAssertions.ts` and the mapping constraint system translate circuit I/O to Basys3 GPIO. But the student never understands what a constraint file is, why the pins are named JA1 etc., or what happens when they remap a pin after building.
- Options: (A) Mapping is abstracted — student never sees raw pin names. (B) Mapping teaches pin names — student sees JA1/JA2 as part of learning. (C) Teacher pre-configures mapping, student confirms but doesn't author.
- **Decide: What is the mapping abstraction level for students?**

**Q4: What is the export trust signal's consumer?**
- Why: The three-state export trust (Verified/Needs Review/Blocked) is elaborate. But who acts on it? If the student doesn't understand what "Needs Review" means for their circuit, the signal is noise.
- Options: (A) Trust signal is for students — simplify to pass/warn/block with plain English explanations. (B) Trust signal is for TAs — keep technical. (C) Trust signal is for nobody — remove and gate export at verify boundary.
- **Decide: Who is the export trust signal's audience?**

**Q5: Does RedByte need a "program" surface?**
- Why: The spine ends with Program. But "programming" a Basys3 with a bitstream requires Vivado and a USB cable. The app can't drive Vivado directly. What does the "Program" stage actually do?
- Options: (A) Program = instructions + the ZIP download re-exposed. (B) Program = future Vivado integration hook. (C) Program = removed from the spine.
- **Decide: Is "Program" a surface or an external handoff?**

**Q6: What is the verification engine's fault model?**
- Why: A verify failure tells the student *what* is wrong (signal X at tick N has expected Y, got Z) but not *why* (which gate is responsible). Closing the gap between "output is wrong" and "this gate is wrong" is the hardest part of debugging for beginners.
- Options: (A) Fault model is out of scope — student figures out the gate. (B) Rudimentary: highlight candidate gates based on signal tracing. (C) Full fault localization: pinpoint which gates could cause the failure.
- **Decide: Does the verify engine explain causation or just correlation?**

**Q7: Is RedByte multi-user or single-user?**
- Why: Currently all state is local (single browser tab, no accounts, no sharing). Is multi-user (classroom, collaboration, grading) a future direction?
- Options: (A) Single-user for V1, multi-user TBD. (B) Multi-user classroom model is a stated roadmap item. (C) Single-user forever — use LMS for submissions.
- **Decide: Is multi-user in the product roadmap?**

---

## Section 6 — Kill / Keep / Reconsider

For each item: **action** + **one-line rationale**.

### Kill (stop building this unless there's an explicit argument to keep it)

| # | Feature | Kill rationale |
|---|---------|---------------|
| K1 | Advanced Details IR escape hatch in inspector | Already removed in B-10 — confirm it stays gone |
| K2 | `ide-verify-incomplete-mapping-banner` when mappingComplete=false | If mapping is a separate stage, Verify should block, not banner |
| K3 | `ide-verify-stale-reference-mode` compact strip | "Reference mode" is internal language; students don't know what a reference mode is |
| K4 | `ide-verify-set-oracle` (Save Expected) in old position | Retired in B-14 Slice 2 — confirm still dead |
| K5 | Multiple-status banners in Verify (scenario-stale, wrong-scenario, stale) | All consolidated into primaryStatus — confirm old testids are fully dead |
| K6 | K-Map tab as a standalone named tab | Retired in drawer consolidation — now inside Details |
| K7 | Truth Table as a standalone named tab | Same as above |
| K8 | Vectors as a standalone named tab | Same as above |
| K9 | Program surface as currently designed | It's a dead end — handoff instructions don't need a surface |
| K10 | Import as a spine stage | An action, not a stage; should be a modal |

### Keep (explicitly protected — do not consolidate or remove)

| # | Feature | Keep rationale |
|---|---------|----------------|
| Kp1 | Observe-first default (ADR-004) | Core to the pedagogical stance — don't gate knowledge extraction behind expected-value authoring |
| Kp2 | `ide-verify-drawer-toggle` pattern | Drawing attention to analysis is correct — don't auto-open or always-show |
| Kp3 | Tick chip in VerifyCommandBar (`ide-vcb-design-tick-chip`) | The only bridge from observed behavior back to circuit causation |
| Kp4 | Sequential helper callout (clock presets) | Sequential circuits need scaffolding; don't auto-generate clock patterns invisibly |
| Kp5 | SurfaceCommandStrip grammar across Hardware/Export/Import | Consistent stage identity — don't let these stages diverge into different patterns |
| Kp6 | `deriveStageCompletion()` as single source of truth | All three nav systems depend on it — do not re-derive stage completion elsewhere |
| Kp7 | VerifyMode type (`combinational / sequential / blocked`) | Clean gate for mode-specific behavior — don't revert to scattered `hasDff` checks |
| Kp8 | Connection shape (nested `{ from: { nodeId, portName }, to: { nodeId, portName } }`) | Foundational contract — flat shape causes normalizer throws |
| Kp9 | IR diagnostic system (IR001-IR006) | The only mechanism for compile-time circuit error feedback |
| Kp10 | `getIdeModeLabel()` for all user-facing mode names | Student vocabulary is defined here — don't hardcode "hardware" anywhere |

### Reconsider (currently built but direction may need to change)

| # | Feature | Reconsider rationale |
|---|---------|---------------------|
| R1 | Five-stage left rail | If Import is an action and Program is an external handoff, the rail has 3 real stages |
| R2 | Pipeline strip | Redundant with left rail; consumes top chrome |
| R3 | Three-state export trust signal | Too technical for students unless consumer is explicitly TA/grader |
| R4 | Analysis drawer as a collapsible region | If the drawer is the primary diagnostic tool, why is it hidden by default? |
| R5 | Verify "Checks" tab name | "Checks" is better than "Mismatches" but still sounds like a testing framework |
| R6 | `completedMilestoneCount` in Project Surface | Gamification without reward path |
| R7 | K-Map in the Details tab | K-Maps require Karnaugh map understanding — is this the right complexity level? |
| R8 | Waveform as the primary result visualization | Beginners may not understand waveform semantics; a truth-table-first view might be more parseable |
| R9 | `firstFailingTick` as a navigation anchor | Useful for engineers; students may not know what a tick is |
| R10 | Ghost lane pattern in waveform | Visual clarity is good; naming "ghost" is internal speak and should never reach UI copy |

---

## Section 7 — The 15 Highest-Risk Unanswered Decisions

These are ordered by risk: probability that getting them wrong wastes weeks of implementation × impact on the product's educational mission.

---

**1. Who is the student? (Risk: existential)**

Every surface has been built assuming "a student." But a student in what class? At what level? With what hardware? With what prerequisite knowledge? Without this answer, every design decision is a guess. The product needs a single primary persona document before the next implementation sprint.

---

**2. Is hardware required? (Risk: audience halving)**

If Basys3 ownership is required for program completion, RedByte excludes all students without hardware. The entire spine implies hardware is the destination. If it's not required, the export and program stages are optional — and the spine ordering may be wrong.

---

**3. Does Verify teach or just validate? (Risk: feature misdirection)**

If Verify's job is to teach (student understands *why* their circuit behaves the way it does), then the waveform, tick chip, and analysis drawer are core. If Verify's job is just to gate export (circuit is correct before deployment), then a simple pass/fail is sufficient and the current complexity is overengineered.

---

**4. Is pin mapping a student task or a teacher task? (Risk: entire stage purpose)**

If teachers pre-map pins and distribute templates, the Map Pins surface should be read-only confirmation, not a full editor. The surface as currently implemented cannot tell which situation it's in.

---

**5. Does the analysis drawer belong in Verify or in Design? (Risk: wrong surface)**

The analysis drawer currently lives in Verify and contains truth tables and K-maps. But the "which gate is wrong?" question is answered in Design, not Verify. If the analysis drawer is meant to help fix circuits, it may be in the wrong surface entirely.

---

**6. Is "Observe" a teaching mode or a crutch? (Risk: learning short-circuit)**

If students discover that Observe always "passes" (because no expected values = no failures), they will use Observe exclusively and never learn to author expected outputs or reason about correctness. Is this a known acceptable risk, or does the product need to prevent it?

---

**7. What is the completion criterion for the whole app? (Risk: no closure)**

A student has "completed" RedByte when ___. This blank has never been filled in. Without it, the done states on each stage are arbitrary, and the overall motivational arc is undefined.

---

**8. Is the export pipeline's complexity justified? (Risk: wasted infra)**

The export pipeline builds a Vivado XPR project with constraints, a README, and a hash-based bundle. This is real engineering. If the intended deployment is "student opens Vivado and programs the board," the bundle format is correct. If the intended deployment is "TA programs boards for the class," a much simpler output may suffice.

---

**9. Should RedByte have a classroom/teacher mode? (Risk: unbuilt consumer)**

There are signals of a teacher/TA consumer in the codebase (Import, grading signals, evidence snapshots). But no explicit teacher surface exists. If no teacher surface is planned, some of this infrastructure is building toward nothing.

---

**10. What does "pass" unlock, experience-wise? (Risk: anti-climax)**

When a student runs Verify and gets `status: pass`, what happens in the product? Currently: a pass hero banner (demoted to `<details>` in B-14). That's it. If passing is the learning moment, the celebration and guidance post-pass need to be proportional. If passing is just a gate, the current minimal response is fine but should be explicitly declared minimal.

---

**11. Is the waveform the right first view for beginners? (Risk: comprehension failure)**

A waveform is an analog-domain visualization repurposed for digital signals. Digital logic students may not have the background to read them without instruction. If the first thing a new student sees after running Verify is a waveform they don't understand, confidence drops. The alternative (truth table first) may be more parseable but loses temporal information for sequential circuits.

---

**12. What mediates the "I failed verify, now what?" loop? (Risk: frustration spiral)**

The most important pedagogical moment in RedByte is: verify fails → student understands why → student fixes circuit → verify passes. Currently the bridge between "why" and "what to change" requires the student to read a waveform, identify the wrong signal, reason backward through the circuit, and navigate to the right gate. This loop is genuinely hard for beginners. Has it been tested with an actual student?

---

**13. Is multi-project in scope, and if not, when does it become scope-creep? (Risk: silent assumption divergence)**

If a student works on 5 different lab exercises throughout a course, they have 5 different projects. Currently there is no project management. Every time a feature touches "the project," an implicit assumption that there is exactly one project is encoded. When multi-project eventually enters scope, rewriting those assumptions will be painful. The decision point is now.

---

**14. What is the relationship between RedByte and Vivado? (Risk: integration gap)**

RedByte generates a Vivado project ZIP. Vivado is the tool that actually programs the board. The gap between "download ZIP" and "board is programmed" is opaque to students. Is RedByte ever going to bridge that gap (e.g., Vivado TCL integration, cloud synthesis), or is the ZIP the permanent handoff boundary?

---

**15. Is the product's success metric "circuit builds" or "student understanding"? (Risk: Goodhart's law)**

If success = circuit compiles and passes verify, students will learn to get circuits to pass verify. If success = student understands how their circuit works, passing verify is a proxy, not the goal. The product needs to commit to one metric. The current feature set implies "student understanding" is the goal, but the completion conditions only measure "circuit state."

---

*End of interrogation document. No implementation until at least decisions 1, 3, 6, and 12 have explicit answers.*
