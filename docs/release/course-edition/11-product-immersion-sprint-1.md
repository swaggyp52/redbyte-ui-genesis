# Product Immersion Sprint 1

Date: 2026-05-11

Branch: `chore/course-edition-repo-triage`

Starting commit: `095f5f2847a25b9bbb86a4e79b76620fa36d84f4`

Scope: browser-driven product audit and small hardening fixes for the ECE141 student path. This sprint did not add install scripts, write manuals, delete legacy material, or change the E0/E1/E2/E3 evidence model.

## Preflight and Baseline

| Command | Result | Notes |
| --- | --- | --- |
| `git status --short --branch` | Passed | On `chore/course-edition-repo-triage`; untracked `.redbyte/pi-session-room/` was left untouched. |
| `git branch --show-current` | Passed | Reported `chore/course-edition-repo-triage`. |
| `git log --oneline -n 10` | Passed | Latest local commit was the package-boundary cleanup sprint. |
| `pnpm install --frozen-lockfile` | Passed | Lockfile remained unchanged. |
| `pnpm start:smoke` | Passed | Dev smoke served the app with HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | Existing Logic Gates Verify -> Export gate still passed before product changes. |
| `pnpm typecheck` | Failed | Pre-existing workspace failure remains in `@redbyte/rb-lab-engine` and pulled `rb-logic-core` type-boundary drift. |

Dev server URL used by the Playwright browser loop: `http://127.0.0.1:4173/`.

## Browser Feedback Loop

Tool used: Playwright through the existing `playwright.dev.config.ts` local web server.

Repeatable command added:

```powershell
pnpm -s ide:gate:ece141-product-immersion
```

Artifacts are development-only and ignored by git:

```text
.redbyte/product-immersion/
```

Captured screenshots include:

- `surface-project-launch.png`
- `workflow-empty-design.png`
- `workflow-empty-verify.png`
- `workflow-empty-hardware.png`
- `workflow-empty-export.png`
- `surface-import-entry.png`
- `logic-gates-design.png`
- `logic-gates-verify-pass.png`
- `logic-gates-map-pins.png`
- `logic-gates-export-ready.png`
- `half-adder-design.png`
- `half-adder-verify-pass.png`
- `half-adder-map-pins.png`
- `half-adder-export-evidence.png`
- `two-bit-counter-design.png`
- `two-bit-counter-verify-clock.png`
- `two-bit-counter-verify-after-run.png`
- `two-bit-counter-export.png`
- `fsm-lock-design.png`
- `fsm-lock-verify.png`

The gate records JSON findings in the same ignored folder and fails on severe console errors or the previous `[CircuitStore] Circuit mutation called but engines not connected!` warning. The browser loop can be repeated by another Codex run with the command above and does not require Vivado or Basys3 hardware.

## Surface Audit Matrix

| Surface | Workflow State | Observed Behavior | Problem | Severity | Evidence | Fix Candidate | Test Needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Project | First launch | Landing screen offers a fresh project and starter cards. | Half Adder was not in the first three landing cards before this sprint, even though it is a core ECE141 starter. | P2 | Browser audit plus `ideApp.labday-wiring.test.tsx` old Signal Tour assumption. | Show Logic Gates, Half Adder, and 2-Bit Up Counter as the primary course path. | Added product immersion gate and updated unit expectations. |
| Project | Loaded starter | Starter replacement prompts before overwriting current work. | Replacement behavior is good but depends on students finding the intended starter. | P2 | Existing lab-day wiring test. | Keep prompt, improve starter ordering. | Updated existing unit test to use course starters. |
| Design | Empty project | Blank design surface opens after Build Fresh. | From-scratch gate placement was not deeply exercised in this sprint. | P2 | `workflow-empty-design.png`. | Future blank-canvas authoring pass. | Add a gate that places a basic gate and checks state. |
| Design | Starters | Logic Gates, Half Adder, Counter, and FSM lock starter render in Design. | Advanced FSM is visible but should remain a bridge/deferred path, not a turnkey claim. | P2 | Starter screenshots. | Keep advanced boundary explicit. | Starter validation expansion. |
| Verify | Logic Gates | Compare passes and reports `12/12 match`. | No blocker found. | P3 | Existing and new Playwright gates. | Keep as regression guard. | Existing `ide:gate:ece141-starter-verify-export`. |
| Verify | Half Adder | Compare passes and reports `8/8 match`. | Before this sprint, the starter was less discoverable and Export was blocked by label/mapping mismatch. | P1 | New Playwright gate failed before the mapping fix. | Fix starter mapping labels to match boundary labels. | Added product immersion gate. |
| Verify | 2-Bit Counter | Verify shows `CLK100MHZ runs automatically` and `Auto board clock`; Compare can run. | The fuller clock policy panel is not visible in the standard course flow before the run. | P2 | `sequential-findings.json`, counter screenshots. | Clarify clock policy visibility for sequential starters. | Add focused counter clock-policy gate. |
| Hardware / Map Pins | Starters | Logic Gates and Half Adder show mapping tables; Counter mapping is reachable. | Manual pin-edit workflow was not deeply exercised. | P2 | Map Pins screenshots. | Harden edit-state and stale mapping feedback. | Add Hardware/Map Pins edit smoke. |
| Export | Empty project | Export blocks or warns when mapping/export prerequisites are missing. | Blocked state is visible, but broken/corrupt project recovery still needs direct testing. | P2 | `workflow-empty-export.png`. | Add broken/unverified circuit gate. | Broken project export warning gate. |
| Export | Logic Gates | Export reaches ready-to-build with Vivado package language. | E0 is clear enough in this path; no E1/E2/E3 proof is implied by the gate. | P3 | `logic-gates-export-ready.png`. | Keep evidence rows visible. | Existing Logic Gates gate. |
| Export | Half Adder | Now reaches ready-to-build and shows E0/E1/E2/E3 rows. | Before this sprint, Export blocked at `4/8 mapped` because `ioRows` labels did not match circuit boundary labels. | P1 | New gate failed before fix and passed after fix. | Align `ioRows` labels with starter node labels. | Added product immersion gate. |
| Import | Entry route | Import surface and workflow rail are visible at `/?mode=import`. | Full import/export round trip was not completed in this sprint. | P2 | `surface-import-entry.png`. | Exercise `.rbproj` import with starter parity. | Add import/export round-trip smoke. |

