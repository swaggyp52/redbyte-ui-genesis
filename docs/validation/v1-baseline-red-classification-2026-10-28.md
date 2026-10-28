# V1 baseline-red classification (2026-10-28)

Every test that failed on `claude/redbyte-v1-reliability` before this pass, whatever commit it
first failed at. "It predates the branch" is not a disposition: each entry says whether the
behaviour is V1, what the failure actually was, what it could affect, and the evidence that closed
it. All were reproduced on the integrated candidate (`409bfac3c`) and, where noted, at the old
baselines `2fc2a015e` / `6e85a1475` before the fix.

Classes: **product** (the product was wrong), **stale contract** (the test asserted a decision
that was later superseded, recorded where it was decided), **test defect** (the test itself was
wrong), **out of scope** (the behaviour is not V1; the product must refuse it, never fake it).

| Test | V1? | Class | What it was | Consequence | Closed by |
| --- | --- | --- | --- | --- | --- |
| `lab8-export-validation` starter vectors | yes | product (authored content) | The lab 8 generator expected LOCK=0 on the ENTER row that completes the fourth valid group, LOCK=1 one row later | A correct student FSM failed its own starter check at tick 74 | Generator puts the new state on the edge row (manual 4.3 sampling); the assignment-derived oracle (`matrixOracles lockEdge`) and the JSON lab's per-pulse tables agree; `exampleIdentity.golden` records the stimulus-digest change |
| `verifyCommandBar.modeExplainer` | yes | product | The Reproduce refusal reason existed only as a disabled button's `title` | Keyboard and touch users never learned why Reproduce was off | Reason rendered as text (`ide-vcb-reproduce-reason`) |
| `verifySimulationStudio.v3` heading | yes | stale contract + product | The heading left the header in `fb7776b17`; the remaining context `div` had an `aria-label` but no role, so the label was not exposed | Screen readers lost both the stage name and the context group | `role="group"`; the workbench `<main>` is now named by the stage label ("Simulate workspace") instead of the route id ("verify workspace") |
| `hardwareSurface.modeExitTrap`, `projectHealth` x2 | yes | stale contract | Stage labels have one owner since `64bf7aa93` (Board, Package) | none (copy) | Tests read `BOARD_CONSTRAINTS_STAGE_LABEL` / `getOpenStageActionLabel` |
| `simulationProviderBar` x2 | yes | stale contract | `232fe970a` hides the bar unless an imported waveform exists | none | Tests assert the shipped contract; imported-waveform honesty stays covered by `vcdAnalyzerPanel.test` |
| `projectRuntime.exportHistory` | yes | stale contract | P2.6C (`f4bb64fd3`) retains every package receipt; the comment still said "bounded" | none | Test asserts complete retention in order; comment corrected |
| `ideApp.labday-wiring` Build Fresh rename | yes | stale contract | Manual Milestone 4 (2026-10-05): friendly names leave the HDL top intact; the test (July) expected the top to follow the name | none | Test asserts the top is kept on rename and changes through its own field |
| `ideApp.labday-wiring` provenance | yes | test defect | Run executes in a module worker since `64bf7aa93`; jsdom has none, so the product correctly refused ("Cancellable simulation is unavailable") | The test never exercised a Run | `inlineVerificationWorker.ts` runs the real `computeVerification`; the test passes end to end |
| `verifySurface.workstation` repeated compare | yes | stale contract | Running is owned by the runtime's execution status; a mocked `onRunVerification` never sets it | none | Test drives the execution status and still proves a repeated identical report clears Running |
| `gateHarness.contract` | yes | test infrastructure | Vite's SSR transform hoists imports above the harness shebang, so vitest could not load it; `editStimulus` was missing from the expected exports and the `.d.mts` | The gate harness contract was unverified | Shebang removed (the harness is only imported), `editStimulus` declared |
| `basys3-port-naming-phase1` README | yes | stale contract | The README pin map gained artifact port, board resource, package pin and direction columns | none | Assertion matches the full row and that node-port names never appear |
| `scenario-stale-ui-gate` fresh provenance x2 | yes | stale premise | A hand-built "passing run" over an imported VHDL counter can no longer be current: the P0 importer refuses what it cannot rebuild and Export checks stimulus, mapping and circuit evidence hashes | none (the strictness is the fix) | `scenario-provenance.productPath.test.ts` proves the same contracts from a real Run of a native design, including STALE after an edit |
| `vectorEditor` empty state | yes | stale contract | Copy is "No I/O mapping — assign project signals in Board first" | none | Assertion matches and requires the Board guidance |
| `vhdlImport.diagnostics` Tier B | yes | stale premise | Plain AND/OR assignments are rebuilt as gates since the P0 importer work, so they no longer warn | none | The fixture uses a conditional assignment, which is still not reconstructed and must name its line |
| `recordingState` engine fixture | yes | stale fixture | Fixtures named engine v1 | none | Uses `BROWSER_ENGINE_VERSION`; v2 recordings tested explicitly |
| `analog-comparator`, `analog-evaluator` | **no** | out of scope | Analog behaviours were removed from the engine in `e6a2df714`; the tests drove an LM358 that no longer exists | An analog part would read 0 if it ever ran | Retired; `analogScope.v1.test.ts` requires that no analog part is an engine part or supported component and that Simulate refuses LDR/LM358 by name. The `labContent.ts` "Task 3: Analog Sensor Integration" (LDR + LM358) is a physical breadboard circuit wired to a board input, not a simulated part |
| `crash-guard` (rb-logic-view, RB-DEBT-025) | yes | test defect | The mock returned a fresh object from `useUiTickStore` regardless of selector; LogicCanvas's effect loop ran the worker out of memory | Hung every root/package vitest run on the desktop | Mock honours the selector; the malformed-selection guard remains under test |

