# RedByte Classroom Trust Handoff

## Summary

- This is the canonical planning and acceptance document for RedByte's next phase.
- Verify is largely closed as the main roadmap theme. Export and Hardware are less opaque than they were, but the remaining product risk is now classroom trust.
- Preserve the current four-surface IDE architecture. Communicate one student-facing five-step spine: `Design -> Verify -> Map Pins -> Export -> Program`.
- Treat examples and classroom ops as proof obligations inside the main workstreams, not as separate top-tier epics.

## Product Truth And Constraints

- Product truth sources are current IDE code, `PRODUCT.md`, and the current Engineering Brain/dashboard.
- Older Dashboard/Studio/LabWorkspace docs may be cited only as historical context. They do not define the current product shape, workflow, or acceptance criteria.
- Keep this handoff concise and operational. Avoid long narrative prose unless it directly clarifies product truth or implementation sequencing.
- Do not reopen Verify as the central roadmap theme.
- Do not propose a route-level rewrite from four surfaces to five stages in this handoff.
- Do not split examples or classroom ops into separate top-tier epics.
- Do not treat this handoff as implementation. It defines the next planning and acceptance contract.

## Current State Snapshot

- Verify closure is now the baseline assumption. The repo has recent Verify authority, render, and workflow hardening, and the Engineering Brain already treats Verify as closed.
- `classroom:signoff` proves a narrower deterministic student loop: release hygiene, student-loop gates, key export/program handoff gates, and import onboarding gates.
- That command does not yet prove full classroom trust across editor reliability, shared stage authority, hardware failure recovery, or advanced sequential explanation.
- Current workflow language still drifts in the live product:
  - `PipelineStrip` uses `Design -> Verify -> Hardware -> Export`
  - the left rail uses `Build -> Test -> Program -> Export`
  - `HardwareSurface` currently folds both pin mapping and programming into one surface
- The next phase is therefore less about adding isolated capability and more about making the system legible, trustworthy, and recoverable under real student and instructor use.

## Current `classroom:signoff` Proof

- It proves the repo can satisfy a deterministic student-loop baseline.
- It proves key handoff surfaces are wired and reachable.
- It proves import, export, and dry-run programming have a defined gate surface.
- It does not yet prove that students can reliably understand what is done, what is blocked, what is next, and why across the whole IDE.

## Missing Classroom Trust Evidence

- Editor reliability under dense and mistake-heavy circuit authoring.
- Shared stage authority across Project, left rail, pipeline strip, headers, and CTAs.
- Hardware/export failure taxonomy that tells students whether the problem is design, mapping, stale export, board connection, or bridge/toolchain state.
- First-run guidance that gets a new student to meaningful success without TA interpretation.
- Sequential and clocked explanations that remain aligned across Verify, Export, and Hardware.

## Student-Facing Workflow Contract

| Step | Current surface owner | Required truth |
|---|---|---|
| `Design` | `DesignSurface` | The schematic can be built and edited safely enough to remain the source of truth. |
| `Verify` | `VerifySurface` | The student can tell whether the logic behaves correctly and why a failure occurred. |
| `Map Pins` | `HardwareSurface` map mode | Required ports, conflicts, and board intent are explicit before export or programming. |
| `Export` | `ExportSurface` | The artifact set, readiness state, and blockers are deterministic and inspectable. |
| `Program` | `HardwareSurface` bring-up / live path | Board connection, programming readiness, and recovery steps are explicit after a current export. |

Every student-facing stage indicator must answer the same four questions:

- what is done
- what is blocked
- what to do next
- why

`Map Pins` and `Program` are explicit student-facing sub-states inside the existing four-surface architecture, not new routes.

## Carry-Over Export Truth

These export-clarity fixes are already resolved and must be preserved:

- `BUG-007` (`b5cf70c7`): stale-after-pass export state is advisory `STALE`, not a red hard blocker
- `BUG-008` (`849eca4f`): the visible Vivado steps prioritize the normal Open Project workflow instead of the TCL batch path
- `BUG-009` (`88d7a30f`): RBEV advisory evidence is not mixed into the blocker list when export is hard-blocked

Regression here is a failure against this handoff. Do not reopen these bugs as the center of the roadmap.

