---
doc_status: current
last_validated: 2026-10-25
owner: Connor Angiel
used_by_claude: true
role: single design authority for the flag-gated Meridian studio (P1 counter slice)
---

# Meridian design system

This document is the design authority for the Meridian studio entry (`/os/?studio=meridian`).
The code authority is `packages/rb-studio/src/styles/meridian.css`, which holds every studio
token, scoped under `[data-rb-studio]`, with no `!important`. Nothing here styles the classic
workbench. The workbench cascade (ide-root, polish passes, Tailwind) never reaches the studio:
the studio boots from its own entry and never imports `IdeApp` or legacy CSS. In the built
`dist`, the studio's styles are the Meridian sheet plus the IBM Plex `@font-face` rules.

Status: P1 vertical slice on the shipped 2-Bit Up Counter. It is implemented locally and
browser-gated (`scripts/gates/ide-meridian-counter-slice.mjs`). The owner chose the visual
direction (Meridian Atlas, below) on 2026-10-20. The Atlas completion pass (same day) made every
view read time from the engine's own order inside a tick (below), added causal navigation and
corrected the board's button mapping. The slice itself is **not yet accepted by the owner**.
Agent review is not acceptance.

## The idea: one circuit, many synchronized realities

There is one canonical document, and every view projects `(revision, ObjectRef, Moment)`.

- **The sheet persists.** It is the persistent centre and never remounts. Design, Simulate and
  Board are arrangements of lenses around it, not separate apps.
- **The Moment** is the single shared coordinate. It has three forms:
  - `null`: Edit, where nothing is lit;
  - `{source:'live', seq}`: Explore, which is not recorded;
  - `{source:'recording', runId, tick, view, eventOrder}`.
- **The kernel holds coordinates, never facts.** The kernel is `packages/rb-studio-kernel`. The
  project runtime, immutable recordings and the emitters keep owning their facts.
- **Light means a measured value.** Light in a wire is an observed value at the current Moment.
  With no Moment there is no light.

## Direction: Meridian Atlas (owner choice, 2026-10-20)

The studio is one drafting sheet read at every scale:
- **Ground:** paper `#f7f6f2` and ink `#1b1e23`.
- **Light:** logic 1 is drawn in blue as a measured value.
- **Time:** a single vermilion meridian marks now.
- **Margin:** boundary ports print the board resource where it differs from the port's name,
  plus the package pin (`EN / SW0 · V17`, `LD1 / pin E19`).
- **Board stage:** the board lens gets `clamp(272px, 45vh, 400px)`.
- **Dark scheme:** follows the workbench theme with the same rules.

At the concept checkpoint the owner compared Meridian Atlas with two alternates on the same
engine and the same counter (captures in `.redbyte/meridian/shots/concepts-final/`, local
evidence only):
- **Signal Observatory:** a dark, time-first instrument.
- **Bench Twin:** physical-first, with a deep board frame.

Both alternates were retired after the choice: their token sets, layout preset and the
`?concept=` switch are gone.

## Graphical language

| Element | Treatment | Contrast (measured on its ground) |
|---|---|---|
| Logic 1 | `--mrd-logic-1` `#0a5ba8`, stroke 2.5px, tag `1` | 6.32:1 on sheet |
| Logic 0 | `--mrd-logic-0` `#7d838c`, stroke 1.25px; tag drawn in ink-2 | stroke 3.53:1 (non-text ≥ 3:1); tag 6.23:1 |
| Clock net | line and junctions in ink-2 at every level (`[data-clock][data-value]` outranks the value rules); its tag reads `↑` only where the recording shows the clock rising (by a tick's sample, or in the current step's phase), and the recorded level otherwise | ink |
| Unconnected input | a hollow caution circle on the pin (plus `0·` outside Edit, which shows no values), with the inspector text "unconnected · read as 0"; the status-line count selects and frames the part | caution `#a04e00` 5.42:1 |
| Failure | crimson `#a8155a` plus `≠ signal` (the output that failed) plus a hatch on the check cell and on that lane's tick. The lane says `≠ expected v`. Never colour alone | 6.65:1 |
| Pass | ink `✓ n` and the words "N checks passed". Never green. A recording without checks says "recorded without checks", never "0 checks passed" | ink 15.45:1 |
| Selection | ink double contour hugging the part's body (inner 2px, outer 1px), drawn under the wires; names and margin labels sit on a paper halo, so the ring never strikes through them | ink |
| Focus | 2px solid ink outline on controls and on the sheet (inset); one solid 2px ink contour around a focused, unselected part; a focused selection thickens its outer ring; a white contour on a focused board part. Never dashes (dashes mean pending or unrecorded). The Time lens's ticks, lane names and checks are buttons in the tab order; the tick keys also work anywhere. Never blue, which means logic 1 | ink |
| Time meridian | vermilion `--mrd-now` `#c23a1e`, with a centred tab `tN`, or `tN · k/n` on a step inside the tick. It stops above the checks row; the current check carries a vermilion top rule | white on now 5.36:1; dark schemes use dark text on now (≥ 6.19:1) |
| Registers | heavy outline. The state window `prior→current` is printed inside the register, between its data and clock rows, from retained samples only. Inside the rising edge, a capture not yet committed reads `0→1…` in a dashed frame | ink |
| Board LED lit | `--mrd-board-led-on` `#6fb3f5` with a white rim; parts the design does not use recede to 60% | ≈ 6.6:1 on the board plane |

