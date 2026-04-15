---
type: architecture
status: active
area: infrastructure
updated: 2026-04-14
related:
  - "[[Claude Session Mode]]"
  - "[[Canonical Notes Policy]]"
  - "[[Note Schema]]"
  - "[[BUG-018 Lab Hardware Strict Readiness Blocked by Missing djtgcfg]]"
  - "[[ADR-005 Verify Schedule Contract Owns Sequential Clock Authority]]"
  - "[[Project Surface]]"
  - "[[Design Surface]]"
  - "[[Verify Engine]]"
  - "[[Verify Design Loop]]"
  - "[[Hardware Surface]]"
  - "[[Export Contracts]]"
  - "[[2026-03-25 Verify Refactor Plan]]"
---

# RedByte Engineering Brain

---

## What is broken right now

BUG-003 is closed. The `React.act` crash documented there no longer reproduces in the current repo state.

```dataview
TABLE area, priority, status
FROM "05 Bugs"
WHERE status = "open" OR status = "investigating" OR status = "blocked"
SORT priority DESC
```

---

## What system am I working in?

Pick one - this is your workspace for today:

| Mode | Open these notes |
|---|---|
| **Verify Debug** | [[Verify Engine]] - [[Verify Hint System]] - `05 Bugs/` (verify area) |
| **Export + Vivado** | [[Connection Model]] - [[Export Contracts]] - [[Basys 3 Mapping]] |
| **Architecture + Planning** | [[Canonical Notes Policy]] - `04 Decisions/` - this dashboard |

Full routing details: [[Workspace Routing]]

---

## What Claude should read before acting

Always:

- [[Canonical Notes Policy]] - before creating any note
- [[Note Schema]] - before writing any Properties block
- [[Claude Session Mode]] - if this is a new session

For verify work: [[Verify Engine]] + [[Verify Hint System]]
For export work: [[Connection Model]] + [[Export Contracts]]
For project workflow / onboarding work: [[Project Surface]]
For test work: [[Test Infrastructure]]
For Design workflow hierarchy work: [[Design Surface]]
For Hardware / Map Pins work: [[Hardware Surface]] + [[Export Contracts]] + [[Basys 3 Mapping]]
For cross-surface authoring loop work: [[Verify Design Loop]] + [[Design Surface]] + [[Verify Engine]]

---

## Workflow map

- [[Project Surface]] = front door, current state, next-action authority
- [[Design Surface]] = circuit authoring, structural inspection, replay-backed explanation
- [[Verify Engine]] = stimulus authoring, run control, waveform truth, optional compare
- [[Verify Design Loop]] = the handoff contract between waveform evidence and structural explanation
- [[Hardware Surface]] = physical I/O mapping, board readiness, program handoff context
- [[Export Contracts]] = deterministic artifact and submission/program package handoff

---

## What is the next action

Latest hardware/export mapping-authority slice landed (2026-04-14):

- [[BUG-018 Hardware Export Mapping Authority Drift]] is fixed: blank/custom Hardware now opens on `Map Pins` with Design-first guidance, mapped starter flows no longer hide required-port gaps behind contradictory status, and Export no longer ghosts `rst_btnc` or disables visible `EN` / `RST` rows when the live mapping is valid
- Basys3 binding refs now anchor the shared alias story across Export validation and entity-based testbench generation, so sanitized labels such as `RST (BTNC)` resolve back to the same exported row and entity ref
- targeted validation is complete for this slice: `pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/buildExportViewModel.canonical-naming.test.ts packages/rb-apps/src/apps/ide/__tests__/exportSurface.mapping-trust.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx` passed (`3` files, `30` tests), and live browser replay on `http://127.0.0.1:5173/os/` confirmed the blank/custom, `Signal Tour`, and `2-Bit Up Counter` student paths

Next action after this slice: if Hardware/Export classroom risk remains active, add one browser contract or gate that walks blank/home -> `Signal Tour` -> `2-Bit Up Counter` and asserts the current mapping/export truths; otherwise resume the next highest product-risk slice from the active board.

Latest Lab 8 classroom-readiness slice landed (2026-04-14):

- Lab 8 starter Verify now ships explicit reset rows plus authored `ENTER` `0,1,0` pulses, so students can run the invalid and valid traces in ordinary IDE Verify instead of loading an empty vector table
- Basys3 manual-switch sequential exports now keep `CLOCK_BUFFER_TYPE NONE`, omit `create_clock` on `SW5`, and add `set_false_path` timing suppression for switch/button-driven latch paths
- targeted validation is complete for this slice: `pnpm -w exec vitest run packages/rb-apps/src/__tests__/lab8-export-validation.test.ts packages/rb-apps/src/__tests__/scenario-sequential-trust-gate.test.ts` passed (`2` files, `66` tests)

Next action after this slice: if classroom risk stays on Lab 8, add one UI-level smoke or gate path that loads the starter and proves the preloaded vectors survive the normal student workflow; otherwise resume the current shared-shell / Design rail follow-up work.

Latest lab-machine dependency and bridge-readiness pass landed (2026-04-14):

