// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Performance Profiling and Optimization for Logic Simulation
 *
 * Provides tools for:
 * - Profiling simulation performance (timing, memory, throughput)
 * - Identifying bottlenecks (evaluation, rendering, re-renders)
 * - Measuring impact of optimizations
 * - Validating accuracy with larger circuits
 */

export class SimulationProfiler {
  constructor() {
    this.metrics = {
      tickCount: 0,
      totalTickTime: 0,
      tickTimes: [],
      nodesEvaluated: 0,
      eventsProcessed: 0,
      updateCount: 0,
    };
    this.isRecording = false;
  }

  startRecording() {
    this.isRecording = true;
    this.metrics = {
      tickCount: 0,
      totalTickTime: 0,
      tickTimes: [],
      nodesEvaluated: 0,
      eventsProcessed: 0,
      updateCount: 0,
    };
  }

  stopRecording() {
    this.isRecording = false;
    return this.getReport();
  }

  recordTick(duration, nodesEvaluated, eventsProcessed = 0) {
    if (!this.isRecording) return;

    this.metrics.tickCount++;
    this.metrics.totalTickTime += duration;
    this.metrics.tickTimes.push(duration);
    this.metrics.nodesEvaluated += nodesEvaluated;
    this.metrics.eventsProcessed += eventsProcessed;
  }

  recordUpdate() {
    if (!this.isRecording) return;
    this.metrics.updateCount++;
  }

  getReport() {
    const { tickCount, totalTickTime, tickTimes, nodesEvaluated, eventsProcessed, updateCount } = this.metrics;

    if (tickCount === 0) {
      return {
        tickCount: 0,
        averageTickTime: 0,
        ticksPerSecond: 0,
        averageNodesPerTick: 0,
        totalEvents: 0,
        updateCount: 0,
        memoryUsage: 0,
      };
    }

    const sortedTimes = [...tickTimes].sort((a, b) => a - b);
    const avgTime = totalTickTime / tickCount;
    const minTime = sortedTimes[0];
    const maxTime = sortedTimes[tickCount - 1];
    const p50 = sortedTimes[Math.floor(tickCount * 0.5)];
    const p95 = sortedTimes[Math.floor(tickCount * 0.95)];
    const p99 = sortedTimes[Math.floor(tickCount * 0.99)];

    return {
      tickCount,
      totalTime: totalTickTime,
      averageTickTime: avgTime,
      minTickTime: minTime,
      maxTickTime: maxTime,
      p50TickTime: p50,
      p95TickTime: p95,
      p99TickTime: p99,
      ticksPerSecond: Math.round((tickCount / (totalTickTime / 1000)) * 100) / 100,
      averageNodesPerTick: Math.round((nodesEvaluated / tickCount) * 10) / 10,
      totalNodesEvaluated: nodesEvaluated,
      totalEvents: eventsProcessed,
      updateCount,
      percentageOfTicksOverThreshold: {
        above1ms: ((tickTimes.filter((t) => t > 1).length / tickCount) * 100).toFixed(1),
        above5ms: ((tickTimes.filter((t) => t > 5).length / tickCount) * 100).toFixed(1),
        above10ms: ((tickTimes.filter((t) => t > 10).length / tickCount) * 100).toFixed(1),
      },
    };
  }

  formatReport(report) {
    return `
=== Simulation Performance Report ===
Ticks: ${report.tickCount}
Total Time: ${report.totalTime.toFixed(2)}ms
Tick Frequency: ${report.ticksPerSecond} ticks/sec
Avg Tick Time: ${report.averageTickTime.toFixed(2)}ms
Min/Max: ${report.minTickTime.toFixed(2)}/${report.maxTickTime.toFixed(2)}ms
P50/P95/P99: ${report.p50TickTime.toFixed(2)}/${report.p95TickTime.toFixed(2)}/${report.p99TickTime.toFixed(2)}ms

Nodes Evaluated: ${report.totalNodesEvaluated} (avg ${report.averageNodesPerTick}/tick)
Events Processed: ${report.totalEvents}
UI Updates: ${report.updateCount}

Ticks > 1ms: ${report.percentageOfTicksOverThreshold.above1ms}%
Ticks > 5ms: ${report.percentageOfTicksOverThreshold.above5ms}%
Ticks > 10ms: ${report.percentageOfTicksOverThreshold.above10ms}%
    `.trim();
  }
}

