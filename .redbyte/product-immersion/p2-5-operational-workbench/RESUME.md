# RedByte P2.5 — Operational Classroom Workbench Convergence — RESUME

> Single continuation point for P2.5. Newest entry at the top of the ledger.
> Canonical repo docs still win. `docs/ACTIVE_WORK.md` = project truth ·
> this file = session continuation · the P2.5 PR = public review truth.

## 2026-09-06 - P2.5K instrument composition, interaction choreography, high-zoom frame (Opus 5, desktop session)

**Label: REDBYTE INSTRUMENT-FINISH CANDIDATE / VISUAL SYSTEM LOCKED / FUNCTIONAL FOUNDATION
PRESERVED / FEATURE BRANCH PUSHED / PREVIEW SHA VERIFIED / PR #85 DRAFT / NO MERGE / NO
PRODUCTION.**

Connor's verdict opening this session: ~75-80% overall, the typography and surface foundation
from P2.5J **accepted and not to be rebuilt**. The remaining work was named as composition and
choreography: what a surface says, in what order, and whether it survives a reader who needs
larger text. Branch point and safety tag: `safety/redbyte-before-instrument-composition-d64c2e1d7`.

### The frame was in pixels while the text was in rem (`e4e9e2dd0`)

At 200% text this was not a cosmetic complaint. Measured before: the Help menu's border box
overlapped the command-palette entry by **60.6px**, `elementFromPoint` inside the palette's own
box returned the Help button, and a real click there opened Help. Cause: command bar 32px,
status bar 22px, activity rail 56px, tab strip / toolbars 30px, rows 26/24px, controls 24/28px,
indent 14px - every frame value absolute while the type inside doubled. All eleven are `rem`
now, each identical to the pixel it replaces at a 16px root, so a 100% desktop does not move.

The bar composes against the window measured in the reader's own text size
(`window.innerWidth / rootFontSize`), because `rem` inside `@media` resolves against the
browser's *initial* font size and can therefore never see an enlarged root - `matchMedia
('(max-width: 64rem)')` was measured `false` at root 32px on a 1366px window. Below 64 text
widths the five menus fold into one that keeps every command (with arrow keys, roving focus and
the same flat item list), the wordmark folds to the mark, and the run fact moves into that menu
because the status bar already carries it. The target fact stays in the bar.

Three pixel guesses went with it: `max-width: 1400px` hid the save-state word, so on every
1366-wide machine priority 3 was a 7px dot at any text size; `max-width: 899px` hid the whole
centre region, which is priority 1; and the brand mark declared a width with no `flex`, so it
computed to **0px** at 200%. The run intent was clipped in silence - a segmented control with
`overflow: hidden` and an ordinary flex-shrink, which is how "Compare" rendered as "Cor"; a
segmented control is one unit and does not shrink below its buttons.

New probe `packages/rb-e2e/chrome-priority-probe.mjs` asserts the whole priority order at
1440x900, 1366x768, 1024x720 and at root 32px on both large viewports: no sibling overlap, no
control whose own box belongs to something else, all six priorities present, anything clipped
carrying a title or label, no horizontal document overflow, and the primary Run sharing a row
with the intent it belongs to. Measured after: **0 overlaps, 0 clipped children, 0 stolen
clicks.**

### Five outside gates classified, two harness defects found (`ce80fd1c9`)

Every `ide:gate:*` failure outside `verify:gates` that this campaign touched was reproduced,
traced to the commit that made it impossible, and dispositioned - never left as "baseline red".
All five shell gates were **Category B, obsolete assertions**: each dies on its first assertion,
and each names a control deleted with `IdeLeftRail.tsx` in `24de703b6` (2026-07-25) or a pixel
constant the shell stopped producing. None was a product defect.
`ide:gate:shell-chrome-contract` is deleted and its two unique facts moved into
`ide-shell-layout-integrity` - which asserted the exact inverse, so the two could never both be
green - expressed against the frame tokens rather than numbers copied into a gate years ago.

Two defects surfaced while classifying. (1) `scripts/gates/_gateHarness.mjs` accepted any HTTP
status below 500, so an empty `apps/playground/dist` served a 404 that counted as ready and
every product selector then looked missing - in any of the ~190 gates routed through it; it now
asserts the build exists and requires `response.ok`. (2) The shell published
`data-console-state="expanded"` whenever the console existed, ignoring whether it was expanded,
while the panel below published the truth.

Still red at the committed baseline on their own assertions, and **not** classified this session:
`ide:gate:export-e2e-contract`, `ide:gate:action-first-entry-surfaces`,
`ide:gate:export-artifact-direct-preview`. They need the same treatment.

### Design (`e0c63722e`, `950441cc1`)

- The inspector dock was itself the scroller with **304px of overflow**, so reading a section
  carried the tab strip and the selected part's identity off the top - you could not see what
  you were reading about. It is a fixed head over one scrolling body now.
- The toolbar wrapped to two rows at 1366x768 as soon as a student had run something (the
  Related control needs 71px; the bar had 17px of slack). It budgets its width with a container
  query and folds the camera pair into the View menu, where both already live.
- At 200% the two support docks took **992px of a 1366px window**, leaving the schematic 262px.
  Dock widths are floored by their own words and capped by the window (`26vw` / `24vw`) in
  `product-system-v3.css`, which is the real `!important` owner.
- **Product defect:** the overview map is an overlay on the drawing and took every click inside
  its 150x110 box, so a part in the bottom-right corner of the sheet could not be wired at all -
  the blank-project authoring journey failed on exactly that, with Playwright naming the
  minimap's SVG as the intercepting element. It is a presentation layer now, listed in View,
  **off by default**, and inert while a wire is being drawn. `rb-logic-view` is consumed as a
  built package, so source edits there need
  `corepack pnpm --filter @redbyte/rb-logic-view build`.

### Simulate (`8ce18cf74`)

The waveform - the evidence a failure points at - was laid out **359px below the pane that holds
it, showing 125px of the 448px it needs**, with its own scroller reporting nothing to scroll.
The waveform region constrains the instrument now (`grid-area: evidence`, `min-height: 0`,
`overflow: hidden`) and the instrument scrolls itself, where the lane labels stay with the lanes.

The failure focus held six of the ten facts a reader needs: it offered "First mismatch" and then
printed "Fail 1 / 2" with no control to reach fail 2, while the verdict, the case number and the
way out to Design were elsewhere or absent. One row (`ide-verify-fail-nav`) answers all ten.
And `Trace in Design` resolved its tick as "wherever the replay is resting", so it could hand
Design a passing case while the surface said FAIL; it now prefers the resting tick only when the
reader is actually resting on a failing row.

Not reproduced: the reviewer's report that the inspector describes t2 while the failure is at t3
- measured "Case 3 - t3 - Failing at this event" in the settled state. The tick-resolution
hardening was kept regardless.

### Board (`46c4aa307`)

Nothing on the board could be reached without a mouse: the SVG contained **zero focusable
elements and zero ARIA roles**, and Tab skipped all sixty-odd resources. It is a listbox with a
roving tabstop now - measured **74 options, 74 focusable and labelled, 1 tabstop**; arrows walk
them (with `preventDefault`/`stopPropagation` so the camera does not also pan), Enter or Space
assigns. "Next unmapped" resolved to *the first* unmapped signal and hid itself whenever that
was the selected one, so it disappeared exactly when a student started working the queue; it
means the next one after this one now, with a Previous beside it and wrapping. The XDC block ran
**280px past the viewport** sharing one scroller with the signal identity it describes.

### Package (`41690d135`)

Build & Export opened on a file browser with every other concept underneath it - **seven
top-level regions in a 2241px scroll inside an 816px pane** - and opening the handoff dossier
mounted it *inside* that stack rather than replacing it. It opens on the dossier now, one
document owns the surface at a time, and the primary action follows the active document. Every
row of the artifact manifest opened the same file; each opens its own.

### Validation at `950441cc1`

- `pnpm verify:gates` **exit 0** at every checkpoint (28 chained gates; no `ide:gate:*` entries
  are inside it - those are ~190 separate scripts through `_gateHarness.mjs`).
- Typecheck **778 errors, unchanged** after every wave.
- Journey inventory recomputed from repository truth: `packages/rb-e2e` holds **29 `.mjs` files
  - one shared harness, one evidence-capture tool that asserts nothing, and 27 journeys. All 27
  executed against one build; all 27 pass.** Nothing excluded, nothing partial.
- Two journeys were updated because the route a reader takes moved, not because an assertion was
  inconvenient: `signature-journey` opens the electrical disclosure on Board, and
  `nested-adder-journey` Stage F opens the artifact document from the dossier's own header.
- `packages/rb-e2e/_tmp-shots.mjs` renamed to `visual-evidence-capture.mjs` and documented as a
  tool that asserts nothing, parameterised by `RB_SHOT_LABEL` / `RB_ROOT_PX` / `RB_MODES` /
  `RB_SIZES`.
- `a11y-scale-journey` failed once at 1366 in the menubar theme-restore step and passed on
  re-run - recorded as nondeterminism to watch, not a regression.

### Not delivered this session, stated plainly

- **The Board Guided/Expert split (directive SS8).** It is a feature, not a finish, and it is the
  largest single item left in this campaign.
- The Project/Start final consistency pass (directive SS10) beyond what P2.5J already landed.
- The three export `ide:gate:*` gates named above.
- At 200% text the Design toolbar is three rows. The frame no longer collides and nothing is
  clipped, but the workbench is cramped at that setting and is described that way.

### Boundary honoured

No merge, no retarget, no `main`, no `product/redbyte-workbench-v3`, no production Cloudflare
deploy, no public release, format version stays **1**, no golden regeneration. PR #85 remains
**draft** with base `claude/redbyte-product-core-convergence-n3pi6t`.

## 2026-09-06 — P2.5J visual craft, spatial coherence, instrument finish (Opus 5, desktop session)

**Label: REDBYTE VISUAL CRAFT CANDIDATE / FUNCTIONAL FOUNDATION PRESERVED / FEATURE BRANCH
PUSHED / PREVIEW SHA VERIFIED / PR #85 DRAFT / NO MERGE / NO PRODUCTION.**

Connor's verdict opening this session: functional depth 85–90%, workbench architecture 75–80%,
visual system consistency 50–55%, layout ergonomics 55–60%, school-facing finish 50–55%,
overall ~70%. "The engineering models have become sophisticated faster than the visual language
used to present them." Functional proof was explicitly ruled out as a rebuttal.

### What the audit measured, before any change

- `--wb-paper` and `--wb-surface` were declared as the identical value `#fbfbfa`: three surface
  roles, two values. The widest step in the whole light palette was **1.09:1**, so hierarchy was
  being drawn with hairlines — 78 visible border edges on Project, 176 on Design, 273 on Board,
  302 on Simulate.
- Four type families reached the screen; the two most common were **Segoe UI Variable (572
  elements)** and **Cascadia Mono (433)** — Windows and terminal fallbacks, not choices. IBM Plex
  was declared three times in three files and loaded never. 11 distinct sizes including 8.8px,
  9px, 10.5px; six weights including synthetic 650 and 900.
