---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 assistive technology review boundary
---

# RedByte Assistive Technology Review

This note records the assistive-technology review boundary for draft PR #78.

## Reviewed Areas

- Project storage recovery banner after forced quota failure
- Recovery action names: Download backup, Retry save, Dismiss
- Recovery warning semantics: `role="alert"`
- Help / Diagnostics modal semantics from the existing Phase 3F review
- Keyboard/visible action continuity for the recovery path

## Evidence

Automated browser gates:

- `ide:gate:recovery-accessibility-v2`
- `ide:gate:project-quota-recovery-v2`
- `ide:gate:diagnostics-storage-v2`
- Existing Phase 3F: `ide:gate:verify-accessibility-v2`, `ide:gate:verify-keyboard-grid-v2`, `ide:gate:verify-zoom-contrast-v2`

Manual review outcome:

- The recovery banner is not hidden in a passive status line.
- The warning is exposed as an alert region.
- The backup, retry, and dismiss controls have visible names and can be reached as normal buttons.
- Diagnostics keeps engineering storage details behind Help instead of normal student chrome.

## Limits

- No NVDA, Narrator, VoiceOver, JAWS, or other screen-reader session was run in Phase 3H.
- No NVDA, Narrator, VoiceOver, JAWS, or other screen-reader session was run in Phase 6.
- This document does not certify full WCAG conformance.
- This document does not claim screen-reader announcement quality.
- A future release-readiness pass must run actual assistive technology on the normal Project -> Design -> Verify -> Map Pins -> Export flow, Import guarded recovery, Help / Diagnostics, and the storage recovery path before making stronger accessibility claims.

## Phase 6 Human Script

Phase 6 adds the required human AT runbook at:

```text
docs/release/RED_BYTE_ASSISTIVE_TECH_HUMAN_SCRIPT.md
```

The script covers Project, Design, Verify, Map Pins, Export, Import, Help / Diagnostics, keyboard-only recovery, 200 percent zoom, and blocking criteria. It is still pending until a human reviewer runs it with a real assistive technology tool and fills the result table.

## 15-20 Minute Human AT Script

Use Windows Narrator or NVDA in a fresh browser profile. Record the browser, assistive technology name/version, build SHA, viewport, and pass/fail notes for each step.

| Step | Action | Expected announcement / observation | Result to record |
|---|---|---|---|
| 1 | Open `/os/?mode=project&e2e=1` and tab through the top bar and workflow rail. | App name, current project title, active workflow step, and Help control are announced with usable names. | pass/fail, confusing labels |
| 2 | Double-click or keyboard-activate the project title rename path if available. | The edit field announces as the project name input; Escape cancels and Enter/blur saves without losing focus context. | pass/fail |
| 3 | Load the Logic Gates starter and move to Design. | Design canvas region, primary tools, and selected object controls have reachable names; no unlabeled critical buttons. | pass/fail, skipped controls |
| 4 | Move to Verify and inspect Course checks. | Expected-output authority announces Course checks as locked/read-only; Duplicate to My checks is reachable and named. | pass/fail |
| 5 | Duplicate to My checks, edit one expected output, and run Compare. | Editable cells/buttons have distinct names; PASS/FAIL/stale status is announced from the visible result authority, not only color. | pass/fail |
| 6 | Trigger or simulate a storage quota/recovery banner using the recovery gate path. | Recovery warning is announced as an alert; Download backup, Retry save, and Dismiss are named buttons. | pass/fail |
| 7 | Open Help / Diagnostics. | About and Diagnostics are separated; diagnostics copy action is reachable; engineering details are not mixed into normal surface navigation. | pass/fail |

Do not mark this review screen-reader complete until the table is filled from a real AT session. Automated axe/browser accessibility-tree checks are useful support evidence only.

## Attribution

Connor Angiel
