---
type: bug
status: fixed
area: infrastructure
priority: medium
source: audit
updated: 2026-05-02
related:
  - "[[Test Infrastructure]]"
  - "[[Verify Engine]]"
---

# BUG-003 - React.act Infrastructure Failure

**Status:** Closed on 2026-03-25 after audit. The documented literal `React.act is not a function` failure no longer reproduces in the current repo state.

Current as of 2026-05-02: this note stays closed, but the repo still uses **BUG-003 family** as shorthand for the broader pre-existing render-suite baseline tracked in `AI_STATE.md`. Do not reopen this bug unless the literal `React.act` failure returns.

---

## Summary

The earlier note said every `render(<VerifySurface />)` suite failed immediately with `TypeError: React.act is not a function`. That is no longer true.

Current evidence from the repo on 2026-03-25:

- `verifySurface-fail-state.test.tsx` -> PASS (`3 tests`)
- `verifySurface.failure-context.test.tsx` -> PASS (`2 tests`)
- `verifySurface.authoring.test.tsx` -> PASS (`11 tests`)
- `verifySurface.three-panel.test.tsx` -> PASS (`3 tests`)
- `verifySurface.workstation.test.tsx` -> PASS (`23 tests`)

The one red suite reproduced during this audit was `verifySurface.hints-bridge.test.tsx`, but it fails because `ide-verify-hint-callout` is now rendered only when the analysis drawer is open. That is a DOM expectation mismatch inside one Verify suite, not a React test harness failure.

---

## Audit Findings

- Installed versions are:
  - `react@19.2.1`
  - `react-dom@19.2.1`
  - `@testing-library/react@16.1.0`
- The current installed `@testing-library/react/dist/act-compat.js` already prefers `React.act` when it exists.
- Direct probe in the current environment showed both `React.act` and `react-dom/test-utils.act` resolve to functions.
- `vitest.config.ts` forces a single React / ReactDOM instance through explicit aliases, which is the important harness invariant for this repo.
- Search across repo code and live test output did not reproduce the literal `React.act is not a function` failure. That claim now appears only in documentation.

This means the earlier BUG-003 note is stale. The repo may have had a real incompatibility during an earlier transition, but that is not the current failure mode.

---

## Impact

BUG-003 is no longer a blocking infrastructure issue.

What remains today:

- component render suites are usable under the current harness
- one VerifySurface suite still has a normal behavior/test expectation mismatch
- several VerifySurface suites emit `buildVerifySessionViewModel: signalInventory is absent...` stderr messages, which is a separate data-contract / UX warning issue, not an `act` crash

---

## Recommendation

- Do not upgrade `@testing-library/react` solely to fix BUG-003.
- Do not add per-test `act` shims solely to fix BUG-003.
- Treat future failing render suites as ordinary suite-level regressions unless the literal `React.act is not a function` failure reappears.
- If the repo wants dependency modernization later, do it as a separate hygiene task with current evidence, not as a hotfix for this bug.

---

## Proof

- `pnpm exec node -e "const React=require('./packages/rb-apps/node_modules/react'); console.log(typeof React.act);"` -> `function`
- `pnpm exec node -e "const ReactDOMTestUtils=require('./packages/rb-apps/node_modules/react-dom/test-utils'); console.log(typeof ReactDOMTestUtils.act);"` -> `function`
- `pnpm exec node -e "const pkg=require('./node_modules/@testing-library/react/package.json'); console.log(pkg.version);"` -> `16.1.0`
- `pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface-fail-state.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.failure-context.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.authoring.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.three-panel.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx` -> PASS (`42 tests`)
- `pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.hints-bridge.test.tsx` -> FAIL (`3 tests`) because `[data-testid="ide-verify-hint-callout"]` is absent, not because of `React.act`

---

## Remaining concern

- `verifySurface.hints-bridge.test.tsx` expects the hint callout without opening the analysis drawer, but `VerifySurface.tsx` now renders that callout behind `drawerOpen && hasSessionFailureEvidence && verifyHint`.
- The stderr `signalInventory` warnings should be handled as their own test/data-contract follow-up if they are still considered noisy or incorrect.

---

## Related

- [[Test Infrastructure]] - React render harness notes
