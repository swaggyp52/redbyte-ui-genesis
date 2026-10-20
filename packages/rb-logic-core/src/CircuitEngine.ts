// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection, Node, NodeInputs, NodeOutputs, PortRef, Signal } from './types';
import { NodeRegistry } from './NodeRegistry';
import type { EngineEvaluationObservation, EngineTickObservationOptions, EvaluationInputRead } from './observation';
import { isClockCaptureNodeType, canSettleAfterClockCapture } from './clockCapture';
import { readClockedStateOutputs } from './builtins';

function normalizeConnection(conn: Connection): { from: PortRef; to: PortRef } {
  const fromIsString = typeof conn.from === 'string';
  const toIsString = typeof conn.to === 'string';

  const fromNodeId = fromIsString ? conn.from as string : (conn.from as PortRef).nodeId;
  const toNodeId = toIsString ? conn.to as string : (conn.to as PortRef).nodeId;

  const fromPortName = fromIsString
    ? (conn as any).fromPin ?? (conn as any).fromPort ?? 'out'
    : (conn.from as PortRef).portName ?? (conn.from as PortRef).port ?? (conn as any).fromPin ?? (conn as any).fromPort ?? 'out';

  const toPortName = toIsString
    ? (conn as any).toPin ?? (conn as any).toPort ?? 'in'
    : (conn.to as PortRef).portName ?? (conn.to as PortRef).port ?? (conn as any).toPin ?? (conn as any).toPort ?? 'in';

  return {
    from: { nodeId: fromNodeId, portName: fromPortName },
    to: { nodeId: toNodeId, portName: toPortName },
  };
}

