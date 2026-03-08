# RedByte Finish Engineering — Audit Log

---

## [Phase A] 2026-03-08

### Problem: Build pipeline referenced non-existent artifacts; Node version mismatch in deploy workflow

**Evidence:**
- `apps/` contains only `playground/` — `manual-site` never existed
- `pnpm build:unified` → EXIT 1: `❌ Marketing build not found at apps/manual-site/dist`
- `unified-build.mjs:24-25` referenced `rb-shell`, `rb-windowing` (packages confirmed absent)
- `unified-build.mjs:43` called `pnpm --filter @redbyte/manual-site build` — silently skipped by pnpm ("No projects matched"), then `merge-dist.mjs:34-37` hard-failed on missing dist
- `deploy-cloudflare.yml:50` pinned `24.13.0` vs `CI_CONTRACT.md` requirement of `20.19.0`
- `verify-dist.mjs` had marketing-SPA-specific checks (root `assets/` dir, root asset hrefs) objectively wrong for a redirect stub

**Resolution: playground-only deploy with minimal redirect stub at root**

**Files Changed:**
- `scripts/unified-build.mjs` — removed `rb-shell`, `rb-windowing` from package list; removed manual-site build step; renumbered steps 1-3
- `scripts/merge-dist.mjs` — replaced marketing hard-fail with inline stub generation + build.json copy from playground dist
- `scripts/verify-dist.mjs` — removed root `assets/` existence check; replaced marketing-content check with REDBYTE_MARKETING_ROOT marker check; guarded strict-mode assets scan on dir existence
- `scripts/verify-dist-manifest.mjs` — removed `assets` from REQUIRED_DIRS (root stub has no compiled assets)
- `.github/workflows/deploy-cloudflare.yml` — Node `24.13.0` → `20.19.0` (matches CI_CONTRACT)

**Why Minimal:**
- Stub is 12 lines of HTML with `<!-- REDBYTE_MARKETING_ROOT -->` marker and meta-refresh to `/os/`
- No new directories, no new apps, no new packages
- All existing marker contracts preserved; only wrong checks updated
- Playground base path `/os/` unchanged (vite.config.ts:32)

**Verified By:**
```
pnpm build:unified → EXIT 0
All 20 verify-dist.mjs checks: PASS
All 9 verify-dist-manifest.mjs checks: PASS
dist layout: index.html (stub) + build.json + _redirects + _headers + os/ (full playground)
```

---

## [Phase B] 2026-03-08

**Problem**: MEMORY.md documented 2 pre-existing test failures; actual reality was 30 (28 additional OS-era dead tests).

**Evidence:**
- `error-boundary-gate.test.tsx` → PASS (already fixed)
- `basys3-bundle-gate.test.ts` → PASS (rb-icons mock already in vitest config)
- 28 remaining failures: all reference modules that don't exist (FilesApp, TerminalApp, UserManualApp, labWorkspace, etc.) — OS-era dead code

**Files Changed:** None (both documented failures already passed)

**Verified By:** `pnpm exec vitest run error-boundary-gate.test.tsx basys3-bundle-gate.test.ts → 2/2 PASS`

---

## [Phase C] 2026-03-08

**Problem**: Dead OS-era oscilloscope components in active source tree; `@redbyte/rb-windowing` vitest alias resolved to non-existent directory, breaking `instrument-hz-gate.test.ts`.

**Evidence:**
- `OscilloscopeView.tsx` → imported only by `SplitViewLayout.tsx` (itself dead, test-only) + tests
- `OscilloscopePanel.jsx`, `BoardIOPanel.js`, `TestVectorPanel.js`, `TruthTableAnalyzer.js` → zero production imports
- `SplitViewLayout.tsx` → only in test files (never in production bundle — grep of dist confirmed)
- `instrument-hz-gate.test.ts` → vi.mock('@redbyte/rb-windowing') hoisted but Vite alias pointed to missing dir

**Files Changed:**
- Quarantined to `archive/dead-legacy-components/`: `OscilloscopeView.tsx`, `OscilloscopePanel.jsx`, `BoardIOPanel.js`, `TestVectorPanel.js`, `TruthTableAnalyzer.js`, `SplitViewLayout.tsx`
- Deleted: `OscilloscopeView.tsx.backup`, `SplitViewLayout.tsx.bak`
- Quarantined tests to `archive/dead-legacy-components/tests/`: oscilloscope-controls, oscilloscope-hardening, view-micro-toolbar, quad-crash, quad-signalsVersion.guard
- Created: `packages/rb-windowing/src/index.ts` — minimal stub for vitest alias resolution
- Added inline comment to `VerifySurface.tsx:92` explaining WaveformViewer is embedded by design

