# Phase 3A-2 Smoke Checklist (Error Boundaries + Student-Friendly Errors)

## Last Validated
- Date: (pending)
- Commit: (pending)
- Browser: (pending)
- Result: PASS / FAIL

## Goals
- Shell stays usable when an app crashes (per-app boundary).
- Students see a student-friendly message (no raw stacks by default).
- Developers/instructors can copy/export details when needed.

## Scripted Gates (preferred)
- `pnpm -s os:error-boundary-gate`
- `pnpm -r build`

## Manual Checks (optional)
1. Trigger a known error path (e.g., disconnect Bridge mid-action or load an invalid evidence file).
2. Confirm the message text matches `docs/ERROR_MESSAGE_MATRIX.md` semantics (Bridge unreachable / Evidence invalid).
3. Confirm the fallback UI offers:
   - **Reload App** (per-app boundary)
   - **Copy Error Details** (debug)
   - **Reload Page** (last resort)

## Revalidate When...
Re-run this checklist when changing any of:
- `packages/rb-apps/src/components/ErrorBoundary.*`
- `packages/rb-shell/src/Shell.*` (per-app crash boundary)
- `packages/rb-shell/src/ErrorBoundary.*` (top-level shell boundary)
- `packages/rb-utils/src/studentError.*`

