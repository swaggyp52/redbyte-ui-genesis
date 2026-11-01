# Product Hardening Ticket - Milestone C Scenario and Testbench Composer

- **Date:** 2026-08-08
- **Owner:** Connor Angiel
- **Surface:** Simulate, with Project and Build & Export integration
- **Journey segment:** Design -> Simulate -> Build & Export
- **Mode:** Product System v3 candidate (`verify` internal route)
- **Environment:** Windows 11, local browser profile, Node 24.15.0 (repository pin 20.19.0 unavailable), pnpm 10.24.0

## Problem

The B2 Simulate workstation is visually coherent but remains primarily an
evidence viewer. Scenario management, timed stimulus authoring, expectation
authoring, evidence freshness, failure diagnosis, and generated testbench
inspection do not yet form one direct engineering loop. The six B2-adjacent
focused contracts also contain 39 assertions for retired Verify, Map Pins, and
PASS-hero presentation, so they no longer provide a trustworthy regression
signal for this surface.

## Reproduction

1. Open the Full Adder project in Simulate.
2. Attempt to create a named exhaustive scenario, author timed input changes,
   add Sum/Cout expectations, run, inspect a deliberate failure, correct it,
   reload, and inspect the generated testbench.
3. Run the six B2-adjacent focused tests recorded in the milestone closeout.

The current product requires indirect table-driven editing for substantial
parts of the workflow, and the focused selection reports 39 stale assertions
(30 Simulate, 9 Build & Export).

## Expected Behavior

One canonical persisted scenario model should drive the authoring UI, real
simulation, checks, waveform evidence, freshness, Project summary, and the
deterministic generated testbench. Simulate should support direct scenario,
event, and expectation CRUD with clear legal signal roles and useful failure
inspection. The focused contracts should assert accepted Product System v3
behavior without restoring retired UI.

## Truth Sources

- `docs/contracts/RedByte_Product_Contract.md` - Verify and simulation trust
- `docs/manuals/RedByte_Product_Manual.md` - current named-document, execution,
  evidence, and testbench authority
- `docs/IDE_SYSTEM_MAP.md` - `projectRuntime`, scenario, simulator, and export
  ownership
- `docs/ide/SURFACE_CONFORMANCE.md` - Simulate behavior and proof obligations
- `docs/release/manual-assignment-qa-script.md` - Phase 3 and testbench/package
  agreement

## Acceptance Proof

- The six-file B2 focused selection has zero failures after a bounded contract
  migration; meaningful interaction and state assertions remain.
- A real Full Adder scenario can author eight timed cases and sixteen checks,
  produce current passing evidence, expose a deliberate expected/observed
  failure at its event, recover after correction, survive reload, and become
  stale after an authored change.
- The testbench view and Build & Export simulation source are derived from the
  same authored scenario truth.
- Focused model/surface tests, typecheck, CSS audit, unified build, whitespace
  check, 1440x900 walkthrough, and 1366x768 compact review pass within the
  bounded milestone.

## Out of Scope

Milestone D, arbitrary HDL compatibility, Vivado execution, synthesis,
bitstream generation, hardware programming, deployment, merge, broad
regression aggregates, and full accessibility certification.

## Disposition

- **Status:** Implemented with bounded local Browser-E0 evidence
- **Branch:** `product/redbyte-workbench-v3`
- **Draft PR:** #80
- **Runtime caveat:** validation used Node 24.15.0 because the repository-pinned
  Node 20.19.0 runtime was not available on this machine.

## Attribution

Connor Angiel
