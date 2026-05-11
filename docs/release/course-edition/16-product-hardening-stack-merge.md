# Product Hardening Stack Merge

Date: 2026-05-11

## Scope

This pass merged and validated the RedByte product hardening stack:

- `product/verify-hardware-map-pins-hardening-1`
- `product/counter-verification-semantics-1`

No new product feature work, repo cleanup, MarcusRPI work, install-script work, manual work, or import/export recovery work was performed.

## Preflight

| Item | Result |
| --- | --- |
| Starting branch | `product/counter-verification-semantics-1` |
| Working tree before merge | Clean |
| `origin/main` before merge | `bb52211886bb5b246cff02d52577522baf1b08d2` |
| Verify/Hardware branch | `81ad74cda13cece1753f6179779f3cbace502387` |
| Counter semantics branch | `c77bb0baf40b01b863340052c52ccb38aedda7c1` |
| Safety branch | `backup/pre-product-hardening-stack-merge` |
| Remote authorization | User explicitly authorized push of validated `main` for this task; force-push remains disallowed. |

## Branch Ancestry

`origin/product/verify-hardware-map-pins-hardening-1` is an ancestor of `origin/product/counter-verification-semantics-1`.

Result: only the counter branch needed to be merged into `main`.

## Merge Result

| Item | Result |
| --- | --- |
| Merge command | `git merge --no-ff origin/product/counter-verification-semantics-1 -m "merge: product hardening verify hardware counter semantics"` |
| Merge commit | `2e6f60e7` |
| Conflicts | None |
| Product stack included | Verify/Hardware/Export trust hardening plus counter Compare certification |

## Post-Merge Source Audit

Path-level scan for Marcus/RPI/HQ/local-agent spillover found only retained or documented paths:

| Path | Classification | Action |
| --- | --- | --- |
| `api/server.mjs` | Existing generic API server file retained from prior boundary review | Keep |
| `artifacts/classroom-rc-v1/os/assets/*Hq*.js*` | Mixed historical release artifact names with incidental `hq` substring | Keep for separate artifacts review |
| `docs/release/course-edition/12-main-sync-and-marcus-rpi-separation.md` | Separation history doc | Keep |
| `docs/release/course-edition/13-marcus-rpi-hard-separation-and-main-sync.md` | Separation history doc | Keep |
| `packages/rb-fpga-bridge/boards/registry.json` | FPGA board registry, not Marcus/RPI session registry | Keep |

Package/script scan found no active `rb-marcus`, `rb-hq`, `local-agent`, `pi-session`, `marcus-doctor`, or `marcus-lab` references.

## Validation

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile up to date; pnpm 10.24.0 |
| `pnpm start:smoke` | PASS | Launcher served `http://127.0.0.1:5197/` with HTTP 200 |
| `pnpm -s ide:gate:ece141-starter-verify-export` | PASS | Logic Gates starter Verify -> Export gate passed |
| `pnpm -s ide:gate:ece141-product-immersion` | PASS | Four product immersion browser workflows passed |
| `pnpm -s ide:gate:ece141-counter-clock-export` | PASS | Counter clock/reset policy and E0 export wording gate passed |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | PASS | Manual Map Pins edit and starter recovery gate passed |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | PASS | 2-Bit Counter Compare passed and Export stayed E0-only |
| `pnpm -s ui:lab-starter-load-gate` | PASS | 8 starter-load tests passed |
| Focused Vitest suite | PASS | 67 tests passed across counter semantics, clock policy, Verify diagnostics, Hardware, and Export tests |
| `pnpm rb:doc:validate` | PASS | 36 passed, 0 failed before closeout doc edits |
| `pnpm rb:encoding:check` | PASS | No mojibake markers before closeout doc edits |
| `git diff --check` | PASS | No whitespace errors before closeout doc edits |
| `pnpm typecheck` | FAIL | Known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` type-boundary drift |
| `pnpm build:unified` | FAIL | Known build contract drift: `dist/_redirects contains root redirect to /os/` after playground build and merge completed |

## Evidence Boundary

The merged hardening stack proves RedByte browser behavior for:

- Logic Gates Verify -> Export
- Half Adder starter mapping and export readiness through existing product immersion coverage
- 2-Bit Up Counter clock/reset policy visibility
- 2-Bit Up Counter Compare pass semantics
- Hardware / Map Pins manual edit and stale-starter recovery
- E0-only export wording

It does not prove:

- Vivado build / bitstream evidence (E1)
- Basys3 board programming evidence (E2)
- Observed physical board behavior (E3)

## Remaining Known Failures

| Failure | Status | Next action |
| --- | --- | --- |
| `pnpm typecheck` | Pre-existing `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift | Separate type-boundary cleanup task |
| `pnpm build:unified` | Pre-existing redirect contract drift involving `dist/_redirects` root redirect to `/os/` | Separate build/deploy contract cleanup task |

## Next Recommended Sprint

Import/export round-trip and recovery sprint.
