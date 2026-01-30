# Deployment Verification Checklist

This document provides step-by-step verification procedures for the RedByte OS live deployment at https://redbyteapps.dev.

## Deployment Configuration

**Deploy Model**: GitHub Actions → Cloudflare Pages (Direct Upload API)

**Workflow File**: [.github/workflows/deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml)

**Cloudflare Pages Project**: `redbyte-ui-genesis`

**Custom Domain**: https://redbyteapps.dev

**Trigger**: Automatic on push to `main` branch

### Build Settings

- **Build Command**: `pnpm install --frozen-lockfile && pnpm -w build`
- **Build Output Directory**: `apps/playground/dist`
- **Root Directory**: `/` (repository root)
- **Node Version**: 20.19.0
- **PNPM Version**: 10.24.0

### Environment Variables (Injected at Build)

- **`GIT_SHA`**: Full commit SHA from GitHub Actions (`${{ github.sha }}`)
  - Automatically injected by workflow
  - Vite config reads this and makes it available as `__GIT_SHA__`
  - Frontend displays first 7 characters in version string

### Required GitHub Secrets

The following secrets must be configured in the GitHub repository settings:

1. **`CLOUDFLARE_API_TOKEN`**
   - How to obtain: Cloudflare Dashboard → My Profile → API Tokens → Create Token
   - Required permissions: Account > Cloudflare Pages > Edit
   - Scope: Specific account (your Cloudflare account)

2. **`CLOUDFLARE_ACCOUNT_ID`**
   - How to obtain: Cloudflare Dashboard → Workers & Pages → Account ID (in right sidebar)
   - Format: 32-character hexadecimal string

### SPA Fallback Configuration

- **File**: [apps/playground/public/_redirects](apps/playground/public/_redirects)
- **Content**: `/*    /index.html   200`
- **Purpose**: Ensures all routes serve `index.html` for client-side routing
- **Host Support**: Cloudflare Pages, Netlify (automatic)

---

## Automated Verification (GitHub Actions)

Every push to `main` triggers the deployment workflow. Monitor deployment status:

### PowerShell Commands

```powershell
# View recent workflow runs
gh run list --workflow=deploy-cloudflare.yml --limit 5

# View detailed logs for latest run
gh run view --log

# View specific run by ID
gh run view 20490270821 --log
```

### Expected Workflow Output

✅ **Checkout code** - Fetches latest commit from `main`
✅ **Setup pnpm** - Installs pnpm 10.24.0
✅ **Setup Node.js** - Installs Node.js 20.19.0 with cache
✅ **Install dependencies** - `pnpm install --frozen-lockfile` completes in ~2s
✅ **Build playground app** - `pnpm -w build` completes in ~40s
  - All packages build successfully
  - No chunk size warnings (all < 750kB)
  - `GIT_SHA` environment variable injected
✅ **Publish to Cloudflare Pages** - Uploads `apps/playground/dist`
  - Direct Upload API deployment
  - Custom domain propagation

---

## Manual Verification Checklist

Run this checklist after every deployment to verify critical functionality.

### 1. Cold Load (Empty State)

Open the deployment in an incognito/private browser window to simulate first-time user experience.

- [ ] Navigate to https://redbyteapps.dev
- [ ] **Verify**: Page loads without infinite spinner or white screen
- [ ] **Verify**: Desktop UI renders with wallpaper and dock
- [ ] **Verify**: "PREVIEW" badge visible in footer (amber/yellow background)
- [ ] **Verify**: Version string visible in footer (format: `v0.1.0-preview (abc1234)`)
- [ ] Open browser DevTools console (F12)
- [ ] **Verify**: No console errors (warnings OK if intentional)
- [ ] **Verify**: Git SHA in version matches deployed commit SHA (first 7 chars)

**How to check deployed commit SHA**:
```powershell
# Get latest commit SHA on main
git rev-parse HEAD | Select-Object -First 7
```

### 2. SPA Routing (Deep Link Test)

Verify client-side routing works correctly without 404 errors.

- [ ] From homepage, click "Settings" in dock or press `Ctrl+,`
- [ ] Settings window opens
- [ ] Copy current URL from address bar (should be `https://redbyteapps.dev`)
- [ ] Refresh page with F5
- [ ] **Verify**: Page reloads successfully (no 404)
- [ ] **Verify**: Settings window still open after refresh

**Why this matters**: Without SPA fallback, refreshing on a client-side route would return 404. The `_redirects` file ensures all routes serve `index.html`.

### 3. Version Metadata Display

Verify build-time metadata is correctly injected and displayed.

- [ ] Open homepage
- [ ] Scroll to bottom footer
- [ ] **Verify**: Left side shows PREVIEW badge + version string
- [ ] **Verify**: Right side shows "RedByte OS Genesis"
- [ ] Click Settings icon or press `Ctrl+,`
- [ ] Navigate to "About" tab (if implemented)
- [ ] **Verify**: Version metadata displayed (version, git SHA, build date)