function validateCircuitShape(circuit: Circuit): void {
  const errors: string[] = [];
  const nodes = Array.isArray(circuit.nodes) ? circuit.nodes : [];
  const connections = Array.isArray(circuit.connections) ? circuit.connections : [];

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || node.id.trim().length === 0) {
      errors.push('Node missing valid id');
      continue;
    }
    nodeIds.add(node.id);
    if (typeof node.type !== 'string' || node.type.trim().length === 0) {
      errors.push(`Node ${node.id} missing valid type`);
    }
    if (node.position) {
      const { x, y } = node.position;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        errors.push(`Node ${node.id} has invalid position`);
      }
    }
  }

  for (const conn of connections) {
    const normalized = normalizeConnection(conn);
    if (!nodeIds.has(normalized.from.nodeId)) {
      errors.push(`Connection from missing node: ${normalized.from.nodeId}`);
    }
    if (!nodeIds.has(normalized.to.nodeId)) {
      errors.push(`Connection to missing node: ${normalized.to.nodeId}`);
    }
    if (!normalized.from.portName || !normalized.to.portName) {
      errors.push('Connection missing port name');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Circuit validation failed:\n- ${errors.join('\n- ')}`);
  }
}

export interface CircuitEngineOptions {
  debug?: boolean;
  /** Includes the constructor's real initial evaluation when explicitly requested. */
  observation?: EngineTickObservationOptions;
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
    this.setCircuit(circuit, options.observation);
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
  setCircuit(circuit: Circuit, observation?: EngineTickObservationOptions): void {
    validateCircuitShape(circuit);
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

    // Propagate initial signals so getAllSignals() is immediately valid.
    // Without this, the signal cache is empty after setCircuit until the
    // first tick(), causing stale reads in UI and tests.
    if (safeCircuit.nodes.length > 0) {
      this.tick(observation);
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
    const memoryTypes = new Set(['Delay', 'DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'RSLatch', 'Counter4Bit']);

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
    missingSignals?: Set<string>,
    inputReads?: EvaluationInputRead[],
    priorStateSignals?: ReadonlySet<string>
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
        if (inputReads) inputReads.push({
          portName: normalized.to.portName,
          driver: { ...normalized.from },
          value,
          ...(fallback !== undefined ? { previousValue: fallback } : {}),
          origin: priorStateSignals?.has(key) ? 'prior-state'
            : cached !== undefined && !Number.isNaN(cached)
            ? 'current-evaluation'
            : fallback !== undefined && !Number.isNaN(fallback)
              ? 'previous-tick' : 'default-zero',
        });
      }
    }

    return inputs;
  }

  /**
   * Execute one tick of the simulation in topological order
   * Returns true if any state changed
   */
  tick(observation?: EngineTickObservationOptions): boolean {
    this.clearLastIssue();
    const loop = this.detectCombinationalLoop();
    if (loop.hasLoop) {
      this.setIssue({
        code: 'COMBINATIONAL_LOOP',
        message: 'Feedback loop detected — add a Delay or clocked element to break the loop.',
        details: { cycleNodeIds: loop.cycleNodeIds ?? [] },
      });
      if (observation?.onIssue) {
        try {
          observation.onIssue(structuredClone(this.lastIssue!));
        } catch {
          this.reportObservationError(observation);
        }
      }
    }

    const previousSignals = new Map(this.signalCache);
    this.signalCache.clear();
    const missingSignals = new Set<string>();

    const clockedNodes = this.circuit.nodes.filter(node => isClockCaptureNodeType(node.type));
    const clockedNodeIds = new Set(clockedNodes.map(node => node.id));
    const priorStateSignals = clockedNodes.length > 0 ? new Set<string>() : undefined;
    for (const node of clockedNodes) {
      const heldOutputs = readClockedStateOutputs(node.type, this.nodeStates.get(node.id) ?? {}, node.config ?? {});
      for (const [port, value] of Object.entries(heldOutputs)) {
        const key = `${node.id}.${port}`;
        this.signalCache.set(key, value);
        priorStateSignals!.add(key);
      }
    }
    const nodesToEval = this.topologicalSort(clockedNodeIds);
    const pending: Array<{
      nodeId: string;
      state: Record<string, unknown>;
      outputs: NodeOutputs;
    }> = [];

    const publish = (nodeId: string, state: Record<string, unknown>, outputs: NodeOutputs) => {
      this.nodeStates.set(nodeId, state);
      for (const [port, value] of Object.entries(outputs)) {
        if (typeof value === 'number' && Number.isNaN(value)) {
          if (this.debug) missingSignals.add(`${nodeId}.${port}`);
          this.signalCache.set(`${nodeId}.${port}`, 0);
        } else {
          this.signalCache.set(`${nodeId}.${port}`, value);
        }
      }
    };
    const emit = (event: EngineEvaluationObservation) => {
      try { observation!.observe(event); } catch { this.reportObservationError(observation!); }
    };
    const evaluate = (node: Node, order: number, evaluationPhase: EngineEvaluationObservation['evaluationPhase'], deferCommit = false) => {
      const behavior = NodeRegistry.get(node.type);
      if (!behavior) {
        if (this.debug) {
          // eslint-disable-next-line no-console
          console.warn(`[CircuitEngine] Missing behavior for node type: ${node.type}`);
        }
        return;
      }

      let observing = Boolean(observation);
      if (observing && observation?.isEnabled) {
        try {
          observing = observation.isEnabled();
        } catch {
          observing = false;
          this.reportObservationError(observation);
        }
      }
      const inputReads = observing ? [] as EvaluationInputRead[] : undefined;
      const inputs = this.buildNodeInputs(node.id, previousSignals, missingSignals, inputReads, priorStateSignals);
      const state = this.nodeStates.get(node.id) ?? {};
      const inputsBefore = observing ? { ...inputs } : undefined;
      let stateBefore: Record<string, unknown> | undefined;
      if (observing) {
        try {
          stateBefore = structuredClone(state);
        } catch {
          observing = false;
          this.reportObservationError(observation!);
        }
      }
      const result = behavior.evaluate(inputs, state, node.config ?? {}, node);
      const outputs = result.outputs ?? {};

      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log(`[CircuitEngine] ${node.id} (${node.type}) inputs`, inputs);
        // eslint-disable-next-line no-console
        console.log(`[CircuitEngine] ${node.id} outputs`, outputs);
      }

      if (!deferCommit) publish(node.id, result.state ?? {}, outputs);
      let event: EngineEvaluationObservation | undefined;
      if (observing && observation) {
        try {
          const previousOutputs: NodeOutputs = {};
          const prefix = `${node.id}.`;
          for (const [key, previous] of previousSignals) {
            if (key.startsWith(prefix)) previousOutputs[key.slice(prefix.length)] = previous;
          }
          event = {
            order,
            evaluationOrder: order,
            evaluationPhase,
            commitPhase: deferCommit ? 'after-capture' : 'immediate',
            nodeId: node.id,
            nodeType: node.type,
            context: { ...observation.context },
            inputs: inputsBefore!,
            inputReads: inputReads!,
            previousOutputs,
            outputs: Object.fromEntries(Object.entries(outputs).map(([port, value]) =>
              [port, typeof value === 'number' && Number.isNaN(value) ? 0 : value])),
            rawOutputs: { ...outputs },
            invalidOutputPorts: Object.keys(outputs).filter(port =>
              typeof outputs[port] === 'number' && Number.isNaN(outputs[port])),
            stateBefore: stateBefore!,
            stateAfter: structuredClone(result.state ?? {}),
          };
        } catch {
          this.reportObservationError(observation);
        }
      }
      if (deferCommit) pending.push({ nodeId: node.id, state: result.state ?? {}, outputs });
      if (event) emit(event);
    };

    let order = 0;
    if (clockedNodes.length === 0) {
      for (const node of nodesToEval) evaluate(node, order++, 'evaluate');
    } else {
      // Present new external inputs and compute D/EN/reset cones from held Q.
      for (const node of nodesToEval) {
        if (!clockedNodeIds.has(node.id)) evaluate(node, order++, 'before-capture');
      }
      // Every native device reads the same pre-commit signal/state boundary.
      for (const node of nodesToEval) {
        if (clockedNodeIds.has(node.id)) evaluate(node, order++, 'capture', true);
      }
      for (const entry of pending) publish(entry.nodeId, entry.state, entry.outputs);
      priorStateSignals!.clear();
      // Final samples observe committed Q. Never advance temporal devices again.
      for (const node of nodesToEval) {
        if (canSettleAfterClockCapture(node.type)) evaluate(node, order++, 'after-capture');
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

  private reportObservationError(observation: EngineTickObservationOptions): void {
    // Observation failure must never affect state, samples, or the tick result.
    try { observation.onError?.(); } catch { /* A failing observer is isolated. */ }
  }

  /**
   * Structural dependency preview, source → sink. Actual clock capture and
   * settling invocations are recorded by tick observation, not this ID list.
   */
  getEvaluationOrder(): string[] {
    return this.topologicalSort().map((n) => n.id);
  }

  /**
   * Topological sort of nodes (simple forward pass, assumes no cycles)
   */
  topologicalSort(stateBoundaryNodeIds: ReadonlySet<string> = new Set()): Node[] {
    const nodes = this.circuit.nodes;
    const edges: Map<string, Set<string>> = new Map();
    const inDegree: Map<string, number> = new Map();

    for (const node of nodes) {
      edges.set(node.id, new Set());
      inDegree.set(node.id, 0);
    }

    for (const conn of this.circuit.connections) {
      const normalized = normalizeConnection(conn);
      if (stateBoundaryNodeIds.has(normalized.from.nodeId)) continue;
      const targets = edges.get(normalized.from.nodeId);
      // Dependency order is per source/target pair, even when the source drives
      // several input ports. Match the Set edge count used by the dequeue pass.
      if (targets && !targets.has(normalized.to.nodeId)) {
        targets.add(normalized.to.nodeId);
        inDegree.set(normalized.to.nodeId, (inDegree.get(normalized.to.nodeId) ?? 0) + 1);
      }
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

  /**
   * Get a single output signal value for a node (wrapper for verifyBoardIO compatibility)
   */
  getNodeValue(nodeId: string, portName = 'out'): Signal {
    return this.signalCache.get(`${nodeId}.${portName}`) ?? 0;
  }

  /**
   * Set a node's input value (for INPUT/SWITCH nodes) before simulation
   */
  setNodeValue(nodeId: string, value: Signal): void {
    const state = this.nodeStates.get(nodeId) ?? {};
    state.isOn = value;
    this.nodeStates.set(nodeId, state);
  }
}
