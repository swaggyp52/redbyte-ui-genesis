# Agent Bootstrap: VerifySurface

## Domain

VerifySurface is the IDE surface where students define, edit, and run test vectors against their circuit designs. A test vector specifies input signal values and the expected output values at a particular simulation tick. Students add vectors manually through an editor pane or accept auto-generated bring-up vectors, then click "Run Verification" to simulate the circuit and compare actual outputs to expected outputs. Results are displayed as a PCB-style SVG waveform with per-signal pass/fail coloring, a mismatch table, a truth table pane, and (in step-through mode) a per-tick signal snapshot panel. The surface bridges the authoring layer (raw `TestVector[]` from project state) and the report layer (`RuntimeVerifyRun`) and owns all the UI state for filtering, zooming, stepping, and debugging verification runs.

---

## Key Files

| Purpose | Path |
|---|---|
| Main surface component | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` |
| Report builder and signal index | `packages/rb-apps/src/apps/ide/verifyReport.ts` |
| Runtime state and verify actions | `packages/rb-apps/src/apps/ide/projectRuntime.ts` |
| Sim engine — runtime trace sampler | `packages/rb-apps/src/apps/ide/sim/simEngine.ts` |
| Bring-up vector generator | `packages/rb-apps/src/apps/ide/bringupArtifacts.ts` |
| TestVector schema definition | `packages/rb-utils/src/labProjectSchema.ts` |
| IDE primitive components | `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx` |
| Surface layout wrapper | `packages/rb-apps/src/apps/ide/components/IdeSurfaceLayout.tsx` |
| Surface layout primitives | `packages/rb-apps/src/apps/ide/components/SurfaceLayoutPrimitives.tsx` |
| Truth table pane | `packages/rb-apps/src/apps/ide/surfaces/TruthTablePane.tsx` |
| Global IDE stylesheet | `packages/rb-apps/src/apps/ide/ide-root.css` |
| IdeApp (host component, owns setVectors) | `packages/rb-apps/src/apps/IdeApp.tsx` |

---

## Architecture Notes

### Vector normalization pipeline

Vectors flow from raw project state through a normalization step before they are used anywhere in the surface:

```
props.vectors: TestVector[]          ← no id field; tick/inputs/expected only
        │
        ▼
normalizeVectors(vectors, inputFields)
        │  • generates synthetic id: "vec-01", "vec-02", ...
        │  • clamps tick to 0, floors to integer
        │  • restricts inputs keys to known inputFields
        │  • sorts by tick ascending
        ▼
authoredVectors: VerifyAuthorVector[] ← has id: string, tick, inputs, expected
```

`normalizeVectors` is a pure function defined at the bottom of `VerifySurface.tsx`. It accepts `VerifySurfaceProps['vectors']` (may be `undefined`) and the `inputFields` derived from `mappedInputs`/`mappedSignals`. The `VerifyAuthorVector.id` ("vec-01" etc.) is local to the surface and used for draft state keying only — it is never persisted back to project state.

### buildVerifyRowsFromRuntimeTrace — samples only at vector ticks

`buildVerifyRowsFromRuntimeTrace` (in `simEngine.ts`) takes the live sim trace (`RuntimeSimState.trace`) and the project vectors, then **only looks up trace samples at ticks named by the vectors**. It does not emit rows for every tick in the full trace:

```ts
const traceByTick = new Map<number, RuntimeSimTraceSample>();
for (const entry of sim.trace) {
  traceByTick.set(entry.tick, entry);
}
for (const vector of vectors) {
  const sample = traceByTick.get(tick);   // only vector ticks
  for (const outputRow of outputRows) {
    rows.push({ tick, signal, expected, actual });
  }
}
```

**Consequence**: the `VerifyReport.rows` array and therefore `buildVerifyTickSignalIndex` will only have entries at vector tick positions. If a student has 4 vectors at ticks 0, 3, 7, 12, the waveform will only show 4 columns regardless of how many ticks the simulation actually ran.

### RuntimeVerifyRun flow into the waveform display

```
projectRuntime.runVerification()
  → builds VerifyReport (via buildVerifyReport)
  → fills RuntimeVerifyRun.waveform: VerifyWaveSample[]  (via buildVerifyWaveSamples)
  → stores as verifyLastRun

VerifySurface receives lastRun: RuntimeVerifyRun via props
  → lastRun.report feeds buildVerifyTickSignalIndex → tickIndex (tick→row lookup)
  → lastRun.waveform feeds signalTimeline memo → WaveformSignalRow[]
  → WaveformSignalRow[] + ticks array → <WaveformViewer> SVG component