Found while proving the journeys (not unit reds): Generators covered the Event table summary at
1280x650 (composer allowed to shrink under its content; fixed with a content floor and a CSS
contract test); the run strip said "0 change in failing checks" (now "no change"); board legends
were 1.8-4.3:1 (fixed with label tokens and a contrast test).

## Candidate journeys that failed on rc.5 (2026-10-28, second pass)

verify-candidate on rc.5 passed 16 of 21. Each failure was reproduced against the running package
and against the sealed baseline, then closed with its assertions kept:

| Journey | Class | What it was | Closed by |
| --- | --- | --- | --- |
| `nested-adder` | journey layout | Column 1 was placed where INPUT A's output pin end and XOR x1's input pin end meet at one point, so their hit targets overlapped and the click aimed at A out armed x1 a; every later wire shifted by one (7/12). Identical at 2fc2a015e | Column 1 moved clear; a guard fails the journey if any two pins of different symbols share hit area (red on the old layout), and every wire must land as the connection it names |
| `design-core-authoring` | **real defect** + stale contract | Entering Wire put the wire cue on a row of its own (`64bf7aa93`), pushing the canvas down 44 px; the camera re-centred, so the pin moved 22 px. Earlier the wrap depended on the message length, so arming and completing a wire moved the target pins. Edit in Design now opens the live design | The cue shares the command row and its message claims no width (`contain: inline-size`); the journey's "must not move the port" contract holds at 1280x650. Edit-in-Design step follows the shipped behaviour |
| `full-adder-operational` | stale contract | "got" became "observed"; Edit in Design keeps the student's selection and names the failing output as the Verify focus; Connectivity is a closed inspector section; the recording pickers moved into closed disclosures (role queries cannot see them); the recorded value moved from the readout to the selected wire | Each step performs the student's action on the shipped UI; every assertion (mismatch names signal/expected/observed, driver row selects the SUM gate, retained recording immutable, recorded value of the failed sample) is kept |
| `project-persistence` | stale contract | Save As asks for the copy's name (Milestone 4); the recorded value moved to the selected wire | Confirms Save As; reads the wire value |
| `project-experience` | stale contract | The Top entity editor moved into the closed Project details disclosure | Opens it, then requires it to be reachable by a pointer |
| `ide-design-port-target-authority` (gate, not in `verify:gates`) | stale contract (July UI) | Targets `ide-design-workspace-header`, `data-port-cluster` and `ide-design-tool-hud`, none of which exist since the schematic redesign; fails identically on rc.5 | Not run by any gate list or CI; its live intent (wire guidance owned by the header, never over the canvas) is kept by the wire-cue fix. Retire or rewrite with the schematic pin contract (RB-DEBT-029) |

Found by the responsive/theme sweep (new `responsive-theme-sweep` journey: 4 viewports x light and
dark x 16/24 px text x 5 stages): library headings that wrap drew their second line over the next
heading at 1440x900 (fixed rows became min-height); Show left/right panel floated over the
workspace and covered Simulate's event Delete at 720x450 with 150% text (moved into the status
line). The sweep is red on rc.5 for the palette and green on the fixed build; its contrast check
was proven by injecting low-contrast text.

## Qualification boundary

The release gate is the full suite with no exclusions. Out of scope for V1, and enforced by
refusal rather than silence: analog simulation; imported HDL that the importer cannot rebuild
(ports only, named refusal); MUX4 and other unsupported parts (blocked by name). Vivado synthesis,
bitstream and board behaviour are separate evidence tiers (E1-E3) that a browser build cannot claim.
