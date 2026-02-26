# PR20 Audit (IDE-Only)

## Scope
- IDE-only audit focused on project -> verify -> submission export -> submission import/viewer -> inspector grading.
- Excluded: screenshot baselines and non-IDE shell/home/launcher work.

## Findings

### 1) Missing submission integrity enforcement (fixed in this slice)
- Severity: High
- Area: Import / Submission
- Repro:
  1. Modify `project.rbproj.json` inside an IDE submission ZIP without updating `manifest.json` hashes.
  2. Import ZIP as submission.
  3. Prior behavior accepted the tampered bundle.
- Suspected root cause:
  - `packages/rb-apps/src/export/parseIdeSubmission.ts`
  - parser validated shape only, not listed file hashes/sizes.
- Fix strategy:
  - Add `SubmissionIntegrityError`.
  - Verify `manifest.includedFiles` entries (hash + size) when present and non-empty.
  - Preserve compatibility for legacy bundles missing or empty `includedFiles`.
- Acceptance:
  - `packages/rb-apps/src/export/__tests__/parseIdeSubmission.test.ts`
  - `pnpm -s classroom:gate`

### 2) Import fallback ambiguity for invalid submission bundles (fixed in this slice)
- Severity: High
- Area: Import
- Repro:
  1. Provide submission ZIP with integrity mismatch.
  2. Prior behavior could fall through toward Vivado ZIP path.
- Suspected root cause:
  - `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
  - catch path only distinguished `NotASubmissionZipError`.
- Fix strategy:
  - Treat `SubmissionIntegrityError` as hard submission failure.
  - Keep fallback only for true non-submission ZIPs.
- Acceptance:
  - `packages/rb-apps/src/export/__tests__/parseIdeSubmission.test.ts`
  - `pnpm -s ide:gate:zip-import-contract`

### 3) Closure-loop runtime was too expensive (fixed in this slice)
- Severity: Medium
- Area: CI / Developer workflow
- Repro:
  1. Run `pnpm -s ide:gate:fast`.
  2. Wait ~11 minutes for 55 serial gate scripts.
- Suspected root cause:
  - `scripts/gates/ide-gate-fast.mjs` runs all IDE gates by default.
- Fix strategy:
  - Add a focused `classroom:gate` script for classroom-critical IDE checks.
  - Wire PR truth workflow to run `classroom:gate`.
- Acceptance:
  - `pnpm -s classroom:gate`
  - `.github/workflows/pr-truth-gates.yml` includes `Gate - IDE classroom loop`

## Residual risks
- Legacy bundles with missing/empty `includedFiles` are accepted for compatibility; integrity is not cryptographically verified for those legacy artifacts.
- Some test suites still initialize broader app registry (RB_APP_OK lines for non-IDE apps), though the audited logic and touched files are IDE-scoped.
