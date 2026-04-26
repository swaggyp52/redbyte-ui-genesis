> ⚠️ **SUPERSEDED — OS ERA (2026-01-05).** References OS-era code architecture (3D shell, Turborepo multi-app, non-FPGA stack). Not valid for the current FPGA IDE in `packages/rb-apps`. See `docs/ARCHITECTURE.md` for current layer map.

# 06 — Owner's Manual

**Status:** SUPERSEDED — see note above
**Last Updated:** 2026-01-05
**Maintainer:** Connor Angiel

---

## Purpose of This Document

This is the **proof document**. It demonstrates that I understand every piece of RedByte deeply enough to:

1. Rebuild the entire system from scratch
2. Explain every architectural decision
3. Debug any subsystem without guessing
4. Onboard a new engineer with confidence
5. Answer investor questions with specificity

If you asked me any of these questions in a technical interview, this is how I'd answer.

---

## Q: "Explain the entire system in 2 minutes."

### The 2-Minute System Overview

RedByte is a **deterministic logic simulator** that runs entirely in the browser.

**Data Flow:**

```
User Input → Circuit Store → Simulation Engine → Views
             (Zustand)       (Tick-based)      (React)
```

1. **Circuit Store** (`packages/rb-apps/src/stores/circuitStore.ts`)
   - Single source of truth for circuit state
   - Manages nodes (gates, switches, lamps) and connections (wires)
   - Handles undo/redo (50-step history using past/future arrays)
   - Commits every change with `commit(circuit)` → adds to history

2. **Simulation Engine** (`packages/rb-logic-core/`)
   - **CircuitEngine**: Evaluates combinational logic (AND, OR, NOT gates)
   - **TickEngine**: Wraps CircuitEngine, adds tick-based time and update loop
   - Deterministic: Same inputs → same outputs, every time
   - Runs at configurable Hz (1Hz to 60Hz), decoupled from rendering

3. **Views** (React components)
   - **LogicCanvas** (2D schematic): SVG-based, controlled by circuit prop
   - **3D View** (Redstone): Three.js via React Three Fiber
   - **Oscilloscope**: Timing diagram, samples signals every tick
   - All views read from same circuit, no independent state

4. **Multi-View Sync**
   - Circuit store is single source of truth
   - Views subscribe to circuit changes (via Zustand or circuit prop)
   - Toggle switch in schematic → all views update synchronously

**Core Loop:**

```
User clicks switch
→ LogicCanvas calls onCircuitChange
→ circuitStore.commit(newCircuit)
→ engine.setCircuit(newCircuit)
→ tickEngine.stepOnce() (if running)
→ Views re-render with new circuit
→ User sees lamp light up
```

**Key Properties:**
- Local-first (no server)
- Deterministic (reproducible)
- Keyboard-first (Cmd+K for Quick Add, Space to run/pause)
- Progressive disclosure (Learn Mode for beginners, Build Mode for experts)

---

## Q: "Walk me through how a circuit edit works end-to-end."

### Circuit Edit Flow: Adding a Wire

**User action:** Click on output port of Switch, drag to input port of Lamp

**Step-by-step:**

1. **User initiates wire** (`LogicCanvas.tsx`, mouse down on port)
   ```typescript
   const handlePortMouseDown = (nodeId: string, portName: string) => {
     startWire(nodeId, portName); // Updates editingState in useLogicViewStore
   };
   ```

2. **User drags** (mouse move updates temporary wire visual, no circuit change yet)

3. **User releases** on target port (`LogicCanvas.tsx`, mouse up on port)
   ```typescript
   const handlePortMouseUp = (targetNodeId: string, targetPortName: string) => {
     const newCircuit = {
       ...circuit,
       connections: [
         ...circuit.connections,
         { from: { nodeId: sourceId, portName: sourcePort },
           to: { nodeId: targetNodeId, portName: targetPortName } }
       ]
     };
     onCircuitChange(newCircuit); // Callback to parent
     endWire(); // Clear editing state
   };
   ```

4. **Parent component** (`LogicPlaygroundApp.tsx`) receives callback
   ```typescript
   const handleCircuitChange = (newCircuit: Circuit) => {
     store.commit(newCircuit); // Adds to undo/redo history
   };
   ```

