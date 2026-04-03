# Interactive Timing Lab — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Verify from a testbench manager into an Interactive Timing Lab built around four verbs: Drive, Watch, Explain, Compare.

**Architecture:** Five phases, ordered by product impact. Each phase is independently shippable. The waveform becomes the visual centerpiece; a new "Why" inspector explains signal transitions using the existing CircuitEngine graph and per-tick trace data; Compare becomes an overlay system instead of a dominant authoring mode.

**Tech Stack:** React 18/19 + TypeScript strict, Vitest, SVG waveform rendering, `@redbyte/rb-logic-core` CircuitEngine (topological eval + signal cache), pnpm monorepo.

**Test command:** `pnpm -w exec vitest run <pattern>`

---

## Current state (post 2026-04-03 region refactor)

What already exists:

- Four region wrappers: `VerifyHeaderRegion`, `VerifyStimulusRegion`, `VerifyWaveformRegion`, `VerifyInspectorRegion` (in `verify/VerifyRegionLayout.tsx`)
- `VerifyPrimaryStatusArea` — unified single-status callout
- Observe/Compare mode toggle with `nextRunUsesAssertions` state
- Mode-aware drawer tabs (mismatches hidden in Observe)
- Expected-output lockout in Observe mode (StimulusCanvas + ScenarioBuilderPanel)
- Clock preset handlers (hold low, hold high, pulse) — buttons exist but presets are basic
- WaveformViewer inline in VerifySurface (~900 lines of SVG rendering)
- `RuntimeSimTraceSample` traces `Record<signalKey, 0|1>` at every tick
- `CircuitEngine` evaluates gates in topological order with `buildNodeInputs()` that traces connections
- `classifyVerifyFailure()` classifies mismatch types (output-mismatch, undefined, floating, timing)
- `VerifyReport` with `signalRoles`, `inputsAtTick`, per-tick rows
- Sequential analysis with `analyzeSequentialLogic()` and `nodeMetaRegistry`
- Named scenarios via `activeScenarioId` / `scenarios[]` (basic save/switch)

What does NOT exist yet:

- "Why did this change?" signal explanation engine
- State decoding for counters/registers/FSMs
- Compare-as-overlay on waveform
- Jump-to-next-mismatch navigation
- Guided sequential onboarding (empty state wizard)
- Signal-click → inspector linkage
- Waveform visual dominance (it's present but not promoted)

---

## Design rules (hard constraints for all phases)

1. **Observe is default.** No compare anxiety on first load.
2. **Outputs are never editable in Observe.** Students drive inputs, circuit produces outputs.
3. **Only one primary status at a time.** No banner pile.
4. **Waveform gets the most space.** Not controls, not tables.
5. **Red is only for real mismatch.** Not stale, not no-run-yet, not expected-missing.
6. **Sequential circuits get guided stimulus.** Clock pain must be reduced.
7. **Every feature supports the beginner path.** First-year understands the page in seconds.

---

## Phase 1: Make waveform undeniably primary

**Goal:** Waveform dominates the page. It looks like the product, not a hidden utility inside a form.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- Extract: `packages/rb-apps/src/apps/ide/surfaces/verify/WaveformInstrument.tsx` (new)
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`
- Test: `packages/rb-apps/src/apps/ide/__tests__/verifySurface.waveform-dominance.test.tsx` (new)

### Task 1.1: Extract WaveformViewer into dedicated module

The inline WaveformViewer (~900 lines) must be extracted from VerifySurface into `verify/WaveformInstrument.tsx`. This is a pure extraction — no behavior changes.

**Step 1:** Read the full WaveformViewer function and its supporting types/constants from VerifySurface.tsx.

**Step 2:** Create `packages/rb-apps/src/apps/ide/surfaces/verify/WaveformInstrument.tsx`:
- Move `WaveformViewer` function component
- Move all supporting types (`WaveformSignalRow`, `SignalLaneGroup`, etc.)
- Move all rendering constants (`LABEL_W`, `TICK_W`, `ROW_H`, etc.)
- Export the component and types
- Preserve the exact same props interface

**Step 3:** Update VerifySurface.tsx to import from the new module.

**Step 4:** Run existing waveform tests to confirm no regressions:
```
pnpm -w exec vitest run verifySurface.waveform-priority
```

### Task 1.2: Compact header strip

Flatten the header into one narrow band. Currently the header region contains scenario library + timing badge + primary status. Compress into:

Left group:
- "Verify" label
- Scenario name (editable inline)
- Observe / Compare segmented control

Right group:
- "Run circuit" button (primary action)
- "Save as expected" button (secondary, only in Observe when run exists)
- Concise status chip (replaces the callout banner)

**Implementation:**
- Replace `VerifyPrimaryStatusArea` callout with an inline `StatusChip` component (small pill, not a banner)
- Move "Run circuit" to the header right side
- Collapse scenario library dropdown into the header left

**CSS changes:**
- Header region max-height: 48px
- Remove vertical padding/margins from header content
- Status chip: inline-flex, pill shape, small font

### Task 1.3: Stimulus panel height constraint

The stimulus panel (ScenarioBuilderPanel) should be collapsible and default to a compact height. The waveform should get `flex: 1` and fill remaining space.

**Implementation:**
- Add `collapsed` / `expanded` state to stimulus region
- Default to expanded but with max-height constraint (e.g., 240px)
- Add collapse/expand toggle button in stimulus header
- Waveform region gets `flex: 1; min-height: 300px; overflow: auto`

**CSS changes:**
- `.ide-verify-region--stimulus { max-height: 240px; overflow-y: auto; transition: max-height 0.2s }`
- `.ide-verify-region--stimulus.is-collapsed { max-height: 40px }`
- `.ide-verify-region--waveform { flex: 1; min-height: 300px }`

### Task 1.4: Waveform visual quality improvements

Make the waveform look like the centerpiece:

- Increase default row height from 36px → 44px
- Increase label column width from ~140px → 160px  
- Add stronger tick grid lines (opacity bump)
- Add hover cursor line (vertical, follows mouse X)
- Add selected-tick highlight column (subtle background fill)
- Increase waveform transition rendering quality (sharper edges, anti-alias off for digital signals)

**Implementation:**
- Update SVG constants in WaveformInstrument.tsx
- Add `onMouseMove` handler for hover cursor tracking
- Add `selectedTick` visual highlight (rect behind the tick column)
- Update row stripe colors for better contrast

### Task 1.5: Inspector height constraint

The inspector drawer should never be taller than the waveform. Apply max-height proportional constraint.

**Implementation:**
- Inspector region: `max-height: 40vh` or `max-height: min(40vh, 360px)`
- Overflow-y: auto for scrolling
- Waveform takes remaining space above

### Task 1.6: Write dominance tests

**Test file:** `verifySurface.waveform-dominance.test.tsx`

Tests:
1. WaveformInstrument renders as standalone component with minimal props
2. Header region has max-height constraint class
3. Stimulus region is collapsible
4. Waveform region has flex-1 growth
5. Inspector region has max-height constraint

---

## Phase 2: "Why did this change?" inspector

**Goal:** When a student clicks an output transition, explain what changed, why, which inputs/gates drove it, and for sequential circuits, which prior state mattered.

**Files:**
- Create: `packages/rb-apps/src/apps/ide/surfaces/verify/signalExplainer.ts` (pure logic)
- Create: `packages/rb-apps/src/apps/ide/surfaces/verify/WhyInspectorPanel.tsx` (React component)
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (wire click → inspector)
- Modify: `packages/rb-apps/src/apps/ide/surfaces/verify/WaveformInstrument.tsx` (click handler on transitions)
- Test: `packages/rb-apps/src/__tests__/signalExplainer.test.ts` (pure logic tests)
- Test: `packages/rb-apps/src/apps/ide/__tests__/whyInspector.test.tsx` (component tests)

### Task 2.1: Build the signal explanation engine

Create `signalExplainer.ts` — a pure function that takes:

```typescript
interface ExplainSignalInput {
  signalKey: string;           // e.g., "q1"
  tick: number;                // the tick to explain
  trace: RuntimeSimTraceSample[];  // full trace history
  circuit: Circuit;            // circuit graph (nodes + connections)
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'>;
  nodeMetaLookup: (type: string) => NodeMeta;
}

interface SignalExplanation {
  signalKey: string;
  tick: number;
  previousValue: 0 | 1 | null;
  currentValue: 0 | 1;
  transitionDirection: 'rose' | 'fell' | 'unchanged';
  
  // What drove this value
  driverChain: SignalDriverStep[];
  
  // For sequential: what prior state mattered
  sequentialContext?: {
    clockEdge: 'rising' | 'falling' | null;
    clockTick: number;
    priorState: Record<string, 0 | 1>;
    loadedFrom: string; // e.g., "D input was high"
  };
  
  // Human-readable summary
  summary: string;   // e.g., "q1 went high at tick 6 because D was high on the prior rising clock edge"
  details: string[];  // bullet points of contributing factors
}

interface SignalDriverStep {
  nodeId: string;
  nodeType: string;        // e.g., "AND", "DFlipFlop"
  nodeLabel?: string;
  outputPort: string;
  inputValues: Record<string, 0 | 1>;
  outputValue: 0 | 1;
  explanation: string;     // e.g., "AND(a=1, b=1) → 1"
}
```

**Algorithm:**
1. Find the node that produces `signalKey` by walking circuit connections backward
2. For that node, read its inputs from the trace at the given tick
3. Recursively walk backward through the driver chain until reaching primary inputs
4. For sequential nodes (DFF, etc.), check the prior tick's state and clock edge
5. Build human-readable summary from the chain

**Key implementation detail:** Use `circuit.connections` to find `from.nodeId` → `to.nodeId` mappings. Walk backward from the output signal to find its driver node, then recursively find what drove that node's inputs.

### Task 2.2: Signal explanation tests (TDD)

Write tests first for `signalExplainer.ts`:

1. Combinational: AND gate output explained from two inputs
2. Combinational: Chain of gates (NOT → AND → output)
3. Sequential: DFF output explained from D input at prior clock edge
4. Sequential: DFF with reset active
5. Unchanged signal returns 'unchanged' transition
6. Primary input returns empty driver chain
7. Multi-level chain stops at primary inputs
8. Missing trace data returns graceful fallback

### Task 2.3: Build WhyInspectorPanel component

Create `WhyInspectorPanel.tsx`:

```typescript
interface WhyInspectorPanelProps {
  explanation: SignalExplanation | null;
  onDismiss?: () => void;
}
```

Renders:
- Signal name + tick number header
- Transition badge (↑ rose / ↓ fell / — unchanged)
- Summary sentence in plain English
- Driver chain as indented steps:
  ```
  q1 = DFlipFlop.Q → 1
    ← D was high (1) on rising clock edge at tick 5
    ← D = XOR.out → 1
      ← XOR(a=1, b=0) → 1
        ← a = input (switch) → 1
        ← b = input (switch) → 0
  ```
- For sequential: "Previous state" section showing prior tick values

### Task 2.4: Wire click → explanation in WaveformInstrument

Add click handler to waveform signal transitions:
- When student clicks a signal cell/transition, emit `onSignalExplainRequest(signalKey, tick)`
- VerifySurface computes the explanation via `explainSignalTransition()`
- Result is passed to WhyInspectorPanel

### Task 2.5: Add "Why" tab to inspector

Update drawer tabs:
- Add `'why'` to `VerifyDrawerTab` type
- Insert `'why'` as first tab in all tab computations
- Why tab renders `WhyInspectorPanel`
- Tab auto-activates when a signal transition is clicked

Updated tab order:
- Observe: `['why', 'vectors', 'truth', 'kmap', 'details']`
- Compare: `['why', 'mismatches', 'vectors', 'truth', 'kmap', 'details']`

---

## Phase 3: Named scenarios / experiments

**Goal:** Students save and switch between named experiment scenarios like a lab notebook.

**Files:**
- Create: `packages/rb-apps/src/apps/ide/surfaces/verify/ScenarioLibrary.tsx` (new component)
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (integrate library)
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx` (scenario name editing)
- Test: `packages/rb-apps/src/apps/ide/__tests__/scenarioLibrary.test.tsx`

### Task 3.1: Scenario library component

Create `ScenarioLibrary.tsx` — a compact dropdown/list that shows:
- Named scenarios with icons (e.g., "Reset behavior", "Count with enable")
- "New scenario" button
- "Duplicate" and "Delete" actions per scenario
- Active scenario indicator

Props:
```typescript
interface ScenarioLibraryProps {
  scenarios: Array<{ id: string; name: string; vectorCount: number }>;
  activeScenarioId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}
```

### Task 3.2: Default scenario names for common experiments

When creating a new scenario for sequential circuits, suggest useful names:
- "Reset behavior"
- "Basic count"
- "Enable test"
- "Hold test"

For combinational:
- "All inputs"
- "Edge cases"
- "Custom test"

### Task 3.3: Integrate into header

Replace current scenario selector with ScenarioLibrary dropdown in the compact header strip.

---

## Phase 4: Compare as overlay + jump-to-diff

**Goal:** Compare mode shows expected trace as ghost overlay on the waveform, with diff markers and jump-to-next-mismatch navigation.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/verify/WaveformInstrument.tsx`
- Create: `packages/rb-apps/src/apps/ide/surfaces/verify/CompareOverlay.tsx` (SVG overlay rendering)
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- Test: `packages/rb-apps/src/apps/ide/__tests__/compareOverlay.test.tsx`

### Task 4.1: Ghost expected trace rendering

When Compare is active and a run exists:
- Render expected values as semi-transparent dashed lines behind/above the observed waveform
- Use distinct color (e.g., blue-gray ghost) vs observed (solid green/white)
- Ghost lanes only appear for signals that have expected values

### Task 4.2: Mismatch markers on waveform

At each tick where expected ≠ observed:
- Render a diamond/triangle marker on the waveform at that tick-signal intersection
- Color: red accent
- Clickable: navigates to that mismatch in the inspector

### Task 4.3: Jump-to-next-mismatch

Add navigation controls:
- "← Prev mismatch" / "Next mismatch →" buttons in Compare tab or header
- Keyboard shortcuts: `[` and `]` for prev/next
- Auto-scrolls waveform to center the mismatch tick
- Sets selected tick to mismatch tick

### Task 4.4: Compare tab replaces Mismatches tab

Rename "Mismatches" → "Compare" in the inspector tabs.
The Compare tab shows:
- Summary: "3 mismatches across 2 signals"
- Mismatch list with tick + signal + expected vs observed
- Jump-to buttons for each mismatch

---

## Phase 5: State decoding for counters/registers/FSMs

**Goal:** For multi-bit sequential circuits, show decoded state above the waveform rows.

**Files:**
- Create: `packages/rb-apps/src/apps/ide/surfaces/verify/stateDecoder.ts` (pure logic)
- Modify: `packages/rb-apps/src/apps/ide/surfaces/verify/WaveformInstrument.tsx`
- Test: `packages/rb-apps/src/__tests__/stateDecoder.test.ts`

### Task 5.1: State decoder engine

Create `stateDecoder.ts`:

```typescript
interface StateDecoderInput {
  signalKeys: string[];           // e.g., ["q0", "q1"]
  trace: RuntimeSimTraceSample[];
  decodeAs: 'binary' | 'decimal' | 'hex' | 'named';
  namedStates?: Record<string, string>; // optional: "00" → "IDLE"
}

interface DecodedState {
  tick: number;
  bits: string;      // e.g., "10"
  decimal: number;   // e.g., 2
  hex: string;       // e.g., "2"
  name?: string;     // e.g., "COUNT_2" if named
}

function decodeStateSequence(input: StateDecoderInput): DecodedState[];
```

### Task 5.2: State annotation row in waveform

Above grouped signal rows (e.g., q0 + q1), render a state annotation row:
- Shows decoded value at each tick
- Compact labels: "0", "1", "2", "3" or "IDLE", "RUN", etc.
- Visually distinct from signal rows (lighter background, smaller font)

### Task 5.3: Auto-detect decodable groups

Heuristic: signals with common prefix and numeric suffix (q0, q1, q2) form a decodable group. Counter4Bit outputs are always decodable.

---

## Phase 6 (future): Guided sequential onboarding

Not planned in detail yet. Empty state for sequential circuits should:
- Detect clocked storage in the circuit
- Offer preset experiment templates
- Walk through "alternating clock → add reset → add enable" flow
- Eventually support natural-language stimulus: "8 ticks, reset on tick 0, enable high from tick 2"

---

## Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| WaveformViewer extraction breaks inline closures | High | Extract types + constants first, verify tests pass before touching component |
| Signal explanation recursion on complex circuits | Medium | Depth limit (8 levels), cache visited nodes, fallback to "complex path" message |
| Compare overlay SVG performance with many ticks | Medium | Virtualize visible tick window, skip offscreen rendering |
| React 19 testing compatibility | Low | Known issue (BUG-003), use pure-logic tests where possible |
| VerifySurface.tsx is ~6000 lines | High | Each phase extracts more into modules; Phase 1 alone removes ~900 lines |

---

## Verification contract

After each phase:
1. Run `pnpm -w exec vitest run` on all verify-related test files
2. Confirm zero TypeScript errors in changed files
3. Manual smoke: load a combinational circuit in Verify, run, check waveform renders
4. Manual smoke: load a sequential circuit (DFF), run with clock, check trace
5. Update AI_STATE.md with change log entry
