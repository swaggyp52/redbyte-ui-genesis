# Design Mode Spec

Status: Phase 1 v1
Mode ID: `design`

## Purpose

Build deterministic circuit graphs for Basys3-targeted projects.

## Primary Actions (max 3)

1. Add and wire components.
2. Edit selected node properties.
3. Save deterministic project state.

## Layout

1. Main center
- Circuit canvas with lightweight tool row (select, wire, delete, zoom).

2. Main left subpanel
- Searchable palette for gates, IO, and macros.

3. Right inspector
- Selected element properties.
- IO pin binding details for IO nodes.

## Empty State

Headline: `Build your first circuit`
Primary CTA: `Add input/output pins`
Secondary actions:

1. `Drop an AND gate`
2. `Open Palette`

## Error State

Use non-blocking callouts:

1. Invalid wire target.
2. Floating outputs.
3. Missing required IO nodes.

## Success State

`Design Saved` state with node count and connection count summary.

## Data Contract (RBProject)

Reads:

1. `circuit`
2. `layout`
3. `submodules`

Writes (guarded):

1. `circuit`
2. `layout`
3. `submodules`
