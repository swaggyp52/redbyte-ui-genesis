---
doc_status: current
last_validated: 2026-04-28
owner: Connor Angiel
used_by_claude: true
role: Export surface spec
---

# Export Mode Spec

Status: Phase 1 v1
Mode ID: `export`

## Purpose

Act as compiler-like export authority for Basys3 Vivado artifacts while distinguishing draft artifacts from trusted verified handoff.

## Primary Actions (max 3)

1. Validate export readiness and trust tier.
2. Preview generated artifacts.
3. Export deterministic artifacts.

## Layout

1. Top readiness strip
- `READY`, `WARNING`, or `BLOCKED` state.
- Blocking issue count.

2. Main center
- Artifact tree with preview panes (`top.vhd`, `top.xdc`, README).

3. Right inspector
- Pin table.
- Validation and warning list.
- Mapping rows are read-only and display board labels before package pins, for example `SW0 (pin V17)`, while generated constraints still use the resolved package pin.

## Empty State

Headline: `Project is not export-ready`
Primary CTA: `Fix IO mapping in Project Mode`
Secondary action: `Open validation details`

## Error State

Hard block export when:

1. Missing IO mapping.
2. Unsupported nodes for synthesis.
3. Missing top-level constraints.

Each error must include a direct fix path.

## Success State

`Export Ready` / trusted handoff with:

1. Artifact count.
2. Deterministic export hash.
3. Current assertion-backed Verify PASS.
4. Download actions enabled.

Structurally valid packages may still be downloaded as draft Vivado packages, but the UI must not call them trusted until Verify passes and the package is current.

## Data Contract (RBProject)

Reads:

1. `hdl`
2. `fpga`
3. `ioMapping`
4. `meta`
5. `circuit`

Writes (guarded):

1. `hdl`
2. `fpga`
3. `ioMapping`
4. `meta`
