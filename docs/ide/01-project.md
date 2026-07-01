---
doc_status: current
last_validated: 2026-07-01
owner: Connor Angiel
used_by_claude: true
role: Project surface spec
---

# Project Mode Spec

Status: Phase 1 v1
Mode ID: `project`

## Purpose

Provide the Project command center: one current project state, one primary next action, and visible paths for Start a Lab, blank work, starter examples, saved/recent work, and Import/recovery before Design, Verify, Map Pins / Hardware, and Export.

## Primary Actions (max 3)

1. Edit project metadata (name, description).
2. Review the dashboard truth (identity/header, next action, metrics, mapping/export status).
3. Continue current work, start a Gannon Pilot lab, start fresh, open saved work, open a starter example, or enter Import/recovery with explicit replacement confirmation where existing work would be replaced.

## Layout

1. Main dashboard
- Project identity/header.
- Next-action command strip whose status frame, headline, and primary CTA all point at the same required next step.
- Metrics / readiness snapshot.
- Peer entry paths for Continue, Start a Lab, Build Fresh, Open Starter, Import / Recover, and Open Recent once a project is loaded.
- Compact `What do I do next?` guide rail that names the current Project options.
- Read-only mapping summary and export alignment truth.
- Collapsed **Project bridge & determinism** disclosure for low-level internals.

2. Secondary content
- Open-existing / recent-work recovery.
- Gannon Pilot Labs 1-5 on Project Home with visible build, difficulty, submission, proof-scope, and start controls.
- Starter examples and build-fresh lanes on Project Home, with starter browsing collapsed by default once a project is loaded.
- Mapping summaries are read-only and label-first: board/resource labels appear before package pins, with Map Pins as the editing authority.

3. Supporting detail
- Project warnings and detail copy stay secondary to the dashboard story.

## Empty State

Headline: `Project command center`
Primary path: `Start a Lab`
Peer paths: `Build fresh`, `Open Starter`, `Open Saved Project`, `Import / Recover`
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
- Current truth: Project is now a dashboard/home surface with read-only mapping/export truth and one dominant next action; low-level bridge internals are secondary behind a collapsed disclosure.
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
