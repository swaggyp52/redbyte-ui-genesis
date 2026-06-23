---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Map Pins workspace contract
---

# RedByte Map Pins Workspace V2

Map Pins V2 is a deterministic signal-to-board binding workspace. The mapping table and Basys3 board must remain visible together, and selected mapping consequences must be local to the row/board relationship.

## Current Contract

- The workspace opens as a two-pane mapping task: table left, Basys3 board right.
- The table/board split stays near balanced classroom proportions at `1366x768` and `1440x900`.
- Selecting a mapping row highlights the exact board resource.
- The selected row exposes inline status, selected resource, and XDC consequence context.
- Clicking a compatible board resource assigns the selected row without changing pin-mapping semantics.
- Resource summaries and support information must not overlay or block the board.

## State Authority

Map Pins V2 does not introduce a new mapping truth source.

| Concern | Authority |
|---|---|
| User mapping | runtime `hardwareMappingV2` |
| Compatibility projection | runtime `projectIoRows` bridge |
| Board resources and package pins | Basys3 board source modules |
| Selected row/resource context | Hardware surface view state derived from current mapping and board profile |
| Export mapping summary | existing export/project workflow authority |

## Proof

- `ide:gate:map-pins-workspace-v2`
- affected Hardware gates such as `ide:gate:hardware-board-dominance`, `ide:gate:hardware-board-unblocked`, and `ide:gate:hardware-resource-catalog-not-obstructing`
- screenshots under `.redbyte/product-immersion/product-trust-reset-v2/phase-4/`

## Non-Goals

This contract does not change pin mapping truth, generated XDC, generated ZIP bytes, Verify semantics, project format, goldens, Vivado proof, or Basys3 proof.

## Attribution

Connor Angiel