- Setting text size to 200% left the page **pixel-identical** — every step of the scale was
  absolute px. WCAG 1.4.4 failed outright while the surfaces "supported 200%".
- 232 rules set `text-transform: uppercase`; the Design inspector alone stacked nine all-caps
  eyebrows and the Start Center detail pane ten.

### Landed (four commits on the same branch, all pushed)

- `d6c67b386` — three surface planes (`#f2f4f7` / `#ffffff` / `#f7f9fb`); the rem scale with
  1321 literal declarations moved onto it (rail label 11px → 22px at 200%); IBM Plex Sans
  Variable + IBM Plex Mono bundled locally, never from a CDN; families 4 → 2, sizes 11 → 7,
  weights 6 → 4; `small` given a rule at last (source of the 9.6px text and of
  "Unassigned0all required mappings assigned"); the component library stops clipping its rows;
  `.rb-board-editor-head` given the rule it never had ("ConstraintsLive mapping"); the collapsed
  console repaired from a zero-height dead state to a 28px strip.
- `7b3615d10` — Board: the assignment table measured **744px inside a 339px pane**, so four of
  six columns including Action began off-pane (Action by 404px) with no horizontal scrollbar;
  cells wrap at word boundaries now and the pane is 480px (measured after: 479px table, 479px
  pane, `scrollWidth == clientWidth`). The Pin planner and the assignment table listed the same
  five signals twice; one leads, the other is a disclosure that opens itself on a conflict. A
  mapped signal was told to "Choose a compatible cont…" because the control was bound to the
  *pending* canvas choice. The ribbon stated mapping-complete six times. Package said its state
  three times in six rows, its handoff inspector truncated the values that identify the
  artifact, and its provenance graph pushed "Download package" 39px below the fold.
- `c5e9c4bb5` — Design: the palette rendered a **276px grid column into a 175px box with
  `overflow: hidden`**, cutting away the port signature on every row; the left dock default is
  264px. 180px of the toolbar was a second copy of the inspector's Net tracing group (`Driver`
  → `focusSelectedPath`, `Loads` → `handleFanoutTrace` — the same handlers as `Focus path` and
  `Trace net`); `Layers ▾` and `Layout ▾` became one `View ▾`; the toolbar is one row. The
  bottom-panel restore floated at z-index 30 over the inspector's last rows and is now the same
  28px strip the console uses. Simulate's scenario panel was **302px tall around a 28px header**
  → 29px.
