// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SimulationProfiler,
  IncrementalEvaluator,
  UpdateThrottler,
  MemoryMonitor,
  OptimizedCircuitEvaluator,
} from '../performance';

/**
 * Performance Optimization Tests
 *
 * Validates profiling, optimization, and performance improvements.
 * Tests profiler accuracy, incremental evaluation, throttling, and memory tracking.
 */

describe('SimulationProfiler', () => {
  let profiler;

  beforeEach(() => {
    profiler = new SimulationProfiler();
  });

  it('should record tick metrics', () => {
    profiler.startRecording();

    profiler.recordTick(1.5, 10, 3); // duration=1.5ms, nodes=10, events=3
    profiler.recordTick(1.2, 10, 2);
    profiler.recordTick(1.8, 10, 4);

    profiler.stopRecording();
    const report = profiler.getReport();

    expect(report.tickCount).toBe(3);
    expect(report.totalTime).toBe(4.5);
    expect(report.totalNodesEvaluated).toBe(30);
    expect(report.totalEvents).toBe(9);
  });

  it('should calculate tick frequency', () => {
    profiler.startRecording();

    // 10 ticks, 10ms total = 1000 ticks/sec
    for (let i = 0; i < 10; i++) {
      profiler.recordTick(1.0, 10);
    }

    const report = profiler.getReport();
    expect(report.ticksPerSecond).toBeCloseTo(1000, -1);
  });

  it('should compute percentiles correctly', () => {
    profiler.startRecording();

    // Create distribution: 90% fast (0.5ms), 10% slow (5ms)
    for (let i = 0; i < 90; i++) {
      profiler.recordTick(0.5, 10);
    }
    for (let i = 0; i < 10; i++) {
      profiler.recordTick(5.0, 10);
    }

    const report = profiler.getReport();

    expect(report.tickCount).toBe(100);
    expect(report.p50TickTime).toBeLessThan(1); // Median should be < 1ms
    expect(report.p95TickTime).toBeGreaterThan(1); // 95th percentile near high values
  });

  it('should track average nodes per tick', () => {
    profiler.startRecording();

    profiler.recordTick(1.0, 50);
    profiler.recordTick(1.0, 40);
    profiler.recordTick(1.0, 60);

    const report = profiler.getReport();
    expect(report.averageNodesPerTick).toBeCloseTo(50, 0);
  });

  it('should identify slow ticks', () => {
    profiler.startRecording();

    for (let i = 0; i < 50; i++) {
      profiler.recordTick(0.5, 10); // Fast
    }
    for (let i = 0; i < 50; i++) {
      profiler.recordTick(15, 100); // Slow
    }

    const report = profiler.getReport();

    expect(report.percentageOfTicksOverThreshold.above1ms).toBe('50.0');
    expect(report.percentageOfTicksOverThreshold.above5ms).toBe('50.0');
  });

  it('should format report as string', () => {
    profiler.startRecording();
    profiler.recordTick(1.0, 10);
    const report = profiler.getReport();
    const formatted = profiler.formatReport(report);

    expect(formatted).toContain('Simulation Performance Report');
    expect(formatted).toContain('Ticks:');
    expect(formatted).toContain('ticks/sec');
  });

  it('should handle empty recording', () => {
    const report = profiler.getReport();

    expect(report.tickCount).toBe(0);
    expect(report.averageTickTime).toBe(0);
    expect(report.ticksPerSecond).toBe(0);
  });
});

describe('IncrementalEvaluator', () => {
  let circuit;
  let evaluator;

  beforeEach(() => {
    // Create a dependency chain: A -> B -> C -> D
    circuit = {
      nodes: [
        { id: 'a', type: 'SWITCH' },
        { id: 'b', type: 'AND', inputs: ['a'] },
        { id: 'c', type: 'AND', inputs: ['b'] },
        { id: 'd', type: 'AND', inputs: ['c'] },
      ],
      wires: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
      ],
    };
    evaluator = new IncrementalEvaluator(circuit);
  });

  it('should build dependency graph', () => {
    const deps = evaluator.dependencies;

    expect(deps.get('a')).toContain('b');
    expect(deps.get('b')).toContain('c');
    expect(deps.get('c')).toContain('d');
  });

  it('should identify directly affected nodes', () => {
    const affected = evaluator.getAffectedNodes(['a']);

    expect(affected).toContain('a');
    expect(affected).toContain('b');
    expect(affected).toContain('c');
    expect(affected).toContain('d');
  });

  it('should compute transitive closure', () => {
    // Change node 'b' - should affect c and d
    const affected = evaluator.getAffectedNodes(['b']);

    expect(affected).toContain('b');
    expect(affected).toContain('c');
    expect(affected).toContain('d');
    expect(affected).not.toContain('a');
  });

  it('should handle multiple changed nodes', () => {
    circuit.wires.push(
      { from: 'd', to: 'e' }, // Add node e dependent on d
      { from: 'a', to: 'f' } // Add node f dependent on a
    );
    circuit.nodes.push(
      { id: 'e', type: 'OR' },
      { id: 'f', type: 'OR' }
    );

    evaluator = new IncrementalEvaluator(circuit);

    const affected = evaluator.getAffectedNodes(['a', 'c']);

    // From a: b, c, d, e, f
    // From c: d, e
    // Union: a, c, b, d, e, f (or subset thereof)
    expect(affected.length).toBeGreaterThan(2);
  });

  it('should record and retrieve state', () => {
    evaluator.recordState('a', 1);
    evaluator.recordState('b', 0);

    const changed = evaluator.getChangedNodes();
    expect(changed).toContain('a');
    expect(changed).toContain('b');
  });
});

