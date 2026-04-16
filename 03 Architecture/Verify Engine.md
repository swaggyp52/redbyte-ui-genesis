---
type: architecture
status: active
area: verify
updated: 2026-04-15
related:
  - "[[Design Surface]]"
  - "[[Verify Design Loop]]"
  - "[[Verify Hint System]]"
  - "[[Connection Model]]"
  - "[[Test Infrastructure]]"
  - "[[ADR-005 Verify Schedule Contract Owns Sequential Clock Authority]]"
  - "[[BUG-003 React.act Infrastructure Failure]]"
  - "[[BUG-004 Verify Hash Includes Non-Circuit Fields]]"
  - "[[BUG-006 TRACE vs VERIFY Mode Collapse]]"
  - "[[BUG-016 Verify Workspace Nested Grid Collapse]]"
  - "[[BUG-015 Verify Missing-Clock Warning Ignored Effective Next-Run Clock Activity]]"
  - "[[BUG-014 Design Replay Missed Runtime-Backed Mutations]]"
  - "[[2026-03-25 Verify Refactor Plan]]"
---

# Verify Engine

Full reference for the Verify pipeline: how a run is triggered, what it computes, where truth comes from, and where the current implementation still diverges from the intended model.

## Overview

Verify currently spans three layers:

1. `projectRuntime.ts` + `sim/simEngineCore.ts` own the actual deterministic run.
2. `buildVerifySessionViewModel.ts` defines the intended student-facing session model.
3. `IdeApp.tsx` + `surfaces/VerifySurface.tsx` decide which hash, vectors, and banners the student actually sees.

The deterministic engine itself does run against a fresh circuit + IO snapshot. The weak spots are the layers above it: freshness is still computed in multiple ways and the scenario/session model is only partially live outside the normal shell path. The latest Phase 6 slice made the remaining local Verify toggle explicit authoring intent: `VerifySurface` now uses `nextRunUsesAssertions` for next-run copy/preflight/wiring, while current-run meaning stays on `VerifySessionStatus` plus persisted `runKind`. `READY` / `BLOCKED` now survive only as a draft-only presentation shim.

The latest manual-event sequencer-authority slice made step intent first-class in the runtime workflow:

- `VerifyScenario` now supports persisted typed `steps[]`, and runtime verification now treats those steps as authoritative when present (vector rows remain compatibility fallback)
- manual-event Verify now exposes inline step editing controls (kind, target, value, expected, label, duration, pulse behavior) with reorder and delete operations
- runtime scenario actions now support append, update, move, and delete for scenario steps, and those edits flow through the same deterministic compatibility-vector materialization path
- per-step internal-state observation now includes register/state-bank detail cards for selected ticks, not only summary counts

The latest Lab 8 classroom-readiness slice hardened one remaining sequential authoring seam for manual-clock labs:

- checkpoint truth tables can still declare `clocked_macro`, but ordinary IDE Verify does not synthesize those ENTER pulses automatically for real clock inputs like `sw_enter`
- Lab 8 starter vectors therefore ship as explicit authored rows: reset bring-up first, then `0,1,0` ENTER pulses for each serial bit, with `LOCK` expected high only after the final pulse completes
- this keeps the starter visible and runnable in Verify without inventing a second sequential runtime contract that disagrees with the proven checkpoint path

The latest Verify starter polish slice improved the student-facing generate experience for sequential labs:

- `buildStimulusOnlySequentialVectors` now generates 12 ticks (was 8) — covers a full 12-bit Lab 8 stream with the first 2 ticks as reset bring-up
- the `Generate starter` label no longer claims a specific tick count (was `Generate 8-tick starter`) — avoids confusion when students need a different number of rows
- the VerifyFirstRunPanel sequential hero copy now explicitly tells students to edit input values for their specific bit sequence, rather than implying the generated pattern is ready to run
- Lab 8 example (`23_lab8-fsm-lock-starter-basys3.json`) now ships 3 checkpoints: invalid path (110010010100), valid1 (010100010100), valid2 (100010100010)

The latest hard visual / interaction architecture pass then made the browser-visible Verify surface read as one integrated lab instead of a stack of internal tools:

- the command bar is now the sole session authority in normal pre-run and post-run states; the old full-width post-run status strip is gone from active sessions
- the left dock now presents a `Signal guide` / `Waveform lanes` structure with concise summary copy and compact lane actions, instead of reading like a secondary tooling palette
- the `Stimulus Workbench` header now centers authored stimulus, selected case/tick context, and the essential actions; generated-starter notices sit below the header instead of inside it
- rebuilt browser validation on `http://127.0.0.1:4179/os/` confirmed the visible result: observation sessions show one command bar, one compact workbench header, one waveform stage, and no redundant top status slab

This means Verify post-run hierarchy is now explicit and student-legible: command bar for session status/actions, workbench for authored stimulus, waveform for evidence, signal rail for guided lane access.

The latest Design ↔ Verify continuity slice made the cross-surface debug handoff materially real instead of banner-only:

- `VerifySurface` now prefers the debug bridge callback when tick evidence exists, rather than silently falling back to generic Design navigation
- the handoff now carries a concrete tick snapshot plus failure context (`signal`, `expected`, `actual`, `patternSummary`, `nextInspect`) when the selected tick is part of a failing run
- `DesignSurface` now treats that handoff as an active debug landing state: the canvas enters verification-tick replay, the bridge can auto-trace the linked signal fan-in, and the failure brief can show the incoming pattern summary
- browser validation on the built preview confirmed the visible part of this contract: `Open in Design` from Verify lands in Design with `Debug mode — tick 0`, a frozen verification tick, and step controls instead of a silent surface switch

This closes the earlier contradiction where Verify could technically send context to Design, but Design did not visibly acknowledge that arrival strongly enough to feel like one debugging loop.

The latest Verify trust-cleanup slice then closed the remaining save/capture contradiction inside Verify itself:

- observation-only trace runs now report evidence counts from the real run vector set, so live waveform evidence no longer appears alongside a misleading `0 vectors` badge
- replay freshness now separates stimulus truth from expected-output authoring: `IdeApp` computes a replay-specific hash from circuit + stimulus + mapping, and `projectRuntime` persists `scenarioStimulusHash` with each run
- the save/capture path now compares normalized authored vectors against actual run vectors when deciding whether the visible waveform is stale, so `Save as checks` does not immediately invalidate the same trace evidence
- the post-run Stimulus Workbench now labels hidden saved checks as availability (`Saved checks available`) instead of implying active compare mode, so it no longer contradicts the command strip during observation-only capture sessions
- starter/example alias normalization now feeds that replay hash, so label differences like board-facing names versus canonical ids do not create fake stimulus drift after capture
- first-run and placeholder Verify surfaces now tolerate repeated display labels like `EN` without emitting duplicate-key warnings; placeholder lanes also deduplicate clock/input overlap so latch-control guidance does not render the same lane twice

This means Verify now treats one trace session as one coherent truth object: run evidence counts, waveform freshness, and capture-side UI all stay aligned unless the student actually changes the stimulus or the circuit.

The latest Verify chrome-compaction slice then removed the remaining post-run duplication between the command bar and the workbench header:

- `VerifyCommandBar` no longer shows a separate `tN` chip beside `Open in Design`; the bridge action stays available, but tick authority remains with the waveform/readout and Design replay strip
- the post-run `Stimulus Workbench` header now collapses to the title plus vector count only; the old subtitle and `Observation only` / `Saved checks available` pill were removed because that meaning already lives in the command bar and waveform context
- built-preview validation on `2-Bit Up Counter` confirmed the post-run header now reads as one compact disclosure (`Stimulus Workbench`, `8 vectors`) while the command bar remains the sole visible status authority (`OBSERVATION ONLY`, `8 vectors`, `Open in Design`)

This means Verify post-run chrome now has one authority per concept: command bar for session status/actions, waveform for evidence, workbench for authoring.

The latest waveform truth-surface authority slice closed the next contradiction inside that loop:

- `VerifySurface` now treats waveform-backed ticks as the primary selected-tick authority whenever waveform samples exist; compare-row ticks remain the authority for row-indexed evidence tables, not for the visible waveform controls
- selected tick initialization, cursor seeding, step navigation, scrubber range, compact tick count, and waveform keyboard navigation now stay aligned with the same tick source the waveform is actually rendering
- Verify → Design handoff now syncs the currently focused Verify signal at navigation time, so observe-only runs can still preserve a meaningful signal target even when no mismatch-context packet exists
- browser validation on the built preview confirmed the concrete symptom is gone: an observation run now reports `21 signals · 7 ticks · COMPLETE`, moved cleanly from `t0` to `t3`, and `Open in Design` landed in `Debug mode — tick 3` while preserving `Verify focus q0`