- `c8e0dcfee` — the starter-detach honesty fix (below), Project's architecture figure (**668×411
  box for a 734×128 drawing** — 72% empty) sized to its drawing, 13 more all-caps eyebrows in
  sentence case, and every info callout's body made readable (`.ide-callout-info
  .ide-callout-body` was pinned to `rgba(220,234,252,.92)`, a dark-shell near-white landing about
  1.1:1 on the light workbench).
- `d46d2350e` — Simulate's failure header: counted on a real Compare FAIL, **17
  visible elements state the failure**, three of them on one line. Most are earned (`Fail
  window`, `Stop at fail`, `First mismatch`, the mismatch cell itself). The subline now carries
  the scenario instead of repeating the headline; run-shape metrics step back from the two
  counts that matter. The Problems row stops breaking "LD1 (SUM) simulation run" across three
  lines.

### One functional defect found and made honest, not hidden

Measured UI-only: **Lab 3 loads with 8 vectors carrying 16 authored expected outputs; one
compatible gate swap in the Design inspector leaves 8 vectors and 0.** Simulate then greys out
Compare and says "Author at least one expected output to compare against", as if the student
never had any.

The clearing is deliberate and is left alone — `reconcileTestbenchAfterDesignChange`, gated on
`isDetachingFromExample && scenarioAuthority === 'starter'`: changing the behaviour detaches the
project from its starter and the starter's answers stop describing the student's circuit. What
was wrong was the silence, and the path-dependence it hid: **run Compare once before the edit and
the same swap keeps all 16**, because the scenario is no longer on `'starter'` authority. Simulate
now names what happened and how to get back, in a callout and in the command bar.

This also corrects a standing reviewer claim that a gate swap drops the checks unconditionally
through a prune in `VerifySurface.tsx`. It does not; the clearing lives in the runtime's detach
path and only fires while the scenario is still the starter's.

### Refuted while checking

`ide-verify-summary-status` and `ide-verify-context-state` are **not** two renderings of the
Simulate status: the first is a `<span>` nested inside the second. Two test ids, one element.

### Assertions migrated, none deleted

Five, each to the behaviour it protected rather than the wording it happened to use: "no
`<details>` anywhere in the Package hero" → nothing expanded on arrival and no gate stack in the
hero; "the next action reads 'Ready for export'" → it names Build & Export and does not demand a
clock; the zero-copy on the Board ribbon; the shell resize test's hardcoded 220px dock → read
from the preference authority; and the pass-run summary's "Checks passing" → the headline and the
state chip that actually carry it. The pin-planner journey opens the new disclosure the way a
student would and asserts it is closed on arrival.

### Validation at this head

`pnpm verify:gates` **exit 0** at every checkpoint. Full Adder operational, package-history,
pin-planner, project-persistence, a11y-scale, visual-hardening and layout-scale-probe journeys
green. Typecheck **778, unchanged from the session baseline**. Every touched suite left at its
exact committed failing set (hardwareSurface 5/52, exportSurface 34/65, verifySurface 32,
verify+project+startCenter 37, designSurface unchanged; ideWorkbenchShell 6/6 green).
`docOverflowX` and `bodyOverflowX` are 0 at 1440×900, 1366×768, 1024×720 and at 200% text.

### Honest remaining limits

- At 200% text the workbench genuinely doubles — the typography change working — and is also
  cramped: the title bar's items collide and the Observe/Compare control clips. Recorded, not
  hidden.
- The Simulate case grid and the board twin canvas still leave large empty areas at rest. Unlike
  the panels fixed here, both are work areas a student fills or pans, so they were left alone.
- The `ide:gate:*` shell gates outside `verify:gates` (console-autocollapse, shell-chrome,
  layout, workbench-layout, design-workbench) still fail at the committed baseline too.
- Visual craft is Browser-E0 evidence. No Vivado, bitstream, board or classroom claim.

**Boundary held:** no merge, no retarget, no push to `main` or the product branch, no production
deploy, no release, format version 1, both classroom goldens byte-identical, no golden
regeneration.

## 2026-09-06 — P2.5I product-gate closure: every journey green, four data-loss defects closed (Opus 5, desktop session)

**Label:** REDBYTE REMOTE REVIEW CANDIDATE / FEATURE BRANCH PUSHED / PREVIEW SHA VERIFIED /
PR #85 DRAFT / NO MERGE / NO PRODUCTION.
HEAD `HEAD_SHA` on `claude/redbyte-operational-workbench-convergence-w9k2r4`, pushed.
Format version 1. Both classroom golden Basys3 export gates byte-identical. No merge, no
retarget, no `main`/product push, no production deploy.

### The build gate is closed

`pnpm verify:gates` passes end to end (exit 0, 23 gate suites), including `pnpm -r build`, both
classroom goldens, and the Lab 4 no-solution gate.

The one failure it had was `rc:d2:basys3-bundle-gate`, and it reproduced identically at the
session-start checkpoint `42d63a094`, so it predated this work. That is not a disposition, so it
was classified properly: **class B, an obsolete assertion against a deliberately replaced
interface.** `2a0b66982` ("make Export a trusted Vivado handoff") rebuilt the handoff pin map on
the mapping projection and widened it from `| Signal | Alias | Package Pin | Direction |` to
`| Logical signal | Artifact port | Board resource | Package Pin | Direction |`; the gate still
asserted the old whole-row string. The behaviour it protected — a student can check every
binding from the README without opening Vivado — is now asserted through the new owner, for
every mapped signal rather than two of them, and cross-checked against the constraints file.

### Product defects closed this session

1. **The schematic ran under the Problems console.** A viewport-relative `min-height` demanded
   558px inside a 485px pane, so the canvas was laid out 73px past its container; that band sat
   under the console, which swallowed clicks on any symbol placed low on the sheet. Measured
   before: canvas 157-715 against a console starting at 658. The floor is capped by the space
   available now. Nothing is clipped to achieve it.
2. **Placement assumed every symbol was a 48px gate.** A module instance is drawn roughly twice
   that in both axes, so four of them stacked until some had no clickable body. Placement
   measures both the symbol being placed and the ones already there, through the geometry the
   canvas draws with; `blockBodySize` is the single owner of that size.
3. **The Design inspector could not be scrolled to.** 1134px of sections in an 816px dock with
   `overflow: hidden` and no scroller anywhere inside it: 318px unreachable at 1440x900, 450px
   at 1366x768. Source, Evidence, Mapping and Related simply could not be seen. The dock scrolls.
4. **Autosave erased stored run evidence.** The repository writes the record whole and the
   debounced autosave omitted `runEvidence`, so editing one case ~700ms after a run threw the
   run away on disk. Introduced by the evidence work in `8e553b801`.
5. **Explicit Save re-persisted a stale run.** `handleSaveProject` read the run in its body but
   not in its dependency array; three runs and three saves stored the first run three times.
   Save As and Duplicate had the same omission. All four now read the refs the close-save uses.
6. **A run made just before switching projects never reached disk.** Autosave only fired on a
   content-hash change, and finishing a run does not change project content. A new run is
   unsaved work in its own right now.
7. **The status bar and Simulate disagreed about a reopened project.** `loadFromProject`
   restored the run but not `projectHealthCore.lastVerify`, so the footer said "Not simulated"
   while Simulate said RECORDED. Rebuilt from the same run.
8. **Accessibility:** `IdeButton` dropped every `aria-*` a caller passed, so the replay toggle's
   `aria-pressed` never reached the DOM; the command palette and the menubar dropped focus to
   `<body>` on close/activation; `prefers-reduced-motion` did not reach primary/secondary
   buttons, the replay transport among them; and a signal pinned past the render cap could no
   longer be re-radixed.

### Journey inventory (recomputed from repository truth)

`packages/rb-e2e` holds **27 `.mjs` files: one shared harness and 26 journeys.**
**All 26 executed against one build. 26 pass. Nothing excluded, nothing partial.**

| Class | Count | Files |
|---|---|---|
| Student acceptance (complete student workflow) | 6 | full-adder-operational, nested-adder, project-persistence, complex-import, migration, project-landing-proof |
| Seeded integration (loads a starter through its shipped path, then drives real UI) | 15 | bench-board-sync, compare-verdict, constraint-sets, crossprobe, engineering-location, nested-create-module, package-history, parity, pin-planner, runs-document, semantic-zoom, signature, sim-provider, source-files, vcd-analyzer |
| Diagnostic probe (measures a property, not a student workflow) | 5 | a11y-scale, active-top-authority-probe, shell-status-authority, visual-hardening-probe, layout-scale-probe |
| Historical | 0 | — |

Independently of that: **10 journeys write nothing to the store at all** (a11y-scale,
compare-verdict, complex-import, full-adder-operational, migration, nested-adder,
package-history, project-landing-proof, project-persistence, signature); the other 16 seed a
starter through its shipped load path and then drive the real UI.

Denominator history, so the change is not silent: the earlier "8 of 22" counted a subset against
a stale build. The reconciliation in `652041be9` was 24 files / 23 pass / 1 partial. Since then
`project-persistence-journey` (new), `harness.mjs` (a library, not a journey) and
`layout-scale-probe` (new) were added, and `nested-adder` went from partial to green.

### What the blank-project journey now proves

Blank project from cleared storage; ten symbols placed from the real palette; twelve wires drawn
through real pin targets; five boundary signals renamed; five gates selected and turned into a
reusable `FullAdder` module with ports A/B/CIN/SUM/COUT; the top cleared with the definition
surviving; three 4-bit buses, four instances and a ground; seventeen ripple-carry wires with none
missing and none extra; deterministic simulation of the UI-authored design (0xA + 0xD = 0x17);
survival across reload; and generated hierarchical VHDL whose top instantiates all four stages
and binds `work.FullAdder`. Zero page errors, asserted. It used to print these and exit 0.

### Validation at this head

- **Journeys:** 26/26 against one build, dev server, pinned Node 20.19.0, Windows.
- **Gates:** `pnpm verify:gates` exit 0 — 23 suites, both goldens byte-identical, Lab 4
  no-solution gate, `pnpm -r build`.
- **Unified build:** `pnpm build` succeeded and stamped the pushed SHA into `dist/build.json`.
- **Built-bundle smoke:** the Full Adder acceptance journey passes against the BUILT bundle
  served locally at `/os/`, and again against the deployed Cloudflare branch preview, at both
  viewports, using `RB_BASE_URL` — which also exercises the harness portability work.
- **Focused suites:** board interaction, placement, reopen-evidence, projectRuntime persistence,
  repository, runScope, canonicalLoad, authoredCanonicalLoad — 97 tests green.
- **Typecheck:** 778 errors under TypeScript 5.9.3, identical with and without this session's
  changes. Encoding check and the Zustand selector lint both clean.
- **Not run:** the full aggregate vitest suite. No Vivado, bitstream, board, or classroom
  certification claim.

### Known limitations recorded rather than hidden

- The imported VCD Analyzer offers no bus expand/collapse; the native waveform does.
- The Case Lab's followed-signal column header is a click-only `<th>`; the signal-rail lane
  buttons give the same capability from the keyboard.
- The library rail collapses component names to zero width at the default dock size; placement
  still works, and the blank-project journey places ten symbols through it.
- Informational Problems still open the bottom console at full height in Design. It no longer
  overlaps the canvas, so it is a space question rather than a lost-clicks one.
- `designSurface.placementMode.test.tsx` has one pre-existing red, outside the gate lane: a
  runtime-backed palette placement double-counts in jsdom. Classified harness-only — in a real
  browser ten palette clicks produce exactly ten nodes with sequential ids, proven every run by
  the blank-project journey.

### Exact next action

Connor reviews the branch preview. Nothing else is blocked.

## 2026-09-05 — P2.5H product completion: board gesture, bus placement, journey reconciliation, harness portability (Opus 5, desktop session)

**Label:** INTERIM REDBYTE WORKFLOW COMPLETION / REMAINING BLOCKERS NAMED / SOURCE PRESERVED.
HEAD `797bb405b` on `claude/redbyte-operational-workbench-convergence-w9k2r4`, pushed (remote == local).
PR #85 stays DRAFT. Format version 1; both classroom goldens untouched. No merge, no retarget, no
`main`/product push, no production deploy.

### Product repairs in this session

1. **Unchanged reload reported a current run as STALE** (`ee5387175`). `computeScenarioContentHash` hashed
   vector `id`s, which `cloneVector` drops and persistence never carries, so a run stamped while ids existed
   could never match its own scenario after a reopen. The hash now covers content (tick, stimulus, checks,
   steps, policy), matching why `buildCurrentVerifyProjectHash` already strips ids. Contract:
   `projectRuntime.authoredCanonicalLoad.test.ts`.
2. **Board twin switches fought themselves** (`0ef850300`). The hitbox wired `onPointerDown` (set the value
   absolutely from the press position) and `onClick` (toggle) on the same gesture, so the click undid the
   press. Clicking the lower half of an ON switch was a silent no-op, and because the hitbox midpoint is the
   on/off boundary, a centre click could never turn a switch off. Now a press that does not travel is an
   ordinary click and toggles; past a 4px threshold the gesture becomes a slide and the pointer decides.
   `data-on` is published on the switch group and the LED, restoring a contract the retired
   VirtualBasys3Board had. Nine tests, five of them red against the previous component.
3. **Creating a bus buried existing symbols** (`86f1409a8`). `findSmartSpawnPosition` cleared one slot while
   the bus created one symbol per bit, stacked 72px down. It now takes the footprint the caller will fill and
   clears every slot. `BUS_MEMBER_SPACING` is exported from rb-logic-core so the reservation cannot drift from
   the creation.

### Journey reconciliation (§4) — one build, all files executed

Denominator reconciled: **24 journey files in `packages/rb-e2e`, 24 executed, 23 pass, 1 partial.**
Earlier "8/22" counted a subset against a stale build. Nothing was removed from the suite.

First attempt (before repair): 8 passed, 14 failed. Every failure was classification **C, harness stale
against the P2.5 grammar** — none was a lost capability. Rerun after repair: 23 pass, 1 partial.

| Journey | First attempt | Class | Repair | Rerun |
|---|---|---|---|---|
| full-adder-operational | pass | — | strengthened separately (`ee5387175`) | pass, both viewports |
| a11y-scale | pass | — | harness portability only | pass |
| semantic-zoom | fail | C | document navigation | pass |
| active-top-authority-probe | fail | C | document navigation | pass |
| sim-provider | fail | C | provider selector re-anchored | pass |
| bench-board-sync | fail | C | board state read via `data-on` | pass |
| signature | fail | C | P2.5 owners | pass |
| parity | fail | C | P2.5 owners | pass |
| complex-import | fail | C | import review re-anchored | pass |
| runs-document | fail | C | runs document opened, not the surface | pass |
| source-files | fail | C | Project document navigation | pass |
| shell-status-authority | fail | C | status authority moved surface | pass |
| engineering-location | fail | C | path text owner | pass |
| crossprobe | fail | C | `ide-crossprobe*` retired with CrossProbePanel | pass |
| nested-adder | fail | C | stage A fully repaired; stage B unresolved | **partial** |
| compare-verdict | pass | — | — | pass |
| constraint-sets | pass | — | — | pass |
| migration | pass | — | — | pass |
| nested-create-module | pass | — | — | pass |
| package-history | pass | — | — | pass |
| pin-planner | pass | — | — | pass |
| project-landing-proof | pass | — | — | pass |
| vcd-analyzer | pass | — | — | pass |
| visual-hardening-probe | pass | — | — | pass |

**nested-adder (§6A blank-project authoring), exactly what is proven and what is not.** Proven: blank
project from cleared storage, ten symbols placed from the real palette, twelve full-adder wires drawn
through real pin targets (now asserted, previously only printed), five boundary signals renamed through the
inspector, five gates selected on canvas and turned into a reusable `FullAdder` module whose ports read back
A, B, CIN, SUM, COUT, the top cleared with the definition surviving, three 4-bit buses, four module
instances and a ground created. Not proven: the ripple-carry wiring, the deterministic simulation of the
UI-authored design, and the hierarchical VHDL inspection. Stage B's layout step cannot pick up two symbols
because nothing of their body is exposed. The bus half of that pile is fixed; module instances still spawn
on a clearance rule sized for a 48px symbol while an instance with five ports is much larger. That is the
next Design item, named rather than worked around.

**Two reported product defects were investigated and are not defects.** Node dragging was reported as
stopping after one grid step; with the hit target verified immediately before each press, every symbol moved
the full requested distance, and the earlier failures were presses against coordinates that went stale when
the canvas resized. "Hide bottom panel" was reported as inert; the branch that would make it inert requires
`consoleMode === 'expanded'`, which no surface passes, and in Design the console is not mounted at all.
Neither was "fixed".

### Harness portability (§10) — `797bb405b`

`packages/rb-e2e/harness.mjs` is the single owner of how a journey starts. The 23 copies of
`process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {}` are gone. Browser
resolution is Playwright's own on every platform; `RB_CHROMIUM_PATH` is an explicit override, validated when
supplied and reported by name when the path does not exist. `RB_BASE_URL` replaces the hardcoded port and the
journey-local `RB_E2E_URL`. `evidenceDir()` writes under the repo instead of the cloud absolute path that
created a stray `C:\tmp` tree on Windows.

**Script classification (§10).**

- *Student acceptance, no store injection:* full-adder-operational, nested-adder, project-landing-proof.
- *Seeded integration (loads a starter or fixture through its shipped path, then drives real UI):*
  bench-board-sync, compare-verdict, complex-import, constraint-sets, crossprobe, engineering-location,
  migration, nested-create-module, package-history, parity, pin-planner, runs-document, semantic-zoom,
  signature, sim-provider, source-files, vcd-analyzer, a11y-scale.
- *Diagnostic probe (measures, does not claim a student workflow):* active-top-authority-probe,
  shell-status-authority, visual-hardening-probe.
- *Historical:* none retained.

### Validation run this session

- Journeys: 24 executed, 23 pass, 1 partial (above). Dev server, pinned Node 20.19.0, Windows.
- Unit: `hardwareBoard2D.interaction.test.tsx` 9 green (5 red without the fix); `placement.test.ts` 5 green
  (1 red without the fix); `projectRuntime.createBus.test.ts` 4 green.
- Typecheck: 778 errors under TypeScript 5.9.3, measured with and without this session's product changes.
  Unchanged by this work. The previously recorded 777 was measured on a different head.
- Not run this session: the full vitest suite, both classroom golden gates (untouched since `ee5387175`,
  where they were byte-identical), the unified build, and CI. A green PR fast-check lane is not a green
  browser suite and is not claimed as one.

### Exact next action

§7 persistence beyond page reload: close/reopen from Recent, Open Existing, Save As, Duplicate, and opening
an imported package are different operations, and project A/B isolation is unproven. Then §9 real keyboard
operation and waveform scale beyond the 200-row cap, and the module-instance spawn clearance named above.

## 2026-09-05 — P2.5H away-mode product-gate closure (Fable 5.1 ultracode, desktop session, Connor away)

**Label:** INTERIM REDBYTE AWAY-MODE CONVERGENCE / SOURCE PUSHED / NOT A RELEASE CANDIDATE.
HEAD `f1f6c1965` on `claude/redbyte-operational-workbench-convergence-w9k2r4`. Feature-branch checkpoints are
pushed (never force); PR #85 stays DRAFT and is updated only to stay truthful. Safety tag
`safety/redbyte-away-mode-eab7f8c1f` marks the pre-push head. Format version 1; both classroom goldens
byte-identical. Away-mode freeze: no merge/retarget of #84/#85/#80, no `main`/product push, no production
Cloudflare deploy, no public-site/branding/repo-root change, no release tag, no format v2, no golden regeneration.

**Source preservation (done first):** `eab7f8c1f` pushed and verified (remote == local, 0/0); PR #85 body
rewritten (IN PROGRESS / NOT A REVIEW CANDIDATE). The branch preview pipeline fired on its own:
`https://claude-redbyte-operational-w.redbyte-ui-genesis.pages.dev` (deployment alias
`https://d9977960.redbyte-ui-genesis.pages.dev`) serves `/os/version.json` sha `eab7f8c1f…` == HEAD at that push;
`/` 302 → `/os/` 200. Verified once with curl; CI not polled. (An earlier note that the preview was SKIPPED
was wrong: the "SKIPPED — credentials unavailable" job is the no-credentials notice, itself skipped.)

