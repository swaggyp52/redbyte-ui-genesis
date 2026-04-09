---
type: architecture
status: active
area: verify
updated: 2026-04-09
related:
  - "[[Verify Hint System]]"
  - "[[Connection Model]]"
  - "[[Test Infrastructure]]"
  - "[[BUG-003 React.act Infrastructure Failure]]"
  - "[[BUG-004 Verify Hash Includes Non-Circuit Fields]]"
  - "[[BUG-006 TRACE vs VERIFY Mode Collapse]]"
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

---

## Canonical Shape / Contract

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