This means the waveform pane now owns a coherent contract again: if the student can see a sampled trace, Verify must also expose a selected tick, an honest tick count, and a Design handoff that refers to that same moment.

The latest shared selected-tick authority slice closed the remaining split between the Stimulus Workbench and that waveform contract:

- `VerifySurface` remains the canonical owner of the currently selected observation tick after a run, and `ScenarioBuilderPanel` now passes that tick into `StimulusCanvas` instead of letting the testbench editor keep a separate local selection
- the selected case chip, case selector, case-header selection, paint interactions, waveform scrubber, compact tick readout, and Design handoff now all refer to the same selected tick when Verify evidence exists
- `StimulusCanvas` still supports standalone uncontrolled use, but when it is controlled and the authored case set shrinks, it now normalizes the selected tick back to the parent instead of silently falling back locally
- browser validation on the rebuilt preview confirmed the shared-model behavior directly: selecting `Case 3 (t2)` in Stimulus updated Verify to `t2`, stepping the waveform advanced both to `Case 4 (t3)`, and `Open in Design` landed in `Debug mode — tick 3`

This is the first slice where Design and Verify visibly behave like two views into the same simulation moment rather than a waveform view plus a loosely related testbench editor.

The latest shared selected-signal authority slice then closed the remaining signal-level drift inside that same loop:

- `VerifySurface` now routes observation-only auto-selection and the remaining internal signal-focus fallbacks through the same `handleSignalSelect(...)` bridge used by explicit lane clicks
- that means `IdeApp` receives live Verify signal focus as soon as Verify chooses it, instead of only learning it during explicit Design handoff or manual lane selection
- `DesignSurface` now uses its existing simulation-story strip as an action cue, not just a linkage badge: the strip still states `Verify focus q1`, but the paired pill now says `Inspect q1 first`
- browser validation on the built preview confirmed the visible end-to-end contract: selecting `q1` in Verify for `2-Bit Up Counter` and opening Design produced `Verify focus q1` plus `Inspect q1 first`

This closes the last obvious gap between shared tick authority and shared signal authority: the selected simulation moment and the selected signal target now travel together as live Verify context.

The latest Design-side signal inspection maturity slice closed the remaining real-app handoff gap inside that contract:

- `VerifySurface` already published canonical waveform aliases like `q1`, but `DesignSurface` was only resolving IO labels like `LD1` or already-qualified runtime keys like `q1_out.in`
- `DesignSurface.resolveVerifyLinkedSignalKey(...)` now treats IO row ids as first-class aliases, so canonical Verify signal names can bind to real Design signal keys during live handoff
- browser validation on `2-Bit Up Counter` confirmed the full loop now lands in Design with strip-level Verify context (`Verify focus q1`, `Inspect q1 first`) and a real right-inspector landing (`LD1 · Input`, subtitle `Verify focus`) instead of the previous idle `Nothing selected` card

This means shared selected-signal authority is no longer only a top-strip cue: canonical Verify aliases now arrive in Design as actionable inspection state.

The latest alias ↔ board-label presentation slice then made that shared signal authority legible instead of merely correct:

- Design now keeps the canonical Verify alias as the provenance label (`Verify focus q1`) while resolving the compact inspect target to the structural landing label (`Inspect LD1 first`) when the names differ
- the signal-only inspector subtitle now repeats the carried Verify identity (`Verify focus q1`) instead of falling back to an unqualified provenance label
- the signal-only inspector next-step copy now teaches the alias/board relationship directly (`Verify signal q1 maps here as LD1 · Input`) rather than making the student infer it from strip copy plus title copy
- browser validation on the built preview confirmed the real `2-Bit Up Counter` handoff (`q1 @ t3`) now reads as one continuous explanation across Verify and Design: provenance `q1`, inspect target `LD1`, inspector title `LD1 · Input`

This means the shared selected-signal loop is now both technically unified and student-legible: Verify remains the canonical signal owner, while Design makes the structural landing explicit without discarding the logical alias that brought the student there.

The latest Design replay-authority slice then made that shared tick/signal contract the actual display truth inside Design instead of a banner-only overlay:

- `IdeApp` now passes the active `verifyLastRun` into `DesignSurface` as `replaySession`, so Design has waveform history and run metadata from the same authored Verify session that produced the debug snapshot
- `DesignSurface` now treats replay-backed values as the current authority for the simulation strip, summary copy, live state table, signal snapshot cards, sequential inspector context, and board-signal readouts whenever Verify replay is active
- the Design scrubber now changes the visible sampled circuit state instead of only changing `Debug mode — tick N`; fresh browser validation on `2-Bit Up Counter` moved from `Tick 3` with `LD0=0 / LD1=1` to `Tick 2` with `LD0=1 / LD1=0`
- replay mode is now honestly read-only: Run / Step / Reset / Speed are disabled while Design is frozen on a Verify-authored sample, so the hidden runtime engine cannot drift away from the state the student is inspecting

This closes the remaining contradiction in the Verify -> Design loop: Design is now a structural replay/inspection view of the authored testbench at tick `t`, not a live runtime surface with replay copy layered on top.

The latest stale-replay invalidation + case-index replay semantics slice then closed the next trust gap around that replay model:

- `DesignSurface` now treats replay evidence as revocable instead of perpetual: any real circuit mutation during active replay clears external replay authority immediately and replaces it with a local stale breadcrumb banner
- that stale banner keeps the last meaningful Verify context (`Case N / M · tX`, last focused signal, and sequential timing hint) but the canvas itself returns to live Design state, so stale evidence no longer keeps driving the simulation strip or board-state readouts
- `VerifySurface` now models the waveform scrubber as authored case-position navigation rather than raw tick navigation; the control range is `0..N-1`, while each position still maps back to the real sampled tick for the actual replay state
- `StimulusCanvas` now derives case numbering from the ordered authored tick set instead of `tick + 1`, so sparse sequential authored cases stay aligned across case chips, selected readouts, and replay navigation

This means the replay contract is now both authoritative and falsifiable: Verify may own the sampled state while replay is active, but Design stops trusting that state as soon as the student changes the circuit, and sparse tick timelines are narrated in authored case order without hiding the true sample tick.

The latest replay-trust hardening slice closed the missed runtime-backed mutation seam and added a compact Design-side causation cue:

- runtime-backed Design actions that actually change the circuit - palette placement, IO starter insertion, starter AND insertion, undo, and redo - now all flow through the same replay invalidation seam instead of leaving replay falsely authoritative
- `StimulusCanvas` case-strip headers now stay aligned with authored-order case semantics in the live app, so sparse runs show `Case 1 .. Case 5` while Design/debug banners still preserve the true sampled tick (`Case 4 / 5 · t5`)
- the Design `Signal / State` card now adds a replay-only `Why now` row that summarizes the sampled change (`Rose`, `Fell`, or held state), direct upstream driver labels when available, and the next inspect target from Verify-linked context
- live browser validation on `lab-workspace/freeplay` confirmed the concrete student path: `Case 4 (t5)` opened in Design as replay, showed `Why now`, and a real palette placement immediately demoted the view to `Replay stale` while re-enabling live controls

This tightens the replay claim above: replay invalidation is now true even for runtime-backed mutation paths that previously bypassed `emitCircuitMutation()`, and Design now explains sampled state inside the existing inspector instead of asking the student to infer it from raw timing rows alone.

The latest clock-authority + Design consistency slice then unified sequential clock semantics across Verify authoring, helper generation, and Design narration:

- `VerifySurface` now resolves one active `VerifyScheduleContract` from live-contract evidence plus the most relevant last-run contract, instead of letting pre-run inventory, helper buttons, and placeholder copy drift across separate heuristics
- the new shared `clockAuthority.ts` module now owns helper vector generation: alternating/default sequential clocks follow absolute sampled-tick parity starting low at `t0`, and the canonical rising edge is `0 -> 1`
- `bringupArtifacts.ts` now reuses that same helper policy, so starter sequential timelines and Verify helper buttons can no longer diverge on parity
- `DesignSurface` now resolves its live clock pill from contract-backed `timingGuidance` and canonical IO match keys rather than `/clk|clock/i` label guessing; non-regex labels such as `Phase Driver` still narrate the correct authoritative clock

This closes the remaining clock-semantics split inside the shared Verify -> Design loop: one schedule contract authors the clock, one helper policy generates default clock values, and one sampled case/tick meaning travels across Verify and Design.

The latest Verify clock-truth + Design replay scrubber slice then closed the remaining real sequential contradiction in that browser path:

- `VerifySurface` now computes the missing-clock warning from the effective next-run vector authority (`authoredVectors + customVectors`) instead of from project-authored vectors alone
- clock-activity detection now matches normalized input ids against authoritative clock names, so `Phase Driver` / `phase_driver` style naming differences no longer trigger a false pre-run warning
- `IdeApp` now exposes direct parent-owned replay index selection, and `DesignSurface` renders that selection as a central case-index scrubber inside the simulation strip instead of relying only on banner prev/next buttons
- built-preview validation on `2-Bit Up Counter` confirmed the old false warning is gone, later cases still open Design at `Case 10 / 11 · t9`, replay scrub moves the real selected sample to `Case 9 / 11 · t8`, and a real `AND Gate` placement still demotes replay to stale immediately

This means the sequential Verify -> Design loop is now coherent at the remaining student-facing seams: the same next-run vectors author the warning, the same authored case index drives replay, and Design keeps replay control visible without pretending stale samples are still current.

The latest Phase 7 slice moved the scenario model one layer deeper into the real app flow:

- the Verify scenario header is now live because `IdeApp` passes `scenarios` plus runtime-backed create / duplicate / rename / delete / switch callbacks into `VerifySurface`
- `projectRuntime.runVerification(...)` now prefers the resolved active scenario when callers omit vectors
- `projectRuntime.generateBringUpVectors()` now seeds from the active scenario before falling back to compatibility `projectVectors`
- the live shell no longer reads `projectVectors` directly for Verify authority; `IdeApp` now trusts the active-scenario invariant and uses `activeScenario?.vectors ?? []`

The latest pre-lab trust slice tightened the first-run student contract:

- draft trace-authoring sessions now use testbench wording (`Ready to run this testbench` / `Run Testbench`) instead of generic simulation wording
- compare wording remains reserved for asserted sessions that actually have expected outputs loaded
- the first-run builder/footer now consumes authoritative total vector + assertion state from `VerifySurface`, so custom-vector sessions cannot drift into a `READY` hero with a missing primary run CTA

The latest Verify workflow legitimacy slice hardened post-failure recovery:

- assertion mismatches now expose `Edit expected outputs` as an explicit Verify-side recovery path from both the fail hero and the mismatch panel
- `Open in Design` remains available for genuine logic defects, but only as a secondary action in mismatch cases
- stale runs remain explicitly non-failure states and stay on rerun / re-author / keep-reference recovery paths rather than collapsing into generic FAIL guidance
- unsupported feedback structures and structural preflight failures remain design-side problems and continue to route to Design rather than pretending the fix lives in vector authoring

The latest waveform legitimacy slice hardened the actual evidence viewport:

- `AssertionCanvas` now inherits the live waveform `tickWidth` instead of assuming a fixed 48 px column width
- the assertion overlay now renders `zoomedTicks`, not the full timeline, so fail-window investigation shows the same tick set in both surfaces
- Verify now has an explicit evidence-geometry contract: the waveform viewport is the layout authority and any aligned overlays must use the same runtime tick window and column width

The latest legibility slice then removed repeated viewport chrome:

- the waveform frame no longer spends vertical space on a duplicated signal digest, legend strip, tick explainer, or cursor readout table
- the idle ghost scope now sizes to the real container width instead of using a hardcoded decorative track
- fail overlays were strengthened so mismatch regions remain visually dominant in the scope itself

The latest runtime-hardening slice closed RIB-003 waveform causality visibility:

- PASS runs now keep mapped stimulus input lanes visible in the waveform viewport by default (when no mismatches exist)
- this prevents "outputs-only" PASS evidence and restores immediate input-to-output causality reading without requiring signal-group expansion
- mismatch-first runs still retain failure-focused lane behavior

The latest desktop workbench professionalization slice changed the failure-state hierarchy:

- post-run Verify sessions now keep the Stimulus Workbench open by default, including failed compare runs and trace-only runs, so students can edit and rerun without first reopening the editor
- the permanent inline `Failing checks` / `Compare details` rails were removed from the primary `VerifyThreePanel` workspace; the waveform and editor now keep that width, while detailed failure review lives in the secondary analysis drawer
- browser audits at `1366x768`, `1536x864`, `1600x900`, and `1920x1080` confirmed the waveform stage is meaningfully visible alongside the live workbench instead of being squeezed into a narrow post-failure strip

The latest waveform/detail polish slice fixed the remaining desktop ownership mistake:

- wide Verify no longer places the whole workbench into a left grid column while a mostly empty secondary column steals desktop width; the panel body now gives the full center span back to the editor + waveform workspace
- the compact status strip no longer duplicates post-run compare metrics and coverage that already live in `VerifyCommandBar`; command-bar evidence now carries the active fail/match summary plus coverage
- built-preview verification at `1366x768` now measures the Verify workspace at `1388.5px` inside a `1413.5px` panel body, with a `916.5px` waveform stage and `68px` combined top chrome

The latest waveform/detail micro-IA slice tightened the evidence band itself:

- the default waveform strip now keeps only primary evidence controls visible: first-mismatch jump, a compact selected-failure summary, tick-range presets, the tick scrubber, and a `Waveform tools` disclosure
- zoom, density, and cursor tooling moved behind that disclosure so they stop competing with the fail summary and waveform itself
- the closed analysis drawer hint now stays focused on the selected mismatch target (`Focus LD0 at t0`) instead of repeating expected/observed detail that already exists in the evidence band and mismatch drawer
- local preview validation confirmed the evidence area stays compact while exposing the new hierarchy: `ASSERTIONS DIFFER`, `LD0 t0 exp 1 obs 0`, `Focus LD0 at t0`, and `Waveform tools` all remain visible together without reopening the old stacked control strip

The latest Verify composition overhaul made the evidence area stop competing with itself:

- the read-only `AssertionCanvas` no longer renders underneath the waveform inside the primary evidence region
- Verify now treats the waveform as the always-visible evidence companion to the Stimulus Workbench, while the observed/asserted comparison grid lives in the secondary `Vectors` drawer tab
- browser validation at `1366x768`, `1536x864`, `1600x900`, and `1920x1080` confirmed the main failure-state composition is now editor + waveform only, with the secondary comparison grid absent from the primary workspace by default
- the Verify browser contract now explicitly guards that hierarchy: the waveform preview must stay meaningfully visible at desktop width, and the read-only assertion grid must only appear once the analysis drawer is opened

The latest major desktop overhaul then removed the remaining fail-state panel clutter:

- fail-state desktop Verify now collapses the left signals dock by default, leaving only the narrow `Signals` rail toggle visible until the student intentionally opens the dock
- the old non-pass run-proof slab is gone from the main composition; mismatch recovery now stays on the command strip (`Edit cases`) and the secondary analysis drawer rather than introducing another full-width panel
- the analysis drawer is now truly secondary by default: the closed state is just a compact command-strip toggle with a focused hint (`Focus LD0 at t0`), while the full drawer body only appears when explicitly opened
- the stimulus column was narrowed again so the default fail-state desktop composition now reads as narrow signals rail + workbench + waveform, instead of dock + workbench + waveform + bottom slab

The latest full desktop screen redesign then fixed the remaining "internal tool" geometry:

- Verify now treats the left dock as a narrow `Signals` rail across draft, stale, and fail-state desktop sessions, rather than fully hiding it in draft or reopening a large dock by default
- the shell no longer exposes a right-side inspector rail for Verify; the main screen stays workbench + waveform, and deeper analysis remains drawer-only
- the workspace now uses a deliberate desktop split of roughly `42%` workbench to `58%` waveform, instead of the old fixed `430px` stimulus column that made the screen feel top-left heavy
- waveform fitting now spends less space on the label gutter and allows wider ticks, so the evidence panel uses more of its real width instead of leaving empty track space
- the live case matrix and waveform rows both use a larger default row footprint, so the primary screen no longer feels like tiny content floating in oversized black panes

The latest source-driven workspace rescue closed the remaining Verify desktop geometry contradiction:

- live inspection on the source-driven preview (`http://127.0.0.1:4180/`) showed `.ide-verify-workspace` still reserving direct stimulus/waveform columns even though the real DOM only contained one `.ide-verify-lab-frame`
- `.ide-verify-lab-frame` also still reserved an unused second row, which left a dead bottom gap in the main lab
- the cleaned Verify `Signals` rail styling still could not widen the actual left dock because `IdeWorkbenchShell.tsx` was clamping Verify dock widths inline
- the fix made the outer workspace a single full-width track, let `.ide-verify-lab-grid` own the real two-pane split, removed the dead lab-frame row, removed the post-run workbench height cap, and widened the Verify left-dock clamp ranges
- final live measurements confirmed the repaired geometry: the first structural fix expanded the waveform center from about `169px` to about `1032px`, and the final balanced layout settled around `629px` stimulus / `681px` waveform with a `208px` left dock