- the Windows lab machine now resolves `pnpm`, `python`, and `vivado` as normal shell commands; `pnpm dev` serves `RedByte Playground` at `http://localhost:5173/`, and the real FPGA bridge serves `http://127.0.0.1:4242/`
- root script execution is unblocked on this repo state: `tsx` is now declared at the workspace root, so existing `pnpm exec tsx ...` scripts such as `classroom:hw:check` run again from the root package
- [[BUG-018 Lab Hardware Strict Readiness Blocked by Missing djtgcfg]] is now the active classroom hardware blocker: the bridge sees a Digilent-class FTDI device on `COM4`, but strict Basys3 readiness still fails because Digilent Runtime is present without `djtgcfg`
- next action: install Digilent Adept utilities or otherwise provide `RB_DJTGCFG_PATH` / `DJTGCFG_PATH`, then rerun `pnpm -s classroom:hw:check -- --strict` and the classroom hardware signoff path

Latest shared shell compact/wide-layout fix landed (2026-04-13):

- [[BUG-017 Shared Compact Workbench Row Theft]] is fixed: live browser measurements showed Project, Design, and Verify were all losing workbench height in compact layouts because the shared shell still reserved a second row when the right dock was hidden or only collapsed, and wide-screen hidden-right-dock sessions could still inherit an older capped grid path
- the shared shell now marks `hide-right-dock` for truly hidden inspectors, compact stacked-inspector rules only apply when the right dock is visibly open, the hidden-right-dock grid uses collapsed slot width instead of full dock width, and Design's auto-open inspector now uses the shared user-collapse / reveal-key contract instead of forcing a sticky visible dock
- targeted validation is complete for this slice: focused shell + Design workstation regressions are green (`2` files, `43` tests), compact-height browser measurements on `http://127.0.0.1:4180/` confirmed full-height Project, Design, and Verify workspaces (`703px` shell / grid / body), and wide-viewport proof showed Verify back at full shell width (`2212px` grid, `2156px` body, `56px` collapsed `Signals` rail)

Next action after this slice: continue the state-aware Design rail pass, but keep future geometry work tied to measured browser regressions in the shared shell instead of surface-local CSS guesses.

Latest Verify workspace collapse recovery landed (2026-04-13):

- [[BUG-016 Verify Workspace Nested Grid Collapse]] is fixed: source-driven validation on `http://127.0.0.1:4180/` showed the outer Verify workspace still reserving unused columns, which squeezed the waveform into a narrow strip and left dead bottom space in the main lab
- Verify now uses one full-width lab frame with the inner lab grid owning the actual stimulus/waveform split; the dead bottom row is gone, and the Verify `Signals` rail is wide enough to read as a deliberate dock instead of cramped chrome
- targeted validation is complete for this slice: focused Verify/shell regressions are green (`5` files, `56` tests), and live measurements confirmed the recovered desktop geometry (`~629px` stimulus / `~681px` waveform, `208px` left dock)

Next action after this slice: keep future Verify layout work tied to measured browser-visible regressions; do not reopen shell geometry without live source-driven evidence.

Latest hard visual architecture pass landed (2026-04-13):

- Project now reads as a workflow front door instead of a dashboard: Project Home keeps two deliberate start lanes, and loaded Project keeps one current-focus hero above the supporting workflow cards
- Design now reads as a calmer authoring surface: the right rail is flattened into `Selection`, inline facts, `Actions`, `Live / Signal State`, and `Details`, while replay case/tick/focus stays integrated instead of reopening a separate replay slab
- Verify now reads as one lab surface: the command bar is the sole session authority, the left dock is a `Signal guide`, the workbench header is compact, and the waveform stays the primary evidence stage
- targeted validation is complete for this slice: focused UI suites are green (`8` files, `134` tests), unified build is green, rebuilt browser validation is complete on `http://127.0.0.1:4179/os/`, and code review found no blocking issues

Next action after this slice: keep future work on concrete browser-visible contradictions, not generic polish passes or reopened state-model work.

Latest Design inspector + Verify chrome cleanup landed (2026-04-12):

- Design now keeps simulation controls in the primary toolbar and removes the old right-inspector `Live Simulation`, `Board I/O`, and `Signal History` sections; the inspector now reads as identity + actions + properties + `Signal / State` + optional `Details`
- replay still owns the Design top strip: the rebuilt browser path on `2-Bit Up Counter` showed `Replay · t0`, case/tick context in the simulation strip, and no replay/live-sim duplication in the inspector
- Verify post-run chrome is tighter: the redundant `tN` chip beside `Open in Design` is gone, and the `Stimulus Workbench` header now collapses to title + vector count without the old subtitle/status duplication
- targeted validation is complete for this slice: focused Design suites are green (`63` tests), focused Verify suites are green (`52` tests), unified build is green, and rebuilt browser validation is complete on `http://127.0.0.1:4173/os/`

Latest Verify trust cleanup + Windows merge staging fallback landed (2026-04-12):

- live browser validation on rebuilt preview `4175` confirmed the real `2-Bit Up Counter` trace path now stays trustworthy: observation-only runs show `7 vectors`, and clicking `Save as checks` no longer flips the Verify header to `STALE`
- final rebuilt-preview validation on `4178` closed the remaining wording drift: the command strip stays `OBSERVATION ONLY`, while the Stimulus Workbench now says `Saved checks available` instead of the misleading `Observation + compare`
- Verify draft/placeholder render paths no longer emit the tested duplicate-key warnings for repeated `EN`-style display labels; focused regressions now cover both the first-run chips and the latch-control placeholder path
- `merge-dist.mjs` now retries Windows lock-style cleanup and, when canonical `dist/` remains locked by a local process, writes the fresh unified artifact to `dist.staged/` instead of aborting mid-merge
- targeted validation is complete for this slice: focused Verify + merge regressions are green (`78` tests), browser proof is complete, and the real merge entrypoint succeeded with a staged fallback artifact under a live `serve dist` lock

