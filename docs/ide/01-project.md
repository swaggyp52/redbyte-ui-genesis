---
doc_status: current
last_validated: 2026-07-22
owner: Connor Angiel
used_by_claude: true
role: Project surface spec
---

# Project Mode Spec

Status: Unified Workbench v3 RC source contract - project overview and workflow authority
Mode ID: `project`


## Current P2.6B document and ledger ownership (2026-09-12)

The explorer owns Overview, Sources, Architecture, Runs and Compile Order. Visiting those
roots creates no tabs; source previews remain genuine secondary documents. Inspectors follow
Project selections and the active document, including deliberate module/source cross-probes.
Runs groups the full retained configuration triple and displays output digests, counts and
an exact-recording Inspect action. The newest entry's currentness uses workflow authority,
independent of whichever historical recording is selected for investigation. Problems start
as an explorer count/disclosure; the bottom Problems ledger remains canonical.

## Purpose

Provide an action-first entry plus a useful engineering overview of the loaded student project. The surface must name project identity and goal, recommend one next action, and show current Design, Simulate, Board & Constraints, and Build & Export truth without becoming a second editor for those stages.

## Primary Actions (max 3)

1. Start a lab or follow the loaded project's single recommended next action.
2. Open the owning Design, Simulate, Board & Constraints, or Build & Export workspace from the project workspace row.
3. Open Change Project for Build Fresh, starter, Import/recovery, or existing-work paths; destructive replacement still requires explicit confirmation.

> **Superseded below (2026-09-07).** "Layout", "Empty State" and the two audit-note sections
> describe the single action-first screen with a `Change Project` disclosure. Project is now two
> experiences; read **Two-state Project** at the end of this file first, and treat the older
> sections as history except where they are restated there. The Error State guards and the Data
> Contract remain current.

## Layout

1. Action-first Project workbench
- First launch leads with `Start your circuit` and one primary `Start a Lab` action. `Build Fresh`, `Open Starter`, `Import Project`, and `Open Existing` remain visible secondary paths.
- Starter and existing-project catalogs stay secondary until the student asks for them.
- Loaded Project leads with editable identity, project summary and expected behavior, professional facts, one recommended next action, and a textual engineering workspace.
- Loaded replacement/recovery paths live behind `Change Project`; opening it reveals guarded Build Fresh, course starter, Import/recovery, and recent-work choices.
- Project identity remains directly editable, but mapping/export truth and low-level bridge/determinism details stay secondary or disclosed.

2. Current-project engineering overview
- Design row reports node/connection counts, top-level inputs and outputs, and opens Design.
- Verification row reports current Compare truth and opens Verify.
- Board & Constraints row reports the authoritative required-signal assignment count and opens Board & Constraints; Project never edits mapping.
- Export row reports blocked, draft-available, or current-package state and opens Export.

3. Secondary content
- Open-existing / recent-work recovery after the relevant disclosure is opened.
- Gannon Pilot Labs 1-5 with build, difficulty, submission, proof-scope, and start controls inside the disclosed lab pack.
- Starter examples and all-lab browsing inside disclosed catalogs; a loaded project keeps these paths behind `Change Project`.
- Mapping summaries remain read-only and label-first: board/resource labels appear before package pins, with Board & Constraints as the editing authority.

4. Supporting detail
- Project warnings, metrics, status evidence, and bridge/determinism copy stay secondary to the current action.

## Empty State

Headline: `Start your circuit`
Primary path: `Start a Lab`
Peer paths: `Build Fresh`, `Open Starter`, `Import Project`, `Open Existing`
Neutral state: no circuit loaded; no mapping/export failure copy before a circuit exists.

## Error State

Show blocking issues as callouts with direct destination action:

1. Missing IO mapping -> `Open Board & Constraints`
2. Missing vectors -> `Add Vectors`

Destructive action guard:

1. Opening a starter example while unsaved work exists must require explicit confirmation.
2. Starting a fresh blank project from a loaded project must require explicit confirmation with copy that says Cancel keeps current work and Confirm means replace current work.
3. If the loaded project is already blank/custom, canceling the confirmation must preserve the current work; confirming must create a new empty Basys3 blank project rather than continuing the existing blank/custom state.
4. If the loaded project is an applied import, canceling the confirmation must preserve the imported graph, I/O rows, mapping, and name; confirming must create a new empty Basys3 blank project and clear stale import metadata, import URL state, Verify/export state, and old imported identity.

## Success State

`Project Ready` / completed stage state is shown only when:

1. IO mapping is complete.
2. Verify has a current assertion-backed PASS.
3. The current export package is trusted, or the next action clearly says what proof is still missing.

## Batch 1 Product Audit Notes (2026-04-30)