## Student Workflow Findings

| Workflow | Completed? | Blocker? | Confusing Step | Evidence | Fix Needed | Severity | Test Needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Empty project | Partially | No launch blocker | From-scratch gate placement and recovery were not deeply exercised. | Empty Design/Verify/Hardware/Export screenshots. | Add blank-canvas authoring and invalid-export gates. | P2 | Blank project create -> place gate -> verify/export state. |
| Logic Gates starter | Yes | No | None blocking. | `12/12 match`, Map Pins table, Export Ready to Build. | Keep as baseline. | P3 | Existing gate remains required. |
| Half Adder starter | Yes after fix | Fixed P1 | Export initially blocked despite Verify passing because mapped labels were inconsistent. | Browser gate failure before fix, pass after fix. | Fixed `ioRows` labels and landing discoverability. | P1 fixed | Product immersion gate. |
| 2-Bit Up Counter starter | Yes | No hard blocker | Sequential clock policy summary is visible, but full clock policy detail is less obvious. | Counter Verify and Export screenshots. | Clarify sequential clock policy in standard flow. | P2 | Counter clock-policy gate. |
| FSM / lock starter | Partially | No sprint blocker | Advanced starter is reachable, but should not be marketed as turnkey. | FSM Design and Verify screenshots. | Keep deferred/bridge boundary visible. | P2 | Advanced starter boundary smoke. |
| Verify Compare | Yes for Logic Gates, Half Adder, Counter | No for tested starters | Counter policy context could be clearer before run. | Pass heroes and evidence text. | Add counter-specific clarity gate. | P2 | Verify beginner clarity sprint. |
| Vector-test workflow | Partially | No | Used saved checks; manual vector authoring was not exercised. | `ide-vcb-use-saved-checks` and run path. | Later vector-authoring audit. | P2 | Vector authoring gate. |
| Pin mapping workflow | Partially | No | Existing starter mappings visible; manual edit was not tested. | Hardware screenshots. | Hardware/Map Pins product hardening. | P2 | Pin edit and stale-map warning gate. |
| Basys3 export workflow | Yes for E0 readiness | No | E0 only; no Vivado build/program/observe proof. | Export evidence rows and ready-to-build state. | Continue preserving E0/E1/E2/E3 language. | P3 | Export evidence-label smoke now included for Half Adder. |
| Import/export round trip | No | Not yet classified | Import entry observed only. | Import screenshot. | Add `.rbproj` round-trip test. | P2 | Import/export round-trip smoke. |
| Broken/invalid circuit | Partially | No hard crash | Empty project export blocked; missing-output/unmapped-pin workflows need direct testing. | Empty Export screenshot. | Add broken-circuit export warning gate. | P2 | Broken/unverified export gate. |
| Recovery/reset | Partially | Not yet classified | Browser refresh and corrupt project recovery were not fully tested. | Runtime browser loop only. | Recovery/reset UX sprint. | P2 | Refresh/reopen/corrupt project smoke. |

## Evidence Claim Audit

