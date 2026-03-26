import {
  CircuitEngine,
  buildSimulationModel,
  elaborateCircuit,
  injectSimClock,
  type Circuit,
  type IRDiagnostic,
  type SimulationModel,
  type SimulationModelPortRef,
} from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import { digestValue } from '../../../utils/digest';
import {
  buildDeterministicVerifyContext,
  CLOCKED_MACRO_SEQUENCE,
  INTERNAL_SIM_CLOCK_NAME,
  type VerifyScheduleContract,
} from '../../../fpga/boards/basys3/verifySchedule';
import { adaptIrDiagnostic } from '../diagnostics';
import {
  getCanonicalIoSignalKey,
  getIoSignalLookupKeys,
  normalizeIoSignalKey,
} from '../ioLabels';
import type {
  VerifyEvidenceCapsule,
  VerifyEvidenceFailure,
  VerifyEvidencePreflightIssue,
  VerifyEvidenceResolutionEntry,
  VerifyReportVector,
} from '../verifyReport';
import type {
  RuntimeSimGuard,
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

export type SimEngineResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'blocked'; reason: 'invalid-ir'; diagnostics: IRDiagnostic[] };

export interface DeterministicVerifyResult {
  rows: RuntimeVerifyTraceRow[];
  trace: RuntimeSimTraceSample[];
  evidence: Omit<VerifyEvidenceCapsule, 'circuitHash'>;
}

// TODO(slice-7): Retained as transitional wrappers — real callers in projectRuntime.ts and
// bringupArtifacts.ts still pass Circuit. Remove once those callers are migrated to pass
// SimulationModel directly (requires deriving the model at the call site).
export function resetSimulationState(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  previous?: RuntimeSimState
): SimEngineResult<RuntimeSimState> {
  const model = buildSimulationModel(elaborateCircuit(circuit).ir);
  return resetSimulationStateFromModel(circuit, model, ioRows, previous);
}

// TODO(slice-7): Retained — projectRuntime.ts caller not yet migrated to pass SimulationModel.
export function advanceSimulationState(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  sim: RuntimeSimState,
  requestedTicks: number
): SimEngineResult<RuntimeSimState> {
  const model = buildSimulationModel(elaborateCircuit(circuit).ir);
  return advanceSimulationStateFromModel(circuit, model, ioRows, sim, requestedTicks);
}

// TODO(slice-7): Retained — projectRuntime.ts caller not yet migrated to pass SimulationModel.
export function recomputeSimulationState(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  sim: RuntimeSimState
): SimEngineResult<RuntimeSimState> {
  const model = buildSimulationModel(elaborateCircuit(circuit).ir);
  return recomputeSimulationStateFromModel(circuit, model, ioRows, sim);
}

export function resetSimulationStateFromModel(
  executionCircuit: Circuit,
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  previous?: RuntimeSimState
): SimEngineResult<RuntimeSimState> {
  if (!model.isRunnable) {
    return buildBlockedSimResult(model);
  }

  const inputs = deriveSimulationInputsFromModel(model, executionCircuit, previous?.inputs);
  const resetNodeId = resolveResetNodeIdFromModel(model, ioRows);
  if (resetNodeId) {
    inputs[resetNodeId] = 1;
  }

  runtimeSimEngine = new CircuitEngine(cloneExecutionCircuit(executionCircuit));
  runtimeSimIrHash = model.irHash;
  applyInputsToEngine(runtimeSimEngine, inputs);
  runtimeSimEngine.tick();
  if (resetNodeId) {
    inputs[resetNodeId] = 0;
    applyInputsToEngine(runtimeSimEngine, inputs);
    runtimeSimEngine.tick();
  }

  const signals = normalizeSignalMap(runtimeSimEngine, model);
  return {
    status: 'ok',
    value: {
      tick: 0,
      running: false,
      stepMode: false,
      lastAction: previous?.lastAction,
      speedHz: previous?.speedHz ?? DEFAULT_SIM_SPEED_HZ,
      irHash: model.irHash,
      traceHash: computeTraceHash(model.irHash, []),
      inputs,
      signals,
      trace: [],
      selectedSignalKey: previous?.selectedSignalKey ?? null,
      probes: previous?.probes ? previous.probes.map((probe) => ({ ...probe })) : [],
      guard: undefined,
    },
  };
}