**P0 — run evidence scope and reload truth (this commit).** Three defects, one authority each:
1. *Ownership.* Every run and ledger entry is stamped with the owning `projectId` (`RuntimeVerifyRun.projectId`,
   `VerifyRunLedgerEntry.projectId`); rehydration (`mergePersistedRuntimeState`) drops evidence owned by another
   project and clears its verify trust, and stamps legacy unowned runs with the envelope's project; Save As /
   Duplicate re-own the evidence (`restampRunEvidenceProject`); the dead `recordVerification` action (no
   callers; it re-used the previous run's evidence capsule) is deleted — owner is `runVerification`.
2. *One read-model.* `deriveRunScope` (`packages/rb-apps/src/apps/ide/runScope.ts`) reuses the workflow
   authority's `deriveVerifyCurrent` verdict and names the changed input (design / pin mapping / scenario /
   edited) by recomputing the producer's own hashes. IdeApp: `runIsStale = runScope.kind === 'stale'` feeds
   Problems, Runs, Board values and the dossier; the boot restore no longer forces a restored run stale — it is
   judged by its hashes (current → kept current, stale → reload guidance with the reason, foreign → dropped).
   Problems row detail and the Simulate reload guidance carry the reason.
3. *Canonical load.* A freshly loaded starter was not the document rehydration produces: io-row order differed
   (`normalizeRBProject` sorts nodes), V2 entries carried "A[0] (SW0)"-style labels, scenario vectors were keyed
   by boundary node id, and `deriveAuthoritativeHardwareState` returned a V2 document whose ids predated the
   label-driven row rekey (`a0` vs `a_0`) — the export lint aliasing of P2.5G was a symptom of this. Now the seed
   is canonicalized through the one normalizer (`canonicalizeSeedState`) and the hardware-state derivation
   converges until V2 ids and row ids agree. Contract: `projectRuntime.canonicalLoad.test.ts` — rehydrating a
   fresh starter is a no-op for every input the run hashes are built from (all 15 starters).
   Consequence: starter vectors are keyed by io-row id; `projectRuntime.persistence.test.ts` authored on the
   canonical id instead of the node alias (an alias never overrides an explicit canonical value).
   The silent `catch {}` in the rehydrate normalizer now warns.
4. *Project switch.* Found while proving 3: switching starters with Simulate open crashed the surface
   ("Maximum update depth exceeded" in StimulusCanvas). Two owners fought over one tick: the stimulus
   canvas wrote its nearest-authored-case substitute back to Simulate whenever the controlled tick was not
   one of its cases, while the app kept re-applying the previous project's tick (`verifySelectedTick`) and
   selection (same scenario id `default`, a different tick domain). Fixes: the canvas never writes the
   substitute back (it is display-only; the parent owns the tick domain — `StimulusCanvas.test.tsx`
   contract rewritten); Simulate applies the app override once per value instead of on every rebuilt
   timeline array; IdeApp clears the engineering selection and the tick override when `projectId` changes.
   The previous project's selection is foreign evidence too.

**Proof (Browser-E0, live app at 1366×768):** hierarchical adder A: Run → owner stamped, current; reload →
run kept, `dirtySinceVerify` false, authority `verified`, no `sim:stale` Problems row, no reload guidance,
waveform `data-state=pass`; delete SUM[3] output in Design → Problems "Default evidence is stale — The design
and the pin mapping changed after this run."; undo → "The project changed after this run." (flag-only, the
authority's rule); Open Starter → counter B: no A evidence; Open Existing → A: no B evidence. Counter B before
the canonical-load fix: reload → "The pin mapping and the scenario changed after this run." with no user edit
(the loader had changed them); after the fix: fresh counter → Run → reload → current (see the tail of the
proof record below). Tests: runScope (15), canonicalLoad (16), persistence (33), engineeringProblems,
exportHistory green; history-authority 7, hardware trust-clarity 4, readiness 1 and verifySurface.workstation
reds are inherited (identical in the baseline worktree / testids absent at HEAD). rb-apps tsc 777 (baseline
779); goldens 2/2 byte-identical; rb-apps build green.

**Wave One — Cases + evidence deck composite (`7b31afe75`).** The lab grid is one resizable composite:
cases/timing · a 22px splitter row · the evidence deck. The deck share, collapse and maximize state are a
workspace preference (`WorkspacePreferencesV1.simulate`, persisted with the docks; `setSimulateLayout`,
`resetSimulateLayout`; normalized + clamped 15–85%). The handle is `role=separator`, `aria-orientation=
horizontal`, `aria-valuenow` = deck %, focusable; pointer drag previews locally and commits once on release;
Arrow ±2%, Shift ±10%, Home/End, Enter and double-click reset; both panes keep a minimum (cases 160px,
deck 120px) inside the clamp. Tools on the splitter row: Collapse/Expand evidence (a 28px strip with the
verdict), Cases/Timing only, Evidence only, Reset layout. The replay (Waveform) document has no cases pane
and no splitter. Legacy owners retired: the `checks` (220px) and `scenario` (36%) fixed row rules — one
`--rb-sim-evidence-fr` rule drives every non-replay mode; narrow (≤899px) stacks keep the split row.
Selection / tick / failure sync untouched (state stays in Simulate). Live proof (counter, Timing document,
550px grid): 36% → cases 330 / deck 198; Shift+ArrowUp → 46% (275 / 253); collapsed → 500 / 28 strip;
Evidence only → 0 / 528; Timing only → 528 / 0; Reset → 36% and `localStorage` holds the preference; the
page body never scrolls. Tests: `workspacePreferences.simulate` (4), `verifySurface.evidenceDeck` (4),
existing `workspacePreferences` (5) green; tsc 777; CSS audit exit 0.

**Replay / inspection state words (`bdec7bafe`).** The evidence row carries one chip
(`ide-verify-evidence-state`, `data-state`): RUNNING (runtime run state), REPLAYING (playback flag),
RECORDED · CURRENT (a run whose inputs are unchanged; title carries the UTC record time), STALE + the
run-scope reason inline ("The design changed after this run."). NOT RUN otherwise. It is separate from
the PASS/FAIL verdict chip in the header. No timers or pretended delays exist in the run flow (checked:
no `setTimeout` in the Simulate run path). HISTORICAL remains the Runs document's "superseded" state —
Simulate can only replay the latest run; opening an older ledger entry as a replay is a later slice.
Live: RECORDED · CURRENT → Play → REPLAYING → stop → RECORDED · CURRENT. Test: `verifySurface.evidenceState` (2).

**Waveform depth — buses, radix, expected overlay (`1250b740a`).** Simulate folds indexed lanes of one
direction (SUM[0]..SUM[3] / sum_0..sum_3) into a bus lane SUM[3:0], MSB first, formatted in the chosen
radix (Bin/Hex/Dec on the command row; session UI state beside zoom/density in `rb.verify-ui.v2`). A
collapsed bus hides its bits; its label (`ide-verify-bus-toggle-<id>`) expands the member bits underneath
(`data-kind` bus/bit/scalar on rows). The instrument draws a bus as a value band per tick with transition
marks and a wider value slot; the fail band and selected column are shared with scalar lanes. The expected
overlay reads the run's own report rows keyed by lane: scalar lanes get a dashed fail-colour rail at the
saved level only where it differs from the observed one; bus lanes get "exp N" under the observed word where
every member had a check and the words differ; one "Expected" toggle hides it. Live (hierarchical adder,
Compare PASS): SUM[3:0]/A[3:0]/B[3:0] buses in hex (0,2,8,0,F,E…), bin shows 0000/0010/1000, expanding
SUM lists sum_3..sum_0 as bits, no expected marks on a passing run, expansion persisted in session storage.
Tests: `waveformInstrument.buses` (3), `verifySurface.waveformDepth` (3). Note: `WaveformInstrument.tsx` is
committed with CRLF in its blob (git skips normalization for it) — keep the worktree CRLF when editing it.
Open in this area: lane groups by user choice, bus lanes for internal probes, the Timing Lab clock
generator / reset pulse / run range (next).

**Board camera (Wave Two, `e128326ba`).** The Board document has a camera: Ctrl+wheel / + / − zoom, drag
to pan, Fit board (0), Fit selected (F, frames the selected resource at about a third of the frame), arrow
keys pan. Owned by the workspace preferences beside the board layers (`board.camera` {zoom 0.5–4, x, y};
`setBoardCamera`, `resetBoardCamera`); geometry is pure in `boardCamera.ts` (viewBox from camera, zoom about
the centre, pan in board units, fit to bounds). Below 85% zoom the alias labels give way to the board shape
(`data-density=compact` on the svg; CSS in board-instrument.css). A pan never counts as a resource click
(`boardPanMovedRef`). Live (counter, Board): 100% → 156% → 51% with labels hidden → Fit → Fit selected 121%
(viewBox 200.74 −156.2 514.52 255.6 around CLK100MHZ) → key 0 → Ctrl+wheel 125% → drag pan persisted
(x −50.5, y −25.3) → reset. Tests: `boardCamera` (5), `workspacePreferences.boardCamera` (3); Board suites
keep the five inherited reds. Note: `Basys3BoardView.tsx` is also a CRLF-blob file (see the waveform note).
Open for Board: the Constraints tool (Board signal ↔ constraint ↔ XDC line sync, no empty permanent footer),
guided/expert workflows over the one mapping authority, 200% board.

