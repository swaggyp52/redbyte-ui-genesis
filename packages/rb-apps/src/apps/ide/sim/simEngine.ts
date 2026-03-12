import { CircuitEngine } from '@redbyte/rb-logic-core';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { digestValue } from '../../../utils/digest';
import { normalizeIoSignalKey } from '../ioLabels';
import type {
  VerifyEvidenceCapsule,
  VerifyEvidenceFailure,
  VerifyEvidencePreflightIssue,
  VerifyEvidenceResolutionEntry,
  VerifyReportVector,
} from '../verifyReport';
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

export interface DeterministicVerifyResult {
  rows: RuntimeVerifyTraceRow[];
  trace: RuntimeSimTraceSample[];
  evidence: Omit<VerifyEvidenceCapsule, 'circuitHash'>;
}

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
        signal: normalizeIoSignalKey(outputRow.label || outputRow.id),
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
  return runDeterministicVerifyFromCircuit(circuit, ioRows, vectors).rows;
}

export function runDeterministicVerifyFromCircuit(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  vectors: TestVector[]
): DeterministicVerifyResult {
  const cases = simulateVectorCases(circuit, ioRows, vectors);
  const traceByTick = new Map<number, RuntimeSimTraceSample>();
  for (const entry of cases) {
    traceByTick.set(entry.sample.tick, {
      tick: entry.sample.tick,
      signals: { ...entry.sample.signals },
    });
  }
  const trace = Array.from(traceByTick.values()).sort((left, right) => left.tick - right.tick);
  const outputRows = ioRows.filter((row) => row.direction === 'out');
  const rows: RuntimeVerifyTraceRow[] = [];
  const normalizationMap: VerifyEvidenceResolutionEntry[] = [];
  const preflight = new Map<string, VerifyEvidencePreflightIssue>();
  const failures: VerifyEvidenceFailure[] = [];

  for (const entry of cases) {
    for (const rawKey of Object.keys(entry.inputs)) {
      const match = resolveIoRowByKey(rawKey, ioRows.filter((row) => row.direction === 'in'));
      normalizationMap.push({
        role: 'input',
        rawKey,
        normalizedKey: normalizeIoSignalKey(rawKey),
        matchedSignal: match?.signal ?? null,
      });
    }

    for (const [rawExpectedKey, rawExpectedValue] of Object.entries(entry.expected)) {
      const expectedMatch = resolveIoRowByKey(rawExpectedKey, outputRows);
      normalizationMap.push({
        role: 'expected',
        rawKey: rawExpectedKey,
        normalizedKey: normalizeIoSignalKey(rawExpectedKey),
        matchedSignal: expectedMatch?.signal ?? null,
      });

      if (!expectedMatch) {
        const signal = normalizeIoSignalKey(rawExpectedKey) || rawExpectedKey;
        const key = `missing-output-row:${entry.vectorId}:${signal}`;
        if (!preflight.has(key)) {
          preflight.set(key, {
            kind: 'missing-output-row',
            signal,
            tick: entry.tick,
            vectorId: entry.vectorId,
            caseIndex: entry.caseIndex,
            message: `Cannot verify: expected output ${signal} does not match any mapped output row.`,
          });
        }
        continue;
      }

      if (!expectedMatch.row.nodeId) {
        const key = `missing-output-node:${entry.vectorId}:${expectedMatch.signal}`;
        if (!preflight.has(key)) {
          preflight.set(key, {
            kind: 'missing-output-node',
            signal: expectedMatch.signal,
            tick: entry.tick,
            vectorId: entry.vectorId,
            caseIndex: entry.caseIndex,
            message: `Cannot verify: output ${expectedMatch.signal} is not mapped to a concrete design node.`,
          });
        }
        continue;
      }

      const actualResolution = resolveOutputSymbolFromTraceDetailed(entry.sample, expectedMatch.row);
      normalizationMap.push({
        role: 'output',
        rawKey: expectedMatch.signal,
        normalizedKey: normalizeIoSignalKey(expectedMatch.signal),
        matchedSignal: actualResolution.sourceKey,
      });

      if (actualResolution.reason !== 'matched') {
        const key = `missing-output-sample:${entry.vectorId}:${expectedMatch.signal}`;
        if (!preflight.has(key)) {
          preflight.set(key, {
            kind: 'missing-output-sample',
            signal: expectedMatch.signal,
            tick: entry.tick,
            vectorId: entry.vectorId,
            caseIndex: entry.caseIndex,
            message:
              actualResolution.reason === 'missing-output-node'
                ? `Cannot verify: output ${expectedMatch.signal} is not mapped to a design node.`
                : `Cannot verify: output ${expectedMatch.signal} is not driven or could not be sampled from the circuit trace.`,
          });
        }
      }

      const expected = normalizeBit(rawExpectedValue) === 1 ? '1' : '0';
      const row: RuntimeVerifyTraceRow = {
        tick: entry.tick,
        signal: normalizeIoSignalKey(expectedMatch.signal),
        expected,
        actual: actualResolution.symbol,
        vectorId: entry.vectorId,
        caseIndex: entry.caseIndex,
      };
      rows.push(row);
      if (row.expected !== row.actual) {
        failures.push({
          tick: row.tick,
          signal: row.signal,
          expected: row.expected,
          actual: row.actual,
          vectorId: entry.vectorId,
          caseIndex: entry.caseIndex,
          expectedSourceKey: rawExpectedKey,
          expectedMatchedSignal: expectedMatch.signal,
          actualSourceKey: actualResolution.sourceKey,
          actualReason: actualResolution.reason,
        });
      }
    }
  }

  const evidenceVectors: VerifyReportVector[] = cases.map((entry) => ({
    id: entry.vectorId,
    tick: entry.tick,
    inputs: { ...entry.inputs },
    expected: { ...entry.expected },
    caseIndex: entry.caseIndex,
  }));

  return {
    rows: rows.sort((left, right) => {
      if (left.tick !== right.tick) return left.tick - right.tick;
      const leftCaseIndex = left.caseIndex ?? Number.MAX_SAFE_INTEGER;
      const rightCaseIndex = right.caseIndex ?? Number.MAX_SAFE_INTEGER;
      if (leftCaseIndex !== rightCaseIndex) return leftCaseIndex - rightCaseIndex;
      return compareText(left.signal, right.signal);
    }),
    trace,
    evidence: {
      ioRows: ioRows.map((row) => ({
        id: row.id,
        label: row.label,
        nodeId: row.nodeId,
        direction: row.direction,
      })),
      vectors: evidenceVectors,
      normalizationMap,
      preflight: Array.from(preflight.values()),
      failures,
    },
  };
}

