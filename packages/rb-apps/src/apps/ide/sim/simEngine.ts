import { CircuitEngine } from '@redbyte/rb-logic-core';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { digestValue } from '../../../utils/digest';
import type {
  RuntimeSimState,
  RuntimeSimTraceSample,
  RuntimeVerifyTraceRow,
  SimulatedExpectedIoRow,
  SimulationIoRow,
} from './simTypes';

export const DEFAULT_SIM_SPEED_HZ = 12;
const SIM_TRACE_CAPACITY = 256;

let runtimeSimEngine: CircuitEngine | null = null;
let runtimeSimIrHash = '';

export function resetSimulationState(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  previous?: RuntimeSimState
): RuntimeSimState {
  const irHash = computeSimIrHash(circuit);
  const inputs = deriveSimulationInputs(circuit, previous?.inputs);
  const resetNodeId = resolveResetNodeId(ioRows, circuit);
  if (resetNodeId) {
    inputs[resetNodeId] = 1;
  }
  runtimeSimEngine = new CircuitEngine(cloneCircuit(circuit));
  runtimeSimIrHash = irHash;
  applyInputsToEngine(runtimeSimEngine, inputs);
  runtimeSimEngine.tick();
  if (resetNodeId) {
    inputs[resetNodeId] = 0;
    applyInputsToEngine(runtimeSimEngine, inputs);
    runtimeSimEngine.tick();
  }
  const signals = normalizeSignalMap(runtimeSimEngine, circuit);
  return {
    tick: 0,
    running: false,
    lastAction: previous?.lastAction,
    speedHz: previous?.speedHz ?? DEFAULT_SIM_SPEED_HZ,
    irHash,
    traceHash: computeTraceHash(irHash, []),
    inputs,
    signals,
    trace: [],
    selectedSignalKey: previous?.selectedSignalKey ?? null,
    probes: previous?.probes ? [...previous.probes] : [],
  };
}

export function advanceSimulationState(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  sim: RuntimeSimState,
  requestedTicks: number
): RuntimeSimState {
  const ticks = Math.max(0, Math.min(1024, Math.floor(requestedTicks)));
  if (ticks === 0) {
    return sim;
  }
  const irHash = computeSimIrHash(circuit);
  if (!runtimeSimEngine || runtimeSimIrHash !== irHash) {
    return resetSimulationState(circuit, ioRows, sim);
  }
  const engine = runtimeSimEngine;
  applyInputsToEngine(engine, sim.inputs);
  let tick = sim.tick;
  let trace = [...sim.trace];
  for (let index = 0; index < ticks; index += 1) {
    engine.tick();
    tick += 1;
    trace.push({
      tick,
      signals: normalizeSignalMap(engine, circuit),
    });
  }
  if (trace.length > SIM_TRACE_CAPACITY) {
    trace = trace.slice(trace.length - SIM_TRACE_CAPACITY);
  }
  const signals = normalizeSignalMap(engine, circuit);
  return {
    ...sim,
    running: sim.running,
    tick,
    irHash,
    signals,
    trace,
    traceHash: computeTraceHash(irHash, trace),
  };
}

export function recomputeSimulationState(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  sim: RuntimeSimState
): RuntimeSimState {
  const irHash = computeSimIrHash(circuit);
  if (!runtimeSimEngine || runtimeSimIrHash !== irHash) {
    return resetSimulationState(circuit, ioRows, sim);
  }
  const engine = runtimeSimEngine;
  applyInputsToEngine(engine, sim.inputs);
  engine.tick();
  const signals = normalizeSignalMap(engine, circuit);
  return {
    ...sim,
    running: sim.running,
    irHash,
    signals,
    traceHash: computeTraceHash(irHash, sim.trace),
  };
}

export function buildVerifyRowsFromRuntimeTrace(
  vectors: TestVector[],
  ioRows: SimulationIoRow[],
  sim: RuntimeSimState
): RuntimeVerifyTraceRow[] {
  if (vectors.length === 0 || sim.trace.length === 0) {
    return [];
  }
  const traceByTick = new Map<number, RuntimeSimTraceSample>();
  for (const entry of sim.trace) {
    traceByTick.set(entry.tick, entry);
  }
  const outputRows = ioRows.filter((row) => row.direction === 'out');
  const rows: RuntimeVerifyTraceRow[] = [];
  for (const vector of vectors) {
    const tick = Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : 0;
    const sample = traceByTick.get(tick);
    for (const outputRow of outputRows) {
      const expected = resolveVectorBitSymbol(vector.expected ?? {}, outputRow);
      const actual = resolveOutputSymbolFromTrace(sample, outputRow);
      rows.push({
        tick,
        signal: normalizeSignalName(outputRow.label || outputRow.id),
        expected,
        actual,
      });
    }
  }
  return rows.sort((left, right) => {
    if (left.tick !== right.tick) return left.tick - right.tick;
    return compareText(left.signal, right.signal);
  });
}

