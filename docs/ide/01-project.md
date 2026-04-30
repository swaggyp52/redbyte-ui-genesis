---
doc_status: current
last_validated: 2026-04-28
owner: Connor Angiel
used_by_claude: true
role: Project surface spec
---

# Project Mode Spec

Status: Phase 1 v1
Mode ID: `project`

## Purpose

Provide project truth and readiness overview before design, verify, map pins, and export.

## Primary Actions (max 3)

1. Edit project metadata (name, description).
2. Review readiness (IO mapping, vectors, export status).
3. Open a starter example profile with explicit overwrite confirmation.

## Layout

1. Main: summary cards
- Project identity card.
- Basys3 target card.
- Determinism hash card.
- Last verification card.

2. Secondary content
- File manifest panel.
- IO mapping completeness panel.
- Mapping summaries are read-only and label-first: board/resource labels appear before package pins, with Map Pins as the editing authority.
- Vector summary panel.
- Starter examples panel (tags, expected behavior, open action).

3. Right inspector
- Project settings and warnings list.

## Empty State

Headline: `Start your first Basys3 project`
Primary CTA: `Open Design Mode`
Secondary action: `Import HDL`

## Error State

Show blocking issues as callouts with direct destination action:

1. Missing IO mapping -> `Open IO Mapping`
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
- Current truth: Project now shows board mapping truth and export readiness, but it still relies heavily on starter/gallery paths for proof and can show "available export" before trusted Compare evidence.
- Determinism change needed: keep Project language explicitly split between draft export, trusted export, Vivado build proof, board programming proof, and board observation proof.
- Friction found: a browser mapping rehearsal still expected Project to own editable pin inputs even though Map Pins / Hardware is now the mapping authority. The gate must be updated to click the Map Pins path instead of old Project edit controls.

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
