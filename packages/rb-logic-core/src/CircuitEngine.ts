// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection, Node, NodeInputs, PortRef, Signal } from './types';
import { NodeRegistry } from './NodeRegistry';

function normalizeConnection(conn: Connection): { from: PortRef; to: PortRef } {
  const fromIsString = typeof conn.from === 'string';
  const toIsString = typeof conn.to === 'string';

  const fromNodeId = fromIsString ? conn.from : conn.from.nodeId;
  const toNodeId = toIsString ? conn.to : conn.to.nodeId;

  const fromPortName = fromIsString
    ? conn.fromPin ?? conn.fromPort ?? 'out'
    : conn.from.portName ?? conn.from.port ?? conn.fromPin ?? conn.fromPort ?? 'out';

  const toPortName = toIsString
    ? conn.toPin ?? conn.toPort ?? 'in'
    : conn.to.portName ?? conn.to.port ?? conn.toPin ?? conn.toPort ?? 'in';

  return {
    from: { nodeId: fromNodeId, portName: fromPortName },
    to: { nodeId: toNodeId, portName: toPortName },
  };
}

export interface CircuitEngineOptions {
  debug?: boolean;
}

export type SimulationIssueCode = 'COMBINATIONAL_LOOP';

export interface SimulationIssue {
  code: SimulationIssueCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Circuit evaluation engine
 * Handles signal propagation through the circuit graph
 */
export class CircuitEngine {
  private circuit: Circuit;
  private nodeStates: Map<string, Record<string, any>>;
  private signalCache: Map<string, Signal>;
  private debug: boolean;
  private lastIssue: SimulationIssue | null;

  constructor(circuit: Circuit, options: CircuitEngineOptions = {}) {
    this.debug = options.debug ?? false;
    this.circuit = { nodes: [], connections: [] };
    this.nodeStates = new Map();
    this.signalCache = new Map();
    this.lastIssue = null;
    this.setCircuit(circuit);
  }

  /**
   * Toggle debug logging
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * Get current circuit
   */
  getCircuit(): Circuit {
    return this.circuit;
  }

  /**
   * Update circuit and reset cached state/signals
   */
  setCircuit(circuit: Circuit): void {
    const safeCircuit: Circuit = {
      nodes: Array.isArray(circuit.nodes) ? circuit.nodes : [],
      connections: Array.isArray(circuit.connections) ? circuit.connections : [],
    };

    this.circuit = safeCircuit;
    this.nodeStates = new Map();
    this.signalCache = new Map();

    for (const node of safeCircuit.nodes) {
      const state = node.state ? { ...node.state } : {};
      this.nodeStates.set(node.id, state);
    }
  }

  /**
   * Get the most recent simulation issue (if any).
   *
   * Issues are best-effort diagnostics intended for UI messaging (student-friendly warnings)
   * and for preventing non-terminating stabilization loops.
   */
  getLastIssue(): SimulationIssue | null {
    return this.lastIssue ? { ...this.lastIssue } : null;
  }

  clearLastIssue(): void {
    this.lastIssue = null;
  }

  private setIssue(issue: SimulationIssue): void {
    this.lastIssue = issue;
  }

