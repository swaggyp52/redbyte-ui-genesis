---
doc_status: current
last_validated: 2026-08-01
owner: Connor Angiel
used_by_claude: true
role: ordered RedByte Product System v3 delivery queue
---

# RedByte Product System v3 Work Queue

## Milestone A - Cohesive Workbench Foundation

**Status:** Implemented and bounded local validation complete on the draft
branch; exact-HEAD Browser-E0 evidence is the delivery record, and user visual
acceptance remains the merge gate.

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

### Candidate delivery state

- Branch: `product/redbyte-workbench-v3`
- Draft PR: [#80](https://github.com/swaggyp52/redbyte-ui-genesis/pull/80)
- Release lane: `main` and `origin/main` remain at
  `57c8a94abd15d1810bf1f85eadf751c116ffbaa6`, **Stable Preview - Browser-E0**.
- Local evidence: `.redbyte/product-immersion/workbench-v3-milestone-a/`
  contains the 12 required screenshots and the bounded browser evidence record.
- Evidence boundary: the captures and assertions prove only Browser-E0 layout,
  persistence, command, project, and mapping behavior at the recorded candidate
  state. They do not prove Vivado, bitstream, physical-board, deployment, or
  classroom reliability.
- Validation boundary: the Node 20.19.0 closeout passed 33 changed/new focused
  files and 257/257 tests, workspace typecheck, the IDE CSS audit, and the
  unified build (344 transformed modules and verified distributable). Docs,
  encoding, and whitespace checks complete the bounded record; the 12-screen
  pack is generated after the final documentation commit so it identifies the
  exact candidate commit. The full release aggregate is intentionally excluded.
- Merge gate: user visual acceptance. PR #80 remains draft; the candidate is not
  merged, deployed, or live.

### Carried debt

- The repository facade retains the existing versioned browser-storage backing;
  IndexedDB migration is deferred.
- Recovery snapshots are durable, and corrupt repository indexes rebuild through
  bounded reconstruction/rollback coverage. Recovery-candidate/session signaling
  still needs further hardening.
- Portable project backup does not yet carry every workspace-local,
  multi-scenario authoring document.
- Hierarchy and sources are inspect-oriented. Nested module editing, buses,
  named nets, code-backed modules, parameters/generics, and top selection remain
  future work.
- Multiple constraint sets, broader board peripherals, and deeper compatibility
  analysis remain future work.

## Milestone B - Hierarchical Design and Component Depth (next; not started)

Implement modules/subcircuits, create-component-from-selection, nested editing, custom ports, buses/named nets, slicing/concatenation, parameters/generics, code-backed HDL modules, source hierarchy, and top-module selection. Prove one nontrivial multi-module project.

Milestone B requires separate authorization after the Milestone A acceptance
decision. Do not begin it as part of Milestone A closeout.

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