5. **Circuit store** (`circuitStore.ts`) commits change
   ```typescript
   commit: (circuit) => {
     const { past, circuit: currentCircuit } = get();
     const newPast = [...past, cloneCircuit(currentCircuit)]; // Save old state
     set({ past: newPast, future: [], circuit, isDirty: true }); // Update store

     // Sync engines
     get().engine?.setCircuit(circuit);
     get().tickEngine?.setCircuit(circuit);
   };
   ```

6. **Engine updates** (`CircuitEngine.ts`)
   ```typescript
   setCircuit(circuit: Circuit) {
     this.circuit = circuit;
     this.invalidateCaches(); // Recalculate node graph
   }
   ```

7. **Views re-render**
   - LogicCanvas receives new `circuit` prop → re-renders SVG
   - 3D view subscribes to store → re-renders voxel world
   - Oscilloscope sees new connection → updates probe list

8. **User sees wire** appear in all views simultaneously

**Key insight:** Circuit store is the bottleneck. Every mutation goes through `commit()`, ensuring:
- Undo/redo works (history is maintained)
- All views stay in sync (single source of truth)
- No race conditions (synchronous updates)

---

## Q: "How does simulation work? How do you ensure determinism?"

### Simulation Architecture

**Two engines:**

1. **CircuitEngine** (`packages/rb-logic-core/src/CircuitEngine.ts`)
   - Evaluates logic gates (AND, OR, NOT, etc.)
   - Stateless: Given circuit + node states → new node states
   - Pure function: No side effects, no randomness

2. **TickEngine** (`packages/rb-logic-core/src/TickEngine.ts`)
   - Wraps CircuitEngine, adds **discrete time**
   - Maintains tick count (starts at 0)
   - Runs at configurable Hz (default 10Hz)
   - Calls `engine.evaluateTick()` on every tick

**Tick Loop:**

```typescript
// Simplified from TickEngine.ts
stepOnce() {
  this.tickCount++; // Discrete time advances

  const nodeStates = this.engine.evaluateTick(); // Pure evaluation

  // Update circuit with new states (synchronous)
  this.circuit = {
    ...this.circuit,
    nodes: this.circuit.nodes.map(node => ({
      ...node,
      state: nodeStates[node.id] || node.state
    }))
  };

  // Notify subscribers (views update)
  this.onTick?.(this.circuit, this.tickCount);
}
```

**Determinism guarantees:**

1. **Discrete time**: Time advances in integer ticks, not continuous nanoseconds
2. **Deterministic ordering**: Nodes evaluated in topological sort order (inputs before outputs)
3. **No randomness**: No `Math.random()`, no `Date.now()` in logic evaluation
4. **Pure functions**: `evaluateTick` has no side effects, always returns same output for same input
5. **Immutable state**: Circuit objects are cloned, never mutated in place

**Verification:**

```typescript
// Test from tests (conceptual)
test('determinism: run circuit twice, assert identical', () => {
  const circuit = buildTestCircuit();
  const engine1 = new TickEngine(new CircuitEngine(circuit), 10);
  const engine2 = new TickEngine(new CircuitEngine(circuit), 10);

  const states1 = [];
  const states2 = [];

  for (let i = 0; i < 100; i++) {
    engine1.stepOnce();
    engine2.stepOnce();
    states1.push(engine1.getCircuit());
    states2.push(engine2.getCircuit());
  }

  expect(states1).toEqual(states2); // MUST pass
});
```

**If determinism breaks:**

Look for:
- `Math.random()` in engine code
- `Date.now()` affecting logic
- Nondeterministic sort order (e.g., iterating over Set without ordering)
- Async operations affecting circuit state

---

## Q: "How does undo/redo work?"

### Undo/Redo System

**Data structure:**

```typescript
// circuitStore.ts
interface CircuitState {
  circuit: Circuit; // Current state
  past: Circuit[];  // Undo stack (max 50 entries)
  future: Circuit[]; // Redo stack (cleared on new edit)
  maxHistory: number; // 50
}
```

**Commit (new edit):**