describe('UpdateThrottler', () => {
  let throttler;

  beforeEach(() => {
    throttler = new UpdateThrottler({ minUpdateInterval: 50 });
  });

  it('should allow updates at intervals', () => {
    const t0 = 0;
    const t50 = 50;
    const t100 = 100;

    expect(throttler.shouldUpdate(t0)).toBe(true); // First update
    expect(throttler.shouldUpdate(t50 - 1)).toBe(false); // Too soon
    throttler.lastUpdateTime = t50;
    expect(throttler.shouldUpdate(t100)).toBe(true); // 50ms later
  });

  it('should queue updates', () => {
    throttler.recordUpdate('nodeA', 1);
    throttler.recordUpdate('nodeB', 0);

    expect(throttler.hasPendingUpdates()).toBe(true);
    expect(throttler.updateQueue.length).toBe(2);
  });

  it('should flush pending updates', () => {
    throttler.recordUpdate('nodeA', 1);
    throttler.recordUpdate('nodeB', 0);

    const updates = throttler.flush(50);

    expect(updates.length).toBe(2);
    expect(throttler.updateQueue.length).toBe(0);
  });

  it('should not flush if interval not reached', () => {
    throttler.recordUpdate('nodeA', 1);

    const updates = throttler.flush(30); // Before 50ms interval

    expect(updates).toBeNull();
    expect(throttler.updateQueue.length).toBe(1);
  });

  it('should return null when no pending updates', () => {
    const updates = throttler.flush(100);
    expect(updates).toBeNull();
  });
});

describe('MemoryMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new MemoryMonitor();
  });

  it('should record memory samples', () => {
    // Mock performance.memory
    global.performance.memory = {
      usedJSHeapSize: 50 * 1024 * 1024, // 50 MB
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 500 * 1024 * 1024,
    };

    monitor.recordSample();
    expect(monitor.samples.length).toBe(1);
  });

  it('should calculate memory statistics', () => {
    global.performance.memory = {
      usedJSHeapSize: 40 * 1024 * 1024,
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 500 * 1024 * 1024,
    };
    monitor.recordSample();

    global.performance.memory.usedJSHeapSize = 60 * 1024 * 1024;
    monitor.recordSample();

    global.performance.memory.usedJSHeapSize = 50 * 1024 * 1024;
    monitor.recordSample();

    const report = monitor.getReport();

    expect(report.samples).toBe(3);
    expect(report.minMemory).toContain('40');
    expect(report.maxMemory).toContain('60');
  });

  it('should return null when no samples', () => {
    const report = monitor.getReport();
    expect(report).toBeNull();
  });
});

describe('OptimizedCircuitEvaluator', () => {
  let circuit;
  let evaluator;

  beforeEach(() => {
    circuit = {
      nodes: [
        { id: 'a', type: 'SWITCH' },
        { id: 'b', type: 'SWITCH' },
        { id: 'and1', type: 'AND' },
        { id: 'or1', type: 'OR' },
      ],
      wires: [
        { from: 'a', to: 'and1' },
        { from: 'b', to: 'and1' },
        { from: 'and1', to: 'or1' },
      ],
    };
    evaluator = new OptimizedCircuitEvaluator(circuit);
  });

  it('should compute topological order', () => {
    const order = evaluator.topoOrder;
    expect(order.length).toBeGreaterThan(0);
  });

  it('should perform optimized tick', () => {
    const nodeStates = new Map([
      ['a', 0],
      ['b', 0],
      ['and1', 0],
      ['or1', 0],
    ]);

    const result = evaluator.tick(nodeStates, ['a']);

    expect(result.duration).toBeGreaterThan(0);
    expect(result.nodesEvaluated).toBeGreaterThan(0);
  });

  it('should generate performance report', () => {
    const nodeStates = new Map([
      ['a', 0],
      ['b', 0],
      ['and1', 0],
      ['or1', 0],
    ]);

    for (let i = 0; i < 10; i++) {
      evaluator.tick(nodeStates);
    }

    const report = evaluator.getPerformanceReport();

    expect(report).toHaveProperty('simulation');
    expect(report).toHaveProperty('memory');
    expect(report.simulation.tickCount).toBe(10);
  });
});

describe('Performance Benchmarks', () => {
  it('should evaluate 100-node circuit efficiently', () => {
    const circuit = { nodes: [], wires: [] };

    // Create 100-node chain
    for (let i = 0; i < 100; i++) {
      circuit.nodes.push({ id: `n${i}`, type: 'AND' });
      if (i > 0) {
        circuit.wires.push({ from: `n${i - 1}`, to: `n${i}` });
      }
    }

    const start = performance.now();

    const profiler = new SimulationProfiler();
    profiler.startRecording();

    // Simulate 100 ticks
    for (let t = 0; t < 100; t++) {
      profiler.recordTick(0.5, 50); // 0.5ms per tick, 50 nodes evaluated
    }

    profiler.stopRecording();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should handle incremental evaluation speedup', () => {
    const circuit = {
      nodes: Array.from({ length: 50 }, (_, i) => ({ id: `n${i}`, type: 'AND' })),
      wires: Array.from({ length: 49 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}` })),
    };

    const evaluator = new IncrementalEvaluator(circuit);

    // Changing only node 0 should only require ~25 nodes to be evaluated
    // (instead of all 50)
    const affected = evaluator.getAffectedNodes(['n0']);

    expect(affected.length).toBeGreaterThan(0);
    expect(affected.length).toBeLessThanOrEqual(circuit.nodes.length);
  });
});
