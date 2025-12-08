# ADR-0002: Logic Engine Tick-Based Simulation

**Status:** Accepted
**Date:** 2025-12-08
**Deciders:** Engineering Team
**Context:** Genesis v1 Architecture

---

## Context

Digital logic circuits require **discrete time simulation**:
- Signal changes propagate through gates in steps
- Clocks, counters, and flip-flops depend on state over time
- Users need to visualize logic flow at controllable speeds

Requirements:
1. **Deterministic behavior** — Same circuit always produces same output
2. **Controllable speed** — Users can slow down or speed up simulation
3. **Step-by-step execution** — Users can manually step through ticks
4. **Real-time visualization** — Canvas updates reflect current circuit state

We need a simulation model that balances:
- **Accuracy**: Matches real-world digital logic behavior
- **Performance**: 60 Hz simulation for small-to-medium circuits
- **Usability**: Simple API for app developers

---

## Decision

We adopt a **tick-based simulation model** with two core classes:

### 1. `CircuitEngine` — Pure Logic Evaluation

```typescript
class CircuitEngine {
  tick(): void {
    // Evaluate all nodes in topological order
    for (const node of this.nodes) {
      const inputs = this.gatherInputs(node);
      const outputs = node.behavior.evaluate(node, inputs);
      this.updateOutputs(node, outputs);
    }
  }
}
```

**Responsibilities:**
- Evaluate circuit logic for a single time step
- No timing, no scheduling, no side effects
- Pure function: same inputs → same outputs

### 2. `TickEngine` — Simulation Scheduling

```typescript
class TickEngine {
  constructor(engine: CircuitEngine, hz: number) {
    this.engine = engine;
    this.interval = 1000 / hz;
  }

  start(): void {
    this.timer = setInterval(() => {
      this.engine.tick();
      this.notifyListeners();
    }, this.interval);
  }

  pause(): void {
    clearInterval(this.timer);
  }

  stepOnce(): void {
    this.engine.tick();
    this.notifyListeners();
  }

  setTickRate(hz: number): void {
    this.interval = 1000 / hz;
    if (this.running) {
      this.pause();
      this.start();
    }
  }
}
```

**Responsibilities:**
- Schedule ticks at user-defined frequency
- Manage start/pause/step controls
- Notify UI to re-render after each tick

---

## Alternatives Considered

### Alternative 1: Event-Driven Simulation

**How it works:**
- Nodes emit events when their state changes
- Events propagate through connections
- Simulation only updates changed nodes

**Pros:**
- Potentially more efficient (fewer evaluations)
- Closer to hardware simulation tools (Verilog, VHDL)

**Cons:**
- Complex to implement (event queuing, priority)
- Harder to debug (non-deterministic order without careful design)
- Overhead for small circuits (event management)

**Rejected:** Too complex for Genesis v1 educational focus.

### Alternative 2: Continuous Simulation (requestAnimationFrame)

**How it works:**
- Simulation tied to browser's animation frame (~60 FPS)
- No explicit tick rate control

**Pros:**
- Smooth animations
- Simple integration with canvas rendering

**Cons:**
- No control over simulation speed
- Can't slow down for educational purposes
- Can't run faster than 60 Hz
- Inconsistent timing across devices

**Rejected:** Need controllable speed for learning.

### Alternative 3: Web Workers for Parallel Evaluation

**How it works:**
- Evaluate nodes in parallel Web Workers
- Synchronize results on main thread

**Pros:**
- Potential performance boost for large circuits

**Cons:**
- Serialization overhead (transferring circuit state)
- Complexity (thread coordination)
- Overkill for <100 node circuits (v1 target)

**Rejected:** Premature optimization. Revisit in v2 if needed.

---

## Consequences

### Positive

- **Simple mental model**: 1 tick = 1 step of time
- **Deterministic**: Same tick sequence → same results
- **Controllable**: Users can adjust Hz (1–60)
- **Debuggable**: Can pause and inspect circuit state
- **Testable**: Pure `tick()` function is easy to unit test

### Negative