Latest Project surface ASCII CTA cleanup + hierarchy proof landed (2026-04-12):

- the remaining ProjectSurface mojibake is gone from the built UI: live browser proof now shows `Build Submission Package ->`, `Open Mapping`, and starter `Load & Design ->` copy cleanly on the rebuilt preview
- focused Project regressions now explicitly guard landing / recovery CTA copy plus blocker and mapping actions, so browser-facing encoding drift is covered in tests instead of only in manual inspection
- targeted validation is complete for this slice: Project continuity + submission suites are green (`21` tests), playground build is green, and a DOM-level scan of the built Project page found no `Ã` mojibake markers

Latest Verify clock truth + Design replay scrubber slice landed (2026-04-12):

- Verify no longer shows the false `No clock activity detected in your vectors` warning when the effective next run already contains clock activity through mixed project + custom vectors
- normalized clock ids now count as the same authoritative clock in the pre-run warning path, so presentation differences like `Phase Driver` vs `phase_driver` no longer drift that guidance
- Design replay now exposes one central parent-owned scrubber in the simulation strip itself; the real `2-Bit Up Counter` browser path opened at `Case 10 / 11 · t9`, scrubbed back to `Case 9 / 11 · t8`, and still demoted to `Replay stale` immediately after placing `AND Gate`
- targeted validation is complete for this slice: adjacent replay / Verify suites are green (`121` tests), unified build is green, and built-preview browser proof is complete on the sequential example

Latest Design replay strip clarity + shell consistency cleanup landed (2026-04-12):

- the Design simulation strip now carries the replay selection label and sampling meaning directly during replay (`Case 10 / 11 · t9`, `Replay`, `Sampled post-rising-edge on CLK.`) instead of forcing students to combine a generic strip with the debug banner
- replay invalidation still holds in the real UI after this copy change: placing `AND Gate` during replay demotes the surface to `Replay stale — Case 10 / 11 · t9`, returns the strip to live `Tick 0` / `Paused`, and re-enables live controls
- the shared shell no longer renders the global `Focus` / `Done` toggle; later-case replay proof and shell cleanup are validated by focused suites (`31` tests), adjacent Design/shell suites (`75` tests), unified build, and built-preview browser validation

Latest clock authority + cross-app Design consistency slice landed (2026-04-12):

- one active Verify schedule contract now owns pre-run inventory, sequential helper naming, helper insertion, and timing guidance across Verify
- helper/default sequential clocks now use shared absolute sampled-tick parity starting low at `t0`; bring-up sequential generation uses the same shared helper module
- Design live clock narration now resolves from timing guidance plus canonical IO match keys instead of label-regex guessing, so non-regex labels like `Phase Driver` still narrate the authoritative clock
- targeted validation is complete for this slice: focused clock suites are green (`65` tests), adjacent regressions are green (`76` tests), unified build is green, and built-preview browser validation on `2-Bit Up Counter` confirmed appended `CLK` parity `t7=1`, `t8=0`, `t9=1`, `t10=0`

Latest replay trust + causation slice landed (2026-04-11):

- runtime-backed Design mutations that used to bypass replay invalidation - palette placement, IO starter insertion, starter AND insertion, undo, and redo - now all demote replay to stale and return the canvas to live Design state
- sparse authored case chips are now browser-consistent in the live app (`Case 1` .. `Case 5`) even when the real sampled ticks are sparse (`t1`, `t3`, `t5`)
- Design `Signal / State` now shows a replay-only `Why now` cue that summarizes the sampled change, the direct upstream driver label when available, and the next inspect target (`Rose 0 to 1 at t5; upstream path from Q0; inspect LD0 first.`)
- focused validation is complete for this slice: replay/case suites are green (`51` tests), changed-file diagnostics are clean, and browser validation on `lab-workspace/freeplay` confirmed `Replay stale` immediately after real palette placement; package-wide build was not rerun in this continuation

Latest stale-replay + case-index replay semantics slice landed (2026-04-11):

- Design replay now invalidates honestly on real circuit mutation: the old Verify sample is demoted to a stale breadcrumb banner and the canvas returns to live Design state instead of keeping stale authority
- sparse sequential runs now navigate by authored case index across the Verify scrubber and selected-case readouts, while still showing the real sampled tick (`Case N · tX`)
- Stimulus case chips now derive case numbering from authored order, so sparse ticks like `t1`, `t3`, `t5` no longer mislabel themselves as `Case 2`, `Case 4`, `Case 6`
- targeted validation is complete for this slice: focused replay/case suites are green (`62` tests); package-wide `@redbyte/rb-apps` build remains blocked by unrelated pre-existing errors outside the replay files

Latest Design replay-authority slice landed (2026-04-11):