```typescript
commit: (newCircuit) => {
  const { past, circuit, maxHistory } = get();

  // Push current circuit onto past stack
  const newPast = [...past, cloneCircuit(circuit)].slice(-maxHistory);

  // Clear future (new edit invalidates redo)
  set({ past: newPast, future: [], circuit: newCircuit, isDirty: true });

  // Update engines
  get().engine?.setCircuit(newCircuit);
  get().tickEngine?.setCircuit(newCircuit);
}
```

**Undo (Cmd+Z):**

```typescript
undo: () => {
  const { past, circuit, future } = get();
  if (past.length === 0) return; // Nothing to undo

  const previous = past[past.length - 1]; // Pop from past
  const newPast = past.slice(0, -1);
  const newFuture = [cloneCircuit(circuit), ...future]; // Push current to future

  set({ past: newPast, future: newFuture });
  get().updateCircuit(previous, true); // skipHistory=true to avoid double-add
}
```

**Redo (Cmd+Shift+Z):**

```typescript
redo: () => {
  const { future, circuit, past, maxHistory } = get();
  if (future.length === 0) return; // Nothing to redo

  const next = future[0]; // Pop from future
  const newFuture = future.slice(1);
  const newPast = [...past, cloneCircuit(circuit)].slice(-maxHistory); // Push current to past

  set({ past: newPast, future: newFuture });
  get().updateCircuit(next, true); // skipHistory=true
}
```

**Key insights:**

1. **Deep cloning**: `cloneCircuit()` creates full copy (no shared references)
2. **Max history**: Past array limited to 50 entries (memory bound)
3. **Clear future on edit**: New edit invalidates redo stack
4. **Skip history flag**: `updateCircuit(circuit, skipHistory=true)` avoids infinite loop during undo/redo

**File location:** `packages/rb-apps/src/stores/circuitStore.ts:96-127`

---

## Q: "How do you handle wiring validation?"

### Wiring Rules

**Valid connections:**

1. **Output → Input**: Standard forward connection
2. **PowerSource.out → anything.in**: Power source drives inputs

**Invalid connections:**

1. **Input → Output**: Backward connection (rejected)
2. **Output → Output**: Cannot connect two outputs together
3. **Input → Input**: Would create feedback without driver
4. **Self-loop**: Node output → same node input (creates combinational loop, flagged as error)

**Validation logic:**

```typescript
// packages/rb-logic-view/src/tools/wireValidation.ts
export function isValidConnection(
  fromNode: Node, fromPort: string,
  toNode: Node, toPort: string
): boolean {
  // Rule 1: Output → Input only
  const fromIsOutput = isOutputPort(fromNode.type, fromPort);
  const toIsInput = isInputPort(toNode.type, toPort);
  if (!fromIsOutput || !toIsInput) return false;

  // Rule 2: No self-loops
  if (fromNode.id === toNode.id) return false;

  // Rule 3: No duplicate connections (checked elsewhere)
  // ...

  return true;
}
```

**Where validation happens:**

1. **UI level** (`LogicCanvas.tsx`): Preview invalid connections with red color
2. **Store level** (`circuitStore.ts`): Reject invalid connections on commit
3. **Engine level** (`CircuitEngine.ts`): Ignore invalid connections during evaluation

**Circuit health checks:**

```typescript
// packages/rb-apps/src/logic/circuitHealth.ts
export function checkCircuitHealth(circuit: Circuit): ValidationResult {
  const errors: string[] = [];

  // Check for unconnected inputs
  circuit.connections.forEach(conn => {
    if (!findNode(circuit, conn.to.nodeId)) {
      errors.push(`Wire to missing node ${conn.to.nodeId}`);
    }
  });

  // Check for combinational loops
  const loops = detectCombinationalLoops(circuit);
  if (loops.length > 0) {
    errors.push(`Combinational loop detected: ${loops.join(' → ')}`);
  }

  return { valid: errors.length === 0, errors };
}
```

**File locations:**
- Validation: `packages/rb-logic-view/src/tools/wireValidation.ts`
- Health checks: `packages/rb-apps/src/logic/circuitHealth.ts`

---

## Q: "How does multi-view sync work?"

### Multi-View Architecture

**The Golden Rule:** *One circuit, many views.*

**Circuit → Views mapping:**

```
Circuit (Zustand Store)
  ├── LogicCanvas (2D schematic)
  │   └── Props: circuit, onCircuitChange
  ├── 3D View (Redstone world)
  │   └── Props: circuit, engine
  ├── Oscilloscope (timing diagram)
  │   └── Props: circuit, probes
  └── Future: HDL Export (Verilog code)
      └── Props: circuit
```