**Vermilion** marks only "now" (the meridian, its tab and the current tick) and the RedByte
wordmark. Vermilion and crimson differ by only 1.34:1 in luminance, so vermilion never marks an
error, and errors always carry a glyph and a hatch.

## Time inside a tick: the engine's own order

The board-clock schedule (`simEngineCore` `executeClockedMacroVectorCase`) runs each vector tick
as three engine ticks, and a capture-enabled Run keeps every evaluation of each:

| Phase | What happens | Drawn at (fraction of the tick) |
|---|---|---|
| `macro-low-before` | the tick's inputs are applied with the clock low | 0, the tick start |
| `macro-high-sample` | the clock rises: registers capture, commit together, logic settles; the published sample is taken here | 0.3, the rising edge |
| `macro-low-after` | the clock falls | 0.7, the falling edge |

- **Only these three boundaries are positions.** They are the schedule's own stimulus events.
  Evaluations inside one phase happen at that boundary, in dependency order, with no simulated
  delay: they have a step number ("step 34 of 63"), never a time. The published sample is drawn
  at 0.5 (clock high, after the edge settled).
- **Lanes change where the recording says they did** (kernel `timeline.ts`): each phase's
  settled values, with every input pin resolved through its driver. EN changes at the tick
  start; Q1, Q0, LD0 and LD1 change at the rising edge. The rising-edge settlement equals the
  published sample for every key, at every tick (unit-tested).