export function advanceSimulationStateFromModel(
  executionCircuit: Circuit,
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  sim: RuntimeSimState,
  requestedTicks: number
): SimEngineResult<RuntimeSimState> {
  if (!model.isRunnable) {
    return buildBlockedSimResult(model);
  }

  const ticks = Math.max(0, Math.min(1024, Math.floor(requestedTicks)));
  if (ticks === 0) {
    return {
      status: 'ok',
      value: {
        ...sim,
        guard: undefined,
      },
    };
  }
  if (!runtimeSimEngine || runtimeSimIrHash !== model.irHash) {
    return resetSimulationStateFromModel(executionCircuit, model, ioRows, sim);
  }

  const engine = runtimeSimEngine;
  applyInputsToEngine(engine, sim.inputs);
  let tick = sim.tick;
  let trace = sim.trace.map((entry) => ({
    tick: entry.tick,
    signals: { ...entry.signals },
  }));
  for (let index = 0; index < ticks; index += 1) {
    engine.tick();
    tick += 1;
    trace.push({
      tick,
      signals: normalizeSignalMap(engine, model),
    });
  }
  if (trace.length > SIM_TRACE_CAPACITY) {
    trace = trace.slice(trace.length - SIM_TRACE_CAPACITY);
  }
  const signals = normalizeSignalMap(engine, model);
  return {
    status: 'ok',
    value: {
      ...sim,
      tick,
      irHash: model.irHash,
      signals,
      trace,
      traceHash: computeTraceHash(model.irHash, trace),
      guard: undefined,
    },
  };
}

export function recomputeSimulationStateFromModel(
  executionCircuit: Circuit,
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  sim: RuntimeSimState
): SimEngineResult<RuntimeSimState> {
  if (!model.isRunnable) {
    return buildBlockedSimResult(model);
  }
  if (!runtimeSimEngine || runtimeSimIrHash !== model.irHash) {
    return resetSimulationStateFromModel(executionCircuit, model, ioRows, sim);
  }

  const engine = runtimeSimEngine;
  applyInputsToEngine(engine, sim.inputs);
  engine.tick();
  const signals = normalizeSignalMap(engine, model);
  return {
    status: 'ok',
    value: {
      ...sim,
      irHash: model.irHash,
      signals,
      traceHash: computeTraceHash(model.irHash, sim.trace),
      guard: undefined,
    },
  };
}

