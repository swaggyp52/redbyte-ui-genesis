---
doc_status: current
last_validated: 2026-07-01
owner: Connor Angiel
used_by_claude: true
role: Gannon pilot adoption gap map
---

# Gannon Pilot Gap Map

This map tracks what can block a supervised Gannon pilot even when browser-E0 flows pass.

## A. Student Start And Lab Flow

Current Round 13A target:

- distinct start paths on Project
- five Gannon Pilot lab cards
- visible next-step copy on every IDE surface
- student submission guidance on Export

Remaining gap after Round 13A:

- real classroom wording has not been tested with students
- headed 125% accessibility is not yet proven
- no LMS or grading workflow exists

## B. Browser-E0 Stability

Current evidence:

- Round 7R: true 60-minute production browser-E0 session passed
- Round 11R: 3-hour production browser-E0 simulation passed with zero P0/P1/P2/P3 tickets

Remaining gap:

- Round 13A itself still needs its focused browser gate and production reproof after push/deploy
- broad stale-test sweep is still incomplete

## C. Vivado And Board Proof

Current boundary:

- Export creates browser-E0 Vivado packages
- Vivado synthesis/implementation/bitstream remains external
- board programming and observed behavior remain external

Remaining gap:

- Gannon Pilot Labs 1-5 do not have fresh E1/E2/E3 proof in this slice
- no physical board observation is claimed for the pilot lab pack

## D. Instructor Operations

Current target:

- instructors can ask for a ZIP submission
- instructors can optionally require Vivado logs or board observation outside RedByte

Remaining gap:

- no roster, account, LMS, grading database, or submission collection system exists
- instructor support and troubleshooting still require manual process

## E. Release / Commercial Posture

Current truth:

- RedByte can be piloted as a supervised browser-E0 lab workbench
- RedByte is not sell-ready as a standalone classroom platform

Decision rule:

- Start Round 13A only as pilot-productization.
- Start sales/commercial packaging only after E1/E2/E3 scope, support model, and classroom operations are explicitly accepted.