```

`waveformTicks` is derived from `lastRun.waveform` (unique ticks present in the waveform samples). `timelineTicks` comes from `tickIndex.ticks` (ticks that appear in report rows). `displayTicks` in `signalTimeline` prefers `waveformTicks` when non-empty, falls back to `timelineTicks`. Both sets are currently limited to vector tick positions.

### Step-through mode and snapshot panel

Step-through mode is activated by `isStepMode: boolean` local state (toggled via the "Step Through" button). When active:

- `stepSnapshotRows` is a `useMemo` that reads `tickIndex.rowsByTick[String(selectedTick)]`
- The `ide-verify-step-bar` renders Prev / Next buttons that walk through `timelineTicks` by index
- The `ide-verify-snapshot-panel` renders `stepSnapshotRows` — one row per signal at the selected tick showing actual, expected, and pass/fail pill
- The "Show in Design" button calls `onDebugTickSelected(selectedTick, signals)` where `signals` is a `Record<string, 0 | 1>` built from the `actual` field of `stepSnapshotRows` (non-binary values like `'-'`, `'X'`, `'Z'` are skipped)

---

## Key Data Types

### TestVector (from `@redbyte/rb-utils`)

Defined in `packages/rb-utils/src/labProjectSchema.ts`:

```ts
export interface TestVector {
  tick: number;
  inputs: Record<string, boolean | number>;
  expected: Record<string, boolean | number>;
}
```

**CRITICAL: TestVector has NO `id` field.** This is the type stored in `projectVectors` and passed as `vectors?: TestVector[]` into VerifySurface. Any code that references `vector.id` on a `TestVector` is reading `undefined`.

### VerifyAuthorVector (local to VerifySurface.tsx)

```ts
interface VerifyAuthorVector {
  id: string;                          // synthetic: "vec-01", "vec-02", ... generated by normalizeVectors
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
}
```

This type exists only inside `VerifySurface.tsx`. It is emitted via `onVectorsChange(vectors: VerifyAuthorVector[])` but that callback is for the author editor pane flow, not for deleting vectors.

### RuntimeVerifyRun (from projectRuntime.ts)

```ts
export interface RuntimeVerifyRun {
  scenarioId: string;
  scenarioName: string;
  status: 'pass' | 'fail';
  deterministicHash: string;
  reportHash: string;
  firstFailingTick?: number;
  generatedAtIso: string;
  schedule: 'combinational' | 'clocked_macro';
  meta: VerifyRunMeta;
  report: VerifyReport;
  waveform: VerifyWaveSample[];        // ← SVG waveform data
}
```

### VerifyWaveSample (from verifyReport.ts)

```ts
export interface VerifyWaveSample {
  tick: number;
  signals: Record<string, string>;     // signal name → "0" | "1" | "-"
  mismatches: Array<{
    signal: string;
    expected: string;
    actual: string;
  }>;
}
```

### VerifyTickSignalIndex (from verifyReport.ts)

```ts
export interface VerifyTickSignalIndex {
  ticks: number[];                              // sorted tick numbers present in report rows
  rowsByTick: Record<string, VerifyTickSignalIndexEntry[]>;  // keyed by String(tick)
}