export function buildBlockedRuntimeSnapshotFromModel(
  executionCircuit: Circuit,
  model: SimulationModel,
  previousInputs?: Record<string, 0 | 1>
): Pick<RuntimeSimState, 'tick' | 'irHash' | 'traceHash' | 'inputs' | 'signals' | 'trace'> {
  const trace: RuntimeSimTraceSample[] = [];
  const inputs = deriveSimulationInputsFromModel(model, executionCircuit, previousInputs);
  const signals: Record<string, 0 | 1> = {};
  for (const port of getExternallyDrivenPorts(model)) {
    signals[`${port.sourceNodeId}.out`] = inputs[port.sourceNodeId] ?? 0;
  }
  return {
    tick: 0,
    irHash: model.irHash,
    traceHash: computeTraceHash(model.irHash, trace),
    inputs,
    signals,
    trace,
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
        const expected = resolveVectorBitSymbol(vector.expected ?? {}, outputRow, outputRows);
      const actual = resolveOutputSymbolFromTrace(sample, outputRow, undefined);
      rows.push({
        tick,
          signal: getCanonicalIoSignalKey(outputRow, outputRows),
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

// TODO(slice-7): Thin delegate — retained until export/test callers pass SimulationModel directly.
export function buildVerifyRowsDeterministicFromCircuit(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  vectors: TestVector[],
  scheduleContract?: VerifyScheduleContract
): RuntimeVerifyTraceRow[] {
  const context = buildDeterministicVerifyContext(
    circuit,
    toIoMappingFromSimulationRows(ioRows)
  );
  const model = context.simModel;
  const contract = scheduleContract ?? context.schedule;
  return runDeterministicVerifyFromModel(circuit, model, ioRows, vectors, contract).rows;
}

// TODO(slice-7): Thin delegate — retained until verify/test callers pass SimulationModel directly.
export function runDeterministicVerifyFromCircuit(
  circuit: Circuit,
  ioRows: SimulationIoRow[],
  vectors: TestVector[],
  scheduleContract?: VerifyScheduleContract
): DeterministicVerifyResult {
  const context = buildDeterministicVerifyContext(
    circuit,
    toIoMappingFromSimulationRows(ioRows)
  );
  const model = context.simModel;
  const contract = scheduleContract ?? context.schedule;
  return runDeterministicVerifyFromModel(circuit, model, ioRows, vectors, contract);
}

export function runDeterministicVerifyFromModel(
  executionCircuit: Circuit,
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  vectors: TestVector[],
  scheduleContract?: VerifyScheduleContract
): DeterministicVerifyResult {
  if (!model.isRunnable) {
    return buildInvalidIrResult(model, ioRows, vectors);
  }

  const contract = scheduleContract ?? buildDefaultScheduleContract();
  if (contract.hasUnsupportedTemporal) {
    return buildUnsupportedTemporalResult(ioRows, vectors, contract);
  }

  const cases = simulateVectorCasesFromModel(executionCircuit, model, ioRows, vectors, contract);
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
      const match = resolveIoRowByKey(rawKey, ioRows.filter((row) => row.direction === 'in'), model.inputs);
      normalizationMap.push({
        role: 'input',
        rawKey,
        normalizedKey: normalizeIoSignalKey(rawKey),
        matchedSignal: match?.signal ?? null,
      });
    }

    for (const [rawExpectedKey, rawExpectedValue] of Object.entries(entry.expected)) {
      const expectedMatch = resolveIoRowByKey(rawExpectedKey, outputRows, model.outputs);
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
            code: 'VPRE1001',
            severity: 'error',
            blocking: true,
            signal,
            tick: entry.tick,
            vectorId: entry.vectorId,
            caseIndex: entry.caseIndex,
            message: `Cannot verify: expected output ${signal} does not match any mapped output row.`,
          });
        }
        continue;
      }

      if (!expectedMatch.modelPort) {
        const key = `missing-output-node:${entry.vectorId}:${expectedMatch.signal}`;
        if (!preflight.has(key)) {
          preflight.set(key, {
            kind: 'missing-output-node',
            code: 'VPRE1002',
            severity: 'error',
            blocking: true,
            signal: expectedMatch.signal,
            tick: entry.tick,
            vectorId: entry.vectorId,
            caseIndex: entry.caseIndex,
            nodeId: expectedMatch.row.nodeId,
            port: expectedMatch.row.id,
            message: `Cannot verify: output ${expectedMatch.signal} is not mapped to a concrete design node.`,
          });
        }
        continue;
      }

      const actualResolution = resolveOutputSymbolFromTraceDetailed(
        entry.sample,
        expectedMatch.row,
        model
      );
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
            kind:
              actualResolution.reason === 'missing-output-node'
                ? 'missing-output-node'
                : 'missing-output-sample',
            code:
              actualResolution.reason === 'missing-output-node'
                ? 'VPRE1002'
                : 'VPRE1004',
            severity: 'error',
            blocking: true,
            signal: expectedMatch.signal,
            tick: entry.tick,
            vectorId: entry.vectorId,
            caseIndex: entry.caseIndex,
            nodeId: expectedMatch.row.nodeId,
            port: expectedMatch.row.id,
            message:
              actualResolution.reason === 'missing-output-node'
                ? `Cannot verify: output ${expectedMatch.signal} is not mapped to a concrete design node.`
                : `Cannot verify: output ${expectedMatch.signal} is not driven or could not be sampled from the circuit trace.`,
          });
        }
        continue;
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

