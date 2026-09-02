# RedByte P2.5 — Operational Classroom Workbench Convergence — RESUME

> Single continuation point for P2.5. Newest entry at the top of the ledger.
> Canonical repo docs still win. `docs/ACTIVE_WORK.md` = project truth ·
> this file = session continuation · the P2.5 PR = public review truth.

## 2026-09-02 — P2.5E signature engineering workbench convergence: Wave 1 landed, Waves 2–3 in flight

**Status: INTERIM REDBYTE SIGNATURE WORKBENCH RECONSTRUCTION / NOT A REVIEW CANDIDATE / NOT PUSHED.**
HEAD `4e6aa285a` on `claude/redbyte-operational-workbench-convergence-w9k2r4`; origin still
`2ef5e5ee8` (ahead 45+, nothing pushed). Safety tag at the campaign start:
`safety/redbyte-before-signature-workbench-76c673580`. Worktree clean at each commit below.

**Governing concept (Connor, P2.5E):** RedByte is an engineering-causality workbench — one
selected engineering object stays understandable across Project → hierarchy → schematic →
Cases/Timing → Waveform → Board → package pin → XDC → generated artifacts. Not a Vivado copy;
an expansion that enhances understanding. Chrome is not the signature; the relationship is.

**Wave 1 — signature foundation (done):**
- `59cdf812b` Engineering Relationship Index (`ide/engineeringRelationships.ts`, derived and
  read-only over ioRows / circuit / hierarchy / scenarios / last run via `signalIdentity.ts` /
  constraint sets): field ⇄ node/port ⇄ driver & loads (module instance path) ⇄ run signal ⇄
  case checks & failing ticks ⇄ board resource / package pin / I/O standard / XDC lines in the
  active set ⇄ artifacts; duplicate ids, duplicate pins and ambiguous run signals surfaced.
  Selection continuity: schematic, Cases/Timing/Waveform, Board, Package publish to
  `engineeringSelection` and follow foreign selections. Application frame bar (graphite): identity,
  project, File/Edit/View/Run/Tools/Help (registry commands only), centre = selected object's
  relationship path (`LD1 (SUM) ← XOR2 (SUM)/out · E19`) or the command/search entry, right =
  running op / target / save. Status line = problems + evidence freshness only. Layer tokens
  (`--wb-frame-*`, `--wb-rail-bg`, `--wb-tool-bg`, `--wb-doc-bg`, `--wb-paper`); 53 mode-scoped dock
  rules and the light-theme dock overrides deleted from ide-root / ide-polish-pass /
  product-system-v3 / design-workbench-v3.
- `aaeab80cf` Documents own Simulate: Cases / Timing / Waveform tabs; the inner Cases/Bench/
  Waveform/Checks row is gone; Bench is a Live I/O toggle; Compare opens the Waveform tab; the
  Case Lab ghost Run is removed. Related… (`components/RelatedMenu.tsx` +
  `ide/workbenchNavigation.ts` opener seam) in the Design node inspector, Simulate inspector,
  Board editor: only documents the project has, each with its evidence.
**Wave 2 — Project + Design (partial):**
- `52de4a3c1` Project Architecture document (module tree · block view · interface with buses)
  and Runs document (ledger + problems); both explorer rows and workbench documents.
- `9dbaf898c` Design: continuous Fit (35–160%), Board I/O tab owns the placeable board
  resources, Components / Hierarchy / Sources / Board I/O tabs, starter narration strip deleted,
  health chip = Clean/Warnings/Errors + counts, darker net ink. `d83892ce2` no duplicate Common
  section; the first completed run opens the Waveform.
**Wave 3 — Simulation studio (in flight):**
- `4564a6b85` Timing Lab authors on lanes and edges (`surfaces/verify/TimingLanes.tsx`): tick
  ruler with rising-edge markers and failure dots, generated clock lane (1 edge/tick), reset and
  input lanes, expected-over-observed output lanes; click drives / cycles checks; the events
  table is a closed disclosure.
