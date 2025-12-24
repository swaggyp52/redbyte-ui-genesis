# RedByte OS Live Preview Deployment Guide

This document outlines the deployment procedure for RedByte OS live preview (v0.1.0-preview) to redbyteapps.dev or any static hosting provider.

## Build Process

### 1. Build Command

```bash
pnpm -w build
```

This builds all workspace packages and creates the production bundle for the playground app.

### 2. Output Directory

```
apps/playground/dist/
```

The `dist` directory contains:
- `index.html` - SPA entry point
- `assets/` - JS, CSS, and other static assets with content hashes

### 3. Build-time Environment Variables

The build injects the following variables:

- **`__GIT_SHA__`**: Current git commit SHA (first 7 chars displayed in UI)
  - Injected via Vite `define` plugin at build time
  - Falls back to `"dev"` in local development

To inject the git SHA during build:

```bash
# The build system should set this automatically, but you can override:
export GIT_SHA=$(git rev-parse HEAD) && pnpm -w build
```

## Deployment Configuration

### SPA Routing Fallback

RedByte OS is a single-page application (SPA). Configure your hosting provider to serve `index.html` for all routes:

**Netlify**: Create `apps/playground/public/_redirects`:
```
/*    /index.html   200
```

**Vercel**: Create `vercel.json` in project root:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Cloudflare Pages**: Built-in SPA support, no configuration needed.

**Generic Static Host**: Configure server to serve `index.html` for 404s with 200 status.

### Cache Headers

Recommended caching strategy:

- **`index.html`**: `Cache-Control: public, max-age=0, must-revalidate`
  - Always fetch fresh to ensure users get latest version
- **`assets/*`**: `Cache-Control: public, max-age=31536000, immutable`
  - Content-hashed filenames allow aggressive caching

Most static hosts (Netlify, Vercel, Cloudflare Pages) apply these headers automatically.

### Base Path

RedByte OS is configured for root domain deployment (`/`).

If deploying to a subdirectory (e.g., `redbyteapps.dev/preview/`), update `apps/playground/vite.config.ts`:

```typescript
export default defineConfig({
  base: '/preview/',  // Add this line
  // ... rest of config
});
```

## Deployment Steps

### Initial Deployment

1. **Build locally**:
   ```bash
   pnpm -w build
   ```

2. **Verify build output**:
   - Check `apps/playground/dist/index.html` exists
   - Check `apps/playground/dist/assets/` contains hashed JS/CSS files

3. **Deploy to hosting provider**:
   - **Netlify**: Drag `apps/playground/dist` to Netlify drop zone, or use CLI
   - **Vercel**: `vercel --prod --cwd apps/playground`
   - **Cloudflare Pages**: Connect GitHub repo or use Wrangler CLI
   - **Generic**: Upload `apps/playground/dist` contents to web root

4. **Verify SPA fallback**:
   - Navigate to a non-root route (e.g., `/settings`)
   - Refresh page - should load correctly, not 404

5. **Run smoke checklist** (see below)

### Continuous Deployment

For automated deployments from GitHub:

1. **Set build command**: `pnpm -w build`
2. **Set output directory**: `apps/playground/dist`
3. **Set root directory**: Leave as repo root (needed for monorepo)
4. **Install command**: `pnpm install` (hosting providers auto-detect pnpm)
5. **Node version**: 18+ (set via `.nvmrc` or provider settings)

## Rollback Procedure

### Quick Rollback (Re-deploy Previous Build)

1. **Netlify**: Deploy → Deploys → Select previous deploy → "Publish deploy"
2. **Vercel**: Deployments → Select previous deployment → "Promote to Production"
3. **Cloudflare Pages**: Deployments → Select previous deployment → "Rollback to this deployment"

### Manual Rollback

1. Checkout previous tagged release:
   ```bash
   git checkout v0.1.0-preview  # or previous tag
   ```

2. Rebuild and deploy:
   ```bash
   pnpm -w build
   # Deploy apps/playground/dist manually
   ```

### Cache Invalidation

After rollback or urgent fixes:

- **Netlify**: Cache is invalidated automatically on new deploys
- **Vercel**: No action needed (deploy creates new immutable URL)
- **Cloudflare**: Caching → Purge Everything (if using CF as CDN)
- **Generic CDN**: Use provider's cache purge API

## Manual Smoke Checklist

Run this checklist after every deployment to verify critical paths:

### 1. Cold Load (Empty State)

- [ ] Open incognito/private window
- [ ] Navigate to live preview URL
- [ ] **Verify**: Desktop loads with no errors
- [ ] **Verify**: "PREVIEW" badge visible in footer
- [ ] **Verify**: Version string visible (e.g., `v0.1.0-preview (abc1234)`)
- [ ] Open browser console (F12)
- [ ] **Verify**: No errors in console

### 2. Files App - Basic Operations

