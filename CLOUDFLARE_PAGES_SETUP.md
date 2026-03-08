# Cloudflare Pages Deployment Setup

> **⚠️ PARTIALLY STALE** — References to `lab3-webapp` below are incorrect.
> The actual build is `pnpm build:unified` → `dist/` (not `apps/lab3-webapp/dist`).
> The deploy workflow is `.github/workflows/deploy-cloudflare.yml` using Node 20.19.0.
> Disable automatic Cloudflare builds; use GitHub Actions Direct Upload only.

## CRITICAL: Disable Automatic Builds

The `redbyte-ui-genesis` Cloudflare Pages project **MUST** have automatic builds disabled.

### Why?

- Deployment is handled by GitHub Actions (`.github/workflows/deploy-cloudflare.yml`)
- GitHub Actions builds `lab3-webapp` correctly and uploads via Direct Upload API
- Cloudflare auto-builds are using wrong build command from old dashboard configuration

### How to Disable Auto-Builds

1. Go to https://dash.cloudflare.com
2. Navigate to **Pages** → **redbyte-ui-genesis**
3. Go to **Settings** → **Builds & deployments**
4. Under **Build configuration**:
   - **Disable automatic builds from Git** OR
   - Set **Build command** to: `pnpm run build` (NOT `pnpm --filter @redbyte/manual-site... build`)
   - Set **Build output directory** to: `apps/lab3-webapp/dist`

### Current Working Setup

✅ **GitHub Actions** (`.github/workflows/deploy-cloudflare.yml`)
- Triggers on: Push to `main` branch
- Builds: `pnpm --filter @redbyte/lab3-webapp build`
- Deploys: `apps/lab3-webapp/dist` via `cloudflare/pages-action@v1`
- Status: **WORKING CORRECTLY**

❌ **Cloudflare Auto-Build** (from Git)
- Build command: `pnpm --filter @redbyte/manual-site... build` (WRONG APP)
- Status: **NEEDS TO BE DISABLED**

### Deployment Flow

```
Push to main
    ↓
GitHub Actions triggered
    ↓
Build lab3-webapp
    ↓
Upload dist/ to Cloudflare Pages via API
    ↓
Deploy to redbyteapps.dev
```

### Emergency Fix

If you need immediate deployment and can't access Cloudflare dashboard:

1. Run GitHub Actions workflow manually:
   ```bash
   # Via GitHub UI: Actions → Deploy to Cloudflare Pages → Run workflow
   # OR via gh CLI:
   gh workflow run deploy-cloudflare.yml
   ```

2. The GitHub Actions deployment will succeed (it's using Direct Upload, not auto-build)

### Files

- `.github/workflows/deploy-cloudflare.yml` - GitHub Actions workflow (handles deployment)
- `wrangler.toml` - Cloudflare Pages config (output directory only)
- `package.json` - Root build script (for local testing)

---

**Last Updated**: February 10, 2026  
**Status**: Cloudflare dashboard build settings need to be disabled or fixed