- `4e6aa285a` Waveform document is the trace instrument beside the evidence inspector (no case strip).
- `ac34055a0` Reviewer pass two (three bounded read-only reviewers on the Wave 1 captures; one
  Workflow, exactly three agents): Simulate Related (P0), honest case/tick naming, artifact port
  tokens in the Overview I/O table, reset lanes and changed-input truth in Timing, narrow-width
  frame/Simulate/Package layouts, one primary per document (results bar ghost; "What should I
  submit?" card deleted), Board binding chain on paper.

**Reviewer findings still open (recorded, not fixed):** constraints identity across
Project/Board/Package (explorer "1 · 5/5 mapped" vs Board "0 sets" vs Package "top.xdc ✓"; the
index emits no XDC line numbers without an active set); one problems ledger (status bar counts
design diagnostics only; Package says "Warnings 2"); Board bring-up still maps LEDs by substring
(`HardwareSurface.tsx` ~1641/1796); Waveform deck still carries four toolbar rows above the
lanes; Design library tabs clip at the 220px dock ("Sourc"); Design mode truth (Edit segment vs
inspector "Live circuit · Paused"); backward-detour vertical legs one grid from pin ends
(`orthogonalRouter.ts`); Package eyebrow truncation ("BUILD & EX…"); probe readout black band
when probes are pinned (restyled, unverified with probes pinned).

**Validation at `ac34055a0`:** rb-apps tsc 783 (= baseline) after every step; bounded sets:
chrome/authority 23/23, Simulate 26 red (all inherited names; the 27th baseline red in
`verifySurface.authoring` is now green), Design 16 red (= the 16 inherited names), Board 5 red
(name-identical to baseline), Package 37 (= baseline count) with the migrated handoff test green,
document host 11/11, Timing/Case/entry sets green. Migrated, not deleted: `workbenchChrome`
(selection/target moved to the frame bar), `workflowStages.authority` (Run menu),
`verifyCommandBar.actionRowHierarchy` / `studioRunAuthority` (documents own instruments),
`exportSurface.handoff-states` (role guide, no narration card). Owed migrations: `designSurface.
workstation` + `ideApp.labday-wiring` starter-banner assertions (strip deleted; starter identity
lives in the project name / Project overview), `verifySurface.simulationStudio` "moves
expected-output authoring into the optional Checks workspace" (Checks mode retired into Cases).
Browser proof: Related from Design → Cases lands on the same signal; rail clicks publish; Compare
opens the Waveform tab; timing lane clicks create events and checks; 44 captures re-run (no
body scroll, 0 console errors at 1440×900 / 1366×768 / 125% / 200%).

**Next (in order):** Case Lab reconstruction (compact scenario selector instead of the
permanent rail when one scenario exists; keyboard navigation; multi-row ops; failure next/prev;
run history); Waveform frame (Signal Explorer · Wave Canvas · Evidence Inspector; consolidate
the four header rows; cursors A/B, next/prev transition; narrow-width lane alignment); retire
`ScenarioBuilderPanel` sequential disclosure once sweep/hold/pulse move to lanes; Board workbench
(one constraint authority, resource property grid, 200% centre); Package Handoff Overview
(in-app derived document; nothing added to the canonical ZIP; goldens untouched); identity
consumers (Board bring-up substring, Waveform/Package) onto the index; legacy deletion
(ide-polish-pass / ide-root dead rules, `.ide-vwp-*` component, obsolete ids); SUM[2] vertical
journey capture set; keyboard / reduced-motion audit.

**Must not be reset:** everything above is committed; dev server on :5173 (`preview_start`
name `playground`); baseline worktree `.redbyte/worktrees/baseline-b635` still useful for red
classification; `capture.mjs` drives document tabs (`ide-doc-tab-cases:*`, `ide-doc-tab-waveform:*`).

## 2026-09-02 — P2.5D instrument-grade workbench convergence: shell → Project → Design landed

**Status: INTERIM REDBYTE FABLE 5.1 WORKBENCH RECONSTRUCTION / NOT A REVIEW CANDIDATE / NOT PUSHED.**
HEAD `6b45629fd` on `claude/redbyte-operational-workbench-convergence-w9k2r4`; origin still
`2ef5e5ee8`. Safety tag `safety/redbyte-before-expert-ui-reconstruction-a22a6bb8d`.
Recovery bundle of the interrupted dirty state:
`.redbyte/product-immersion/p2-5-operational-workbench/recovery-fable51-a22a6bb8d/`.

**Simulate (landed after the entry below was first written):** `3f546e33a` `feat(simulate)` — Cases document on the wb grammar (one toolbar, scenario explorer tool window + signal rail in the left dock, Case Lab grid beside a flat inspector, legacy evidence deck capped at 280px until the Waveform instrument replaces it). Verify legacy rail/dock/hierarchy-role rules deleted; the left dock follows the layout policy; dock widths follow preferences. 44 test reds across the verify + Design + shell sets, all reproducing on baseline `b635fba1f`.

**Case Lab hand-over:** `d8b09fcbb` `feat(simulate)` Case Lab owns combinational scenarios; the builder disclosure renders only for the sequential composer until the Timing Lab lands; auto-vector notice and fallback-signal warning ported into Case Lab; 27 verify/labday reds, all inherited.

**Waveform deck:** `f70cc1408` `feat(simulate)` evidence deck on `waveform-instrument.css` with --rb-wave-* tokens; the SVG viewer reads tokens (no hard-coded dark palette); verdict bar, transport, tools, bus words as rows; Waveform tab makes the deck the document. 25 waveform/verify reds, all inherited.

**Timing Lab:** `a0b3733fc` `feat(simulate)` TimingLab.tsx replaces ScenarioComposerWorkbench (deleted); events table + editor strip; ScenarioTestbenchPreview split out. Sequential builder disclosure remains until sweep/hold/pulse generators are ported.

**Board (bounded):** `8bde3da58` `feat(board)` three-column mapping workspace with the Basys3 board central, header/rail toolbars, rb-board-* owner; PinPlanner, ConstraintSetsPanel, provenance/drift callouts and the non-map modes still legacy-styled. 11 Board/export reds, all inherited.

**Package (bounded):** `8d0d6b46b` `feat(package)` status strip + file tree + code viewer + handoff rows on package-instrument.css; export reds 37 = baseline.

**Responsive + reviewer pass:** `6b45629fd` `fix(workbench)` — the ≤899px dock collapse in `unified-workbench-v3.css` (200% effective 720px: docks hidden, workspace fills), the three bounded read-only reviewers (EDA interaction, schematic/simulation visualization, adversarial visual) run once via one Workflow with exactly three agents, and the bounded fixes below. Not a review candidate.

**Reviewer pass (three bounded read-only reviewers: EDA interaction, schematic/simulation
visualization, adversarial visual) — disposition of every finding:**

Fixed in `6b45629fd` (browser-checked at 1440×900 after hot reload; captures re-run):
- Case Lab header carried a second primary Run beside the toolbar's → ghost; `ide-vcb-run`
  is the one run authority (`ide-case-lab-run` kept, tone ghost).
- Simulate inspector rows and buttons shrank inside the flex column → `flex: none` on the
  inspector's children.
- Simulate / Board collapsed at 200% (720px effective) → ≤899px rule in
  `unified-workbench-v3.css` (docks hidden, workspace fills the grid) + single-column
  `rb-sim-lab-grid` and a wrapping `rb-sim-toolbar` in `simulate-instrument.css`.
- Pin Planner overflowed the assignments pane and kept its card/pill styling →
  `rb-board-assignments` scrolls; planner head, table, sticky header, pin input and status
  badge restyled as dense paper rows in `board-instrument.css`.
- Board side dock was a dark gradient slab → hardware `[data-hierarchy-role]` dark rules
  deleted from ide-polish-pass.css / ide-root.css; side and editor paint `--wb-surface`.
- Design probe readout was a dark HUD → light readout chips in `design-instrument.css`;
  legacy `.ide-design-probe-*` rules deleted from ide-root.css.
- Inspector labelled an output pin's signal "LD0 (CARRY) · Input" (its internal `in`
  port) → `describeStudentSignalKey` names the pin itself for OUTPUT nodes.
