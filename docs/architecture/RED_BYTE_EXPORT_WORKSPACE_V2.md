---
doc_status: current
last_validated: 2026-06-23
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Export workspace contract
---

# RedByte Export Workspace V2

Export V2 is an artifact workspace. The surface should read like a package/file inspector with direct actions, not a proof report.

## Contract

The Export workspace must expose:

- generated artifact tree or file list
- selected artifact preview
- package status and actions
- Build/Rebuild package
- Download package
- Copy selected file
- Download selected file where supported
- clear blocked/draft/ready states
- concise downstream Vivado handoff guidance

Normal Export UI must not imply Vivado synthesis, implementation, bitstream generation, board programming, or board observation has already happened. E-tier language remains outside normal student chrome and generated README/provenance bytes remain unchanged unless a separate generator slice proves a byte-level change.

## Authority

Export readiness remains derived from structural eligibility, Verify authority, mapping completeness, and current package state. This slice changes rendered organization and direct selected-file actions only.

The generated VHDL, XDC, testbench, Tcl, ZIP bytes, export goldens, and README/provenance artifact contents are unchanged by this V2 surface work.

## Proof

Current focused browser proof:

- `ide:gate:export-artifact-workspace-v2`
- `ide:gate:outer-workflow-continuity-v2`
- affected legacy guards: `ide:gate:export-package-inspector`, `ide:gate:export-handoff-station`, `ide:gate:export-trust-integrity`

Phase 5 screenshots are under `.redbyte/product-immersion/product-trust-reset-v2/phase-5/after/`.
