# Counter Verification Semantics Sprint

Date: 2026-05-11

## Preflight

| Item | Result |
| --- | --- |
| Branch | `product/counter-verification-semantics-1` |
| Base commit | `81ad74cda13cece1753f6179779f3cbace502387` |
| Parent branch | `product/verify-hardware-map-pins-hardening-1` |
| Scope | Fix or honestly bound 2-Bit Up Counter Verify Compare semantics |
| Out of scope | Repo cleanup, MarcusRPI, install scripts, manuals, import/export round trip, main merge, Vivado automation |
| Known failing gate | Full `pnpm typecheck` still fails in pre-existing `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift |

Baseline commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile current; pnpm 10.24.0 |
| `pnpm start:smoke` | PASS | Launcher served `http://127.0.0.1:5197/` with HTTP 200 |
| `pnpm -s ide:gate:ece141-starter-verify-export` | PASS | Existing Logic Gates Verify -> Export gate passed |
| `pnpm -s ide:gate:ece141-product-immersion` | PASS | Existing product immersion gate passed |
| `pnpm -s ide:gate:ece141-counter-clock-export` | PASS | Counter clock/export wording gate passed |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | PASS | Manual Map Pins recovery gate passed |
| `pnpm typecheck` | FAIL | Same known `@redbyte/rb-lab-engine` / `rb-logic-core` drift; not introduced here |

Known passing product gates at sprint start:

- `pnpm -s ide:gate:ece141-starter-verify-export`
- `pnpm -s ide:gate:ece141-product-immersion`
- `pnpm -s ide:gate:ece141-counter-clock-export`
- `pnpm -s ide:gate:ece141-map-pins-recovery`

## Counter Failure Reproduction

Browser tool: Playwright Chromium against local Vite dev server at `http://127.0.0.1:4173`.

Local ignored artifacts:

- `.redbyte/product-immersion/sprint3-counter-semantics/counter-browser-reproduction.json`
- `.redbyte/product-immersion/sprint3-counter-semantics/counter-project-before-load.png`
- `.redbyte/product-immersion/sprint3-counter-semantics/counter-design.png`
- `.redbyte/product-immersion/sprint3-counter-semantics/counter-verify-before-run.png`
- `.redbyte/product-immersion/sprint3-counter-semantics/counter-verify-after-run.png`
- `.redbyte/product-immersion/sprint3-counter-semantics/counter-hardware.png`
- `.redbyte/product-immersion/sprint3-counter-semantics/counter-export-after-failed-compare.png`

| Step | Expected | Actual | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Load starter | 2-Bit Up Counter loads into Design | Starter loaded | `counter-design.png` | Circuit visible enough for workflow |
| Open Verify | Clock/reset policy visible | Clock panel visible; says `CLK100MHZ`, `W5`, auto board clock | `counter-verify-before-run.png` | Reset summary said `no reset detected`, even though starter has BTNC reset row |
| Run Compare | Starter goal says all vectors pass on clocked-macro schedule | Compare failed; UI reported `6 mismatches`, first mismatch `LD0 t2 expected 1 got 0` | `counter-verify-after-run.png`, JSON text capture | Product trust issue because starter copy claims Compare-certified behavior |
| Inspect Hardware | Clock/reset mapping rows visible | `CLK100MHZ` clock row and `RST` reset row visible | `counter-hardware.png` | Hardware mapping is clearer than Verify reset summary |
| Inspect Export | Export should not overclaim after failed Compare | Export stayed draft: latest comparison differs; E0/E1/E2/E3 rows stayed distinct | `counter-export-after-failed-compare.png` | Export behavior is honest after the failure |
| Console | No severe product console error | No page errors; only Vite/React dev info | reproduction JSON | Failure is semantic, not browser crash |

Additional deterministic engine probe before changes:

| Observation | Evidence |
| --- | --- |
| `materializeVectorsForClockPolicy` produced both canonical row-id defaults (`en`, `rst`, `clk`) and starter node-id inputs (`en_node`, `rst_node`, `clk_node`). | Temporary probe output from `packages/rb-apps/src/apps/ide/__tests__/counterSemantics.probe.test.ts` |
| Input binding precedence reads row id before node id, so default `en: 0` wins over starter `en_node: 1`. | `buildLookupKeys` order in `simEngineCore.ts`: row id, label, node id, model canonical name, source node id |
| `executeClockedMacroVectorCase` ticks once per vector with the current clock level instead of applying the documented `[0,1,0]` macro per vector. | `packages/rb-apps/src/apps/ide/sim/simEngineCore.ts` |