- Pre-run evidence placeholder was a black slab with unstyled text → `.ide-vwp*` legacy
  rules deleted from ide-root.css / ide-polish-pass.css / simulation-studio-v3.css; owner
  rules in `waveform-instrument.css` (status line, fact chips, empty lanes on the wave
  palette).
- Junction dots sat on trunk-end corners → router emits a junction only where the trunk
  continues through the branch (`t.y !== yLo && t.y !== yHi`).
- Hollow pin markers read as inversion bubbles → `.rb-sym-pin-dot` hidden at rest; shown
  in wire mode, on hover, and when probed / mismatched / flagged.
- Nets carried 0/1 value tints in Edit mode with no run → tints only while simulating
  (see `design-schematic.css` stage rules).
- Every symbol wore a grey trace ring during a trace → rings only for selected / error /
  mismatch / warn tones.
- Timing Lab header lacked the Case Lab's exp · obs sub-row → two-row header
  (`rb-timing-grouphead` / `rb-timing-colhead`).
- Capture 06 was byte-identical to 05 (Waveform tab never activated) → `capture.mjs` waits
  for `[data-studio-mode="replay"]` before shooting.

Deferred (recorded, not fixed):
- Waveform lane rows still stack label + trace on narrow decks; the lane gutter needs a
  fixed-column grid at ≤1366.
- Command bar at 1366: project title clamps to 160px and the save label drops; needs an
  ellipsis/min-width pass in `workbench-instrument-system.css`.
- Fit-to-view zoom ladder is coarse (steps of the FIT_ZOOM_STEPS table); a continuous fit
  with a snapped readout is the fix.
- Library chips clip at the 220px dock; the dock tabs scroll now, the chip grid still wraps
  by min-width.
- PinPlannerPanel and ConstraintSetsPanel keep their component-level markup (restyled by the
  Board owner only where visible); the non-map Board modes remain legacy-styled.
- Board at 200% (720px effective): the header wraps cleanly now, but the three-column grid
  squeezes the centre board to nothing; stack the board under the assignments at ≤899px.
