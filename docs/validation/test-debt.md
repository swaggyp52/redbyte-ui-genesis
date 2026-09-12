---
doc_status: current
used_by_claude: true
---

# RedByte — test debt inventory

## P2.6B exact classroom diagnostic (2026-09-12)

At dfec50b446aeab5b48d1828adf1f8139be32615f, the unchanged canonical chain passes its
build and examples then fails at Project command center (step 3 of 72). Its remaining
69 steps are unexecuted. The separate diagnostic continuation runs all 71 post-build
commands with three independent preview workers at the same build: **19 pass / 52 fail**.
This continuation is not the canonical chain's exit status. No source or HEAD changed
during the census. Full logs and classification are local ignored evidence under
.redbyte/product-immersion/p2-6-studio-completion/p2-6b/classroom-final/.

The one confirmed product regression is empty Simulate showing its instrument and a mapping
warning before a circuit exists. The current frame's CSS owner now handles that state;
the existing starter picker is opened directly. Source proof and 11 owner tests pass;
the committed built gate is recorded in the closure checkpoint. That follow-up does not
rewrite the original census. The other rows name the failing consumers and their measured
assertions, not a blanket claim that all unexecuted semantic checks would pass.

Disposition by category: Project consumers migrate to Start/Overview/explorer; shell consumers
to rail/menu/object identity; Design consumers to current View/Explore/Hierarchy and panel
policy; Simulate consumers to one Run, optional checks, Time/Table and explicit Details;
Board consumers to current mapping/resource/detail composition; Package consumers to the
current ZIP action and explicit report. Preserve each unique editing, currentness, trust,
value, recovery and visibility invariant. Do not restore retired modes or weaken trust tests.