// TODO(slice-7): Thin delegate — retained until bringup/export callers pass SimulationModel directly.
export function simulateExpectedIoRows(params: {
  circuit: Circuit;
  ioRows: SimulationIoRow[];
  vectors: TestVector[];
  scheduleContract?: VerifyScheduleContract;
}): SimulatedExpectedIoRow[] {
  const context = buildDeterministicVerifyContext(
    params.circuit,
    toIoMappingFromSimulationRows(params.ioRows)
  );
  const model = context.simModel;
  const contract = params.scheduleContract ?? context.schedule;
  return simulateExpectedIoRowsFromModel({
    executionCircuit: params.circuit,
    model,
    ioRows: params.ioRows,
    vectors: params.vectors,
    scheduleContract: contract,
  });
}

export function simulateExpectedIoRowsFromModel(params: {
  executionCircuit: Circuit;
  model: SimulationModel;
  ioRows: SimulationIoRow[];
  vectors: TestVector[];
  scheduleContract?: VerifyScheduleContract;
}): SimulatedExpectedIoRow[] {
  if (!params.model.isRunnable || params.vectors.length === 0) {
    return [];
  }
  const contract = params.scheduleContract ?? buildDefaultScheduleContract();
  if (contract.hasUnsupportedTemporal) {
    return [];
  }
  const cases = simulateVectorCasesFromModel(
    params.executionCircuit,
    params.model,
    params.ioRows,
    params.vectors,
    contract
  );
  const outputRows = params.ioRows.filter((row) => row.direction === 'out');
  const rows: SimulatedExpectedIoRow[] = [];
  for (const entry of cases) {
    for (const row of outputRows) {
      const value = resolveOutputSymbolFromTraceDetailed(entry.sample, row, params.model);
      if (value.reason !== 'matched') continue;
      rows.push({
        tick: entry.tick,
        signal: getCanonicalIoSignalKey(row, outputRows),
        expected: value.symbol === '1' ? '1' : '0',
      });
    }
  }
  return rows.sort((left, right) => {
    if (left.tick !== right.tick) return left.tick - right.tick;
    return compareText(left.signal, right.signal);
  });
}

function simulateVectorCasesFromModel(
  executionCircuit: Circuit,
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  vectors: TestVector[],
  scheduleContract: VerifyScheduleContract
): Array<{
  vectorId: string;
  caseIndex: number;
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
  sample: RuntimeSimTraceSample;
}> {
  const simCircuit = cloneExecutionCircuit(executionCircuit);
  if (scheduleContract.needsSimClockInjection) {
    injectSimClock(
      simCircuit,
      scheduleContract.analysis.sequentialNodes.map((node) => node.id)
    );
  }

  const engine = new CircuitEngine(simCircuit);
  const inputs = deriveSimulationInputsFromModel(model, simCircuit);
  const resetNodeId = resolveResetNodeIdFromModel(model, ioRows, scheduleContract);
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

  const inputBindings = buildInputBindingsFromModel(ioRows, model);
  const clockNodeId =
    scheduleContract.schedule === 'clocked_macro'
      ? resolveClockNodeIdFromModel(model, ioRows, scheduleContract)
      : undefined;
  let combinationalTick = 0;
  const sortedVectors = [...vectors]
    .map((vector, index) => ({
      vector,
      vectorId: `vec-${String(index + 1).padStart(2, '0')}`,
      caseIndex: index,
      tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
      order: index,
    }))
    .sort((left, right) =>
      left.tick === right.tick ? left.order - right.order : left.tick - right.tick
    );
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
      if (clockNodeId && binding.nodeId === clockNodeId) {
        continue;
      }
      const value = resolveBoundInputValue(binding.lookupKeys, vectorInputs);
      if (value !== undefined) {
        inputs[binding.nodeId] = value;
      }
    }
    const sample =
      scheduleContract.schedule === 'clocked_macro'
        ? executeClockedMacroVectorCase(engine, model, inputs, entry.tick, clockNodeId)
        : executeCombinationalVectorCase(engine, model, inputs, entry.tick, combinationalTick);
    if (scheduleContract.schedule !== 'clocked_macro') {
      combinationalTick = sample.engineTick;
    }
    samples.push({
      vectorId: entry.vectorId,
      caseIndex: entry.caseIndex,
      tick: entry.tick,
      inputs: { ...vectorInputs },
      expected: normalizeVectorInputMap(entry.vector.expected ?? {}),
      sample: sample.output,
    });
  }

  return samples;
}

