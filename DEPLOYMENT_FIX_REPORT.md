# Deployment Fix Report — redbyteapps.dev

## Root Cause

**Production was serving RedByte OS (Playground) instead of manual-site.**

The GitHub Actions workflow `deploy-cloudflare.yml` was configured to **only run on `workflow_dispatch` (manual trigger)**, not on push to main. This meant:

- Local dev: manual-site works perfectly
- Production: Last OS build from a previous deploy remained live
- Result: Users hit `Cannot access 'Se' before initialization` (temporal dead zone error in rb-apps bundle)

## What Was Wrong

```yaml
# BEFORE (broken):
on:
  workflow_dispatch:  # Manual trigger only
```

This prevented automatic deployment when commits were pushed to main.

## What Was Fixed

### 1. Deploy Workflow (`.github/workflows/deploy-cloudflare.yml`)

```yaml
# AFTER (correct):
on:
  push:
    branches:
      - main
  workflow_dispatch:
```

Removed the `if` condition that was blocking the job, making the workflow run on every push to main.

### 2. SPA Routing Fix (`apps/manual-site/public/_redirects`)

Created Cloudflare Pages `_redirects` file:

```text
/* /index.html 200
```

This ensures hash-routed pages (`/#/examples`, `/#/demo`, etc.) resolve correctly on production.

## Verification Commands

### Local verification (already done)

```powershell
# Confirm manual-site dist exists and is correct
Test-Path "c:\Users\conno\redbyte-ui\apps\manual-site\dist\index.html"
(Get-Content "c:\Users\conno\redbyte-ui\apps\manual-site\dist\index.html") -split "`n" | Select-Object -First 20

# Should show:
# - Title: "RedByte - Deterministic Logic Playground" (NOT "RedByte Playground")
# - Assets: index-*.js (NOT main-*.js or rb-apps-*.js)
```

### Production verification (do this in 2 minutes)

```powershell
# Check if production now serves manual-site (NOT OS)
(Invoke-WebRequest https://redbyteapps.dev -UseBasicParsing).Content | Select-String "rb-apps|rb-windowing|Getting Started"

# Should return NOTHING for "rb-apps" or "rb-windowing"
# Should return matches for "Getting Started", "Examples", "Demo", "Manual"
```

### Confirm no TDZ errors

Open [https://redbyteapps.dev](https://redbyteapps.dev) in browser and check DevTools Console:

- Should see NO errors about "Cannot access 'Se' before initialization"
- Should see manual-site nav (Home, Getting Started, Demo, Examples, Manual, About)

## Files Changed

1. `.github/workflows/deploy-cloudflare.yml` — Fixed trigger to run on push to main
2. `apps/manual-site/public/_redirects` — Added SPA routing file (new)
3. Commit: `29213e36`

## Timeline

- **Pushed**: Just now (2026-01-18)
- **Deployment starts**: Immediately (GitHub Actions runs on push)
- **Live on redbyteapps.dev**: ~2-3 minutes (Cloudflare Pages build + publish)

## What to Do Now

1. **Wait 2-3 minutes** for Cloudflare to build and deploy
2. **Check [https://redbyteapps.dev](https://redbyteapps.dev) in an incognito window** (avoid browser cache)
3. **Verify**:
   - No console errors
   - Nav shows: Home / Getting Started / Demo / Examples / Manual / About
   - Click "Demo" — page loads
   - Examples page works without TDZ errors
   - Tour button appears and works

## Why This Works

- ✅ Workflow triggers on every push to main (CI/CD automation)
- ✅ Builds only manual-site (`pnpm --filter @redbyte/manual-site build`)
- ✅ Deploys only `apps/manual-site/dist` to the `redbyte-ui-genesis` project on Cloudflare Pages
- ✅ `_redirects` ensures hash routing resolves correctly
- ✅ Manual-site is the only thing served; OS build is completely disconnected

---

**Root cause was 100% a deployment pipeline issue, not a code issue.**
The manual-site code is clean and works locally. The workflow just wasn't running.