- [ ] Click "Files" icon on desktop
- [ ] **Verify**: Files app opens with empty state
- [ ] Right-click in empty area → New → Text File
- [ ] **Verify**: "Untitled.txt" created
- [ ] Double-click "Untitled.txt"
- [ ] **Verify**: Text Editor opens with empty content
- [ ] Type "Hello RedByte"
- [ ] Press Ctrl+S (or Cmd+S)
- [ ] **Verify**: Content saved (no errors in console)
- [ ] Close Text Editor window
- [ ] Refresh page (F5)
- [ ] **Verify**: "Untitled.txt" still exists
- [ ] Double-click file again
- [ ] **Verify**: "Hello RedByte" content persisted

### 3. Window Management

- [ ] Open Files app
- [ ] Open Settings app (Ctrl+,)
- [ ] **Verify**: Two windows visible
- [ ] Click Files window to focus it
- [ ] **Verify**: Files window brought to front
- [ ] Press Alt+Tab
- [ ] **Verify**: Window switcher modal appears
- [ ] Press Tab to cycle
- [ ] Press Enter to select
- [ ] **Verify**: Correct window focused
- [ ] Press Escape (in window switcher if open)
- [ ] **Verify**: Modal dismisses

### 4. Settings Persistence

- [ ] Open Settings (Ctrl+,)
- [ ] Navigate to "File Associations" tab
- [ ] Add custom association (e.g., `.md` → Text Editor)
- [ ] Close Settings window
- [ ] Refresh page (F5)
- [ ] Open Settings again
- [ ] **Verify**: Custom file association persisted

### 5. Error Boundary

- [ ] Open browser console (F12)
- [ ] Run: `throw new Error("Test crash")`
- [ ] **Verify**: Error boundary UI appears (red border, "Something went wrong")
- [ ] **Verify**: Error message displayed
- [ ] Click "Reload Page" button
- [ ] **Verify**: App reloads and returns to normal state

### 6. Factory Reset

- [ ] Open Settings (Ctrl+,)
- [ ] Go to "Filesystem Data" tab
- [ ] Press `F` key
- [ ] **Verify**: Confirmation prompt appears
- [ ] Type "RESET" in input
- [ ] Click "Confirm Factory Reset"
- [ ] **Verify**: Page reloads
- [ ] **Verify**: All files deleted (Files app shows empty state)
- [ ] **Verify**: File associations reset to defaults

### Smoke Test Result

**Date**: _____________
**Deployed Version**: _____________
**Tested By**: _____________
**Result**: ☐ PASS  ☐ FAIL

**Notes/Issues**:
```
(Record any issues or unexpected behavior here)
```

## Troubleshooting

### Issue: White screen after deployment

**Cause**: SPA fallback not configured correctly

**Fix**:
1. Check browser console for 404 errors on route files
2. Verify `_redirects` or equivalent exists
3. Test direct navigation to `/settings` (should not 404)

### Issue: Version shows "dev" instead of git SHA

**Cause**: `__GIT_SHA__` not injected at build time

**Fix**:
1. Check Vite config has `define` plugin (see "Verify production build config" below)
2. Ensure git is available during build (`git rev-parse HEAD` works)
3. Rebuild with explicit env var: `export GIT_SHA=$(git rev-parse HEAD) && pnpm -w build`

### Issue: Files not persisting after refresh

**Cause**: localStorage not working or being cleared

**Fix**:
1. Check browser console for localStorage errors
2. Verify domain allows localStorage (not `file://` protocol)
3. Check browser privacy settings (not blocking storage)

### Issue: App loads but features broken

**Cause**: Incorrect base path in build

**Fix**:
1. Check browser console for 404s on asset files
2. Verify `apps/playground/vite.config.ts` has correct `base` path
3. Rebuild with correct base path

## LocalStorage Keys (For Debugging)

RedByte OS uses the following localStorage keys:

- `rb:file-system` - Virtual file system state (files, directories)
- `rb:file-associations` - Custom file type → app mappings
- `rb:window-layout` - Window positions and states

To inspect persistence:
```javascript
// In browser console
console.log(localStorage.getItem('rb:file-system'));
console.log(localStorage.getItem('rb:file-associations'));
console.log(localStorage.getItem('rb:window-layout'));
```

To manually trigger factory reset:
```javascript
// WARNING: Clears all data
localStorage.removeItem('rb:file-system');
localStorage.removeItem('rb:file-associations');
localStorage.removeItem('rb:window-layout');
window.location.reload();
```

## Build Configuration Verification

Before deploying, verify the following in `apps/playground/vite.config.ts`:

1. **Git SHA injection** - Add if missing:
   ```typescript
   import { defineConfig } from 'vite';

   const gitSha = process.env.GIT_SHA ||
                  (await import('child_process'))
                    .execSync('git rev-parse HEAD')
                    .toString()
                    .trim();

   export default defineConfig({
     define: {
       __GIT_SHA__: JSON.stringify(gitSha),
     },
     // ... rest of config
   });
   ```

2. **Base path** - Verify matches deployment location:
   ```typescript
   base: '/',  // Root domain
   // OR
   base: '/preview/',  // Subdirectory
   ```

3. **Build output** - Default `dist` is correct for static hosts

## Support

For issues or questions:
- Check browser console for errors
- Review this deployment guide
- Report issues on GitHub: [redbyte-ui repository]

---

**Last Updated**: 2025-12-24
**Version**: v0.1.0-preview
