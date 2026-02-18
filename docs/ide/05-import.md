# Import Mode Spec

Status: Phase 1 v1
Mode ID: `import`

## Purpose

Import HDL/XDC safely with explicit diagnostics and Basys3 mapping guidance.

## Primary Actions (max 3)

1. Paste or upload HDL/XDC input.
2. Review parsed ports and mapping gaps.
3. Apply import into project state.

## Layout

1. Left input panel
- HDL input tab.
- XDC input tab.
- ZIP tab reserved/disabled until enabled by scope.

2. Main center
- Parsed ports table.
- Schematic preview panel.

3. Right inspector
- Diagnostics list (errors, warnings, suggestions).
- Basys3 pin suggestions.

## Empty State

Headline: `Import HDL or XDC`
Primary CTA: `Paste module text`
Secondary action: `Use minimal example snippet`

## Error State

Show deterministic diagnostics:

1. Parse errors with line hints.
2. Unmapped ports list.
3. Unsupported directives.

## Success State

`Import Ready` with:

1. Parsed module summary.
2. Mapping completeness percent.
3. Apply action enabled.

## Data Contract (RBProject)

Reads:

1. `name`
2. `description`
3. `circuit`
4. `hdl`
5. `fpga`
6. `ioMapping`
7. `vectors`
8. `layout`
9. `meta`
10. `probes`
11. `oscilloscope`
12. `recorder`
13. `traceMetadata`
14. `submodules`

Writes (guarded):

1. `name`
2. `description`
3. `circuit`
4. `hdl`
5. `fpga`
6. `ioMapping`
7. `vectors`
8. `layout`
9. `meta`
10. `probes`
11. `oscilloscope`
12. `recorder`
13. `traceMetadata`
14. `submodules`