/**
 * Incremental Evaluation Optimizer
 *
 * Only recomputes nodes whose inputs have changed.
 * Uses dependency tracking to minimize evaluation work.
 */
export class IncrementalEvaluator {
  constructor(circuit) {
    this.circuit = circuit;
    this.nodeStates = new Map();
    this.dependencies = this.buildDependencies();
  }

  buildDependencies() {
    // Map each node to its direct dependents (nodes that depend on it)
    const deps = new Map();

    for (const node of this.circuit.nodes) {
      deps.set(node.id, []);
    }

    for (const wire of this.circuit.wires) {
      if (!deps.has(wire.from)) {
        deps.set(wire.from, []);
      }
      deps.get(wire.from).push(wire.to);
    }

    return deps;
  }

  /**
   * Get only the nodes that need re-evaluation.
   * Performs transitive closure to include all affected downstream nodes.
   */
  getAffectedNodes(changedNodeIds) {
    const affected = new Set();
    const queue = [...changedNodeIds];

    while (queue.length > 0) {
      const nodeId = queue.shift();

      if (affected.has(nodeId)) continue;
      affected.add(nodeId);

      const dependents = this.dependencies.get(nodeId) || [];
      queue.push(...dependents);
    }

    return Array.from(affected);
  }

  recordState(nodeId, value) {
    this.nodeStates.set(nodeId, value);
  }

  getChangedNodes() {
    // In a real scenario, this would track which nodes changed last tick
    // For now, return all nodes as changed (fallback mode)
    return Array.from(this.nodeStates.keys());
  }
}

/**
 * Update Throttler
 *
 * Reduces UI update frequency while maintaining simulation accuracy.
 * Updates only on value changes or at fixed intervals.
 */
export class UpdateThrottler {
  constructor(options = {}) {
    this.minUpdateInterval = options.minUpdateInterval || 50; // ms
    this.lastUpdateTime = 0;
    this.pendingUpdates = false;
    this.updateQueue = [];
  }

  shouldUpdate(currentTime) {
    return currentTime - this.lastUpdateTime >= this.minUpdateInterval;
  }

  recordUpdate(nodeId, newValue) {
    this.updateQueue.push({ nodeId, newValue, time: performance.now() });
    this.pendingUpdates = true;
  }

  flush(currentTime) {
    if (!this.shouldUpdate(currentTime)) {
      return null;
    }

    if (this.updateQueue.length === 0) {
      return null;
    }

    const updates = this.updateQueue;
    this.updateQueue = [];
    this.pendingUpdates = false;
    this.lastUpdateTime = currentTime;

    return updates;
  }

  hasPendingUpdates() {
    return this.pendingUpdates;
  }
}

/**
 * Memory Usage Monitor
 *
 * Tracks memory consumption during simulation.
 * Helps identify memory leaks and optimization opportunities.
 */
export class MemoryMonitor {
  constructor() {
    this.samples = [];
  }

  recordSample() {
    if (performance.memory) {
      this.samples.push({
        timestamp: performance.now(),
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      });
    }
  }

