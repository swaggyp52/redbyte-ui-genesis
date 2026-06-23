---
doc_status: current
last_validated: 2026-06-23
owner: Connor Angiel
used_by_claude: true
role: PR78 Product Trust Reset v2 Phase 6 pilot walkthrough packet
---

# RedByte Pilot Walkthrough Packet

This packet prepares draft PR #78 for human product review after Product Trust Reset v2 Phase 5. It is browser E0 evidence and review guidance only. It does not mark the PR non-draft, does not merge it, and does not claim Vivado/Basys3 E1-E3 proof.

## Review Identity

| Field | Value |
|---|---|
| Date | 2026-06-23 |
| Branch | `product/redbyte-trust-reset-v2` |
| PR | #78, draft |
| Phase 6 reviewed head | `6c9575b8072134e062e746fad1be9bac43bd5c1c` |
| Browser audit URL | `http://127.0.0.1:62594/os` |
| Served build JSON | `{"sha":"6c9575b80","timestamp":"2026-06-23T05:19:02.043Z","env":"dev","version":"1.0.0"}` |
| Evidence path | `.redbyte/product-immersion/product-trust-reset-v2/phase-6/current-baseline/` |

## Decision

**READY FOR REVIEW, KEEP DRAFT.**

The Phase 6 browser audit found no P0/P1 browser blocker that requires emergency product-code repair before a human review pass. PR #78 should remain draft until the human pilot walkthrough, actual assistive-technology session, support-process review, and final GitHub-green closeout are complete.

## Surfaces Reviewed

| Surface | Current review outcome | Evidence |
|---|---|---|
| Project first launch | Main job, starter path, saved/open path, and Help boundary are visible with no root overflow. A 1366px panel body still scrolls, which is acceptable but visually dense. | `screenshots/project-first-launch-1366x768.png`, `screenshots/project-first-launch-1440x900.png` |
| Project loaded command center | Current action, compact workflow progress, direct route commands, import/recover, and recent/open paths are present. | `screenshots/project-loaded-command-center-1366x768.png`, `screenshots/project-loaded-command-center-1440x900.png` |
| Design blank/starter authoring | Canvas-first work area and fixed build library are usable. Audit still flags visible legacy collapse/support copy in normal Design states. | `screenshots/design-blank-authoring-1366x768.png`, `screenshots/design-starter-authoring-1366x768.png` |
| Verify pre-run/observe/pass/fail/repair | Course-check authority, Observe/Compare split, FAIL repair path, waveform evidence, and final repaired PASS all render without page errors or root overflow. A 1366px locked-check authority lane still has local internal scroll. | `screenshots/verify-prerun-testbench-1366x768.png`, `screenshots/verify-compare-pass-1366x768.png`, `screenshots/verify-intentional-fail-1366x768.png`, `screenshots/verify-repaired-pass-1366x768.png` |
| Map Pins | Table-to-board binding and selected resource context remain first-order. | `screenshots/hardware-map-pins-workbench-1366x768.png`, `screenshots/hardware-map-pins-workbench-1440x900.png` |
| Export | Artifact list, selected preview, package state, copy/download selected-file controls, and plain Vivado handoff are visible. Artifact list/preview scrolling is intentional but still dense. | `screenshots/export-artifact-workspace-1366x768.png`, `screenshots/export-artifact-workspace-1440x900.png` |
| Import | Five-step source/inspect/resolve/review/apply workflow is visible, and active Paste HDL keeps current-project-preservation copy in view. | `screenshots/import-first-look-step-workflow-1366x768.png`, `screenshots/import-active-paste-workbench-1366x768.png` |
| Help / Diagnostics | Raw build/storage details remain behind Help. This is correct for support, but it is not normal student UI. | `screenshots/help-diagnostics-boundary-1366x768.png` |
| Navigation/reload/resume | Browser Back/Forward, reload continuity, and dirty-resume context did not produce page errors or root overflow. | `screenshots/navigation-reload-back-forward-1366x768.png`, `screenshots/dirty-resume-project-1366x768.png` |

## Issue List

### P0

None found in the Phase 6 browser audit.

### P1

None found in the Phase 6 browser audit.

### P2

| Issue | Why it matters | Follow-up |
|---|---|---|
| Design still exposes legacy support-collapse wording in normal authoring. | It can make the V2 workspace feel less final even though the actual canvas task is usable. | Replace with a more permanent tool-window affordance after human review confirms the desired interaction model. |
| Verify 1366px locked-check authority lane can still become a small internal scroll area. | It is not blocking, but it can feel cramped during classroom explanation. | Continue Verify surface simplification after the pilot review. |
| Export artifact workspace remains dense. | Students can inspect files, but file list plus preview plus status can still read as heavy for first-time users. | Run human walkthrough against Export file selection/copy/download before non-draft. |
| Diagnostics exposes raw build fingerprint by design. | Correct for support, but reviewers must confirm it stays behind Help and never returns to normal chrome. | Include Diagnostics in TA support review only. |
| CSS and legacy selector debt remain large. | Maintainers still carry old visual assumptions. | Retire stale V1 CSS/selectors only with replacement-gate proof. |
| No actual screen-reader session has been run. | Automated browser/axe checks are not a certification. | Run `docs/release/RED_BYTE_ASSISTIVE_TECH_HUMAN_SCRIPT.md`. |
| No professor/student timed walkthrough has been run. | Browser gates prove mechanics, not classroom comprehension or confidence. | Run the pilot walkthrough below and capture notes before non-draft. |

## Professor/Student Walkthrough

Record browser, OS, viewport, build SHA, participant role, and pass/fail notes. Use a fresh browser context and then a dirty/resume context.

| Step | Reviewer action | Expected observation | Record |
|---|---|---|---|
| 1 | Open Project first launch. | The next useful action is obvious without status-card hunting. | pass/fail, confusion |
| 2 | Load Logic Gates starter. | Project identity, source, board, save state, and Continue destination are clear. | pass/fail |
| 3 | Rename the project, reload, and return to Project. | Name persists and source/lab identity remains separate. | pass/fail |
| 4 | Open Design, add or select a component, then return. | The canvas is the primary work object; controls do not feel like a card wall. | pass/fail |
| 5 | Open Verify before running checks. | Course expected outputs are understandable as locked; My checks path is clear. | pass/fail |
| 6 | Run Compare to PASS. | The result, evidence, and next route are clear. | pass/fail |
| 7 | Intentionally edit/duplicate a check to produce FAIL, then repair to PASS. | Failure authority and repair action are understandable without changing semantics. | pass/fail |
| 8 | Open Map Pins. | Signal-to-board-resource binding is visible and trustworthy. | pass/fail |
| 9 | Open Export, inspect `top.vhd`, `top.xdc`, testbench, README, and download/copy actions. | Package readiness is clear without implying Vivado or board proof. | pass/fail |
| 10 | Open Import, choose Paste HDL, inspect, cancel before replacement, then verify current project remains unchanged. | Recovery is guarded and transactional. | pass/fail |
| 11 | Reload, use browser Back/Forward, then reopen Help / Diagnostics. | The app returns to the expected mode; support details are available only behind Help. | pass/fail |

## Human Review Exit Criteria

Before PR #78 can be marked non-draft, record:

- no P0/P1 walkthrough issues,
- actual assistive-technology notes or a documented accessibility blocker,
- support/Diagnostics boundary accepted by a human reviewer,
- final current-build smoke on the committed head,
- GitHub Classroom Truth Gates and Cloudflare Pages green,
- explicit no-hardware-proof language retained.

## Attribution

Connor Angiel
