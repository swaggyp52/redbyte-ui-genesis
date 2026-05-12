# Full Workspace Typecheck Drift Cleanup

**Date:** 2026-05-12
**Branch:** `release/typecheck-drift-cleanup-1`
**Attribution:** Connor Angiel

## Goal

Make full workspace `pnpm typecheck` pass without weakening TypeScript, deleting tests, broad exclusions, or changing RedByte product behavior.

## Preflight

| Item | Result |
|---|---|
| Base branch | `main` |
| Starting `main` commit | `e98bae578c422006fffefbe530fc3edad052808b` |
| Cleanup branch | `release/typecheck-drift-cleanup-1` |
| Known failing area | `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift |

## Typecheck Failure Inventory

| Package | File | Error code | Error summary | Root cause hypothesis | Course impact | Fix candidate |
|---|---|---|---|---|---|---|
| `@redbyte/rb-lab-engine` | `src/__tests__/boardMapping.test.ts` | TS2741, TS2739, TS2353, TS2345 | Test fixture uses pre-V1 project fields, old evidence shape, and non-literal action envelope. | Stale fixture drift against canonical `@redbyte/rb-utils` `LabProjectV1`. | Development-only, but blocks release gate. | Update fixture and action to canonical schema. |
| `@redbyte/rb-lab-engine` | `src/adapters/projectAdapters.ts` | TS2322 | `labId` can be undefined when adapting optional `labSpec`. | Real strictness bug in adapter boundary. | Development-only app model; not current ECE141 IDE runtime path, but should typecheck. | Derive stable fallback from `labSpec.labId`, `labSpec.id`, or `project.projectId`. |
| `@redbyte/rb-lab-engine` | `src/reducer/labReducer.ts` | TS2322, TS2307 | Virtual board I/O partial updates can omit switches/buttons; evidence type imported through a deep missing path. | Real type-boundary drift and stale deep import. | Development-only reducer path; keep deterministic semantics. | Preserve existing/default arrays and import `EvidenceSnapshot` from `@redbyte/rb-utils`. |
| `@redbyte/rb-lab-engine` | `src/services/**/__tests__/*.ts` | TS2307, TS2353, TS2339, TS2322 | Tests import missing `../schema/index.js`, use legacy connection `{ from, to }`, old action/evidence fields, and `simulation.isRunning`. | Stale test fixture/schema drift. | Development-only, but release gate blocker. | Update imports/fixtures to canonical `@redbyte/rb-utils` schema or add narrow package-local schema barrel if still needed. |
| `@redbyte/rb-lab-engine` | `src/services/schemaMigration.ts` | TS2352 | Readonly supported-version tuple cast to mutable `unknown[]`. | Strict tuple typing issue. | Development-only migration helper. | Use readonly-compatible membership check. |
| `@redbyte/rb-lab-engine` | `src/stores/labEngineStore.ts` | TS2345 | `LabSpecV1.checkpoints` is broad `CheckpointDefinition[]`, but verifier expects concrete `Checkpoint`. | Schema narrowing issue at store boundary. | Development-only store; should fail clearly on malformed checkpoint. | Add explicit checkpoint guard or narrow dispatch safely. |
| `@redbyte/rb-lab-engine` | `src/verification/verifyBoardIO.ts`, `verifyCustom.ts` | TS2365, TS18048 | Unknown checkpoint `spec` values are used as numbers/strings without narrowing. | Real strictness bug. | Development-only verification helpers. | Add explicit number/string narrowing and safe fallback. |
| Pulled `@redbyte/rb-logic-core` source | `analysis/componentSupportRegistry.ts` | TS2339 | `satisfies` preserved a narrow object-union, so optional fields are not available on every literal entry during iteration. | Source type-widening issue exposed by package source pull. | Shared logic-core source; relevant to import/export support truth. | Widen registry to `readonly ComponentSupportEntry[]`. |
| Pulled `@redbyte/rb-logic-core` source | `convertCircuitV1.ts`, `serialization.ts`, `validateEvidenceAgainstLabSpec.ts` | TS2322, TS18048, TS2339 | Optional connection IDs, optional positions, and evidence example ID path drift. | Real strictness/schema drift. | Shared conversion/evidence utilities; course-adjacent. | Provide deterministic connection IDs, narrow positions, and read example ID from evidence context. |
| Pulled `@redbyte/rb-logic-core` source | `index.ts`, `ir/simulationModel.ts` | TS2308, TS2769, TS2677 | Duplicate type star export and array filtering that leaves null in inferred entries. | Source export/type predicate issue. | Shared package boundary. | Replace ambiguous star export or explicit exports; build reset entries with a typed array. |

## Course Relevance Classification

| Area | Classification | Reason |
|---|---|---|
| `rb-lab-engine` adapter/reducer/store/verification source | B. Development-only but should typecheck | Not the active Project/Design/Verify/Hardware/Export/Import runtime path, but it remains a workspace package and release gate participant. |
| `rb-lab-engine` service tests | B/D. Development-only plus stale fixture drift | These tests protect import/export/evidence helpers, but several fixtures predate the canonical `LabProjectV1` action/evidence shapes. |
| `rb-logic-core` converter/registry/IR/evidence source | A/E. Required shared source pulled across package boundary | Logic-core feeds RedByte circuit conversion, simulation/IR, import reconstruction, and evidence validation; package-local typecheck must not surface source errors. |
| Full workspace `pnpm typecheck` | A. Release credibility gate | Professors/course handoff should see a green full typecheck gate. |

Answers:

- Used by Project/Design/Verify/Hardware/Export/Import: `rb-logic-core` is used; `rb-lab-engine` is mostly legacy/development-side but still present in workspace.
- Used by Vivado export: `rb-logic-core` conversion/support truth is course-adjacent; `rb-lab-engine` evidence capsule helpers are not the current E0 Vivado export path.
- Used by lab evidence/professor review: `rb-lab-engine` evidence helpers are intended for that boundary and should typecheck.
- Intended to ship: both packages remain workspace packages; do not remove or silently exclude them.
- Should remain in full typecheck: yes, unless a later explicit release decision removes or quarantines a package.

## Root Cause

Primary root causes:

- Stale generated/test fixtures from an older lab-project schema.
- Stale deep schema import path in `rb-lab-engine`.
- Package-boundary source pull from `rb-lab-engine` into `rb-logic-core` exposes strict-mode source errors in `rb-logic-core`.
- Real strictness bugs where unknown optional values are used without narrowing.
- Action envelope drift between old `{ type, details }` / direct action objects and canonical `{ timestamp, sessionId, action }` envelopes.

## Fix Selection

| Issue | Severity | Why it matters | Fix | Files | Gate/test |
|---|---|---|---|---|---|
| `rb-logic-core` source-pulled strict errors | P1 | Blocks `rb-lab-engine` and full workspace typecheck before tests can be fully assessed. | Fix source types without changing runtime behavior. | `packages/rb-logic-core/src/**` | `pnpm --filter @redbyte/rb-lab-engine typecheck`, full `pnpm typecheck`, focused rb-logic-core Vitest tests. |
| `rb-lab-engine` source strict errors | P1 | Real package source does not typecheck. | Add narrow fallbacks/import fixes/type guards. | `packages/rb-lab-engine/src/adapters`, `src/reducer`, `src/stores`, `src/verification`, `src/services`. | `pnpm --filter @redbyte/rb-lab-engine typecheck`. |
| Stale `rb-lab-engine` tests | P1 | Full workspace typecheck includes tests and remains red. | Update fixtures to canonical schema; avoid suppressions. | `packages/rb-lab-engine/src/**/__tests__`. | Isolated package typecheck and relevant Vitest tests. |

## Fixes Implemented

- Updated `rb-logic-core` type boundaries without changing runtime semantics:
  - widened component-support registry entries,
  - made Circuit V1 conversion generate deterministic fallback connection IDs,
  - narrowed optional node positions during serialization,
  - replaced ambiguous type-star exports with explicit public type exports,
  - built reset binding entries through a typed array,
  - restored evidence example matching through `context.selectedExampleId` while preserving legacy `exampleId` compatibility.
- Updated `rb-lab-engine` source strictness:
  - added `labId` fallbacks in project adapters,
  - preserved virtual I/O switch/button arrays during reducer updates,
  - replaced stale deep imports with `@redbyte/rb-utils`,
  - added checkpoint and optional-spec narrowing in store/verifier paths,
  - added a package-local schema type barrel for tests that still import schema aliases.
- Updated stale `rb-lab-engine` fixtures to the canonical `LabProjectV1`, `CircuitConnection`, `LabActionEnvelope`, `EvidenceSnapshot`, and `ProbeDefinition` shapes.

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `pnpm --filter @redbyte/rb-lab-engine typecheck` | Passed | Package-local compiler gate is green. |
| `pnpm typecheck` | Passed | Full workspace typecheck is green after `rb-board-profiles`, `rb-viewport`, `rb-fpga-toolchain`, and `rb-lab-engine` complete. |
| Focused Vitest suite | Passed | 13 files passed, 163 tests passed, 1 skipped across touched `rb-lab-engine` and `rb-logic-core` areas. |
| `pnpm install --frozen-lockfile` | Passed | Lockfile already up to date. |
| `pnpm start:smoke` | Passed | Served `http://127.0.0.1:5197/` with HTTP 200. |
| Full ECE141 browser gate stack | Passed | Starter Verify/Export, product immersion, counter clock/export, map-pins recovery, counter compare, project persistence, import/export recovery, Vivado artifacts, UI art-direction, and UI hierarchy gates all passed sequentially. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | 8 tests passed. |
| `pnpm rb:doc:validate` | Passed before closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed before closeout docs | No mojibake markers found. |
| `git diff --check` | Passed before closeout docs | No whitespace errors. |
| `pnpm rb:doc:validate` | Passed after closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed after closeout docs | No mojibake markers found. |
| `git diff --check` | Passed after closeout docs | No whitespace errors. |

## Closeout

Full workspace `pnpm typecheck` is no longer a red release gate. No UI polish, install scripts, manuals, MarcusRPI work, `build:unified` redirect work, Vivado artifact behavior, or E0/E1/E2/E3 evidence semantics were changed.

Remaining known release-process blocker:

- `pnpm build:unified` `/os/` redirect drift remains the next recommended sprint.