## Intended Counter Semantics

Source of truth: `packages/rb-apps/src/apps/ide/examplesCatalog.ts`, starter `id: two-bit-counter`.

| Question | Finding |
| --- | --- |
| Inputs | `CLK100MHZ` board clock, `SW0` enable, `BTNC` reset |
| Outputs | `LD0` (`q0_out`) and `LD1` (`q1_out`) |
| Reset | Active-high reset is implemented in the starter circuit by gating the D inputs with `NOT(RST)`, not by wiring DFlipFlop `RST` ports |
| Enable | `SW0` enables counting; when low, the current count holds |
| Clock source | Basys3 100 MHz oscillator on `CLK100MHZ / W5` |
| Edge | Rising edge |
| Intended initial state | `00`, established by initial zero state and the first reset/high vector |
| Expected sequence | `00`, `00`, `01`, `10`, `11`, `00`, `00` for ticks 0 through 6 |
| Sampling | Expected values are post-rising-edge samples for each authored vector case |
| UI alignment before fix | Project/starter copy says Compare should pass, Verify says auto board clock, Hardware shows clock/reset rows, but Verify reset summary misses BTNC and Compare fails |
| Export alignment before fix | Export does not claim trusted handoff when Compare fails; it remains draft/E0-only |

The intended Compare behavior is therefore a per-vector `clocked_macro` run: drive non-clock inputs, apply `CLK=0`, tick, apply `CLK=1`, tick, apply `CLK=0`, tick, then sample outputs against the expected row for that vector.

## Root Cause Analysis

| Cause | Evidence for | Evidence against | Files implicated | Risk if fixed | Risk if deferred |
| --- | --- | --- | --- | --- | --- |
| A. Starter circuit bug | None observed; circuit implements Q0 next-state and Q1 carry logic using DFlipFlops, XOR, AND, NOT reset gating | The intended sequence is coherent and source comments match standard 2-bit counter logic | `examplesCatalog.ts` | Low if left unchanged | None |
| B. Starter scenario/vector bug | Vectors use node-id keys (`en_node`, `rst_node`, `q0_out`, `q1_out`) while auto materialization adds row-id defaults | Node-id vectors are valid elsewhere in the app and should resolve through IO aliases | `examplesCatalog.ts`, `verifyClockPolicy.ts`, `simEngineCore.ts` | Medium; changing starter vectors alone would hide the broader alias conflict | High: future starters can silently drive default row-id values instead of authored node-id values |
| C. Verify Compare timing bug | App engine currently ticks once per clocked vector; documented contract is `[0,1,0]` macro and post-rising-edge sample | The UI and docs already describe clocked-macro semantics, so the one-tick behavior is the outlier | `simEngineCore.ts`, `rb-utils/src/labProjectSchema.ts`, `rb-lab-engine/src/verification/verifyTruthTable.ts` | Medium; change must preserve combinational Compare and manual clock boundaries | High: sequential Compare remains untrustworthy |
| D. Sequential simulator bug | Not primary. DFlipFlop rising-edge behavior is coherent when clock and inputs are driven correctly | The failure appears before the circuit can receive `EN=1` because alias defaults override the input | `rb-logic-core/src/builtins.ts` | High if changed broadly | Not needed for this failure |
| E. UI state/rerun bug | Browser rerun consistently reproduces failure | Direct engine probe reproduces the semantic mismatch outside the UI | Verify UI | Low | Not root cause |
| F. Clock/reset policy mismatch | Verify policy misses BTNC reset because reset is D-gating, not a direct DFlipFlop reset binding; clock materialization alternates per vector | Hardware mapping already has `timingRole: reset`, so a local policy fallback can be used | `verifyClockPolicy.ts` | Low if limited to timingRole reset fallback | Medium: students see `no reset detected` while Hardware shows reset |
| G. Stale verification evidence bug | Export correctly stays draft after failed Compare | No stale pass observed | Export/Verify | Low | Not root cause |
| H. Counter should not be Compare-certified yet | Would be honest if the fix required broad engine work | The needed fixes are local and testable: alias-safe vector materialization plus per-vector clocked macro execution | Verify runtime | Low if tests prove it | High: demotion would shrink course path unnecessarily |
| I. Test/gate artifact | Existing gates did not assert counter Compare pass | Browser and direct engine show real product failure | E2E gates | Low | High: issue remains invisible |

