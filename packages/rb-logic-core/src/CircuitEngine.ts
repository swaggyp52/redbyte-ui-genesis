// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection, Node, NodeInputs, NodeOutputs, PortRef, Signal } from './types';
import { NodeRegistry } from './NodeRegistry';
import type { EngineEvaluationObservation, EngineTickObservationOptions, EvaluationInputRead } from './observation';
import { isClockCaptureNodeType, canSettleAfterClockCapture } from './clockCapture';
import { readClockedStateOutputs } from './builtins';
import { compareText } from './ir/simulationModel';

/**
 * Strongly connected components (Tarjan, iterative so a long chain cannot exhaust the call
 * stack). Members are returned in codepoint id order; component order is not meaningful.
 */
function stronglyConnectedComponents(successors: ReadonlyMap<string, ReadonlySet<string>>): string[][] {
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;
  for (const root of successors.keys()) {
    if (index.has(root)) continue;
    const frames: Array<{ id: string; next: Iterator<string> }> = [];
    const enter = (id: string) => {
      index.set(id, counter);
      lowLink.set(id, counter);
      counter += 1;
      stack.push(id);
      onStack.add(id);
      frames.push({ id, next: (successors.get(id) ?? new Set<string>()).values() });
    };
    enter(root);
    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      const step = frame.next.next();
      if (!step.done) {
        if (!index.has(step.value)) enter(step.value);
        else if (onStack.has(step.value)) lowLink.set(frame.id, Math.min(lowLink.get(frame.id)!, index.get(step.value)!));
        continue;
      }
      frames.pop();
      if (lowLink.get(frame.id) === index.get(frame.id)) {
        const component: string[] = [];
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.id);
        components.push(component.sort(compareText));
      }
      if (frames.length > 0) {
        const parent = frames[frames.length - 1].id;
        lowLink.set(parent, Math.min(lowLink.get(parent)!, lowLink.get(frame.id)!));
      }
    }
  }
  return components;
}

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
   * Evaluation order, source -> sink, independent of node-array and connection order.
   *
   * Edges leaving a state-boundary node are excluded: clock-capture devices publish their
   * held Q before anything evaluates (tick, above). Feedback can remain through elements
   * that publish only when they are evaluated (Delay, DLatch, RSLatch, plain gates). Inside
   * such a cycle the node evaluated first reads its in-cycle drivers' previous-tick values,
   * so the order inside the cycle decides the values a tick publishes. Each cycle is one
   * strongly connected component: components run in Kahn order (first in, first out, as
   * before), each newly ready batch in codepoint order of the component's smallest id, and a
   * multi-node component's members in codepoint id order. Every node downstream of a cycle
   * therefore follows the whole cycle. An acyclic circuit in codec order (ids and
   * connections sorted) keeps its previous evaluation order.
   */
  topologicalSort(stateBoundaryNodeIds: ReadonlySet<string> = new Set()): Node[] {
    const nodeById = new Map<string, Node>();
    for (const node of this.circuit.nodes) {
      // The first node carrying an id evaluates for that id, as before.
      if (!nodeById.has(node.id)) nodeById.set(node.id, node);
    }

    // Dependency order is per source/target pair, even when the source drives
    // several input ports.
    const successors = new Map<string, Set<string>>();
    for (const id of nodeById.keys()) successors.set(id, new Set());
    for (const conn of this.circuit.connections) {
      const normalized = normalizeConnection(conn);
      if (stateBoundaryNodeIds.has(normalized.from.nodeId)) continue;
      if (!nodeById.has(normalized.to.nodeId)) continue;
      successors.get(normalized.from.nodeId)?.add(normalized.to.nodeId);
    }

    const components = stronglyConnectedComponents(successors);
    const componentOf = new Map<string, number>();
    components.forEach((members, component) => {
      for (const id of members) componentOf.set(id, component);
    });
    const componentSuccessors = components.map(() => new Set<number>());
    const inDegree = components.map(() => 0);
    for (const [from, targets] of successors) {
      const source = componentOf.get(from)!;
      for (const to of targets) {
        const target = componentOf.get(to)!;
        if (target === source || componentSuccessors[source].has(target)) continue;
        componentSuccessors[source].add(target);
        inDegree[target] += 1;
      }
    }

    const byLeadId = (left: number, right: number) => compareText(components[left][0], components[right][0]);
    const queue = components.map((_members, component) => component)
      .filter(component => inDegree[component] === 0)
      .sort(byLeadId);
    const sorted: Node[] = [];
    for (let head = 0; head < queue.length; head += 1) {
      const component = queue[head];
      for (const id of components[component]) sorted.push(nodeById.get(id)!);
      const ready: number[] = [];
      for (const target of componentSuccessors[component]) {
        inDegree[target] -= 1;
        if (inDegree[target] === 0) ready.push(target);
      }
      queue.push(...ready.sort(byLeadId));
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