**How LogicCanvas stays in sync:**

```typescript
// LogicPlaygroundApp.tsx (parent)
<LogicCanvas
  engine={tickEngine}
  circuit={circuit}  // ✅ Controlled prop
  onCircuitChange={handleCircuitChange}  // ✅ Callback for mutations
/>
```

LogicCanvas is a **controlled component**:
- Receives `circuit` prop from parent
- Never mutates circuit directly
- Calls `onCircuitChange(newCircuit)` callback
- Parent commits change to store
- LogicCanvas re-renders with new circuit prop

**How 3D View stays in sync:**

```typescript
// 3D view subscribes to store directly
const circuit = useCircuitStore(state => state.circuit);

// On every circuit change, rebuild voxel world
useEffect(() => {
  const voxels = circuitToVoxels(circuit);
  updateVoxelWorld(voxels);
}, [circuit]);
```

**How Oscilloscope stays in sync:**

```typescript
// Oscilloscope samples signals on every tick
tickEngine.onTick((circuit, tickCount) => {
  probes.forEach(probe => {
    const node = findNode(circuit, probe.nodeId);
    const value = node.state[probe.portName];
    recordSample(probe, tickCount, value); // Add to waveform
  });
});
```

**Critical invariant:**

> **DEV-mode assertion:** If LogicCanvas receives `circuit` prop, it MUST also receive `onCircuitChange`. Otherwise, throw error.

```typescript
// LogicCanvas.tsx:71-80
if (import.meta.env.DEV) {
  if (externalCircuit && !onCircuitChange) {
    throw new Error(
      'LogicCanvas: When circuit prop is provided (controlled mode), ' +
      'onCircuitChange callback is REQUIRED.'
    );
  }
}
```

**If views desync:**

Check for:
- LogicCanvas mutating circuit directly (should call callback instead)
- Views maintaining independent circuit state (should read from store)
- Async updates (circuit changes should be synchronous)

---

## Q: "What happens if this breaks? Where do I look first?"

### Debugging Playbook

#### **Symptom: Circuit doesn't run when I click "Run"**

**Check:**

1. Is `isRunning` state true?
   - Location: `LogicPlaygroundApp.tsx`, `useState<boolean>`
   - Set by: `handleRun()` function
   - If false → button click handler not firing

2. Is `tickEngine` initialized?
   - Location: `LogicPlaygroundApp.tsx:147`
   - Created: `new TickEngine(engine, currentHz)`
   - If null → engine initialization failed

3. Is `requestAnimationFrame` loop running?
   - Location: `LogicPlaygroundApp.tsx:184-204` (`useEffect` with `isRunning` dep)
   - If not looping → check browser console for errors

4. Is circuit valid?
   - Run: `checkCircuitHealth(circuit)`
   - If errors → fix circuit (remove loops, connect wires)

#### **Symptom: Undo/Redo doesn't work**

**Check:**

1. Is `past` array populated?
   - Location: `circuitStore.ts`, `past: Circuit[]`
   - Should have entries after edits
   - If empty → `commit()` not being called

2. Is `canUndo()` returning true?
   - Location: `circuitStore.ts:125`
   - Returns: `past.length > 0`
   - If false → no history to undo

3. Is keyboard shortcut firing?
   - Location: `LogicPlaygroundApp.tsx:232-244` (keyboard event listener)
   - If not firing → check event listener attached

4. Is `skipHistory` flag set incorrectly?
   - Location: `circuitStore.ts:82`
   - If true → history not being saved on commit

#### **Symptom: Views out of sync (2D shows different state than 3D)**

**Check:**

1. Is circuit store the single source of truth?
   - Location: `circuitStore.ts`
   - Views should read from store, not maintain independent state
   - If views have local state → remove it

2. Is LogicCanvas calling `onCircuitChange`?
   - Location: `LogicCanvas.tsx` (wire handlers, node handlers)
   - Should call callback on every edit
   - If not calling → mutations are not propagating

3. Are views reading stale circuit?
   - Use: `useCircuitStore.getState().circuit` (gets fresh state)
   - Avoid: `const store = useCircuitStore.getState(); ... store.circuit` (snapshot can be stale)

