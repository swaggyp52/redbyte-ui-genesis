---
doc_status: current
last_validated: 2026-06-23
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Import workspace contract
---

# RedByte Import Workspace V2

Import V2 is a guarded recovery workflow. It must make the transaction boundary obvious: inspect first, resolve problems, review replacement, then apply.

## Contract

The Import workflow uses five steps:

1. Choose source
2. Inspect
3. Resolve
4. Review replacement
5. Apply

The first look must show direct source choices instead of passive recovery cards. The active workbench must keep the source editor/review object in the first viewport at classroom sizes.

Nothing may modify the active project before review and explicit apply. Failed or malformed imports must leave the current project intact.

## Authority

Import source selection, parsing, validation, review, and apply continue to use the existing Import surface state and review/apply boundary. This slice changes rendered workflow hierarchy and transactional copy only.

It does not change parser behavior, import apply semantics, project format, ProjectStorageFacade boundaries, Verify semantics, mapping truth, generated artifacts, or goldens.

## Proof

Current focused browser proof:

- `ide:gate:import-step-workflow-v2`
- affected legacy guards: `ide:gate:import-guided-recovery-wizard`, `ide:gate:import-guided-recovery-workflow`

Phase 5 screenshots are under `.redbyte/product-immersion/product-trust-reset-v2/phase-5/after/`.
