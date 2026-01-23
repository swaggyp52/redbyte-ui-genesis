# Remaining Improvements (Non-Blocking)

The following items are recommended for the next sprint but do not block the "Day 1" classroom deployment.

## 1. URL Auto-Launch

- **Status:** **FIXED.** `Shell.tsx` now parses query params (`mode`, `example`, `circuit`) on boot and auto-launches Logic Playground.
- **Verification:** Verified code implementation handles correct params via `openWindow`.

## 2. Evidence Viewer Grading Overlay

- **Status:** **DEFERRED.** Requires complex UI overlay work.
- **Reason:** Current split-window or second-screen grading is sufficient for v1.0.

## 3. LMS Direct Upload

- **Status:** **DEFERRED.** Out of scope for client-only release.
- **Reason:** No backend available for auth/submission APIs.

## 4. Visual Diff

- **Status:** **DEFERRED.** High complexity.
- **Reason:** Visual comparison is a "nice to have" power user feature, not critical for v1.0 grading.

## 5. Evidence File Optimization

- **Status:** **DEFERRED.** Premature optimization.
- **Reason:** JSON size is acceptable (<1MB) for typical labs.