4. Is engine sync enabled?
   - Location: `circuitStore.ts:92-93`
   - Should call `engine?.setCircuit(circuit)` on every commit
   - If not calling → engine has old circuit

#### **Symptom: Performance is poor (laggy, low FPS)**

**Check:**

1. How many nodes in circuit?
   - Location: `circuit.nodes.length`
   - If >10,000 → expected slowdown
   - Solution: Profile and optimize hot paths

2. Is simulation running at correct Hz?
   - Location: `tickEngine.hz` (default 10Hz)
   - If too high (e.g., 60Hz) → reduce to 10Hz

3. Are views re-rendering unnecessarily?
   - Use: React DevTools Profiler
   - If excessive renders → add `React.memo` or optimize subscriptions

4. Is browser throttling?
   - Check: Background tab, low power mode
   - Solution: Keep tab active, disable power saving

#### **Symptom: Circuit behaves nondeterministically**

**Check:**

1. Is `Math.random()` used in logic?
   - Search: `grep -r "Math.random" packages/rb-logic-core/`
   - Should be zero results
   - If found → remove or use seeded RNG

2. Is `Date.now()` affecting circuit?
   - Search: `grep -r "Date.now" packages/rb-logic-core/`
   - Should not affect circuit evaluation
   - If found → remove or move to UI layer

3. Is evaluation order deterministic?
   - Location: `CircuitEngine.ts`, `evaluateTick()`
   - Should use topological sort or consistent ordering
   - If random order → fix sort algorithm

4. Are async operations modifying circuit?
   - Circuit commits should be synchronous
   - If async → refactor to synchronous

---

## Q: "Can you rebuild this from scratch?"

### Yes. Here's How.

**Phase 0: Foundation (1 week)**

1. Initialize monorepo with Turborepo + pnpm
2. Create packages: `rb-logic-core`, `rb-apps`, `rb-shell`
3. Set up Vite build for React + TypeScript
4. Implement basic circuit data structure:
   ```typescript
   interface Circuit {
     nodes: Node[];
     connections: Connection[];
   }
   ```

**Phase 1: Simulation Engine (1 week)**

1. Build `CircuitEngine.ts`:
   - Pure function: `evaluate(circuit, nodeStates) → newNodeStates`
   - Support AND, OR, NOT gates
   - Topological sort for deterministic ordering

2. Build `TickEngine.ts`:
   - Wrap CircuitEngine
   - Add tick counter and Hz control
   - Call `engine.evaluateTick()` on each step

3. Write tests:
   - Determinism: Run twice, assert identical output
   - Correctness: AND gate truth table, OR gate, NOT gate

**Phase 2: Circuit Store (3 days)**

1. Set up Zustand store (`circuitStore.ts`):
   ```typescript
   const useCircuitStore = create<CircuitState>((set, get) => ({
     circuit: { nodes: [], connections: [] },
     past: [],
     future: [],
     commit: (newCircuit) => { /* save to history */ },
     undo: () => { /* pop from past */ },
     redo: () => { /* pop from future */ }
   }));
   ```

2. Wire up undo/redo with keyboard shortcuts

**Phase 3: 2D View (1 week)**

1. Build `LogicCanvas.tsx`:
   - Render nodes as SVG rectangles
   - Render connections as SVG paths
   - Handle mouse events: drag nodes, click to wire

2. Make it controlled:
   - Accept `circuit` prop
   - Call `onCircuitChange(newCircuit)` on every edit

3. Add toolbar: Run/Pause/Step buttons

**Phase 4: Multi-View (1 week)**

1. Add 3D view with React Three Fiber:
   - Map circuit → voxel positions
   - Render gates as colored cubes
   - Sync with circuit store

2. Add oscilloscope:
   - Sample signals on each tick
   - Render as line chart

3. Verify all views update synchronously

**Phase 5: Learn Mode (3 days)**

1. Build tutorial system:
   - Define lessons as JSON (steps, validation)
   - Overlay instructions on canvas
   - Check circuit matches target

2. Create 3 initial tutorials:
   - NOT gate (inverter)
   - AND gate (conjunction)
   - Half adder (XOR + AND)

**Phase 6: Polish (ongoing)**