**Timing Lab depth — Counter journey (`9eb660bdb`, `5eadc8129`).** Found while proving the journey: the
auto clock policy with "reset sequence" overwrote an authored RST pulse at run time while the Timing lane
accepted the edit, so the run read RECORDED · CURRENT for a stimulus that was never applied. Now: (1) the
auto clock's run length is a direct control on the Timing bar (cycles); (2) lanes the policy generates
(clock, and the reset under "Reset at t0") are drawn as the run will use them, marked `data-generated`,
and refuse edits with the reason (`TimingLanes` `generatedFieldIds/generatedValueAt/generatedNote`; names
resolved through `mappedSignals` id/label/nodeId like the materializer); (3) the clock panel offers
"Reset at t0" vs "Author reset pulses" under the auto clock (`resetBehavior` auto-sequence vs custom,
persisted in the scenario's sequential policy through the one `persistScenarioSequentialPolicy`).
Live (2-bit counter): run length 6 → 7-tick run, q counts 1,2,3,0 while EN is high; "Author reset pulses"
→ RST lane editable, reset at t4 → rerun: clk generated 1111111, rst 1000100, q0 0010011 / q1 0001000
(count restarts after the reset), the saved checks authored for the old stimulus fail at t4–t6 as they
should, chip REPLAYING → RECORDED · CURRENT. Tests: `timingLab` (7).
Open for Timing: state lanes for registers, a reset-pulse generator, run-range window selection.

**Constraints tool (Wave Two, `f86e831be`).** Constraints is a section of the Board side panel
(`ide-hw-constraints-tool`): the packaged clock constraint line, then every signal's exact XDC lines from
the export contract's mapping projection (`exactXdcLine` + IOSTANDARD; unmapped signals read "no pin
assigned yet" and are dashed). Selecting a line selects its signal (`chooseMappingRow`) — the table, board
highlight and binding chain follow; selecting a signal marks its line (`aria-current`). The named sets panel
lives inside the tool with the active set named in the header ("Live mapping" otherwise); the permanent
footer `ConstraintSetsPanel` is gone. Truth fix found on the way: a captured set recorded only the
`create_clock` line (`liveXdcText` was the clock text) — it now records the packaged `.xdc` artifact
(`packagedXdcText` in IdeApp), so a set's pin count matches the live mapping it captured. Live (counter,
Board): clock line + CLK100MHZ/EN/LD0/LD1/RST lines; selecting the EN line selects EN everywhere; sets
panel inside the tool, one panel in the DOM. Tests: `hardwareSurface.constraintsTool` (3); Board suites
keep the five inherited reds.

**Package provenance (Wave Three, `0519916a7`).** Derived documents only; no ZIP or golden change.
(1) *Dependency graph*: `artifactDependencyGraph.ts` derives, from the bundle's own artifact categories,
which workbench inputs each generated file depends on (Design → design sources; Board & Constraints +
Design → .xdc; Simulate + Design → testbench; Project + Design + Board → .tcl; metadata from all inputs) and
which generated files reference others (testbench → design sources; tcl → sources, constraints, testbench;
metadata references none — it describes the package). `ArtifactProvenanceGraph` draws it as an SVG figure
in the Package workspace (`ide-export-provenance-section`): inputs left, files right, one curve per
dependency; a selected file emphasises its edges and dims the rest; file nodes select the artifact; input
nodes open Design / Board / Runs / Project documents; inputs changed since the last package and files
changed against the previous package are marked. (2) *File-by-file comparison*: every recorded package now
carries `artifactHashes` (path → content digest, additive on `ProjectHealthExportResult`, carried by the
runtime normalizer); `compareExportArtifacts` reports changed / same / added / removed / no digest recorded,
and the Package history panel lists it under the hash changes with each file selectable. Live (counter,
Package): 4 inputs, 9 files, 27 input edges; selecting top.xdc emphasises its two edges (Board, Design) and
opens its preview; selecting the Board input switches to the Board workspace. Tests:
`artifactDependencyGraph` (4), `exportHistoryModel.artifacts` (3); existing exportHistory suites green;
exportSurface reds compared against the baseline worktree (see the commit). Note: `ExportSurface.tsx` is a
CRLF-blob file too. Open for Package: previous/current *content* diff of a selected file, dossier depth.

**Inner grid owner (Wave Four, `e3b0eb701`).** The 200% case traced to two owners fighting: at a 720×450
CSS viewport the Simulate result region (fail diagnosis + three callouts, 362px, `min-height: auto`) could
not shrink and pushed the document to 0px below the panel, and the <900px stacked template omitted the
splitter row (implicit row/columns, `160px 0 0 0 22px`). `simulate-instrument.css` now owns the whole inner
layout: the result region is bounded (`min-height: 0; overflow: auto`), the document keeps a floor of
`clamp(182px, 60%, 240px)` (160px row + 22px splitter, up to 240px or 60% of the panel), one stacked template
(`'cases' 'split' 'evidence' 'inspector'`, one column) with the collapsed / maximized variants restating only
the rows, and a named gap owner (`… .ide-workbench-workspace > .rb-sim-panel > .ide-panel-body { gap: 0 }`
outranks the shell's `[data-layout-intent] … > .ide-panel > .ide-panel-body` section gap — the base rule lost
on specificity, which is why a 14px gap survived the first pass). The `ide-root.css` verify cap block
(`display: grid !important` on `.ide-verify-workspace`, region flex caps, oscilloscope/waveform frame minimums)
targeted classes that no longer render — the panel and lab grid carry `ide-verify-panel` / `ide-verify-lab-grid`
as test ids, never as classes. A brace-aware prune removed 265 rules / 357 selectors / 5 empty media blocks for
the dead family (`.ide-verify-region--*`, `.ide-verify-workspace`, `.ide-verify-lab-grid`, `.ide-verify-panel`,
status strip, stale banners, kit tip, oscilloscope stage, waveform frame, scope header, console frame, dock
toggle rail); the eight live caps were deleted where a plain rule already owns the value (`.ide-verify-
workbench-body`, `.ide-stimulus-grid-scroll` min-height 0; the 260px/150px first-run stimulus minimums are
gone) or re-homed as plain rules (supporting strip 38px closed, drawer body `min(34vh, 320px)`).
`!important` in `ide-root.css`: 3489 → 3008. Live (counter, Timing, failing run): 1440×900 header 31 / result
245 / document 240 (cases 132, split 22, evidence 86, inspector 132); 1366×768 with Problems open: result 95
(scrolls) / document 230; 720×450: header 46 / result 26 (scroll strip) / document 182 (cases 160 + split 22,
evidence and inspector rows 0 — the deck tools remain to maximize the evidence). No page scroll at any size.
Tests: `simulateInstrument.compactGrid` (20; both stylesheets read as text — one stacked owner, bound + floor,
gap owner, retired selectors absent, no `!important` in simulate-instrument.css, ratchet ≤3010 on ide-root).
tsc 777; `css:audit:ide` clean; evidenceDeck / evidenceState / waveformDepth / timingLab / simulate prefs green.
Owner record: old owner `ide-root.css` verify block (2491–2620 at `3c6e4ee04`) and the `.ide-verify-panel`
family → new owner `simulate-instrument.css` (`.rb-sim-panel`, `.rb-sim-region--*`, `.rb-sim-workspace`,
`.rb-sim-lab-grid` and its media block). Still open in Wave Four: Design inspector named sections (Properties /
Connectivity / Evidence / Mapping / Source / Related — today Actions / Selection details / Live · Signal State),
and the Timing toolbar wraps awkwardly under 900px (cosmetic).

