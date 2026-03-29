---
type: architecture
status: active
area: infrastructure
updated: 2026-03-29
related:
  - "[[BUG-003 React.act Infrastructure Failure]]"
  - "[[BUG-001 Connection Fixture Format Mismatch]]"
  - "[[BUG-002 VerifyHints Priority Inconsistency]]"
  - "[[Connection Model]]"
  - "[[Verify Hint System]]"
---

# Test Infrastructure

**Runner:** Vitest 2.1.8
**Config:** `vitest.config.ts` (root)
**Status:** Pure-logic tests green. React component render tests are usable under the current React 19 harness.

---

## Test Discovery Pattern

```typescript
// vitest.config.ts include patterns:
'packages/**/__tests__/**/*.test.ts'
'packages/**/__tests__/**/*.test.tsx'
'packages/**/*.test.ts'
'packages/**/*.test.tsx'
```

Tests live in two locations:

- `packages/rb-apps/src/__tests__/` - shared/integration tests
- `packages/rb-apps/src/apps/ide/__tests__/` - IDE-specific tests

Both locations are auto-discovered.

---

## Running Tests

```bash
# From Windows (pnpm available)
pnpm -w exec vitest run --config vitest.config.ts <path-to-test>

# Single suite
pnpm -w exec vitest run --config vitest.config.ts packages/rb-apps/src/__tests__/export-authority-chain-contract.test.ts

# Multiple suites
pnpm -w exec vitest run --config vitest.config.ts \
  packages/rb-apps/src/__tests__/export-authority-chain-contract.test.ts \
  packages/rb-apps/src/apps/ide/__tests__/signal-inventory-contract.test.ts
```

> **Note:** The vitest binary at `node_modules/.bin/vitest` has Windows-specific paths hardcoded. It only works from the Windows side via `pnpm`. It cannot be invoked from the Linux VM sandbox directly.

## Preview-backed Gate Validation

Preview-backed authorities do **not** run against Vitest source transforms. They run against the built `@redbyte/playground` preview bundle.

- `scripts/gates/*.mjs`
- `scripts/repo-status.mjs`
- `pnpm -s classroom:signoff`

After UI/source edits that affect preview-backed gates, rebuild the playground before rerunning those authorities:

```bash
pnpm --filter @redbyte/playground build
```

Current gate-maintenance rules:

- prefer `loadStarterProject(page, options)` from `scripts/gates/_gateHarness.mjs` over hardcoded starter selectors
- quiet Design may hide the empty workbench console completely; only real compiler diagnostics should reclaim it
- Board Resources may start collapsed in Design and must be explicitly opened by board-placement gates
- Verify left-dock gates may need to restore the left dock from the rail before asserting signal-list chrome

---

## React Render Harness Status

[[BUG-003 React.act Infrastructure Failure]] is now a closed audit note, not a live blocker.

What the 2026-03-25 audit confirmed:

- `verifySurface-fail-state.test.tsx` passes
- `verifySurface.failure-context.test.tsx` passes
- `verifySurface.authoring.test.tsx` passes
- `verifySurface.three-panel.test.tsx` passes
- `verifySurface.workstation.test.tsx` passes

Important harness facts:

- installed versions are `react@19.2.1`, `react-dom@19.2.1`, and `@testing-library/react@16.1.0`
- the installed `@testing-library/react/dist/act-compat.js` already prefers `React.act` when present
- `vitest.config.ts` aliases React and ReactDOM to a single instance, which is the current repo invariant that keeps render suites stable

Current non-green suite in this area:

- `verifySurface.hints-bridge.test.tsx` fails because `ide-verify-hint-callout` is rendered only when the analysis drawer is open, while the test expects it immediately

Do not treat that suite as evidence that the React render harness is broken.

---

## Green Baseline (as of 2026-03-25)

All pure-logic suites passing:

| Suite | Tests |
|---|---|
| `export-authority-chain-contract` | 49 PASS |
| `signal-inventory-contract` | 18 PASS |
| `invalidation-contract` | 10 PASS |
| `buildVerifySessionViewModel` | 5 PASS |
| `projectRuntime.verify-authority` | 15 PASS |
| `verifyHints` | 16 PASS |
| `verifyScenario` | 30 PASS |
| `diagnostics.contract` | 4 PASS |
| `basys3-port-lint` | 2 PASS |
| `basys3-port-naming-phase1` | 10 PASS |
| `audit-determinism` | 1 PASS |
| `verifyContract.reset` | 8 PASS |
| **Total** | **168 PASS** |

---

## Render Baseline (audit slice on 2026-03-25)

These VerifySurface render suites passed under the current harness:

| Suite | Tests |
|---|---|
| `verifySurface-fail-state` | 3 PASS |
| `verifySurface.failure-context` | 2 PASS |
| `verifySurface.authoring` | 11 PASS |
| `verifySurface.three-panel` | 3 PASS |
| `verifySurface.workstation` | 23 PASS |
| **Total** | **42 PASS** |

**Render baseline as of 2026-03-26 (final):** 52 PASS across 9 suites. All suites green.

| Suite | Tests | Notes |
|---|---|---|
| `verifySurface-fail-state` | 3 PASS | |
| `verifySurface.failure-context` | 2 PASS | |
| `verifySurface.authoring` | 11 PASS | |
| `verifySurface.three-panel` | 3 PASS | |
| `verifySurface.workstation` | 23 PASS | |
| `verifySurface.failure-patterns` | 5 PASS | Fixed: drawer open added to `renderVerify` helper |
| `verifySurface.waveform-priority` | 1 PASS | Fixed: expanded Inputs group in test; `laneGroupPriority` out-before-in in production |
| `verifySurface.hints-bridge` | 3 PASS | Resolved as side effect of UX polish Pass A |
| `verifySurface.combo-kmap-provenance` | 1 PASS | Narrowed to kmap-cell-only (see ADR-002); combo rows require TruthTablePane unit test |

**`combo-kmap-provenance` — resolved (2026-03-26)**

The original test mixed two concerns:

1. K-map cells correctly identify failing combos in the K-Map tab → **kept and fixed**
2. Clicking a combo row routes to `ide-verify-explainer-*` in mismatches → **removed per ADR-002**

The combo rows section (`ide-truth-table-combo-fail-*`) requires `displaySection="auto"` which VerifySurface never passes. Combo row contract is tested at the `TruthTablePane` unit level.

ADR-002 records that Option A (stable tab context) was chosen and Option B (auto-switch on selection) was rejected.

---

## TypeScript Check

```bash
pnpm exec tsc --noEmit --skipLibCheck
```

Output should be empty (pre-existing `node_modules` / `vite/client` fragments are noise, not errors from project source).

---

## Test Fixture Rules

1. Connection fixtures must use `{ from: { nodeId, portName }, to: { nodeId, portName } }` - see [[Connection Model]]
2. Hint tests must explicitly set flags that might trigger higher-priority conditions - see [[Verify Hint System]]
3. VerifyRun fixtures must include `scenarioId`, `scenarioName`, `meta`, `report`, `waveform`

---

## Related

- [[BUG-003 React.act Infrastructure Failure]]
- [[BUG-001 Connection Fixture Format Mismatch]]
- [[BUG-002 VerifyHints Priority Inconsistency]]
- [[Export Contracts]]