1. Add keyboard shortcuts (Cmd+K Quick Add)
2. Add circuit health checks (detect loops, unconnected wires)
3. Optimize performance (React.memo, useCallback)
4. Write integration tests (stabilization suite)
5. Deploy to static hosting (GitHub Pages, Vercel, Netlify)

**Total estimate: 5-6 weeks for MVP.**

I've already built this once, so I know exactly which parts are hard:
- **Hardest:** Wiring UI (dragging, snapping, validation)
- **Second hardest:** Multi-view sync (avoiding desyncs)
- **Third hardest:** Performance at scale (10k+ gates)

---

## Q: "What are the critical files? If I could only read 10 files, which ones?"

### The Essential 10 Files

1. **`packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`** (1,700 lines)
   - Main application component
   - Wires together circuit store, engines, views
   - Handles keyboard shortcuts, file operations, Learn Mode
   - **Read this first.**

2. **`packages/rb-apps/src/stores/circuitStore.ts`** (200 lines)
   - Zustand store for circuit state
   - Undo/redo implementation
   - Mutation pipeline (commit, addNode, deleteNode, etc.)
   - **Single source of truth.**

3. **`packages/rb-logic-core/src/CircuitEngine.ts`** (500 lines)
   - Logic evaluation engine
   - Gate implementations (AND, OR, NOT, etc.)
   - Topological sort for deterministic ordering
   - **The brain.**

4. **`packages/rb-logic-core/src/TickEngine.ts`** (300 lines)
   - Wraps CircuitEngine, adds discrete time
   - Tick loop, Hz control, pause/resume
   - Determinism guarantee implementation
   - **The heartbeat.**

5. **`packages/rb-logic-view/src/LogicCanvas.tsx`** (1,000 lines)
   - 2D schematic view (SVG-based)
   - Mouse handlers for dragging, wiring, selecting
   - Controlled component (circuit prop + onChange callback)
   - **The primary UI.**

6. **`packages/rb-apps/src/logic/circuitHealth.ts`** (200 lines)
   - Circuit validation (loops, unconnected wires, errors)
   - Error messages for debugging
   - Used in Circuit Health panel
   - **The diagnostics.**

7. **`packages/rb-apps/src/logic/learnMode.ts`** (300 lines)
   - Tutorial system definitions
   - Step validation logic
   - Curriculum (Track A, B, C)
   - **The pedagogy.**

8. **`packages/rb-logic-view/src/tools/wireValidation.ts`** (100 lines)
   - Wiring rules (output→input only, no self-loops)
   - Port type checking
   - Used by LogicCanvas during wiring
   - **The constraints.**

9. **`packages/rb-logic-view/src/useLogicViewStore.ts`** (150 lines)
   - Local view state (camera, selection, editing)
   - Separate from circuit state (view concerns only)
   - Pan/zoom, tool modes
   - **The view controller.**

10. **`packages/rb-apps/src/__tests__/playground.stabilization.test.tsx`** (350 lines)
    - Integration tests for critical workflows
    - QuickAdd, wiring, undo/redo, store consistency
    - Regression protection
    - **The safety net.**

**Read these 10 files and you understand 80% of the system.**

---

## Q: "What would you change if you started over?"

### If I Rebuilt This Tomorrow

**Keep:**

1. **Zustand for state management** — Simple, no boilerplate, works great
2. **Monorepo structure** — Clean boundaries, shared types, fast builds
3. **Deterministic tick-based simulation** — Rock-solid, no bugs from race conditions
4. **Controlled components** — LogicCanvas as controlled component prevents sync bugs
5. **Keyboard-first design** — Power users love it, worth the investment

**Change:**

1. **Use Immer for immutability** — Currently cloning circuits manually with `cloneCircuit()`. Immer would simplify:
   ```typescript
   produce(circuit, draft => {
     draft.nodes.push(newNode); // Mutate draft, Immer handles immutability
   });
   ```

2. **Separate engine package** — `rb-logic-core` should not depend on React types. Currently:
   ```typescript
   // Bad: Engine has React types
   import { Circuit } from '@redbyte/rb-apps';

   // Good: Pure TS types
   import { Circuit } from '@redbyte/rb-logic-types';
   ```

