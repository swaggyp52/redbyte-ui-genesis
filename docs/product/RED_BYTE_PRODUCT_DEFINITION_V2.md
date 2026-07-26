# RedByte Product Definition V2

Status: active implementation contract for the professional workflow-completion program.

RedByte is a digital-logic project workspace that carries one student project through five stages:

**Project → Design → Verify → Map Pins → Export**

Import is a recovery utility. It is not a sixth stage and it never replaces the active project until the student explicitly applies a reviewed candidate.

## Surface contract

| Surface | Student job | Primary work object | Primary action | Done means |
| --- | --- | --- | --- | --- |
| Project | Understand the active project, readiness, and next step | Project overview | Continue the next incomplete stage | A project is loaded and its next incomplete stage is clear |
| Design | Build and repair the logical circuit | Circuit canvas | Edit the circuit | The logical IO boundary exists and no blocking structural diagnostic remains |
| Verify | Develop evidence for expected behavior | Testbench document | Run Compare | Compare PASS is current for the saved design and testbench |
| Map Pins | Bind signals to the board | Pin mapping table | Assign the selected signal | Every required signal has one coherent resource and package-pin assignment |
| Export | Inspect and download the handoff | Export package | Build or download the package | The generated package is current, inspectable, and browser-E0 ready |
| Import utility | Create a safe project candidate | Import candidate | Upload, review, then apply | The reviewed candidate is explicitly applied or safely canceled |

## Ownership boundaries

- Project owns identity, project selection, and the workflow overview. It reads readiness and must not edit pin mappings.
- Design owns the logical graph, circuit IO boundary, and structural diagnostics. A semantic design change invalidates Verify evidence; an IO-boundary change also invalidates mapping readiness.
- Verify owns testbench cases, stimulus, expected values, observed values, and Compare evidence. Editing a testbench invalidates its prior Compare result and any package based on it.
- Map Pins is the only stage that edits board-resource and package-pin assignments. Mapping changes invalidate the package, not the logical design or testbench.
- Export reads Design, Verify, and Map Pins readiness. It generates, previews, and downloads artifacts; it never repairs another stage in place.
- Import owns candidate parsing, review, and explicit apply/cancel. Uploading or reviewing a candidate does not change the active project.

## Evidence and invalidation

RedByte uses explicit evidence states instead of optimistic completion:

- Design: empty, editing, structurally blocked, ready to verify.
- Verify: no cases, draft, current PASS, stale, FAIL.
- Map Pins: unmapped, partially mapped, conflicted, ready to export.
- Export: blocked, ready to build, current package, stale package.
- Import: upload, review, ready to apply, blocked, applied.

A green state is current only for the project inputs that produced it. RedByte browser evidence is E0. Vivado build, bitstream, and physical-board behavior remain separate external proof boundaries.

## Interaction rules

Each surface must make its primary work object visually dominant, present one obvious primary action, keep recovery close to the failing object, and disclose advanced detail only when it supports the current task. Labels, pills, and status fragments cannot substitute for editable work objects or direct controls.

The implementation authority for this contract is `packages/rb-apps/src/apps/ide/productDefinition.ts`; workflow navigation authority is `packages/rb-apps/src/apps/ide/workflowStages.ts`.