/**
 * Build verify rows by running a fresh deterministic simulation from the circuit.
 * Use this when the runtime simulation trace doesn't cover the required vector ticks.
 */
export function buildVerifyRowsDeterministicFromCircuit(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  vectors: TestVector[]
): RuntimeVerifyTraceRow[] {
  if (vectors.length === 0) return [];
  const trace = simulateTraceFromVectors(circuit, ioRows, vectors);
  const traceByTick = new Map<number, RuntimeSimTraceSample>();
  for (const entry of trace) {
    traceByTick.set(entry.tick, entry);
  }
  const outputRows = ioRows.filter((row) => row.direction === 'out');
  const rows: RuntimeVerifyTraceRow[] = [];
  for (const vector of vectors) {
    const tick = Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : 0;
    // simulateTraceFromVectors pushes after engine.tick() so the post-vector tick is tick+1
    const sample = traceByTick.get(tick + 1) ?? traceByTick.get(tick);
    for (const outputRow of outputRows) {
      const expected = resolveVectorBitSymbol(vector.expected ?? {}, outputRow);
      const actual = resolveOutputSymbolFromTrace(sample, outputRow);
      rows.push({
        tick,
        signal: normalizeSignalName(outputRow.label || outputRow.id),
        expected,
        actual,
      });
    }
  }
  return rows.sort((left, right) => {
    if (left.tick !== right.tick) return left.tick - right.tick;
    return compareText(left.signal, right.signal);
  });
}

export function simulateExpectedIoRows(params: {
  circuit: Circuit;
  ioRows: SimulationIoRow[];
  vectors: TestVector[];
}): SimulatedExpectedIoRow[] {
  if (params.vectors.length === 0) {
    return [];
  }
  const trace = simulateTraceFromVectors(params.circuit, params.ioRows, params.vectors);
  if (trace.length === 0) {
    return [];
  }
  const traceByTick = new Map<number, RuntimeSimTraceSample>();
  for (const entry of trace) {
    traceByTick.set(entry.tick, entry);
  }
  const outputRows = params.ioRows.filter((row) => row.direction === 'out');
  const rows: SimulatedExpectedIoRow[] = [];
  for (const vector of params.vectors) {
    const tick = Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : 0;
    const sample = traceByTick.get(tick) ?? traceByTick.get(tick + 1);
    for (const row of outputRows) {
      const value = resolveOutputSymbolFromTrace(sample, row);
      rows.push({
        tick,
        signal: normalizeSignalName(row.label || row.id),
        expected: value === '1' ? '1' : '0',
      });
    }
  }
  return rows.sort((left, right) => {
    if (left.tick !== right.tick) return left.tick - right.tick;
    return compareText(left.signal, right.signal);
  });
}

function simulateTraceFromVectors(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  vectors: TestVector[]
): RuntimeSimTraceSample[] {
  const engine = new CircuitEngine(cloneCircuit(circuit));
  const inputs = deriveSimulationInputs(circuit);
  const resetNodeId = resolveResetNodeId(ioRows, circuit);
  if (resetNodeId) {
    inputs[resetNodeId] = 1;
  }
  applyInputsToEngine(engine, inputs);
  engine.tick();
  if (resetNodeId) {
    inputs[resetNodeId] = 0;
    applyInputsToEngine(engine, inputs);
    engine.tick();
  }

  const inputBindings = buildInputBindings(ioRows, circuit);
  const trace: RuntimeSimTraceSample[] = [];
  let tick = 0;
  const sortedVectors = [...vectors]
    .map((vector, index) => ({
      vector,
      tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
      order: index,
    }))
    .sort((left, right) => (left.tick === right.tick ? left.order - right.order : left.tick - right.tick));

  for (const entry of sortedVectors) {
    const vectorInputs = normalizeVectorInputMap(entry.vector.inputs ?? {});
    for (const binding of inputBindings) {
      const value = resolveBoundInputValue(binding.lookupKeys, vectorInputs);
      if (value !== undefined) {
        inputs[binding.nodeId] = value;
      }
    }
    const targetTick = entry.tick;
    const steps = Math.max(1, targetTick - tick);
    applyInputsToEngine(engine, inputs);
    for (let index = 0; index < steps; index += 1) {
      engine.tick();
      tick += 1;
      trace.push({
        tick,
        signals: normalizeSignalMap(engine, circuit),
      });
    }
  }

  return trace;
}

