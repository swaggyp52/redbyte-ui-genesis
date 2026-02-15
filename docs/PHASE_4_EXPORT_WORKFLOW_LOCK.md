# PHASE 4 — Export / Evidence Workflow Lock

## 1. Canonical Submission Artifact
- Canonical format: `.rb-lab.zip`
- One file contains circuit, evidence, manifest, and integrity hash.

## 2. Naming Scheme
- Format: `RB-<labId>-<studentName>-<YYYY-MM-DD>.rb-lab.zip`
- Examples:
  - `RB-Lab0-JohnDoe-2026-02-15.rb-lab.zip`
  - `RB-ECELab3-TeamAlpha-2026-03-01.rb-lab.zip`
  - `RB-recovery-2026-02-15.rb-lab.zip` (fallback)

## 3. Preflight Checks
- Blocking errors:
  - Empty project title
  - No circuit nodes
  - Combinatorial loops detected
- Warnings:
  - Probe buffer > 100k samples
  - Hardware mode unclear
  - Missing student name

## 4. TA Inspection Flow
- Click path:
  1. Open Launcher (RedByte button in top bar)
  2. Click "Submission Inspector"
  3. Drag/drop `.rb-lab.zip` into drop zone
- Inspector shows:
  - Lab ID, student name/ID, submission date
  - Hardware mode, verdict, integrity hash
  - Circuit preview and reproducibility summary

## 5. Files Edited
- `packages/rb-apps/src/utils/bundleExport.ts`
- `packages/rb-apps/src/utils/evidenceExport.ts`
- `packages/rb-apps/src/utils/exportPreflight.ts`
- `packages/rb-apps/src/apps/SubmissionInspectorApp.tsx` (manifest `hidden: false`, TA mode support)
- `packages/rb-apps/src/launcherData.ts` (TA mode whitelist for submission-inspector)
- `packages/rb-apps/src/studentAppGate.ts` (TA mode override for student gating)
- `packages/rb-apps/src/index.ts` + `.js` (added submission-inspector to e2e-boot registration)
- `apps/playground/vite.config.ts` (Windows ENOTEMPTY fix: `emptyOutDir: false`)
- `apps/playground/package.json` (build script: `--emptyOutDir false`)
- `tests/e2e/stability-triage.spec.ts` (TA mode E2E test for submission inspector)

## 6. Verification Commands Run + Results
- `pnpm rc:check`
  - Initial FAIL (Windows build issue):
    - `vite:prepare-out-dir` ENOTEMPTY on `apps/playground/dist/assets`
    - **Fix**: Disabled `emptyOutDir` on Windows platform
  - Second FAIL (E2E test timeout):
    - E2E test "submission inspector app is accessible" timed out (30s)
    - **Root cause**: `submission-inspector` app not registered in `e2e-boot` mode
    - **Fix**: Added `submission-inspector` to `registerAllApps()` e2e-boot whitelist in `packages/rb-apps/src/index.ts` + `.js`
- ✅ **FINAL PASS** (all gates green):
  - Build: SUCCESS (35 packages, playground built in 10.32s)
  - Unit tests: 23+ gate tests PASSED (sim, probe, export, hardware, UI contracts)
  - E2E smoke tests: 4/4 PASSED
    - ✅ Shell boots to desktop without fatal errors (440ms)
    - ✅ Dashboard and studio apps are registered (2.3s)
    - ✅ Export functionality is accessible (4.3s)
    - ✅ **Submission inspector app is accessible (4.9s)** 🎉

**Phase 4 Export Workflow Lock: COMPLETE & VERIFIED**