function executeCombinationalVectorCase(
  engine: CircuitEngine,
  model: SimulationModel,
  inputs: Record<string, 0 | 1>,
  sampleTick: number,
  previousEngineTick: number
): { engineTick: number; output: RuntimeSimTraceSample } {
  const targetTick = sampleTick;
  const steps = Math.max(1, targetTick - previousEngineTick);
  applyInputsToEngine(engine, inputs);
  let engineTick = previousEngineTick;
  let sample: RuntimeSimTraceSample | null = null;
  for (let index = 0; index < steps; index += 1) {
    engine.tick();
    engineTick += 1;
    sample = {
      tick: engineTick,
      signals: normalizeSignalMap(engine, model),
    };
  }
  if (!sample) {
    sample = {
      tick: engineTick,
      signals: normalizeSignalMap(engine, model),
    };
  }
  return {
    engineTick,
    output: sample,
  };
}

function executeClockedMacroVectorCase(
  engine: CircuitEngine,
  model: SimulationModel,
  inputs: Record<string, 0 | 1>,
  sampleTick: number,
  clockNodeId: string | undefined
): { engineTick: number; output: RuntimeSimTraceSample } {
  for (const clockValue of CLOCKED_MACRO_SEQUENCE) {
    if (clockNodeId) {
      inputs[clockNodeId] = clockValue;
    }
    applyInputsToEngine(engine, inputs);
    engine.tick();
  }

  return {
    engineTick: sampleTick,
    output: {
      tick: sampleTick,
      signals: normalizeSignalMap(engine, model),
    },
  };
}

function buildInvalidIrResult(
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  vectors: TestVector[]
): DeterministicVerifyResult {
  const evidenceVectors: VerifyReportVector[] = vectors.map((vector, index) => ({
    id: `vec-${String(index + 1).padStart(2, '0')}`,
    tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
    inputs: normalizeVectorInputMap(vector.inputs ?? {}),
    expected: normalizeVectorInputMap(vector.expected ?? {}),
    caseIndex: index,
  }));

  return {
    rows: [],
    trace: [],
    evidence: {
      ioRows: ioRows.map((row) => ({
        id: row.id,
        label: row.label,
        nodeId: row.nodeId,
        direction: row.direction,
      })),
      vectors: evidenceVectors,
      normalizationMap: [],
      preflight: model.blockingDiagnostics.map((diagnostic) => ({
        kind: 'invalid-ir' as const,
        code: diagnostic.code,
        severity: diagnostic.severity,
        blocking: diagnostic.severity === 'error',
        signal: diagnostic.nodeId ?? diagnostic.netName ?? diagnostic.code,
        message: diagnostic.message,
        nodeId: diagnostic.nodeId,
        port: diagnostic.port,
        netName: diagnostic.netName,
      })),
      failures: [],
    },
  };
}