- Design now receives the full Verify run and uses replay-backed values as the current display authority for the simulation strip, inspector snapshots, live state table, and board-signal readouts while debug mode is active
- the Design scrubber now changes visible sampled state instead of only a tick label: fresh browser validation on `2-Bit Up Counter` moved from `Tick 3` / `LD0=0` `LD1=1` to `Tick 2` / `LD0=1` `LD1=0`
- replay mode is now honestly read-only: Run / Step / Reset / Speed are disabled while the surface is frozen on a Verify-authored tick
- targeted validation is complete: focused replay + adjacent Design suites are green (`47` tests), playground build is green, and browser validation confirmed both state propagation and control lockout

Latest alias ↔ board-label presentation slice landed (2026-04-11):

- canonical Verify waveform aliases now remain visible as provenance in Design (`Verify focus q1`) while the inspect target resolves to the structural landing label (`Inspect LD1 first`)
- the `2-Bit Up Counter` browser path now explains the relationship directly in the right inspector: title `LD1 · Input`, subtitle `Verify focus q1`, next step `Verify signal q1 maps here as LD1 · Input...`
- targeted validation is complete: focused Design + Verify suites are green (`39` tests), playground build is green, and fresh browser validation on `q1 @ t3` confirmed the new unified copy end to end

Latest shared selected-signal authority slice landed (2026-04-11):

- Verify now publishes observation-mode auto-selected signal focus and the remaining internal signal-focus fallbacks through the same shared callback used by explicit lane clicks
- Design's simulation strip now turns Verify focus into an explicit target (`Inspect q1 first`) instead of passive linkage copy
- targeted validation is complete: focused Verify + Design suites are green (`15` tests), playground build is green, and browser validation confirmed selecting `q1` in Verify then opening Design shows `Verify focus q1` plus `Inspect q1 first`

Latest shared selected-tick authority slice landed (2026-04-11):

- Verify now owns the canonical post-run selected tick across the waveform, compact readout, Stimulus Workbench case selection, and Design handoff
- Stimulus case selection now updates Verify immediately, waveform stepping now pushes the selected Stimulus case back the other direction, and invalid controlled ticks normalize back to the parent when cases are removed
- targeted validation is complete: focused `StimulusCanvas` + Verify suites are green (`51` tests), playground build is green, and browser validation confirmed `Case 3 (t2)` synced Verify to `t2`, waveform stepping advanced both surfaces to `Case 4 (t3)`, and Design landed in `Debug mode — tick 3`

Latest waveform truth-surface authority slice landed (2026-04-11):

- observation-only Verify runs no longer show visible waveform evidence with zero tick authority; selected tick, compact readout, scrubber, and keyboard navigation now derive from waveform-backed ticks when samples exist
- Verify → Design handoff now syncs the currently focused Verify signal at navigation time, so Design keeps a meaningful Verify focus even when the handoff only has tick snapshot data
- targeted validation is complete: focused Verify suites are green (`41` tests), unified build is green, and browser validation confirmed `21 signals · 7 ticks · COMPLETE`, a live move to `t3`, and Design landing in `Debug mode — tick 3` with `Verify focus q0`

Latest Verify → Design continuity slice landed (2026-04-10):

- Verify now prefers the debug bridge when tick evidence exists, instead of treating Design navigation as a mostly context-free fallback
- the bridge now carries full tick evidence and, when available, failure context (`signal`, expected/actual, pattern summary, next inspect hint)
- Design now visibly acknowledges arrival from Verify by entering a debug landing state with a frozen verification tick and replay controls, rather than only showing a passive banner
- targeted validation is complete: focused `verifySurface.observeFirst` + `designSurface.workstation` suites are green, unified build is green, and browser validation confirmed the visible debug landing state in Design

Next Verify slice should stay on targeted sequential consistency, not broad system cleanup:

1. keep future sequential warning/preflight copy on effective next-run vector authority instead of reintroducing authored-only checks
2. keep replay case selection parent-owned and centered in the Design simulation strip; banner-only replay controls should remain fallback behavior, not the primary control path
3. keep Project / Import / Hardware / Export out of the next sequential pass unless a concrete cross-surface contradiction is found

Latest Verify desktop workbench professionalization slice landed (2026-04-08):

- failed compare runs now keep the Stimulus Workbench open instead of collapsing the editor to a header row
- the always-open inline failure rails were removed from the primary waveform workspace; failure details now live in the secondary analysis drawer
- browser audit at `1366x768`, `1536x864`, `1600x900`, and `1920x1080` confirmed the post-run waveform is meaningfully visible at normal zoom and the case editor remains directly editable
- next Verify slice should stay on row authoring clarity and remaining desktop hierarchy tightening, not drift into Project / Design polish

**Runtime hardening moved from planning into closure work.**

Completed in this batch:

1. fixed the failing `ide-verify-workbench-contract` gate by opening the left verify dock before querying signal rows
2. fixed pipeline strip drift so Map Pins now shows `pass` when required mapping is complete (`RBP1001` absent)
3. captured runtime issue board at `docs/roadmap/RedByte_Runtime_Issue_Board_2026-04-02.md`
4. fixed RIB-003 so PASS waveform now shows mapped input stimulus lanes by default
5. fixed RIB-004 by making the Import ZIP file input intrinsically hidden in markup (no CSS-only hiding dependency)
6. fixed RIB-007 by exposing first-look quick sample demos (including blocked behavioral examples) without hidden workbench-only navigation
7. fixed RIB-008 by aligning first-look manual-path guidance copy with the now-visible quick-demo actions
8. fixed RIB-009 by wiring the behavioral-import blocker CTA to actual Design navigation (label/route contract now truthful)

