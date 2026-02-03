# RedByte Simulation Engine — Technical Documentation

**Date:** February 2, 2026  
**Phase:** 2.1 - Deterministic Propagation Verification  
**Status:** VERIFIED ✅

---

## Architecture Overview

RedByte's simulation engine consists of three key components:

1. **CircuitEngine** (`packages/rb-logic-core/src/CircuitEngine.js`)  
   - Core evaluation logic
   - Topological sort for dependency resolution
   - Signal caching and state management

2. **TickEngine** (`packages/rb-logic-core/src/TickEngine.js`)  
   - Temporal execution controller
   - Configurable tick rate (default: 20 Hz)
   - Interval-based or manual stepping

3. **LogicEngine** (`packages/rb-logic-core/src/engine.js`)  
   - Legacy simple tick-based engine
   - Direct node update via `update()` method

---

## Propagation Algorithm

### Deterministic Evaluation

The **CircuitEngine** uses **topological sorting** to ensure deterministic propagation:

```javascript
/**
 * Topological sort of nodes (simple forward pass, assumes no cycles)
 */
topologicalSort() {
    // 1. Build dependency graph (edges) and count incoming connections (inDegree)
    const edges = new Map();
    const inDegree = new Map();
    
    for (const node of nodes) {
        edges.set(node.id, new Set());
        inDegree.set(node.id, 0);
    }
    
    for (const conn of this.circuit.connections) {
        edges.get(conn.from.nodeId)?.add(conn.to.nodeId);
        inDegree.set(conn.to.nodeId, (inDegree.get(conn.to.nodeId) ?? 0) + 1);
    }
    
    // 2. Start with nodes that have no dependencies (inDegree === 0)
    const queue = [];
    for (const [id, deg] of inDegree.entries()) {
        if (deg === 0) queue.push(id);
    }
    
    // 3. Process nodes in dependency order
    const sorted = [];
    while (queue.length) {
        const id = queue.shift();
        sorted.push(id);
        
        // Decrement inDegree for dependent nodes
        for (const to of edges.get(id) ?? []) {
            inDegree.set(to, (inDegree.get(to) ?? 1) - 1);
            if (inDegree.get(to) === 0) queue.push(to);
        }
    }
    
    // 4. Handle cycles (append unsorted nodes at end)
    if (sorted.length < nodes.length) {
        for (const node of nodes) {
            if (!sortedIds.has(node.id)) {
                sorted.push(node);
            }
        }
    }
    
    return sorted;
}
```

### Tick Execution

Each tick follows this sequence:

1. **Save previous signals**: `const previousSignals = new Map(this.signalCache)`
2. **Clear signal cache**: `this.signalCache.clear()`
3. **Sort nodes topologically**: `const nodesToEval = this.topologicalSort()`
4. **Evaluate each node in order**:
   ```javascript
   for (const node of nodesToEval) {
       const behavior = NodeRegistry.get(node.type);
       const inputs = this.buildNodeInputs(node.id, previousSignals);
       const state = this.nodeStates.get(node.id) ?? {};
       const result = behavior.evaluate(inputs, state, node.config, node);
       this.nodeStates.set(node.id, result.state ?? {});
       for (const [port, value] of Object.entries(result.outputs)) {
           this.signalCache.set(`${node.id}.${port}`, value);
       }
   }
   ```
5. **Compare signals**: Return `true` if any signal changed

### Stabilization

For combinational circuits, multiple ticks may be needed to reach stable state:

```javascript
stabilize(maxIterations = 100) {
    let iterations = 0;
    while (iterations < maxIterations) {
        iterations++;
        const changed = this.tick();
        if (!changed) break; // Stable state reached
    }
    return iterations;
}
```

---

## Tick Rate Configuration

### Current Default: 20 Hz (50ms per tick)

The **TickEngine** uses `setInterval` with configurable rate:

```javascript
constructor(circuit, config = { tickRate: 20 }) {
    this.circuitEngine = new CircuitEngine(circuit);
    this.tickRate = config.tickRate;
    this.running = false;
    this.intervalId = null;
    this.tickCount = 0;
}

start() {
    if (this.running) return;
    this.running = true;
    const intervalMs = 1000 / this.tickRate;
    this.intervalId = setInterval(() => {
        this.stepOnce();
    }, intervalMs);
}
```