function normalizeVectorInputMap(
  record: Record<string, unknown>
): Record<string, 0 | 1> {
  const normalized: Record<string, 0 | 1> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[normalizeSignalName(key)] = normalizeBit(value);
  }
  return normalized;
}

function buildInputBindings(
  ioRows: SimulationIoRow[],
  circuit: Circuit
): Array<{ nodeId: string; lookupKeys: string[] }> {
  const bindings: Array<{ nodeId: string; lookupKeys: string[] }> = [];
  const inputNodes = circuit.nodes.filter((node) => isSimulationInputNode(node.type));
  for (const row of ioRows.filter((entry) => entry.direction === 'in')) {
    const fallbackNode = inputNodes.find((node) => {
      const candidateKeys = [node.id, node.label ?? ''].map((entry) => normalizeSignalName(entry));
      const rowKeys = [row.id, row.label, row.nodeId ?? ''].map((entry) => normalizeSignalName(entry));
      return rowKeys.some((key) => key.length > 0 && candidateKeys.includes(key));
    });
    const nodeId = row.nodeId?.trim() || fallbackNode?.id;
    if (!nodeId) continue;
    if (!circuit.nodes.some((node) => node.id === nodeId)) continue;
    bindings.push({
      nodeId,
      lookupKeys: [row.id, row.label, row.nodeId ?? '']
        .map((entry) => normalizeSignalName(entry))
        .filter((entry, index, source) => entry.length > 0 && source.indexOf(entry) === index),
    });
  }
  return bindings;
}

function resolveBoundInputValue(
  lookupKeys: string[],
  vectorInputs: Record<string, 0 | 1>
): 0 | 1 | undefined {
  for (const key of lookupKeys) {
    const value = vectorInputs[key];
    if (value === 0 || value === 1) {
      return value;
    }
  }
  return undefined;
}

function resolveVectorBitSymbol(
  expected: Record<string, boolean | number | string | undefined>,
  row: SimulationIoRow
): string {
  const candidates = [row.id, row.label, row.nodeId ?? '']
    .map((entry) => normalizeSignalName(entry))
    .filter(Boolean);
  for (const [key, value] of Object.entries(expected)) {
    const normalizedKey = normalizeSignalName(key);
    if (candidates.includes(normalizedKey)) {
      return normalizeBit(value) === 1 ? '1' : '0';
    }
  }
  return '0';
}

function resolveOutputSymbolFromTrace(
  sample: RuntimeSimTraceSample | undefined,
  row: SimulationIoRow
): string {
  if (!sample) return '0';
  const candidates = [
    row.nodeId ? `${row.nodeId}.in` : '',
    row.nodeId ? `${row.nodeId}.out` : '',
    normalizeSignalName(row.id),
    normalizeSignalName(row.label),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const direct = sample.signals[candidate];
    if (direct === 0 || direct === 1) {
      return direct === 1 ? '1' : '0';
    }
    const normalizedCandidate = normalizeSignalName(candidate);
    for (const [key, value] of Object.entries(sample.signals)) {
      if (normalizeSignalName(key) === normalizedCandidate) {
        return value === 1 ? '1' : '0';
      }
    }
  }
  return '0';
}

function deriveSimulationInputs(
  circuit: Circuit,
  previousInputs?: Record<string, 0 | 1>
): Record<string, 0 | 1> {
  const nextInputs: Record<string, 0 | 1> = {};
  for (const node of circuit.nodes) {
    if (!isSimulationInputNode(node.type)) continue;
    if (node.state?.isOn !== undefined) {
      nextInputs[node.id] = normalizeBit(node.state.isOn);
      continue;
    }
    const previous = previousInputs?.[node.id];
    nextInputs[node.id] = previous === 0 || previous === 1 ? previous : 0;
  }
  return nextInputs;
}

