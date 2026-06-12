---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: target architecture model for RedByte lab profiles and course packs
---

# RedByte Lab Profile Model

This document defines the target data model boundary for professor-authored labs, course packs, and from-scratch student work. It is not an implementation claim. As of 2026-06-12, RedByte remains a Basys3-focused browser IDE with starter data still present in app source.

## Purpose

The lab profile model answers five product questions:

1. How professors create labs without changing RedByte core code.
2. How students build from scratch without starter lock-in.
3. How RedByte stays honest about supported components and Basys3 boundaries.
4. How course packs avoid solved labs.
5. How Verify/Export proof requirements attach to labs without hardcoded workflow.

## Core Definitions

| Term | Definition | Ownership |
|---|---|---|
| RedByte core project | A `.rbproj`-compatible circuit project with nodes, connections, IO rows, scenarios/vectors, mapping, and export state. | Core product logic |
| Board profile | Board-specific resources, pin aliases, package pins, clock/reset semantics, XDC generation rules, and export constraints. For v1 this is Basys3. | Core product logic |
| Starter example | A curated project that helps students begin or learn a concept. It may include scaffolding and safe example vectors. | Course data or product examples |
| Lab profile | Assignment-level definition of goals, allowed components, required IO, verification expectations, mapping/export requirements, proof tier, and no-solution policy. | Course data |
| Course pack | A versioned collection of lab profiles, starter scaffolds, instructor notes, and optional public examples. | Course data |
| Instructor-authored lab | A lab profile and optional scaffold created by a professor or TA without modifying RedByte core source. | Course data |
| Student project | A student-owned project created from blank state, an instructor scaffold, or a public example. | User data |
| Verification scenario | A named set of stimulus vectors or scenario steps with expected outputs and clock/reset policy. | Project data; constrained by lab profile |
| Expected-output contract | The rule that only authored expected outputs are compared, blank expected cells are not failures, and repair loops must reach terminal PASS/FAIL honestly. | Core product logic |
| Pin-mapping requirement | Required top-level inputs/outputs and board-resource assignments that must be complete before trusted export. | Lab profile plus board profile |
| Export requirement | The minimum artifacts and trust state required for a lab submission, such as draft package allowed or trusted export required. | Lab profile; enforced by core product |
| Proof-tier requirement | Whether the assignment requires E0 browser proof, E1 Vivado elaboration/synthesis, E2 programming, or E3 physical observation. | Lab profile; proof semantics from core product |
| No-solution policy | Rule that public/student starter scaffolds must not include solved wiring, hidden answer circuits, or instructor-only solution assets. | Course pack governance; guarded by tests |
| Starter scaffold | A safe partial project that gives boundaries, labels, IO, or structure without solving the assignment. | Course data |
| Solution | Instructor-only answer key or full implementation. It must not ship in public/student course packs. | Instructor private data |
| Import/export handoff | RedByte's boundary with HDL, Vivado, generated artifacts, and external board programming. | Core product logic |

## What Belongs Where

| Layer | Belongs here | Does not belong here |
|---|---|---|
| Repo core code | Simulation, component support, Verify, IO authority, Basys3 profile, export generation, artifact consistency, proof-tier vocabulary. | Course-specific lab numbers, professor rubrics, instructor solution keys. |
| Course data | Lab profiles, starter scaffolds, public examples, lab-specific vector expectations, allowed component lists, no-solution metadata. | New simulator semantics, new board support, hidden core behavior changes. |
| Instructor docs | Assignment instructions, grading notes, classroom workflow, required proof tier, Vivado/board expectations. | Claims that exceed current RedByte proof or supported board/component boundaries. |
| Future hosted/classroom tooling | Course-pack distribution, roster/submission management, instructor-authored lab upload, private solution storage. | Required v1 browser IDE behavior unless a real hosted-data need exists. |

## Lab Profile Shape

A future lab profile should be able to express:

- `id`, `title`, `course`, `version`, and `audience`.
- Learning goals and allowed supported primitives.
- Required IO boundaries with direction, labels, optional aliases, and whether they must be mapped.
- Board profile requirement, currently `basys3`.
- Optional starter scaffold reference and whether blank start is allowed.
- Scenario requirements: minimum vectors, required asserted outputs, clock/reset policy, and whether students may add custom cases.
- Export requirements: required artifact set, draft/trusted export policy, README/handoff requirements.
- Proof-tier requirement: E0, E1, E2, or E3.
- No-solution policy metadata for starter and course-pack gates.
- Manual proof or observation notes needed when E2/E3 is required.

## Professor-Created Labs Without Core Code Changes

Target path:

1. Professor defines a lab profile and optional scaffold in course-pack data.
2. RedByte loads the profile and presents goals, allowed components, required IO, and proof requirements.
3. Student starts from blank or scaffold.
4. Core Verify, Map Pins, and Export enforce the profile constraints through generic mechanisms.
5. Course-pack validation rejects public solved scaffolds and unsupported claims.

Core code should not need edits for a professor to add a new AND/OR/MUX/DFF-class lab inside current supported primitives and Basys3 resources.

Core code is needed only when the lab requires new component semantics, new board support, new export rules, or new proof semantics.

## From-Scratch Student Work Without Starter Lock-In

Student projects must work when they start from blank state:

- Generic IO creation must generate stable labels and IDs.
- Verify scenario authoring must bind to live IO rows and tolerate readable labels.
- Map Pins must bind live design boundaries to board resources.
- Export must resolve scenario keys and mapping aliases back to entity references.
- The app may recommend starters, but starters must not be required to make Verify or Export truthful.

The Sprint 0 from-scratch gate proves the smallest E0 version of this path for a two-input AND circuit.

## Supported Boundaries And Basys3 Honesty

The v1 board profile is Basys3. That means:

- Basys3 resource aliases, pins, board clock, reset hints, and XDC output stay core product logic.
- RedByte should not claim other boards until a second board profile and proof suite exist.
- Vivado remains the downstream tool for synthesis, implementation, bitstream generation, and programming.
- E1/E2/E3 claims require Vivado and hardware evidence, not browser gates.
- Unsupported temporal, multi-clock, active-low reset, or unsupported component behavior must remain explicit.

## Course Packs Without Solved Labs

Course-pack gates should enforce:

- Public/student starter scaffolds do not include solved wiring for the assignment.
- Instructor solutions are private and never imported into public app bundles or classroom starter goldens.
- Public examples may demonstrate concepts, but lab profiles must distinguish example, scaffold, and solution.
- README and export artifacts must explain proof boundaries without leaking answer keys.

## Verify And Export Proof Without Hardcoded Workflow

Proof requirements should attach to the lab profile and current project state, not to starter IDs.

Examples:

- A combinational lab can require at least one asserted output per vector and trusted export after complete mapping.
- A sequential lab can require a clocked-macro scenario and board-clock explanation.
- A board demo can require E2 programming proof or E3 observation notes.
- A classroom submission can allow draft export only when the lab explicitly accepts E0 package generation without current Compare PASS.

Core logic should enforce these requirements through the same Verify, Map Pins, Export, and proof-tier mechanisms used for all projects.

## Current Implementation Gap

As of 2026-06-12:

- Lab/profile architecture is defined here but not fully implemented.
- ECE141 lab definitions and starter data still live in app source modules.
- Some product-general gates still carry ECE141 names.
- The blank-project AND workflow has E0 browser proof, but intentional fail-edit-repair and fresh Vivado/Basys3 proof remain pending.

## Near-Term Implementation Order

1. Keep fixing gate truth and student workflow blockers first.
2. Add the Verify fail-edit-repair-pass regression.
3. Introduce a small lab-profile data seam for one existing lab or one new generic lab.
4. Move course-specific starter metadata toward course-pack data without changing core Basys3 logic.
5. Add course-pack no-solution gates that operate on profile/scaffold data.
6. Defer hosted classroom tooling until a concrete hosted-data requirement exists.