export interface VerifyTickSignalIndexEntry {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  status: 'pass' | 'fail';
}
```

Built by `buildVerifyTickSignalIndex(report: VerifyReport)` in `verifyReport.ts`. This is the primary data structure used by step-through mode and the mismatch table.

### VerifyReport (from verifyReport.ts)

```ts
export interface VerifyReport {
  schemaVersion: 'rb.verify-report.v1';
  scenarioId: string;
  scenarioName: string;
  status: 'pass' | 'fail';
  deterministicHash: string;
  firstFailingTick?: number;
  rows: VerifyReportRow[];
  vectors: VerifyReportVector[];          // VerifyReportVector DOES have id: string (synthetic)
  inputsAtTick: Record<number, Record<string, 0 | 1>>;
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'>;
  generatedAtIso: string;
  reportHash: string;
}
```

### VerifyReportVector (from verifyReport.ts)

```ts
export interface VerifyReportVector {
  id: string;        // present here — generated by buildVerifyReport, not from TestVector
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
}
```

Note: `VerifyReportVector` has `id`, but the upstream `TestVector` does not. `buildVerifyReport` generates the `id` as `vec-01` etc. (same pattern as `normalizeVectors` in the surface).

---

## Current Implemented Features

### Sprint 6: Step-Through Mode

- `isStepMode: boolean` — local `useState`, default `false`. Toggled by the "Step Through" / "Exit Step-Through" `IdeButton` (testId: `ide-verify-step-toggle`).
- When `isStepMode` is true and verification has run, the `ide-verify-step-bar` renders above the waveform with Prev / Next buttons (`ide-verify-step-prev`, `ide-verify-step-next`) and a position label (`ide-verify-step-position`) showing `tick N  (M / Total)`.
- `stepSnapshotRows` (`useMemo`) reads `tickIndex.rowsByTick[String(selectedTick)]` — yields `[]` if not in step mode or no tick selected.
- The `ide-verify-snapshot-panel` section renders below the waveform when `isStepMode && stepSnapshotRows.length > 0`. Each row has class `ide-verify-snapshot-row--pass` or `ide-verify-snapshot-row--fail`.
- Debug bridge: when `onDebugTickSelected` is provided and a tick is selected, the "Show in Design" button (`ide-verify-step-debug-design`) calls `handleDebugInDesign()` which passes `(selectedTick, signals)` where signals is built from actual binary values in `stepSnapshotRows`.

### Sprint 7: Delete Vector by Tick

- `onDeleteVector?: (vectorId: string)` — prop on `VerifySurfaceProps`. Despite the parameter name `vectorId`, the value passed by the surface is the tick as a string (e.g., `"3"`), not the synthetic `vec-03` id.
- In `IdeApp.tsx`, the handler interprets the value as a tick number: `const tick = Number(tickStr)` and filters `projectVectors` using `v.tick === tick`, removing the first matching vector. This is correct because `TestVector` has no `id` field.
- The surface calls `onDeleteVector(String(vector.tick))` from the vector table delete action.

---

## Known Bugs Being Fixed

### Bug 1: Bring-up vectors show without "auto-generated" label

`buildSequentialBringUpVectors` and `buildCombinationalBringUpVectors` in `bringupArtifacts.ts` push vectors with an extra runtime `id` field (e.g., `bringup-01`) that is not part of the `TestVector` interface:

```ts
vectors.push({
  id: `bringup-${String(tick + 1).padStart(2, '0')}`,  // extra field, not in TestVector type
  tick,
  inputs,
  expected,
});
```

When these vectors reach `normalizeVectors()` in VerifySurface, the function ignores any incoming id and generates `vec-01`, `vec-02`, etc., losing the `bringup-` origin marker. As a result, bring-up vectors are displayed identically to user-authored vectors with no "auto-generated" badge or label. The fix requires either: (a) threading a separate `autoVectorTicks: Set<number>` prop from IdeApp, or (b) reading the runtime `id` field off the incoming `TestVector` via a type cast and using it to detect `bringup-` prefix before discarding it in normalization.

### Bug 2: Waveform only shows vector tick positions, not full simulation trace

`buildVerifyRowsFromRuntimeTrace` only emits rows for ticks named by the project vectors. The live simulation trace (`sim.trace`) may contain hundreds of ticks, but only the vector ticks are sampled and included in `VerifyReport.rows`. Because `buildVerifyWaveSamples` builds from `report.rows`, and `RuntimeVerifyRun.waveform` is built from `buildVerifyWaveSamples`, the waveform SVG only renders columns for vector ticks. A circuit that has 20 simulation ticks but 3 vectors at t=0, t=5, t=10 will show only 3 waveform columns. The fix is to extend `buildVerifyRowsFromRuntimeTrace` (or add a parallel path) to emit read-only trace rows for all ticks in `sim.trace`, not just at vector positions.

---

## CSS Classes

All verify surface classes use the `ide-verify-` prefix. Classes in active use:

| Class | Element |
|---|---|
| `ide-waveform-outer` | Scrollable container wrapping the SVG `WaveformViewer`; dark PCB background, teal border |
| `ide-verify-waveform-bar` | Toolbar row above the waveform (zoom controls, fail nav, step bar) |
| `ide-verify-step-bar` | Step-through navigation bar inside the waveform bar; flex row with Prev/Next and position label |
| `ide-verify-step-position` | Tick position label within step bar (`tick N  (M / Total)`) |
| `ide-verify-snapshot-panel` | Signal snapshot section below waveform when step mode is active |
| `ide-verify-snapshot-grid` | Flex container for snapshot rows |
| `ide-verify-snapshot-row` | Single signal row in snapshot; modifiers: `--pass`, `--fail` |
| `ide-verify-snapshot-signal` | `<code>` element for signal name |
| `ide-verify-snapshot-actual` | Actual value span |
| `ide-verify-snapshot-expected` | Expected value span (`/ exp N`) |
| `ide-verify-waveform-empty` | Centered empty state message when no waveform data |
| `ide-verify-waveform-panel` | Waveform bordered panel container |
| `ide-verify-waveform-hero` | Large waveform display block with min-height |
| `ide-verify-waveform-legend` | Legend row above waveform SVG |
| `ide-verify-waveform-legend-meta` | Right-aligned meta text in waveform legend |
| `ide-verify-status-strip` | Status-first layout strip at top of verify workbench |
| `ide-verify-tab-bar` | Tab bar below waveform (Mismatches / Vectors / Details) |
| `ide-verify-tab-panel` | Scrollable panel below tabs |
| `ide-verify-oscilloscope-stage` | Oscilloscope-framed layout stage wrapping waveform + controls |
| `ide-verify-pass-hero` | Large PASS banner panel |
| `ide-verify-fail-summary` | FAIL summary card above waveform |
| `ide-verify-workbench-v2` | Main workbench container (Phase 19+) |

CSS is in `packages/rb-apps/src/apps/ide/ide-root.css`. All new classes for this surface must use the `ide-verify-` prefix. State modifier classes use the `is-` prefix (e.g., `is-selected`, `is-pass`, `is-fail`).

---

## Do / Don't Rules

### TestVector identity — always use tick, not id

- **Do not** reference `vector.id` on a `TestVector` object anywhere in `IdeApp.tsx` or in project-state-level code. `TestVector` (from `@redbyte/rb-utils`) has no `id` field — accessing it yields `undefined`.
- **Do** filter and identify `TestVector` entries by `vector.tick`. When `onDeleteVector` is called from the surface with a string argument, treat it as `String(tick)` and parse with `Number()`.
- **Do** use `VerifyAuthorVector.id` (the synthetic `vec-01` strings) only inside `VerifySurface.tsx` for local draft state keying — never persist these ids to project state.

### Step-through state belongs in local component state

- **Do** keep `isStepMode`, `selectedTick`, `stepIndex`, and `stepSnapshotRows` as local `useState` / `useMemo` in `VerifySurface`.
- **Do not** lift step-through state into `VerifySurfaceProps` or into `projectRuntime`. Step mode is a transient UX state, not a persistent project concern.
- **Do not** add an `isStepMode?: boolean` prop to `VerifySurfaceProps` — the toggle button inside the surface already manages this entirely.

### Waveform data flow

- **Do** derive all waveform display state (`signalTimeline`, `waveformTicks`, `timelineTicks`) from `lastRun.report` and `lastRun.waveform` via `useMemo`. No waveform state in `useState`.
- **Do not** mutate `lastRun.report.rows` inside the surface. If rows need filtering for display, filter in a memo — do not alter the source object.
- **Do** pass `VerifyWaveSample[]` as `lastRun.waveform` from `projectRuntime`. Do not reconstruct waveform samples from `report.rows` inside the surface — `buildVerifyWaveSamples` already does this and the result is stored on `RuntimeVerifyRun`.

### Debug bridge separation

- **Do** use `onDebugTickSelected?: (tick: number, signals: Record<string, 0 | 1>) => void` as the only bridge from VerifySurface to the Design surface. The surface collects the signal values from `stepSnapshotRows` and passes them up — it does not reach into design state directly.
- **Do not** add direct imports of design surface state or sim engine functions inside `VerifySurface.tsx`. All sim access goes through `lastRun: RuntimeVerifyRun` (passed as a prop) or through callbacks.

### Bring-up vector labeling

- When reading an incoming `TestVector` array to detect bring-up vectors, cast to `unknown` before accessing any extra fields: `(vector as unknown as { id?: string }).id`. Do not widen the `TestVector` interface itself.
- If adding an "auto-generated" badge, thread the detection via a separate `autoGeneratedTicks?: Set<number>` prop from `IdeApp` rather than relying on the runtime `id` field that TypeScript does not know about.

### CSS conventions

- All new classes for this surface must use the `ide-verify-` prefix.
- State modifier classes use the `is-` prefix (e.g., `is-selected`, `is-pass`, `is-fail`).
- Do not add inline styles to `VerifySurface` — use CSS classes in `ide-root.css`.
- `data-testid` attributes follow the pattern `ide-verify-{descriptor}`. New interactive elements must include a `testId` prop or `data-testid` attribute.
