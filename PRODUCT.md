# RedByte Product Definition

**Last Updated:** 2026-02-18  
**Status:** v1 Stable (Milestone 5 Complete)

---

## What is RedByte?

**RedByte IDE** is a single, unified web application for teaching hardware engineering (digital logic design, FPGA programming) through hands-on interactive labs.

**NOT:** an operating system, a multi-app platform, or a complex shell.  
**IS:** a focused IDE with circuit design, simulation, verification, and Basys3 FPGA export.

---

## Product Routes & Artifacts

### Route 1: Marketing Landing (`/`)
- **File:** `apps/manual-site/` (Vite + React site)
- **Built to:** `dist/index.html` (root)
- **Marker:** `<!-- REDBYTE_MARKETING_ROOT -->` (in compiled HTML)
- **Content:** Product landing page, getting started, documentation links, branding
- **No app logic:** pure static marketing + links to IDE

### Route 2: IDE Application (`/os/`)
- **File:** `apps/playground/` (React 18 + Vite, full IDE)
- **Built to:** `dist/os/index.html`
- **Marker:** `<!-- REDBYTE_OS_IDE -->` (in compiled HTML)
- **Content:** Circuit editor, Verify mode, Export (Basys3), Import HDL, oscilloscope, probes

### Routes NOT in Product (Archived/Experimental)
- `apps/lab3-webapp/` — Archived lab submission app (not deployed)
- `apps/studio/` — Experimental design UI (not deployed)
- `tools/*` — Internal build tooling (not shipped to browser)
- **Entry Point:** Fullscreen Logic Playground (no shell/desktop by default)
- **Hidden:** Dev-only launcher modal (`?launcher=1` param only)

### Route 3: Developer Shell (Hidden by Default)
- **Access:** `/?launcher=1` query parameter only
- **Status:** Legacy, dev-only, do NOT ship in production
- **Fate:** Delete in Milestone 7 cleanup

---

## Build Contract (`pnpm -w build`)

**Unified Build Pipeline** (`scripts/build-unified.mjs`):

1. **Phase 1:** Build marketing site (`vite build` → `apps/manual-site/dist/`)
2. **Phase 2:** Build IDE (`vite build` → `apps/playground/dist/`)
3. **Phase 3:** Merge into unified dist:
   - Copy marketing site → `dist/`
   - Copy IDE → `dist/os/`
   - Copy `_redirects`, `_headers` → `dist/`
   - Verify markers present (deterministic check, not heuristic)
4. **Phase 4:** Verify final artifact structure

**Output:** `dist/` ready for deployment.

**Contract Enforcement:**
- `merge-dist.mjs` checks for `REDBYTE_MARKETING_ROOT` marker in root index.html
- `merge-dist.mjs` checks for `REDBYTE_OS_IDE` marker in /os/index.html
- Build FAILS if markers missing (not warnings)
- Binary contract: pass or fail, no ambiguity

---

## Deploy Contract (Cloudflare Pages)

**Current Style:** Pages-static, `_redirects` + `_headers` authoritative (Style 1)

**Root Endpoint:**
- Serves `dist/index.html` (marketing)
- Asset prefix: `/` (CSS/JS from `/assets/`)

**IDE Endpoint:**
- Serves `dist/os/index.html` (IDE)
- Asset prefix: `/os/assets/`
- Fallback: `_redirects` routes `/os/*` requests to `/os/index.html`

**Routing Rules:**
```
# _redirects (in dist/ root)
/os/* /os/index.html 200
/* /index.html 200
```

**Cache Headers:**
```
# _headers (in dist/ root)
/index.html
  Cache-Control: public, max-age=3600

/os/index.html
  Cache-Control: public, max-age=3600

/os/assets/*
  Cache-Control: public, max-age=31536000

/assets/*
  Cache-Control: public, max-age=31536000
```

---

## Folder Structure (Current + Future)

```
redbyte-ui/
├── apps/
│   ├── playground/         # IDE app (rename to ide/ when ready)
│   ├── manual-site/        # Marketing site (rename to marketing/ when ready)
│   └── [archive/]          # Old projects (will move here in M7)
├── packages/
│   ├── rb-logic-core/      # Circuit engine, analysis
│   ├── rb-apps/            # IDE components, export, verify
│   ├── rb-shell/           # Shell chromee (to delete in M7)
│   └── [other...]
├── scripts/
│   ├── build-unified.mjs   # Phase 1-4 build pipeline
│   ├── merge-dist.mjs      # Phase 3 merge + verify
│   └── [others...]
├── docs/
│   ├── PRODUCT.md          # This file (product contract)
│   ├── API.md              # Public API (RBProject, etc)
│   ├── ARCHITECTURE.md     # Technical deep-dive
│   └── [others...]
├── PRODUCT.md              # ← YOU ARE HERE
└── README.md               # Quick start + deployment
```

---

## Product Guarantees (Locked)

### 1. Deterministic Build
```npm
pnpm -w build
```
- Same input → same output (bit-for-bit reproducible)
- Hashing: done via `build.json` + source commit SHA
- Non-determinism bugs are P0

### 2. Export = Vivado-Compatible
```
If Verify says PASS → exported testbench.vhd will PASS in Vivado
```
- Testbench mirrors vector runner schedule exactly
- No alternate HDL generation paths
- Vivado version 2023.1+