  private detectCombinationalLoop(): { hasLoop: boolean; cycleNodeIds?: string[] } {
    // Memory/delay elements break combinational feedback loops.
    const memoryTypes = new Set(['Delay', 'DFlipFlop', 'JKFlipFlop', 'RSLatch', 'Counter4Bit']);

    const nodesById = new Map<string, Node>();
    for (const node of this.circuit.nodes) nodesById.set(node.id, node);

    const edges = new Map<string, Set<string>>();
    for (const node of this.circuit.nodes) edges.set(node.id, new Set());

    for (const conn of this.circuit.connections) {
      const normalized = normalizeConnection(conn);
      const fromNode = nodesById.get(normalized.from.nodeId);
      if (!fromNode) continue;
      if (memoryTypes.has(fromNode.type)) continue;
      edges.get(fromNode.id)?.add(normalized.to.nodeId);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const parent = new Map<string, string>();

    const buildCycle = (start: string, end: string): string[] => {
      const cycle: string[] = [end];
      let cur = start;
      while (cur !== end && parent.has(cur)) {
        cycle.push(cur);
        cur = parent.get(cur)!;
      }
      cycle.push(end);
      cycle.reverse();
      return cycle;
    };

    const dfs = (id: string): string[] | null => {
      visited.add(id);
      inStack.add(id);

      for (const to of edges.get(id) ?? []) {
        if (!visited.has(to)) {
          parent.set(to, id);
          const cycle = dfs(to);
          if (cycle) return cycle;
        } else if (inStack.has(to)) {
          // Found back edge -> cycle
          parent.set(to, id);
          return buildCycle(id, to);
        }
      }

      inStack.delete(id);
      return null;
    };

    for (const node of this.circuit.nodes) {
      if (visited.has(node.id)) continue;
      const cycle = dfs(node.id);
      if (cycle) return { hasLoop: true, cycleNodeIds: cycle };
    }

    return { hasLoop: false };
  }

  /**
   * Get node state (copy)
   */
  getNodeState(nodeId: string): Record<string, any> | undefined {
    const state = this.nodeStates.get(nodeId);
    return state ? { ...state } : undefined;
  }

  /**
   * Set node state
   */
  setNodeState(nodeId: string, state: Record<string, any>): void {
    this.nodeStates.set(nodeId, { ...state });
  }

  /**
   * Update node position (in-place)
   * This allows "Live Edit" without resetting the simulation state.
   */
  updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    const node = this.circuit.nodes.find((n) => n.id === nodeId);
    if (node) {
      // Modify in place to preserve reference if needed, 
      // but strictly we should probably treat circuit as immutable if possible.
      // However, for performance in live edit, direct mutation of the cached circuit is acceptable
      // as long as we don't need history undo/redo here (that's handled by the store/host).
      node.position = position;
    }
  }

  /**
   * Build inputs for a node by finding all connections to it
   */
  private buildNodeInputs(
    nodeId: string,
    fallbackSignals?: Map<string, Signal>,
    missingSignals?: Set<string>
  ): NodeInputs {
    const inputs: NodeInputs = {};

    for (const conn of this.circuit.connections) {
      const normalized = normalizeConnection(conn);
      if (normalized.to.nodeId === nodeId) {
        const key = `${normalized.from.nodeId}.${normalized.from.portName}`;
        const cached = this.signalCache.get(key);
        const fallback = fallbackSignals?.get(key);
        let value: Signal | undefined;

        if (cached !== undefined && !Number.isNaN(cached)) {
          value = cached;
        } else if (fallback !== undefined && !Number.isNaN(fallback)) {
          value = fallback;
        } else {
          value = 0;
          if (this.debug) {
            missingSignals?.add(key);
          }
        }

        inputs[normalized.to.portName] = value;
      }
    }

    return inputs;
  }

  /**
   * Execute one tick of the simulation in topological order
   * Returns true if any state changed
   */
  tick(): boolean {
    this.clearLastIssue();
    const loop = this.detectCombinationalLoop();
    if (loop.hasLoop) {
      this.setIssue({
        code: 'COMBINATIONAL_LOOP',
        message: 'Feedback loop detected — add a Delay or clocked element to break the loop.',
        details: { cycleNodeIds: loop.cycleNodeIds ?? [] },
      });
    }

    const previousSignals = new Map(this.signalCache);
    this.signalCache.clear();
    const missingSignals = new Set<string>();

    const nodesToEval = this.topologicalSort();

    for (const node of nodesToEval) {
      const behavior = NodeRegistry.get(node.type);
      if (!behavior) {
        if (this.debug) {
          // eslint-disable-next-line no-console
          console.warn(`[CircuitEngine] Missing behavior for node type: ${node.type}`);
        }
        continue;
      }

      const inputs = this.buildNodeInputs(node.id, previousSignals, missingSignals);
      const state = this.nodeStates.get(node.id) ?? {};
      const result = behavior.evaluate(inputs, state, node.config ?? {}, node);
      const outputs = result.outputs ?? {};

      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log(`[CircuitEngine] ${node.id} (${node.type}) inputs`, inputs);
        // eslint-disable-next-line no-console
        console.log(`[CircuitEngine] ${node.id} outputs`, outputs);
      }

      this.nodeStates.set(node.id, result.state ?? {});

      for (const [port, value] of Object.entries(outputs)) {
        if (typeof value === 'number' && Number.isNaN(value)) {
          if (this.debug) {
            missingSignals.add(`${node.id}.${port}`);
          }
          this.signalCache.set(`${node.id}.${port}`, 0);
        } else {
          this.signalCache.set(`${node.id}.${port}`, value);
        }
      }
    }

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('[CircuitEngine] tick signals', Array.from(this.signalCache.entries()));
      if (missingSignals.size > 0) {
        // eslint-disable-next-line no-console
        console.info('[CircuitEngine] Missing or invalid signals defaulted to 0:', Array.from(missingSignals));
      }
    }

