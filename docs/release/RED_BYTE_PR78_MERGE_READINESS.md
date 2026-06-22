# RedByte PR78 Merge Readiness

Date: 2026-06-22
Branch: `product/redbyte-trust-reset-v2`
PR: #78, draft
Starting head: `26de52957cf97400175f1d8cfc0ff0b4a9391e4e`

## Decision

PR #78 is stronger after Phase 3G, but it should remain draft until final branch review and live GitHub checks are complete for the closing commit.

Phase 3G does not merge the PR, mark it ready for review, or claim Vivado/Basys3 E1-E3 proof.

## PR Scope Summary

PR #78 is the Product Trust Reset v2 branch. It separates normal student chrome from diagnostics, introduces V2 workspace primitives, rebuilds Verify authority around Course checks and My checks, adds project durability and diagnostics proof, and now resets classroom gate authority so local broad proof and required classroom proof agree on current V2 product truth.

## Architecture Decisions

- Normal student UI remains plain: raw build hashes and proof-tier vocabulary belong behind diagnostics or release docs, not default chrome.
- Verify trust comes from `verifyTruthState.ts` and `verifyTruthAdapter.ts`, not surface-local PASS/FAIL derivations.
- `classroom:gate` is the required lightweight classroom truth gate.
- `verify:gates:classroom` is the broader local/nightly classroom sweep and now runs current gates from the same manifest plus focused breadth.
- `verify:gates:legacy` is diagnostic-only and lists retired V1 checks with replacements; it is not a merge requirement.
- Hardcoded `localhost:5173` default gate assumptions are not allowed in current default classroom gates.

## Contracts Changed

- Gate ownership is now manifest-backed in `scripts/gates/gate-manifest.mjs`.
- `classroom:gate` and `verify:gates:classroom` load from the manifest instead of parallel hand-maintained lists.
- Stale V1 structural gates are retired only with documented V2 replacements.
- Lab 4 smoke/rehearsal determinism now awaits SHA hashing correctly.

## Runtime Behavior Changed

No product runtime behavior is intentionally changed by Phase 3G. This is a test authority, gate runner, evidence, and documentation slice.

## Runtime Behavior Intentionally Unchanged

Phase 3G intentionally leaves these unchanged:

- simulation truth
- Compare semantics
- expected-output meaning
- pin mapping truth
- VHDL/XDC/testbench/Tcl/ZIP generation bytes
- project format
- import parser/apply behavior
- export goldens
- SaaS/accounts
- Vivado/Basys3 E1-E3 proof status

## Project Schema Impact

No project schema change.

## Test And Gate Status

Baseline before the fix:

- `corepack pnpm -s verify:gates:classroom` failed at head `26de52957cf97400175f1d8cfc0ff0b4a9391e4e`.
- Evidence: `.redbyte/proof/gate-reset/phase-3g/before/verify-gates-classroom-red-baseline.log`.
- Failure classes:
  - A: real gate bug, Lab 4 deterministic smoke compared unresolved SHA promises.
  - B: Lab 8 old smoke treated unconnected bridge scaffold placeholders as a solved starter.
  - C: stale V1 structural/UI assumptions around old rails, docks, generic CTAs, and retired workbench markers.
  - D: hardcoded `localhost:5173` route/default-launcher gates.

Current Phase 3G proof:

- `corepack pnpm -s gate:manifest:validate` passed.
- `corepack pnpm -s gate:no-hardcoded-redbyte-test-ports` passed.
- `corepack pnpm -s verify:gates:legacy` generated a diagnostic-only retired-gate manifest.
- `corepack pnpm -s classroom:smoke:lab4` passed with deterministic ZIP SHA `4137e33099344b89f8a8dea58e0416a8f316d628740f118d26ca20315f9b2c50`.
- `corepack pnpm -s classroom:rehearse:lab4` passed.
- `corepack pnpm -s lab:profile-contract` passed.
- `corepack pnpm -s ci:no-solution:lab8` passed.
- `corepack pnpm -s rc:e1:golden-basys3-export-gate` passed.
- `corepack pnpm -s rc:e1:golden-basys3-alu-export-gate` passed.
- `corepack pnpm -s classroom:gate` passed `76/76`.
- `corepack pnpm -s verify:gates:classroom` passed `95/95`.

Proof summaries are under `.redbyte/proof/gate-reset/phase-3g/after/`.

## Rehearsal Status

Phase 3F 30-context browser rehearsal evidence remains the current endurance proof for this branch:

- `rehearsal:classroom-30`: `30/30`
- `rehearsal:classroom-verify`: `30/30`
- `rehearsal:classroom-recovery`: `30/30`

Phase 3G re-ran and refreshed those three evidence files after the gate reset. It does not broaden the rehearsal scenarios.

## Accessibility Status

Phase 3F focused accessibility gates remain required in both current classroom suites:

- `ide:gate:verify-accessibility-v2`
- `ide:gate:verify-keyboard-grid-v2`
- `ide:gate:verify-zoom-contrast-v2`

They passed inside both Phase 3G aggregate suites. Human assistive-technology review is still a remaining release-readiness task.

## Remaining V1 Debt

The legacy diagnostics manifest records the retired V1 gates and replacements. The remaining debt is not to make V2 look like the old gates; it is to remove or rewrite old source/tests/docs only when current V2 product contracts and browser proof make the replacement clear.

Known remaining debt:

- old V1 structural gate scripts still exist as diagnostic entry points but are not current default merge requirements
- CSS/source still contains historical selectors and compatibility paths
- broader Project/Design/Map Pins/Export/Import V2 review remains incomplete compared with the depth given to Verify
- storage facade/journal/quota-risk UX remains future work
- human assistive-technology review remains future work

## Known Failures

No current Phase 3G default classroom gate failure is known after the manifest reset.

The retired gates may still fail if run directly. That is expected unless a future task explicitly modernizes them. `verify:gates:legacy` exists to document that status instead of silently treating retired V1 structure as current release truth.

## Merge Blockers

- PR #78 is still draft.
- Final push and GitHub checks must be green for the closing commit.
- Human review still needs to accept the branch-level diff and remaining V2 scope.
- No Vivado/Basys3 E1-E3 proof has been run.

## Post-Merge Verification Plan

Before any non-draft merge decision:

1. Re-run `gate:manifest:validate`.
2. Re-run `gate:no-hardcoded-redbyte-test-ports`.
3. Re-run `classroom:gate`.
4. Re-run `verify:gates:classroom`.
5. Re-run the three Phase 3F rehearsals if the merge window requires fresh endurance proof.
6. Re-run `build:unified`, `rb:doc:validate`, `rb:encoding:check`, and `git diff --check`.
7. Watch GitHub Classroom Truth Gates, Cloudflare Pages, and deploy checks green.
8. Keep Vivado/Basys3 claims out of the release unless E1-E3 proof is run on the proper machine.

## Rollback Plan

If Phase 3G gate authority causes CI or review problems, revert the Phase 3G commit only. That restores the previous gate aggregator behavior without reverting the Product Trust Reset v2 runtime work from Phases 1-3F. Do not revert Verify truth/model changes as part of a gate-manifest rollback unless a separate runtime defect is proven.