- Supposed to do: explain the full product spine, project identity, current readiness, examples, and the next honest action.
- Current truth: Project is an action-first entry surface. First launch leads with `Start a Lab` and disclosed catalogs/recent work; loaded Project leads with `Continue Design`, keeps `Open Verify` direct, and places replacement/recovery alternatives behind `Change Project`. Low-level bridge internals remain secondary behind a collapsed disclosure.
- Next-action framing rule: when Verify is the required next step, the dominant Project card frames Verify as next and keeps export availability in secondary summary/status fields.
- Determinism change needed: keep Project language explicitly split between draft export, trusted export, Vivado build proof, board programming proof, and board observation proof.
- Friction found: additive UI pieces such as the bridge disclosure need direct tests so later cleanup passes do not pull diagnostics back into the primary dashboard story.

## Unified Workbench v3 RC source authority (2026-07-22)

- Project is no longer an empty chooser after work is loaded. `ide-project-professional-overview` is the stable overview workspace for the student's actual project.
- The full RedByte-owned flow is visible as Project -> Design -> Simulate -> Board & Constraints -> Build & Export. Import / Recover remains a separate recovery utility.
- Mapping and package state shown here are projections of their owning authorities; all edits route to Board & Constraints or Build & Export.
- Historical pre-sequential checkpoint `f4f7ca8f35f79258fe8f2ff6ecbc68600784efb7` passed the earlier 36-file/477-test matrix. Current integrated pre-doc checkpoint `0788044cbdf2699520d90a3428f2e5034dc73cab` passes the touched 20-file/258-test authority matrix, typecheck, unified build, and the current focused release gates. Final reconstructed exact-SHA certification remains pending.

## Two-state Project (2026-09-07, current)

Project answers a different question depending on whether work is open. Which state appears is a
fact about the project's lifecycle - the same judgement the autosave guard makes - and is never
inferred from whether the circuit has components, whether there are problems, or what the project
is called. The launcher placeholder nobody chose is not open work; a blank project a person
deliberately created is.

### Start (`ide-project-landing`) - nothing is open

- Answers "what am I going to work on?".
- Sections: Recent, Course labs, Starters, Imported, Recover, each with its own count. Peer actions
  for `Import project…`, `Open saved…` and `Blank project`.
- The reader's own saved work is the primary section whenever there is any; otherwise Course labs.
  The default follows the loaded data until the reader chooses a section themselves.
- Selecting an entry previews it. Browsing is reading: nothing is applied until the entry's own
  primary action is pressed.
- A lab preview carries what is needed to choose - the purpose, what is provided, what you will do.
  Submission instructions, proof scope and the full expected behaviour are behind `Full lab brief`.
- Nothing is invented. A first visit lists no recent projects, and a reload does not add one.

### Overview (`ide-project-overview-document`) - a project is open

Reads recognise -> resume -> understand -> inspect:

1. `rb-project-identity` - the project's name, its save state, and **one** continuation
   (`ide-project-continue`) that follows where the reader last worked. Overview never nominates
   itself and imposes no stage march.
2. `rb-project-stage` - the circuit at full width, centred, capped at 52vh with a legibility floor,
   with the Top entity editable in the canvas footer beside `Open in Design` and `Architecture`;
   and beside it three status lines (`ide-project-fact-simulation`, `-mapping`, `-package`), each
   linking to the workspace that owns it, plus the single problem most worth attention with a route
   to the place that fixes it.
3. Four closed disclosures - `ide-project-details`, `ide-project-io-details`,
   `ide-project-starter-brief`, `ide-project-problems`. Nothing was deleted to compose this.

The status lines are a projection of the facts the project already derives. Project does not
calculate readiness a second time, and it never edits mapping or package state.

### Lifecycle

- **Close** saves the project, returns to Start, and leaves nothing open - not a blank project.
- **Resume** from Start reopens that project with its work and evidence, not a fresh copy of the
  lab it came from.
- **Blank** opens on the sheet in Design and gets its own Overview when the reader comes back to
  Project.
- Project management (Save, Save As, Duplicate, Open, Build Fresh, Close, Open Starter) lives in the
  File menu and the command palette. Project does not carry a second command surface.

### Shared panel

The bottom panel is the shell's, not Project's. It exists on every workspace, opens from the status
bar's problems count, can be put away and got back, and keeps its preference per surface: opening
Problems on Project is not a statement about Design, and returning to a surface restores what that
surface was left in.

### Proof

`packages/rb-e2e/project-experience-journey.mjs` drives all of the above through the interface at
1440x900 and 1280x650; `bottom-panel-zoom-probe.mjs` covers the shared panel on all five workspaces
at 100/125/150/200% browser zoom.

## Data Contract (RBProject)

Reads:

1. `name`
2. `description`
3. `meta`
4. `layout`
5. `ioMapping`
6. `vectors`
7. `traceMetadata`

Writes (guarded):

1. `name`
2. `description`
3. `meta`
4. `layout`