| UI Location | Claim Text | Actual Evidence Level | Risk | Recommended Copy | Fix Now? |
| --- | --- | --- | --- | --- | --- |
| Verify pass hero | PASS / match count | Verify compare evidence only | Low if kept inside Verify; does not prove board behavior. | Keep tied to vector comparison. | No. |
| Export ready header | Export Ready to Build | E0 readiness for Vivado handoff package | Low to medium; "build" must remain a Vivado handoff claim, not board proof. | Keep paired with evidence rows. | No. |
| Export evidence row E0 | Export package | E0 | Safe. | Keep. | No. |
| Export evidence row E1 | External evidence required | E1 not produced by browser workflow | Safe. | Keep. | No. |
| Export evidence row E2 | E2 does not prove behavior | E2 requires programming evidence and still does not imply E3 | Safe and important. | Keep. | New gate asserts this text. |
| Export evidence row E3 | Manual observation required | E3 requires physical observation | Safe. | Keep. | New gate asserts this text. |
| Hardware surface | Map Pins / board resources | Mapping state only | Medium if students read mapped as verified. | Keep mapping separate from Verify and Export proof. | Defer to Hardware hardening sprint. |
| Counter Verify summary | CLK100MHZ runs automatically / Auto board clock | Browser simulation policy, not physical clock proof | Medium for beginners. | Make full clock policy easier to find in normal flow. | Defer; recorded as P2. |
| Export download/program wording | Download trusted Vivado package and program board | Could imply E2 if shown too early | High if visible without external evidence | Keep hidden from E0-only browser workflow. | New Half Adder gate asserts it is absent. |

## Fix Selection

| Issue | Severity | Reason to fix now | Reason not to defer | Files touched | Test |
| --- | --- | --- | --- | --- | --- |
| Primary landing starter path did not show Half Adder | P2 | Half Adder is a core early ECE141 workflow and was required by this sprint. | Students should not need to know the examples browser to start the course ladder. | `ProjectSurface.tsx` | Product immersion gate and updated lab-day wiring unit test. |
| Half Adder export blocked after Verify pass | P1 | The course path would let a beginner pass Verify but fail Export from a supported starter. | It directly breaks the first proven starter -> verify -> export expansion beyond Logic Gates. | `examplesCatalog.ts` | Product immersion gate failed before the fix and passed after. |
| No broad product browser audit gate | P1 | Manual screenshots alone are not enough for repeated course hardening. | Future surface changes need a repeatable browser feedback loop. | `tests/e2e/ece141-product-immersion.spec.ts`, `package.json`, `.gitignore` | `pnpm -s ide:gate:ece141-product-immersion`. |

## Product Scorecard

| Surface | Current Grade | Why | Must Fix Before Course? | Next Best Fix |
| --- | --- | --- | --- | --- |
| Project | B | Course starters are now first-screen reachable and replacement prompts are tested. | Yes, but no P0 remains from this sprint. | Add save/load and recovery walkthrough coverage. |
| Design | C | Starters render well, but from-scratch beginner authoring was not deeply tested here. | Yes. | Blank-canvas place/connect/label gate. |
| Verify | B | Logic Gates and Half Adder Compare pass; Counter sequential run is usable. | Yes. | Make counter clock policy clearer in normal flow. |
| Hardware / Map Pins | C | Starter mapping tables are visible; manual edit/stale mapping workflows need proof. | Yes. | Pin edit and stale mapping warning smoke. |
| Export | B | Logic Gates and Half Adder reach E0 readiness; evidence rows are honest. | Yes. | Broken/unverified export warning gate plus download artifact inspection. |
| Import | C | Import route and workflow rail are visible, but round-trip parity is unproven in this sprint. | Yes for course package if import is student-facing. | `.rbproj` export/import round-trip gate. |

## Top 10 Product Problems

1. Manual pin editing and stale mapping recovery are not yet proven in browser automation.
2. Import/export round-trip parity is not yet proven for the course workflow.
3. Broken or corrupted project recovery needs a direct browser gate.
4. Counter sequential clock policy is visible in summary form but not fully obvious in the normal course flow.
5. From-scratch empty project authoring still needs a beginner workflow gate.
6. FSM / lock starter should remain clearly framed as an advanced bridge, not turnkey Lab 8 completion.
7. Full workspace `pnpm typecheck` still fails in pre-existing `rb-lab-engine` / `rb-logic-core` type-boundary drift.
8. Existing `pnpm -s ide:gate:export-ready-contract` remains stale or mismatched with current flow.
9. `pnpm build:unified` still fails on the known `/os/` root redirect contract drift.
10. Save/load and browser restart recovery were not deeply exercised in this sprint.

## Next 5 Product Sprints

1. Verify beginner clarity and counter clock-policy hardening.
2. Hardware / Map Pins edit-state and stale-mapping product hardening.
3. Export evidence, artifact download, and `.rbproj` import/export round-trip gate.
4. Blank project authoring, invalid circuit, and broken-export recovery UX.
5. Starter validation expansion for full adder, comparator, counter, and FSM/lock bridge boundaries.