function buildUnsupportedTemporalResult(
  ioRows: SimulationIoRow[],
  vectors: TestVector[],
  scheduleContract: VerifyScheduleContract
): DeterministicVerifyResult {
  const evidenceVectors: VerifyReportVector[] = vectors.map((vector, index) => ({
    id: `vec-${String(index + 1).padStart(2, '0')}`,
    tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
    inputs: normalizeVectorInputMap(vector.inputs ?? {}),
    expected: normalizeVectorInputMap(vector.expected ?? {}),
    caseIndex: index,
  }));

  return {
    rows: [],
    trace: [],
    evidence: {
      ioRows: ioRows.map((row) => ({
        id: row.id,
        label: row.label,
        nodeId: row.nodeId,
        direction: row.direction,
      })),
      vectors: evidenceVectors,
      normalizationMap: [],
      preflight: scheduleContract.temporalIssues.map((issue) => ({
        kind: 'unsupported-temporal' as const,
        code: issue.code,
        severity: 'error' as const,
        blocking: true,
        signal: scheduleContract.clockSignalName ?? issue.code,
        message: issue.message,
      })),
      failures: [],
    },
  };
}

function toIoMappingFromSimulationRows(ioRows: SimulationIoRow[]): IoMapping {
  return {
    inputs: ioRows
      .filter((row) => row.direction === 'in')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? '',
        port: 'out',
        label: row.label,
      })),
    outputs: ioRows
      .filter((row) => row.direction === 'out')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? '',
        port: 'in',
        label: row.label,
      })),
  };
}

function buildDefaultScheduleContract(): VerifyScheduleContract {
  return {
    schedule: 'combinational',
    reason: 'no-sequential',
    analysis: {
      hasClockedMacros: false,
      hasClockNet: false,
      sequentialNodes: [],
    },
    needsSimClockInjection: false,
    samplePoint: 'steady-state',
    tick0Meaning: null,
    hasUnsupportedTemporal: false,
    temporalIssues: [],
  };
}

function normalizeVectorInputMap(record: Record<string, unknown>): Record<string, 0 | 1> {
  const normalized: Record<string, 0 | 1> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[normalizeIoSignalKey(key)] = normalizeBit(value);
  }
  return normalized;
}