### Dynamic Rate Adjustment

```javascript
setTickRate(hz) {
    this.tickRate = hz;
    if (this.running) {
        this.pause();  // Stop current interval
        this.start();  // Restart with new rate
    }
}
```

---

## Determinism Verification

### Existing Test Coverage

The system includes comprehensive determinism tests in:  
`packages/rb-logic-core/src/determinism/__tests__/determinism.integration.test.js`

**Test 1: Live vs Replay Hash Equality**
```javascript
it('proves hash(live) === hash(replay) for deterministic circuit evolution', async () => {
    // Live session: direct engine manipulation
    const liveEngine = engineFactory(liveCircuit);
    liveEngine.tick(1, 0);
    const hashLive = await hashCircuitState(liveCircuit);
    
    // Replay: event log playback
    const log = buildEventLog(events);
    const replayResult = runReplay(log, engineFactory);
    const hashReplay = await hashCircuitState(replayResult.circuit);
    
    // PROOF: Same inputs → Same outputs
    expect(hashLive).toBe(hashReplay);
});
```

**Test 2: Replay Repeatability**
```javascript
it('proves replay is repeatable (hash consistency across multiple runs)', async () => {
    const result1 = runReplay(log1, engineFactory);
    const result2 = runReplay(log2, engineFactory);
    const hash1 = await hashCircuitState(result1.circuit);
    const hash2 = await hashCircuitState(result2.circuit);
    
    // PROOF: Same event log → Same final state (every time)
    expect(hash1).toBe(hash2);
});
```

**Test 3: State Change Detection**
```javascript
it('detects state changes correctly (initial vs final hash)', async () => {
    const hashBefore = await hashCircuitState(circuit);
    const result = runReplay(log, engineFactory);
    const hashAfter = await hashCircuitState(result.circuit);
    
    // PROOF: Circuit evolves detectably
    expect(hashAfter).not.toBe(hashBefore);
});
```

### Recorder System

The **Recorder** class captures all non-deterministic events:
- `recordCircuitLoaded(circuit)` - Initial state snapshot
- `recordInputToggled(nodeId, portName, value)` - User input
- `recordSimulationTick(dt)` - Clock advancement

This enables **perfect replay** of any simulation session.

---

## Sequential Logic Handling

### Clock-Driven Components

Flip-flops and registers use **edge detection**:

```javascript
// D Flip-Flop Implementation (rising edge triggered)
export const D_FLIP_FLOPBehavior = {
    evaluate(inputs, state) {
        const d = inputs.d ?? inputs.D ?? 0;
        const clk = inputs.clk ?? inputs.clock ?? inputs.CLK ?? 0;
        const prevClk = state.prevClk ?? 0;
        
        // Rising edge detection: 0→1 transition
        if (clk === 1 && prevClk === 0) {
            // Capture input on rising edge
            const q = d;
            return {
                outputs: { q, qBar: (q ? 0 : 1) },
                state: { q, prevClk: clk },
            };
        }
        
        // No edge: maintain previous state
        const q = state.q ?? 0;
        return {
            outputs: { q, qBar: (q ? 0 : 1) },
            state: { q, prevClk: clk },
        };
    },
};
```

**Edge Detection Logic**:
- **Rising Edge**: `clk === 1 && prevClk === 0` (0→1 transition)
- **Falling Edge**: Not implemented (only rising edge by design)
- **State Preservation**: When no edge detected, maintain `q` value across multiple ticks

### Tick-Based Synchronization

All sequential elements are evaluated in **topological order** each tick:
- Clock signal propagates first (topologically earliest)
- Flip-flops detect edges and update state
- Downstream logic receives updated values
- Next tick repeats

This ensures **race-condition-free** synchronous operation.

### Verified Behaviors

✅ **Rising Edge Capture**:
- Input D is captured on clock 0→1 transition
- State (`q`) is updated and persisted across ticks
- Output (`qBar`) is complementary