export function simulateExpectedIoRows(params: {
  circuit: Circuit;
  ioRows: SimulationIoRow[];
  vectors: TestVector[];
}): SimulatedExpectedIoRow[] {
  if (params.vectors.length === 0) {
    return [];
  }
  const cases = simulateVectorCases(params.circuit, params.ioRows, params.vectors);
  const outputRows = params.ioRows.filter((row) => row.direction === 'out');
  const rows: SimulatedExpectedIoRow[] = [];
  for (const entry of cases) {
    for (const row of outputRows) {
      const value = resolveOutputSymbolFromTraceDetailed(entry.sample, row);
      if (value.reason !== 'matched') continue;
      rows.push({
        tick: entry.tick,
        signal: normalizeIoSignalKey(row.label || row.id),
        expected: value.symbol === '1' ? '1' : '0',
      });
    }
  }
  return rows.sort((left, right) => {
    if (left.tick !== right.tick) return left.tick - right.tick;
    return compareText(left.signal, right.signal);
  });
}

function simulateVectorCases(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  vectors: TestVector[]
): Array<{
  vectorId: string;
  caseIndex: number;
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
  sample: RuntimeSimTraceSample;
}> {
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
  let tick = 0;
  const sortedVectors = [...vectors]
    .map((vector, index) => ({
      vector,
      vectorId: `vec-${String(index + 1).padStart(2, '0')}`,
      caseIndex: index,
      tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
      order: index,
    }))
    .sort((left, right) => (left.tick === right.tick ? left.order - right.order : left.tick - right.tick));
  const samples: Array<{
    vectorId: string;
    caseIndex: number;
    tick: number;
    inputs: Record<string, 0 | 1>;
    expected: Record<string, 0 | 1>;
    sample: RuntimeSimTraceSample;
  }> = [];

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
    let sample: RuntimeSimTraceSample | null = null;
    for (let index = 0; index < steps; index += 1) {
      engine.tick();
      tick += 1;
      sample = {
        tick,
        signals: normalizeSignalMap(engine, circuit),
      };
    }
    if (!sample) {
      sample = {
        tick,
        signals: normalizeSignalMap(engine, circuit),
      };
    }
    samples.push({
      vectorId: entry.vectorId,
      caseIndex: entry.caseIndex,
      tick: entry.tick,
      inputs: { ...vectorInputs },
      expected: normalizeVectorInputMap(entry.vector.expected ?? {}),
      sample,
    });
  }

  return samples;
}

