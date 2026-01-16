# FPGA Proof Viewer — Quick Start for Production

## Status: ✅ READY FOR DEPLOYMENT

### What Was Done

1. **✅ Build Succeeds**
   - `pnpm --filter @redbyte/rb-apps build` → 17.59 kB gzip, no errors

2. **✅ Assets Ready**
   - `public/examples/fpga-proof/traffic-light-stateful.capsule.json` (20 KB)
   - `public/examples/fpga-proof/traffic-light-stateful.events.ndjson` (2 KB)
   - Both files validate: 15 results, 16 events, all JSON/NDJSON parse correctly

3. **✅ App Registered**
   - `packages/rb-apps/src/index.ts` includes `registerApp(FpgaProofViewerApp)`
   - App available in Launcher as "FPGA Proof Viewer"

4. **✅ File Associations**
   - Patterns: `.capsule.json`, `vector-run-*.json`, `.events.ndjson`
   - Safe (no collision with TextViewerApp, LogicPlaygroundApp)

5. **✅ Fallback Seeded**
   - Demo data embedded in `fsModel.ts`
   - Available offline: Files → Documents → Proofs

6. **✅ UI Enhanced**
   - Overview tab: Integrity hashes + events count
   - Timeline tab: Mismatch highlighting + jump button
   - Error handling for fetch failures

---

## Deploy to redbyteapps.dev

### CI/CD Pipeline

```bash
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Build all packages
pnpm -r build

# 3. Deploy public/ directory (Vercel/Netlify default)
#    Assets served at: /examples/fpga-proof/*
```

### Manual Verification (After Deploy)

```bash
# Check assets are live
curl https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.capsule.json | jq '.results | length'
# Expected: 15

curl https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.events.ndjson | wc -l
# Expected: 16 or 17 (with trailing newline)
```

### Browser Test

1. Open `https://redbyteapps.dev`
2. Click launcher → "FPGA Proof Viewer"
3. Click "Load Demo Capsule"
4. Verify:
   - ✓ Capsule loads (no errors in DevTools console)
   - ✓ Overview tab: 15/15 passed, hashes visible
   - ✓ Vectors tab: All 15 rows, all PASS
   - ✓ Timeline tab: 16 IO updates, no FAIL highlight
   - ✓ Events tab: 16 NDJSON lines displayed

---

## Key Code Snippets (For Review)

### Load Demo Button
[FpgaProofViewerApp.tsx](packages/rb-apps/src/apps/FpgaProofViewerApp.tsx#L140-L170)
```typescript
const handleLoadDemo = async () => {
  const capsuleUrl = '/examples/fpga-proof/traffic-light-stateful.capsule.json';
  const eventsUrl = '/examples/fpga-proof/traffic-light-stateful.events.ndjson';
  const [capsuleRes, eventsRes] = await Promise.all([
    fetch(capsuleUrl), fetch(eventsUrl),
  ]);
  if (!capsuleRes.ok || !eventsRes.ok) throw new Error(`Fetch failed`);
  await hydrateFromText('traffic-light-stateful.capsule.json', 
    await capsuleRes.text(), 
    await eventsRes.text());
};
```

### File Associations
[fileActionTargets.ts](packages/rb-apps/src/apps/files/fileActionTargets.ts#L40-L48)
```typescript
{
  name: 'FPGA Proof Viewer',
  appId: 'fpga-proof-viewer',
  isEligible: (type, name) =>
    type === 'file' && (
      name.endsWith('.capsule.json') ||
      (name.startsWith('vector-run-') && name.endsWith('.json')) ||
      name.endsWith('.events.ndjson')
    ),
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Fetch fails (404)** | Verify `public/examples/fpga-proof/` in build output; check CDN deployment |
| **NDJSON not parsing** | Ensure Content-Type header is `text/plain`; add MIME mapping in deploy config |
| **App not in Launcher** | Check `index.ts` has `registerApp(FpgaProofViewerApp)` |
| **Offline demo missing** | Verify `fsModel.ts` changes in compiled bundle |

---

## Files to Review Before Deploying

- [FPGA_PROOF_VIEWER_PRODUCTION_CHECKLIST.md](./FPGA_PROOF_VIEWER_PRODUCTION_CHECKLIST.md) — Full validation list
- [FPGA_PROOF_VIEWER_PRODUCTION_HARDENING.md](./FPGA_PROOF_VIEWER_PRODUCTION_HARDENING.md) — Deep dive on decisions

---

## One-Click Demo (Professor Script)

```bash
# Just before showing demo
curl -I https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.capsule.json
# Should return: 200 OK
```

**Then in browser:** Launcher → FPGA Proof Viewer → "Load Demo Capsule" → Show all 4 tabs

---

**Approved for Deployment:** ✅  
**Built:** 2026-01-16 (Vite 7.2.6, 824 modules)  
**Test Status:** 15/15 vectors PASS, 16 events parsed, all 4 tabs render