Immediate sequence:

1. clean-tree classroom signoff is now confirmed (`CLASSROOM_READY`)
2. continue remaining product-hardening slices from gap audit / product contract tracks, not generic chrome work
3. keep runtime board current as new live defects are discovered

Pre-lab audit override (2026-03-29):

- Do not spend the next batch on more Design chrome polish until the student path is trustworthy.
- Completed in this batch:
  - loaded blank-origin projects now use truthful `Fresh Project` framing instead of `Blank Project`
  - boundary IO rows now normalize to student-facing labels (`Input N` / `Output N`) and restored vectors rekey to those sanitized ids
  - draft Verify trace sessions now frame the work as a runnable testbench instead of generic simulation
  - Verify first-run CTA readiness now follows the real vector authority, so custom-vector sessions no longer hide the primary run action
  - classroom signoff harness now exports shared starter loading, idle Design keeps `Live Simulation` directly reachable, and repo-status gate contracts have been realigned to current product truth
  - `node .\scripts\repo-status.mjs` now returns `39/39 checks passed`, and `pnpm -s classroom:signoff --allow-dirty` now returns `10/10 checks passed` / `CLASSROOM_READY`
- Remaining pre-lab blockers confirmed by live audit + signoff:
  - live hardware remains unproven in this environment (`classroom:hw:check` reports bridge unavailable / Basys3 unknown)
  - strict clean-tree classroom signoff still needs a clean working tree before operator use without `--allow-dirty`

Pre-lab must-fix order:

1. live Basys3 rehearsal on the actual bridge/toolchain setup
2. rerun `classroom:signoff` from a clean working tree before release / classroom handoff

Canonical next-phase roadmap:

- `docs/roadmap/redbyte-classroom-gap-handoff.md`

Gap audit and product contract (2026-04-01):

- `docs/roadmap/RedByte_Gap_Audit.md` — brutally honest product-legitimacy audit. 14 gaps identified, scorecard produced. Screenshot freeze: **not approved**.
- `docs/contracts/RedByte_Product_Contract.md` — target-state blueprint defining what RedByte must become. Separate from the current-state Product Manual.
- Two-layer truth model established: current-state docs (manual, traceability, conformance) stay factual; target-state docs (product contract) stay aspirational but testable.
- Key findings: README claims OS-era features (3D editing, time-travel debugging). Manual overclaims 6+ non-existent features. Sequential path boundaries (falling-edge, multi-clock, active-low reset) are detected but not blocked. Design-time circuit errors (driver conflicts, combinational loops, floating drivers) only surface at export time.

P6 verify workflow legitimacy — Phase 6A landed (2026-04-01):

- Assertion mismatches now keep the student in Verify first. Fail-state CTAs expose `Edit expected outputs` from both the fail hero and mismatch panel.
- `Open in Design` remains available for live logic defects, but it is no longer the only recovery path for assertion-backed failures.
- Stale verify evidence remains explicitly distinct from failure. Stale authored references stay on rerun / re-author / keep-reference actions rather than collapsing into generic FAIL guidance.
- Unsupported verify setups remain design-side problems and continue to surface an `Open Design` recovery path instead of pretending the testbench is fixable in Verify.
- Targeted render coverage now guards: Verify-first mismatch recovery, stale-state messaging, unsupported routing, and sequential timing guidance.

P6 waveform / oscilloscope legitimacy — first slice landed (2026-04-01):

- The assertion overlay now inherits the live waveform `tickWidth`, so zooming the oscilloscope no longer leaves expected/observed cells on a stale 48 px grid.
- Fail-window investigation now renders the assertion overlay against `zoomedTicks`, not the full timeline, so the evidence panel describes the same visible window as the waveform itself.
- Targeted coverage now guards both parts of this contract: AssertionCanvas runtime geometry and VerifySurface fail-window tick sync.

P6 waveform / oscilloscope legitimacy — second slice landed (2026-04-01):

- The waveform frame now removes redundant chrome bands: no signal digest strip, no in-frame tick explainer, no legend strip, and no cursor readout table competing with the traces.
- The idle ghost viewport now sizes to the real container width and drops the fixed-width `ARMED · AWAITING RUN` treatment.
- Fail-window emphasis is stronger directly in the scope, so mismatch regions are easier to spot before opening any side panels.
- Targeted workstation coverage now guards the subtractive chrome contract so those bands do not quietly reappear.

P5 design editor legitimacy landed (2026-04-01, commit 006c571c):

- **Drag undo granularity fixed**: RAF-batched node moves now use `isIntermediate: true`, skipping `emitCircuitMutation`. New `handleNodeMoveCommit` fires once at pointer-up (cancels pending RAF, commits with `isIntermediate: false`). One undo entry per drag, not ~120.
- **Wire preview aligned to port**: Preview line now starts at ±24 world-unit port offset (uses `isInputPort()` from wireValidation.ts) instead of node body center.
- **Deletion feedback counts cascade wires**: Keyboard Delete shows "Removed 2 nodes and 5 wires." via `onDeleteFeedback` prop wired to `setActionToast` in DesignSurface.

P6 export/hardware legitimacy — GAP-007 closed (2026-04-01, commit 7e152e14):

