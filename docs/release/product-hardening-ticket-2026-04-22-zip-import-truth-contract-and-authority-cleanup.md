# Product Hardening — ZIP import truth contract + import authority (Campaign D)

- **Title:** ZIP import truth contract + import authority cleanup
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** IDE Import (ZIP path, handoff to Project/Design/Export)
- **Journey segment:** Student import → review → replace project → downstream surfaces
- **Mode:** product / repo-health
- **Environment:** local dev, `pnpm` workspace

## Problem

- **Observed:** The IDE ZIP import gate (`ide:gate:zip-import-contract` / `repo:status`) failed on a **frozen digest** of the full `RBProject`, which is opaque to students and drifts on any project meta field.
- **Observed:** Import could show **split truth** (ZIP summary vs manifest callout vs diagnostics) without one obvious “authoritative” first-look story.
- **Expected:** A **structural, student-meaningful** contract (paths, mode, reconstruction, export-readiness) plus **stability** (same bytes → same digest) where useful.
- **Expected:** One clear “what RedByte did / what to do next / when replace happens” panel on ZIP inspect.
- **Why this matters:** Import → Project → Design → Export → Vivado must stay **honest**; repo-health on this path preserves trust in student handoff.
- **Severity:** high (gate failure + handoff trust)

## Reproduction (gate)

- `pnpm -s ide:gate:zip-import-contract` (runs `packages/rb-apps/src/__tests__/ide-zip-import-contract.test.ts`)
- `pnpm -s repo:status` (includes the same import contract step)

## Truth sources

- `docs/contracts/RedByte_Product_Contract.md`, `docs/manuals/RedByte_Product_Manual.md`, `docs/IDE_SYSTEM_MAP.md`
- `packages/rb-apps/src/apps/ide/zipImport.ts` — `ZipImportInspection`
- Gate: `scripts/gates/ide-zip-import-contract.mjs`

## Acceptance proof (Campaign D)

- [x] **Part A — Contract:** No brittle full-project hash constant; structural assertions on the Vivado fixture; `digestValue(imported.project)` equal across duplicate imports; export view model `ok` with expected artifacts.
- [x] **Part B — Authority:** Single **ZIP Inspection** owner story (`ide-import-zip-authority`) for manifest and reconstructed paths: loaded top, XDC, ignored count, replace-project guardrails, classroom copy for blocked / ports-only / full runnable.
- [ ] **Deferred optional:** Deeper E2E on nested class ZIPs; copy pass on `Compiler` row in diagnostics (classroom vs internal labels) if still confusing in runtime.
- [x] **Validation:** `pnpm exec vitest run` (contract + `importSurfaceZipAuthority` + import surface spot tests) + `pnpm build:unified` + `pnpm -s ide:gate:zip-import-contract`.

## Disposition

- **Status:** in progress → update to **fixed** when Campaign D is closed in `AI_STATE.md`
- **Commits:** see final campaign report (local SHAs in order)
- **Notes:** Remote sync is out of scope for this environment; re-land by cherry-pick or rebase of listed files.

## Attribution

Connor Angiel
