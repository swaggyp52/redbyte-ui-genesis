---
doc_status: current
last_validated: 2026-06-28
owner: Connor Angiel
used_by_claude: true
role: Export surface spec
---

# Export Mode Spec

Status: Phase 1 v1
Mode ID: `export`

## Purpose

Act as the compiler-like Export handoff station for Basys3 Vivado artifacts while distinguishing draft artifacts from trusted verified E0 handoff.

## Primary Actions (max 3)

1. Validate export readiness and trust tier.
2. Preview generated artifacts and package handoff facts.
3. Build or download deterministic artifacts.

## Layout

1. Top handoff station
- Exactly one visible Export handoff station owns Draft / Needs Review, Ready to Build, and Trusted package state.
- The station shows the consequence sentence, one primary repair/build/download action, compact mapping/provenance facts, and visible package handoff content.
- Trusted post-download state stays download-oriented; it must not make hardware programming the primary Export action.

2. Main center
- Artifact tree with preview panes (`top.vhd`, `top.xdc`, README).
- Compact Vivado evidence diagnostics that separate E0 package generation, E1 Vivado build/bitstream, E2 board programming, and E3 observed behavior.

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

`Ready to Build` means RedByte has current browser-side prerequisites for an E0 package but has not yet produced the current bundle in the session. `Trusted` means the current Compare PASS, mapping, and current package agreement are present. In both states the primary station action remains build/download.

Export must also keep downstream Vivado/bench evidence separated:

1. **E0** - RedByte generated the Vivado package artifacts.
2. **E1** - Vivado synthesis, implementation, and bitstream evidence exists outside RedByte.
3. **E2** - Board programming evidence exists outside RedByte.
4. **E3** - Physical board behavior was observed and recorded.

E2 programming success must never imply E3 behavior proof. When no bench classifier output is attached to the browser session, Export should say so plainly and keep E1/E2/E3 as external/manual evidence.

`ide:gate:blank-adder-authoring-depth` guards the from-scratch 4-bit adder E0 package path: Hardware mapping must agree with Export, generated previews must expose `README.txt`, `top.vhd`, `top.xdc`, and `testbench.vhd`, the downloaded ZIP must contain the expected package files, and README copy must preserve the E0-only boundary.

Verify freshness is based on the normalized Verify evidence signature shared with workflow authority. Helper-generated clock/testbench vector IDs do not make a passing run stale; actual stimulus, circuit, or mapping changes do.
When Verify evidence is stale, Export copy should name the real drift source at the student level: **design, testbench, or mapping changed since the last Compare run**. The repair path is **Open Verify**, not a generic refresh label.

For Basys3 board-clock exports, generated `testbench.vhd` now includes a dedicated free-running clock process for the detected board clock port (for example `CLK100MHZ` on `W5`) and samples stimulus against `rising_edge(...)` waits instead of requiring manual clock assignments in every vector. The current repo only ships the VHDL testbench generation path; there is no separate Verilog testbench generator to update in this slice.

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