| Failing command | Category | Observed assertion (abbreviated; full log retained) |
| --- | --- | --- |
| `ide:gate:project-command-center` | retired Project consumer | Project first launch must expose the start workspace |
| `ide:gate:project-loaded-paths-first-viewport` | retired Project consumer | 1366x768: loaded command center must be measurable |
| `ide:gate:project-loaded-command-surface` | retired Project consumer | Project command surface failures: 1366x768: 1366x768/Project command board: missing visible region for [data-testid="ide-project-command-board-v1"] 1440x900: 1440x900/Project command board: missing visible region for [data-testid="ide-project-command |
| `ide:gate:interaction-affordance` | retired shell consumer | top bar must keep one visible Help affordance |
| `ide:gate:project-identity-editing` | retired shell consumer | locator.click: Timeout 30000ms exceeded. Call log:   - waiting for locator('[data-testid="ide-board-chip"]').first() |
| `ide:gate:side-dock-affordance` | Design panel or control consumer | Side dock affordance failures: 1366x768/design: 1366x768: Design Library must be readable but bounded (264px) 1366x768/verify: 1366x768: Simulate must not spend workspace width on a separate Signals rail 1440x900/design: 1440x900: Design Library must |
| `ide:gate:open-side-panel-density` | Board composition consumer | Open side panel density failures: 1366x768/hardware: hardware: direct detail workspace is too narrow (359px) 1440x900/hardware: hardware: direct detail workspace is too narrow (359px) |
| `ide:gate:workbench-obstruction-usability` | Design panel or control consumer | Workbench obstruction usability failures: 1366x768/design: 1366x768/design: stable left support width 264px is outside 180-240px 1366x768/verify: 1366x768/verify: left support region should yield to the primary work object until it has useful context |
| `ide:gate:active-mode-reload-recovery` | retired shell consumer | Project starter load should show design; topbar showed "" |
| `ide:gate:student-task-completion-flow` | Design panel or control consumer | Student task flow failures: 1366x768: 1366x768: Design Library must remain a stable 180-230px region {"top":32,"left":56,"right":320,"bottom":718,"width":264,"height":686,"visibleWidth":264,"visibleHeight":686} 1440x900: 1440x900: Design Library must |
| `ide:gate:authoring-depth-release-safety` | retired Project consumer | Authoring depth failures: 1366x768: 1366x768: Project must expose Change Project 1440x900: 1440x900: Project must expose Change Project |
| `ide:gate:design-canvas-zoom-integrity` | Design panel or control consumer | locator.waitFor: Timeout 5000ms exceeded. Call log:   - waiting for locator('[data-testid="ide-design-overflow-reset"]') to be visible |
| `ide:gate:design-workbench-v1` | Design panel or control consumer | locator.waitFor: Timeout 5000ms exceeded. Call log:   - waiting for locator('[data-testid^="ide-design-hierarchy-row-"]').first() to be visible |
| `ide:gate:design-canvas-direct-workbench` | Design panel or control consumer | loaded starter direct controls: direct view tools must remain inside the Design toolbar |
| `ide:gate:workbench-stability-overhaul` | Design panel or control consumer | 1366x768: direct canvas view tools must remain inside the Design toolbar |
| `ide:gate:design-palette-build-contract` | Design panel or control consumer | locator.evaluate: Timeout 30000ms exceeded. Call log:   - waiting for locator('[data-testid="ide-design-board-input-sw0"]').first() |
| `ide:gate:verify-reality-contract` | Simulate owner consumer | Verify must expose the Scenario workspace before a run |
| `ide:gate:verify-saved-checks-default` | Simulate owner consumer | 1366x768: starter saved checks must remain visible in the Checks workspace ({"scenarioSelected":false,"checksSelected":false,"checksAvailable":false,"checkCount":0,"runLabel":"Run","modeExplainer":"12 saved checks are evaluated automatically."}) |
| `ide:gate:verify-testbench-usable-layout` | Simulate owner consumer | 1366x768: Verify must expose the v3 Simulation Studio job definition ("Active scenarioLogic Gates: AND / OR / XOR/DefaultScenario ready") |
| `ide:gate:verify-signals-dock-not-clipped` | Simulate owner consumer | Simulate signal shelf failures: 1366x768: page.waitForSelector: Timeout 5000ms exceeded. Call log:   - waiting for locator('[data-testid="ide-verify-signal-shelf"]') to be visible 1440x900: page.waitForSelector: Timeout 5000ms exceeded. Call log:   - |
| `ide:gate:verify-no-circuit-task-first` | real empty-state regression | 1366x768: blank Simulate must not blame mapping/hardware or waveform apparatus (verify starts after design has a circuit nothing to verify yet build a circuit in design, load a course starter from project, or recover/import hdl before running observe |
| `ide:gate:verify-workbench-layout-reset` | Simulate owner consumer | Compare checks must be selectable for starter checks |
| `ide:gate:verify-postrun-workbench-usability` | Simulate owner consumer | Verify post-run workbench failures: 1366x768: 1366x768: Compare checks must be selectable 1440x900: 1440x900: Compare checks must be selectable 1093x614: 1093x614: Compare checks must be selectable |
| `ide:gate:verify-evidence-workbench` | Simulate owner consumer | first-run stimulus editor must be visible ([data-testid="ide-verify-add-vector-form"]) |
| `ide:gate:complex-build-signal-trace-debugging` | Design panel or control consumer | locator.waitFor: Timeout 5000ms exceeded. Call log:   - waiting for getByTestId('ide-design-overflow-reset').first() to be visible |
| `ide:gate:testbench-editor-and-export-confidence-flow` | Simulate owner consumer | initial Verify: case-table editor must be visible |
| `ide:gate:export-handoff-station` | Package operational consumer | draft export primary action must be visible |
| `ide:gate:export-first-viewport-artifacts` | Simulate owner consumer | Export first-viewport artifact failures: 1366x768: 1366x768: Verify Compare mode must be available 1440x900: 1440x900: Verify Compare mode must be available |
| `ide:gate:export-package-inspector` | Simulate owner consumer | Export inspector failures: 1366x768: Compare mode must be selectable 1440x900: Compare mode must be selectable |
| `ide:gate:export-artifact-direct-preview` | Simulate owner consumer | Export direct-preview failures: 1366x768: 1366x768: Verify Compare mode must be available 1440x900: 1440x900: Verify Compare mode must be available |
| `ide:gate:export-e2e-contract` | Simulate owner consumer | Simulate must expose Scenario, Checks, and one Run simulation authority |
| `ide:gate:export-trust-integrity` | Simulate owner consumer | trusted export proof requires Compare checks in Verify |
| `ide:gate:hardware-basys3-workbench` | Simulate owner consumer | Hardware ready boundary requires Verify Compare mode |
| `ide:gate:hardware-first-viewport` | Board composition consumer | Hardware first-viewport hierarchy failures: 1366x768: page.waitForSelector: Timeout 15000ms exceeded. Call log:   - waiting for locator('[data-testid="ide-hw-board-workspace"].ide-hw-v3') to be visible 1440x900: page.waitForSelector: Timeout 15000ms  |
| `ide:gate:shell-navigation-overhaul` | retired shell consumer | shell navigation overhaul failures: 1366x768: 1366x768/fresh-project: horizontal stage navigation must be readable and bounded, got {"visible":false,"width":0,"height":0,"top":0,"bottom":0} 1440x900: 1440x900/fresh-project: horizontal stage navigatio |
| `ide:gate:primary-work-object-dominance` | Design panel or control consumer | primary work object dominance failures: 1366x768: 1366x768: Design stable-workspace canvas is too narrow (1014px); expected at least 1093px 1440x900: 1440x900: Design stable-workspace canvas is too narrow (1088px); expected at least 1152px |
| `ide:gate:nested-scroll-regression` | Simulate owner consumer | nested scroll regression failures: 1366x768: Verify checks workspace control must be visible 1440x900: Verify checks workspace control must be visible |
| `ide:gate:workbench-reconstruction-v1` | retired shell consumer | workbench reconstruction failures: 1366x768: 1366x768/design-loaded: expected 52px horizontal stage navigation {"topbar":{"visible":true,"top":0,"bottom":32,"height":32},"stageNav":{"visible":false,"top":0,"height":0},"ribbon":{"visible":false,"top": |
| `ide:gate:design-dual-tool-windows` | Design panel or control consumer | Design support-dock failures: classroom-stable: classroom-stable/default workspace: support tools must preserve a usable canvas {"layoutMode":"standard","supportDockPolicy":"persistent-configurable","leftDockState":"visible","rightDockState":"hidden" |
| `ide:gate:design-library-not-cropped` | Design panel or control consumer | Design library failures: 1366x768: 1366x768: Design library must remain a compact 172-224px support tool (264px) 1440x900: 1440x900: Design library must remain a compact 172-224px support tool (264px) |
| `ide:gate:design-tool-window-coexistence` | Design panel or control consumer | Design tool-window failures: 1366x768: 1366x768: Library width is not tool-like {"selector":"[data-testid=\"ide-left-dock\"]","visible":true,"top":32,"left":56,"right":320,"bottom":718,"width":264,"height":686,"visibleWidth":264,"visibleHeight":686," |
| `ide:gate:verify-task-plane-usability` | Simulate owner consumer | 1366x768: Verify must expose the v3 Simulation Studio job definition ("Active scenarioLogic Gates: AND / OR / XOR/DefaultScenario ready") |
| `ide:gate:hardware-board-dominance` | Board composition consumer | Hardware table-first hierarchy failures: 1366x768: 1366x768/mapping table: too narrow (359px < 519px) 1440x900: 1440x900/mapping table: too narrow (359px < 547px) |
| `ide:gate:hardware-board-unblocked` | Board composition consumer | Hardware board failures: 1366x768: 1366x768: primary mapping table is too narrow {"selector":"[data-testid=\"ide-hw-map-table\"]","visible":true,"top":191,"left":66,"right":425,"bottom":450,"width":359,"height":259,"visibleWidth":359,"visibleHeight": |
| `ide:gate:release-readiness-visual-contract` | Design panel or control consumer | Release-readiness visual failures: 1366x768: 1366x768: Design Library must remain a compact support tool {"selector":"[data-testid=\"ide-left-dock\"]","visible":true,"top":32,"left":56,"right":320,"bottom":718,"width":264,"height":686,"visibleWidth": |
| `ide:gate:action-first-entry-surfaces` | retired Project consumer | Action-first entry failures: 1366x768: 1366x768/Project start surface: missing visible region for [data-testid="ide-project-start-hub"] 1440x900: 1440x900/Project start surface: missing visible region for [data-testid="ide-project-start-hub"] |
| `ide:gate:outer-workflow-action-density` | retired Project consumer | Outer workflow density failures: 1366x768: 1366x768/project command board action surface: missing visible region for [data-testid="ide-project-command-board-v1"] 1440x900: 1440x900/project command board action surface: missing visible region for [dat |
| `ide:gate:card-chrome-regression` | retired Project consumer | Card chrome regression failures: 1366x768: 1366x768/project: surface root not found 1440x900: 1440x900/project: surface root not found |
| `ide:gate:release-solidification-v1` | Simulate owner consumer | Release solidification failures: 1366x768: Compare mode must be selectable 1440x900: Compare mode must be selectable |
| `ide:gate:release-solidification-v2` | retired Project consumer | Release solidification v2 failures: 1366x768: 1366x768: current Project start surface must remain visible null 1440x900: 1440x900: current Project start surface must remain visible null |
| `ide:gate:workbench-space-utilization` | retired Project consumer | Workbench space utilization failures: 1366x768/project: 1366x768: Project command center must be visible 1366x768/design: 1366x768: Design canvas is squeezed to 1014.0px; expected at least 1093px 1366x768/verify-before-run: 1366x768: Verify before ru |
| `ide:gate:import-recovery-contract` | retired Project consumer | Loaded Project must keep command center visible |

repo-status --skip-build reports nine PASS lines including the advisory Git check, then
fails Project Overview. Bring-up and import are now green; the direct Overview gate reads
an empty retired landing-title selector. Later repo-status checks remain unmeasured.

## P2.6B reviewed consumer census (2026-09-12)

Command: `node node_modules/vitest/vitest.mjs run verifySurface designSurface --maxWorkers=2 --minWorkers=1 --reporter=json`.
The same 460 tests run in protected baseline worktree 2d3160131 give 386 pass / 74 fail;
at pushed 57f4df2bd they give 333 pass / 127 fail; after bounded consumer migration the
reviewed source gives **374 pass / 86 fail**. This closes 41 failures from the first P2.6B
checkpoint, but remains 12 failures above baseline. Identity comparison finds **23 newly
failing identities, 11 closed baseline identities, 63 retained failures**. Of the retained
failures, 38 have the same first message and 25 a changed message. Counts alone do not
establish that a changed failure is old. The complete comparison is local ignored evidence
at `.redbyte/product-immersion/p2-6-studio-completion/p2-6b/surface-failure-comparison.json`.

Migrated consumers use one Run, optional check counts, explicit Details, Table/Recorded trace,
one result announcement, one selected work area and explicitly opened support panels. The
current-owner 12-file batch passes 92/92. Receipt/scenario/persistence owners pass 91/91,
including the newly reproduced lost-event-id defect. No semantic trust assertion is skipped.
Typecheck is **768 / b9e8e0eb29ca1d2a** (Node 20.19.0, TS 5.9.3): two diagnostics disappear
with retired control assertions, without suppression or an upward baseline update.

Remaining failures by file (all under packages/rb-apps/src/apps/ide/__tests__):

| File | Failing tests |
| --- | ---: |
| `designSurface.blankState.test.tsx` | 1 |
| `designSurface.canvasChrome.test.tsx` | 2 |
| `designSurface.fanout.test.tsx` | 4 |
| `designSurface.multiWireNet.test.tsx` | 1 |
| `designSurface.placementMode.test.tsx` | 1 |
| `designSurface.registerFamily.test.tsx` | 1 |
| `designSurface.selectionContext.test.tsx` | 1 |
| `designSurface.workstation.test.tsx` | 11 |
| `verifySurface-fail-state.test.tsx` | 1 |
| `verifySurface.failure-context.test.tsx` | 2 |
| `verifySurface.failure-patterns.test.tsx` | 4 |
| `verifySurface.hints-bridge.test.tsx` | 3 |
| `verifySurface.layout-workflow.test.tsx` | 3 |
| `verifySurface.manualLabStepMode.test.tsx` | 2 |
| `verifySurface.observeFirst.test.tsx` | 9 |
| `verifySurface.signalIdentity.test.tsx` | 1 |
| `verifySurface.three-panel.test.tsx` | 2 |
| `verifySurface.waveform-priority.test.tsx` | 4 |
| `verifySurface.workspaceLayout.test.tsx` | 1 |
| `verifySurface.workstation.test.tsx` | 32 |

Newly failing identities require these dispositions; they are not dismissed as old debt:

| File and test | Current failure | Disposition |
| --- | --- | --- |
| `designSurface.workstation.test.tsx` — DesignSurface workstation redesign keeps the library stable and reveals the inspector only after selection | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-left-dock"] | Migrate to explicit support-panel opening; preserve selection assertion. |
| `designSurface.workstation.test.tsx` — DesignSurface workstation redesign keeps Split placement active after the student chooses a library macro | Error: Unable to find an element by: [data-testid="ide-left-dock"] | Migrate to explicit support-panel opening; preserve selection assertion. |
| `designSurface.workstation.test.tsx` — DesignSurface workstation redesign preserves the camera when returning from split until a measured resize reconciles it | AssertionError: expected { x: 516, y: 360, zoom: 1.6 } to deeply equal { x: -999, y: -777, zoom: 0.5 } | Update camera expectation for measured viewport reconciliation; keep placement containment proof. |
| `verifySurface-fail-state.test.tsx` — VerifySurface FAIL state (PR14 regression guard) renders the focused FAIL workspace when lastRun is fail | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-left-dock"] | Migrate to explicit support-panel opening; preserve selection assertion. |
| `verifySurface.manualLabStepMode.test.tsx` — VerifySurface manual lab step workflow defaults step mode on for manual_event_driven_lab runs with multiple ticks | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-step-controls"] | Re-express step navigation through the one Time instrument; do not restore a parallel transport. |
| `verifySurface.manualLabStepMode.test.tsx` — VerifySurface manual lab step workflow hides Prev/Next bar when step mode is toggled off but keeps the toggle | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-step-mode-toggle"] | Re-express step navigation through the one Time instrument; do not restore a parallel transport. |
| `verifySurface.observeFirst.test.tsx` — VerifySurface observe-first model shows Open in Design button in command bar when lastRun exists and onGoToDesign provided | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-open-circuit-replay"] | Re-express explicit retained-recording circuit handoff, including missing callbacks. |
| `verifySurface.observeFirst.test.tsx` — VerifySurface observe-first model shows Open in Design button when onGoToDesignWithInputs provided even without onGoToDesign | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-open-circuit-replay"] | Re-express explicit retained-recording circuit handoff, including missing callbacks. |
| `verifySurface.observeFirst.test.tsx` — VerifySurface observe-first model publishes the auto-selected observed signal so Design can track observation-only runs live | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-signal-rail-summary"] | Re-express against the current result and optional-check owners; retain semantic failure/currentness assertions. |
| `verifySurface.signalIdentity.test.tsx` — Verify signal identity — a name that means two things counts the register as internal and the pin as an output | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-group-outputs"] | Inspect the exact assertion and current recording/panel fixture; preserve the semantic invariant. |
| `verifySurface.workspaceLayout.test.tsx` — VerifySurface workspace layout keeps signals integrated with the workbench without a separate rail | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-left-dock"] | Migrate to explicit support-panel opening; preserve selection assertion. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls does not invent scenario staleness when no active scenario provenance exists | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-results-summary"] | Re-express against the current result and optional-check owners; retain semantic failure/currentness assertions. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls focuses first-run compare guidance on the current vectors instead of generator tooling | AssertionError: expected '1 saved checks are evaluated automati…' to contain 'Check filled expected outputs' | Re-express against the current result and optional-check owners; retain semantic failure/currentness assertions. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls treats the Stimulus case selector as the same selected tick used by Verify readouts | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-signal-sw0"] | Inspect the exact assertion and current recording/panel fixture; preserve the semantic invariant. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls arms assertion checking immediately after capturing outputs as expected | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-signal-ld0"] | Inspect the exact assertion and current recording/panel fixture; preserve the semantic invariant. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls revokes a prior Compare FAIL while Design is structurally blocked and keeps Observe ungraded | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-vcb-use-saved-checks"] | Re-express against the current result and optional-check owners; retain semantic failure/currentness assertions. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls applies observed repair through a waveform-label alias to the authored expected cell | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-results-summary"] | Re-express against the current result and optional-check owners; retain semantic failure/currentness assertions. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls keeps another testbench failure read-only after the active document changes | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-results-summary"] | Re-express against the current result and optional-check owners; retain semantic failure/currentness assertions. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls preserves blank assertions when capture updates an existing assertion mask | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-signal-ld0"] | Inspect the exact assertion and current recording/panel fixture; preserve the semantic invariant. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls populates truth table rows for a passing run | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-results-summary"] | Re-express against the current result and optional-check owners; retain semantic failure/currentness assertions. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls folds workbench actions and signal-rail controls into their header rows | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-left-dock"] | Inspect the exact assertion and current recording/panel fixture; preserve the semantic invariant. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls shows canonical signal lanes when waveform samples use internal node keys | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-left-dock"] | Inspect the exact assertion and current recording/panel fixture; preserve the semantic invariant. |
| `verifySurface.workstation.test.tsx` — VerifySurface workstation controls keeps internal trace lanes visible when no mapped I/O lanes are available | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-left-dock"] | Inspect the exact assertion and current recording/panel fixture; preserve the semantic invariant. |

The older inventory below is historical mixed-revision evidence. Whole-family red results
remain a release limitation even where current browser outcomes pass. Final classroom and
repo-status results will be recorded separately; unexecuted steps are not passing steps.

## P2.6B first consumer migration checkpoint (2026-09-12)

The retired Observe/Compare command-row consumers now assert one Run with optional checks;
20 command-row tests pass. Hardware readiness now checks retained recorded values and named
changed inputs rather than expecting a fabricated zero; 26 tests pass. The imported-port-only
bringup contract no longer fabricates PASS from authored expectations: actual floating X outputs
remain failures, while project-vector expected IO remains authored data. The focused current-owner
batch is 72/72. Type diagnostics remain 770 / 1165a0a5faf044e6 (Node 20.19.0, TS 5.9.3).

Project/VCD/complex-import/full-adder journeys follow the current owning disclosure/navigation
without restoring removed controls. Whole Verify/Design families and classroom consumers remain
release debt until the final quiet-head census below; this checkpoint does not call them green.


Every failing vitest file in the repository, recorded so that no red is dismissed as somebody
else's. This is a **register of work**, not a list of excuses and not a gate: the campaign fixes
the entries that cost a student real work first, and the rest stay named here until they are
closed. A file listed here is release debt.

## How this was measured, exactly

- Command: `node .redbyte/tools/capture/test-inventory.mjs` — the whole suite in sequential
  chunks of 24 files, each chunk reported as JSON.
- Files: **531** test files. **454 passed, 53 failed.**
- Tests: **3418 passed, 111 failed.**
- Chunks that produced no report at all: **1** — recorded as crashed, not as
  passing. A chunk with no report has *unknown* coverage, which is not the same as green.
- **Mixed-revision diagnostic, not an exact-HEAD acceptance result.** The sweep ran while this
  session was editing source, so different chunks observed different working trees. It is
  reliable as a register of what is broken; it is not a statement about one commit. Re-run it on
  a quiet tree before quoting it as an acceptance number.
- Runtime: Node 20.19.0, the repository pin.

## Closed during the 2026-09-06 refine-in-place session

- `packages/rb-apps/src/apps/ide/__tests__/verifySurface.observeFirst.test.tsx` — 1 test(s). Reconciled, see the commits on
  `claude/redbyte-operational-workbench-convergence-w9k2r4`.
- `packages/rb-apps/src/apps/ide/__tests__/verifySurface.authoring.test.tsx` — 1 test(s). Reconciled, see the commits on
  `claude/redbyte-operational-workbench-convergence-w9k2r4`.

## Open

Ordered by class. `missing-module` and `missing-testid` are the cheapest to judge: the thing the
test reaches for is gone, so the only question is whether it *should* be gone.

| File | Failing | Class | First assertion |
|---|---|---|---|
| `apps/toolchain-route.test.tsx` | 1 | missing-module | Failed to resolve import "../src/App" from "apps/toolchain-route.test.tsx". Does the file exist? |
| `packages/rb-apps/src/__tests__/circuitHealthPanel.test.tsx` | 1 | missing-module | Failed to resolve import "../components/CircuitHealthPanel" from "packages/rb-apps/src/__tests__/circuitHealthPanel.test.tsx". Does the file exist? |
| `packages/rb-apps/src/__tests__/clock-indicator.test.tsx` | 1 | missing-module | Failed to resolve import "../components/TopCommandBar" from "packages/rb-apps/src/__tests__/clock-indicator.test.tsx". Does the file exist? |
| `packages/rb-apps/src/__tests__/ece-lab-submission-bundle-action.test.tsx` | 1 | missing-module | Failed to resolve import "../components/ECELabSubmissionBundleAction" from "packages/rb-apps/src/__tests__/ece-lab-submission-bundle-action.test.tsx". Does the file exist? |
| `packages/rb-apps/src/__tests__/hdl-editor-panel.test.tsx` | 1 | missing-module | Failed to resolve import "../components/HdlEditorPanel" from "packages/rb-apps/src/__tests__/hdl-editor-panel.test.tsx". Does the file exist? |
| `packages/rb-apps/src/__tests__/schematic-culling.test.tsx` | 1 | missing-module | Failed to resolve import "../components/SchematicView" from "packages/rb-apps/src/__tests__/schematic-culling.test.tsx". Does the file exist? |
| `packages/rb-apps/src/__tests__/top-command-bar-submission.test.tsx` | 1 | missing-module | Failed to resolve import "../components/TopCommandBar" from "packages/rb-apps/src/__tests__/top-command-bar-submission.test.tsx". Does the file exist? |
| `packages/rb-apps/src/apps/ide/__tests__/submissionViewer.test.tsx` | 1 | missing-module | Failed to resolve import "../surfaces/SubmissionViewerSurface" from "packages/rb-apps/src/apps/ide/__tests__/submissionViewer.test.tsx". Does the file exist? |
| `packages/rb-apps/src/stores/__tests__/fileAssociationsStore.test.ts` | 1 | missing-module | Failed to resolve import "../apps/files/fileActionTargets" from "packages/rb-apps/src/stores/fileAssociationsStore.ts". Does the file exist? |
| `packages/rb-apps/src/stores/__tests__/fileSystemStore.persistence.test.ts` | 1 | missing-module | Failed to resolve import "../apps/files/fsModel.js" from "packages/rb-apps/src/stores/fileSystemStore.ts". Does the file exist? |
| `packages/rb-apps/src/stores/__tests__/hilEvidenceProof.test.ts` | 1 | missing-module | Failed to resolve import "../stores/useLabWorkflowStore" from "packages/rb-apps/src/stores/__tests__/hilEvidenceProof.test.ts". Does the file exist? |
| `packages/rb-apps/src/utils/__tests__/evidenceExport.test.ts` | 1 | missing-module | Failed to resolve import "@redbyte/rb-logic-3d" from "packages/rb-apps/src/utils/evidenceExport.ts". Does the file exist? |
| `packages/rb-apps/src/__tests__/vectorEditor.test.tsx` | 1 | missing-testid | TestingLibraryElementError: Unable to find an element with the text: /No IO mapping/i. This could be because the text is broken up by multiple elements. In this case, you can provide a funct |
| `packages/rb-apps/src/apps/ide/__tests__/designSurface.canvasChrome.test.tsx` | 2 | missing-testid | AssertionError: expected 'Circuit health0 errors0 warnings0 dra…' to contain 'Ready for Verify' |
| `packages/rb-apps/src/apps/ide/__tests__/designSurface.continuedEditing.test.tsx` | 1 | missing-testid | Error: Unable to find an element by: [data-testid="ide-design-label-input"] |
| `packages/rb-apps/src/apps/ide/__tests__/designSurface.fanout.test.tsx` | 4 | missing-testid | Error: Unable to find an element by: [data-testid="ide-design-context-trace"] |
| `packages/rb-apps/src/apps/ide/__tests__/designSurface.registerFamily.test.tsx` | 1 | missing-testid | Error: Unable to find an element by: [data-testid="ide-design-register-config"] |
| `packages/rb-apps/src/apps/ide/__tests__/designSurface.selectionContext.test.tsx` | 1 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-design-context-trace"] |
| `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx` | 5 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-design-workspace-header"] |
| `packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx` | 6 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-export-artifact-tab-top-xdc"] |
| `packages/rb-apps/src/apps/ide/__tests__/exportSurface.readiness.test.tsx` | 9 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-export-summary-card"] |
| `packages/rb-apps/src/apps/ide/__tests__/exportSurface.timing-authority.test.tsx` | 2 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-export-gate-clock"] |
| `packages/rb-apps/src/apps/ide/__tests__/exportSurface.trust-clarity.test.tsx` | 17 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-export-trust-banner"] |
| `packages/rb-apps/src/apps/ide/__tests__/hardwareBusPlanner.test.tsx` | 1 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-hw-bus-planner-mapped"] |
| `packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.trust-clarity.test.tsx` | 4 | missing-testid | AssertionError: expected 'Unassigned' to contain 'Missing' |
| `packages/rb-apps/src/apps/ide/__tests__/simulationProviderBar.test.tsx` | 2 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-sim-provider-browser-logic"] |
| `packages/rb-apps/src/apps/ide/__tests__/verifyProfessionalTestbench.test.tsx` | 4 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-testbench-document-tab-counter-sequence"] |
| `packages/rb-apps/src/apps/ide/__tests__/verifySurface.layout-workflow.test.tsx` | 1 | missing-testid | TestingLibraryElementError: Unable to find an element by: [data-testid="ide-verify-primary-status"] |
| `packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx` | 20 | missing-testid | AssertionError: expected 'Case 1' to contain 'Case 2' |
| `packages/rb-apps/src/apps/ide/__tests__/gateHarness.contract.test.ts` | 1 | other | C:\Users\conno\redbyte-ui-genesis-main\scripts\gates\_gateHarness.mjs:7 |
| `packages/rb-apps/src/apps/ide/__tests__/verifySimulationStudio.v3.test.tsx` | 1 | other | TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name "Simulation Studio" |
| `packages/rb-apps/src/export/__tests__/stopship-verify.test.ts` | 1 | other | Error: Example "four-bit-adder-hierarchical" has 11 verification failure(s): |
| `packages/rb-logic-core/src/__tests__/analog-comparator.test.ts` | 1 | other | Error: Snapshot `LM358 comparator behavior > toggles output as V_plus crosses V_minus 1` mismatched |
| `packages/rb-apps/src/__tests__/lab8-export-validation.test.ts` | 1 | shape | AssertionError: expected [ { tick: 75, …(5) } ] to deeply equal [] |
| `packages/rb-apps/src/apps/ide/__tests__/projectHealth.test.ts` | 2 | shape | AssertionError: expected [ { code: 'RBP1005', …(2) } ] to deeply equal [ { code: 'RBP1005', …(2) } ] |
| `packages/rb-apps/src/apps/ide/__tests__/verifySurface.waveform-priority.test.tsx` | 4 | shape | AssertionError: expected [ Array(5) ] to include 'sw0' |
| `packages/rb-apps/src/__tests__/basys3-port-naming-phase1.test.ts` | 1 | value-or-copy | AssertionError: expected '# RedByte Basys3 Export — Vivado Impo…' to contain '\| sw0 \| SW0 \|' |
| `packages/rb-apps/src/__tests__/ide-bringup-contract.test.ts` | 1 | value-or-copy | AssertionError: expected 'project-vectors' to be 'verify-run' // Object.is equality |
| `packages/rb-apps/src/__tests__/ide-synth-subset-contract.test.ts` | 1 | value-or-copy | AssertionError: expected '# RedByte Basys3 Export — Vivado Impo…' to contain '\| sw0 \| SW0 \| V17 \| input \|' |
| `packages/rb-apps/src/__tests__/ide-vivado-project-folder-contract.test.ts` | 1 | value-or-copy | AssertionError: expected '{\n  "circuit": {\n    "connections":…' to be '{\n  "circuit": {\n    "connections":…' // Object.is equality |
| `packages/rb-apps/src/__tests__/scenario-stale-ui-gate.test.ts` | 2 | value-or-copy | AssertionError: expected true to be false // Object.is equality |
| `packages/rb-apps/src/apps/ide/__tests__/designSurface.multiWireNet.test.tsx` | 1 | value-or-copy | TypeError: .toMatch() expects to receive a string, but got undefined |
| `packages/rb-apps/src/apps/ide/__tests__/designSurface.placementMode.test.tsx` | 1 | value-or-copy | AssertionError: expected "spy" to be called 1 times, but got 2 times |
| `packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx` | 1 | value-or-copy | AssertionError: expected 'After mappingBoard CheckPre-flightOpe…' to contain 'Simulation is exploratory and is not …' |
| `packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockAutoMode.test.tsx` | 1 | value-or-copy | AssertionError: expected 'Reset: authored in the Timing lanes' to contain 'custom reset' |
| `packages/rb-apps/src/apps/ide/__tests__/verifySurface.desktopComposition.test.tsx` | 1 | value-or-copy | AssertionError: expected 'Simulation run 1. Simulation complete…' to contain 'Verification run 1. Compare passed.' |
| `packages/rb-apps/src/apps/ide/__tests__/verifySurface.failure-context.test.tsx` | 1 | value-or-copy | AssertionError: expected "spy" to be called with arguments: [ { signal: 'ld0', tick: 1, …(4) } ][90m |
| `packages/rb-apps/src/apps/ide/__tests__/verifySurface.simulationStudio.test.tsx` | 1 | value-or-copy | AssertionError: expected 'Run · observe only' to contain 'Run simulation' |
| `packages/rb-apps/src/import/__tests__/fixture04-lab8-security-lock.test.ts` | 1 | value-or-copy | AssertionError: expected +0 to be 8 // Object.is equality |
| `packages/rb-apps/src/import/__tests__/vhdlImport.diagnostics.test.ts` | 2 | value-or-copy | AssertionError: expected undefined to be defined |
| `packages/rb-logic-core/src/__tests__/analog-evaluator.test.ts` | 1 | value-or-copy | AssertionError: expected 'failed' to be 'passed' // Object.is equality |

## What each class means, and how to close it

- **missing-module** — the test imports a file that no longer exists. Decide whether the
  capability moved (repoint the test) or was deliberately deleted (delete the test, naming the
  commit that removed the owner). Never leave it importing a ghost.
- **missing-testid** — the surface no longer renders what the test reaches for. This is the class
  that hides real defects: `ide-vcb-author-expected` looked exactly like this and turned out to be
  a control that no component rendered any more, while its props were still being passed. Check
  whether the affordance exists anywhere before calling the assertion obsolete.
- **value-or-copy** — an asserted value or sentence differs from what the owner produces. If the
  wording changed deliberately, assert the machine-readable signal instead of the prose; if the
  value is wrong, it is a product defect.
- **shape** — a returned structure differs. Establish which shape is canonical before editing
  either side.
- **other** — read the first assertion.

## Rule

"It was already failing" is not a disposition. Each entry is closed by fixing the product,
migrating the assertion to the behaviour it protects with the reason recorded, or deleting it
with the commit that removed its owner named. A failing historical test is not by itself a
specification for what RedByte should become - but it is always a question that has to be
answered out loud.
