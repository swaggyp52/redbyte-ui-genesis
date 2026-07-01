---
doc_status: current
last_validated: 2026-07-01
owner: Connor Angiel
used_by_claude: true
role: Gannon pilot readiness boundary
---

# Gannon Pilot Readiness

This document defines the narrow Gannon pilot target. It does not declare RedByte sell-ready or hardware-certified.

## Current Proof Baseline

- Production before Round 13A was deployed at SHA `63d9427d3614175580fd5b7c41670d375d921768` / build `63d9427`.
- Round 12 proved Build Fresh after Import replacement on production.
- Round 7R proved a true 60-minute production browser-E0 student session.
- Round 11R proved a 3-hour production browser-E0 simulation: `180.03` counted minutes, zero P0/P1/P2/P3 tickets, and zero console/page errors.

## Round 13A Pilot Target

Round 13A makes the browser-E0 student path easier to run with a small pilot group:

- Project exposes distinct `Start a Lab`, `Build fresh`, `Open Starter`, and `Import / Recover` paths.
- Project exposes a Gannon Pilot lab pack:
  - Lab 1 Logic Gates
  - Lab 2 Half Adder
  - Lab 3 Full Adder
  - Lab 4 4-Bit Adder
  - Lab 5 2-Bit Counter / Sequential Logic
- Each lab card explains what students build, difficulty, submission expectation, proof scope, and start action.
- Project, Design, Verify, Hardware, Export, and Import show a compact `What do I do next?` guide rail.
- Export tells students to submit the RedByte/Vivado ZIP and states that the ZIP is browser-E0 package proof only.
- Import and Build Fresh copy explain cancel-vs-confirm replacement boundaries.

## What This Proves

Round 13A is intended to prove pilot navigation and browser-E0 package submission clarity:

- students can find and start the five pilot labs
- students can distinguish lab starts from blank work, generic starters, and recovery
- students can understand what to submit
- instructors can see that Vivado and board proof remain external checkpoints

## What This Does Not Prove

Round 13A does not prove:

- true 60-minute or 3-hour stability beyond prior Round 7R and Round 11R evidence
- Vivado E1 for the Gannon lab pack
- bitstream E2
- board observation E3
- sell-ready commercial support, accounts, LMS, grading, backend, or hosted classroom management
- broad stale-test cleanup
- headed 125% accessibility unless separately run and recorded

## Pilot Readiness Standard

`Gannon pilot ready` means a small instructor-led pilot can use RedByte for browser-E0 lab package generation while external Vivado/board work is called out clearly.

It does not mean RedByte is ready for a paid or unsupervised classroom sale.
