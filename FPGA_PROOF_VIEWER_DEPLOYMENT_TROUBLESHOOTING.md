# FPGA Proof Viewer —Deployment Troubleshooting

## Symptom
"Not seeing the app or icon or anything on the most recent deployed website"

## Diagnosis

### ✅ What's Confirmed Working
1. App is **compiled** in the bundle (`FpgaProofViewerApp-CT5vOeC6.js`)
2. App is **registered** in `index.ts` via `registerAllApps()`
3. App has proper **manifest** with id, name, icon, and component
4. App is **exported** from FpgaProofViewerApp.tsx

### Where the App Appears

The FPGA Proof Viewer is **NOT pinned to the Desktop by default** (unlike Logic Playground).

Instead, you access it via:

**Method 1: Launcher → Search**
1. Click the **Launcher** icon (bottom left, or press logo key)
2. Type: `fpga` or `proof` or `viewer`
3. App should appear: "FPGA Proof Viewer"
4. Click to open

**Method 2: Launcher → Scroll All Apps**
1. Open Launcher
2. Don't type anything (no search)
3. Scroll down past Recent/Pinned apps
4. Should see "FPGA Proof Viewer" in the full list

**Method 3: Files → Proofs**
1. Open Files app
2. Navigate: Documents → Proofs
3. Open `traffic-light-stateful.capsule.json`
4. Should open in FPGA Proof Viewer (via file association)

---

## Quick Verification Commands

### 1. Check App is in Bundle
```bash
# Local: Build and check
pnpm --filter @redbyte/rb-apps build
grep -l "FpgaProofViewerApp" packages/rb-apps/dist/*.js
# Should return: FpgaProofViewerApp-CT5vOeC6.js and index-CWOdnrCq.js
```

### 2. Check App Renders in Launcher
Open browser DevTools console and run:
```javascript
// Check if app registry has the app
const { listApps } = await import('@redbyte/rb-apps');
const apps = listApps();
const fpgaApp = apps.find(app => app.manifest.id === 'fpga-proof-viewer');
console.log(fpgaApp ? '✓ App found' : '✗ App NOT found', fpgaApp);
```

Expected output:
```
✓ App found {
  manifest: { id: 'fpga-proof-viewer', name: 'FPGA Proof Viewer', ... },
  component: [Function]
}
```

### 3. Check if Launcher Lists the App
```javascript
const { getAppsForLauncher } = await import('@redbyte/rb-apps');
const launcherApps = getAppsForLauncher();
console.log(launcherApps.find(a => a.id === 'fpga-proof-viewer'));
```

Expected output:
```
{ id: 'fpga-proof-viewer', name: 'FPGA Proof Viewer' }
```

---

## Possible Issues & Fixes

### Issue 1: App Not Showing in Launcher Search
**Symptom:** Search for "FPGA" and nothing appears

**Cause:** `registerAllApps()` not called on startup

**Fix:** Check `apps/playground/src/boot/full-bootstrap.ts` line 19:
```typescript
await registerAllApps();  // Must be called before Shell renders
```

**Verify:** Open browser console, run:
```javascript
const apps = await (await import('@redbyte/rb-apps')).listApps();
console.log(apps.length, 'apps registered');
console.log(apps.map(a => a.manifest.id));
```

Should include: `fpga-proof-viewer`

### Issue 2: App Showing in Menu But Won't Open
**Symptom:** App appears in Launcher but clicking does nothing

**Cause:** Component or icon import error

**Fix:** Check browser console for errors:
- `Cannot find module '@redbyte/rb-icons' ChipIcon`
- `FpgaProofViewerComponent is not a function`

**Verify:** The `chip` icon exists and is imported in [AppStoreApp.tsx](packages/rb-apps/src/apps/AppStoreApp.tsx#L87):
```typescript
case 'chip':
  return <ChipIcon width={size} height={size} />;
```

### Issue 3: Launcher Menu Missing Entirely
**Symptom:** No Launcher icon visible anywhere

**Cause:** Issue with Shell or dock rendering (not specific to FPGA Proof Viewer)

**Fix:** Clear browser cache, hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

---

## How to Force Show the App

If the app is compiled and registered but not visible, try these debugging steps:

### In Browser Console
```javascript
// 1. Verify build loaded
const { listApps } = await import('@redbyte/rb-apps');
const all = listApps();
console.log(`Total apps: ${all.length}`);
all.forEach(app => console.log(`- ${app.manifest.id}: ${app.manifest.name}`));

// 2. Check if FPGA Proof Viewer is there
const fpga = all.find(a => a.manifest.id === 'fpga-proof-viewer');
console.log(fpga ? '✓ FPGA Proof Viewer FOUND' : '✗ NOT FOUND');

// 3. Try to manually open it (if window store accessible)
// Look for window open function in the site's global state
```

### Clear and Retry
```bash
# Hard refresh to clear cache
# Or: Developer Tools → Storage → Clear all
# Or: Delete localStorage:
#   localStorage.clear(); location.reload();
```

---

## Success Criteria

When working correctly, you should see:

1. **Launcher opens** (click icon or press Super/Windows key)
2. **Search works** (type "fpga" → app appears)
3. **App opens** (click "FPGA Proof Viewer")
4. **4 tabs visible** (Overview, Vectors, Timeline, Events)
5. **"Load Demo Capsule" button** appears in header
6. **Click button** → Data loads in < 1 second (assuming CDN)

---

## Next Steps

1. **Open Launcher** and search for "FPGA"
2. **Check browser console** (F12) for any errors
3. **If app appears but doesn't open:** Report the console error
4. **If app doesn't appear:** Check that latest build was deployed
5. **If nothing works:** Hard refresh (`Ctrl+Shift+R`)

The app is definitely compiled and ready - it just needs to be found via Launcher search!

---

**Key Insight:** The app doesn't appear on the Desktop by default. It's only accessible via:
- Launcher search ("FPGA")
- Files app → Proofs folder
- Recently opened apps (after first open)

This is by design - not all apps are pinned.
