// Copyright Â© 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import {
  TickEngine,
  injectSimClock,
  type Circuit,
  type SimulationModel,
  type SimulationModelPortRef,
  type TickEngineConfig,
} from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import { normalizeIoSignalKey } from '../../../apps/ide/ioLabels';
import type { ToolchainProjectInput } from '../../toolchainBackend';
import {
  CLOCKED_MACRO_SEQUENCE,
  INTERNAL_SIM_CLOCK_NAME,
  buildDeterministicVerifyContext,
} from './verifySchedule';

interface VerificationIoRow {
  id: string;
  label: string;
  direction: 'in' | 'out';
  nodeId?: string;
}

/**
 * Sample of signals at a specific tick and phase
 */
export interface TraceSample {
  tick: number;
  phase: 'pre' | 'post';
  signals: Record<string, number>;
}

/**
 * Result of vector execution
 */
export interface VectorRunResult {
  pass: boolean;
  trace: TraceSample[];
  failures: Array<{
    tick: number;
    signal: string;
    expected: number;
    actual: number;
  }>;
  deterministicHash: string;
  schedule: 'combinational' | 'clocked_macro';
  warningBanner?: string; // e.g., "No clock mapped; using internal sim clock"
}

/**
 * Deterministic test vector runner
 *
 * Supports two execution schedules:
 *   - combinational: drive â†’ tick() â†’ sample/assert
 *   - clocked_macro: drive â†’ (clk=0 tick) â†’ (clk=1 tick) â†’ (clk=0 tick) â†’ sample/assert
 *
 * For edge-triggered sequential logic, the middle tick is the rising-edge capture
 * and the final low tick restores a stable post-edge sample point.
 */
export async function runTestVectors(
  circuit: Circuit,
  vectors: TestVector[],
  ioMapping?: IoMapping,
  hdl?: ToolchainProjectInput
): Promise<VectorRunResult> {
  const context = buildDeterministicVerifyContext(circuit, ioMapping, hdl);
  const { schedule, simModel } = context;

  const ioRows = buildVerificationIoRows(simModel, ioMapping);

  // Prepare circuit (clone for safety)
  const simCircuit = JSON.parse(JSON.stringify(circuit)) as Circuit;

  let warningBanner: string | undefined;
  if (schedule.needsSimClockInjection) {
    injectSimClock(simCircuit, schedule.analysis.sequentialNodes.map((node) => node.id));
    warningBanner =
      'No clock mapped; Verify used internal sim clock. Export will require CLK100MHZ mapping.';
  } else if (schedule.schedule === 'clocked_macro' && schedule.reason === 'hdl-sequential') {
    warningBanner =
      'Sequential HDL pattern detected; Verify forced clocked schedule for export parity.';
  }

  const tickEngine = new TickEngine(simCircuit, { tickRate: 100 } as TickEngineConfig);
  const engine = tickEngine.getEngine();
  const trace: TraceSample[] = [];
  const failures: Array<{
    tick: number;
    signal: string;
    expected: number;
    actual: number;
  }> = [];
  const inputBindings = buildInputBindingsFromModel(ioRows, simModel);
  const outputRows = ioRows.filter((row) => row.direction === 'out');
  const inputs: Record<string, 0 | 1> = {};
  for (const binding of inputBindings) {
    inputs[binding.nodeId] = 0;
  }
  const clockNodeId = resolveClockNodeIdFromModel(simModel, ioRows, schedule.clockSignalName);

  for (let tickIdx = 0; tickIdx < vectors.length; tickIdx += 1) {
    const vector = vectors[tickIdx];
    const normalizedInputs = normalizeVectorInputMap(vector.inputs ?? {});

    for (const binding of inputBindings) {
      if (clockNodeId && binding.nodeId === clockNodeId) continue;
      const value = resolveBoundInputValue(binding.lookupKeys, normalizedInputs);
      if (value === 0 || value === 1) {
        inputs[binding.nodeId] = value;
        driveBoundNodeValue(engine, binding.nodeId, value);
      }
    }

    if (schedule.schedule === 'clocked_macro') {
      for (const clockValue of CLOCKED_MACRO_SEQUENCE) {
        if (clockNodeId) {
          driveBoundNodeValue(engine, clockNodeId, clockValue);
        }
        engine.tick();
      }
    } else {
      engine.tick();
    }

    const sampleSignals = sampleEngineSignals(engine);
    trace.push({
      tick: tickIdx,
      phase: 'post',
      signals: sampleSignals,
    });

    if (!vector.expected) continue;
    for (const [rawExpectedKey, expected] of Object.entries(vector.expected)) {
      const outputRow = resolveIoRowByKey(rawExpectedKey, outputRows, simModel.outputs);
      if (!outputRow) continue;
      const actual = resolveOutputValueFromModel(engine, outputRow.row, simModel);
      if (actual === undefined) continue;
      const expectedValue = normalizeBit(expected);
      if (actual !== expectedValue) {
        failures.push({
          tick: tickIdx,
          signal: rawExpectedKey,
          expected: expectedValue,
          actual,
        });
      }
    }
  }

  return {
    pass: failures.length === 0,
    trace,
    failures,
    deterministicHash: computeDeterministicHash(trace),
    schedule: schedule.schedule,
    warningBanner,
  };
}

