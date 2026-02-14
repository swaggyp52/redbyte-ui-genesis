# Post-v1 Evidence Backlog

Scope: items that are not fully verifiable from scripted/local CI alone and require real student/hardware evidence.

## Ticket EV-001: Physical Basys3 End-to-End Rehearsal Proof

- Owner: Connor Angiel
- Severity: blocker for classroom-ready claim
- Repro steps:
  1. Checkout `v1.0.0-next-lab-ready`
  2. Follow `docs/student-setup.md` / `docs/rehearsal/student-setup.md`
  3. Complete full wizard + Studio + export flow on real Basys3 hardware
  4. Run `pnpm v1:verify -- <exported-bundle>`
- Expected:
  - all wizard hardware steps pass
  - export succeeds
  - bundle verify passes
- Actual:
  - not yet captured in this environment (requires physical run)

## Ticket EV-002: Student-Machine Fresh Profile Repeatability

- Owner: Connor Angiel
- Severity: high
- Repro steps:
  1. New Windows profile (or full storage reset)
  2. Run full rehearsal from checklist
  3. Repeat on second clean profile
- Expected:
  - two clean passes without manual intervention
- Actual:
  - scripted rehearsals pass; physical profile evidence still pending

## Ticket EV-003: USB/Driver Variance Across Student Machines

- Owner: Connor Angiel
- Severity: medium
- Repro steps:
  1. Run hardware protocol on at least 2 different student-like machines
  2. Compare `board_detect`, `programmer_check`, and `known_good_program` outcomes
- Expected:
  - deterministic guidance and fail-closed behavior across machine variance
- Actual:
  - not yet validated across multiple physical host setups

## Ticket EV-004: Copilot Follow-up (Bug-fix only when evidence exists)

- Owner: Copilot
- Severity: conditional
- Repro steps:
  1. Connor provides failed step + exact error text + evidence artifact path
  2. Implement minimal bug fix only
  3. Add regression test and update rehearsal logs/ticket
- Expected:
  - failure resolved with test coverage
- Actual:
  - pending any new evidence-based failure