function buildInputBindingsFromModel(
  ioRows: SimulationIoRow[],
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

function resolveIoRowByKey(
  rawKey: string,
  rows: SimulationIoRow[],
  modelPorts: SimulationModelPortRef[]
): { row: SimulationIoRow; signal: string; modelPort?: SimulationModelPortRef } | null {
  const normalizedKey = normalizeIoSignalKey(rawKey);
  for (const row of rows) {
    const modelPort = resolveModelPortForRow(row, modelPorts);
    const candidates = [
        ...getIoSignalLookupKeys(row, rows),
      modelPort?.canonicalName ?? '',
      modelPort?.sourceNodeId ?? '',
    ]
      .map((entry) => normalizeIoSignalKey(entry))
      .filter(Boolean);
    if (candidates.includes(normalizedKey)) {
      return {
        row,
          signal: getCanonicalIoSignalKey(row, rows),
        modelPort,
      };
    }
  }
  return null;
}

function resolveVectorBitSymbol(
  expected: Record<string, boolean | number | string | undefined>,
  row: SimulationIoRow,
  rows: SimulationIoRow[]
): string {
  const lookupKeys = new Set(getIoSignalLookupKeys(row, rows));
  for (const [rawKey, value] of Object.entries(expected)) {
    if (lookupKeys.has(normalizeIoSignalKey(rawKey))) {
      return normalizeBit(value) === 1 ? '1' : '0';
    }
  }
  return '0';
}

function resolveOutputSymbolFromTrace(
  sample: RuntimeSimTraceSample | undefined,
  row: SimulationIoRow,
  model: SimulationModel | undefined
): string {
  return resolveOutputSymbolFromTraceDetailed(sample, row, model).symbol;
}

function resolveOutputSymbolFromTraceDetailed(
  sample: RuntimeSimTraceSample | undefined,
  row: SimulationIoRow,
  model: SimulationModel | undefined
): {
  symbol: string;
  sourceKey: string | null;
  reason: 'matched' | 'missing-output-node' | 'missing-output-sample';
} {
  if (!row.nodeId || !model) {
    return { symbol: '-', sourceKey: null, reason: 'missing-output-node' };
  }
  const modelPort = resolveModelPortForRow(row, model.outputs);
  if (!modelPort) {
    return { symbol: '-', sourceKey: null, reason: 'missing-output-node' };
  }
  if (!sample) {
    return { symbol: '-', sourceKey: null, reason: 'missing-output-sample' };
  }
  const outputBinding = model.outputBindings.find(
    (binding) => binding.outputPortId === modelPort.portId
  );
  const candidates = [
    `${modelPort.sourceNodeId}.in`,
    `${modelPort.sourceNodeId}.out`,
    outputBinding?.driverSourceNodeId ? `${outputBinding.driverSourceNodeId}.out` : '',
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

function deriveSimulationInputsFromModel(
  model: SimulationModel,
  executionCircuit: Circuit,
  previousInputs?: Record<string, 0 | 1>
): Record<string, 0 | 1> {
  const nodesById = new Map(executionCircuit.nodes.map((node) => [node.id, node]));
  const nextInputs: Record<string, 0 | 1> = {};
  for (const port of getExternallyDrivenPorts(model)) {
    const executionNode = nodesById.get(port.sourceNodeId);
    const currentState = executionNode?.state?.isOn;
    if (currentState !== undefined) {
      nextInputs[port.sourceNodeId] = normalizeBit(currentState);
      continue;
    }
    const previous = previousInputs?.[port.sourceNodeId];
    nextInputs[port.sourceNodeId] = previous === 0 || previous === 1 ? previous : 0;
  }
  return nextInputs;
}

function resolveClockNodeIdFromModel(
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  scheduleContract: VerifyScheduleContract
): string | undefined {
  if (scheduleContract.needsSimClockInjection) {
    return INTERNAL_SIM_CLOCK_NAME;
  }
  const signalName = normalizeIoSignalKey(scheduleContract.clockSignalName ?? '');
  if (signalName) {
    const matchedPort = getExternallyDrivenPorts(model).find((port) =>
      buildLookupKeysForPort(port).includes(signalName)
    );
    if (matchedPort) {
      return matchedPort.sourceNodeId;
    }
  }
  const rowMatch = resolveInputNodeIdBySignalNameFromModel(model, ioRows, scheduleContract.clockSignalName);
  if (rowMatch) {
    return rowMatch;
  }
  const uniqueClockBindingSources = Array.from(
    new Set(
      model.clockBindings
        .map((binding) => binding.boundarySourceNodeId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );
  return uniqueClockBindingSources.length === 1 ? uniqueClockBindingSources[0] : undefined;
}

function resolveResetNodeIdFromModel(
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  scheduleContract?: VerifyScheduleContract
): string | undefined {
  const resetSignalName = scheduleContract?.resetHint?.signalName;
  if (resetSignalName) {
    const resolved = resolveInputNodeIdBySignalNameFromModel(model, ioRows, resetSignalName);
    if (resolved) {
      return resolved;
    }
  }

  const uniqueResetBindingSources = Array.from(
    new Set(
      model.resetBindings
        .map((binding) => binding.boundarySourceNodeId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );
  if (uniqueResetBindingSources.length === 1) {
    return uniqueResetBindingSources[0];
  }

  const rows = ioRows.filter((row) => row.direction === 'in');
  for (const row of rows) {
    const normalized = normalizeIoSignalKey(row.label || row.id);
    if (normalized === 'rst' || normalized === 'reset' || normalized === 'clr' || normalized === 'clear') {
      const fallback = getExternallyDrivenPorts(model).find((port) =>
        buildLookupKeys(row, port).includes(normalized)
      );
      if (fallback) {
        return fallback.sourceNodeId;
      }
    }
  }
  return undefined;
}

function resolveInputNodeIdBySignalNameFromModel(
  model: SimulationModel,
  ioRows: SimulationIoRow[],
  signalName: string | undefined
): string | undefined {
  const normalizedSignalName = normalizeIoSignalKey(signalName ?? '');
  if (!normalizedSignalName) return undefined;

  for (const row of ioRows.filter((entry) => entry.direction === 'in')) {
    const modelPort = resolveModelPortForRow(row, getExternallyDrivenPorts(model));
    const rowCandidates = [
      row.id,
      row.label,
      row.nodeId ?? '',
      modelPort?.canonicalName ?? '',
      modelPort?.sourceNodeId ?? '',
    ]
      .map((value) => normalizeIoSignalKey(value))
      .filter(Boolean);
    if (rowCandidates.includes(normalizedSignalName) && modelPort) {
      return modelPort.sourceNodeId;
    }
  }

  const fallbackPort = getExternallyDrivenPorts(model).find((port) =>
    buildLookupKeysForPort(port).includes(normalizedSignalName)
  );
  return fallbackPort?.sourceNodeId;
}

function applyInputsToEngine(engine: CircuitEngine, inputs: Record<string, 0 | 1>): void {
  for (const [nodeId, value] of Object.entries(inputs)) {
    engine.setNodeValue(nodeId, value);
  }
}

function normalizeSignalMap(
  engine: CircuitEngine,
  model: SimulationModel
): Record<string, 0 | 1> {
  const signalMap = engine.getAllSignals();
  const next: Record<string, 0 | 1> = {};
  const keys = Array.from(signalMap.keys()).sort(compareText);
  for (const key of keys) {
    next[key] = normalizeBit(signalMap.get(key));
  }

  for (const output of model.outputs) {
    const nodeState = engine.getNodeState(output.sourceNodeId);
    const value = normalizeBit(
      nodeState?.isOn ?? next[`${output.sourceNodeId}.in`] ?? next[`${output.sourceNodeId}.out`] ?? 0
    );
    next[`${output.sourceNodeId}.in`] = value;
    next[`${output.sourceNodeId}.out`] = value;
  }

  const orderedEntries = Object.entries(next).sort(([left], [right]) => compareText(left, right));
  return Object.fromEntries(orderedEntries) as Record<string, 0 | 1>;
}

function computeTraceHash(irHash: string, trace: RuntimeSimTraceSample[]): string {
  return `sim_${digestValue({ irHash, trace })}`;
}

function buildBlockedSimResult(model: SimulationModel): SimEngineResult<RuntimeSimState> {
  return {
    status: 'blocked',
    reason: 'invalid-ir',
    diagnostics: model.blockingDiagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function toRuntimeSimGuard(model: SimulationModel): RuntimeSimGuard {
  return {
    status: 'blocked',
    reason: 'invalid-ir',
    // Normalize at engine boundary: IRDiagnostic → IdeDiagnostic so no raw IR types leak upward.
    diagnostics: model.blockingDiagnostics.map((diagnostic) => adaptIrDiagnostic(diagnostic)),
    irHash: model.irHash,
  };
}

function resolveModelPortForRow(
  row: SimulationIoRow,
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

function buildLookupKeys(row: SimulationIoRow, modelPort: SimulationModelPortRef): string[] {
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
  for (const port of [...model.inputs, ...model.resets]) {
    if (!deduped.has(port.sourceNodeId)) {
      deduped.set(port.sourceNodeId, port);
    }
  }
  return Array.from(deduped.values()).sort((left, right) =>
    compareText(left.sourceNodeId, right.sourceNodeId)
  );
}

function cloneExecutionCircuit(circuit: Circuit): Circuit {
  return {
    nodes: circuit.nodes.map((node) => ({ ...node })),
    connections: circuit.connections.map((connection) => ({ ...connection })),
  };
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