## Mode Detection (B-12 Slice 1)

`verifyMode.ts` provides the canonical circuit mode gate, replacing the previous `hasDff: boolean` prop.

```
VerifyMode = 'combinational' | 'sequential' | 'blocked'
```

**Detection priority (highest → lowest):**

1. Any `UNSUPPORTED_SEQUENTIAL` node type present → `'blocked'` (wins over everything)
2. Any `SUPPORTED_SEQUENTIAL` node type, OR `analyzeSequentialLogic().hasClockedMacros`, OR `hdlScheduleHint === 'clocked_macro'` → `'sequential'`
3. Default → `'combinational'`

**Rule**: A clock-role INPUT node alone does **not** force sequential mode; only structural stateful elements do.

**Sets:**
- `SUPPORTED_SEQUENTIAL`: `DFlipFlop`, `DLatch`, `TFlipFlop`, `JKFlipFlop`, `RSLatch`
- `UNSUPPORTED_SEQUENTIAL`: `Counter4Bit`

**IdeApp wiring:** `verifyMode = detectVerifyMode(circuit, verifyLastRun?.schedule)`
The HDL hint (`lastRun?.schedule`) handles cases where the circuit graph doesn't carry DFF nodes directly (VHDL/Verilog import path).

`hasDff` useMemo in IdeApp.tsx is kept and exported — it has direct test coverage in `projectRuntime.history-authority.test.tsx` and must not be removed.

---

## Entry-State Architecture (B-12 Slice 2)

VerifySurface owns the unified entry shell. Three canonical entry paths:

**Blocked (`verifyMode === 'blocked'`):**
- `ide-verify-entry-blocked` surface with plain-language reason and Fix in Design CTA
- `VerifyCommandBar` suppressed (no Run button visible)
- `VerifyFirstRunPanel` suppressed
- `unsupportedFeedbackDiagnostic` prop from IdeApp still works alongside this (redundant signal; Slice 3 may collapse them)

**Combinational (`verifyMode === 'combinational'`):**
- `VerifyCommandBar` renders (always-visible command bar with Run + mode toggle)
- `VerifyFirstRunPanel` renders on `isFirstRunState && !lastRun`
- No blocked surface, no clock helper

**Sequential (`verifyMode === 'sequential'`):**
- Same skeleton as combinational
- `ide-verify-sequential-helper` strip renders on `verifyMode === 'sequential' && isFirstRunState` — no `lastRun` requirement
- `VerifyFirstRunPanel` renders on first-entry with sequential starters when `!hasVectors`
- `VerifyCommandBar` renders after first-run state exits

**`primaryStatus` chip:** `data-testid="ide-verify-primary-status"` (renamed from `ide-verify-status-chip` in Slice 2). No test used the old name.

---

## Result Zone Architecture (B-12 Slice 3)

One canonical result zone in `VerifySurface.tsx`. All status display derives from new computed values rather than raw session state.

### New Computed Values

| Name | Type | Purpose |
|---|---|---|
| `emptyStateRunLabel` | `string` | `'Run Compare'` (draft + assertions) / `'Run Testbench'` (draft, no assertions) / `verifySession.runLabel` otherwise |
| `referenceModeLabel` | `string` | Human-readable description of current reference state (stale / observation-only / trace-only / compare with counts) |
| `sessionModeBadge` | `string` | `'CAPTURE'` / `'COMPARE'` / `'SIMULATION'` — describes what kind of evidence the session holds |
| `sessionTitle` | `string` | Short phrase for the current session state (`'Ready to compare'` / `'Assertions match'` / etc.) |

### Status Strip Rule

`ide-verify-session-status` must show `verifySession.statusBadge` (the raw, unoverridden badge value e.g. `'DRAFT'`, `'OBSERVATION ONLY'`, `'STALE'`). The `IdeStatusPill` (testid `ide-verify-summary-status`) shows `sessionStatusBadgeLabel` which may override `'DRAFT'` to `'READY'`. These two values must NOT be collapsed — they serve different contracts.

### Compact Stale Strip

When `usesCompactStaleStrip === true` (`= hasStaleAuthoredReference`), the status strip shows three explicit recovery buttons:
- `ide-verify-stale-keep-reference` — calls `handleKeepOlderReference` (sets `nextRunUsesAssertions=true` + runs with preflight)
- `ide-verify-stale-reset-stimulus` — calls `handleResetToStimulusOnly` (clears expected outputs)
- `ide-verify-stale-recapture-reauthor` — calls `handleStaleRecapture` (scope capture from current circuit)

### `primaryStatus` Memo Rule

`primaryStatus` useMemo must NOT handle `unsupportedFeedbackDiagnostic`. That case has a dedicated `ide-verify-unsupported-feedback-banner` rendered unconditionally when the prop is set. Keeping the two separate prevents `!primaryStatus` from silently blocking the banner.

### Latch-Control Button Label

When `effectiveTimingGuidance.kind === 'latch-control'`, the `ide-verify-insert-clock-pattern` button reads `'Insert basic enable pattern'`. For all other sequential modes it reads `'Alternating clock'`.

### Pre-Run Inventory

Signal lane chips: `ide-verify-prerun-lanes` container with `ide-verify-lane-chip-{name}` per lane (uses display label, e.g. `'SW0'` not `'sw0'`). Clock chip: `ide-verify-prerun-clock-chip` rendered when `clockPolicy === 'clocked'` and `clockSignalName` is set.

### Sequential Clock Authority

When sequential timing is present, one contract owns the clock model across authoring, replay, and helper generation.

- `resolveActiveScheduleContract(...)` selects the authoritative `VerifyScheduleContract`: prefer the live contract when the last run is stale, hashless, or for a different circuit; otherwise use the matching run contract
- pre-run lane inventory, clock chip naming, helper-button labels, helper insertion, and placeholder clock copy must derive from that active contract plus `deriveTimingGuidance(...)`, not from raw `lastRun?.scheduleContract` lookups or surface-local heuristics
- `buildClockHelperVectors(...)` is the only helper/default clock generator for alternating / hold-low / hold-high / pulse insertion
- helper/default parity is absolute by sampled tick: `t0 = 0`, `t1 = 1`, `t2 = 0`, and so on; the canonical rising edge is `0 -> 1`
- bring-up sequential starters must reuse that same helper policy so first-run defaults in Design/Verify remain consistent
- selected case/tick always refers to the sampled state for that authored case; neither Verify nor Design may reinterpret the clock locally

### Incomplete Mapping Banner

`ide-verify-incomplete-mapping-banner` shown when `mappingComplete === false && !lastRun`. Appears before `ScenarioBuilderPanel`.

---

## Frontend Layout Architecture (B-13 / B-14)

VerifySurface renders four canonical regions, each a `<section>` with `data-zone` and `data-testid` from `VerifyRegionLayout.tsx`:

| Region | data-zone | data-testid | data-region-role | Contents |
|--------|-----------|-------------|-----------------|----------|
| `VerifyHeaderRegion` | `header` | `ide-verify-region-header` | — | Status strip, command bar, assertion-mode toggle |
| `VerifyResultRegion` | `result` | `ide-verify-region-result` | — | PASS hero, failure context panels (fail-diagnosis, hint, readiness-strip, export-note, oracle-note, preview-banner) |
| `VerifyStimulusRegion` | `stimulus` | `ide-verify-region-stimulus` | `authoring` | Entry states, sequential helpers, vectors zone, scenario picker, ScenarioBuilderPanel |
| waveform (raw `div`) | `waveform` | `ide-verify-region-waveform` | `evidence` | Waveform viewer, fail nav, results table |

> **Note**: The waveform region is a raw `<div>` in `VerifySurface.tsx`, not the exported `VerifyWaveformRegion` component. `VerifyWaveformRegion` exists in `VerifyRegionLayout.tsx` but is currently unused. Both have the same testid and classnames.

**VerifyResultRegion** was added in B-13 Phase 1. Previously the result/failure context panels floated between `VerifyHeaderRegion` and `VerifyStimulusRegion` with no structural wrapper. Wrapping them provides semantic identity and enables layout scoping without logic changes.

### Canonical Surface Ownership (B-13 Phase 2 + Phase 3 — complete)

One surface owns each user action. No duplicates remain.