- **Export header pill now three-state**: `exportTrusted → Ready (green)` / `downloadReady && !trusted → Available (warn)` / `blocked → Blocked (error)`. No longer shows green "Ready" when verify has not passed.
- **Callout title/body per-state**: "Verify has not run" / "Verify is stale" / "Assertions differ" with specific, plain body text. Was generic "advisory compare state".
- **8 new tests** in `projectHealth.test.ts`: all four verify states via `deriveProjectVerifyState` + `hasCurrentPassingVerify` authority contract.

P6 export/hardware legitimacy — initial slice landed (2026-04-01, commit 404c44a8):

- **Preview README rewrite**: `basys3Bundle.ts:buildReadme` was describing a manual "Create new RTL project" Vivado setup that does not match the actual ZIP format (a pre-configured project folder). Now describes the correct "Open Project" workflow with the right artifact list. Golden SHAs for both golden export tests regenerated.
- **Tool version aligned**: ExportSurface was showing `Vivado 2024.1+` while the project folder targets `2024.2+`. Fixed display string.
- **Test ID dedup**: `ide-export-vivado-command` was on 4 elements across 3 render branches; now only on the actual command element.
- **Regression test**: `basys3-bundle-gate.test.ts` now asserts README contains "Open Project" and not "Create a new RTL project" (5/5 passing).
- Remaining open: GAP-013 (live Basys3 rehearsal proof). GAP-014 clean-tree discipline is validated; current clean-tree signoff blocker is bounded to repo-health execution timeout (`pnpm -s repo:status` hit the 600000ms signoff command timeout), not dirty-tree ambiguity.
- GAP-014 mitigation landed: `classroom:signoff --allow-dirty` is now explicitly degraded (`DEV_BYPASS_ONLY`) and can no longer emit `CLASSROOM_READY`.

Gap audit updated: Phase 6 initial slice complete. Next: Phase 6 remaining (GAP-007, 008, 013, 014).

P4 design-time canvas health landed (2026-04-01):

- README.md — complete rewrite removing OS Genesis branding, 3D editor claims, time-travel debugging, automatic bug localization, wrong dev commands, wrong test count (433→220), Student Portal URL, Logic Playground workflow. Replaced with accurate six-surface IDE description.
- Product Manual — removed 6 overclaims: Export Grading Report, verify replay, FPGA Bridge troubleshooting section, RB Lab ZIP section, LogicPlaygroundApp/LabWorkspaceApp as standalone contexts. Fixed undo history 50→100 levels. Expanded keyboard shortcuts from 5 to 24 (3 sections verified against KeyboardShortcutsModal.tsx).
- Print HTML — matching changes to HTML companion.
- DOC_INDEX.md — complete rewrite. Two-layer truth model documented. Stale/OS-era docs explicitly marked. Product contract + gap audit sections added.
- Note Schema — added `hardware`, `import`, `project` to area field values.
- Canonical Notes Policy — added ADR-002, 5 missing architecture notes, product contract section.

Next: P1 sequential boundary enforcement / trust restoration (not visual polish).

Latest completed documentation work:

- `2026-04-01` — Product manual hardened to verified state. 9 factual corrections applied to both `.md` and `.html`. PDF regenerated (408 KB). 6 architecture SVG diagrams created. Traceability matrix (49 claims), conformance governance doc, and claim audit doc produced. Manual wired into README.md and DOC_INDEX.md. `pnpm docs:manual:pdf` build script added.

  Corrections applied (source-verified):
  - `constraints.xdc` → `top.xdc` (basys3Bundle.ts L191)
  - `top_tb` → `tb_top` (testbenchGenerator.ts L292-293, vivadoProjectFolder.ts L36)
  - "Write HDL" → "Paste HDL" (ImportSurface.tsx L1990)
  - "up to 7 hints" → "14 diagnostic conditions" (verifyHints.ts L48-121)
  - NOR/XNOR removed from active palette list; noted as type-defined but unregistered
  - COMPONENT_MAP: "26 types" → "37 HDL name variants → 9 node types"
  - VHDL keyword validation claim removed (not implemented)
  - SubmissionInspectorApp: clarified as architectural context, not separate launch target
  - ZIP contents: expanded from 3 to 9 files

Latest completed classroom-trust slices:

- `2026-03-30` - Basys3 export now treats every switch/button input as non-clock in XDC and sanitizes label-derived top ports into Vivado-legal identifiers; real Vivado routed a six-case matrix (`signal-tour`, `two-bit-counter`, `DLatch`, `DFF`, `TFF`, `JKFF`) after regeneration.
- `2026-03-30` - exported entity-based testbench generation now resolves stable ids and Basys3 pin-derived aliases onto declared entity refs; the live browser export for the blank AND circuit now emits `SW(0)` / `SW(1)` stimulus and compiles cleanly under Vivado `xvhdl`.
- `2026-03-29` - bottom console/footer demotion landed; quiet Design now hides the empty workbench console, keeps diagnostic access when warnings/errors exist, and reduces the footer to a readiness-only signal.
- `2026-03-29` - blank-project truth + boundary-label cleanup landed; loaded scratch projects now present `Fresh Project`, unlabeled/legacy boundary IO rows promote to student-facing labels, and restored vectors rekey to sanitized IO ids.
- `2026-03-29` - first-run Verify draft sessions now use testbench language for trace authoring, and the first-run footer uses total live vector authority so custom-vector sessions still surface the primary run CTA.
- `2026-03-29` - classroom signoff proof recovered; shared starter loading, idle Design live-simulation reachability, and gate-truth alignment now drive `repo-status` and dirty-tree `classroom:signoff` green again.