**Expected format**: `v0.1.0-preview (da3695c)` where `da3695c` is the first 7 characters of the deployed commit SHA.

### 4. Files App - Create & Persist

Test virtual filesystem persistence across page reloads.

- [ ] Click "Files" icon on desktop
- [ ] Files app opens with sidebar (Home, Desktop, Documents)
- [ ] Press `Ctrl+Shift+N` or right-click → New → Text File
- [ ] Create file named `test.txt`
- [ ] **Verify**: File appears in file list
- [ ] Double-click `test.txt` to open in Text Viewer
- [ ] Type "Hello RedByte OS" in editor
- [ ] Press `Ctrl+S` to save (or wait for auto-save)
- [ ] Close Text Viewer window
- [ ] Refresh page (F5)
- [ ] **Verify**: Desktop reloads
- [ ] Open Files app again
- [ ] **Verify**: `test.txt` still exists
- [ ] Double-click to open
- [ ] **Verify**: Content "Hello RedByte OS" persisted

**What this tests**: localStorage persistence (`rb:file-system` key)

### 5. Window Management

Test windowing system focus, minimize, and z-index behavior.

- [ ] Open Files app
- [ ] Open Settings app (`Ctrl+,`)
- [ ] **Verify**: Two windows visible on desktop
- [ ] Click Files window
- [ ] **Verify**: Files window comes to front (z-index increases)
- [ ] Press `Alt+Tab`
- [ ] **Verify**: Window switcher modal appears
- [ ] Press `Tab` to cycle between windows
- [ ] Press `Enter` to select
- [ ] **Verify**: Selected window gains focus
- [ ] Press `Ctrl+M` to minimize focused window
- [ ] **Verify**: Window disappears from desktop
- [ ] Click minimized window in dock
- [ ] **Verify**: Window restores and gains focus

**What this tests**: Shell window lifecycle, keyboard shortcuts, focus management

### 6. System Search

Test global search for apps, files, and commands.

- [ ] Press `Ctrl+Space` to open System Search
- [ ] **Verify**: Modal appears with search input focused
- [ ] Type "README"
- [ ] **Verify**: README.md file appears in search results under "Files"
- [ ] Press `Enter` to open
- [ ] **Verify**: README.md opens in Text Viewer
- [ ] Press `Ctrl+Space` again
- [ ] Type "settings"
- [ ] **Verify**: Settings app appears under "Apps"
- [ ] Press `Shift+Enter`
- [ ] **Verify**: "Open With" modal appears (if multiple targets available)
- [ ] Press `Escape` to cancel
- [ ] Press `Escape` again to close System Search

**What this tests**: Search registry, intent system, keyboard navigation

### 7. Error Boundary (Crash Recovery)

Test error boundary catches crashes and provides recovery UI.

- [ ] Open browser DevTools console (F12)
- [ ] Paste and run: `throw new Error("Deployment smoke test crash")`
- [ ] **Verify**: Error boundary UI appears with red border
- [ ] **Verify**: Message says "Something went wrong"
- [ ] **Verify**: Error message displayed: "Deployment smoke test crash"
- [ ] **Verify**: "Reload Page" button visible
- [ ] **Verify**: Factory Reset instructions visible
- [ ] Click "Reload Page" button
- [ ] **Verify**: App reloads and returns to normal state
- [ ] **Verify**: No leftover error state

**What this tests**: ErrorBoundary component, crash recovery flow

### 8. Factory Reset (Data Wipe)

Test factory reset clears all localStorage and restores defaults.

