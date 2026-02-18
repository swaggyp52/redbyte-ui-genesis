# Project Mode Spec

Status: Phase 1 v1
Mode ID: `project`

## Purpose

Provide project truth and readiness overview before design, verify, and export.

## Primary Actions (max 3)

1. Edit project metadata (name, description).
2. Review readiness (IO mapping, vectors, export status).
3. Navigate to next step (`Go to Design`).

## Layout

1. Main: summary cards
- Project identity card.
- Basys3 target card.
- Determinism hash card.
- Last verification card.

2. Secondary content
- File manifest panel.
- IO mapping completeness panel.
- Vector summary panel.

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

## Success State

`Project Ready` badge shown when:

1. IO mapping is complete.
2. Vectors exist.
3. No blocking export errors.

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
