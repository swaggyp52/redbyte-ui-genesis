---
doc_status: current
last_validated: 2026-06-23
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Project workspace contract
---

# RedByte Project Workspace V2

Project V2 is the command center for project identity and workflow continuity. It is not a metrics dashboard.

## Contract

The loaded Project first viewport must show:

- user-owned project identity with inline rename still available
- starter/course provenance and board as secondary context
- one dominant current action
- compact workflow progress for Design, Verify, Map Pins, and Export
- direct commands for Design, Verify, Map Pins, and Export
- secondary project actions for Build Fresh, starter choice, Import / Recover, recent work, and backup download

Normal student Project UI must not expose raw build hashes, E-tier proof language, generic side-rail controls, or repeated status cards.

## Authority

Project workflow state is consumed from existing project and Verify authority selectors, not rebuilt from local card copy. The V2 workflow strip renders plain statuses:

- Design: Not started, Ready, Changed
- Verify: Not run, Needs rerun, Failed, Passed, Observe only, Needs checks
- Map Pins: Missing, Partial, Complete
- Export: Blocked, Draft available, Ready

Project-changing actions continue to use existing runtime/store paths and the project storage facade boundary. This slice does not change project format, storage bytes, Verify semantics, mapping truth, export generation, or goldens.

## Proof

Current focused browser proof:

- `ide:gate:project-command-center-v2`
- `ide:gate:outer-workflow-continuity-v2`
- affected legacy guard: `ide:gate:project-loaded-command-surface`

Phase 5 screenshots are under `.redbyte/product-immersion/product-trust-reset-v2/phase-5/after/`.
