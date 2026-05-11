# Verify, Hardware, and Export Trust Hardening Sprint 2

Date: 2026-05-11

## Preflight

| Item | Result |
| --- | --- |
| Branch | `product/verify-hardware-map-pins-hardening-1` |
| Base commit | `bb52211886bb5b246cff02d52577522baf1b08d2` |
| Scope | Product hardening for Verify, Hardware / Map Pins, and Export trust only |
| Out of scope | Repo cleanup, MarcusRPI, install scripts, manual generation, Vivado automation, broad UI redesign |
| Known failing gate | `pnpm typecheck` fails in pre-existing `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift |

Baseline commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile current; pnpm 10.24.0 |
| `pnpm start:smoke` | PASS | Launcher served `http://127.0.0.1:5197/` with HTTP 200 |
| `pnpm -s ide:gate:ece141-starter-verify-export` | PASS | Logic Gates Verify -> Export gate passed |
| `pnpm -s ide:gate:ece141-product-immersion` | PASS | Four product immersion workflows passed |
| `pnpm typecheck` | FAIL | Pre-existing `@redbyte/rb-lab-engine` / `rb-logic-core` drift |

## Hardening Ticket Translation

| Field | Value |
| --- | --- |
| Surface | Verify, Hardware / Map Pins, Export |
| Student goal | Use the 2-Bit Up Counter and basic starters without confusing clock, mapping, or evidence state |
| Observed issue | Counter clock policy is not fully visible before first run; Half Adder presents `SW1` while binding to SW2; Map Pins SVG controls lack stable clickable hit target test IDs; Export primary CTA can imply programming too early |
| Expected behavior | Counter workflow should expose board clock/reset policy in the normal path; starter pin labels and bindings should agree; manual mapping should be browser-testable; Export should state E0 package readiness without implying E1/E2/E3 |
| Risk | P1/P2 course confusion: beginners may think SW1 means physical SW1 while Export emits SW2, may miss clock policy, or may overread export as hardware proof |
| Evidence | Browser audit artifacts under `.redbyte/product-immersion/sprint2-audit/` |
| Acceptance | New focused Playwright gates cover counter clock/export wording and manual Map Pins edit/recovery |

## Browser Feedback Loop

Tooling: Playwright Chromium driven by local Vite dev server (`http://127.0.0.1:4173`).

Artifacts:

- `.redbyte/product-immersion/sprint2-audit/sprint2-audit-2.json`
- `.redbyte/product-immersion/sprint2-audit/manual-edit-force.json`
- `.redbyte/product-immersion/sprint2-audit/*.png`

The browser loop is repeatable through the focused gates added in this sprint; the JSON audit scripts were development-only local probes.

## Counter Clock Policy Findings

| Question | Finding | Severity |
| --- | --- | --- |
| Does the student know this is sequential logic? | Partly. Project copy and Verify summary say sequential / board clock, but the detailed policy panel is hidden before the first run. | P2 |
| Does the UI explain what clock means? | Summary says `CLK100MHZ runs automatically`; the detailed `Clock / timing` panel appears after running, not in the initial normal path. | P2 |
| Does the UI explain reset behavior? | After a run, the policy panel shows reset behavior. Before first run, reset is not prominent. | P2 |
| Does Verify distinguish combinational compare from sequential verification? | Partly. It labels `Auto board clock` and `Sequential lab`, but the counter Compare currently fails 6 checks in the observed run. | P1 |
| Does Hardware make clock/reset mapping obvious? | Yes for rows: `CLK100MHZ` has `Clock pin` and `Role: clock`; `RST` has `Role: reset`. | P2 |
| Does Export warn about clock/reset mapping if missing? | Export shows timing/mapping context and evidence rows; missing mapping is blocked elsewhere. | P2 |
| Does Export imply too much hardware evidence? | Evidence rows are honest, but a primary next action says `Download trusted Vivado package and program board`, which can imply E2/E3 progress from E0 readiness. | P2 |
| Can a beginner tell next action? | Mostly, but counter clock policy and failed Compare need clearer ordinary-path language. | P2 |

## Manual Pin Editing Findings

| Question | Finding | Severity |
| --- | --- | --- |
| Is manual editing discoverable? | Yes: Map Pins says select a row, then click a board region. | P2 |
| Are valid Basys3 pins obvious? | Mostly: rows show board alias and package pin; the resource catalog exists. | P2 |
| Are invalid/conflicting mappings prevented or warned? | Board click filtering only allows valid resource classes for the selected row; conflict labels exist. | P2 |
| Does the UI show mapped/unmapped counts accurately? | Observed rows and dock counts matched current starters. | P2 |
| Does Export use the same mapping state? | Logic Gates manual edit changed the Map Pins binding; Export table was collapsed in the audit and needs a gate. | P2 |
| Is there a reset/recover action? | Not visible in the normal Map Pins flow. | P2 |
| Is stale mapping possible? | Starter switching did not carry the edited Logic Gates `SW0` binding, but Half Adder itself has a label/pin mismatch: `SW1 (B)` maps to SW2/W16. | P1 |
| Is the student told what to do next? | Yes for row selection; stronger test targets are needed for the board controls. | P2 |

## Stale Mapping and Stale Verification Findings

| Case | Finding | Severity |
| --- | --- | --- |
| Starter switch | Logic Gates manual edit did not leak into Half Adder. The observed Half Adder `SW1 (B) -> SW2/W16` came from the starter definition, not stale state. | P1 |
| Design change | Not completed in this sprint; design mutation flow is deferred to a later recovery sprint. | P2 |
| Unverified after change | Counter Compare failure is visible as failed evidence and Export stays advisory/draft; no E1/E2/E3 overclaim observed. | P2 |