**Design inspector sections (Wave Four, `432c19cbc`).** The inspector is now named sections over existing
authorities, in reading order: Identity (the properties surface — the contract forbids a standalone
`ide-design-inspector-properties` section; rename stays in the identity card) → Actions → Selection details →
**Connectivity** (pin values + input drivers moved out of the state section, plus "Drives" from the canvas
connections) → **Evidence** (the former "Live / Signal State"; same test id `ide-design-context-inspector`) →
**Mapping** (resource, package pin, constraint set, the constraint lines, "Open in Board & Constraints" which
publishes the signal selection then opens `{kind:'board-io'}`) → **Source** (up to four generated VHDL lines
naming the signal with line numbers, "Show HDL beside the schematic" → split view; internal logic says so) →
**Related** (the Related… menu's documents as a flat list; selection published before `openWorkbenchDocument`).
Root repair found while proving it: the relationship index built the board link from the raw row pin, so an
alias-mapped row (pin `LD0`) reported `PACKAGE_PIN LD0` in Related and in the new Mapping section;
`engineeringRelationships.ts` now resolves the Basys3 resource and names the package pin (`U16`), and the details
model's package pin does the same. Live (counter, LD0 at 1440×900): seven sections in order, Mapping `U16` with
both constraint lines, Related "LED LD0 · U16", Source collapsed by default. Tests: `designSurface.inspectorSections`
(6), `engineeringRelationships.aliasPin` (3); inspectorHierarchy / inspectorIntelligence / gateSwap / debugNav /
sequentialInspector green; the nine fanout / workstation reds (`ide-design-context-trace`, `ide-design-workspace-
header`, verify-linked focus copy, diagnostics dialog) fail identically with the HEAD DesignSurface — inherited.
tsc 777; css:audit clean. Note for future patches: `String.prototype.replace` with a string replacement expands
`$&` — the first apply corrupted the `escapeForRegExp` line; use a function replacer for inserted TSX.
Open: Design left rail (Components / Hierarchy / Sources / Board I/O) review at 200%; the Evidence section is
long (≈390px) and could fold its replay rows under a disclosure.

**Legacy CSS deletion (Wave Four, `66a899659`).** A census (scratch `css-census.js`, method recorded here) classified
every class selector in the IDE stylesheets against two signals — the full source corpus of every package (870
ts/tsx/js/mjs/html files, tests excluded) and a live DOM sample of the five workspaces (766 distinct classes) —
and kept anything whose exact token or family prefix appears in source, plus every runtime-composed state class
(`is-*`, `has-*`, `not-*`, `map-*`, `board-*`; the first pass wrongly flagged `is-replaying`, `is-added`, `is-not-run`,
which are built as `is-${state}`). Rules whose every selector carries a dead class were removed with the same
brace-aware pruner as the verify block; selector lists trimmed; empty media blocks dropped. Removed: ide-root.css
745 classes / 1,378 rules (32,786 → 24,329 lines; `!important` 3,008 → 2,222 — families: ide-verify-run/strip/
workbench, ide-hw-map/structured, ide-project-example/showcase/overview, ide-design-starter, legacy inspector cards);
ide-polish-pass.css 153 / 272 (5,782 → 4,239); simulation-studio-v3 26 / 68; design-workbench-v3 26 / 57;
export-handoff-workspace-v3 22 / 81 (878 → 457; the `ide-export-v3__*` file list replaced by `rb-pkg-*`);
product-system-v3 19 / 28; hardware-mapping-workspace-v3 9 / 25. Instrument stylesheets untouched (their flags were
dynamic state classes). Exact removed-class list: `css-owner-record-w10.json` beside this file (old owner: those
stylesheets; new owner: none — the classes render nowhere; where a surface was rebuilt, the `rb-*` instrument
stylesheet already owns it). Validation: css:audit clean; compactGrid ratchet ≤2,230 + professionalUiStandards
green; rb-apps and playground builds green; live smoke of all five workspaces at 1440×900 and Design/Simulate at
720×450 unchanged. **Baseline-red disposition (shell gates):** `ide-persistence-contract`, `ide-shell-layout-
integrity` and `ide-shell-workbench-hierarchy` fail before and after — they wait for `ide-project-hash-short` and
`ide-project-load-start-*` / `ide-project-landing-example-*`, test ids no source file has carried since the Start
Center replaced the Project landing (0 files at `3c6e4ee04` too). Rewriting those gates to the Start Center
grammar is the next persistence-gate step; it is a gate repair, not a product change.

**Persistence gate (`69bbe7ed1`).** `ide-persistence-contract` PASSES again against the pruned build: place an Input
from the Design library (placement mode → canvas click), read the project hash in Project, reload, hash present,
node count persisted. Two repairs: (1) the gate harness's universal starter loader opens File → Open Starter…
(`ide-menu-file` → `ide-menu-item-project.open-starter`) and waits for `ide-project-starter-picker` when the
workspace already holds a project and no landing catalog is on screen — the picker's cards already carry
`ide-project-landing-example-*` / `ide-project-load-start-*`; (2) the overview's determinism-hash fact value carries
`ide-project-hash-short` (the fact was already shown; only the hook was missing). Shell-gate disposition after
the repair: `ide-shell-layout-integrity` and `ide-shell-workbench-hierarchy` get past the starter load and fail on
"stage navigation missing" — they assert the pre-P2.5 shell (`ide-stage-nav`, `ide-left-rail`/`ide-right-rail`,
`ide-proof-ribbon`, `ide-project-workspace-grid`, `ide-project-professional-overview`, `ide-verify-signal-shelf`);
the shell kept `mode-button-*` (WorkspaceRail) and `ide-mode-*` (shell root), so 94/146 of the 176 gate scripts
still resolve those. Rewriting the rail/ribbon assertions to `ide-workspace-rail` and the Problems ledger is a
gate change (scripts/gates), not a product change; not started. Gate runs need `pnpm --filter @redbyte/playground
build` first (the harness previews `apps/playground/dist` with `vite preview`).

**Shell gates in the P2.5 grammar (`b96434537`).** `ide-shell-layout-integrity` and `ide-shell-workbench-hierarchy` PASS
at 1366×768, 1440×900 and 1920×1080 for all five workspaces (+ Import as a route). Grammar changes: stage navigation
= `ide-workspace-rail` (five-stage authority checked by `data-stage`, Import is a utility outside the tablist);
the shell (`.ide-workbench-shell`) starts under the top bar with at most the document tab strip between and
within 112px; Simulate's left dock is legitimate when it carries `ide-verify-signal-rail-header`; Design's
inspector is contextual (the shell hides the right dock without a selection), so both gates select the first
schematic node with a **real pointer click** before reading Design; regions per workspace: overview document +
facts + explorer; canvas + IO palette + inspector; lab grid + left dock + cases/waveform; mapping table + editor +
board; package files (the work object — the decision row is 59px tall at 1920) + decision row + readiness;
import workbench + stepper + dropzone. Product finding fixed: Package showed two primaries at 1366 (decision-row
next step + Handoff inspector "Download package"); the inspector's download is now secondary — one primary per
surface. **Hardening noted, not done:** synthetic pointer events (no pointer id) make `setPointerCapture` /
`releasePointerCapture` throw `NotFoundError` uncaught (11 call sites: DesignSurface 9019/9033, HardwareSurface
783, VerifySurface 734, rb-logic-view `useCanvasInput.ts` ×7); real pointers never hit it, but a try/catch guard
would make automation and pointercancel edge cases quiet. Gate runs: `pnpm --filter @redbyte/playground build`
then `node scripts/gates/<gate>.mjs` (the harness previews `apps/playground/dist`). Persistence + both shell gates
are now green in the current grammar; the other ~170 gates were not re-run in this lane.

**Journey tail + one staleness authority (`bdf22ee0c`).** `full-adder-operational-journey.mjs` now runs the whole
§16 acceptance path UI-only at 1440×900 and 1366×768: A first use → Lab 3 → B Design → C Compare PASS → D wrong-logic
gate swap → E Compare FAIL with a concrete mismatch → **F** Trace in Design → **G** Board mapping loop → **H** trusted
package + real browser download → **I** reload. Driving it found four defects, all fixed in this commit:

1. **One staleness authority.** Simulate computed its own currency verdict (`runEvidenceIsStale`) while Project, the
   status bar and Package read `deriveVerifyCurrent`. Clear a pin and restore it: the same run read "RECORDED · CURRENT"
   in Simulate and "Simulation stale" everywhere else, with Package trust demoted to draft. `VerifySurface` now takes
   the authority as a floor (new `runIsStale` prop; `runIsStale || runEvidenceIsStale`) — it may add reasons, never
   remove one. Direction chosen deliberately: the alternative (make `deriveVerifyCurrent` hash-first) would have
   overturned a deliberate contract test (`history-authority`: after an undo back to the original hash, verify is still
   NOT current) and widened package trust. The product rule the journey now states: **evidence becomes current by
   running, not by undoing an edit.**
2. **Trace in Design lands on the failing signal.** Step F asserted the failing *gate* arrived selected; the P2.5
   selection model selects the failing *signal* (LD1 — what the check named). The inspector's Connectivity section
   names that signal's driver, so driver rows are now operable (`rb-insp-row--link`): selecting one selects the driving
   part. The journey follows causality upstream, then repairs via the compatible-gate swap.
3. **Replay is not a deck.** The collapsed / maximized deck variants also applied in replay, where the grid is the
   evidence document + inspector with no cases row and no splitter: a persisted "waveform only" state resolved row 1
   to 0 and zeroed the replay document (present at the parent too). All ten variant rules are now scoped
   `:not([data-studio-mode='replay'])`, with a contract test.
4. **Shell gates select a logic gate.** `selectFirstDesignNode` clicked the first `[data-node-id]` — SW0 in the
   logic-gates starter — and clicking an input's body toggles its value, mutating the loaded project mid-gate. Now
   excludes INPUT/OUTPUT/Switch/Lamp.

Live proof (both viewports, 0 page errors, 0 root overflow): G — clear LD1 → STALE naming the mapping, XDC line loses
its pin → guided mapping recommends LD1 → line carries E19 again → still stale → re-run → CURRENT and the status bar
agrees. H — trust `trusted` after Compare PASS, primary action builds, the browser downloads a real **18-entry ZIP**
(top.vhd, top.xdc, the Vivado import Tcl; SHA-256 in the success callout), state `ready`. I — after reload the run is
CURRENT, the mapping complete, the package ready. Gates: persistence-contract, shell-layout-integrity and
shell-workbench-hierarchy all PASS against the rebuilt playground. tsc 777; css:audit clean; compactGrid 21, runScope
15, projectWorkflowAuthority 17, evidenceState/evidenceDeck/inspector suites green; `verifySurface.workstation` fails
20/53 identically with and against HEAD's VerifySurface (inherited).

**Lane review (workflow `wf_40875e01-297`) — INCOMPLETE, read before trusting it.** Five review lenses over
`3c6e4ee04..42d63a094` finished and produced **17 raw findings**; the adversarial verification stage then died
(32/37 agents lost to a credit limit), so the run's "0 confirmed" means *nothing was verified*, not "nothing was
wrong". The three lenses that completed their own reasoning (inspector, css-prune, simulate-layout) each concluded no
defect within their scope, with concrete evidence recorded in the task output. Two of the raw P1s were real and are
fixed above (the gate input-toggle; the replay deck collapse). **Open triage list, unverified:** pin-conflict
ambiguity still keyed on the raw row pin while `board.pin` is normalized; duplicate `data-testid` in the Related list
when the driver is a module instance; `02-design.md` says Source renders only with context but it renders for every
single-node selection; a live light-theme `:is()` rule may have been deleted because sibling members were dead;
the hierarchy gate no longer asserts student-visible stage *names* (only `data-stage` ids); the persistence gate's
hash assertion is satisfied by the "—" placeholder and never compares before/after; the re-homed drawer caps may be
inert (`:not(.is-open)` never matching, and a surviving `!important` in ide-root.css); the harness always opens the
File-menu picker and never exercises the Start Center's own cards; and two doc fragments in RESUME/ACTIVE_WORK read
as garbled. None of these is confirmed; each needs one focused check before it is either fixed or dismissed.

**Lane-review triage closed (`353076e16`).** The 17 unverified findings recorded above were triaged by hand.
**Four were real and are fixed:**
1. *The Wave Four "re-homed drawer cap" was inert and had silently uncapped the drawer.* Its predecessor in
   `ide-root.css` carried `!important`; the plain re-homed rule lost to a surviving
   `.ide-verify-drawer-body { max-height: none !important }` (an `!important` beats any specificity). Removing that
   one declaration's `!important` restores `min(34vh, 320px)` and retires one more forced rule. The companion strip
   rule is deleted: the supporting strip is only ever rendered with `is-open`, so `:not(.is-open)` never matched —
   it was dead when written. The contract test now also asserts nothing in `ide-root.css` outranks the cap.
2. *Pin conflicts were keyed on the raw row pin.* After board relations began naming the package pin, a row storing
   `LD0` and a row storing `U16` no longer collided in `pinOwners`. Keyed on the resolved package pin now, with a
   cross-notation conflict test.
3. *`02-design.md` overstated Source*: it renders for any single selected node and says so when the signal is not
   named in the generated source. Sentence corrected.
4. *The hierarchy gate had stopped checking student-visible stage names* when the rail assertion moved to
   `data-stage` ids. It asserts both again, against the rail's real labels (Project / Design / Simulate / Board /
   Package).

**Dismissed with evidence.** The CSS deletion orphaned nothing: an audit of the whole
`3c6e4ee04..HEAD` stylesheet diff against the 766-class live DOM sample found **177 rendered classes touched by a
removed rule and 0 left without a styling rule anywhere** (script `prune-audit2.js`, subject-class analysis including
`:is()` members), and a light-theme pass over Design renders correctly — so the removed light-theme `:is()` rules
were refinements whose live members keep their styling. The persistence gate's hash assertion is weak but not false
(the overview's determinism-hash fact is non-empty in the live run); a before/after comparison would be stronger and
is left open. **Deferred deliberately:** the Related list can emit a duplicate `data-testid` when a signal's driver
lives in another module — it matches the existing `RelatedMenu` convention exactly, and changing one without the
other would be worse than the hazard; it is test-only.

**Method note for the next session:** the review workflow's verification stage is the part that failed, and its
"0 confirmed" was an artifact of empty vote arrays, not a clean result. When a workflow's verify stage dies, treat
its raw findings as a triage list and check them by hand — as done here — rather than reading the summary count.

**Accessibility + scale, and imported evidence made reachable (`57b740ee3`).** The a11y/scale journey could not run
here at all: 23 of the 24 `rb-e2e` journeys pinned `executablePath: '/opt/pw-browsers/chromium'`, a cloud sandbox
path. They now use it only on Linux and Playwright's own resolution elsewhere (no CI or package script referenced
them, so this is zero-risk and unblocks every journey on the ThinkStation).

