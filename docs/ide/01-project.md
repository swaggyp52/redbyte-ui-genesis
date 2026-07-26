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

## Purpose

Provide an action-first entry plus a useful engineering overview of the loaded student project. The surface must name project identity and goal, recommend one next action, and show current Design, Verify, Map Pins, and Export truth without becoming a second editor for those stages.

## Primary Actions (max 3)

1. Start a lab or follow the loaded project's single recommended next action.
2. Open the owning Design, Verify, Map Pins, or Export surface from the project workspace row.
3. Open Change Project for Build Fresh, starter, Import/recovery, or existing-work paths; destructive replacement still requires explicit confirmation.

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
- Map Pins row reports the authoritative required-signal assignment count and opens Map Pins; Project never edits mapping.
- Export row reports blocked, draft-available, or current-package state and opens Export.

3. Secondary content
- Open-existing / recent-work recovery after the relevant disclosure is opened.
- Gannon Pilot Labs 1-5 with build, difficulty, submission, proof-scope, and start controls inside the disclosed lab pack.
- Starter examples and all-lab browsing inside disclosed catalogs; a loaded project keeps these paths behind `Change Project`.
- Mapping summaries remain read-only and label-first: board/resource labels appear before package pins, with Map Pins as the editing authority.

4. Supporting detail
- Project warnings, metrics, status evidence, and bridge/determinism copy stay secondary to the current action.

## Empty State

Headline: `Start your circuit`
Primary path: `Start a Lab`
Peer paths: `Build Fresh`, `Open Starter`, `Import Project`, `Open Existing`
Neutral state: no circuit loaded; no mapping/export failure copy before a circuit exists.

## Error State

Show blocking issues as callouts with direct destination action:

1. Missing IO mapping -> `Open Map Pins`
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
- The full RedByte-owned flow is visible as Project -> Design -> Verify -> Map Pins -> Export. Import / Recover remains a separate recovery utility.
- Mapping and package state shown here are projections of their owning authorities; all edits route to Map Pins or Export.
- Historical pre-sequential checkpoint `f4f7ca8f35f79258fe8f2ff6ecbc68600784efb7` passed the earlier 36-file/477-test matrix. Current integrated pre-doc checkpoint `0788044cbdf2699520d90a3428f2e5034dc73cab` passes the touched 20-file/258-test authority matrix, typecheck, unified build, and the current focused release gates. Final reconstructed exact-SHA certification remains pending.

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