## Evidence Wording Audit

| UI Location | Text | Actual Evidence Level | Risk | Recommended Text | Fix Now? |
| --- | --- | --- | --- | --- | --- |
| Export evidence rows | `E0 - Export package ... export/package evidence only` | E0 | Safe | Keep | No |
| Export evidence rows | `E1 - Vivado build / bitstream External evidence required` | E1 external | Safe | Keep | No |
| Export evidence rows | `E2 does not prove behavior` | E2 external | Safe | Keep | No |
| Export evidence rows | `E3 ... manual observation required` | E3 manual | Safe | Keep | No |
| Export next action | `Download trusted Vivado package and program board` | E0 only in browser | Can imply programming/board progress from export readiness | `Download E0 Vivado package for external build` | Yes |
| Export ready headline | `Trusted Vivado handoff ready` | E0 package + current Verify/mapping | Slightly ambiguous | `E0 Vivado handoff ready` | Yes |
| Hardware ready follow-up | `Continue to Program Handoff when you are ready for the Basys3` | E0 plus mapping/verify/export | Can sound like board proof | `Continue to Export; Vivado build/programming remains external` | Yes |

## Fix Selection

| Issue | Severity | Why it matters for ECE141 | Why fix now | Likely files | Test / gate |
| --- | --- | --- | --- | --- | --- |
| Counter clock policy hidden before first run | P2 | Sequential beginners need to see that `CLK100MHZ` is automatic and reset is handled before comparing | Localized Verify surface / scenario builder rendering | `ScenarioBuilderPanel.tsx` or `VerifySurface.tsx` | `ide:gate:ece141-counter-clock-export` |
| Half Adder `SW1 (B)` maps to SW2/W16 | P1 | Starter label and physical board binding disagree, causing wrong lab wiring expectations | One-line starter data correction; current source already says SW1 | `examplesCatalog.ts` | `ide:gate:ece141-map-pins-recovery` |
| Board resource hit targets lack stable clickable selectors | P2 | Manual mapping needs a reliable browser gate without brittle coordinates | Add test IDs to existing hitboxes; no behavior change | `Basys3BoardView.tsx` | `ide:gate:ece141-map-pins-recovery` |
| Export next action overreaches into board programming | P2 | RedByte must not conflate E0 package with E1/E2/E3 | Local copy-only change | `ExportSurface.tsx`, maybe export primitives | `ide:gate:ece141-counter-clock-export` |

## Implemented Fixes

| Fix | Files | Product effect | Evidence |
| --- | --- | --- | --- |
| Show the sequential clock policy panel in the collapsed first-run Verify path | `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx` | 2-Bit Up Counter now exposes `CLK100MHZ`, automatic board-clock mode, and reset guidance before the first Compare run. | `pnpm -s ide:gate:ece141-counter-clock-export` |
| Add stable hit-target test IDs to Basys3 board controls | `packages/rb-apps/src/apps/ide/components/Basys3BoardView.tsx` | Manual Map Pins edits can be tested without brittle SVG coordinates; behavior is unchanged. | `pnpm -s ide:gate:ece141-map-pins-recovery` |
| Correct Half Adder `SW1 (B)` physical binding | `packages/rb-apps/src/apps/ide/examplesCatalog.ts` | Half Adder `SW1 (B)` now maps to physical `SW1 (pin V16)` instead of physical SW2/W16. | `pnpm -s ide:gate:ece141-map-pins-recovery` |
| Make Export ready-state copy E0-specific | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | Export states now name E0 package readiness and say Vivado build, board programming, and observation remain external. | `pnpm -s ide:gate:ece141-counter-clock-export` |

## Added Gates

| Gate | Command | What it proves |
| --- | --- | --- |
| ECE141 2-Bit Counter clock policy and export evidence smoke | `pnpm -s ide:gate:ece141-counter-clock-export` | Counter starter loads; Verify exposes clock/reset policy; Hardware shows clock/reset rows; Export evidence rows remain E0/E1/E2/E3 honest; export-ready copy stays E0-only. |
| ECE141 Map Pins manual edit and starter recovery smoke | `pnpm -s ide:gate:ece141-map-pins-recovery` | Logic Gates manual pin edit changes `SW0` to `SW2`, persists across surface navigation, appears in Export mapping, and does not leak after switching to Half Adder. |

## Validation

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile current; no dependency changes. |
| `pnpm start:smoke` | PASS | Launcher served `http://127.0.0.1:5197/` with HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | PASS | Existing Logic Gates starter Verify -> Export gate still passes. |
| `pnpm -s ide:gate:ece141-product-immersion` | PASS | Existing four-workflow product immersion gate still passes. |
| `pnpm -s ui:lab-starter-load-gate` | PASS | 8 starter-load tests passed. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | PASS | 2 Playwright tests passed. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | PASS | 1 Playwright test passed. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockAutoMode.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.workstation.test.tsx` | PASS | 36 focused unit/component tests passed. |

## Remaining Product Blockers

| Severity | Issue | Next action |
| --- | --- | --- |
| P1 | Full workspace `pnpm typecheck` still fails in pre-existing `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift. | Separate type-boundary cleanup task. |
| P1 | 2-Bit Up Counter saved Compare currently fails in the observed browser flow; this sprint made clock policy visible but did not repair counter semantics. | Dedicated counter verification semantics sprint. |
| P2 | Design-change stale mapping/stale verification recovery was not completed. | Import/export round-trip and recovery sprint. |
| P2 | Full Adder and other starters may still need a board-pin parity sweep beyond the Half Adder fix. | Starter validation expansion with Basys3 pin parity checks. |