- **A selected register shows its data input above Q.** D before the edge is what the edge reads;
  D after the edge has settled (the registers' own change fed back).
- **The clock lane is drawn from its recorded levels** (in neutral ink, never as an assumed
  pulse). On the board-clock schedule that is low, rise, high, fall in every tick; an authored
  clock (manual pulses, a switch, a Clock part) shows exactly the levels it was given.
- **Without retained evaluations** (an older engine, capture off, or past a truncated trace's
  limit) a lane has one sample per tick, and a change between two samples is drawn slanted
  across the gap, never at a moment. The lens says so in its meta line.
- **Not simulated.** A design the simulator refuses (an invalid model, e.g. a combinational
  loop) records the test inputs only. The inputs are drawn as recorded values; everything else
  is unrecorded; the run status and the lens say "not simulated".

### Causal navigation

The inspector's one causal action jumps from a value to the retained evaluation that set it
(kernel `findCause`, which compares each evaluation with the part's own last recorded value):
"Show the clock edge that set Q1" at t3; from t4, "Show the clock edge that set Q1 (t3)". It is
called a clock edge only when that evaluation recorded the part's own active edge (its clock read
against the level it held before); a register cleared with no edge gets "Show the step that set
Q1". The meridian stands on the edge, the sheet shows Q1 still 0 with its capture
pending (`0→1…`), the inspector reads "Q still shows 0: all stored values update together, just
after this edge" ("… just after this step" when no clock edge was recorded, e.g. a clear) and the
Logic lens marks the values at the edge ("what Q1 captures"). **Back**
(in the strip, and Esc) returns to the moment the student came from, on the same stage, with the
same selection, also after a trip through Design. When a value never changed, or the evaluations
were not retained, the inspector says so instead of naming a cause.

### The inspector explanation

Built only from the recording (kernel `explainSelection`), in recorded facts: the previous and
current samples ("Q1 was 0 at t2 and is 1 at t3"), the evaluation that produced the value ("At
the rising clock edge in t3, Q1 read D = 1 (from RST1)"), its effect ("So its stored value
changed 0 → 1"), a one-line rule in student words, and, where they differ, that a data input
settled after the edge. Edge or no edge, changed or kept, and an active reset come from what the
evaluation recorded (`captureFacts`), never from the phase name: a clear with the clock low reads
"with no rising clock edge (the clock was low) … changed 1 → 0 while RST = 1", and an authored
clock's edges are read from its own levels. The clock's own story is its recorded levels in the
tick. The pins table is headed by the Moment ("Pins at t3"); every pin reads its wire's value
(the net, as the sheet draws it); a clock pin reads "↑ rose in t3" only where the recording shows
the rise; Edit lists pin names only; withdrawn values say why (design, pin mapping, or an older
recording).

## Type

- IBM Plex Sans and IBM Plex Mono, bundled through `@redbyte/rb-apps/fonts`.
- Screen-space text sizes are 12 / 13 / 14 / 15 / 18 px. **12px is the floor.** Key hints are
  12px.
- **Sheet text lives in world space.** `textTierForZoom` (`camera.ts`) sets `data-text` on the
  sheet as the camera moves. A text class that would render below 12px is **dropped, never
  shrunk**:
  - `all`: zoom × 10.5 ≥ 12. Pin names and part types are the smallest secondary labels, at
    10.5 world px.
  - `titles`: zoom × 12.5 ≥ 12. Only titles, value tags and boundary names remain.
  - `none`: no text remains.
- **Board silk** is 13.5 board units. The board never renders below 0.9 scale (minimum
  560×234 px; the lens scrolls), so silk is at least 12.15px. LEDs and switches print their
  number under an `LD` / `SW` row caption; each part keeps its full name in its title.

## Layers

From bottom to top:
1. sheet;
2. selection (the double contour, under everything it marks);
3. structure (nets, then symbols; names on a paper halo);
4. value attributes (`data-value` written imperatively on `<g data-net-id>`);
5. attention (unconnected markers, pending wire);
6. lenses, separated by 1px rules. Never cards.

The elevated layer holds the shortcuts overlay and the example-link notice.

## Motion

| Token | Duration | Used for |
|---|---|---|
| instant | 0 | — |
| quick | 120ms | dimming |
| move | 200ms | — |
| travel | 240ms | camera only: Fit and frame-selection |

- **Values and the meridian snap;** they never interpolate. Wires have no transition.
- **Reduced motion.** `data-motion=reduced` comes from the OS preference and removes camera
  travel. The slice gate checks three things, the third in a second browser context:
  - with full motion, Fit passes through intermediate camera positions;
  - under reduced motion, Fit jumps once;
  - every net carries the same recorded value at t3.

## Camera

- **Session-only and owned by the student.** Per the contract, the camera is not saved with the
  project.
- **Stage changes keep the student's zoom.** They keep the world point at the centre of the view
  while the pane resizes (`recenterOnResize`). The gate checks both.
- **Fit and F are explicit.** Topology changes never refit.

## Keymap

`keymap.ts` extends the shipped keys and never redefines them:

| Keys | Action |
|---|---|
| 2 / 3 / 4 | stages |
| Ctrl+Enter | Run |
| Esc | backs out one step: a pending wire, then a running Run, then the keys overlay, then a step inside a tick (Back), then focus, then the selection |
| Ctrl+Z / Ctrl+Shift+Z | undo / redo |
| T / L / H / B / I | Time / Logic / Source (HDL) / Board lens / Inspector. A lens key brings an open-but-hidden lens on screen; it closes a lens only when that lens is on screen |
| ? | keys |
| E | Explore or Edit |
| . | one clock edge |
| Delete | delete the selected wire |
| F | frame and focus the selection (dims what lies outside its cone); fit the sheet when nothing is selected |
| ← / → | tick |
| [ / ] | step inside a tick (previous / next recorded evaluation) |
| Home / End | first / last tick |

- **No Alt bindings.**
- **The collision test.** `__tests__/keymap.pure.test.ts` reads the shipped
  `KeyboardShortcutsModal` and the IDE command shortcuts. It fails if a studio key collides with
  a shipped key without declaring that it keeps the shipped meaning.

## Pane budget

- Below 1600px wide: the sheet plus one lens.
- At 1600px or wider: the sheet plus two lenses.
- Other lenses are one key away and stay bound to the same Moment.
- The slice gate checks 1536×864, 1366×768, 1280×650, 1152×720 (the CSS-pixel viewport of
  1440×900 at 125% browser zoom; layout only) and 1440×900 on both the Simulate and the Board
  stage: no root overflow, the sheet and the lens keep at least 200px each, and neither the
  project name nor the Moment is truncated. It measures the strip at its fullest (a step inside
  a tick reached by causal navigation, with Back, the chip and Run again, and a longer part
  name) and Explore with its edge count. A 40-tick recording checks that the lane names stay at
  the left edge and the meridian stays in view.
- The View controls (Fit, −, zoom, +) sit in the title strip, outside the drawing, so they never
  cover a part or a margin label. The strip keeps the Moment whole: nothing in it shrinks, and
  when its content overflows (measured after every render and resize) the lower-priority parts
  give way one at a time: key hints and "browser"; "simulation ·" (the tier keeps its tooltip)
  and wide gaps; the zoom −/+ (the wheel and Fit remain); the phase words of a step; the chip
  (the bar already says "not current"); the stage label (the rail marks the stage). Only then may
  the Moment itself ellipsize.
- Every lens, the inspector and the keys overlay are also buttons in the status line, on every
  stage; the strip's ‹ › step ticks with the mouse; clicking a trace or a check seeks its tick.
- Project and Package leave the studio: they read as links (↗), not stages.

## Runs: the workbench's own rules

- **Same Run request.** A studio Run is built from runtime state the way the workbench builds
  it (`planStudioRun`, `ideExportProject.ts`): the same live schedule contract (export project:
  top circuit plus generated HDL), clock roles, clock policy and replay hash. The gate checks
  that studio and classic Runs of the counter share one RunIdentity and output digest.
- **A Design issue turns checks off.** While a design-owned export blocker or a blocking
  compiler error exists (for example a combinational loop), the Run records without checks. This
  is the workbench's rule (`ideDesignBlocking.ts`). A floating output is only a warning there, so
  it does not block. The run status names it briefly ("checks off · Combinational loop
  detected"), with the issue's message, hint and "Fix it in Design, then Run again" in its
  tooltip, and only for the recording that Run produced.
- **A loop is also not simulated.** A combinational loop makes the model unrunnable: the engine
  records the test inputs only (trace "unavailable · invalid-ir"). The status reads "checks off ·
  not simulated · …" and the Time lens "not simulated · only the test inputs were recorded".
- **One fact in one place.** The run label and the check count live in the bar; the strip
  carries the Moment. Checks from a recording made before the last edit are never shown as a
  current pass: the run status turns caution and says "not current".

## Session safety

`?example=` opens a starter directly only into a pristine session. That is the workbench's
"nothing open" rule (a home project with no circuit, no vectors and no example), plus no
recordings and no reusable modules. Otherwise the studio asks first: "Keep my session" or
"Open the example". The parameter is removed from the address bar either way, so a reload keeps
the working session. The gate checks both.

## Staleness: two predicates

| Predicate | Rule | Effect |
|---|---|---|
| `paintEligible` | The design digest, computed exactly as `buildRunIdentity` computes it, equals `run.identity.design`. A recording without a design identity (an older engine) is never eligible | When true, recorded values may paint on the live sheet |
| `evidenceCurrent` | The workbench's run scope: `deriveRunScope` with the run ledger entry and the current project hash | Owns PASS/FAIL currency |

- **Moving or relabelling keeps values.**
- **Rewiring withdraws values from the sheet**, with "design changed · values withdrawn" (the
  full sentence is its tooltip) and a **Run again** button in the strip.
- **Undo repaints with a chip:** "not current" (its tooltip: "Same design as this run, so its
  values are drawn. Run again to make its checks current."). The chip is shown whenever recorded
  values paint but the evidence is not current; the bar's run status says "not current" too.
- **An older recording without an identity** says "older recording · values withdrawn" in the
  strip, "as recorded · older recording" in the Time lens meta line, the reason in the inspector,
  and names it in the Board legend.
- **The Time lens stays as recorded** and is labelled stale.
- **The Board lens only lights LEDs from a recording.** Its legend says what the board shows:
  - a recorded tick: "Recorded · tN · simulation · not a board observation" (plus "step k of n"
    inside a tick);
  - while exploring: switches show live inputs and LEDs stay unlit;
  - after a withdrawal: whether the design or the pin mapping changed, or that the recording is
    an older one without a design identity, with a Run again button.

## The board: one drawing, the project's own mapping

- **Positions** come only from the board catalog's `visualCoordinate` (`basys3Pins.ts`): the
  D-pad is C in the middle with U above, D below, L left and R right.
- **Mapping** comes only from the resolver's binding, cross-checked against the catalog's
  package pin (`boardModel.ts`). A project row may name its resource by alias (`SW0`, `BTNC`) or
  by package pin (`V17`, as the Half Adder does); both resolve to the catalog resource. A binding
  whose pin disagrees is never drawn as mapped; the legend lists it. Bindings to parts this
  drawing does not place are named in the legend.
- **Switch and LED labels** drop a repeated resource name ("LD0 (CARRY)" on LD0 reads "CARRY"),
  stagger on two levels where neighbours would collide, and stay inside the board; a label that
  still cannot fit is shortened, and the full name stays in the part's title. Unit-tested with
  the shipped Half Adder and 4-bit adder labels and a 16-LED stress case.
- **Board parts are controls:** a mapped part is reachable by Tab, named ("RST on Center
  pushbutton BTNC, pin U18") and selected by Enter or Space.
- **Labels belong to their part.** A pushbutton label sits outside the D-pad on its button's
  side; the centre button's label sits up-left on a 1px leader. A mapped button is ringed. The
  legend states each button binding ("RST = centre button (BTNC · U18)"). Unit-tested for every
  button: no label crosses another part or label, and a label without a leader is nearest its
  own button.

## State matrix (P1 coverage)

| State | Sheet | Time | Logic | Source | Board |
|---|---|---|---|---|---|
| Empty (no recording) | Edit: no light | "Run creates a recording" | derived table, labelled "not an observation" | generated preview | unlit, mapping shown |
| Live (Explore) | live values, "not recorded" | — | current row from live values | — | switches show live inputs; LEDs unlit |
| Recorded | values at tN | cursor, checks | current row | driver span | LEDs from recording |
| Recorded, evidence not current | values plus the currency chip | cursor, checks | current row | driver span | LEDs from recording |
| Stale (design changed) | withdrawn | kept, `data-stale` | values withheld | recorded source | withdrawn ("design changed") |
| Recorded, inside a tick (event view) | values up to this step; captures pending | meridian on the phase boundary, `tN · k/n` | the values at this step | driver span | LEDs at this step |
| Failure | — | opens at the failed tick; `≠ LD1` cell and lane hatch; "1 of 14 checks failed" | — | — | — |
| Checks off (Design issue) | — | lanes; "no checks in this recording" | — | — | — |
| Not simulated (invalid model) | inputs only | inputs only, "not simulated" | — | recorded source | LEDs unrecorded |

The truth table treats constant sources as fixed values and every output of one register as
one stored bit (`Q_inv` is `¬Q`). Its result column is named (`Q1 next`), the operators present
are spelled out (`⊕ = XOR, · = AND, ¬ = NOT`), and a caption says which row is marked: "the
values recorded at t3", or, at a capture, "the values at this clock edge → what Q1 captures".
Which row to mark in the published view (the values at t3, which predict the next edge, or the
row that produced t3's state) is an open owner decision.

Pending for P2:
- legacy recordings beyond withdrawal (an older engine's values never paint the live sheet).
  Samples-only and truncated recordings get one sample per tick in the Time lens (changes drawn
  slanted between samples; the lens says where the evaluations stop) and their limitation in the
  inspector. Their lane data and explanations are unit-tested; the slanted drawing itself is
  browser-checked only for the not-simulated case. There is no dedicated legacy view;
- hierarchy;
- sheet culling at scale (the sheet draws every net; see RB-DEBT-019 and RB-DEBT-024).

## Evidence boundary

Every value in the studio is browser simulation (E0). A recorded Board legend says "simulation ·
not a board observation". Nothing here establishes Vivado (E1), programming (E2) or an observed
board (E3).