| Action | Canonical location | testid | Removed duplicates |
|--------|--------------------|--------|--------------------|
| Run verification | `VerifyCommandBar` (header, always visible when not blocked) | `ide-vcb-run` | `ide-vfr-run` (VerifyFirstRunPanel), `ide-verify-workbench-run` (ScenarioBuilderPanel postrun), `ide-verify-run` (ScenarioBuilderPanel first-run footer — Phase 3) |
| Sequential clock presets | `ide-verify-sequential-helper` callout in `VerifyStimulusRegion` | `ide-verify-insert-clock-pattern` etc. | `ide-vfr-seq-presets` in VerifyFirstRunPanel |

**Run ownership is now fully singular.** `ide-vcb-run` is the only Run trigger in Verify.

### Case-Editor Clarity (B-14 Slice 1)

`VerifyFirstRunPanel` now yields to the StimulusCanvas once vectors exist.

**Before B-14 Slice 1**: `VerifyFirstRunPanel` rendered unconditionally in `isFirstRunState && !lastRun` — even when vectors were already present. Students had to scroll past a hero panel (icon + description + signal pills + 4-step workflow) to reach the editable StimulusCanvas.

**After B-14 Slice 1**: `VerifyFirstRunPanel` renders only when `totalVectorCount === 0`. Once vectors appear (auto-generated or authored), the hero panel disappears and the canvas is immediately first.

| State | VerifyFirstRunPanel | StimulusCanvas |
|-------|---------------------|----------------|
| first-run, no vectors | ✅ shown (orientation) | ✅ shown |
| first-run, vectors exist | ❌ hidden | ✅ shown (primary) |
| post-run (any) | ❌ hidden (was already hidden) | ✅ shown |

### Action Row Hierarchy (B-14)

`VerifyCommandBar` DOM order: `[actions | mode | status+save-expected]`. Run is leftmost/primary, mode toggle is secondary center, save-as-expected is a ghost utility in the right status group.

**CSS contracts**: Inactive mode button — `opacity: 0.42`, smaller padding. Save-expected in status group — `font-size: 11px`, `opacity: 0.68`. All testids preserved: `ide-vcb-run`, `ide-vcb-mode-observe`, `ide-vcb-mode-compare`, `ide-vcb-save-expected`.

### Matrix Differentiation (B-14)

Machine-readable role attributes lock the authoring vs. evidence identity contract. Visual differentiation: sky-blue = authoring canvas, amber = evidence readout.

| Element | data-region-role | Visual accent |
|---------|-----------------|---------------|
| `VerifyStimulusRegion` | `authoring` | sky-blue left-border strip header |
| waveform `div` | `evidence` | amber left-border on scope header |
| `ide-verify-testbench-zone-header` (pre-run) | `authoring-header` | — |
| `ide-verify-workbench-header` summary (post-run) | `authoring-header` | sky-blue left-border strip (no card radius) |
| `ide-verify-scope-header` | `evidence-header` | amber border-left + amber scope-label text |

**CSS decisions**:
- `ide-verify-workbench-header`: `border-radius: 0` (was `6px`). Now a panel header strip, not a card widget.
- `.ide-verify-scope-label`: `rgba(245,158,11,0.72)` amber (was sky-blue) — immediately distinguishes waveform as captured evidence, not editable.
- Scope-header bottom-border: amber `rgba(245,158,11,0.22)` (was sky-blue).

**Decision**: amber chosen for evidence because it reads as "instrument/readout" rather than "interactive". Sky-blue reserved for authoring/interactive surfaces throughout the IDE.

### Row Authoring Clarity (B-14)

`StimulusCanvas` toolbar groups restructured so the three primary case-management actions are first and visually prominent.

**Group order** (left → right):
1. **Cases** (`data-testid="ide-stimulus-case-actions"`) — Add case (primary), Duplicate case, Delete case, case dropdown, Binary count
2. **Edit signal** (`data-testid="ide-stimulus-signal-edit"`) — signal dropdown, Fill 0/1, Toggle, Alternating, Clock pattern / Clear
3. **Edit case** (`data-testid="ide-stimulus-case-edit"`) — column Fill 0/1, Toggle
4. **Clipboard** — Copy TSV, Paste TSV

**Before**: Add case was the 9th button (buried in "Case setup" group). "Selected case" and "Case setup" co-mingled selection, column-fill, and case-management with equal visual weight.

**Column headers**: changed from `t{tick}` (internal tick index) to `Case {tick + 1}` (student-facing language).

**CSS**: `ide-stimulus-mini-btn--primary` — navy fill + increased font weight for Add case. Selected column highlight: `rgba(59,130,246,0.22)` (was 0.12) + 2px top border accent.

### Inline Case Affordances + Advanced Tools Disclosure (B-14 follow-up)

The visible `StimulusCanvas` workbench now separates **everyday case editing** from **power-user transforms** instead of letting both compete in one toolbar.

**Primary visible controls**:
- `ide-stimulus-case-actions` now keeps only case ownership + direct case actions above the fold:
  - `ide-stimulus-selected-case-chip`
  - `ide-stimulus-tick-target`
  - `ide-stimulus-add-tick`
  - `ide-stimulus-duplicate-tick`
  - `ide-stimulus-delete-selected-tick`
- selected case headers keep pinned inline actions visible for the active case:
  - `ide-stimulus-duplicate-tick-{tick}`
  - `ide-stimulus-delete-tick-{tick}`
- those inline actions still appear on hover for non-selected cases, but the selected case no longer depends on hover-only micro-controls

**Advanced disclosure contract**:
- non-core transforms now live behind `ide-stimulus-advanced-tools-toggle`
- the expanded panel container is `ide-stimulus-advanced-tools-panel`
- the advanced panel owns:
  - binary-count generation
  - signal fill / toggle / alternating / clock-pattern helpers
  - case-wide fill / toggle transforms
  - TSV clipboard import/export

**Student-facing rule**: the workbench should read `select case -> edit cells -> add / duplicate / delete -> run`, while patterns/fill/clipboard stay available but clearly secondary.

### Stimulus-First Observation Model (B-14 Post-Codex)

Verify now launches in observation/trace mode by default. Expected-output checks are an opt-in second layer, not a requirement for the first run.

**Product model change**: Before this slice, Verify framed itself as "fill in expected outputs, then compare." After this slice, the first run is always a stimulus run — the student drives inputs, the waveform records outputs, and checks are added only if the student explicitly wants to assert a specific value.

**State change — `nextRunUsesAssertions` initializer:**

```typescript
// BEFORE: auto-enabled when expected cells existed
() => getRuntimeVerifyRunKind(lastRun) === 'verify' || (!lastRun && totalExpectedCaseCount > 0)

// AFTER: only enabled when previous run was an assertion-backed compare run
() => getRuntimeVerifyRunKind(lastRun) === 'verify'
```

This means a project that already has expected outputs (e.g. imported example projects) no longer auto-arms compare mode on first entry. The student must actively open the Checks panel and acknowledge they want to assert.

**`showExpectedOutputs` state in `VerifySurface`:**

- Default: `false` — expected-output canvas lanes are hidden on first render
- Flipped to `true` by `handleToggleExpectedOutputs` when student clicks the Checks toggle
- `handleToggleExpectedOutputs` also coerces `nextRunUsesAssertions = true` and forces `ScenarioBuilderPanel` open

**StimulusCanvas props added:**

| Prop | Default | Purpose |
|------|---------|---------|
| `showExpectedOutputs` | `false` | Controls expected-lane visibility |
| `hasSavedExpectedOutputs` | `false` | Enables "edit checks" copy in the toggle hint |
| `onToggleExpectedOutputs` | `undefined` | Callback wired to `handleToggleExpectedOutputs` |

**Checks toolbar group (`ide-stimulus-checks-controls`):**

- `ide-stimulus-checks-toggle` — opens/closes expected-output lanes in StimulusCanvas toolbar
- `ide-stimulus-checks-note` — copy hint that changes based on `hasSavedExpectedOutputs`
- When `showExpectedOutputs=false`: expected lane columns are hidden; `expectedLanesVisible = !readOnlyOutputs && showExpectedOutputs && outputFields.length > 0`

**Mode badge renames:**

| Old | New | Where |
|-----|-----|-------|
| `COMPARE` | `CHECKS` | `buildVerifySessionViewModel` mode badge |
| `'Ready to run this testbench'` | `'Ready to run stimulus'` | Pre-run session title |
| `'Ready to compare'` | `'Ready to run assertions'` | Pre-run title (assertions armed) |
| `'Run Compare'` / `'Re-run Compare'` | `'Compare'` / `'Compare again'` | Run label |
| `'Re-run for current circuit'` | `'Re-run stimulus'` | Stale run label |
| `'Edit cases'` | `'Edit checks'` | VerifyCommandBar edit button |
| `'Save as expected'` | `'Save observed as checks'` | VerifyCommandBar save-expected button |
| `'Compare circuit outputs...'` | `'Compare observed outputs against saved checks'` | VCB title attr |