function normalizeVectorInputMap(
  record: Record<string, unknown>
): Record<string, 0 | 1> {
  const normalized: Record<string, 0 | 1> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[normalizeIoSignalKey(key)] = normalizeBit(value);
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
      const candidateKeys = [node.id, node.label ?? ''].map((entry) => normalizeIoSignalKey(entry));
      const rowKeys = [row.id, row.label, row.nodeId ?? ''].map((entry) => normalizeIoSignalKey(entry));
      return rowKeys.some((key) => key.length > 0 && candidateKeys.includes(key));
    });
    const nodeId = row.nodeId?.trim() || fallbackNode?.id;
    if (!nodeId) continue;
    if (!circuit.nodes.some((node) => node.id === nodeId)) continue;
    bindings.push({
      nodeId,
      lookupKeys: [row.id, row.label, row.nodeId ?? '']
        .map((entry) => normalizeIoSignalKey(entry))
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

function resolveIoRowByKey(
  rawKey: string,
  rows: SimulationIoRow[]
): { row: SimulationIoRow; signal: string } | null {
  const normalizedKey = normalizeIoSignalKey(rawKey);
  for (const row of rows) {
    const candidates = [row.id, row.label, row.nodeId ?? '']
      .map((entry) => normalizeIoSignalKey(entry))
      .filter(Boolean);
    if (candidates.includes(normalizedKey)) {
      return {
        row,
        signal: normalizeIoSignalKey(row.label || row.id),
      };
    }
  }
  return null;
}

function resolveVectorBitSymbol(
  expected: Record<string, boolean | number | string | undefined>,
  row: SimulationIoRow
): string {
  for (const [rawKey, value] of Object.entries(expected)) {
    const match = resolveIoRowByKey(rawKey, [row]);
    if (match) {
      return normalizeBit(value) === 1 ? '1' : '0';
    }
  }
  return '0';
}

function resolveOutputSymbolFromTrace(
  sample: RuntimeSimTraceSample | undefined,
  row: SimulationIoRow
): string {
  return resolveOutputSymbolFromTraceDetailed(sample, row).symbol;
}

function resolveOutputSymbolFromTraceDetailed(
  sample: RuntimeSimTraceSample | undefined,
  row: SimulationIoRow
): { symbol: string; sourceKey: string | null; reason: 'matched' | 'missing-output-node' | 'missing-output-sample' } {
  if (!row.nodeId) {
    return { symbol: '-', sourceKey: null, reason: 'missing-output-node' };
  }
  if (!sample) {
    return { symbol: '-', sourceKey: null, reason: 'missing-output-sample' };
  }
  const candidates = [
    row.nodeId ? `${row.nodeId}.in` : '',
    row.nodeId ? `${row.nodeId}.out` : '',
    normalizeIoSignalKey(row.id),
    normalizeIoSignalKey(row.label),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const direct = sample.signals[candidate];
    if (direct === 0 || direct === 1) {
      return {
        symbol: direct === 1 ? '1' : '0',
        sourceKey: candidate,
        reason: 'matched',
      };
    }
    const normalizedCandidate = normalizeIoSignalKey(candidate);
    for (const [key, value] of Object.entries(sample.signals)) {
      if (normalizeIoSignalKey(key) === normalizedCandidate) {
        return {
          symbol: value === 1 ? '1' : '0',
          sourceKey: key,
          reason: 'matched',
        };
      }
    }
  }
  return {
    symbol: '-',
    sourceKey: null,
    reason: 'missing-output-sample',
  };
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
    const normalized = normalizeIoSignalKey(row.label || row.id);
    if (normalized === 'rst' || normalized === 'reset' || normalized === 'reset_n') {
      const fallback = circuit.nodes.find((node) => {
        if (!isSimulationInputNode(node.type)) return false;
        return normalizeIoSignalKey(node.label ?? node.id) === normalized;
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

