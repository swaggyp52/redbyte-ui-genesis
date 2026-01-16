# FPGA Proof Viewer — Production Deployment Checklist

## ✅ Pre-Deployment Validation (Local)

### Build & Bundle
- [x] `pnpm --filter @redbyte/rb-apps build` → SUCCESS (17.59 kB gzip FpgaProofViewerApp)
- [x] No TypeScript errors
- [x] AppRegistry import warning (expected, pre-existing)
- [x] All 4 tabs (Overview/Vectors/Timeline/Events) bundled

### Assets
- [x] `public/examples/fpga-proof/traffic-light-stateful.capsule.json` exists
- [x] `public/examples/fpga-proof/traffic-light-stateful.events.ndjson` exists
- [x] Capsule JSON parses: 15 results, 16 events, all fields valid
- [x] Events NDJSON parses: 16 lines, first=status, rest=io:update
- [x] Event count matches capsule metadata (16 == 16)

### File Associations
- [x] FPGA Proof Viewer app registered in `index.ts` (import + registerApp)
- [x] File patterns are strict (no .json over-matching):
  - `*.capsule.json` (suffix match)
  - `vector-run-*.json` (prefix + suffix match)
  - `*.events.ndjson` (unique extension)
- [x] No collision with TextViewerApp (.txt, .md) or LogicPlaygroundApp (.rblogic)

### Filesystem Seeding
- [x] `fsModel.ts` has Proofs folder under Documents
- [x] Folder contains 2 seeded files (capsule + events NDJSON) as template strings
- [x] FOLDER_PARENTS map includes `'proofs': 'documents'`
- [x] Fallback works: Open file → FPGA Proof Viewer (via seeded FS)

### Viewer App Features
- [x] Overview tab: Session info, integrity hashes, first-failure highlight
- [x] Vectors tab: Table with 15 rows (name/inputs/expected/observed/verdict)
- [x] Timeline tab: IO updates with tick/SW/BTN/LED, mismatch detection & jump button
- [x] Events tab: Raw NDJSON (16 lines) with metadata
- [x] Load Demo button: Fetches from `/examples/fpga-proof/` URLs (production-safe)
- [x] Error handling: Try-catch in handleLoadDemo, display errors in UI
- [x] Async loading: Promise.all for parallel capsule + events fetch

---

## 🚀 Deployment Instructions

### For Vercel / Netlify / GitHub Pages

1. **Ensure `public/` directory is deployed** (Vite default for SPA/SSG)
   - Static files in `public/examples/fpga-proof/` served at `/examples/fpga-proof/` URLs
   
2. **Verify file structure on deployed server:**
   ```
   /examples/fpga-proof/traffic-light-stateful.capsule.json
   /examples/fpga-proof/traffic-light-stateful.events.ndjson
   ```

3. **Run build in CI/CD:**
   ```bash
   pnpm install --frozen-lockfile
   pnpm -r build
   ```

4. **Deploy the `dist/` output** (includes bundled rb-apps and public assets)

### For Custom Hosting

1. Copy `packages/rb-apps/dist/` to your CDN/web root
2. Copy `public/examples/fpga-proof/` to `/examples/fpga-proof/` in web root
3. Ensure `public/` is served as static root (URLs must resolve to `/examples/fpga-proof/...`)

---

## ✅ Post-Deployment Validation

### URL Checks (on prod domain)

```bash
# Verify assets are reachable
curl https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.capsule.json \
  | jq '.results | length, .[0].name'
# Expected: 15, "t0 GREEN"

curl https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.events.ndjson \
  | head -2
# Expected: status line, io:update line
```

### Browser Tests

1. **Navigate to** `https://redbyteapps.dev`
2. **Open FPGA Proof Viewer** (Apps → FPGA Proof Viewer)
3. **Click "Load Demo Capsule"**
   - Button should show "Loading…"
   - No errors in browser DevTools console
   - All 4 tabs should render
4. **Overview tab:**
   - Session ID visible
   - Board: basys3, Basys3
   - Vectors: 15/15 passed
   - Events: 16 (with sha256 hash)
   - Integrity panel shows hashes
5. **Vectors tab:**
   - Table shows 15 rows
   - First: t0 GREEN, PASS
   - Last: t14 GREEN after reset, PASS
6. **Timeline tab:**
   - 16 IO updates (6 GREEN, 2 YELLOW, 5 RED, reset, 2 GREEN post-reset)
   - No FAIL highlight (all PASS)
   - Jump button disabled (no failures)
7. **Events tab:**
   - 16 NDJSON lines displayed raw
   - Metadata shows: ndjson format, traffic-light-stateful.events.ndjson

### Offline Fallback

1. **Open Files app** (Launcher)
2. **Navigate to** Documents → Proofs
3. **Double-click** `traffic-light-stateful.capsule.json`
4. **Should open FPGA Proof Viewer** with same data (from seeded FS)
5. **Load Demo button will try fetch** but should gracefully handle if offline