**Defect it found — imported external evidence was unreachable.** `VcdAnalyzerPanel` owns two states: with nothing
loaded it collapses to one compact row carrying "Load .vcd file"; only an actual import takes workspace. But
`VerifySurface` rendered it `{importedWaveform ? … : null}`, and `SimulationProviderBar` returns null unless
`hasImportedWaveform` — so **you could not import a .vcd at all**. There is no other entry point: the code comment
claiming "Load .vcd lives in the More menu" describes a menu that does not exist (grepped: zero hits). The panel now
renders either way and decides its own weight. Live: a 49px row at the foot of Simulate, "Provider: Imported VCD —
Optional external waveform evidence, replayed never executed. [Load .vcd file]", no overflow. This restores the P2
Chapter A claim ("imported-VCD Analyzer live in Simulate") to something true at HEAD — worth noting that the claim
had become false without any test catching it, because nothing asserted reachability.

**Accessibility + scale now proven** at 1440×900 and 1366×768: one `<main>` landmark, a 500-signal VCD bounded to
~200 rows with an honest "showing N of M" hint, keyboard-focusable controls, and no horizontal overflow under
reduced motion or at an effective 200% zoom (halved viewport). Contract: `verifySurface.importedEvidence` (3) pins
the compact entry state, the replayed-never-executed boundary wording, and that the panel hands the file to the
container rather than parsing it.

**Seam note:** the new `runIsStale` prop is deliberately separate from the existing `forceRunStale`, which carries
one specific signal (evidence restored after a reload) and renders its own reload-guidance banner. Conflating them
would show that banner for every authority-stale run — a false message.

**Known gap (not in this slice):** a project's own run ledger lives only in the runtime envelope of the
active project; reopening a project from the repository starts without its previous runs (the repository
snapshot carries scenarios, not runs). Extending the snapshot is a repository-format decision, not a new store.

**Next (P2.5H order):** Wave One — resizable Cases + Waveform composite (`rb-sim-lab-grid` rows →
accessible splitter, persisted ratio, collapse/maximize, keyboard); replay/inspection state words;
Waveform/Timing depth; Board camera + Constraints tool; Package provenance; Design geometry; persistence /
accessibility / scale / legacy.

## 2026-09-04 — P2.5G product completion, public launch and repository convergence (Fable 5.1 ultracode, desktop session)

**Label:** INTERIM REDBYTE PRODUCT AND RELEASE CONVERGENCE / SOURCE PRESERVED / EXACT CONTINUATION RECORDED.
HEAD `bf051d808` on `claude/redbyte-operational-workbench-convergence-w9k2r4`; origin still `2ef5e5ee8`;
safety tag `safety/redbyte-before-product-release-convergence-32b7b987a`. Nothing pushed; PR #84/#85, `main`,
the product branch, the public site and Cloudflare untouched; format version 1; both classroom goldens
byte-identical. **The §16 local product gate is not met, so the GitHub/release phase (§17–§22) was not
started** — the directive gates push/PR/site/deploy behind that gate.

**Method:** read-only gate census (workflow `wf_54a8d79a-78c`, six readers, 122 gaps; digest in the session
scratchpad `census.md`, regenerable from the census JSON in the task output), then implementation in
dependency order, then three read-only reviewers (workflow `wf_7a8033a3-9e3`, 36 findings) with every P0/P1
repaired in `bf051d808`.

**Landed (oldest → newest):**
- `2139c282d` Simulate playback over the completed run (auto-play after Run, 0.5×/1×/2×, loop, stop at
  mismatch, reduced motion honoured), live readout (tick/progress, changed inputs, observed outputs,
  mismatch), changing-lane markers; the board twin follows the selected case/tick with a Simulated-values
  layer; Board mount guard keyed on the mount-time row.
- `2657fbdb3` One Problems count everywhere (errors + warnings); bottom panel reveals once on a rise, with
  a Show-bottom-panel restore control.
- `e483e44dc` Export generator resolves label-derived row ids (`normalizeBoardRowId` shared in rb-utils):
  the twelve false "assertion target not declared" rows are gone. Goldens byte-identical.
- `c43aaeff6` Board guided loop: deterministic recommendation (bit-index aware), Next unmapped, Undo,
  resources selectable on their own with a resource card; resource-kind inference matches whole tokens
  (CARRY was read as a seven-segment cathode when its pin was cleared). Regression test.
- `28f07ad0a` Design: failing checks drawn on the schematic; Related in the trace toolbar; Driver = fan-in.
- `7a131f72d` Package: the Handoff overview is a dossier — figures (architecture, waveform, board), evidence
  table, click-through to Design/Cases/Waveform/Board/artifacts/Problems, Present mode, print keeps the
  document.
- `7ab489336` + `428f199d6` Runs ledger records scenario, kind, ticks, failed signals; Runs document shows
  them; the newest run is current by the runtime's own staleness, older ones superseded.
- `ea6c17adc` Architecture document isolates drivers / loads / path of the selected block.
- `450708b4b` Timing snaps to clock edges (Shift+Arrow); Case Lab keyboard editing (0/1/Backspace on the
  followed column); workspace digit shortcuts ignore handled keys; stale cases read as stale.
- `a2003310b` Waveform value slot beside every lane name.
- `bf051d808` Reviewer round: dossier stale flag = simulation staleness only; real .xdc line count; SHA
  wording; numbered figures by render order; operable rows; print grows; waveform figure windowed with
  IN/OUT tags; a replaying tick is never published (followed object survives a run); manual navigation
  stops playback; board values from the run only, mapped resources only; guarded "Map here"; honest Undo;
  observe runs read "observed"; bottom panel reveals on errors only; lane reorder (Alt+Up/Down, ▲▼).

**Validation at each commit:** rb-apps typecheck 779 (= baseline) under pinned Node 20.19.0; both classroom
golden Basys3 export gates byte-identical; new green tests: verifySurface.fieldIdentity, fieldAlias,
followColumn, hardwareMappingBridge token inference; every remaining red in the touched suites fails
identically in `.redbyte/worktrees/baseline-b635` (Design 16, Export 37 incl. timing-authority, history-
authority 7, waveform-priority 4, observe-first 1, simulationStudio/v3, hardware trust-clarity/readiness).
Live proof at 1366×768 and 720×450 emulation on the hierarchical adder: Design SUM[2] → Run → replay
(chip stays SUM[2]) → Board keeps SUM[2], LEDs 01111 from the last sample → Cases t3 → Board LEDs 00001;
CARRY cleared → recommendation LD4 → Use → W18; Handoff facts/figures/click-through; Present/print;
Runs "current"/"superseded"; Architecture isolate 1 → 10 blocks; keyboard 0/1 editing without switching
workspace. Captures: `evidence/p25d` regenerated at 1440×900 + 1366×768.

**Open, in order (from the census; all still unmet gate items):** Simulate — Run selected (deferred: a
partial run would overclaim scenario evidence; needs a per-case coverage model), resizable Cases/Timing +
Waveform composition, Live I/O + Waveform, Timing clock generator/reset pulse/run range/state lanes,
Waveform explorer hierarchy/groups/radix, expected overlay, dead oscilloscope CSS; Design — Layers tab,
Place tool, recent components, camera + layers per document, Schematic+HDL cross-reveal, Schematic+Waveform
split, buses as trunks (needs a multi-bit net), 200% inner grid; Board — camera (pan/zoom/fit), Constraints
bottom tool + XDC↔resource sync, Guided/Expert toggle, banks, bulk family select, filters; Package —
artifact dependency graph, previous/current package comparison, derived exports (SVG/HTML), validation
table, Handoff tests + spec; Project — Explorer Files view, context commands, used-in, compile-order
reasons, per-source diagnostics, Start Center Imported origin + richer peek; Shared — navigator coverage
(projects/filesets/components/lanes), history of document jumps, safe quick fixes, task presets, split
document groups, persisted selection/camera/waveform scroll; scale proof; accessibility audit; legacy
sweep (ScenarioBuilderPanel, ide-polish-pass remnants); duplicate Related menu (toolbar + inspector)
kept deliberately (inspector serves wire/signal selections) — reviewer P2. Then the release layer (§17–§22).

**Must not be reset:** everything above is committed; dev server on :5173; browser pane tab "seed" at
1366×768 emulation (reset with preset desktop); baseline worktree `.redbyte/worktrees/baseline-b635`;
scratch patch scripts are disposable. Exact next seam: the resizable Cases+Waveform splitter
(`rb-sim-lab-grid` rows in simulate-instrument.css → a persisted `--rb-sim-evidence-h`) or the Board camera.

## 2026-09-04 — P2.5F maximum product depth (Fable 5.1 ultracode, desktop session)

**Label:** INTERIM REDBYTE MAX-DEPTH RECONSTRUCTION / NOT A REVIEW CANDIDATE / NOT PUSHED.
HEAD `311ed2467` on `claude/redbyte-operational-workbench-convergence-w9k2r4`; origin still
`2ef5e5ee8`; safety tag `safety/redbyte-before-max-depth-6fcf75b0d`. Nothing pushed; PR #85,
`main` and the product branch untouched; format version 1; both classroom goldens byte-identical.

**Landed (oldest → newest):**
- `9eb00213b` Universal Navigator (Ctrl+K) over the derived index in `workbenchNavigator.ts` —
  signals, buses, modules, instances, sources, cases, failures, board resources, constraint lines,
  artifacts, problems, runs, open documents — every entry opens the real document and publishes
  the exact selection; ambiguity is shown, never guessed. One Problems ledger
  (`engineeringProblems.ts`) over project health, design authoring, the compiler, signal identity,
  the run, board mapping, export validation and import fidelity; one fact is one row; a shared
  Problems tool window (`components/ProblemsPanel.tsx`) in every workspace's bottom dock; the
  status bar, the Design tab, Package's fact and the navigator all count the same list.
- `2f7f2c6c9` Close / Close others / Reopen closed as registry commands (View menu, navigator,
  tab context menu); availability from the command context.
- `3882ebbca` Start Center rebuilt as a library (`surfaces/project/StartCenter.tsx`): sections,
  dense list, real ArchitecturePreview of the selected lab/starter/recent project, one Start
  command. Old ProjectLanding/StarterCatalog/RecentProjects deleted with 66 legacy rule blocks;
  the polish-era dark input slab rewritten to workbench tokens; E-tier codes gone from lab copy.
- `a2648438f` Design layers (Layers menu, persisted), bus brackets (`SchematicBusBrackets.tsx`,
  lanes per side), hierarchy frames, pin values from the working zoom.
- `28a4ea1e7` Export generator resolves the V2 mapping (V2-only projects were blocked with twelve
  testbench-target errors); Design toolbar Trace group (Driver, Loads).
- `2edf2d926` Waveform: one command bar replaces five header rows; Signals rail filter.
- `17ab94d0b` Board layers + conflict state; centre never collapses (stacks under 900px);
  constraint sets on demand.