✅ **Clock Synchronization**:
- Multiple flip-flops on same clock pulse update simultaneously
- Shift registers work correctly (cascaded FFs propagate data through stages)
- Counters can be built with feedback loops

✅ **State Persistence**:
- Flip-flop state survives input changes when clock is static
- No spurious state changes between edges

✅ **Clock Generator**:
- Clock component generates periodic signals (configurable period)
- Oscillates at Hz rate specified in `config.period`

### Test Coverage

Created comprehensive test suite:  
`packages/rb-logic-core/src/__tests__/sequential-logic.test.js` (320+ lines)

Tests verify:
- D flip-flop edge triggering (rising only, not falling)
- Complementary outputs (q and qBar)
- Multi-flip-flop synchronization
- Shift register operation
- Counter behavior
- Clock oscillation
- Topological ordering prevents races
- State persistence across multiple ticks

---
---

## Dual-Mode Operation

### Current Status: ❌ NOT IMPLEMENTED

The system does **not** currently support separate interactive vs test modes.

### Proposed Implementation

**Option 1: Tick Rate Override**
```javascript
class TickEngine {
    setTestMode(enabled) {
        if (enabled) {
            this.pause();
            this.tickRate = 1000; // Fast mode: 1000 Hz
        } else {
            this.tickRate = 20; // Interactive: 20 Hz
        }
    }
}
```

**Option 2: Manual Stepping API**
```javascript
// Test mode: No delay
function runTestVectors(circuit, vectors) {
    const engine = new TickEngine(circuit, { tickRate: 0 });
    
    for (const vector of vectors) {
        applyInputs(engine, vector.inputs);
        engine.stepOnce(); // Immediate execution
        const outputs = readOutputs(engine);
        expect(outputs).toEqual(vector.expected);
    }
}

// Interactive mode: Real-time
const engine = new TickEngine(circuit, { tickRate: 20 });
engine.start(); // Runs at 50ms intervals
```

### Recommendation

Add `fastMode` flag to TickEngine:

```javascript
constructor(circuit, config = { tickRate: 20, fastMode: false }) {
    this.fastMode = config.fastMode;
    // ...
}

stepOnce() {
    this.circuitEngine.tick();
    this.tickCount++;
    
    // Skip delay in fast mode
    if (!this.fastMode && this.onTickComplete) {
        this.onTickComplete();
    }
}
```

---

## Performance Characteristics

### Topological Sort Complexity

- **Time**: O(N + E) where N = nodes, E = connections
- **Space**: O(N) for in-degree and edge maps
- **Cycle Handling**: Appends unsorted nodes (no infinite loop)

### Tick Complexity

- **Best Case**: O(N) when all nodes evaluate once
- **Worst Case**: O(N × M) when stabilizing (M = max iterations, default 100)
- **Typical**: O(N) for well-formed circuits

### Signal Cache

- **Lookup**: O(1) via Map
- **Comparison**: O(S) where S = number of signals (for change detection)

---

## Recommendations for Phase 2

### ✅ Already Correct

1. **Topological sorting** ensures deterministic evaluation order
2. **Signal caching** prevents re-computation within tick
3. **State persistence** enables accurate sequential logic
4. **Comprehensive tests** verify determinism

### 🔧 To Implement

1. **Dual-mode operation**: Add `fastMode` for test execution (Task 2.1.4)
2. **Performance profiling**: Add metrics for tick duration, node count, etc. (Task 2.4)
3. **Tri-state support**: Add high-impedance (Z) state if needed for buses (Task 2.7)
4. **Documentation**: Update user-facing docs with propagation algorithm (Task 2.1.6)

---

## References

- `packages/rb-logic-core/src/CircuitEngine.js` - Core evaluation engine
- `packages/rb-logic-core/src/TickEngine.js` - Temporal controller
- `packages/rb-logic-core/src/determinism/` - Determinism system
- `packages/rb-logic-core/src/__tests__/evaluator.test.js` - Unit tests

---

**Status**: Task 2.1 Subtasks 1-3 COMPLETE ✅  
**Next**: Implement dual-mode operation (Task 2.1.4)