**IdeWorkbenchShell layout:**

Codex's desktop redesign added `VERIFY_COLLAPSED_DOCK_RAIL_WIDTH = 60` for a dedicated narrow Signals rail in Verify mode. The general `COLLAPSED_DOCK_RAIL_WIDTH = 26` applies to all other modes. The CSS custom property `--ide-workbench-left-slot-width` is set to `26px` (not `0px`) when the left dock is collapsed — the rail occupies real space rather than overlaying.

**ADR**: See `ADR-004 Stimulus-First Observation Default.md`.

### Observe-First Completion (2026-04-09)

Two additions that complete the model framing:

**Verify → Design bridge (`ide-verify-inspect-design`):**

`VerifyCommandBar` accepts `showGoToDesign?: boolean` + `onGoToDesign?: () => void`. When both are truthy, a ghost-weight "Open in Design" button appears in the right group. The bridge is wired through `handleGoToDesignFromVerify` in `VerifySurface`:

```typescript
// VerifySurface: showGoToDesign condition
showGoToDesign={Boolean(lastRun) && (Boolean(onGoToDesign) || Boolean(onGoToDesignWithInputs))}
onGoToDesign={handleGoToDesignFromVerify}
```

`handleGoToDesignFromVerify` — when `onGoToDesignWithInputs` is provided AND the run has `inputsAtTick` data, it calls `onGoToDesignWithInputs(inputs)` with the selected tick's inputs (fallback: first available tick). Otherwise falls back to plain `onGoToDesign()`.

**Verify → Design tick-context injection (IdeApp):**

`onGoToDesignWithInputs` is wired in IdeApp to:
1. Set mode to `'design'`
2. Call `setRuntimeSimInput(signalId, value)` for every input in the tick snapshot

This makes "Open in Design" mean: *view the circuit's propagation for the exact input pattern you observed at that tick.* The runtime sim is already wired from IdeApp → DesignSurface; this unifies Verify observation with Design propagation inspection.

**Scope label rename:**

The oscilloscope instrument header label changed from `"Waveform"` to `"Observed output"`. The element has `data-testid="ide-verify-scope-label"`.

### WaveformViewer Signal Visual System (2026-04-09)

`WaveformInstrument.tsx` now differentiates Stimulus (input) vs Observed (output) channels visually:

| Lane type | Trace color | Group header color | Semantic |
|-----------|-------------|---------------------|----------|
| Inputs (Stimulus) | `rgba(56,189,248,…)` steel-blue | Blue accent, normal weight | "I set these" |
| Outputs (Observed) | `#2ec4b6` teal | Teal accent, **bold, brighter** | "Circuit output evidence" |
| Failing outputs | `#ff6b6b` red | — | "Check mismatch" |
| Clock signals | `#fbbf24` amber | — | "Sequential clock" |

Group headers now have `data-testid="ide-verify-waveform-group-inputs"` and `data-testid="ide-verify-waveform-group-outputs"`.

Signal rows have `data-direction="inputs" | "outputs" | "unknown"` (CSS-targetable).

The "Observed" section header uses heavier font-weight (700), brighter teal text (`rgba(46,196,182,0.75)`), and a thicker label separator line — making the output section visually dominant.

---

## Canonical Shape / Contract

### Surface workflow contract

Verify is the stimulus-and-evidence surface in the RedByte workflow loop.

- its default job is to let the student author or adjust stimulus, run the circuit, and observe waveform truth
- expected-output authoring is an explicit advanced branch on top of that observed run, not the default arrival mode
- waveform evidence is the primary post-run truth surface; summary chips, compare tables, and helper banners stay subordinate to the waveform and selected case/tick context
- `Open in Design` is the structural-explanation handoff; it must carry the currently selected tick plus the most meaningful signal focus or mismatch context available from the run
- mapping, export, and hardware readiness may be summarized around Verify, but they are not the primary reason the student is on this surface
- when space is tight, preserve the run CTA, selected case/tick context, authored stimulus, and waveform stage before secondary tooling

### Run pipeline

```text
VerifySurface
  -> onRunVerification(input)
  -> IdeApp.handleRunVerification(input)
  -> projectRuntime.runVerification(input)
       -> buildDeterministicVerifyContext(circuit, ioMapping)
       -> normalizeVectorsForLiveIo(vectors, projectIoRows)
       -> runDeterministicVerifyFromModel(circuit, simModel, ioRows, vectors, schedule)
       -> buildVerifyReport(...)
       -> buildCanonicalVerifyWaveSamples(report, trace)
       -> persist verifyLastRun + verifyRunHistory
```

### Persisted run state

`RuntimeVerifyRun` in `projectRuntime.ts` is the persisted run record:

```typescript
{
  scenarioId: string
  scenarioName: string
  runKind?: 'trace' | 'verify'
  scenarioVersion?: number
  scenarioContentHash?: string
  status: 'pass' | 'fail'
  qualification?: 'incomplete-mapping'
  deterministicHash: string
  reportHash: string
  generatedAtIso: string
  schedule: 'combinational' | 'clocked_macro'
  scheduleContract?: VerifyScheduleContract
  meta: VerifyRunMeta
  report: VerifyReport
  waveform: VerifyWaveSample[]
  evidence?: VerifyEvidenceCapsule
}
```

`VerifyRunLedgerEntry` is the only place that currently stores split hashes:

```typescript
{
  circuitHash: string
  vectorsHash: string
  mappingHash: string
  projectHash: string
}
```

`projectHash` is the current best freshness fingerprint because it is built from:

- `circuit`
- `projectVectors + customVectors`
- `ioMapping`

It deliberately excludes project metadata, FPGA config, generated HDL/XDC, and student metadata.

### Student-facing session model

`VerifySessionStatus` in `buildVerifySessionViewModel.ts` is the intended student-facing state machine:

```text
draft
running
stale
stimulus-only
assertions-incomplete
assertions-match
assertions-differ
```

## Rules

- The live schematic plus current IO mapping are the simulation truth source. `projectRuntime.runVerification(...)` rebuilds `buildDeterministicVerifyContext(...)` from the current circuit at run time; it does not trust old interactive trace state.
- Verify must not present stimulus authoring, waveform evidence, check authoring, and downstream handoff as four equal-weight first actions. The default path is stimulus -> run -> observe.
- Observation is the default Verify stance. Compare/check authoring is explicit and secondary until the student chooses it.
- The waveform is the primary truth surface after a run. Header chrome, helper banners, and analysis sections must not outrank or visually duplicate that evidence.
- Verify freshness must only depend on the inputs that change verify truth: circuit structure, IO mapping, and the vector set actually used for the run.
- Project identity edits are export metadata changes, not verify-truth changes. They may dirty export, but they must not dirty verify freshness.
- IO rows are derived from the live circuit boundary via `synchronizeProjectIoRows(...)`. Bare `input` / `output` labels and internal `node-v2-*` style ids are not acceptable student-facing boundary names; unlabeled or legacy rows must promote to deterministic labels such as `Input 1`, `Input 2`, `Output 1`, or `Clock`.
- Vector keys are normalized and rekeyed through `row.id`, `row.label`, and `row.nodeId`, which is why IO rename/remove flows now survive design edits without zombie keys.
- Restore/import paths must rekey project vectors, scenario vectors, and custom vectors against the sanitized live IO rows during load/merge. A saved project may arrive with old boundary ids, but the in-memory Verify state must not keep those stale keys after normalization.
- Trace-only observation and asserted comparison now persist a distinct `runKind` on `RuntimeVerifyRun`, and `ProjectHealth` carries that projection into Project / Pipeline / Hardware / Export.
- `status` still matters inside a given run kind: `runKind='verify'` plus `status='pass' | 'fail'` distinguishes assertions-match vs assertions-differ, while stale remains a freshness overlay computed from the live project hash.
- `projectRuntime.setVectors(...)` and `generateBringUpVectors(...)` now stamp the active scenario in lockstep with `projectVectors`, so `scenarioVersion` and `scenarioContentHash` no longer lag behind the normal shell authoring path.
- Verify scenario lifecycle is now partially first-class in the runtime store: create / duplicate / rename / delete / switch all operate on `scenarios + activeScenarioId`, then mirror the selected scenario back into `projectVectors` as a compatibility bridge.
- `IdeApp.tsx` now resolves `activeScenario = getActiveScenario(scenarios, activeScenarioId)` and uses that scenario as the shell-level vector authority for Verify / Export / Hardware. The compatibility `projectVectors` path still exists, but the normal shell flow no longer drops scenario provenance on the floor.
- Export artifact generation is already decoupled from verify PASS/FAIL. Verify affects provenance notes and advisory copy only; it should not block artifact generation.
- Draft trace-authoring sessions must speak in testbench language. Reserve compare wording for asserted sessions and reserve observation-only wording for recorded trace evidence.
- First-run CTA readiness must derive from the total live vector authority (`activeScenario` / project vectors + custom vectors), not just project-authored vectors, so custom-vector sessions still expose the correct primary action.
- Verify must not collapse all bad outcomes into a single failure bucket. Current UI routing must preserve at least these classes:
  - `design defect` — observed circuit behavior is wrong for the intended expectation; Design is a valid secondary destination
  - `verify authoring defect` — expected outputs or authored tick sequence are wrong; recovery stays in Verify first
  - `unsupported verify setup` — blocked topology / unsupported temporal structure; recovery goes to Design
  - `stale verification state` — previous evidence no longer describes the current circuit or scenario; recovery is rerun / recapture / re-author, not failure triage
  - `ambiguous or mixed failure` — keep both Verify and Design actions visible, but default focus stays on inspecting the first mismatch and current testbench
