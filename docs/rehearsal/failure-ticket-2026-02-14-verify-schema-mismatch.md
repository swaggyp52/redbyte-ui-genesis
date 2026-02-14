# Rehearsal Failure Ticket

## Ticket

- Date: 2026-02-14
- Owner: Connor Angiel
- Environment:
  - Mode: student
  - OS: Windows
  - Node: 20.19.0
  - pnpm: 10.24.0
  - Board connected: no
- Step ID: verify_bundle
- Error code: verify_schema_mismatch
- Severity: blocker

## Observed Behavior

- What happened: `pnpm v1:verify -- packages/ops/labs/fixtures/student-export-pass.rb-lab.zip` failed on a valid student-export fixture.
- Expected behavior: verifier accepts canonical student export bundle schema used by classroom export path.
- Repro steps:
  1. Run `pnpm v1:rehearse`
  2. Run `pnpm v1:verify -- packages/ops/labs/fixtures/student-export-pass.rb-lab.zip`

## Evidence

- Doctor report file: n/a
- Export bundle file: `packages/ops/labs/fixtures/student-export-pass.rb-lab.zip`
- Console excerpt:
  - `manifest schema_version mismatch: expected rb_submission_manifest_v1, got v1`
  - `manifest bundleSchemaVersion mismatch: expected rb_submission_bundle_v1, got undefined`
  - `manifest includedFiles must be a non-empty array`
- Screenshot/video link: n/a

## Remediation

- Suggested first action: add verifier support for legacy classroom export manifest schema `v1` with proof file presence checks.
- Follow-up action: add regression test for `v1` schema acceptance path.
- Verification command: `pnpm -w exec vitest run packages/rb-apps/src/__tests__/v1-verify-bundle-script.test.ts`
- Verification result: pass (`3 passed`)

## Disposition

- Status: fixed
- Fix commit: pending (release/v1.0.0-next-lab-ready)
- Notes: bug-fix only; no architecture changes.
