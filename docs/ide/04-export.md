---
doc_status: current
last_validated: 2026-05-02
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
Primary CTA: `Open Project - Map Pins`
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
3. Current Compare PASS with saved checks.
4. Download actions enabled.

Structurally valid packages may still be downloaded as draft Vivado packages, but the UI must not call them trusted until Verify passes and the package is current.

Verify freshness is based on the normalized Verify evidence signature shared with workflow authority. Helper-generated clock/testbench vector IDs do not make a passing run stale; actual stimulus, circuit, or mapping changes do.
When Verify evidence is stale, Export copy should name the real drift source at the student level: **design, testbench, or mapping changed since the last Compare run**. The repair path is **Open Verify**, not a generic refresh label.

## Batch 1 Product Audit Notes (2026-04-30)

- Supposed to do: generate real Vivado artifacts while making draft vs trusted handoff impossible to confuse.
- Current truth: custom mixed-gate and two-bit-counter rows build through real Vivado E1 with `top.vhd`, `top.xdc`, `.xpr`, Tcl, README/bring-up, and proof metadata preserved by the harness.
- Determinism change needed: keep paths short enough for Windows/Vivado certification output, and make official Vivado/XDC references visible in docs when they define product truth.
- Friction found: a dated long case ID (`fs-custom-mixed-gate-chain-2026-04-30`) failed in Vivado synthesis because the generated run path exceeded practical Windows/Vivado RTD path limits. Short case IDs (`b1-mixed`, `b1-counter`) passed E1.

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