---

## 🔴 Known Failure Modes

### Fetch Fails (404 on prod)
- **Cause:** `/examples/fpga-proof/` not deployed to CDN
- **Check:** `curl https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.capsule.json`
- **Fix:** Verify `public/examples/fpga-proof/` in deploy pipeline; check Vercel/Netlify build logs

### NDJSON Not Parsed
- **Cause:** Events file served as binary or with wrong Content-Type
- **Check:** `curl -I https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.events.ndjson` → should be `text/plain` or `application/octet-stream`
- **Fix:** Add `.ndjson` MIME type to `.vercelconfig.json` or `_headers`:
  ```json
  // vercel.json
  {
    "headers": [
      {
        "source": "/(.*).ndjson",
        "headers": [{ "key": "Content-Type", "value": "text/plain" }]
      }
    ]
  }
  ```

### UI Mismatch Detection Not Highlighting Failures
- **Cause:** Check `timelineRows` logic in `FpgaProofViewerApp.tsx` line 390+
- **Expected:** Rows with `verdict === 'FAIL'` get `bg-rose-900/30` class
- **Test:** Manually inject a FAIL result in demo data and verify red highlight

### seeded FS Fallback Doesn't Work
- **Cause:** `fsModel.ts` edits not loaded in app
- **Check:** Open Files app → Documents → Proofs folder visible?
- **Fix:** Verify `fsModel.ts` changes compiled in bundle (`dist/index-*.js` should include proofs content)

---

## 📋 Quick Verification One-Liner

```bash
# After deployment, verify assets load in 2 seconds
time (curl -s https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.capsule.json | jq '.results | length' && \
      curl -s https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.events.ndjson | wc -l)
# Expected: "15" and "16" (or 17 with trailing newline)
```

---

## 🎓 Professor Demo Script

**Setup:** (60 seconds before presentation)
```bash
# Verify URL reachable
curl -I https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.capsule.json
# Expected: 200 OK
```

**Demo Flow:** (3 minutes)

1. **Show app launch** (10 seconds)
   - Click Launcher → search "FPGA" → open
   - Say: "This is the proof viewer for FPGA test vectors"

2. **Load demo** (5 seconds)
   - Click "Load Demo Capsule"
   - Show "Loading…" → completes
   - Say: "Fetching stateful demo: traffic-light FSM with reset semantics"

3. **Overview tab** (20 seconds)
   - Highlight: "15/15 passed, 16 events"
   - Point to hashes: "Every run emits sha256 pins for CI"
   - Say: "Strict mode enforces golden match on every build"

4. **Vectors tab** (20 seconds)
   - Scroll through 15 rows
   - Show transition: "t5-t6 GREEN→YELLOW, t7-t11 RED phase"
   - Point to t12: "Reset button pressed (BTN:2), transitions back to GREEN"

5. **Timeline tab** (20 seconds)
   - Show IO timeline: SW/BTN/LED columns
   - No FAIL highlight (all green)
   - Say: "Every tick is verified against expected output"

6. **Events tab** (10 seconds)
   - Show raw NDJSON: first status event, 15 io:update events
   - Say: "16 immutable event records, cryptographically pinned"

**Conclusion:** (10 seconds)
- "Proof viewer brings CI/CD visibility to hardware tests"
- "Deterministic hashes enable fault injection testing"

---

## 🔗 Files Modified

1. [FpgaProofViewerApp.tsx](packages/rb-apps/src/apps/FpgaProofViewerApp.tsx) — Fetch logic, integrity UI, timeline mismatch
2. [index.ts](packages/rb-apps/src/index.ts) — App registration
3. [fileActionTargets.ts](packages/rb-apps/src/apps/files/fileActionTargets.ts) — FPGA file associations
4. [fsModel.ts](packages/rb-apps/src/apps/files/fsModel.ts) — Seeded demo in Proofs folder
5. `public/examples/fpga-proof/traffic-light-stateful.{capsule.json,events.ndjson}` — Static assets

---

**Status:** ✅ Ready for deployment  
**Last Validated:** 2026-01-16 (build SUCCESS, assets VALID, app REGISTERED)  
**Next Step:** Trigger CI/CD to redbyteapps.dev
2. **"Every run emits a capsule + hash-pinned events, then I can replay/visualize it."**
3. **"Golden baseline is attested; strict mode makes CI treat hash mismatches as invalid."**
4. **"No hardware needed — this is a pure-JavaScript verification lab."**

---

## Ready to Demo: ✓

- [x] App registered and routable
- [x] Demo artifacts in public/ (production-safe)
- [x] Fetch-based loading (works on web)
- [x] Offline fallback via seeded FS
- [x] File associations strict (no over-matching)
- [x] Error handling + user feedback
- [x] Integrity checks displayed
- [x] Timeline mismatch highlighted
- [x] Build verified, no errors
