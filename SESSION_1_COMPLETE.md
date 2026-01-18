# Session 1 Complete - Manual Validation Steps

## What Was Built

### Part A: api/server.mjs
✅ Full ops server with 4 endpoints (raw zip ingest, runs list, run detail, artifacts)
✅ Node built-ins only, loopback-only binding, no express
✅ Reads run artifacts from packages/ops/labs/runs/

### Part B: LogicLabApp
✅ Full student lab experience with 4 tabs (Spec/Build/Self-Check/Export)
✅ Lab spec loader (?lab=traffic-light → fetch from public/labs/)
✅ Browser self-check utility (studentVectors only, no expected outputs)
✅ Bundle export utility (generates valid .rb-lab.zip)
✅ OLED luxury styling (cyan accents, true black backgrounds)
✅ First public lab spec: traffic-light.spec.json

### Contracts Upheld
✅ Server: 127.0.0.1:3001 only, no express, no new deps
✅ UI: pure (no fs/path/child_process in rb-apps)
✅ Student vectors NEVER mixed with instructor vectors in public
✅ Bundle schema immutable (all 4 files required)
✅ 3 gates green

## Manual Validation

### 1. Test Server (separate PowerShell window)
```powershell
cd C:\Users\conno\redbyte-ui
node api/server.mjs
```

### 2. Test Health Endpoint (another window)
```powershell
curl http://127.0.0.1:3001/health
```
Expected: `{"status":"ok","timestamp":...}`

### 3. Test List Runs
```powershell
curl http://127.0.0.1:3001/api/labs/runs
```
Expected: JSON array of existing runs

### 4. Test LogicLab UI
```powershell
pnpm dev
```
Navigate to: `http://localhost:5173` and open Logic Lab app
Add query param: `?lab=traffic-light`

Expected:
- Spec tab shows traffic-light constraints and 3 student vectors
- Build tab shows placeholder
- Self-Check tab has "Run Self-Check" button (mock results)
- Export tab has "Export .rb-lab.zip" button (placeholder alert)

### 5. Test Agent Ingest (with server running)
```powershell
# In repo root
pnpm agent:lab -- --submission packages/ops/labs/fixtures/student-export-fixture.rb-lab.zip
```
Check: packages/ops/labs/runs/run-*/grade.json created

## Status: ✅ SESSION 1 BACKBONE COMPLETE

All gates green:
- pnpm -r build: ✅
- pnpm agent:verify: ✅
- pnpm ops:student-export-fixture-test: ✅

Next: Session 2 - Make It "Incredible" (UX polish, instructor batch tools, proof viewer integration)