    if (previousSignals.size !== this.signalCache.size) {
      return true;
    }

    for (const [key, value] of this.signalCache.entries()) {
      if (previousSignals.get(key) !== value) {
        return true;
      }
    }

    return false;
  }

  /**
   * Topological sort of nodes (simple forward pass, assumes no cycles)
   */
  private topologicalSort(): Node[] {
    const nodes = this.circuit.nodes;
    const edges: Map<string, Set<string>> = new Map();
    const inDegree: Map<string, number> = new Map();

    for (const node of nodes) {
      edges.set(node.id, new Set());
      inDegree.set(node.id, 0);
    }

    for (const conn of this.circuit.connections) {
      const normalized = normalizeConnection(conn);
      edges.get(normalized.from.nodeId)?.add(normalized.to.nodeId);
      inDegree.set(normalized.to.nodeId, (inDegree.get(normalized.to.nodeId) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const sorted: Node[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      const node = nodes.find(n => n.id === id);
      if (node) sorted.push(node);
      for (const to of edges.get(id) ?? []) {
        inDegree.set(to, (inDegree.get(to) ?? 1) - 1);
        if (inDegree.get(to) === 0) queue.push(to);
      }
    }

    if (sorted.length < nodes.length) {
      const sortedIds = new Set(sorted.map(n => n.id));
      for (const node of nodes) {
        if (!sortedIds.has(node.id)) {
          sorted.push(node);
        }
      }
    }

    return sorted;
  }

  /**
   * Run simulation until stable (or max iterations)
   */
  stabilize(maxIterations = 100): number {
    this.clearLastIssue();
    const loop = this.detectCombinationalLoop();
    if (loop.hasLoop) {
      this.setIssue({
        code: 'COMBINATIONAL_LOOP',
        message: 'Feedback loop detected — add a Delay or clocked element to break the loop.',
        details: { cycleNodeIds: loop.cycleNodeIds ?? [] },
      });
    }

    let iterations = 0;
    let changedLast = false;
    while (iterations < maxIterations) {
      iterations++;
      const changed = this.tick();
      changedLast = changed;
      if (!changed) break;
    }

    if (iterations >= maxIterations && changedLast) {
      this.setIssue({
        code: 'COMBINATIONAL_LOOP',
        message: 'Feedback loop detected — add a Delay or clocked element to break the loop.',
        details: { maxIterations },
      });
    }
    return iterations;
  }

  /**
   * Get all current signal values
   */
  getAllSignals(): Map<string, Signal> {
    return new Map(this.signalCache);
  }

  /**
   * Get all outputs for a specific node from the cache
   */
  getNodeOutputs(nodeId: string): Record<string, Signal> {
    const outputs: Record<string, Signal> = {};
    const prefix = `${nodeId}.`;

    for (const [key, value] of this.signalCache.entries()) {
      if (key.startsWith(prefix)) {
        outputs[key.slice(prefix.length)] = value;
      }
    }

    return outputs;
  }
}
