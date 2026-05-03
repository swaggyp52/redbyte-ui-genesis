---
type: architecture
status: active
area: infrastructure
updated: 2026-05-02
related:
  - "[[BUG-003 React.act Infrastructure Failure]]"
  - "[[BUG-018 Lab Hardware Strict Readiness Blocked by Missing djtgcfg]]"
  - "[[BUG-001 Connection Fixture Format Mismatch]]"
  - "[[BUG-002 VerifyHints Priority Inconsistency]]"
  - "[[Connection Model]]"
  - "[[Verify Hint System]]"
---

# Test Infrastructure

**Runner:** Vitest 2.1.8
**Config:** `vitest.config.ts` (root)
**Status:** Pure-logic tests are green. React component render tests are usable under the current React 19 harness, but the full IDE suite still carries a pre-existing BUG-003-family baseline tracked in `AI_STATE.md`.

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

## Workspace CLI Prerequisites

Windows-side repo and classroom scripts rely on normal shell resolution, not just whatever can be reached through ad-hoc package-manager fallbacks.

- `pnpm` must resolve as a normal command from PowerShell. `corepack pnpm ...` is not enough for scripts that shell out to `pnpm` directly.
- root package scripts that call `pnpm exec tsx ...` require `tsx` in the root workspace `devDependencies`; child-workspace copies do not satisfy root execution.
- Windows lab-machine validation that touches Vivado or classroom hardware flow also assumes `python` / `py` and `vivado` resolve from the shell.
- `classroom:hw:check -- --strict` is only green when the bridge returns a `basys3` target. A Digilent-class FTDI device with missing `djtgcfg` remains `NOT_READY` even if serial drivers are installed.

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

[[BUG-003 React.act Infrastructure Failure]] is now a closed audit note, not the live failure shape. The current repo still uses "BUG-003 family" as shorthand for the pre-existing full-suite render-family baseline recorded in `AI_STATE.md`.

What the 2026-03-25 audit confirmed:

- `verifySurface-fail-state.test.tsx` passes
- `verifySurface.failure-context.test.tsx` passes
- `verifySurface.authoring.test.tsx` passes
- `verifySurface.three-panel.test.tsx` passes
- `verifySurface.workstation.test.tsx` passes

Important harness facts:

- installed versions are `react@19.2.1`, `react-dom@19.2.1`, and `@testing-library/react@16.3.2`
- the installed `@testing-library/react/dist/act-compat.js` already prefers `React.act` when present
- `vitest.config.ts` aliases React and ReactDOM to a single instance, which is the current repo invariant that keeps render suites stable

Do not treat the active full-suite BUG-003-family baseline as evidence that the React render harness has regressed back to the old `React.act` crash.

## Browser proof and screenshot coverage status (2026-05-02)

- The board-clock browser proof gate is real and current: `tests/e2e/board-clock-browser-proof.spec.ts` proves auto board clock, manual override, and exported `clock_gen` evidence.
- IDE screenshot baselines also exist in `tests/e2e/ide-screenshot-baseline.spec.ts`, but they are optional by default. They are skipped unless `SCREENSHOT_STRICT=1` and `CI_FAST` is unset.
- That means RedByte has screenshot tooling, but not yet a trustworthy mandatory screenshot safety net for broad CSS pruning or the next Hardware / Export density pass.
- Current product-debt owner for that gap is `docs/IDE_PRODUCT_DEBT_REGISTER.md`.

## Canonical build-validation caveat

- `pnpm -s build:unified` is still the canonical root build path, but current 2026-05-02 validation notes show a Windows `dist/` lock failure mode after build + merge succeed.
- Treat that as an environment/process blocker, not immediate proof of a product compile regression in the touched slice.
- When this caveat changes, update `AI_STATE.md`, `docs/ACTIVE_WORK.md`, and the product debt register together.

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

## Render Baseline (historical audit slices)

These VerifySurface render suites passed under the current harness:

| Suite | Tests |
|---|---|
| `verifySurface-fail-state` | 3 PASS |
| `verifySurface.failure-context` | 2 PASS |
| `verifySurface.authoring` | 11 PASS |
| `verifySurface.three-panel` | 3 PASS |
| `verifySurface.workstation` | 23 PASS |
| **Total** | **42 PASS** |

**Historical render baseline as of 2026-03-26 (final):** 52 PASS across 9 suites. All suites green in that slice.

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

Current live full-suite counts belong in `AI_STATE.md`, not this note.

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