function resolveResetNodeId(ioRows: SimulationIoRow[], circuit: Circuit): string | undefined {
  const rows = ioRows.filter((row) => row.direction === 'in');
  for (const row of rows) {
    const normalized = normalizeSignalName(row.label || row.id);
    if (normalized === 'rst' || normalized === 'reset' || normalized === 'reset_n') {
      const fallback = circuit.nodes.find((node) => {
        if (!isSimulationInputNode(node.type)) return false;
        return normalizeSignalName(node.label ?? node.id) === normalized;
      });
      const nodeId = row.nodeId?.trim() || fallback?.id;
      if (nodeId && circuit.nodes.some((node) => node.id === nodeId)) {
        return nodeId;
      }
    }
  }
  return undefined;
}

function applyInputsToEngine(engine: CircuitEngine, inputs: Record<string, 0 | 1>): void {
  for (const [nodeId, value] of Object.entries(inputs)) {
    engine.setNodeValue(nodeId, value);
  }
}

function normalizeSignalMap(engine: CircuitEngine, circuit: Circuit): Record<string, 0 | 1> {
  const signalMap = engine.getAllSignals();
  const next: Record<string, 0 | 1> = {};
  const keys = Array.from(signalMap.keys()).sort(compareText);
  for (const key of keys) {
    next[key] = normalizeBit(signalMap.get(key));
  }

  for (const node of circuit.nodes) {
    if (isSimulationInputNode(node.type)) {
      const inputState = engine.getNodeState(node.id)?.isOn;
      next[`${node.id}.out`] = normalizeBit(inputState);
      continue;
    }

    if (node.type === 'OUTPUT' || node.type === 'Lamp') {
      const nodeState = engine.getNodeState(node.id);
      const fromConnection = circuit.connections.find((connection) => {
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return toNodeId === node.id;
      });
      let value = normalizeBit(nodeState?.isOn);
      if ((!nodeState || nodeState.isOn === undefined) && fromConnection) {
        const { fromNodeId, fromPort } = resolveConnectionPorts(fromConnection);
        value = next[`${fromNodeId}.${fromPort}`] ?? 0;
      }
      next[`${node.id}.in`] = value;
      next[`${node.id}.out`] = value;
    }
  }

  const orderedEntries = Object.entries(next).sort(([left], [right]) => compareText(left, right));
  return Object.fromEntries(orderedEntries) as Record<string, 0 | 1>;
}

function resolveConnectionPorts(connection: Circuit['connections'][number]): {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
} {
  const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
  const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
  const fromPort =
    typeof connection.from === 'string'
      ? connection.fromPort ?? connection.fromPin ?? 'out'
      : connection.from.portName ?? connection.from.port ?? 'out';
  const toPort =
    typeof connection.to === 'string'
      ? connection.toPort ?? connection.toPin ?? 'in'
      : connection.to.portName ?? connection.to.port ?? 'in';
  return { fromNodeId, fromPort, toNodeId, toPort };
}

function computeTraceHash(irHash: string, trace: RuntimeSimTraceSample[]): string {
  return `sim_${digestValue({ irHash, trace })}`;
}

function computeSimIrHash(circuit: Circuit): string {
  const nodes = circuit.nodes
    .map((node) => ({
      id: node.id,
      type: node.type,
      position: {
        x: roundToMill(node.position?.x ?? node.x ?? 0),
        y: roundToMill(node.position?.y ?? node.y ?? 0),
      },
      config: node.config ?? {},
    }))
    .sort((left, right) => compareText(left.id, right.id));
  const connections = circuit.connections
    .map((connection) => {
      const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
      const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
      const fromPort =
        typeof connection.from === 'string'
          ? connection.fromPort ?? connection.fromPin ?? 'out'
          : connection.from.portName ?? connection.from.port ?? 'out';
      const toPort =
        typeof connection.to === 'string'
          ? connection.toPort ?? connection.toPin ?? 'in'
          : connection.to.portName ?? connection.to.port ?? 'in';
      return {
        id: `${fromNodeId}.${fromPort}-${toNodeId}.${toPort}`,
        fromNodeId,
        fromPort,
        toNodeId,
        toPort,
      };
    })
    .sort((left, right) => compareText(left.id, right.id));
  return `ir_${digestValue({ nodes, connections })}`;
}

function normalizeSignalName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9_.]/g, '');
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function isSimulationInputNode(nodeType: string): boolean {
  return nodeType === 'INPUT' || nodeType === 'Switch';
}

function cloneCircuit(circuit: Circuit): Circuit {
  return {
    nodes: circuit.nodes.map((node) => ({ ...node })),
    connections: circuit.connections.map((connection) => ({ ...connection })),
  };
}

function roundToMill(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
