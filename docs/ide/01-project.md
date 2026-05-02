---
doc_status: current
last_validated: 2026-05-02
owner: Connor Angiel
used_by_claude: true
role: Project surface spec
---

# Project Mode Spec

Status: Phase 1 v1
Mode ID: `project`

## Purpose

Provide the Project dashboard/home surface: project truth, readiness, next-action routing, and starter/load paths before Design, Verify, Map Pins / Hardware, and Export.

## Primary Actions (max 3)

1. Edit project metadata (name, description).
2. Review the dashboard truth (identity/header, next action, metrics, mapping/export status).
3. Start fresh, open saved work, or open a starter example with explicit overwrite confirmation.

## Layout

1. Main dashboard
- Project identity/header.
- Next-action command strip.
- Metrics / readiness snapshot.
- Read-only mapping summary and export alignment truth.
- Collapsed **Project bridge & determinism** disclosure for low-level internals.

2. Secondary content
- Open-existing / recent-work recovery.
- Starter examples and build-fresh lanes on Project Home.
- Mapping summaries are read-only and label-first: board/resource labels appear before package pins, with Map Pins as the editing authority.

3. Supporting detail
- Project warnings and detail copy stay secondary to the dashboard story.

## Empty State

Headline: `Start your first Basys3 project`
Primary CTA: `Build fresh`
Secondary action: `Import HDL / Vivado ZIP`

## Error State

Show blocking issues as callouts with direct destination action:

1. Missing IO mapping -> `Open Map Pins`
2. Missing vectors -> `Add Vectors`

Destructive action guard:

1. Opening a starter example while unsaved work exists must require explicit confirmation.

## Success State

`Project Ready` / completed stage state is shown only when:

1. IO mapping is complete.
2. Verify has a current assertion-backed PASS.
3. The current export package is trusted, or the next action clearly says what proof is still missing.

## Batch 1 Product Audit Notes (2026-04-30)

- Supposed to do: explain the full product spine, project identity, current readiness, examples, and the next honest action.
- Current truth: Project is now a dashboard/home surface with read-only mapping/export truth and one dominant next action; low-level bridge internals are secondary behind a collapsed disclosure.
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
