# Pre-Professor Demo Checklist

**Date**: January 14, 2026  
**Demo Topic**: Classroom-safe Logic Playground with 20-node hard limits

---

## ✅ CRITICAL: 5 Minutes Before Demo

### 1. Clear Browser Cache (Demo Machine)
- Open **Incognito/InPrivate** window
- Or: DevTools → Application → Clear site data
- Hard reload: `Ctrl+Shift+R`
- **WHY**: Avoid cached broken JS from old builds

### 2. Verify Demo Environment is Clean
```
Open: http://127.0.0.1:3000 (dev server - SAFEST)
OR: https://redbyteapps.dev (if deployed)

✓ Open Logic Playground (click desktop icon)
✓ Console shows NO red errors
✓ Build a 2-node circuit (Toggle → Lamp)
✓ Click "Safe Mode" toggle in top-right
✓ Try to add 20+ nodes (banner should appear)
✓ Refresh page → verify clean reload
```

### 3. One-Line Story
> "I made RedByte classroom-safe with hard limits and auto-degrade at the mutation boundary—students can't crash the app anymore."

---

## 🟢 What Works (Demo These)

- ✅ **20-node hard limit** enforced at circuit mutation boundary
- ✅ **Auto-degrade to Safe Mode** when limit hit
- ✅ **Banner UI** with undo option
- ✅ **Reset Workspace** (Clear Circuit + Clear Safe Mode)
- ✅ **E2E tests** prove guardrails work (safe-mode.spec.ts passing)
- ✅ **Production build** clean (no `require()` errors in bundle)

---

## 🔴 Known Issues (DON'T Demo These)

### Issue #1: "require is not defined" in screenshot
- **Root Cause**: Cached old deployment OR browser cache
- **Status**: Current build is CLEAN (verified no `require()` in dist)
- **If It Happens**: Switch to incognito window or local dev server
- **Action**: Purge Cloudflare cache / redeploy post-demo

### Issue #2: CI smoke tests timeout
- **Root Cause**: Preview builds crash (Shell renders but Boot/Desktop never appear)
- **Status**: Tests now correctly click desktop icon (realistic flow)
- **Blocker**: Shell.tsx silently crashes in production mode
- **Action**: Investigate post-demo why `#root` becomes empty

### Issue #3: Preview builds don't work
- **Symptom**: `pnpm preview` shows blank screen
- **Evidence**: `RB_APPS_REGISTERED` logs, but Boot/Desktop never render
- **Impact**: CI can't test, but dev server works perfectly
- **Action**: Debug Shell component lifecycle in production mode

---

## 📋 Pre-Demo Terminal Setup

### Window 1: Dev Server (SAFEST)
```powershell
cd C:\Users\conno\redbyte-ui
pnpm --filter @redbyte/playground dev --host
# Opens at http://127.0.0.1:3000
```

### Window 2: Build Verification (if needed)
```powershell
cd C:\Users\conno\redbyte-ui
pnpm -r run build
pnpm --filter @redbyte/playground preview --host --port 4173
# Opens at http://127.0.0.1:4173
```

---

## 🎯 Demo Script (60 seconds)

1. **Open Logic Playground** (click desktop icon)
2. **Build simple circuit**: PowerSource → Switch → AND → Lamp
3. **Show Safe Mode works**: Toggle switch, verify lamp lights
4. **Show 20-node limit**: 
   - Try to drag 18 more chips (or spam palette)
   - Banner appears: "Circuit too complex - Safe Mode enabled"
5. **Show undo**: Click "Undo last add" in banner
6. **Show Reset Workspace**: Top-right button clears everything
7. **Refresh page**: Verify clean reload (no console errors)

**One-liner**: "Students can't accidentally build 1000-node circuits and crash the simulation anymore."

---

## 🔧 Post-Demo TODO

### P0 (Blocking CI)
- [ ] Fix Shell rendering in preview builds (investigate StrictMode double-mount?)
- [ ] Identify why Boot/Desktop never appear in production mode
- [ ] Verify ErrorBoundary isn't silently catching crash

### P1 (Polish)
- [ ] Purge deployment cache (if require error persists on redbyteapps.dev)
- [ ] Split smoke suite: 1 true smoke + 5 integration tests
- [ ] Add E2E flag for openApp (if needed long-term)

### P2 (Nice to have)
- [ ] Banner E2E detection (Zustand limitation, low priority)
- [ ] Diagnostic test cleanup (remove diagnose-boot.spec.ts)

---

## 📊 Evidence Collection (for post-mortem)

### Current Bundle Hashes (Jan 14, 2026)
```
app-logic-BlQ0d0-8.js (134.77 kB)
rb-shell-NriFm8VT.js (85.64 kB)
rb-apps-D4CC-Bp7.js (360.52 kB)
```

### Verified Clean
```powershell
Select-String -Path ".\apps\playground\dist\assets\app-logic-*.js" -Pattern "\brequire\b"
# Result: NO MATCHES (bundle is clean)
```

### Last Working Commits
- `dd722330` - Test improvements (realistic desktop icon click)
- `fc7bdca1` - Revert Shell debug logging
- `b214e475` - Prior: Added navigator.webdriver check (reverted)

---

## 🆘 Emergency Fallback

If demo environment implodes:
1. **Switch to incognito window** (clears cache)
2. **Use local dev server** (`pnpm dev --host`)
3. **Show E2E test recording** (`tests/e2e/safe-mode.spec.ts`)
4. **Explain verbally**: "Classroom guardrails prevent 1000-node circuits"

**DO NOT**:
- ❌ Debug live in front of professor
- ❌ Try to fix CI during demo
- ❌ Show the "require is not defined" error
- ❌ Apologize for things he can't see

---

## ✅ Final Checklist (Check boxes before demo)

- [ ] Incognito window open
- [ ] Dev server running (`pnpm dev --host`)
- [ ] Logic Playground opens cleanly
- [ ] Console shows NO red errors
- [ ] Banner appears when spamming nodes
- [ ] Reset Workspace works
- [ ] One-line story memorized
- [ ] Backup: E2E test video ready (if needed)

**Time Budget**: 90 seconds demo + 30 seconds questions = 2 minutes total

Good luck! 🚀