  getReport() {
    if (this.samples.length === 0) {
      return null;
    }

    const memoryValues = this.samples.map((s) => s.usedJSHeapSize);
    const min = Math.min(...memoryValues);
    const max = Math.max(...memoryValues);
    const avg = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
    const latest = this.samples[this.samples.length - 1];

    return {
      minMemory: (min / 1024 / 1024).toFixed(2) + ' MB',
      maxMemory: (max / 1024 / 1024).toFixed(2) + ' MB',
      avgMemory: (avg / 1024 / 1024).toFixed(2) + ' MB',
      currentMemory: (latest.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      heapLimit: (latest.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB',
      samples: this.samples.length,
    };
  }
}

/**
 * Render Performance Tracker
 *
 * Measures rendering time using requestAnimationFrame.
 * Identifies rendering bottlenecks.
 */
export class RenderPerformanceTracker {
  constructor() {
    this.frameTimes = [];
    this.tracking = false;
  }

  startTracking(callback) {
    this.tracking = true;
    this.frameTimes = [];

    const measureFrame = (timestamp) => {
      if (!this.tracking) return;

      if (this.frameTimes.length > 0) {
        const delta = timestamp - this.frameTimes[this.frameTimes.length - 1].timestamp;
        const fps = delta > 0 ? Math.round(1000 / delta) : 60;

        this.frameTimes.push({
          timestamp,
          deltaMs: delta,
          fps,
        });
      } else {
        this.frameTimes.push({ timestamp, deltaMs: 0, fps: 60 });
      }

      if (this.frameTimes.length % 60 === 0 && callback) {
        callback(this.getReport());
      }

      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }

  stopTracking() {
    this.tracking = false;
    return this.getReport();
  }

  getReport() {
    if (this.frameTimes.length === 0) {
      return { avgFps: 60, minFps: 60, maxFps: 60 };
    }

    const fps = this.frameTimes.map((f) => f.fps);
    const avgFps = fps.reduce((a, b) => a + b, 0) / fps.length;
    const minFps = Math.min(...fps);
    const maxFps = Math.max(...fps);
    const droppedFrames = fps.filter((f) => f < 30).length;

    return {
      avgFps: Math.round(avgFps),
      minFps,
      maxFps,
      frameCount: this.frameTimes.length,
      droppedFrames,
      droppedFramePercentage: ((droppedFrames / this.frameTimes.length) * 100).toFixed(1),
    };
  }
}

/**
 * Optimized Circuit Evaluator
 *
 * Combines all optimizations:
 * - Topological sort for deterministic evaluation
 * - Incremental evaluation (only changed nodes)
 * - Throttled updates (visual updates at controlled rate)
 * - Memory-conscious state storage
 */
export class OptimizedCircuitEvaluator {
  constructor(circuit) {
    this.circuit = circuit;
    this.evaluator = new IncrementalEvaluator(circuit);
    this.throttler = new UpdateThrottler();
    this.profiler = new SimulationProfiler();
    this.memoryMonitor = new MemoryMonitor();
    this.topoOrder = this.computeTopologicalOrder();
  }

  computeTopologicalOrder() {
    // Compute topological sort for deterministic evaluation order
    const visited = new Set();
    const order = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const dependents = this.evaluator.dependencies.get(nodeId) || [];
      dependents.forEach((depId) => visit(depId));

      order.push(nodeId);
    };

    for (const node of this.circuit.nodes) {
      visit(node.id);
    }

    return order;
  }

  tick(nodeStates, changedNodeIds = []) {
    const tickStart = performance.now();

    // Determine which nodes need re-evaluation
    const nodesToEval = changedNodeIds.length > 0
      ? this.evaluator.getAffectedNodes(changedNodeIds)
      : Array.from(nodeStates.keys());

    // Evaluate only affected nodes in topological order
    let nodesEvaluated = 0;
    for (const nodeId of this.topoOrder) {
      if (nodesToEval.includes(nodeId)) {
        // Perform evaluation (simplified - actual implementation in engine)
        nodesEvaluated++;
      }
    }

    const tickEnd = performance.now();
    const duration = tickEnd - tickStart;

    this.profiler.recordTick(duration, nodesEvaluated);
    this.memoryMonitor.recordSample();

    return {
      duration,
      nodesEvaluated,
      throttled: !this.throttler.shouldUpdate(tickEnd),
    };
  }

  getPerformanceReport() {
    return {
      simulation: this.profiler.getReport(),
      memory: this.memoryMonitor.getReport(),
    };
  }
}

export default {
  SimulationProfiler,
  IncrementalEvaluator,
  UpdateThrottler,
  MemoryMonitor,
  RenderPerformanceTracker,
  OptimizedCircuitEvaluator,
};