Root cause classification: **B + C + F**.

- B: auto board-clock vector materialization introduces row-id default aliases that can override authored node-id inputs.
- C: the deterministic Verify execution path does not currently implement the documented `clocked_macro` `[0,1,0]` per vector.
- F: Verify reset policy ignores the starter's explicit `timingRole: reset` row, so the UI says reset is not detected even though the starter has a BTNC reset lane.

## Chosen Outcome

Outcome 1: make the counter Compare-certified.

Reason:

- The starter circuit and expected sequence are coherent.
- The UI already presents the counter as part of the course path.
- The fix can be local to Verify vector materialization, clocked-macro execution, reset policy fallback, and regression gates.
- Export already handles failed Compare honestly, so no E0/E1/E2/E3 semantic change is needed.

## Fix Selection

| Issue | Severity | Why it matters for ECE141 | Why safe now | Files likely touched | Test / gate |
| --- | --- | --- | --- | --- | --- |
| `clocked_macro` executes one clock level per vector instead of `[0,1,0]` | P1 | Sequential starter Compare cannot be trusted | Local deterministic Verify execution fix; aligns with existing schema and lab-engine truth-table implementation | `simEngineCore.ts` | Counter semantics unit test + Playwright gate |
| Auto materialization leaves conflicting row-id/node-id input aliases | P1 | Starter vectors can silently drive the wrong input value | Local canonicalization inside materialization; preserves row aliases for outputs | `verifyClockPolicy.ts` | Verify clock policy unit test |
| Verify reset summary says no reset detected for BTNC row | P2 | Beginner cannot reconcile Verify with Hardware reset row | Local fallback from `timingRole: reset`/reset-like row when structural reset hint is absent | `verifyClockPolicy.ts` | Counter clock/export gate assertion |
| No browser gate proves counter Compare pass | P1 | Existing gates allowed the starter to stay falsely promoted | Add one focused ECE141 gate; no Vivado/hardware dependency | `tests/e2e/ece141-counter-compare-pass.spec.ts`, `package.json` | `pnpm -s ide:gate:ece141-counter-compare-pass` |

## Implemented Fixes

| Fix | Files | Product effect | Evidence |
| --- | --- | --- | --- |
| Execute the documented clocked-macro schedule per vector | `packages/rb-apps/src/apps/ide/sim/simEngineCore.ts` | Sequential Verify now drives `CLK=0,1,0` for each clocked vector and samples after the macro instead of treating authored rows as alternating clock levels. | `counterVerificationSemantics.test.ts`, `pnpm -s ide:gate:ece141-counter-compare-pass` |
| Canonicalize auto-board-clock vector inputs by IO row | `packages/rb-apps/src/apps/ide/verifyClockPolicy.ts` | Starter vectors authored with node-id keys no longer get overridden by row-id defaults such as `en: 0` over `en_node: 1`. | `verifyClockPolicy.test.ts` |
| Use explicit reset-role IO rows as reset-policy fallback | `packages/rb-apps/src/apps/ide/verifyClockPolicy.ts` | The counter Verify policy now recognizes the `BTNC` reset row even though reset is implemented by D-input gating instead of a direct DFlipFlop reset port. | `verifyClockPolicy.test.ts`, `pnpm -s ide:gate:ece141-counter-clock-export` |
| Add counter Compare browser gate | `tests/e2e/ece141-counter-compare-pass.spec.ts`, `package.json` | Browser workflow proves the 2-Bit Up Counter loads, Verify Compare passes `14/14`, Hardware shows clock/reset mapping, and Export stays E0-only. | `pnpm -s ide:gate:ece141-counter-compare-pass` |

## Added Gates and Tests

| Name | Command | RED result | GREEN result |
| --- | --- | --- | --- |
| Counter semantics unit test | `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/counterVerificationSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts` | Failed on reset policy and counter rows before the fix. | Passed: 7 tests across 2 files. |
| ECE141 counter Compare pass gate | `pnpm -s ide:gate:ece141-counter-compare-pass` | Failed waiting for `ide-verify-pass-hero`; Compare stayed failed. | Passed: 1 Playwright test. |

## Product Outcome

The 2-Bit Up Counter remains in the primary ECE141 path as Compare-certified for RedByte browser Verify evidence. This proves RedByte Compare behavior only. It does not claim Vivado build evidence (E1), board programming evidence (E2), or observed board behavior (E3).

## Validation

Validation rows are recorded in `docs/release/course-edition/08-validation-log.md`.