- [ ] Create at least one file in Files app (from test #4 above)
- [ ] Open Settings (`Ctrl+,`)
- [ ] Navigate to "Filesystem Data" section
- [ ] Press `F` key
- [ ] **Verify**: Confirmation modal appears
- [ ] Type "RESET" in input field
- [ ] Click "Confirm Factory Reset" button
- [ ] **Verify**: Page reloads automatically
- [ ] Open Files app
- [ ] **Verify**: Previously created files are gone
- [ ] **Verify**: Default seed files restored (README.md, sample files if any)

**What this tests**: localStorage reset, seed data restoration

### 9. Settings Persistence

Test settings survive page reloads.

- [ ] Open Settings (`Ctrl+,`)
- [ ] Navigate to "Appearance" section
- [ ] Change theme to "Dark" (if currently Light, or vice versa)
- [ ] **Verify**: Theme changes immediately (no flicker)
- [ ] Close Settings window
- [ ] Refresh page (F5)
- [ ] **Verify**: Theme persists after reload
- [ ] Open Settings again
- [ ] **Verify**: Selected theme matches current theme

**What this tests**: Settings store persistence (`localStorage`)

### 10. Circuit Sharing

Test circuit sharing with compressed URLs.

- [ ] Navigate to Logic Playground
- [ ] Build a simple circuit (add 2-3 gates)
- [ ] Press `Ctrl+Shift+C` (or `Cmd+Shift+C`)
- [ ] **Verify**: Toast appears: "Share link copied to clipboard!"
- [ ] Paste clipboard contents somewhere
- [ ] **Verify**: URL contains `?circuit=c1:` prefix
- [ ] Open URL in new incognito/private window
- [ ] **Verify**: Circuit loads automatically
- [ ] **Verify**: DevTools Network tab shows `encoding.compressed-*.js` fetched
- [ ] **Verify**: URL param cleared from address bar after load
- [ ] Create a legacy uncompressed URL (from before c1: format)
- [ ] Open legacy URL
- [ ] **Verify**: Legacy circuit still loads (backward compatibility)

**What this tests**: Share functionality, lazy-loaded compression, URL ingestion, backward compatibility

### 11. Keyboard Shortcuts

Test global keyboard shortcuts work correctly.

- [ ] Press `Ctrl+K` (or `Cmd+K` on Mac)
- [ ] **Verify**: Launcher opens with search input focused
- [ ] Press `Escape`
- [ ] **Verify**: Launcher closes
- [ ] Press `Ctrl+,` (or `Cmd+,`)
- [ ] **Verify**: Settings opens
- [ ] Press `Ctrl+Shift+P`
- [ ] **Verify**: Command Palette opens
- [ ] Press `Escape`
- [ ] **Verify**: Command Palette closes
- [ ] Open any window
- [ ] Press `Ctrl+W`
- [ ] **Verify**: Focused window closes

**What this tests**: Global keyboard event handling

---

## Verification Completion

After running all checks, document the results:

**Deployment Date**: _________________
**Deployed Commit SHA**: _________________
**Deployed by**: _________________
**All Checks Passed**: ☐ YES  ☐ NO (see notes)

**Failed Checks** (if any):
```
[List any failed checklist items with brief description of failure]
```

**Notes**:
```
[Any additional observations, warnings, or issues discovered during verification]
```

---

## Troubleshooting

### Issue: Version shows "dev" instead of commit SHA

**Symptom**: Footer displays `v0.1.0-preview (dev)` instead of `v0.1.0-preview (abc1234)`

**Cause**: `__GIT_SHA__` not injected at build time

**Fix**:
1. Verify `GIT_SHA` environment variable is set in workflow:
   ```yaml
   - name: Build playground app
     run: pnpm -w build
     env:
       GIT_SHA: ${{ github.sha }}
   ```
2. Verify Vite config injects it:
   ```typescript
   define: {
     __GIT_SHA__: JSON.stringify(process.env.GIT_SHA || 'dev'),
   }
   ```
3. Trigger new deployment and verify

### Issue: 404 on page refresh (deep links)

**Symptom**: Navigating to `https://redbyteapps.dev/some-route` and refreshing returns 404

**Cause**: SPA fallback not configured

**Fix**:
1. Verify `apps/playground/public/_redirects` exists with content:
   ```
   /*    /index.html   200
   ```
2. Rebuild and verify `_redirects` appears in `apps/playground/dist/_redirects`
3. Redeploy

### Issue: Files don't persist after refresh

**Symptom**: Created files disappear after page reload

**Cause**: localStorage disabled or blocked

**Fix**:
1. Check browser console for localStorage errors
2. Verify site is served over HTTPS (not `file://` protocol)
3. Check browser privacy settings (not blocking storage)
4. Try different browser

### Issue: Cloudflare security challenge appears

**Symptom**: Users see "Checking your browser" message before page loads

**Cause**: Cloudflare security level set too high or under attack mode

**Fix**:
1. Cloudflare Dashboard → Security → Settings
2. Verify Security Level is "Medium" or lower
3. Disable "I'm Under Attack Mode" if enabled
4. Custom firewall rules may be blocking legitimate traffic

### Issue: Stale version deployed

**Symptom**: Latest commit not reflected in deployed version

**Cause**: Build cache or deployment race condition

**Fix**:
1. Check workflow run logs to confirm correct commit SHA was deployed
2. Clear Cloudflare Pages deployment cache (redeploy)
3. Hard refresh browser with `Ctrl+Shift+R` (cache bypass)

---

## Additional Commands

### Check Deployment Status

```powershell
# List all deployments
gh run list --workflow=deploy-cloudflare.yml --limit 10

# View specific deployment logs
gh run view <RUN_ID> --log

# Re-run failed deployment
gh run rerun <RUN_ID>
```

### Manual Cloudflare Pages Deploy (Emergency)

If GitHub Actions is down or broken, deploy manually using Wrangler CLI:

```powershell
# Install Wrangler (one-time)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build locally
pnpm -w build

# Deploy to Pages
wrangler pages deploy apps/playground/dist --project-name=redbyte-ui-genesis --branch=main
```

### Verify Secrets Configured

```powershell
# List repository secrets (names only, not values)
gh secret list
```

Expected output:
```
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

---

**Last Updated**: 2025-12-24
**Document Version**: 1.0
**Applies to**: RedByte OS v0.1.0-preview