- `336588258` Case Lab multi-select (Shift/Ctrl, Ctrl+A), bulk expected edits in one write, run
  history line, # column = case number (tick). **Field identity:** the Simulate surface's canonical
  field id is now the project io-row id byte for byte — it used to rewrite `carry-out` to
  `carry_out`, the runtime's alias rule strips punctuation, every surface write was pruned as an
  unknown output and the hierarchical adder's authored carry expectations vanished (dead CARRY
  column; Compare never checked carry). The runtime also accepts the underscore spelling as an
  alias of the same row. Reviewer P0/P1 fixes: false Verilog port-parity export lint removed; Board
  narrates the selected row and adopts a followed signal on mount; Related… menu fixed-positioned
  (escapes the dock's scroll box, flips at the viewport edge); Package strip vocabulary + full
  export hash + "browser-verified" wording; 0-based cases; architecture figure net tracks; bus
  planner collapses to a summary once every member has a pin; project switch clears the selection.
- `81878278b` **Select once, follow everywhere — the Cases side:** the followed signal is a Case Lab
  column (header underline, cell wash, aria-current); a click on any output column makes that
  signal the followed one and publishes it from Cases. The Simulate landing effect re-runs only
  when the set of lanes changes; the default-lane auto-select yields to a selection made elsewhere
  (null lane included) and converges on the timeline's own lane name. Tools menu retired (its two
  entries duplicated File and the Board rail; Navigator heads View). Lab goals say "Run Compare in
  Simulate" / "Build the Vivado package"; the RTL schematic is named as a Vivado view.
- `311ed2467` Waveform "‹ Edge / Edge ›" step the followed lane's transitions (count beside
  them). Narrow windows / 200%: folded docks capped (22vh/24vh), bottom tool window bounded
  (30vh), shell rows give the workbench the remaining height.

**Validation at each commit:** rb-apps typecheck 779 (= baseline), rb-logic-view 49 (= baseline),
both golden gates PASS, Design set 16 red = the 16 inherited names (classified against the
baseline worktree), Board 5 red = inherited, Simulate reds ⊂ inherited (observe-first
"publishes the auto-selected observed signal", simulationStudio "runs no-check stimulus…",
verifySimulationStudio.v3 "names the student task…", waveform-priority ×4, hardware/export
trust-clarity — all fail identically in the baseline worktree), lab-day only the pre-existing
Verify-detach red. New green: verifySurface.fieldIdentity (3), projectRuntime.fieldAlias (3),
verifySurface.followColumn (2), simulationStudio "cell-level optional checks". Live-app proof
(this session, 1280×720 pane + 720×450 emulation): Ctrl+K → SUM[2] lands the exact signal; Design
SUM[2] → Cases followed column → SUM[1] header click → chip "SUM[1] ← u_fa1/SUM · E19" → CARRY
→ Board opens on the CARRY row; fresh hierarchical adder: CARRY column exp 0 0 0 1 0 1, Compare
report carries the carry signal, six carry checks pass; Waveform SUM[1] edges t1/t2/t4.

**Open, in order:** Design at 200% — the workbench inner grid is still content-sized
(rows 160/520/180 in a 318px main; the schematic shows but the frame overflows; the winning rules
live in `ide-root.css` ≤860/≤760 blocks and the design pane row); Run menu "Run Compare"
(needs a Simulate run-request bridge — the Compare rows are computed inside the surface); Waveform
lane groups; Timing snap-to-edge + run range; Package provenance previous/current comparison;
keyboard/screen-reader audit; scale proof (256 cases, 500 lanes); legacy sweep
(ScenarioBuilderPanel, ide-polish-pass remnants); stale run evidence from a previous project state
still renders under the STALE strip after a reload (the strip is honest; consider clearing the run
on project switch); a second reviewer round (the first was workflow `wf_e8a568cb-83b`).

**Must not be reset:** everything above is committed; dev server on :5173 (already running,
serves this clone; browser pane tab "seed", last left on the hierarchical adder with SUM[1]
followed in Simulate); baseline worktree `.redbyte/worktrees/baseline-b635`; scratch patch scripts
under the session scratchpad are disposable. Exact next seam: the Design 200% inner grid (see
Open) or the Run-menu Compare bridge — both are contained; nothing is half-edited.

## 2026-09-02 — P2.5E signature engineering workbench convergence: Wave 1 landed, Waves 2–3 in flight

**Status: INTERIM REDBYTE SIGNATURE WORKBENCH RECONSTRUCTION / NOT A REVIEW CANDIDATE / NOT PUSHED.**
HEAD `c9d7706d4` on `claude/redbyte-operational-workbench-convergence-w9k2r4`; origin still
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
- `048032cfd` Documents decide replay mode (never a prior run); Simulation Studio + workstation tests
  migrated off the retired selector. `e9b16e2d9` Cases keeps a compact evidence deck (36% cap) —
  the trace stage stays in Cases because 21 waveform-behaviour tests exercise it through the Cases
  mount; the Waveform tab owns the full instrument without the grid.
- `d0c804d41` Case Lab: arrow keys / Home / End move the selected case, F / Shift+F step failures,
  ‹ Fail / Fail › beside Failures only; one scenario shows only the explorer header.
**Wave 4 — physical + handoff (started):**
- `0bc03c7aa` Board bring-up resolves EXPECTED_IO rows to LEDs through the index (no substring); the
  constraint panel states the live mapping as the implicit active set ("Live mapping · 5 pins ·
  active · packaged as top.xdc").
- `fbf9fe77a` Package Handoff Overview document (tab "Handoff", opened from the Package toolbar):
  hash, state, files/bytes, mapping completeness, simulation result, constraints, architecture
  block view, mapping table, artifact manifest, warnings, proof boundary; print stylesheet; in-app
  only, nothing added to the canonical ZIP.
- `c9d7706d4` Library rows carry their badges on one line: a row is a three-column grid but can
  also hold a capability badge and a palette badge, which were wrapping into an implicit second
  grid row and printing over the next part against the fixed 28px height. Extra children now take
  implicit columns, the port summary shrinks before the name or a capability warning, and the row
  clips. Timing lanes take the keyboard (Left/Right move the tick, Home/End jump). `capture.mjs`
  gained steps 12–14 — the SUM[2] journey at every viewport.
- `c681a0f51` The starter brief becomes project context (Project Overview: name, lab, concept,
  next action, summary, expected behavior — absent when the project did not come from a starter);
  the Board I/O tab carries its own search bound to the shared query, because the list moved but
  the filter had not; the health chip keeps its informative states ("Blocking circuit issue",
  "Empty canvas", "Add circuit I/O") and only the two "Ready for Simulate" branches became
  "Clean" / "Review wiring". Ten Design tests migrated onto the new owners, two Project tests
  added for the relocated brief.
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

**Validation at `c681a0f51` (Node 20.19.0, the repo pin):**

| Gate | Result | Baseline |
| --- | --- | --- |
| rb-apps typecheck | 779 errors | 783 — four fewer, none added |
| rb-logic-view typecheck | 49 errors | 49 — unchanged |
| classroom golden Basys3 export gate | PASS | byte-identical |
| classroom golden Basys3 ALU export gate | PASS | byte-identical |
| Design set (34 files) | 16 red / 269 pass | exactly the 16 inherited names |
| Simulate set (32 files) | 22 red / 200 pass | subset of the inherited names |
| Board set (6 files) | 5 red / 57 pass | name-identical to baseline |
| Package set (6 files) | 37 red / 28 pass | baseline count |
| Document host + Project workbench | 24 pass / 0 red | new |
| Captures | 60 PNGs (15 states × 4 viewports), 0 console errors, no body scroll | 1440×900 · 1366×768 · 125% · 200% |

Every red is classified: it reproduces on the pre-campaign baseline, or it was migrated onto
the new owner in the same commit that moved the behaviour. Nothing was deleted to go green.
Migrated this campaign: `workbenchChrome` (selection and target moved to the frame bar),
`workflowStages.authority` (Run menu), `verifyCommandBar.actionRowHierarchy` /
`studioRunAuthority` and `verifySurface.simulationStudio` / `workstation` (documents own the
instruments), `exportSurface.handoff-states` (role guide, no narration card),
`designSurface.paletteDock` ×6 / `libraryRail` / `idleInspector` / `workstation` (Board I/O owns
board resources; one categorized component list; no canvas starter narration), plus two new
`projectWorkbench` tests for the relocated starter brief.

**Signature proof — the SUM[2] causal journey (captures 12–14, all four viewports):** selecting
SUM[2] on the hierarchical 4-bit adder names it in the frame bar as `SUM[2] ← u_fa2/SUM · U19`;
Related… offers Open schematic (driven by u_fa2/SUM), Open FullAdderCell (inside u_fa2), Open
cases (16 checks on SUM[2] in Default), Open board mapping (LED LD2 · U19) and Open package
(SUM[2] in top.vhd, top.xdc, testbench.vhd). Following the Cases hop lands on SUM[2] in the case
grid, the signal rail and the inspector; following the Board hop lands on the SUM[2] mapping row
with artifact port SUM[2], LED LD2, pin U19 and its two XDC lines. One object, six
representations, no string matching anywhere in the chain.

**Open defects carried forward (recorded, not fixed):** one problems ledger (the status bar counts
design diagnostics only while Package reports its own warning count); Waveform still carries four
header rows above the lanes and has no scope tree (the signal rail is a flat list); the Board
three-column grid squeezes the centre board at 200% (the header wraps, the board does not);
Design library rows clip their port summary at the 220px dock (the full interface stays in the
row tooltip); buses render as individual bits rather than bundled nets; per-artifact provenance
in Package is a manifest, not a dependency graph; saved/reloaded layout was not re-verified this
campaign.

**Claim boundary (unchanged):** Browser-E0 only. RedByte generated the package; Vivado
synthesis, implementation, timing, bitstream, programming and physical observation have no
evidence here. Format version stays 1. Both classroom goldens are byte-identical. Nothing was
pushed; PR #85 untouched; `main` and the product branch untouched.

**Next (in order):** Case Lab multi-row ops and run history; Waveform frame (Signal Explorer · Wave Canvas · Evidence Inspector; consolidate
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
- **CURRENT PHASE:** P2.5K instrument finish - see the newest dated entry at the
  top of this file. The frame is built in the reader's text size, the five obsolete
  shell gates are classified and closed, and Design / Simulate / Board / Package
  each landed a composition pass. Open: the Board Guided/Expert split, the
  Project/Start consistency pass, and three export `ide:gate:*` gates.
- **CURRENT ACCEPTANCE PROOF:** `full-adder-operational-journey.mjs` drives the
  whole student path through the real interface at 1440x900 and 1366x768 - first
  use, Start a Lab, Design, Compare PASS, a broken gate, Compare FAIL with a
  concrete mismatch, Trace, repair, an authored expectation, Board mapping, a real
  browser download read back against the mapping, and reload. It also passes
  against the built bundle and against the deployed Cloudflare branch preview
  through `RB_BASE_URL`. The earlier narrow `compare-verdict-journey` note is
  superseded. No Vivado, bitstream, board, or classroom-certification claim.
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
