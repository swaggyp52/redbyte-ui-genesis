---
doc_status: current
last_validated: 2026-06-23
owner: Connor Angiel
used_by_claude: true
role: PR78 Product Trust Reset v2 human assistive technology review script
---

# RedByte Assistive Technology Human Script

This script is required human review work before any stronger accessibility claim for draft PR #78. It is not complete until a real assistive-technology session is run and the result table is filled.

Do not use this document to claim screen-reader certification by itself.

## Setup

Record:

- reviewer name or initials,
- date,
- operating system,
- browser and version,
- assistive technology and version,
- viewport and zoom,
- RedByte branch,
- RedByte build SHA,
- whether the profile was fresh or dirty/resumed.

Recommended first pass:

- Windows 11,
- Chrome or Edge,
- Narrator and/or NVDA,
- `1366x768` at 100 percent zoom,
- one repeat at 200 percent browser zoom for critical flows.

## Pass 1: Keyboard And Screen Reader

| Step | Action | Expected announcement / observation | Result |
|---|---|---|---|
| 1 | Open `/os/?mode=project&e2e=1`. | App name, project title, active mode, workflow progress, and Help control have usable names. | pending |
| 2 | Tab through Project first launch. | Build Fresh, starter choices, open/recover paths, and Help are reachable without pointer-only controls. | pending |
| 3 | Load Logic Gates and rename the project from top/project identity. | Project-name editor is labeled; Enter saves; Escape cancels; focus returns to a sensible control. | pending |
| 4 | Open Design and tab through tool controls. | Select, Wire, Add boundary I/O, Add AND, View/Tools, and canvas region have usable names and visible focus. | pending |
| 5 | Open Verify before running Compare. | Course checks are announced as locked/read-only; Duplicate to My checks is reachable and named. | pending |
| 6 | Duplicate to My checks, edit one expected output, and run Compare. | Editable cells have distinct names; PASS/FAIL/stale status is announced by text, not only color. | pending |
| 7 | Trigger a FAIL and use the first failing-check repair path. | The failing check, expected/observed distinction, and repair target are understandable. | pending |
| 8 | Open Map Pins and move through mapped rows. | Signal name, Basys3 resource, package pin, and selected-row state are reachable. | pending |
| 9 | Open Export, select artifacts, copy/download selected files, and inspect README. | Artifact list selection, preview label, copy/download status, and handoff boundary are announced. | pending |
| 10 | Open Import, choose Paste HDL, inspect source, cancel before Apply. | Stepper state, source selection, parser state, warning copy, and cancel/confirm boundaries are clear. | pending |
| 11 | Open Help / Diagnostics, copy support bundle, and close. | Dialog has a name, focus is trapped while open, close returns focus, and support details are not mixed into normal workflow navigation. | pending |

## Pass 2: Zoom And Contrast

At 200 percent browser zoom or Windows text scaling, repeat:

- Project first launch,
- Verify Course/My-check authority,
- Export artifact selection and preview,
- Import Review/Apply boundary,
- Help / Diagnostics close path.

Record any clipped controls, hidden focus rings, overlapping text, or required horizontal mini-scroll.

## Pass 3: Keyboard-Only Recovery

Use only the keyboard:

| Step | Action | Expected result | Result |
|---|---|---|---|
| 1 | Start with a loaded project and reload. | Project identity and active mode recover. | pending |
| 2 | Navigate Project -> Design -> Verify -> Map Pins -> Export -> Import and back. | Focus remains visible and modes are reachable. | pending |
| 3 | Use Import and cancel before Apply. | Current project remains unchanged. | pending |
| 4 | Open Diagnostics and close. | Focus returns to the triggering Help control or next sensible location. | pending |

## Blocking Criteria

Classify as P1 before non-draft if:

- a primary student action is pointer-only,
- the current result/pass/fail/stale state is not available as text,
- the Import replacement boundary cannot be understood or canceled,
- Help / Diagnostics traps focus or cannot be closed,
- project rename cannot be completed or canceled by keyboard,
- Export file selection/preview cannot be operated without a mouse.

Classify as P2 if:

- labels are understandable but verbose,
- focus order works but feels inefficient,
- a secondary panel is dense but recoverable,
- support-only diagnostic details are understandable but too technical.

## Outcome

Until this script is actually run, PR #78 remains:

`READY FOR REVIEW, KEEP DRAFT`

It is not accessibility-certified.

## Attribution

Connor Angiel
