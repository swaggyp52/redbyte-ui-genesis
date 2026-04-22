# Product Hardening Ticket — Browser boot top blocker (lazy surface chunk failure)

## Ticket

- **Title:** Lazy IDE surfaces: chunk load failures must hit ErrorBoundary (no silent half-boot)
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** IDE shell (`IdeApp` mode switching)
- **Journey segment:** Cold boot / mode switch into Design, Verify, Hardware, Export, Import
- **Mode:** All lazy-loaded modes (not Project)
- **Environment:**
  - Fresh machine / clean browser profile: **relevant** (cache/CDN failures mimic chunk 404/abort)
  - OS: Windows 10+
  - Browser: Chromium-family (Playwright repro)
  - Node: repo-pinned
  - pnpm: repo-pinned
- **Obsidian note:** (none)
- **Linked GitHub issue:** [#77](https://github.com/redbyte-ai/redbyte-ui/issues/77) — SEV-1 boot stabilization (CLI `gh issue view` returned 401 in triage; treat link as intent, not fetched body)

## Problem

- **Observed behavior:** When a lazy surface chunk fails to load (network abort, stale deploy, ad blocker, etc.), the IDE shell (`ide-root`, rail, chrome) could remain visible while the active mode surface never mounted. There was no reliable **ErrorBoundary** fallback and no clear “something broke” surface — a **half-boot** that strands students.
- **Expected behavior:** Any lazy mode failure should surface the same class of recovery UX as a render throw: **ErrorBoundary** fallback (with existing test id / beacon hooks), not an empty column.
- **Why this matters:** Boot stability is a SEV-1 product contract; silent failure is worse than a visible error because support and students cannot tell whether the app or the network failed.
- **Severity:** **SEV-1** (recovery / trust)

## Reproduction

- **Exact repro steps (engineering):**
  1. Build playground: `pnpm --filter @redbyte/playground build`
  2. Serve preview (e.g. `vite preview` on the playground `dist` with base path including `/os/`)
  3. Open `?mode=design` while **aborting** fetches whose URL matches `*DesignSurface*.js` (simulates failed chunk load)
  4. **Before fix:** `ide-root` present, Design not mounted, no boundary fallback
  5. **After fix:** `error-boundary-fallback` (or equivalent boundary marker) and `window.__RB_ERROR_BOUNDARY_HIT__` set
- **Reproducibility:** always (deterministic with route abort)
- **First known version or date:** surfaced in 2026-04-22 browser-first Phase 1 boot triage

## Evidence

- **Root cause:** Outer `<Suspense>` wrapped the mode tree with `<ErrorBoundary>` **inside** the suspended subtree. For `React.lazy()` **rejection**, the error is not handled as a child throw in a position where the inner boundary could catch it reliably — students saw shell without surface.
- **Fix:** Per lazy mode branch: **`<ErrorBoundary><Suspense fallback={…}>…lazy surface…</Suspense></ErrorBoundary>`** (`design`, `verify`, `hardware`, `export`, `import`). **Project** unchanged (eager `ProjectSurface`).
- **Test / gate output:** `node scripts/diag/browser-boot-chunk-fail.mjs` → `errorBoundaryFallback: true`, `boundaryHit: true` (local diagnostic; not shipped in this slice)

## Truth Sources

- **Target truth clause(s):** `docs/contracts/RedByte_Product_Contract.md` — honest failure surfaces; no false “ready” states
- **Current truth doc(s):** `docs/manuals/RedByte_Product_Manual.md`
- **System map / ownership:** `docs/IDE_SYSTEM_MAP.md` — `IdeApp` owns mode shell and lazy surface wiring

## Acceptance Proof

- **Minimum acceptance proof:** Simulated Design chunk abort shows ErrorBoundary fallback, not blank workspace
- **Required test / gate command(s):**
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/ideApp.labday-wiring.test.tsx --fileParallelism false` (includes corrected Export step: wait for `ide-export-testbench-source`; no `ide-workbench-dock-toggle-right` — Export keeps the right inspector expanded)
  - `pnpm --filter @redbyte/playground build`
  - `pnpm build:unified`
- **Required manual proof:** Optional local chunk-abort script or DevTools block of `DesignSurface-*.js` on `?mode=design`

## Docs Review

- **Docs that must be reviewed if behavior changes:** `docs/IDE_SYSTEM_MAP.md`, `docs/ide/SURFACE_CONFORMANCE.md`
- **Docs that must be updated if behavior changes:** Only if product truth changes (this slice is wiring/ordering only; no student-facing copy change)

## Risk register (3 rows)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Double loading spinners if boundaries nest wrong | Low | Low | One Suspense per mode branch; Project unchanged |
| Regression in mode switch performance | Low | Low | Same lazy imports; only wrapper order changed |
| E2E assumes no boundary on first paint | Low | Med | Lab-day tests assert wiring; extend if a test assumed blank failure |

## Disposition

- **Status:** fixed (pending merge)
- **Fix PR / commit:** `IdeApp.tsx` — ErrorBoundary outside Suspense per lazy mode
- **Notes:** Aligns with React expectations for lazy rejection vs suspense fallback

## Attribution

Connor Angiel