## Severity Ranking

1. Design/editor legitimacy
2. Workflow spine and stage authority
3. Hardware/export failure truth and recovery
4. Onboarding and first-run guidance
5. Advanced sequential/clocked circuit trust

## Gap 1 - Design/editor legitimacy

### Failure mode

- Wire editing, selection, deletion, and recovery still risk feeling fragile.
- Dense or advanced circuits can become hard to control, read, and trust.
- Sequential authoring can still feel like a special-case hazard instead of normal design work.

### Why it matters

- RedByte promises that the schematic is the source of truth.
- If students stop trusting the editor under pressure, the whole IDE starts to feel toy-like even when Verify and Export are technically stronger.

### In-scope work

- Interaction reliability for wires, nodes, selection, deletion, undo, and redo.
- Dense-circuit legibility and controllability.
- Sequential authoring clarity where clocks and stateful primitives are involved.
- Clear issue visibility while authoring so failures do not hide behind subtle editor state.

### Non-goals

- A visual redesign for its own sake.
- A net-new design system or route structure.
- New advanced primitives that bypass current trust problems instead of fixing them.

### Exit criteria

- Common edit and recovery actions behave deterministically in normal and dense circuits.
- Students can make and undo non-trivial design changes without losing confidence in the schematic.
- Sequential authoring no longer feels like a fragile branch of the editor.

### Required evidence

- Deterministic gate target: editor interaction contract coverage for wire select/edit/delete, undo/redo, multiselect, dense-circuit pointer safety, and sequential authoring state.
- Manual rehearsal: build one medium custom combinational circuit and one clocked circuit from scratch, edit aggressively, recover from mistakes, and confirm the editor never requires guesswork to stay in control.

## Gap 2 - Workflow spine and stage authority

### Failure mode

- Project, left rail, pipeline strip, surface headers, and CTAs do not always describe the same stage truth.
- Students still see mixed language such as `Build/Test/Program/Export` versus `Design/Verify/Hardware/Export`.
- Mapping and programming authority remain buried inside `HardwareSurface` instead of being explained as explicit student steps.

### Why it matters

- A student-ready IDE should remove interpretation burden, not add it.
- If the app knows the next step but presents it inconsistently, students lose trust even when the underlying state is correct.

### In-scope work

- One shared step-authority model across Project, left rail, pipeline strip, surface headers, and primary CTAs.
- Explicit student-facing handling for `Map Pins` and `Program` inside the current surface architecture.
- Consistent done/blocked/next/why language for blocked, passing, stale, and partially complete states.

### Non-goals

- A route-level five-stage rewrite.
- Renaming internal code symbols solely to mirror student language.
- Adding more panels instead of clarifying the existing ones.

### Exit criteria

- All major stage indicators agree on what is done, blocked, next, and why.
- The student-facing workflow reads as `Design -> Verify -> Map Pins -> Export -> Program` even though the underlying routes remain unchanged.
- No primary CTA contradicts the currently authoritative state.

### Required evidence

- Deterministic gate target: cross-surface stage-authority contract covering Project, left rail, `PipelineStrip`, surface headers, and CTA routing for clean, stale, blocked, and recovered states.
- Manual rehearsal: run a fresh starter project through design, verify, map pins, export, and program, then repeat from a blocked state and confirm a student never has to infer the next destination manually.

## Gap 3 - Hardware/export failure truth and recovery

### Failure mode

- Students can still struggle to tell whether a failure comes from the design, pin mapping, stale export state, board connection, or bridge/toolchain state.
- Export may be clearer than before but can still feel magical if artifact truth and readiness authority are not explicit enough.
- Programming failures can still feel mysterious instead of teachable.

### Why it matters

- RedByte's hardware promise is only credible if failures are explicit, recoverable, and correctly attributed.
- Classroom trust collapses quickly when the app cannot tell a student what is wrong and what to do next.

### In-scope work

- A clear failure taxonomy across Export and Hardware.
- Actionable messaging for board detection, reconnect, stale export, mapping blockers, and bridge/toolchain failure.
- Deterministic artifact/readiness truth in Export.
- Regression protection for the resolved export-clarity fixes from `BUG-007`, `BUG-008`, and `BUG-009`.

### Non-goals