- Assertion mismatch CTAs must keep Verify recoverable. `Edit expected outputs` is the primary authoring recovery for assertion-backed mismatches; `Open in Design` is secondary unless the surface has explicit structural evidence that Verify cannot evaluate the circuit truth.
- Stale is not fail. Any stale branch must say the visible evidence belongs to an older build or scenario and must not reuse the language or CTA hierarchy of live assertion failures.
- Unsupported feedback and verify preflight failures are not testbench-authoring errors. They should surface as blocked or structural states with Design-directed recovery.
- The waveform viewport is the evidence-layout authority. Any overlay that claims to align with it must consume the same visible tick window and the same runtime tick width.
- The waveform frame should not spend prime viewport height on information already visible in the scope itself. Repeated legends, explainer copy, digest chips, and readout tables belong outside the live evidence area or in tooltips/drawers.
- PASS evidence must include both mapped stimulus inputs and observed outputs in the default viewport whenever no mismatches are present.
- `data-region-role` attributes are the machine-readable contract for Verify region identity. `authoring` marks the editable stimulus workspace; `evidence` marks the captured waveform readout. Header nodes within those regions carry `authoring-header` / `evidence-header` respectively. CSS accent color follows: sky-blue = authoring, amber = evidence. Do not reuse amber for interactive/editable elements.
- The outer Verify workspace owns one full-width lab frame only. Stimulus vs waveform column geometry belongs to `.ide-verify-lab-grid`; the outer workspace must not reserve parallel desktop columns when its only child is `.ide-verify-lab-frame`.
- Desktop Verify must not reserve dead layout tracks. The lab frame cannot keep an unused row below the active workspace, and shell width caps must stay wide enough for the Verify `Signals` rail to present grouped controls without horizontal crowding.

## Failure Taxonomy And Routing

Current Verify legitimacy contract:

| Category | Typical trigger | Student-facing meaning | Primary recovery | Secondary recovery |
|---|---|---|---|---|
| Design defect | Live assertion mismatch against a current circuit | The circuit produced a different value than the asserted expectation | Inspect first mismatch / Compare details in Verify | Open in Design |
| Verify authoring defect | Wrong expected outputs or wrong authored sequential tick pattern | The testbench expectation may be wrong even if the circuit is fine | Edit expected outputs / adjust vectors in Verify | Open in Design |
| Unsupported verify setup | Unsupported feedback topology or blocked temporal contract | Verify cannot judge this circuit with the current supported model | Open in Design | None |
| Stale verification state | Circuit or scenario changed after the last run | Older evidence is visible, but it is not a live failure verdict | Re-run / re-author / recapture | Keep old reference |
| Ambiguous or mixed failure | A mismatch without enough structural evidence to disambiguate logic vs expectation | The first task is to inspect the concrete mismatch before editing | Inspect first mismatch | Edit expected outputs, Open in Design |

Sequential-specific rule:

- When `classifyVerifyFailure(...)` returns `timing-mismatch`, the explanation layer must frame the issue as clock/sample alignment work around a specific tick, not as a generic combinational logic failure.

## ProjectVectors Audit

The current repo state does **not** support deleting `projectVectors` outright yet.

### Still-required compatibility bridge

- persisted runtime state still serializes `projectVectors`
- persisted runtime merge still rebuilds `RBProject.vectors`, restored verify hash, and scenario repair/migration from `candidate.projectVectors`
- design history snapshots still store `projectVectors`
- undo / redo still rekey snapshot `projectVectors` back through the current IO shape
- legacy/persisted runtime load still repairs or migrates scenarios from `candidate.projectVectors`
- RBProject import/load still seeds the scenario library from `project.vectors`
- export still has an explicit compatibility fallback from `project.vectors` / `bundle.testbench` when no active scenario is available

### Derived mirror that can keep shrinking

- `ProjectRuntimeState.projectVectors` is now best understood as a mirror of the selected scenario, not as an independent source of truth
- `setVectors(...)`, `generateBringUpVectors()`, and scenario switching all mirror active-scenario vectors into `projectVectors`
- shell surfaces should prefer `activeScenario` directly whenever the repaired-scenario invariant is already guaranteed

### Obsolete live fallback removed

- `IdeApp` used to read `projectVectors` directly and fall back to it even after the scenario model was live
- that shell-level fallback is now gone; the shell trusts `activeScenario?.vectors ?? []`

### Phase 9 recommendation

- Keep `projectVectors` deliberately in saved state for now as a compatibility bridge.
- Do **not** delete it from persistence/history yet:
  - persisted restore still uses it to rebuild the normalized project + verify/export trust inputs
  - design-history snapshots still rely on it for undo / redo vector rekeying
  - import/load still uses it to seed the default scenario
  - export still needs it for the no-active-scenario fallback
- If the repo wants to reduce it later, that needs a scenario-first redesign of persistence/history/import/export together, not another narrow shell-side cleanup.

## Consumption Sites

- `packages/rb-apps/src/apps/IdeApp.tsx`
  - computes `currentVerifyProjectHash(...)`
  - routes verify runs into `projectRuntime`
  - now resolves and passes `activeScenario` into Verify / Export / Hardware in the normal shell flow
  - no longer reads `projectVectors` directly as a live shell fallback
- `packages/rb-apps/src/apps/ide/projectRuntime.ts`
  - owns verify state, dirty flags, run ledger, vector normalization, IO synchronization
  - now stamps the active scenario whenever the compatibility `projectVectors` path changes
  - now exposes the first real scenario library actions used by the shell (`createScenario`, `duplicateScenario`, `renameScenario`, `deleteScenario`, `switchScenario`)
  - now prefers active-scenario vectors before falling back to compatibility `projectVectors` in runtime verify and bring-up generation
  - now promotes unlabeled/legacy boundary rows to student-facing labels during load/restore and rekeys restored vectors against the sanitized IO row ids
- `packages/rb-apps/src/apps/ide/sim/simEngineCore.ts`
  - runs deterministic verify from the current `SimulationModel`
  - resolves IO keys through `getIoSignalLookupKeys(...)` + model-port aliases
- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
  - owns local next-run assertion/capture intent via `nextRunUsesAssertions`
  - current compare behavior now keys off `VerifySessionStatus` plus persisted `runKind`
  - summary pills, run-proof hero/copy, result-pane visibility, and trace capture CTA no longer use live `DisplayStatus` branches
  - next-run intent now drives only pre-run/reference copy, compare-vs-trace run wiring, and the advanced toggle state
  - fail-state CTA routing now distinguishes Verify authoring recovery (`Edit expected outputs`) from Design recovery (`Open in Design`)
  - stale authored references now demote back to trace-first recovery with explicit rerun / re-author / keep-reference actions
  - B-12 Slice 3: new computed values `emptyStateRunLabel`, `referenceModeLabel`, `sessionModeBadge`, `sessionTitle` drive the unified result strip
  - B-12 Slice 3: `ide-verify-session-status` shows raw `verifySession.statusBadge` (separate from student-display override in pill)
  - B-12 Slice 3: `primaryStatus` memo no longer handles `unsupportedFeedbackDiagnostic`; dedicated banner renders unconditionally
  - B-13 Phase 1: `VerifyResultRegion` wraps the previously-orphaned float zone (fail-diagnosis, hint-callout, readiness-strip, export-available-note, pass-hero, oracle-note, preview-banner). Four canonical regions: Header → Result → Stimulus → Waveform.
  - B-13 Phase 2: frontend dedup. Removed `ide-vfr-run` (VerifyFirstRunPanel), `ide-vfr-seq-presets` (VerifyFirstRunPanel), `ide-verify-workbench-run` (ScenarioBuilderPanel postrun). Canonical Run = `ide-vcb-run`. Canonical sequential helper = `ide-verify-sequential-helper`.
  - B-13 Phase 3: removed `ide-verify-run` from ScenarioBuilderPanel first-run footer. Run ownership fully singular — `ide-vcb-run` is the only Run action in Verify.
  - B-14 Slice 1: `VerifyFirstRunPanel` suppressed when `totalVectorCount > 0`. Hero steps aside; StimulusCanvas is immediately primary when vectors exist. Contract test: `verifySurface.caseEditorClarity.test.tsx` (5 tests).
  - B-14 Row Authoring Clarity: toolbar group order changed — Cases group (Add/Dup/Del/Binary count) is now first; "Selected signal" → "Edit signal"; "Selected case" → "Edit case". Column headers changed from `t{tick}` to `Case {tick + 1}`. Add case button carries `ide-stimulus-mini-btn--primary` CSS.
  - the remaining local split is mostly draft-only `READY` / `BLOCKED` presentation plus compatibility `projectVectors` paths
- `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx`
  - first-run footer/copy now consumes authoritative vector/assertion counts from `VerifySurface` instead of inferring readiness from project-authored vectors alone
  - B-12 Slice 4: postrun `<div>` → `<details ref={detailsRef}>` + `<summary className="ide-verify-scenario-builder-summary">`. `initialExpanded` prop: `true` for confirmed-pass non-trace runs, `false` for fail/trace. fail-state CTAs in `VerifySurface` set `details.open = true` to reveal workbench without React state round-trip.
  - B-13 Phase 2: `ide-verify-workbench-run` removed from postrun workbench-actions. Only `ide-verify-workbench-generate` remains.
  - B-13 Phase 3: `ide-verify-run` removed from first-run footer. When `hasVectorsReady`, footer shows only Open vectors — Run lives in header.
- `packages/rb-apps/src/apps/ide/viewmodels/buildVerifySessionViewModel.ts`
  - intended student-facing source of truth for session state
  - now keeps persisted compare evidence authoritative even when live vector props are temporarily absent
  - now defines the draft trace-authoring contract using testbench language instead of generic simulation wording
- `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
  - correctly keeps export content decoupled from verify status
  - now refuses to treat `runKind='trace'` as verified PASS provenance
  - its scenario-provenance branch is now live in the normal shell flow when Verify has recorded an assertion-backed run
- `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
  - `components/PipelineStrip.tsx`
  - `surfaces/HardwareSurface.tsx`
  - now derive current trace vs asserted compare from `ProjectHealth.lastVerify.runKind`

## Open Questions / Stubs

- Phase 1 freshness cleanup is only partially landed. Verify now uses `currentVerifyProjectHash` for stale detection and project identity edits no longer dirty verify, but freshness logic still lives in multiple places instead of a shared helper.
- The scenario/session model is only partially wired end-to-end:
  - `IdeApp` now passes the resolved active scenario through the normal Verify / Export / Hardware shell path
  - `projectRuntime` now stamps the active scenario during normal vector edits
  - dedicated runtime actions for create / duplicate / rename / delete / switch scenario now exist and the Verify scenario header uses them in the shell path
  - the remaining gap is that `projectVectors` still persists as a compatibility mirror for runtime persistence/history/import/export, so the scenario library is not yet the only vector state in storage/runtime APIs
- BUG-006 is effectively fixed. Current-run meaning no longer depends on local Verify state, and the remaining `projectVectors` mirror is now a declared saved-state compatibility bridge rather than a live Verify behavior problem.
- Phase 9 audit recommendation: keep `projectVectors` deliberately in saved state for now as a declared compatibility bridge. The remaining decision is whether that bridge should later be replaced by scenario-first persistence/history snapshots.
- Targeted validation note: the persistence and export suites still support this bridge, while `projectRuntime.history-authority.test.tsx` now contains stale expectations against current stale-copy wording and older output-auto-expansion behavior.
- Future scenario-first persistence/history work, if it happens, should be treated as a separate migration track rather than as unfinished Verify emergency cleanup.
- Component render coverage for Verify surfaces is still constrained by [[BUG-003 React.act Infrastructure Failure]], so most end-to-end Verify UI regressions need pure-logic or contract tests until React test infrastructure is fixed.

## Tick Readout Strip + Analysis Drawer Hierarchy (2026-04-09, commit a3f6bcc0)

### Architecture decision: Where does the per-tick value readout live?

The tick readout strip lives **inside the waveform pane** (not in the analysis drawer). This is intentional:
- The waveform pane is the truth surface — students should be able to answer "what happened at this tick?" without opening the drawer
- The drawer is for secondary analysis (Why did it fail? What do the vectors look like?)
- The readout strip is the oscilloscope "measurement bar" — always visible when a tick is selected, immediately interpretable

### TickReadoutStrip component (`surfaces/verify/TickReadoutStrip.tsx`)

- Props: `tick: number`, `signals: WaveformSignalRow[]`, `signalGroups?: Map<string, SignalLaneGroup>`
- Position: between `ide-verify-waveform-scroll` close and `ide-waveform-outer` close, where it is always visible below the scrollable waveform
- Shown when: `selectedTick !== null && lastRun && !isStepMode` (step mode has its own full snapshot panel)
- Layout: `t{N}` label → input chips (steel-blue `rgba(56,189,248,...)`) → `→` separator → output chips (teal `rgba(46,196,182,...)`)
- Testid: `ide-verify-tick-readout`; per-chip: `ide-verify-tick-readout-chip-{signal}`

### Analysis drawer tab hierarchy (target: 3 tabs)

Current state (2026-04-09): 6 display tabs renamed to cleaner labels:
- `'why'` → label "Inspect" (primary — signal explanation + tick context)
- `'mismatches'` → label "Checks" (secondary — compare mode mismatch table)
- `'vectors'`, `'truth'`, `'kmap'`, `'details'` → still exist as separate tabs (pending collapse)

Target (next slice): collapse `vectors`, `truth`, `kmap`, `details` into a single "Details" tab with internal sub-navigation. Final tab structure: **Inspect | Checks | Details**.

### Colour contract (oscilloscope channel conventions)

| Context      | Signal type | Colour          | Token                     |
|--------------|------------|-----------------|---------------------------|
| Live waveform | Input/Stimulus | Steel-blue    | `rgba(56,189,248,0.85)`   |
| Live waveform | Output/Observed | Teal         | `#2ec4b6`                 |
| Tick readout strip | Input | Steel-blue     | `rgba(56,189,248,0.85)`   |
| Tick readout strip | Output | Teal           | `rgba(46,196,182,0.9)`    |
| Ghost lanes   | Stimulus group header | Steel-blue | `rgba(56,189,248,0.40)`  |
| Ghost lanes   | Observed group header | Teal       | `rgba(46,196,182,0.55)`   |

### Signal Key Bridge (2026-04-09, commit 4e7a8c3a)

**Critical correctness contract**: IO row `id` ≠ circuit `nodeId`. Any code that bridges Verify data into the Design runtime sim must translate using `resolveVerifyInputNodeIds`.

| Key type | Example value | Source | Used by |
|----------|--------------|--------|---------|
| IO row `id` | `"sw0"` | `ioMapping.inputs[n].id`, `vector.inputs` keys | vectors, `verifyReport.inputsAtTick` |
| Circuit `nodeId` | `"sw0_node"` | `ioMapping.inputs[n].nodeId`, circuit `nodes[].id` | `projectRuntime.setInput(nodeId, v)` |

**`verifyNodeIdBridge.ts`** — `resolveVerifyInputNodeIds(inputs, verifySignals)`:
- Takes a `Record<string, 0|1>` keyed by IO row id (e.g. from `inputsAtTick`)
- Looks up each key against `verifySignals` (the `{id, nodeId}` projection of `projectIoRows`)
- Returns a new record keyed by `nodeId`; falls back to original key when no match
- Applied in IdeApp before calling `setRuntimeSimInput` in both `onGoToDesignWithInputs` and `onPreviewVector`

**`onGoToExport` wire**: `VerifySurface` declares `onGoToExport?: () => void` and renders a "Go to Export →" button when it is set and `hasSessionFailureEvidence`. IdeApp now passes `onGoToExport={() => setCurrentMode('export')}` — previously absent, making the button permanently invisible.