**Why Minimal:** Only dead code moved; no active IDE surfaces changed; stub exports only `useWindowStore` (what tests need to mock).

**Verified By:**
```
pnpm exec vitest run instrument-hz-gate.test.ts → 5/5 PASS
pnpm -s lab:probe-sampling-gate → 5/5 PASS
pnpm build:unified → EXIT 0
pnpm verify:gates → EXIT 0
```

---

## [Phase D] 2026-03-08

**Problem**: Hardware proof bundle path needed explicit code trace verification.

**Evidence (code trace):**
- `projectRuntime.ts:744` → `health.lastVerify.hash = report.deterministicHash` (set on verify run)
- `basys3ExportService.ts:304-372` → SHA256(project JSON + bundle JSON) → `bundleId`; ZIP deterministic date `2000-01-01T00:00:00Z`
- `HardwareSurface.tsx:473` → proof cert slab shows `health.lastVerify?.hash` + `health.lastExport?.hash`
- Import roundtrip: `parseIdeSubmission.ts` restores circuit+ioMapping+vectors; re-verify produces same `reportHash` (per gate)

**Files Changed:** None — read/trace only.

**Verified By:**
```
pnpm rc:e1:golden-basys3-export-gate → 1/1 PASS
pnpm rc:e1:golden-basys3-alu-export-gate → 1/1 PASS
pnpm lab:workflow-export-verify-gate → 4/4 PASS
pnpm rbproj:roundtrip-gate → 3/3 PASS
```

---

## [Phase E] 2026-03-08

**Problem**: 26 OS-era dead test files still in active test suite; stale docs referenced non-existent packages/apps; archive/ needed explicit exclusion verification.

**Evidence:**
- 26 failing tests all referenced dead modules: FilesApp, TerminalApp, UserManualApp, ToolchainSetupApp, labWorkspace, evidenceCapsule, LogicLabApp, SubmissionInspectorApp, etc. — none exist
- `hooks/__tests__/useWindowActivity.test.ts` → imports rb-windowing directly
- ARCHITECTURE.md listed `rb-analog-sim`, `rb-logic-3d`, `rb-windowing` as if they were live packages
- DEPLOYMENT.md described OS-era smoke tests (Files app, window management)
- CLOUDFLARE_PAGES_SETUP.md referenced `lab3-webapp` (never existed)

**Files Changed:**
- Quarantined 26+1 test files to `archive/dead-legacy-components/tests/`
- Updated `docs/ARCHITECTURE.md` — Legacy Packages section rewritten to be accurate
- Added stale notice + canonical v1 deploy info to `DEPLOYMENT.md`
- Added stale notice to `CLOUDFLARE_PAGES_SETUP.md`

**Verified By:**
```
pnpm --filter @redbyte/rb-apps test → 90 passed, 0 failed, 1 skipped
archive/ excluded from vitest (not under packages/ or apps/)
```

---

## [Phase F] 2026-03-08

**Release Rehearsal — Two Consecutive Clean Runs**

**Rehearsal 1:**
```
pnpm --filter @redbyte/rb-apps test → 90 passed, 0 failed, 1 skipped  ✓
pnpm verify:gates → EXIT 0 (27 gates)  ✓
pnpm rc:check → EXIT 0  ✓
pnpm build:unified → EXIT 0 (20/20 verify-dist checks)  ✓
```

**Rehearsal 2:**
```
pnpm --filter @redbyte/rb-apps test → 90 passed, 0 failed, 1 skipped  ✓
pnpm verify:gates → EXIT 0 (27 gates)  ✓
pnpm build:unified → EXIT 0  ✓
```

**Deliverable:** `docs/canon/v1-canonical-truth.md` — authoritative product definition

**Files Changed:**
- Created `docs/canon/v1-canonical-truth.md`
- Created `docs/audit/finish-audit-log.md` (this file)

**Dist Layout:**
```
dist/
  index.html        ← redirect stub (REDBYTE_MARKETING_ROOT + meta-refresh to /os/)
  build.json        ← copied from playground dist
  _redirects        ← copied from public/ (/os/* and /* fallbacks)
  _headers          ← copied from public/ (cache + security headers)
  os/
    index.html      ← playground IDE (REDBYTE_OS_IDE marker, base=/os/)
    assets/         ← 8703 compiled assets
    version.json    ← { sha, builtAt }
    build.json      ← playground build metadata
```