- Replacing the external toolchain or promising hardware success without proof.
- Hiding real board or bridge failures behind generic UI.
- Treating wording changes alone as sufficient if failure attribution remains unclear.

### Exit criteria

- Export can authoritatively say ready, not ready, or stale, with a specific reason.
- Hardware/programming failures point to the correct class of problem and the correct next action.
- Students can inspect what is being exported and why programming is or is not currently safe.

### Required evidence

- Deterministic gate target: export/program failure-taxonomy contract covering unmapped ports, stale export, disconnected board, bridge failure, toolchain failure, and preserved `BUG-007/008/009` behavior.
- Manual rehearsal: one normal Basys3 flow plus forced failures for mapping, stale export, disconnect, and toolchain/bridge states, confirming the UI attributes each failure to the right cause and surface.

## Gap 4 - Onboarding and first-run guidance

### Failure mode

- First-time students still may not know where to start, what counts as progress, what step comes next, or what is required versus optional.
- Existing onboarding and empty states are present but too thin to carry a true first-run lab experience.
- Examples and starters can exist without being framed as workflow authority.

### Why it matters

- If a student needs a TA to decode the product before they can use it, the product is not yet doing enough.
- Known-good examples and starters are part of product credibility, not side content.

### In-scope work

- Stronger first-run guidance and empty-state next-step clarity.
- Explicit distinction between Verify, Map Pins, Export, and Program for beginners.
- Known-good starter and example coverage for the main classroom flows.
- Instructor-facing rehearsal and recovery expectations tied to those known-good flows.

### Non-goals

- A full embedded curriculum.
- Long in-app manuals that duplicate lab handouts.
- Treating a modal overlay alone as sufficient onboarding.

### Exit criteria

- A fresh student can reach a meaningful first success in roughly two minutes without outside interpretation.
- Each mode states what is required, what is optional, and what the next action is.
- At least one combinational, one sequential, and one display-oriented known-good flow exists as starter/example authority.

### Required evidence

- Deterministic gate target: onboarding and empty-state contract plus starter/example metadata coverage for combinational, sequential, and display-oriented known-good flows.
- Manual rehearsal: fresh-profile first run plus instructor setup/recovery using the same known-good starters, confirming the workflow remains understandable without side-channel explanation.

## Gap 5 - Advanced sequential/clocked circuit trust

### Failure mode

- Clock, tick, sample, and edge semantics can still be technically present but insufficiently explained.
- Students may still mistrust how sequential expectations travel from Verify to Export to Hardware.
- Clocked examples can feel narrower or more fragile than combinational happy paths.

### Why it matters

- Digital logic teaching does not stop at combinational examples.
- If RedByte is weak on clocks and sequential timing, it cannot credibly claim a full design-to-hardware classroom loop.

### In-scope work

- One consistent student-facing explanation of tick, sampling, and edge behavior.
- Sequential failure explanation quality in Verify and downstream stage language.
- Clocked example/starter authority that remains aligned through export and hardware bring-up.

### Non-goals

- A full multi-clock-domain curriculum.
- Broad HDL/toolchain expansion outside the current product scope.
- Treating clocked support as solved because parity exists in narrow internal fixtures only.

### Exit criteria

- Sequential terminology remains consistent across Verify, Export, and Hardware.
- Clocked examples and starters prove the intended flow without special pleading.
- Students can explain what failed in a clocked design without guessing at hidden timing semantics.

### Required evidence

- Deterministic gate target: sequential parity and explanation coverage tying Verify timing, exported testbench semantics, mapped hardware expectations, and clocked starter/example fixtures together.
- Manual rehearsal: run a clocked starter through verify, map pins, export, and program or dry-run programming, confirming the meaning of timing stays stable at every step.

## Recommended Implementation Order

Use this execution order for the next phase, even though severity and sequence are not identical:

1. Workflow spine and shared step authority
2. Design/editor legitimacy
3. Hardware/export failure truth and recovery
4. Onboarding and first-run guidance
5. Advanced sequential/clocked circuit trust

Sequence starts with workflow authority because every other improvement depends on the product telling the student what matters right now. Examples, starters, and classroom ops should be delivered as proof obligations inside these tracks rather than as separate roadmap lanes.
