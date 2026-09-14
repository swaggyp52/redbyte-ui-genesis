# P2.6 - Studio completion and product hardening

- Date: 2026-09-11
- Owner: Connor Angiel
- Status: in flight; this document is the campaign's current record and is updated at each checkpoint
- Surface / mode: shell, Project, Design, Simulate, Board, Package, gate infrastructure
- Journey: start or resume -> build -> experiment -> diagnose -> repair -> map -> package -> reload
- Environment: canonical Windows checkout, Node 20.19.0 / pnpm 10.24.0, TypeScript 5.9.3; playground dev server at `http://[::1]:5173/`; Vivado not installed on this machine.
- Source: branch `claude/redbyte-studio-completion-p2-6-q7m3v8` from PR #85 head `2d3160131`; draft PR [#86](https://github.com/swaggyp52/redbyte-ui-genesis/pull/86) with base `claude/redbyte-operational-workbench-convergence-w9k2r4`. PR #85 and #84 untouched, `main` untouched, format version 1, protected goldens unchanged.

## Problem and reproduction

The Browser-E0 workbench was functionally deep and its automation asserted retired screens: the
classroom chain stopped at its first step on Project catalog test ids that no element has
carried since the Start Center, `repo:status` stopped on a four-column README pin map the
export stopped producing, and four Board trust-clarity tests read a command strip the mapping
surface does not draw. Behind the automation, measured defects: the starter picker dialog was
4392px tall in a 720px window with no scrollable ancestor (no Load button reachable at laptop
sizes); the project's name on its Overview measured 13px at a 32px root beside a 24px meta line;
Board dock headings measured 1.49:1 under two OS-era `!important` rules; the Design inspector
gave a 64px block to one Rename button and printed "Previous 0 / Transition stable" for a part
nothing had recorded; a failed Compare forced the Problems panel over the instrument at 1280x650;
and the running app reported "Connection from q0_ff.Q has no driver" twice on a correct counter
because it resolved a stale `.js` mirror of the Verilog generator that the tests never see.

## Delivered (by commit)

