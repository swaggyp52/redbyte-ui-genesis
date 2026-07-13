---
doc_status: current
last_validated: 2026-07-13
owner: Connor Angiel
used_by_claude: true
role: Project surface spec
---

# Project Mode Spec

Status: Current professional recomposition
Mode ID: `project`

## Purpose

Provide the action-first Project entry: one dominant start or continue action, a direct Verify route when work is loaded, and deliberately disclosed starter, recent, replacement, and recovery paths before Design, Verify, Map Pins / Hardware, and Export.

## Primary Actions (max 3)

1. Start a lab or continue the loaded design.
2. Open Verify directly when a loaded project is ready for that handoff.
3. Open the relevant disclosure for starter catalogs, recent work, replacement paths, or Import/recovery; destructive replacement still requires explicit confirmation.

## Layout

1. Action-first Project workbench
- First launch leads with `Start your circuit` and one primary `Start a Lab` action. `Build Fresh`, `Open Starter`, `Import Project`, and `Open Existing` remain visible secondary paths.
- The starter catalog, recent-project list, all-lab gallery, and Gannon Pilot pack stay collapsed until the student asks for them.
- Loaded Project leads with one `Continue Design` action and a direct `Open Verify` route when available.
- Loaded replacement/recovery paths live behind `Change Project`; opening it reveals guarded Build Fresh, course starter, Import/recovery, and recent-work choices.
- Project identity remains directly editable, but mapping/export truth and low-level bridge/determinism details stay secondary or disclosed.

2. Secondary content
- Open-existing / recent-work recovery after the relevant disclosure is opened.
- Gannon Pilot Labs 1-5 with build, difficulty, submission, proof-scope, and start controls inside the disclosed lab pack.
- Starter examples and all-lab browsing inside disclosed catalogs; a loaded project keeps these paths behind `Change Project`.
- Mapping summaries remain read-only and label-first: board/resource labels appear before package pins, with Map Pins as the editing authority.

3. Supporting detail
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