function buildVerificationIoRows(
  model: SimulationModel,
  ioMapping: IoMapping | undefined
): VerificationIoRow[] {
  const rows = new Map<string, VerificationIoRow>();
  for (const port of getExternallyDrivenPorts(model)) {
    const mapped = findIoMappingEntry(port, ioMapping?.inputs);
    rows.set(`in:${port.sourceNodeId}`, {
      id: mapped?.id ?? port.portId,
      label: mapped?.label?.trim() || port.canonicalName,
      direction: 'in',
      nodeId: mapped?.nodeId ?? port.sourceNodeId,
    });
  }
  for (const port of model.outputs) {
    const mapped = findIoMappingEntry(port, ioMapping?.outputs);
    rows.set(`out:${port.sourceNodeId}`, {
      id: mapped?.id ?? port.portId,
      label: mapped?.label?.trim() || port.canonicalName,
      direction: 'out',
      nodeId: mapped?.nodeId ?? port.sourceNodeId,
    });
  }
  return Array.from(rows.values());
}

function findIoMappingEntry(
  port: SimulationModelPortRef,
  entries:
    | Array<{ id: string; nodeId: string; label?: string }>
    | undefined
): { id: string; nodeId: string; label?: string } | undefined {
  return entries?.find((entry) => {
    const candidates = [
      entry.id,
      entry.nodeId,
      entry.label ?? '',
    ].map((value) => normalizeIoSignalKey(value));
    return candidates.includes(normalizeIoSignalKey(port.sourceNodeId)) ||
      candidates.includes(normalizeIoSignalKey(port.canonicalName)) ||
      candidates.includes(normalizeIoSignalKey(port.portId));
  });
}

function normalizeVectorInputMap(record: Record<string, unknown>): Record<string, 0 | 1> {
  const normalized: Record<string, 0 | 1> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[normalizeIoSignalKey(key)] = normalizeBit(value);
  }
  return normalized;
}