- Cases document after Compare shows two primaries (toolbar Run and the PASS bar's "Open
  circuit replay"); the replay opener should be a ghost.
- A FAIL-state capture (05b) and a Register1 starter are still owed.

**Validation after the reviewer pass:** rb-apps tsc 783 (= baseline), rb-logic-view tsc 49 (= baseline). Simulate set 26 red / 208 pass across 35 files; the same 12 failing files show 27 red on baseline `b635fba1f` — two `verifySurface.authoring` reds are fixed, and one red is P2.5D-era, not inherited: `verifySurface.simulationStudio › moves expected-output authoring into the optional Checks workspace` expects the legacy builder's stimulus summary (`ide-verify-stimulus-summary`) in a combinational studio, which the Case Lab hand-over (`d8b09fcbb`) limited to sequential runs — a test to migrate onto the Case Lab, recorded here, not hidden. Design 16 red / 264 pass = exactly the 16 inherited names. Board 5 red / 57 pass, name-identical to baseline. Package 37 red / 28 pass = baseline count (no Package source touched). rb-logic-view: all 12 collected files green; `crash-guard.test.tsx` hangs the runner at HEAD and at baseline (environmental — root vitest stalls at worker teardown on this desktop; run bounded chunks and kill only `vitest` workers). Captures: 44 fresh PNGs at 1440×900 / 1366×768 / 125% / 200%, 0 console errors, no body scroll, shot 05 (Cases after Compare) differs from 06 (Waveform) at every viewport. `git diff --check`: only autocrlf warnings.

**Commits (newest first):**
  - `1451f73c6 chore(tests): keep original line endings in the migrated Design tests`
  - `106d1f754 feat(design): schematic instrument — ANSI symbols, orthogonal nets, one toolbar, property-grid inspector`
  - `b635fba1f feat(project): replace the loaded-project dashboard with an explorer + real documents`
  - `54f2dafdd feat(shell): expert workbench frame — command bar, workspace rail, document host, status bar`

**Landed (browser-proven at 1440×900 and 1366×768, no body scroll, no console errors):**

1. Shared shell: 32px command bar with real menus (`WorkbenchCommandBar`), 56px workspace
   rail, typed multi-document host (`workbenchDocuments.ts` / `workbenchDocumentStore.ts` /
   `useWorkbenchDocumentHost.ts`), document tab strip, 22px status bar, global
   `engineeringSelection.ts` read-model. Visual owner `ide/workbench-instrument-system.css`
   (`--wb-*` tokens, wb-toolbar/toolwindow/tree/table/propgrid/menu/btn, all `.ide-root`
   scoped, no !important).
2. Project: explorer + real documents (Overview / Sources / Source file / Compile order),
   property inspector, Build Fresh + Open Starter in-app dialogs. Old dashboard owners deleted.
3. Design: schematic renderer in rb-logic-view (`symbols/portGeometry.ts`,
   `symbols/ansiSymbols.ts`, `routing/orthogonalRouter.ts`, `SchematicNodeView`,
   `SchematicWireView`, `LogicCanvas renderer="schematic"`); Design chrome on the wb grammar
   (header with module trail / wire cue / health chip / Edit-Live-Replay, one toolbar with
   Layout menu, one-line starter strip, 28px library rows + board chips, flat inspector
   sections with 24px rows, bottom panel closed by default with Problems rows / Output /
   Simulation). Owners: `surfaces/design/design-schematic.css`,
   `surfaces/design/design-instrument.css`. Legacy !important inspector cards and the dark
   design context rule deleted from ide-root.css / ide-polish-pass.css / design-workbench-v3.css.
4. Hierarchical 4-bit adder starter `four-bit-adder-hierarchical`
   (`examples/hierarchicalRippleAdder.ts`: `FullAdderCell` × u_fa0..u_fa3, carry-chained,
   SUM[2] → LD2/U19). Starters may ship a hierarchy; `stateFromExample` registers and
   elaborates it. Router detours route the carry between stages.

**Validation:** rb-apps tsc 783 (= baseline), rb-logic-view tsc 49 (= baseline);
rb-logic-view suite green; Design suite 232 pass / 17 fail — 16 of those reproduce on the
pre-Design baseline `b635fba1f` (worktree `.redbyte/worktrees/baseline-b635`, node_modules
junctioned): canvasChrome ×2, registerFamily, multiWireNet, placementMode, selectionContext
trace-group, fanout ×4, workstation ×5, continuedEditing dblclick rename. No new Design red.
`git diff --check` clean.

**Known hazards found (not fixed, out of scope this wave):**
- A user module named like a built-in composite (e.g. `FullAdder`) gets the built-in's pin
  metadata in the connectivity checker (reports `Cin` unwired while wires use `CIN`). The
  starter avoids the collision by name; the registry should namespace native modules.
- Inherited Design reds above predate this work; `ide-design-context-trace` never existed in
  source at HEAD.

**Next (in order):** Case Lab completion + delete `ScenarioComposerWorkbench` combinational
path and the `ScenarioBuilderPanel` disclosure (migrate ~23 verifySurface tests); Timing Lab
(Register1 / 2-bit counter); isolated Waveform instrument (`rb-wave`); Board & Constraints;
Package; identity migration onto `signalIdentity.ts`; legacy deletion (ide-polish-pass /
ide-root dead rules, obsolete testids); responsive / a11y hardening (narrow-width
collapse landed; keyboard + reduced-motion audit still owed); deferred reviewer items above; FAIL-state
and Register1 captures; final review-gate captures.

**Must not be reset:** everything above is committed; the dev server runs on :5173
(`preview_start` name `playground`). Baseline worktree may be removed with
`git worktree remove .redbyte/worktrees/baseline-b635` once no longer needed.

## 2026-09-01 — P2.5B workbench-core reconstruction, wave 1: identity seam + recon

**Status: INTERIM. The engineering-identity foundation is landed and the whole
architecture is mapped. Items 1–6 of the review gate are NOT all operational.**
Local candidate, unpushed. See `ARCHITECTURE_MAP.md` (same folder) — read it
first next session; it prevents re-investigating that the shell/store already
exist.

**Safety tag:** `safety/redbyte-before-workbench-core-reconstruction-e5388fd05`.

**Landed this wave (branch `claude/redbyte-operational-workbench-convergence-w9k2r4`,
now ~13 commits ahead of origin, nothing pushed):**

1. `feat(identity)` `signalIdentity.ts` — the production identity seam. Replaces
   Case Lab's string-containment field↔signal match with a resolver over the run
   evidence (`normalizationMap` role-'expected' + `ioRows`): precedence
   exact → evidence-expected → evidence-node, candidate must appear in the report
   set, >1 candidate or cross-field collision ⇒ 'ambiguous' (surfaced, never
   guessed), hierarchy preserved. 10 tests (containment traps, hierarchy,
   ambiguity). Case Lab reads observed/verdict through it against the RAW report
   rows (same identity space as the evidence). **Reuse this for Waveform / Board /
   Package** — do not add per-surface adapters.
2. `docs` `ARCHITECTURE_MAP.md` — the 10-agent recon: canonical `PortRef`
   identity, the ONE store `useProjectRuntime`, the EXISTING shell
   `IdeWorkbenchShell` (100dvh/splitters/docks — live-verified no body scroll),
   the real shell gaps (general document tabs, global selection), surface reality,
   and the verify-CSS maze to route around.
3. `refactor(project)` — removed the permanent cross-probe pill legend
   (Exact/Partial/Ambiguous/Stale/Unavailable); quality now rides each row badge
   with a self-explaining tooltip (`crossProbeQualityDescription`). Dead legend
   CSS + unused `QUALITY_TIERS` removed; legend test rewritten to the new behavior.
4. `feat(sim)` — Case Lab now OWNS add / duplicate / delete case (toolbar +
   per-row controls, keyboard-reachable), resequencing ticks contiguous. No
   longer depends on the hidden legacy disclosure for those core operations.

**Validation (pinned Node 20.19.0):** rb-apps typecheck held at 729 baseline
across every commit (measured); verifySurface held at its 24-failure inherited
baseline across every commit; signalIdentity 10/10, crossProbePanel 5/5,
verifyCommandBar+ScenarioBuilderPanel green. Browser-proven on the Full Adder at
1440×900: full truth-table Compare → all observed + pass via the resolver; one
corrupted SUM → exactly one failing case; add/dup/delete keep ticks contiguous.
Dev server left running at http://localhost:5173.

**NOT done — remaining review gate (do in order; ARCHITECTURE_MAP has the how):**
- **Shell gaps:** a general multi-document tab/editor-group model (only
  Simulate-scoped `TestbenchDocumentTabs` exists — generalize it); a global
  engineering-object **selection** authority (cross-probe backbone, now that
  identity is solid). The frame itself already exists — do NOT rebuild it.
- **Project (item 2):** convert explorer entries from navigate-to-surface to
  open-document-in-center; lift `ProjectSourceFiles`/`CrossProbePanel`/
  `ProjectCircuitPreview`/Technical-details into center documents; remove the
  "Next: Simulate" narration card. Legend already removed.
- **Design (item 3):** real schematic — logic symbols, orthogonal routing,
  junctions, hierarchy/bus visibility, property-grid inspector, semantic zoom.
  `rb-logic-view/LogicCanvas.tsx` (+ baseline tsc errors) is the owner;
  `rb-viewport/transforms.ts` for the camera. Prove on Full Adder AND the
  hierarchical 4-bit adder.
- **Case Lab completion (item 4):** migrate the remaining ScenarioBuilderPanel
  authoring affordances (sweep/hold/project-vectors) into Case Lab, migrate the
  ~23 disclosure-dependent verifySurface tests to product behavior, then retire
  the combinational `ScenarioComposerWorkbench` + the disclosure.
- **Timing Lab (item 5) — NOT STARTED:** sequential instrument for a counter
  (`packages/rb-apps/src/examples/04_4bit-counter.json`,
  `22_lab7-sync-counter-starter-basys3.json`) or Register1. Build a cycle ruler +
  clock/reset/input/state/expected lanes + edge markers + edit + run, rendered as
  the sequential center (replacing `ScenarioComposerWorkbench` for
  `isSequentialRun`, mirroring how Case Lab replaced it for combinational).
  Investigate the sequential run/state model first (how clock edges map to ticks,
  how state is captured in the run report/waveform).
- **Waveform (item 6):** isolated frame OUTSIDE the `.ide-verify-region--waveform`
  / `.ide-verify-lab-grid` namespace, drawing `--rb-canvas-dark*` tokens (not the
  hardcoded `#080e16`/`#0a0f18` slabs). Reuse only the `SignalSource` TYPE from
  rb-instruments (its dock is dead). Add Case↔Wave and Timing↔Wave selection sync
  through the `signalIdentity` resolver.

**Exact next step:** read `ARCHITECTURE_MAP.md`, then either (a) generalize the
document-tab model + a global selection authority (unblocks Project/Design/Wave
cross-probe), or (b) build the Timing Lab v1 on the 4-bit counter fixture. Do not
push; do not merge/retarget PR #84/#85; format version stays 1; goldens untouched.

## 2026-09-01 — P2.5B desktop-workbench reconstruction: first domain instrument (Case Lab)

**Status: INTERIM. One genuine instrument landed and browser-proven. The full
P2.5B reconstruction (shell rebuild, Timing Lab, Design schematic dominance,
Project document model, Board/Package regrammar) is NOT done.** Local candidate,
awaiting Connor's review. Nothing pushed/merged; no Vivado/bitstream/hardware
claim. Branch `claude/redbyte-operational-workbench-convergence-w9k2r4`, 8 commits
ahead of origin; dev server left running at http://localhost:5173.

**Landed this session (2 new commits on top of the prior six):**

- `feat(sim): Case Lab` — the combinational simulation instrument is now an
  editable **truth-table grid**, not a column of event cards. One row per case;
  Input columns; per-output **expected/observed** pairs; a per-case verdict.
  Expected cells cycle unset→0→1→unset in place (the authoring path that enables
  Compare). Observed + verdict are resolved through a normalization-resilient map
  (`caseLabData` in `VerifySurface.tsx`) that matches a run report row keyed by the
  canonical output signal — e.g. `ld0carry` — to its output field `ld0` by
  bidirectional normalized-key containment. New owner:
  `packages/rb-apps/src/apps/ide/surfaces/verify/CaseLab.tsx`.
  Rendered for the combinational path; sequential still uses
  `ScenarioComposerWorkbench`; the detailed event table (`ScenarioBuilderPanel`)
  stays available in a collapsed `<details>` disclosure below Case Lab (it still
  owns add-vector / sweep / project-vectors authoring affordances that Case Lab
  does not yet replicate, and ~23 verifySurface tests depend on it — do NOT strip
  the disclosure until those are migrated).

- `test(verify)` — realigned three inherited-red assertions to shipped copy/shape
  (studioRunAuthority 5→4 lenses; two ScenarioBuilderPanel summary strings).

**Verification (pinned Node 20.19.0 via portable `.redbyte/tools/node-v20.19.0-win-x64`):**
- Browser-E0 on the Full Adder at 1440×900: authoring the full 8-case truth table
  and running Compare shows all-observed + all-pass (observed per row =
  00,01,01,10,01,10,10,11 = the correct CARRY,SUM table); corrupting one SUM
  expectation marks exactly one case `fail` (its observed cell flagged,
  "8 cases · 1 failing", inspector "LD1 (SUM) — Failing at this event").
- Zero net rb-apps typecheck errors (729 baseline held, measured by stash/compare).
- Zero net verifySurface regressions: **24 failed at pre-Case-Lab baseline,
  24 failed at the Case Lab commit** (measured by checking out `42d5ab66a` and
  stash-comparing). The 24 are inherited, pre-existing.
- verifyCommandBar / ScenarioBuilderPanel / testbenchCaseGeneration suites green.

**Key finding for the next session — the "crammed / nothing fits" problem is
structural, not CSS-surface.** The verify workspace layout is a deeply
conditioned grid in `ide-polish-pass.css` (many `data-verify-workflow-phase` /
`data-workspace-mode` / breakpoint variants, heavily `!important`). Piecemeal
CSS/grid edits there are high-risk (they regress the pre-run, failure-
investigation, and compact layouts). The dark waveform region stacked under the
light Case Lab is a genuine "black slab" clash. A real fix needs a deliberate,
isolated shell/instrument-frame rebuild, not incremental patching. Attempting a
`stimulus-focus` reallocation for the scenario tab was tried and reverted (it
shrank the Case Lab row rather than reclaiming space).

**Immediate next targets (honest remainder of P2.5B):** sequential **Timing Lab**
instrument (Register1/Counter fixture); Design schematic as the dominant Design
instrument; Project **document model** replacing the pill-soup explorer (the
"Source — visual cross-probe" 5-pill cluster is the worst offender on the landing
surface); Board/Package in the same grammar; then migrate the ~23 disclosure-
dependent verifySurface tests and retire `ScenarioComposerWorkbench` for
combinational once Case Lab reaches authoring parity.

## Canonical state

> The live branch HEAD is whatever `git rev-parse HEAD` / the PR reports — this
> file does NOT hardcode a self-referential "current HEAD" that goes stale the
> moment the next commit lands. The fields below name durable anchors only.

- **CONTINUATION BRANCH:** `claude/redbyte-operational-workbench-convergence-w9k2r4`
  (created from the corrected P2 head; PR #84 remains the immutable P2 review).
- **CURRENT PR:** #85 — P2.5 draft, open, mergeable, **targeting
  `claude/redbyte-product-core-convergence-n3pi6t`** (temporarily stacked on PR
  #84; retarget to `product/redbyte-workbench-v3` only AFTER #84 merges — never
  before, and never by this session).
- **BRANCH POINT:** `f8899a462` — the P2 truth-correction commit = PR #84 head =
  PR #85 base SHA.
- **LAST VERIFIED PRODUCT COMMIT:** `1c5c4745e` (Slice 3 compare-verdict fix).
  GitHub reports **six** commits on the branch point (not five):
  `8a5cbef74` Slice 0 baseline + imported-VCD demotion → `359adc098` Slice 1
  shell status authority → `49abc102f` Slice 2 Project landing → `02dc9e147`
  labday harness/stale-testid repair → `1c5c4745e` Slice 3 Compare verdict →
  the first documentation-refresh commit (docs only).
- **CURRENT PHASE:** first checkpoint delivered — Slices 0–3 + labday baseline-red
  repair (13→4). The real UI-driven Journey A, Board (Slice 4), and Export are the
  next work.
- **CURRENT ACCEPTANCE PROOF (honest, narrow):** `compare-verdict-journey.mjs`
  proves ONLY the Compare verdict transition — a run presents PASS, a deliberately
  changed design presents FAIL, and undo + rerun returns to PASS — at 1440×900 and
  1366×768, 0px overflow. It does NOT prove failure diagnosis, mismatch rows,
  source/Design tracing, scenario preservation, mapping, trusted export, download,
  or reload. It also currently drives the runtime store directly (`loadExample`,
  `autoSuggestMapping`, store gate-lookup, force-click), which the P2.5 acceptance
  contract forbids. Replacing it with a genuine student-driven journey is required.
- **BLOCKERS:** none on the branch itself. Format v2 stays gated behind
  `FORMAT_V2_SIGNOFF.md`; format version 1; both classroom goldens byte-identical
  (last verified 2/2 green under the pinned runtime). PR #84 not merged; do not
  merge or retarget.
- **LAST VALIDATION (pinned runtime, cloud session):** shell-status-authority,
  project-landing, compare-verdict journeys PASS at both viewports (0px overflow);
  verify suites 30→26 failed (+4, 0 regressions); labday 13→4; both classroom
  golden export gates byte-identical. CI: PR Fast Checks run #81 SUCCESS at the
  checkpoint head (`b952d46b`); PR #84 head `f8899a462` also green.
- **RUNTIME CAVEAT:** this branch was built and validated in a Linux cloud session
  under the repo pin (Node 20.19.0, chromium at `/opt/pw-browsers/chromium`). The
  desktop clone currently runs **Node 24.15.0** with no pinned Node installed;
  golden SHAs are known to drift under Node 24, so golden-gate re-verification is
  NOT faithful from the desktop until Node 20.19.0 is available.
- **NEXT REQUIRED JOURNEY:** a UI-only Full Adder acceptance journey (zero store
  actions) — Project → Start a Lab → Design → author a check → Compare PASS →
  runnable wrong-logic edit → FAIL with a concrete mismatch → Trace in Design →
  repair → PASS → Board mapping → trusted export → download → reload.
- **DIRTY FILES:** none.

## Known redder-than-recorded baseline (pre-existing, not P2.5)

Slice 0 recorded only ~8 verify reds. Real pre-existing baseline is larger:
verify suites ~30 (now 26 after the Slice-3 fix); `ideApp.labday-wiring` was 13
(now 4 after the harness/stale-testid repair); `projectSurface.submission` 4 +
`continuity` 1. All reproduced with P2.5 changes stashed. Remaining reds are the
Slice-7 disposition backlog — product-triage the real ones, update only
demonstrably-obsolete assertions, never blanket-skip.

## Program (do not lose Connor's intent)

Convert the technically-capable P1/P2 candidate into a coherent, practical,
classroom-usable workbench. NOT P3 cloud, NOT format-v2, NOT feature-breadth.
Connor's core complaint: too many tabs/cards/pills/panels, inconsistent density,
surfaces that don't feel like one app, technically broad but not practically
useful. He likes strong conceptual visuals (circuit preview, waveform, board
diagram, source↔visual highlight), practical density, clear hierarchy. The fix is
NOT a flat/empty/generic UI and NOT more tabs — it is intentional hierarchy,
consolidation, and making the primary student task dominant on each surface.

Spine: Project → Design → Simulate → Board & Constraints → Build & Export.
Import/Recover is a utility. Vivado is external (Browser-E0).

## Slice status

- **Slice 0 — baseline + immersion:** DONE. CI verified green at `803e2dfd0`;
  P2 truth docs corrected (on the P2 branch, commit `f8899a462`); real-UI
  screenshots of all five surfaces at 1440×900 + 1366×768 captured under
  `baseline/`; the four baseline-red suites reproduced and their exact failures
  recorded (see DECISION_LEDGER). No root overflow on any surface at either
  viewport — the shell geometry holds; the problem is density/hierarchy/clutter.
- **Slice 3 (first increment) — Simulate density:** DONE. The imported-VCD
  Analyzer no longer dominates a native project: with no VCD loaded it collapses
  to a single compact "Load .vcd file" affordance (still honest: "replayed, never
  executed"), reclaiming ~180px so the native scenario timeline + Drive inputs +
  Inspector lead the first viewport. Browser-proven; before/after screenshots in
  `baseline/simulate-1440x900.png` vs `baseline/simulate-after-fix-1440x900.png`.
- **Slice 1 — shell/geometry:** DONE (status authority). The footer no longer
  duplicates the stage-nav's per-stage workflow status (Simulate/Board/Package
  pills removed); the footer is now support-context only (checks/storage/problems)
  and the stage-nav is the single per-stage authority. Browser-proven at both
  viewports (`shell-status-authority-journey.mjs`, 0px overflow); 7/7 focused
  tests green. On verification, three audit items were REJECTED (LocationBar is a
  real cross-mode nav authority; the save-label display:none is an intentional
  1366px-fit pair with the footer Storage pill; the Board chip is product
  identity, not duplication) and the two-stylesheet CSS merge was DEFERRED as a
  visual-regression-prone change needing headed review. See DECISION_LEDGER D-2.
- **Slice 2 — Project landing:** DONE (`49abc102f`, browser-proven both
  viewports). Leads with one dominant "Start a Lab" over a subordinate
  alternatives cluster; the giant hero and narration line are gone. Open
  remainder: the empty region below RECENT and the loaded-overview consolidation.
- **Remaining:** Slice 3 follow-on (real failure diagnosis — mismatch rows vs
  structural failure; a UI-only Journey A), 4 (Board consolidation + Export
  readiness + FPGA-part authority), 5 (import review E2E, hand-authored source
  persistence, parameters, Vivado twin ingestion), 6 (five Gannon labs), 7
  (baseline-red disposition + state audit). Journeys A–E.

## Ledger (newest first)

- **LOCAL UI ARCHITECTURE INTERVENTION — awaiting Connor's visual review — NOT PUSHED.**
  Connor inspected the running app and found it a card/pill/narration-heavy
  educational game, not an engineering workbench. First candidate reconstructs the
  shared shell + Project + Design + Simulate into a professional desktop grammar.
  Local commits on top of origin `2ef5e5ee8` (origin unchanged; safety tag
  `safety/p2-5-before-ui-architecture-intervention`): `492b41b0f` shell ·
  `c9f1a4196` project · `232fe970a` sim · `7e7125da1` design.

  | Region | Decision | Result |
  |---|---|---|
  | Top workspace nav | RECONSTRUCT | Game-progression bar (icon+checkmark+status subtitle+"!") → compact text tab strip (Project/Design/Simulate/Board/Package, active underline) |
  | Project identity + 6 metadata boxes | DE-CARD | One inline property row; identity is a plain header, not a card; dropped Readiness + eyebrow |
  | Project workspace header + evidence-tier | DELETE | Narration + "Behavioral evidence" internal taxonomy removed |
  | Project right rail (5 cards) | CONSOLIDATE | Next action + current problems only (de-carded); removed Recent activity / Runs / duplicate Project actions |
  | Simulate provider banner (E0/Imported pills + prose) | DELETE | Gone on native; compact source toggle only when a .vcd is loaded; boundary stated once in Package |
  | Simulate imported-VCD row | MOVE | Renders only once a .vcd is loaded |
  | Simulate "Testbench" tab | MOVE | Removed from the equal lenses (generated HDL belongs in Package) |
  | Design selection inspector | DE-NARRATE | READY badge + "Start at… inspect the path" narration removed; shows Type/Signal/Samples properties |

  Validation (pinned Node 20.19.0): unified build **green**; CSS ownership audit
  **clean**; tsc **770 → 770 (zero net, no orphans)**; the UI-only Full Adder
  journey **passes both viewports** (function intact — edit + simulate + trace +
  repair). After-screenshots:
  `.redbyte/product-immersion/p2-5-operational-workbench/evidence/ui-intervention/`
  (project / design / simulate-cases / simulate-waveform at 1440×900 and 1366×768).
  Dev server left running at `http://localhost:5173` (Full Adder loaded).

  Still open for the deliberate visual pass (Connor's direction): waveform even
  more dominant + "Selection guidance" narration in the Simulate inspector; the
  four pre-existing CSS side-tab/grid smells; the cyan gate glow; Design bottom
  panel closed-by-default; Board & Package (untouched — apply the same grammar
  after approval); and the presentation-test updates the reconstruction obsoletes.
  No PR update / push until Connor approves the direction.

- **Local ThinkStation session — run intent, FPGA-part, UI-only Journey A core.**
  Environment corrected to the repo pin (portable Node 20.19.0 at
  `.redbyte/tools/node-v20.19.0-win-x64`; all local validation runs under it).
  - `3d65bf423` `fix(sim)`: render the Observe/Compare run-intent selector (was
    dead props) and make it authoritative; a structurally-blocked Compare stays
    selected + disabled ("Compare blocked") with the Design-repair path, never a
    silent Observe. 8 command-bar + 1 structural-block test fixed; 0 regressions;
    **CI green under Node 20.19.0**.
  - `583fef846` `fix(target)`: FPGA part is board-owned read-only (Basys3 →
    xc7a35tcpg236-1); removed the freeform edit the export always ignored; labday
    test moved to the board-owned contract.
  - `04b980b90` `test(e2e)`: `full-adder-operational-journey.mjs` — **UI-only**
    Journey A core (zero store actions): first use → Start a Lab → Lab 3 Full
    Adder → Design → Compare PASS → inspector gate-swap XOR→OR → Compare FAIL with
    a concrete mismatch → Trace in Design → repair → PASS, both viewports,
    cross-platform, 0px overflow, 0 errors.
  - **Next:** author-a-check step; extend the journey through Board mapping →
    trusted export → download → reload; then the Board & Export convergence
    (Sections 6 & 8 — a deliberate design pass, not to be rushed).
- **Slice 3 follow-on — failure-diagnosis authority fix + investigation (`b5453b2a2`).**
  Live browser investigation corrected the D-5 framing: the runnable wrong-logic
  path already shows a full, visible failure diagnosis (advanced-failure panel +
  first-mismatch fail-nav + drawer mismatch table + trace-to-Design); gate deletion
  is STRUCTURAL (output floats to X) and is intercepted upstream by the compiler's
  `blockingDesignIssue` (Compare blocked). Landed a pure-authority fix so
  `diagnoseVerifyFailure` treats an observed `X`/`-` failing output as
  `disconnected-output` (Design repair), not a fixable expected-value mismatch (+3
  tests, zero regressions). Two real browser-provable defects recorded for the next
  slice (see DECISION_LEDGER D-6): the "Design blocks Compare" structural callout does
  not reliably render after a gate delete, and the Observe/Compare intent toggle is
  not rendered (dead `VerifyCommandBar` props) — the latter blocks the UI-only Journey
  A. Node 24.15.0 desktop; goldens untouched.
- **Slice 3 first increment — Simulate imported-VCD demotion.** `VcdAnalyzerPanel`
  gains a compact early-return for the no-waveform/no-error case (a single
  provider chip + honest note + Load button) instead of the full header + honesty
  paragraph + giant dashed empty box. Directly answers Connor's #1 visible
  clutter complaint and the directive's "Imported VCD should not dominate a
  native project before a VCD is loaded." Reuses the existing `importedWaveform`
  authority — no new store, no format change. Test + 1 journey step updated to
  assert the compact affordance.
- **Slice 0 — baseline + immersion.** See Slice status + DECISION_LEDGER +
  VISUAL_JURY.
