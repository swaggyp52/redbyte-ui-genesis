---
doc_status: current
last_validated: 2026-08-01
owner: Connor Angiel
used_by_claude: true
role: ordered RedByte Product System v3 delivery queue
---

# RedByte Product System v3 Work Queue

## Milestone A - Cohesive Workbench Foundation (active)

1. Establish the one product branch and draft PR; record the hardening contract.
2. Add light-first pre-paint theme selection with Light, Dark, and System persistence.
3. Add versioned workspace preferences, presets, persistent panel visibility/dimensions, and reset.
4. Add one command registry/palette and route shell/project actions through current authorities.
5. Rebuild Project as a real Project Center using live project, source, mapping, simulation, package, storage, and recovery data.
6. Add Design dock tabs, customizable toolbar preferences, real outline/source views, and bottom problems/simulation regions without changing circuit semantics.
7. Add a versioned component-definition facade over the existing support/runtime registries.
8. Add a versioned Basys3 profile/provenance facade and contextual Design board assignment over the existing mapping authority.
9. Rename student-visible stages to Simulate, Board & Constraints, and Build & Export while preserving internal route IDs.
10. Run focused persistence/registry/mapping tests, bounded browser proof, typecheck, CSS audit, build, docs/encoding checks, and `git diff --check`.

Milestone A does not run the full release aggregate and does not merge to `main`.

## Milestone B - Hierarchical Design and Component Depth

Implement modules/subcircuits, create-component-from-selection, nested editing, custom ports, buses/named nets, slicing/concatenation, parameters/generics, code-backed HDL modules, source hierarchy, and top-module selection. Prove one nontrivial multi-module project.

## Milestone C - Scenario and Testbench Composer

Implement timeline/table authoring, clock/reset and reusable stimulus generators, named phases, sweeps, probe sets, optional checks, run comparison, replay, and stronger generated testbenches for sequential and multi-module projects.

## Milestone D - Board and Constraints Depth

Extend the authoritative Basys3 profile in controlled phases; add constraint sets, multiple XDC files, clock/I/O-standard editing, broader peripherals, conflict/compatibility analysis, and simulated board replay.

## Milestone E - Import, Export, and Vivado Compatibility

Implement explicit design/simulation/constraint source sets, hierarchical export, code-backed and pass-through assets, Tcl project generation, compatibility report, package diff, representative round trips, and exact-package Vivado 2024.2 E1 evidence.

## Milestone F - University Product Readiness

Complete accessibility and contextual help, onboarding, instructor templates, TA diagnostics, backup/recovery hardening, supervised classroom pilot, and named E1/E2/E3 evidence before a new release candidate.

## Queue rules

- One product branch and one draft PR for the v3 program; no worktrees or per-surface branches.
- One logical change per commit; push each coherent commit.
- Current code/tests and current docs outrank planned behavior.
- Planned compatibility never appears as implemented.
- Browser E0 never implies Vivado, bitstream, board, or classroom proof.
- Do not merge the Milestone A branch into `main` without visual acceptance.

## Attribution

Connor Angiel