### 3. Fullscreen IDE (No Pop-Ups)
```
Fresh load of /os/ → Logic Playground fullscreen, no OS chrome
```
- TopBar, Dock, Taskbar hidden by default
- Close button removed
- Accidental exit impossible

### 4. Single Authority Pattern
```
RBProject → circuit → ioMapping → Export testbench
                              → Verify runner
                              → FileTree manifest
```
- One source of truth per domain
- No divergent code paths
- Easy to verify, hard to break

---

## Release Checklist (Before Shipping)

- [ ] `REDBYTE_MARKETING_ROOT` marker in root index.html
- [ ] `REDBYTE_OS_IDE` marker in /os/index.html
- [ ] `pnpm -w build` succeeds (no warnings)
- [ ] `dist/` artifact verified (markers + redirects + headers present)
- [ ] Deploy to Cloudflare Pages (production branch)
- [ ] Test marketing site (`/`)
- [ ] Test IDE app (`/os/`)
- [ ] Verify no shell access (no `?launcher=1` visible)

---

## Future Changes (Locked Decision)

**Milestone 6 (Import):**
- Add HDL/XDC import panel to IDE
- No changes to product shipping contract
- Verify ↔ Export loop complete

**Milestone 7 (Cleanup):**
- Delete shell + launcher
- Delete old projects folder
- Update folder structure (apps/ide, apps/marketing)
- Update routing if needed

**No earlier changes to this contract without explicit discussion + date log.**

---

## Control Levers (Repo Drift Prevention)

These gates prevent common repo degradation patterns. Run before pushing code.

### Lever 1: Marker Verification
**Status:** ✅ Deployed  
**File:** `scripts/merge-dist.mjs` (lines 84-100)  
**What:** Verifies product index.html files have explicit markers (not text heuristics)
- Root `/` has `<!-- REDBYTE_MARKETING_ROOT -->`
- `/os/` has `<!-- REDBYTE_OS_IDE -->`

**Why:** Heuristics break when copy changes. Markers are binary: pass or fail.

**Run:** Built into `pnpm build` as Phase 3 verification

---

### Lever 2: Dist Manifest Verification
**Status:** ✅ Deployed  
**File:** `scripts/verify-dist-manifest.mjs`  
**What:** Confirms all required artifact files exist before declaring build success
- Checks: index.html, build.json, _redirects, _headers, version.json, markers
- Fails hard if any file missing (not warnings)

**Why:** Accidental CI breaks are caught early, not on deploy

**Run:** Built into `pnpm build` as Phase 4 verification

---

### Lever 3: Repository Health Check
**Status:** ✅ Deployed  
**File:** `scripts/repo-status.mjs`  
**What:** One-command health check: `pnpm repo:status`
- Runs build
- Verifies artifacts exist
- Reports overall status: HEALTHY or DEGRADED

**Why:** Quick operator sanity check before manual deploy

**Run:** `pnpm repo:status`

---

### Lever 4: No Deep Imports Gate
**Status:** ✅ Deployed & Clean  
**File:** `scripts/check-no-deep-imports.mjs` + package.json script  
**What:** Prevents cross-package imports that bypass package.json `exports`
- ❌ BAD: `import { foo } from '@redbyte/rb-utils/src/foo'`
- ❌ BAD: Relative imports between packages
- ✅ OK: `import { foo } from '@redbyte/rb-utils'` (package entrypoint)
- ℹ️ NOTE: Apps (playground/, manual-site/) use relative imports by design (separate Vite builds)

**Why:** Package boundary discipline is the root cause of Rollup errors. Every deep import is a latent failure waiting to happen.

**Status:** All 8 violations fixed ✅

**Fixes Applied:**
1. **rb-logic-core exports**: Added `EventLogV1`, `encodeEventLog`, `decodeEventLog`, `runReplay`, `validateEventLog` to index.ts
2. **rb-lab-engine exports**: Added `signalSemantics` (getSignalValue, getAvailableSignals, etc.) to index.ts  
3. **rb-apps imports**: Updated 3 files to import from package entrypoints instead of /src/ paths
4. **Gate scope**: Limited to packages/ only (apps/ use relative imports by deliberate design)

**Run:** `pnpm gates:no-deep-imports`

**Result:** Clean package boundaries + build stability ✅

---

## Decision Log

| Date | Decision | Author | Notes |
|------|----------|--------|-------|
| 2026-02-18 | Lock build contract on explicit markers (not text heuristics) | Agent + User | Eliminates false alarms, deterministic verification |
| 2026-02-18 | Confirm Cloudflare Pages-static (Style 1) as deployment | User | `_redirects` + `_headers` authoritative, no Workers |
| 2026-02-18 | Marketing at `/`, IDE at `/os/` (freeze routing) | User | Explicit marker-based verification |

---

## For Developers

**When in doubt, check this file.**

- Building something new? → Update **Product Routes**.
- Adding new artifacts? → Update **Build Contract**.
- Changing deployment? → Update **Deploy Contract**.
- Unsure about shipping? → Check **Release Checklist**.

**This file is the source of truth. If code disagrees with PRODUCT.md, code is wrong.**