- **Not perfectly accurate**: Real hardware has propagation delays (nanoseconds). Our ticks are discrete.
- **Performance limit**: Large circuits (1000+ nodes) may drop below 60 Hz
- **Combinatorial loops**: Circuits with feedback require special handling (delay nodes)

### Neutral

- **Memory overhead**: Circuit state stored in-memory (not serialized each tick)
- **UI coupling**: TickEngine must notify UI to re-render

---

## Implementation

### Tick Rate Control

Default: **10 Hz** (10 ticks/second)
- Range: 1–60 Hz
- UI slider in LogicPlaygroundApp

```typescript
const [currentHz, setCurrentHz] = useState(10);
const handleHzChange = (hz: number) => {
  setCurrentHz(hz);
  tickEngine.setTickRate(hz);
};
```

### Step-by-Step Execution

```typescript
const handleStep = () => {
  tickEngine.stepOnce(); // Execute 1 tick
};
```

### Pause/Resume

```typescript
const handlePause = () => {
  tickEngine.pause();
  setIsRunning(false);
};

const handleRun = () => {
  tickEngine.start();
  setIsRunning(true);
};
```

---

## Handling Combinatorial Loops

**Problem:** Circuits with feedback (e.g., SR latches) can cause infinite loops within a single tick.

**Solution:** Require explicit **Delay** nodes for feedback paths.

**Example:**
```
[Q] ─┐
     ├─ [NOR] ─ [Q]
[S] ─┘

❌ This creates a loop (Q depends on Q)

[Q] ─ [Delay] ─┐
                ├─ [NOR] ─ [Q]
[S] ───────────┘

✅ Delay breaks the loop (Q depends on Q from previous tick)
```

**Composite nodes** (RSLatch, DFlipFlop) internally use Delay nodes to handle feedback.

---

## Performance Guarantees

### Small Circuits (<100 nodes)
- **Target**: 60 Hz simulation
- **Reality**: Typically achieves 60 Hz on modern browsers

### Medium Circuits (100–500 nodes)
- **Target**: 30 Hz simulation
- **Reality**: May degrade to 20–30 Hz depending on complexity

### Large Circuits (500+ nodes)
- **Target**: Best effort
- **Reality**: Graceful slowdown, no crashes

### Optimization Strategies (Future)

1. **Topological sorting**: Evaluate nodes in dependency order (reduce redundant evaluations)
2. **Change detection**: Only evaluate nodes whose inputs changed
3. **Batch updates**: Group state changes, notify UI once per tick
4. **Web Workers**: Offload evaluation to background thread

---

## Validation

### Unit Tests

```typescript
test('CircuitEngine evaluates AND gate correctly', () => {
  const circuit = createAndGateCircuit();
  const engine = new CircuitEngine(circuit);

  // Tick 1: Inputs = [0, 0]
  engine.tick();
  expect(getOutput(circuit)).toBe(0);

  // Tick 2: Inputs = [1, 0]
  setInput(circuit, 0, 1);
  engine.tick();
  expect(getOutput(circuit)).toBe(0);

  // Tick 3: Inputs = [1, 1]
  setInput(circuit, 1, 1);
  engine.tick();
  expect(getOutput(circuit)).toBe(1);
});
```

### E2E Tests

- [ ] User can start/pause simulation
- [ ] User can adjust tick rate (1–60 Hz)
- [ ] User can step through ticks manually
- [ ] Clock nodes oscillate correctly
- [ ] Counter circuits increment on each clock pulse

---

## References

- [Digital Logic Simulation (Wikipedia)](https://en.wikipedia.org/wiki/Logic_simulation)
- [Discrete Event Simulation](https://en.wikipedia.org/wiki/Discrete-event_simulation)
- [Logisim Evolution](https://github.com/logisim-evolution/logisim-evolution) — Similar tick-based approach

---

## Future Considerations

### V2 Enhancements

1. **Variable propagation delay**: Model gate delays more accurately
2. **Hazard detection**: Warn about race conditions and glitches
3. **Performance profiler**: Show which nodes are bottlenecks
4. **Hardware export**: Generate Verilog/VHDL from circuits

---

## Revisions

- **2025-12-08**: Initial ADR for Genesis v1
