---
name: gate-runner
description: Run verification gates and analyze failures. Use when gates are failing or before committing to verify all gates pass.
disable-model-invocation: true
---

# Gate Runner

Run the full gate suite or a specific named gate, then parse and summarize failures.

## Usage

`/gate-runner` — run all gates
`/gate-runner <gate-name>` — run a specific gate (e.g. `/gate-runner ide:gate:export-rebuild`)

## Steps

1. If a specific gate name was provided, run `pnpm run <gate-name> 2>&1`
   Otherwise run `pnpm verify:gates 2>&1`

2. Parse the output for FAIL / ERROR lines. Capture:
   - The gate name
   - The specific assertion that failed
   - The file path and line number if shown

3. Cross-reference each failure with its source file:
   - Gate test files live in `packages/rb-apps/src/__tests__/` and `packages/*/src/__tests__/`
   - Match gate name patterns: `os:*` → ErrorBoundary / OS-level, `ide:gate:export-*` → ExportSurface, `ide:gate:import-*` → ImportSurface, etc.

4. Check known pre-existing failures — do NOT flag these as new issues:
   - `error-boundary-gate.test.tsx` (wrong button labels)
   - `basys3-bundle-gate.test.ts` (missing rb-icons mock)

5. For each NEW failure produce:
   - Gate name + test assertion
   - Likely source file with line reference
   - One-sentence proposed fix

6. Output a summary table:
   | Gate | Status | File | Fix |
   |------|--------|------|-----|
   | ...  | FAIL   | ...  | ... |

If all gates pass (or only known pre-existing failures remain), say: "All gates pass. Pre-existing failures noted but not blocking."