| Commit | What RedByte can do now that it could not |
|---|---|
| `e166b87e6` | `ide:gate:examples-contract` measures the Start Center and File -> Open Starter...; the starter picker is reachable at every size; the synth-subset and trust-clarity assertions read the current product (the Board's next line says draft / checked and why) |
| `84601cf14` | 200% text reaches the identity line (`--rb-text-body` and five siblings are rem); one owner for dock headers; Board's support docks, bring-up step and table on the light surface (worst text 4.8:1) |
| `75d136510` | Design inspector: identity card 140 -> 110px, Actions ~290 -> 251px for a gate, Connectivity inside the dock at 1280x720; Evidence rows say "Live value / not recorded" instead of fabricated zeros |
| `3b00b9412` | The counter journey introduces a real design defect (XOR1 -> OR, fails at t5), traces it to the recorded circuit, repairs it, retains the failed recording with its OR, generates the checked package and survives a reload |
| `e10210443` | The app and library builds resolve `.ts` before `.js`, as vitest does: the shipped generator no longer fabricates undriven flip-flops (counter ledger 3 -> 1 problem) |
| `ef229054f` | A failed check is a result: Simulate no longer forces the Problems panel open |
| `9b79dd78e` | A saved project can be deleted from Start behind a named confirmation; `ProjectRepository.remove` takes exactly one record |
| `2909cecd9` | A failed run keeps the instrument: the diagnosis rows sit inside the failure context, the run line is the failure's home |
| `4a0abec0a` | The gate harness recognises the current Simulate stimulus (case table, timing grid) as the ready state it is - 15 classroom steps stopped dying on a retired editor's cells |
| `a26378370` | Pre-flight is retired: Board offers Board Check and the simulated board after mapping; the header's next line names the package Build & Export will offer (draft / checked) and why; nine orphaned CSS owner sets deleted; `student-loop-contract` step 4b, `hardware-checklist-contract`, `modeExitTrap`, `history-authority`, `mappingWorkflow` and `readiness` read the current owner |
| (working tree) | `ide:gate:hardware-checklist-contract` opens a starter first - the blank home project's Board has nothing to map and offers no after-mapping tools, so the gate had never reached a checklist - and reveals the collapsed support dock through its own control |

## Separate acceptance verdicts

- **Correctness:** counter and Full Adder identities, chronology, retained recordings, package
  digest and reload state are verified through the journeys; the export diagnostics now come
  from the generator the tests verify; deleting a saved project removes exactly that record.
  Full repository typing is not clean (770 inherited diagnostics, fingerprint
  `1165a0a5faf044e6`, unchanged at every commit).
- **Interaction:** the extended counter journey (1440x900, 1280x650), the Full Adder journey
  (1440x900, 1366x768, 1280x650, exact ZIP digest), the project-experience journey with the
  delete step (1440x900, 1280x650) and the migrated examples-contract gate all pass against
  the running product. Every action in them is a click or a keystroke.
- **Visual quality:** captures of all five workspaces at 1440x900, 1280x650 and 200% root text
  were opened and read; the starter picker, the Board Check dock, the inspector and the counter
  failure state were inspected in the browser before and after each change. Remaining visual
  gaps are named below. This is the implementer's review, not owner acceptance.

## Classroom chain and repo:status

**First pass (diagnostic, mixed-revision - not acceptance).** Every classroom step after
`build` was run against the preview built at `2d3160131`, continuing past failures, while the
branch advanced through seven commits: 12 of 71 passed. Reading every log
(`.redbyte/product-immersion/p2-6-studio-completion/classroom-classification.md`) sorts the 59
failures into three causes, none of them yet a product defect:

| Cause | Steps | Disposition |
|---|---|---|
| `shell build sha 2d31601 != <later head>` - the gate asserts the served build is the working tree's HEAD, which moved under it | 28 | Artifact of running the chain while committing. Re-run at one head against a fresh build. |
| `verify had neither a visible generate-basics action nor an existing ready-vector state` - the harness helper `ensureVerifyVectorsReady` recognised only a retired stimulus editor's cells | 15 | Harness migrated: the helper now recognises the case table and the timing grid beside a visible Run. Re-run. |
| Retired selectors and pre-P2.5 composition numbers: `ide-project-command-board-v1`, `ide-design-hierarchy-row-*`, `ide-design-board-input-sw0`, `.ide-hw-v3`, "surface root", a topbar mode label; "left support width 264px is outside 180-240px", "detail workspace too narrow (359px)", "canvas squeezed to 1014px; expected 1093px", "direct view tools must remain inside the Design toolbar", "Simulate must not spend width on a separate Signals" | ~16 | Category B - obsolete assertions against decisions P2.5J/K/M/N made deliberately (264px library, 340px Board detail pane, View menu, Signals rail, Start/Overview). To migrate or retire in bounded batches, each unique fact re-expressed against the current owner; none restores retired UI. |

**Second pass (one head, `2909cecd9`, fresh `pnpm build`, harness fix in place, no commits
during the run): 21 of 71 passed.** Every log read
(`.redbyte/product-immersion/p2-6-studio-completion/classroom-run-pass2-2909cecd9.json`,
`classroom-logs/`). The 50 failures by cause:

| Cause | Steps | Disposition |
|---|---|---|
| Retired Project catalog / command board: `ide-project-command-board-v1`, `ide-project-start-hub`, "Change Project", "surface root not found", "Project first launch must expose the start workspace", "loaded command center must be measurable", "topbar showed ''" | 12 (`project-command-center`, `project-loaded-paths-first-viewport`, `project-loaded-command-surface`, `active-mode-reload-recovery`, `authoring-depth-release-safety`, `action-first-entry-surfaces`, `outer-workflow-action-density`, `card-chrome-regression`, `release-solidification-v2`, `workbench-space-utilization`, `import-recovery-contract`, `shell-navigation-overhaul`) | Category B: the Start Center and Overview replaced these in P2.5M; the P2.6B Project navigation decision replaces them again. Migrate after that decision lands, not before. |
| Design library / canvas budgets from the pre-P2.5K shell: "Library must remain 180-240px (264px)", "canvas squeezed to 1014px; expected 1093px", "direct view tools must remain inside the Design toolbar", "support tools must preserve a usable canvas" | 10 (`side-dock-affordance`, `workbench-obstruction-usability`, `student-task-completion-flow`, `design-canvas-direct-workbench`, `workbench-stability-overhaul`, `primary-work-object-dominance`, `design-dual-tool-windows`, `design-library-not-cropped`, `design-tool-window-coexistence`, `release-readiness-visual-contract`) | Category B against the P2.5K 264px library and View menu; the P2.6B Design panel policy (circuit dominant, one auxiliary region) is the owner to re-express these against. |
| Simulate's pre-P2.5N composition: "Scenario workspace", "Checks workspace", "Signals shelf", "v3 Simulation Studio job definition", "Replay workspace tab", `ide-verify-add-vector-form`, "case-table editor must be visible", `ide-verify-waveform-svg`, `ide-verify-signal-shelf`, "Scenario, Checks, and one Run simulation authority" | 12 (`verify-reality-contract`, `verify-saved-checks-default`, `verify-testbench-usable-layout`, `verify-signals-dock-not-clipped`, `verify-no-circuit-task-first`, `verify-workbench-layout-reset`, `verify-postrun-workbench-usability`, `verify-evidence-workbench`, `testbench-editor-and-export-confidence-flow`, `export-e2e-contract`, `nested-scroll-regression`, `verify-task-plane-usability`, `release-solidification-v1`) | Category B against one experiment with one primary area (P2.5N). The P2.6B Simulate rebuild (one Run, one instrument, one inspector) is the owner to migrate to. |
| Board's pre-P2.5J 519px table / `.ide-hw-v3` class / 359px detail pane | 4 (`open-side-panel-density`, `hardware-first-viewport`, `hardware-board-dominance`, `hardware-board-unblocked`) | Category B against the 340px contextual detail pane; `.ide-hw-v3` is a class no element carries. |
| Export's pre-operational landing: "draft export primary action", "Build Current Bundle", a 2241px scroll that "must expose vertical overflow" | 4 (`export-handoff-station`, `export-first-viewport-artifacts`, `export-trust-integrity`, `design-canvas-zoom-integrity` / `complex-build-signal-trace-debugging` on `ide-design-overflow-reset`) | Category B / retired selector. |
| Retired shell selectors: `ide-topbar-help-btn` (the Help menu is `ide-menu-help`), `ide-board-chip` (deliberately absent from the command bar per `workflowStages.authority`), `ide-design-hierarchy-row-*`, `ide-design-board-input-sw0` | 4 (`interaction-affordance`, `project-identity-editing`, `design-workbench-v1`, `design-palette-build-contract`) | Retired selectors; migrate to the current owner in the consumer batch. |
| **Product defect found by a gate:** `no-cropped-controls-regression` - the Design left dock's fourth tab "Board I/O" is laid out at x 315-392 inside a 218px tab strip that scrolls sideways (`.rb-design-dock-tabs { overflow-x: auto }` at 264px), so the tab is unreachable without a horizontal scroll nobody is offered | 1 | Real. Measured in the running app (dock 56-320, strip 218px, scrollWidth 314). Owned by the P2.6B Design dock recomposition. |
| Repeated-selector timeouts already counted above | 3 | - |

None of the 50 is a lost capability. The three migrated gates (`examples-contract`, `student-loop-contract`,
`hardware-checklist-contract`) PASS against the build at `a26378370`.

**Two Board Check facts measured at 1440x900 for the next owner:** the "Back to Board & Constraints"
banner is laid out at y=962 under an `overflow-y: hidden` panel body of 788px (`order: 5` in a grid
that does not scroll) - unreachable, though Esc and the rail's Assignments tab return; and on a
fresh profile the checklist itself sits in a collapsed support dock (`leftDockMode="collapsed"`),
so Board Check opens showing the board and no steps.

## Not delivered, stated plainly

- **Board Check composition.** Pre-flight is retired (`a26378370`); Board Check remains an OS-era
  composition beside the current mapping surface: a 111px command hero restating the status bar
  (five pale chips at 12px on white), a 66px dark "Board workspace" banner, a board card forced to
  `clamp(430px, 100vh - 210px, 740px)` around a 334px drawing, the exit banner below an
  unscrollable clip, and the checklist in a dock that opens collapsed. Recomposition on the light
  system - status line, rail with its way back, the board in a light frame, the steps as a table
  under it - belongs to the P2.6B Board polish phase, after Design and Simulate.
- 217 tracked `.js` mirrors remain under `packages/*/src`; the resolver now ignores them where a
  `.ts` sibling exists. Retiring them is a separate census.
- Vivado is not installed here (`C:\Xilinx` absent); E1 was not attempted. Proof tier stays
  Browser E0.
- The Project Overview leaves ~500px of stranded blank space under its closed disclosures at
  1440x900; the Simulate "Together" view at 1280x650 gives the waveform tools three rows above
  a ~90px lane area; 200% text still crowds Board's assignment table ("CARR Y") and truncates the
  Simulate inspector's values.