function buildInputBindingsFromModel(
  ioRows: VerificationIoRow[],
  model: SimulationModel
): Array<{ nodeId: string; lookupKeys: string[] }> {
  const portsBySourceNodeId = new Map<string, SimulationModelPortRef>();
  for (const port of getExternallyDrivenPorts(model)) {
    portsBySourceNodeId.set(port.sourceNodeId, port);
  }
  const bindings: Array<{ nodeId: string; lookupKeys: string[] }> = [];
  for (const row of ioRows.filter((entry) => entry.direction === 'in')) {
    const modelPort =
      (row.nodeId?.trim() ? portsBySourceNodeId.get(row.nodeId.trim()) : undefined) ??
      getExternallyDrivenPorts(model).find((port) =>
        buildLookupKeys(row, port).includes(normalizeIoSignalKey(port.canonicalName))
      );
    if (!modelPort) continue;
    bindings.push({
      nodeId: modelPort.sourceNodeId,
      lookupKeys: buildLookupKeys(row, modelPort),
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

function resolveClockNodeIdFromModel(
  model: SimulationModel,
  ioRows: VerificationIoRow[],
  clockSignalName: string | undefined
): string | undefined {
  if (clockSignalName === INTERNAL_SIM_CLOCK_NAME) {
    return INTERNAL_SIM_CLOCK_NAME;
  }
  const normalizedSignalName = normalizeIoSignalKey(clockSignalName ?? '');
  if (normalizedSignalName) {
    const directPort = getExternallyDrivenPorts(model).find((port) =>
      buildLookupKeysForPort(port).includes(normalizedSignalName)
    );
    if (directPort) {
      return directPort.sourceNodeId;
    }
  }
  for (const row of ioRows.filter((entry) => entry.direction === 'in')) {
    const port = resolveModelPortForRow(row, getExternallyDrivenPorts(model));
    const candidates = [
      row.id,
      row.label,
      row.nodeId ?? '',
      port?.canonicalName ?? '',
      port?.sourceNodeId ?? '',
    ].map((value) => normalizeIoSignalKey(value));
    if (candidates.includes(normalizedSignalName) && port) {
      return port.sourceNodeId;
    }
  }
  const uniqueClockSources = uniqueStrings(
    model.clockBindings.map((binding) => binding.boundarySourceNodeId)
  );
  return uniqueClockSources.length === 1 ? uniqueClockSources[0] : undefined;
}

function sampleEngineSignals(engine: any): Record<string, number> {
  const sampleData: Record<string, number> = {};
  const signals = engine.getAllSignals();
  for (const [key, value] of signals.entries()) {
    sampleData[key] = normalizeBit(value);
  }
  return sampleData;
}

function driveBoundNodeValue(engine: any, nodeId: string, value: 0 | 1): void {
  const node = engine.getCircuit().nodes.find((entry: { id: string }) => entry.id === nodeId);
  if (!node) {
    engine.setNodeValue(nodeId, value);
    return;
  }

  if (node.type === 'Switch' || node.type === 'INPUT' || node.type === 'InputPin') {
    engine.setNodeState(nodeId, { ...(engine.getNodeState(nodeId) ?? {}), isOn: value, value });
    return;
  }
  if (node.type === 'Clock') {
    engine.setNodeState(nodeId, {
      ...(engine.getNodeState(nodeId) ?? {}),
      isOn: value,
      frequency: 1,
    });
    return;
  }

  engine.setNodeValue(nodeId, value);
}

function resolveIoRowByKey(
  rawKey: string,
  rows: VerificationIoRow[],
  modelPorts: SimulationModelPortRef[]
): { row: VerificationIoRow; signal: string; modelPort?: SimulationModelPortRef } | null {
  const normalizedKey = normalizeIoSignalKey(rawKey);
  for (const row of rows) {
    const modelPort = resolveModelPortForRow(row, modelPorts);
    const candidates = [
      row.id,
      row.label,
      row.nodeId ?? '',
      modelPort?.canonicalName ?? '',
      modelPort?.sourceNodeId ?? '',
    ]
      .map((entry) => normalizeIoSignalKey(entry))
      .filter(Boolean);
    if (candidates.includes(normalizedKey)) {
      return {
        row,
        signal: normalizeIoSignalKey(row.label || row.id),
        modelPort,
      };
    }
  }
  return null;
}

function resolveOutputValueFromModel(
  engine: any,
  row: VerificationIoRow,
  model: SimulationModel
): number | undefined {
  if (!row.nodeId) return undefined;
  const modelPort = resolveModelPortForRow(row, model.outputs);
  if (!modelPort) return undefined;
  const outputBinding = model.outputBindings.find(
    (binding) => binding.outputPortId === modelPort.portId
  );
  const signals = engine.getAllSignals();
  const candidates = [
    `${modelPort.sourceNodeId}.in`,
    `${modelPort.sourceNodeId}.out`,
    outputBinding?.driverSourceNodeId ? `${outputBinding.driverSourceNodeId}.out` : '',
    row.id,
    row.label,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (signals.has(candidate)) {
      return normalizeBit(signals.get(candidate));
    }
    const normalizedCandidate = normalizeIoSignalKey(candidate);
    for (const [key, value] of signals.entries()) {
      if (normalizeIoSignalKey(key) === normalizedCandidate) {
        return normalizeBit(value);
      }
    }
  }
  const nodeState = engine.getNodeState(modelPort.sourceNodeId);
  if (nodeState) {
    return normalizeBit(nodeState.isOn ?? nodeState.value);
  }
  return undefined;
}

function resolveModelPortForRow(
  row: VerificationIoRow,
  modelPorts: SimulationModelPortRef[]
): SimulationModelPortRef | undefined {
  if (row.nodeId?.trim()) {
    const direct = modelPorts.find((port) => port.sourceNodeId === row.nodeId?.trim());
    if (direct) return direct;
  }
  const rowKeys = [row.id, row.label, row.nodeId ?? '']
    .map((value) => normalizeIoSignalKey(value))
    .filter(Boolean);
  return modelPorts.find((port) => buildLookupKeysForPort(port).some((key) => rowKeys.includes(key)));
}

function buildLookupKeys(row: VerificationIoRow, modelPort: SimulationModelPortRef): string[] {
  return [
    row.id,
    row.label,
    row.nodeId ?? '',
    modelPort.canonicalName,
    modelPort.sourceNodeId,
  ]
    .map((entry) => normalizeIoSignalKey(entry))
    .filter((entry, index, source) => entry.length > 0 && source.indexOf(entry) === index);
}

function buildLookupKeysForPort(modelPort: SimulationModelPortRef): string[] {
  return [modelPort.portId, modelPort.sourceNodeId, modelPort.canonicalName]
    .map((entry) => normalizeIoSignalKey(entry))
    .filter((entry, index, source) => entry.length > 0 && source.indexOf(entry) === index);
}

function getExternallyDrivenPorts(model: SimulationModel): SimulationModelPortRef[] {
  const deduped = new Map<string, SimulationModelPortRef>();
  for (const port of [...model.inputs, ...model.clocks, ...model.resets]) {
    if (!deduped.has(port.sourceNodeId)) {
      deduped.set(port.sourceNodeId, port);
    }
  }
  return Array.from(deduped.values());
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value && value.length > 0))
    )
  );
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

/**
 * Compute deterministic hash of trace
 * Uses simple string-based hash (not cryptographic, but deterministic)
 */
function computeDeterministicHash(trace: TraceSample[]): string {
  const normalized = trace
    .sort((a, b) => a.tick - b.tick)
    .map((sample) => ({
      tick: sample.tick,
      phase: sample.phase,
      signals: Object.keys(sample.signals)
        .sort()
        .reduce(
          (acc, key) => {
            acc[key] = sample.signals[key];
            return acc;
          },
          {} as Record<string, number>
        ),
    }));

  const json = JSON.stringify(normalized);
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }

  return `sha:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}