3. **Use Web Workers for simulation** — For large circuits (10k+ gates), simulation should run in worker thread:
   ```typescript
   // Main thread
   const worker = new Worker('./engine.worker.ts');
   worker.postMessage({ type: 'step', circuit });

   // Worker thread
   onmessage = (e) => {
     const newCircuit = engine.step(e.data.circuit);
     postMessage({ type: 'step-complete', circuit: newCircuit });
   };
   ```

4. **Add replay system from day 1** — Currently added determinism tools late. Should have been core:
   ```typescript
   interface RecordedSession {
     initialCircuit: Circuit;
     inputs: Array<{ tick: number; nodeId: string; value: 0 | 1 }>;
   }

   function replay(session: RecordedSession): Circuit[] {
     // Replay recorded inputs, return circuit state at each tick
   }
   ```

5. **Use IndexedDB instead of localStorage** — localStorage has 5MB limit, circuits can grow large. IndexedDB supports:
   - Larger storage (gigabytes)
   - Structured queries
   - Async API (doesn't block main thread)

6. **Schema versioning from day 1** — Currently circuit format is unversioned. Should have:
   ```typescript
   interface Circuit {
     version: '1.0.0';
     nodes: Node[];
     connections: Connection[];
   }

   function migrate(oldCircuit: any): Circuit {
     // Upgrade old formats to current version
   }
   ```

**But:** These are optimizations, not blockers. The current design works well.

---

## Q: "How would you explain this to a new engineer on day 1?"

### Onboarding a New Developer

**Day 1: Setup + Architecture Overview (4 hours)**

1. **Clone and build** (30 min)
   ```bash
   git clone https://github.com/you/redbyte-ui.git
   cd redbyte-ui
   pnpm install
   pnpm run dev
   ```

2. **Read documentation** (1 hour)
   - [00 — Project Identity](./00-project-identity.md)
   - [01 — Core Principles](./01-core-principles.md)
   - [03 — System Architecture](./03-system-architecture.md)

3. **Code walkthrough** (2 hours)
   - Open `LogicPlaygroundApp.tsx`, walk through render tree
   - Open `circuitStore.ts`, explain commit/undo/redo
   - Open `CircuitEngine.ts`, explain evaluation loop
   - Open `LogicCanvas.tsx`, explain controlled component pattern

4. **Run tests** (30 min)
   ```bash
   pnpm test
   ```
   - Review stabilization tests
   - Understand what's tested vs not tested

**Day 2: First Task (Easy Bug Fix)**

Give a small bug fix to build confidence:
- "Add tooltip to Run button showing keyboard shortcut"
- "Fix typo in Learn Mode tutorial step 3"
- Requires touching 1-2 files, no deep system knowledge

**Week 1: First Feature (Medium Complexity)**

Give a self-contained feature:
- "Add a new gate type: XNOR (exclusive NOR)"
- Requires:
  - Add gate definition to `CircuitEngine.ts`
  - Add gate to palette in `EnhancedPalette.tsx`
  - Write tests for XNOR truth table
- Touches multiple files, but clear scope

**By End of Week 1:**

New engineer should be able to:
- Build and run the project
- Understand data flow (User → Store → Engine → Views)
- Fix small bugs independently
- Navigate the codebase confidently

---

## Conclusion

This Owner's Manual demonstrates:

✅ **I can explain the entire system** (2-minute overview)
✅ **I can trace any workflow end-to-end** (circuit edit, simulation, undo)
✅ **I can debug any subsystem** (debugging playbook)
✅ **I can rebuild from scratch** (5-6 week plan)
✅ **I can identify critical files** (the essential 10)
✅ **I can articulate improvements** (what I'd change)
✅ **I can onboard new engineers** (day 1 plan)

If you asked me these questions in a technical interview, this is how I'd answer. Every claim is backed by code locations, every flow is traceable, every decision is justified.

**This is proof of mastery.**

---

## Related Documents

- [00 — Project Identity](./00-project-identity.md)
- [01 — Core Principles](./01-core-principles.md)
- [02 — Determinism Contract](./02-determinism-contract.md)
- [03 — System Architecture](./03-system-architecture.md)
- [/02-systems/](../02-systems/) — Subsystem deep dives

---

## Changelog

- **2026-01-05**: Initial canonical version (Documentation OS project)