Latest product-hardening completions (2026-04-06):

- workflow spine + shared step authority alignment landed in the shared `projectWorkflowAuthority` path
- Design-surface interaction landed its first contract slice through sequential inspector hardening
- Hardware / Export failure truth now uses one dominant status / CTA taxonomy across both surfaces
- Project overview boot truth is restored: `ide:gate:project-overview-contract` now passes after fixing the `primaryProjectCta` boot-order crash in `IdeApp.tsx`
- repo hygiene pass split the dirty Verify/import UI workstream out of the active branch before starting Project work
- Project loaded-state readability and next-action hierarchy landed:
  - the loaded hero now owns one dominant `Next step`
  - source / determinism / import fidelity moved into the visible loaded-project reference card
  - Mapping / Verify / Export now render as one three-card workflow snapshot instead of competing CTA rows
- `pnpm repo:status` is now blocked by `IDE Evidence Capsule Contract`, not by Project overview boot/render failure

Latest design-rescue completions (2026-04-07):

- confirmed `feat/design-phase-b-editing-power` is the canonical Design rescue line; the adjacent rescue branches are already contained ancestors, so no history rewrite or rescue-branch merge was required
- hardened grouped selection capture so box-select now works by standard node-body overlap instead of node origin only, and additive marquee preserves the current group
- focused Design validation now proves the trusted loop end-to-end: bounds-aware marquee -> grouped selection -> Arrow-key nudge / duplicate / delete continuation
- landed the first grouped layout cleanup actions in Design: the multi-select inspector now exposes `Align left` and `Align top`, both reusing the existing mutation path and preserving the selected group
- landed the first simple tidy pass in Design: the multi-select inspector now exposes `Distribute horizontally`, which uses current left-to-right order while keeping endpoints anchored

Merge-path hardening (2026-04-08):

- PR merges to `main` are branch-protected by the `Classroom Truth Gates` workflow; the required runner path was failing for infrastructure reasons because `classroom:gate` invokes Playwright-backed IDE gates without installing Playwright browsers first
- local fix staged: `.github/workflows/pr-truth-gates.yml` now installs Chromium via `pnpm exec playwright install --with-deps chromium` before the classroom loop
- release implication: required PR truth gates should now measure product truth instead of failing early on a missing-browser runner setup
- gate alignment sweep completed on the canonical rescue branch: the current classroom gate set now follows the real student-facing surfaces instead of stale selectors / stale artifacts
  - Design gates now enter through Project truth (`Build Fresh` / current starter loader), expand live-input controls when needed, and use the current dense-canvas / LOD behavior
  - Verify gates now follow the current single-Run header contract and left-dock signal workflow
  - Export gates now follow the current artifact tab naming, Vivado project ZIP layout, and preview-vs-ZIP wrapper rules
- final PR review-blocker fix is now staged locally on the canonical branch:
  - Verify `Edit expected outputs` no longer relies on mutating `details.open`; the post-run Stimulus Workbench is now opened through explicit React state so the editor body always mounts when the CTA is used
  - the misleading `verifyMode` combinational-hint test label was corrected
- local release signoff for the required merge gate is now confirmed again:
  - `pnpm -s classroom:gate` -> PASS all steps
- focused Verify regression check after the review-blocker fix:
  - `pnpm exec vitest run packages/rb-apps/src/apps/ide/__tests__/verifyMode.test.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.workstation.test.tsx` -> 44 tests passed
- main-first Verify follow-up after the live deploy smoke:
  - the waveform placeholder no longer renders its own `Compare` button once vectors already exist; it now points students back to the header run control so the case editor and command bar stay canonical
  - focused Verify suites (`verifyFirstRunUsability`, `verifySurface.frontend-dedup`, `verifySurface.workstation`) now cover that dedup path end to end
  - local `pnpm -s classroom:gate` still passes after the dedup change
- immediate repo-steward next action:
  - land the main-first Verify dedup follow-up on `main`, let Cloudflare redeploy, then continue the case-editor clarity / canonical authoring workspace sweep

Use its recommended implementation order:

1. **Workflow spine + shared step authority** - Project, left rail, pipeline strip, headers, and CTAs must agree on done / blocked / next / why
2. **Design-surface interaction** - editor legitimacy for wires, selection, undo/redo, dense circuits, and sequential authoring
3. **Hardware/export failure truth** - actionable failure taxonomy, recovery paths, and artifact/readiness clarity
4. **Onboarding / empty-state** - first-run clarity, required vs optional steps, and known-good starter authority
5. **Sequential / clocked trust** - consistent timing language and proof across Verify, Export, and Hardware

Examples, starters, and classroom ops should ride inside those tracks as proof obligations, not as separate top-tier roadmap lanes.

Next product-hardening action:

- B-12 Slice 4 landed (2026-04-08, commit a3183711): one canonical failure path. `ScenarioBuilderPanel` postrun section converted to `<details ref={detailsRef}>` + `<summary className="ide-verify-scenario-builder-summary">`. `initialExpanded` prop: true for confirmed-pass non-trace runs, false for fail/trace (fail evidence takes focus). `handleEditExpectedOutputs` sets `details.open = true` for fail-state recovery CTAs. All 77/77 verifySurface tests GREEN.
- B-12 complete across all 4 slices. Continue Design Phase B: B-11 (Distribute Vertically) or next verify polish

---

## Session workflow

```
Start -> [[Session Startup Checklist]]
Work  -> [[Claude Session Mode]]
Tests -> [[Post Run Extraction]]
End   -> [[Session Shutdown Checklist]]
```

---

## Install status

| Item | Status |
|---|---|
| `CLAUDE.md` | Present in repo root |
| `redbyte-obsidian-maintainer` skill | Installed at `.claude/skills/redbyte-obsidian-maintainer/SKILL.md` |
| Dataview plugin | Needs install in Obsidian |
| Workspaces | Create: Verify Debug - Export + Vivado - Architecture + Planning |
| Post-test hooks | Not yet - use checklists manually first |

Full install order: [[Operational Readiness Review]]

---

## Test baseline (2026-03-26) - 168 pure-logic passing + 52 render passing (all green)

```
export-authority-chain-contract  49   signal-inventory-contract   18
invalidation-contract            10   buildVerifySessionViewModel  5
projectRuntime.verify-authority  15   verifyHints                 16
verifyScenario                   30   diagnostics.contract         4
basys3-port-lint                  2   basys3-port-naming-phase1   10
audit-determinism                 1   verifyContract.reset         8
```

Render harness (13 suites, 89 tests green):

- `verifySurface-fail-state` 3 - `verifySurface.failure-context` 2 - `verifySurface.authoring` 11
- `verifySurface.three-panel` 3 - `verifySurface.workstation` 30 - `verifySurface.hints-bridge` 3
- `verifySurface.failure-patterns` 5 - `verifySurface.waveform-priority` 1 - `verifySurface.combo-kmap-provenance` 1
- `verifySurface.entryState` 7 (added B-12 Slice 2) — 77 total GREEN after B-12 Slices 1–4
- `verifySurface.frontend-dedup` 7 (5 Phase 2 + 2 Phase 3) — 84 total, all GREEN after B-13 Phase 3
- `verifySurface.caseEditorClarity` 5 (added B-14 Slice 1) — 89 total, all GREEN after B-14 Slice 1

B-13 Phase 1 (commit 2e3f1f49): `VerifyResultRegion` wraps orphaned float zone. 4-region layout: Header → Result → Stimulus → Waveform.
B-13 Phase 2 (commit 2cdcf25d): Verify frontend dedup. Canonical Run = `ide-vcb-run` (VerifyCommandBar). Canonical sequential helper = `ide-verify-sequential-helper`. Removed `ide-vfr-run`, `ide-vfr-seq-presets`, `ide-verify-workbench-run`.
B-13 Phase 3 (commit b89959c0): Run ownership complete. Removed `ide-verify-run` from ScenarioBuilderPanel first-run footer. `ide-vcb-run` is now the only Run action in Verify. Workstation tests migrated to `ide-vcb-run`.
B-14 Slice 1 (commit 05514e78): Case-editor clarity. `VerifyFirstRunPanel` suppressed when `totalVectorCount > 0` — hero yields to canvas once vectors exist. Students no longer scroll past orientation panel to reach editable StimulusCanvas.

---

## Architecture map

**Active:** [[Design Surface]] - [[Project Surface]] - [[Verify Engine]] - [[Connection Model]] - [[Verify Hint System]] - [[Test Infrastructure]] - [[Note Schema]] - [[Workspace Routing]] - [[Automation Strategy]]

**Stubs (expand when touching):** [[Export Contracts]] - [[Signal Inventory]] - [[Authority Chain]] - [[Bridge Protocol]] - [[Basys 3 Mapping]]

**Decisions:** [[ADR-001 Enforce Structured Connection Format]] - [[ADR-002 Truth Table Selection Does Not Auto-Switch Tabs]]

**Recent export truth fixes (resolved 2026-03-26, preserve and do not reopen):**
- [[BUG-013 Basys3 Export Port Sanitizer Produced Vivado-Illegal Identifiers]] - Basys3 export now collapses separator runs and trims edge underscores before label-derived names reach `top.vhd` / `top.xdc`; the shipped `two-bit-counter` example now synthesizes and routes in real Vivado (`2026-03-30`)
- [[BUG-012 Basys3 Switch and Button Clock Buffer Inference]] - switch/button input ports now always emit `CLOCK_BUFFER_TYPE NONE`, and real Vivado implementation now routes switch-driven `DLatch` / `DFF` / `TFF` / `JKFF` matrix cases without `Place 30-574` (`2026-03-30`)
- [[BUG-011 Export Testbench Stable-ID Stimulus Drift]] - entity-based export now resolves stable vector ids against declared entity refs and blocks undeclared stimulus/assertion targets (`2026-03-30`)
- [[BUG-007 Export Verify Gate Tone Mismatch]] - stale-after-pass export state is advisory `STALE`, not a red blocker (`b5cf70c7`)
- [[BUG-008 Export Vivado Steps Mismatch Download Label]] - visible Vivado steps now prioritize the normal Open Project flow (`849eca4f`)
- [[BUG-009 Export RBEV Diagnostics Shown When Blocked]] - advisory RBEV evidence no longer appears inside hard-blocker lists (`88d7a30f`)
