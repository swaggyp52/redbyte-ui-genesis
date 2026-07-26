import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { stableStringify } from '../../export/stableStringify';
import { compareCodepoint } from '../../export/codepointSort';
import { deriveVerifySchedule } from '../../fpga/boards/basys3/verifySchedule';
import { resolveBasys3PackagePin } from '../../fpga/boards/basys3/basys3Pins';
import { deriveIoSignalRoles } from './ioSignalRoles';
import {
  simulateExpectedIoRows,
  type VerifyClockExecutionPolicy,
} from './sim/simEngine';
import type { SimulatedExpectedIoRow } from './sim/simTypes';
import {
  getCanonicalIoSignalKey,
  getStudentFacingIoLabel,
  normalizeIoSignalKey,
} from './ioLabels';
import { getClockHelperValueForTick } from './clockAuthority';
import { stripExpectedOutputs } from './projectIdentity';

export interface BringUpIoRow {
  id: string;
  nodeId?: string;
  label: string;
  port?: string;
  direction: 'in' | 'out';
  pin: string;
  packagePin?: string;
  artifactPortName?: string;
  boardResourceId?: string | null;
  boardResourceLabel?: string | null;
  exactXdcLine?: string;
  required: boolean;
}

export interface BringUpExpectedIoSignal {
  signal: string;
  logicalSignalId: string;
  logicalLabel: string;
  artifactPortName?: string;
  boardResourceId?: string | null;
  boardResourceLabel?: string | null;
  exactXdcLine?: string;
  direction: 'in' | 'out';
  pin: string;
  packagePin: string;
  values: Array<{
    tick: number;
    expected: '0' | '1' | '-';
  }>;
}

export interface BringUpExpectedIoReport {
  schemaVersion: 'rb.expected-io.v1';
  board: 'basys3';
  evidenceLevel: 'E0';
  source: 'verify-run' | 'project-vectors';
  generatedAtIso: string;
  verifyHash?: string;
  verifyReportHash?: string;
  vectorsCount: number;
  signals: BringUpExpectedIoSignal[];
}

export interface BringUpArtifactsInput {
  project: RBProject;
  ioRows: BringUpIoRow[];
  expectedBehavior: string;
  exportHash?: string;
  verifyHash?: string;
  verifyReportHash?: string;
  verifyGeneratedAtIso?: string;
  verifyRows?: Array<{
    tick: number;
    signal: string;
    expected: string;
    actual: string;
  }>;
  clockPolicy?: VerifyClockExecutionPolicy;
}

export interface BringUpArtifacts {
  bringupMarkdown: string;
  expectedIoJson: string;
  programAndTestTcl: string;
  expectedIo: BringUpExpectedIoReport;
}

export type BringUpGenerationMode =
  | 'combinational'
  | 'sequential-counter'
  | 'sequential-register'
  | 'sequential-simulated';

export interface BringUpGenerationResult {
  vectors: TestVector[];
  mode: BringUpGenerationMode;
  guidance?: string;
}

const CLOCK_ALIASES = new Set(['clk', 'clock', 'clk100mhz']);
const RESET_ALIASES = new Set(['rst', 'reset', 'rst_n', 'reset_n']);
const ENABLE_ALIASES = new Set(['count_en', 'enable', 'en']);
const SEQUENTIAL_NODE_TYPES = new Set([
  'clock',
  'dflipflop',
  'dff',
  'register',
  'counter',
]);

export function generateBringUpVectors(params: {
  ioRows: BringUpIoRow[];
  circuit: Circuit;
  existingVectors?: TestVector[];
}): TestVector[] {
  return buildBringUpGeneration(params).vectors;
}

export function generateStimulusVectors(params: {
  ioRows: BringUpIoRow[];
  circuit: Circuit;
  existingVectors?: TestVector[];
}): TestVector[] {
  return stripExpectedOutputs(buildBringUpGeneration(params).vectors);
}

export function buildBringUpGeneration(params: {
  ioRows: BringUpIoRow[];
  circuit: Circuit;
  existingVectors?: TestVector[];
}): BringUpGenerationResult {
  const inputRows = params.ioRows.filter((row) => row.direction === 'in');
  const inputSignals = sortSignals(
    inputRows
      .map((row) => getCanonicalIoSignalKey(row, inputRows))
      .filter((value) => value.length > 0)
  );
  const outputRows = params.ioRows.filter((row) => row.direction === 'out');
  const outputSignals = sortSignals(
    outputRows
      .map((row) => getCanonicalIoSignalKey(row, outputRows))
      .filter((value) => value.length > 0)
  );

  if (inputSignals.length === 0) {
    return {
      vectors: [],
      mode: 'combinational',
    };
  }

  if (isSequentialDesign(params.circuit, inputSignals)) {
    const signalRoles = deriveIoSignalRoles(
      params.ioRows,
      deriveVerifySchedule(params.circuit, toIoMapping(params.ioRows))
    );
    return buildSequentialBringUpGeneration(
      params.circuit,
      params.ioRows,
      inputSignals,
      outputSignals,
      signalRoles
    );
  }

  return {
    vectors: buildCombinationalBringUpVectors(
      params.circuit,
      params.ioRows,
      inputSignals,
      outputSignals,
      params.existingVectors ?? []
    ),
    mode: 'combinational',
  };
}

export function buildBringUpArtifacts(input: BringUpArtifactsInput): BringUpArtifacts {
  const expectedIo = buildExpectedIoReport(input);
  const bringupMarkdown = buildBringUpMarkdown({
    projectName: input.project.name,
    expectedBehavior: input.expectedBehavior,
    ioRows: input.ioRows,
    exportHash: input.exportHash,
    verifyHash: input.verifyHash,
  });
  const programAndTestTcl = buildProgramAndTestTcl(input.project);

  return {
    bringupMarkdown,
    expectedIoJson: stableStringify(expectedIo),
    programAndTestTcl,
    expectedIo,
  };
}

function buildExpectedIoReport(input: BringUpArtifactsInput): BringUpExpectedIoReport {
  const outputRows = [...input.ioRows]
    .filter((row) => row.direction === 'out')
    .sort((left, right) =>
      compareCodepoint(
        getCanonicalIoSignalKey(left, input.ioRows),
        getCanonicalIoSignalKey(right, input.ioRows)
      )
    );

  const verifyRows = input.verifyRows ?? [];
  const hasVerifyRows = verifyRows.length > 0;
  const simulatedRows =
    !hasVerifyRows && (input.project.vectors ?? []).length > 0
      ? simulateExpectedIoRows({
          circuit: input.project.circuit,
          ioRows: input.ioRows,
          vectors: input.project.vectors ?? [],
          clockPolicy: input.clockPolicy,
        })
      : [];
  const vectorTicks = uniqueSortedTicks(input.project.vectors ?? []);
  const verifyTicks = uniqueSortedTicks(verifyRows);
  const ticks = hasVerifyRows ? verifyTicks : vectorTicks;

  const signals = outputRows.map((row) => {
    const signalName = getCanonicalIoSignalKey(row, outputRows);
    const values = ticks.map((tick) => ({
      tick,
      expected: resolveExpectedValue({
        tick,
        signalName,
        vectors: input.project.vectors ?? [],
        verifyRows,
        simulatedRows,
      }),
    }));

    return {
      signal: signalName,
      logicalSignalId: row.id,
      logicalLabel: row.label,
      artifactPortName: row.artifactPortName,
      boardResourceId: row.boardResourceId,
      boardResourceLabel: row.boardResourceLabel,
      exactXdcLine: row.exactXdcLine,
      direction: 'out' as const,
      pin: row.pin,
      packagePin: row.packagePin ?? resolveBasys3PackagePin(row.pin) ?? row.pin,
      values,
    };
  });

  return {
    schemaVersion: 'rb.expected-io.v1',
    board: 'basys3',
    evidenceLevel: 'E0',
    source: hasVerifyRows ? 'verify-run' : 'project-vectors',
    generatedAtIso:
      input.verifyGeneratedAtIso ??
      input.project.updatedAt ??
      input.project.createdAt ??
      '1970-01-01T00:00:00.000Z',
    verifyHash: input.verifyHash,
    verifyReportHash: input.verifyReportHash,
    vectorsCount: (input.project.vectors ?? []).length,
    signals,
  };
}

function buildBringUpMarkdown(input: {
  projectName: string;
  expectedBehavior: string;
  ioRows: BringUpIoRow[];
  exportHash?: string;
  verifyHash?: string;
}): string {
  const mappingLines = [...input.ioRows]
    .filter((row) => row.pin.trim().length > 0)
    .sort((left, right) =>
      compareCodepoint(
        getCanonicalIoSignalKey(left, input.ioRows),
        getCanonicalIoSignalKey(right, input.ioRows)
      )
    )
    .slice(0, 6)
    .map((row) => {
      const logicalSignal = getCanonicalIoSignalKey(row, input.ioRows);
      const artifactPort = row.artifactPortName ?? logicalSignal;
      const packagePin = row.packagePin ?? resolveBasys3PackagePin(row.pin) ?? row.pin;
      return `- ${logicalSignal} -> ${artifactPort} -> ${row.pin} / ${packagePin}`;
    });

  const lines = [
    '# Basys3 Bring-Up',
    `- Project: ${input.projectName}`,
    '- Board: Basys3 (xc7a35tcpg236-1)',
    '- Evidence Level: E0 export package only',
    `- Export Hash: ${input.exportHash ?? 'pending'}`,
    `- Verify Hash: ${input.verifyHash ?? 'pending'}`,
    '',
    '## Steps',
    '1. Extract bundle contents.',
    '2. Run: vivado -mode batch -source vivado_import.tcl',
    '3. Generate/program bitstream in Vivado.',
    '4. Validate outputs against EXPECTED_IO.json.',
    '',
    '## Expected Behavior',
    `- ${input.expectedBehavior.trim() || 'Outputs should match deterministic verify vectors.'}`,
    '',
    '## Signal Mapping',
    ...(mappingLines.length > 0 ? mappingLines : ['- No mapped pins yet.']),
  ];

  return lines.slice(0, 20).join('\n');
}

function buildProgramAndTestTcl(project: RBProject): string {
  const projectName = sanitizeIdentifier(project.name, 'redbyte_project');
  const topEntity = sanitizeIdentifier(
    project.fpga?.top ?? project.hdl?.top ?? 'top',
    'top'
  );

  return [
    '# RedByte Basys3 program-and-test scaffold',
    `set project_name "${projectName}"`,
    `set top_module "${topEntity}"`,
    'set project_dir [pwd]',
    'set bitstream_path [file normalize [file join $project_dir "${project_name}.runs" "impl_1" "${top_module}.bit"]]',
    '',
    'open_hw_manager',
    'connect_hw_server',
    'open_hw_target',
    'set device [lindex [get_hw_devices] 0]',
    'current_hw_device $device',
    'refresh_hw_device $device',
    '# set_property PROGRAM.FILE $bitstream_path $device',
    '# program_hw_devices $device',
    'puts "Update bitstream_path if needed, then uncomment PROGRAM.FILE/program commands."',
  ].join('\n');
}

interface SequentialControlSignals {
  clock: string;
  reset?: string;
  enable?: string;
  dataInputs: string[];
}

interface SequentialTimelineEntry {
  tick: number;
  inputs: Record<string, 0 | 1>;
  risingEdge: boolean;
  resetActive: boolean;
  enableActive: boolean;
  phaseIndex: number;
}

interface RegisterOutputMappingEntry {
  signal: string;
  sourceInput: string;
  invert: boolean;
}

function buildSequentialBringUpGeneration(
  circuit: Circuit,
  ioRows: BringUpIoRow[],
  inputSignals: string[],
  outputSignals: string[],
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'>
): BringUpGenerationResult {
  const controlSignals = resolveSequentialControlSignals(inputSignals, signalRoles);
  if (isCounterLikeSequentialDesign(circuit, controlSignals.dataInputs, outputSignals)) {
    return {
      vectors: buildCounterBringUpVectors(outputSignals, controlSignals),
      mode: 'sequential-counter',
    };
  }

  const registerMapping = inferRegisterOutputMapping(
    controlSignals.dataInputs,
    outputSignals
  );
  if (registerMapping.length > 0) {
    return {
      vectors: buildRegisterBringUpVectors(registerMapping, controlSignals),
      mode: 'sequential-register',
    };
  }

  return {
    vectors: buildSimulatedSequentialVectors(circuit, ioRows, outputSignals, controlSignals),
    mode: 'sequential-simulated',
    guidance:
      'Starter vectors include clocked stimulus plus simulated expected outputs from the current circuit.',
  };
}

function resolveSequentialControlSignals(
  inputSignals: string[],
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'>
): SequentialControlSignals {
  const semanticClockSignals = new Set(
    Object.entries(signalRoles)
      .filter(([, role]) => role === 'clock')
      .map(([signal]) => normalizeIoSignalKey(signal))
  );
  const semanticResetSignals = new Set(
    Object.entries(signalRoles)
      .filter(([, role]) => role === 'reset')
      .map(([signal]) => normalizeIoSignalKey(signal))
  );
  const clock =
    inputSignals.find((signal) => semanticClockSignals.has(normalizeIoSignalKey(signal))) ??
    inputSignals.find((signal) => CLOCK_ALIASES.has(signal)) ??
    inputSignals[0];
  const reset =
    inputSignals.find((signal) => semanticResetSignals.has(normalizeIoSignalKey(signal))) ??
    inputSignals.find((signal) => RESET_ALIASES.has(signal));
  const enable = inputSignals.find((signal) => ENABLE_ALIASES.has(signal));
  const dataInputs = inputSignals.filter(
    (signal) => signal !== clock && signal !== reset && signal !== enable
  );

  return {
    clock,
    reset,
    enable,
    dataInputs,
  };
}

function buildSequentialTimeline(
  controlSignals: SequentialControlSignals,
  totalTicks: number
): SequentialTimelineEntry[] {
  const timeline: SequentialTimelineEntry[] = [];
  let previousClock: 0 | 1 = 0;

  for (let tick = 0; tick < totalTicks; tick++) {
    const inputs: Record<string, 0 | 1> = {};
    for (const signal of [
      controlSignals.clock,
      controlSignals.reset,
      controlSignals.enable,
      ...controlSignals.dataInputs,
    ].filter((value): value is string => Boolean(value))) {
      inputs[signal] = 0;
    }

    const clockValue = getClockHelperValueForTick(tick, 'alternating');
    inputs[controlSignals.clock] = clockValue;
    if (controlSignals.reset) {
      inputs[controlSignals.reset] = tick < 2 ? 1 : 0;
    }
    if (controlSignals.enable) {
      inputs[controlSignals.enable] = tick >= 2 ? 1 : 0;
    }

    const phaseIndex = Math.max(0, Math.floor(Math.max(0, tick - 2) / 2));
    for (let index = 0; index < controlSignals.dataInputs.length; index++) {
      const signal = controlSignals.dataInputs[index];
      const patternValue =
        controlSignals.dataInputs.length === 1
          ? ((phaseIndex + 1) % 2)
          : ((phaseIndex >> index) & 1);
      inputs[signal] = (tick < 2 ? 0 : patternValue) as 0 | 1;
    }

    const resetActive = controlSignals.reset ? inputs[controlSignals.reset] === 1 : false;
    const enableActive = controlSignals.enable ? inputs[controlSignals.enable] === 1 : true;
    const risingEdge = previousClock === 0 && clockValue === 1;
    previousClock = clockValue;

    timeline.push({
      tick,
      inputs,
      risingEdge,
      resetActive,
      enableActive,
      phaseIndex,
    });
  }

  return timeline;
}

function buildCounterBringUpVectors(
  outputSignals: string[],
  controlSignals: SequentialControlSignals
): TestVector[] {
  const vectors: TestVector[] = [];
  const timeline = buildSequentialTimeline(controlSignals, 18);
  let counterValue = 0;

  for (const entry of timeline) {
    if (entry.resetActive) {
      counterValue = 0;
    } else if (entry.risingEdge && entry.enableActive) {
      counterValue += 1;
    }

    const expected: Record<string, 0 | 1> = {};
    for (let index = 0; index < outputSignals.length; index++) {
      const signal = outputSignals[index];
      const bitIndex = inferCounterBitIndex(signal, index);
      expected[signal] = ((counterValue >> bitIndex) & 1) as 0 | 1;
    }

    vectors.push({
      id: `bringup-${String(entry.tick + 1).padStart(2, '0')}`,
      tick: entry.tick,
      inputs: entry.inputs,
      expected,
    });
  }

  return vectors;
}

function buildRegisterBringUpVectors(
  mapping: RegisterOutputMappingEntry[],
  controlSignals: SequentialControlSignals
): TestVector[] {
  const vectors: TestVector[] = [];
  const timeline = buildSequentialTimeline(controlSignals, 8);
  const latchedInputs: Record<string, 0 | 1> = {};
  for (const entry of mapping) {
    latchedInputs[entry.sourceInput] = 0;
  }

  for (const entry of timeline) {
    if (entry.resetActive) {
      for (const sourceInput of Object.keys(latchedInputs)) {
        latchedInputs[sourceInput] = 0;
      }
    } else if (entry.risingEdge && entry.enableActive) {
      for (const sourceInput of Object.keys(latchedInputs)) {
        latchedInputs[sourceInput] = entry.inputs[sourceInput] ?? 0;
      }
    }

    const expected: Record<string, 0 | 1> = {};
    for (const output of mapping) {
      const sampled = latchedInputs[output.sourceInput] ?? 0;
      expected[output.signal] = output.invert ? invertBit(sampled) : sampled;
    }

    vectors.push({
      id: `bringup-${String(entry.tick + 1).padStart(2, '0')}`,
      tick: entry.tick,
      inputs: entry.inputs,
      expected,
    });
  }

  return vectors;
}

function buildStimulusOnlySequentialVectors(
  controlSignals: SequentialControlSignals
): TestVector[] {
  return buildSequentialTimeline(controlSignals, 12).map((entry) => ({
    id: `bringup-${String(entry.tick + 1).padStart(2, '0')}`,
    tick: entry.tick,
    inputs: entry.inputs,
    expected: {},
  }));
}

function buildSimulatedSequentialVectors(
  circuit: Circuit,
  ioRows: BringUpIoRow[],
  outputSignals: string[],
  controlSignals: SequentialControlSignals
): TestVector[] {
  const vectors = buildStimulusOnlySequentialVectors(controlSignals);
  if (outputSignals.length === 0) {
    return vectors;
  }

  const simulatedRows = simulateExpectedIoRows({
    circuit,
    ioRows,
    vectors,
  });
  const simulatedExpectedByTick = new Map<number, Record<string, 0 | 1>>();
  for (const row of simulatedRows) {
    const bucket = simulatedExpectedByTick.get(row.tick) ?? {};
    bucket[normalizeIoSignalKey(row.signal)] = row.expected === '1' ? 1 : 0;
    simulatedExpectedByTick.set(row.tick, bucket);
  }

  return vectors.map((vector) => {
    const simulatedExpected = simulatedExpectedByTick.get(vector.tick) ?? {};
    const expected: Record<string, 0 | 1> = {};
    for (const signal of outputSignals) {
      const normalizedSignal = normalizeIoSignalKey(signal);
      expected[signal] = simulatedExpected[normalizedSignal] ?? 0;
    }
    return {
      ...vector,
      expected,
    };
  });
}

function buildCombinationalBringUpVectors(
  circuit: Circuit,
  ioRows: BringUpIoRow[],
  inputSignals: string[],
  outputSignals: string[],
  existingVectors: TestVector[]
): TestVector[] {
  const maxCases = Math.min(16, 2 ** Math.min(inputSignals.length, 8));
  const expectedBySignature = new Map<string, Record<string, 0 | 1>>();
  for (const vector of existingVectors) {
    const signature = signatureFromInputs(inputSignals, vector.inputs ?? {});
    if (!expectedBySignature.has(signature)) {
      expectedBySignature.set(signature, normalizeBitRecord(vector.expected ?? {}));
    }
  }

  const vectors: TestVector[] = [];
  for (let tick = 0; tick < maxCases; tick++) {
    const inputs: Record<string, 0 | 1> = {};
    for (let index = 0; index < inputSignals.length; index++) {
      inputs[inputSignals[index]] = ((tick >> index) & 1) as 0 | 1;
    }

    const signature = signatureFromInputs(inputSignals, inputs);
    const derivedExpected = expectedBySignature.get(signature);
    const expected: Record<string, 0 | 1> = {};
    for (const signal of outputSignals) {
      expected[signal] = derivedExpected?.[signal] ?? 0;
    }

    vectors.push({
      id: `bringup-${String(tick + 1).padStart(2, '0')}`,
      tick,
      inputs,
      expected,
    });
  }

  if (outputSignals.length === 0) {
    return vectors;
  }

  const simulatedRows = simulateExpectedIoRows({
    circuit,
    ioRows,
    vectors,
  });
  const simulatedExpectedByTick = new Map<number, Record<string, 0 | 1>>();
  for (const row of simulatedRows) {
    const bucket = simulatedExpectedByTick.get(row.tick) ?? {};
    bucket[normalizeIoSignalKey(row.signal)] = row.expected === '1' ? 1 : 0;
    simulatedExpectedByTick.set(row.tick, bucket);
  }

  return vectors.map((vector) => {
    const simulatedExpected = simulatedExpectedByTick.get(vector.tick) ?? {};
    const expected: Record<string, 0 | 1> = {};
    for (const signal of outputSignals) {
      const normalizedSignal = normalizeIoSignalKey(signal);
      if (normalizedSignal in simulatedExpected) {
        expected[signal] = simulatedExpected[normalizedSignal] ?? 0;
        continue;
      }
      if (signal in (vector.expected ?? {})) {
        expected[signal] = normalizeBit(vector.expected?.[signal]);
        continue;
      }
      expected[signal] = 0;
    }

    return {
      ...vector,
      expected,
    };
  });
}

function resolveExpectedValue(params: {
  tick: number;
  signalName: string;
  vectors: TestVector[];
  verifyRows: Array<{
    tick: number;
    signal: string;
    expected: string;
    actual: string;
  }>;
  simulatedRows: SimulatedExpectedIoRow[];
}): '0' | '1' | '-' {
  const verifyMatch = params.verifyRows.find(
    (row) =>
      row.tick === params.tick &&
      normalizeIoSignalKey(row.signal) === params.signalName
  );
  if (verifyMatch) {
    return normalizeBitSymbol(verifyMatch.expected);
  }

  const simulatedMatch = params.simulatedRows.find(
    (row) => row.tick === params.tick && normalizeIoSignalKey(row.signal) === params.signalName
  );
  if (simulatedMatch) {
    return simulatedMatch.expected;
  }

  const vectorMatch = params.vectors.find((vector) => vector.tick === params.tick);
  if (!vectorMatch) return '-';
  const expected = vectorMatch.expected ?? {};
  const key = Object.keys(expected).find(
    (candidate) => normalizeIoSignalKey(candidate) === params.signalName
  );
  if (!key) return '-';
  return normalizeBitSymbol(expected[key]);
}

function uniqueSortedTicks(rows: Array<{ tick: number }>): number[] {
  const seen = new Set<number>();
  for (const row of rows) {
    const tick = Number.isFinite(row.tick) ? Math.max(0, Math.floor(row.tick)) : 0;
    seen.add(tick);
  }
  return Array.from(seen).sort((left, right) => left - right);
}

function isSequentialDesign(circuit: Circuit, inputSignals: string[]): boolean {
  if (inputSignals.some((signal) => CLOCK_ALIASES.has(signal))) return true;
  return circuit.nodes.some((node) =>
    SEQUENTIAL_NODE_TYPES.has(normalizeIoSignalKey(node.type ?? ''))
  );
}

function isCounterLikeSequentialDesign(
  circuit: Circuit,
  dataInputs: string[],
  outputSignals: string[]
): boolean {
  const hasCounterNode = circuit.nodes.some((node) => {
    const normalizedType = normalizeIoSignalKey(node.type ?? '');
    return normalizedType === 'counter4bit' || normalizedType === 'counter';
  });
  if (hasCounterNode) return true;
  if (dataInputs.length > 0 || outputSignals.length === 0) return false;
  return outputSignals.every((signal) => looksLikeCounterSignal(signal));
}

function inferRegisterOutputMapping(
  dataInputs: string[],
  outputSignals: string[]
): RegisterOutputMappingEntry[] {
  if (dataInputs.length === 0 || outputSignals.length === 0) return [];

  if (outputSignals.length === 1 && dataInputs.length === 1) {
    return [
      {
        signal: outputSignals[0],
        sourceInput: dataInputs[0],
        invert: isInvertedRegisterOutput(outputSignals[0]),
      },
    ];
  }

  const outputPairs = outputSignals.map((signal, index) => ({
    signal,
    invert: isInvertedRegisterOutput(signal),
    suffix: readSignalSuffix(signal),
    index,
  }));
  const inputPairs = dataInputs.map((signal, index) => ({
    signal,
    suffix: readSignalSuffix(signal),
    index,
  }));

  if (
    outputPairs.every((entry) => entry.suffix !== null) &&
    inputPairs.every((entry) => entry.suffix !== null)
  ) {
    const mapped = outputPairs.map((output) => {
      const input = inputPairs.find((candidate) => candidate.suffix === output.suffix);
      if (!input) return null;
      return {
        signal: output.signal,
        sourceInput: input.signal,
        invert: output.invert,
      } satisfies RegisterOutputMappingEntry;
    });
    if (mapped.every((entry): entry is RegisterOutputMappingEntry => entry !== null)) {
      return mapped;
    }
  }

  if (outputSignals.length === dataInputs.length) {
    return outputSignals.map((signal, index) => ({
      signal,
      sourceInput: dataInputs[index],
      invert: isInvertedRegisterOutput(signal),
    }));
  }

  return [];
}

function inferCounterBitIndex(signal: string, fallbackIndex: number): number {
  const match = signal.match(/q(\d+)$/i);
  if (match?.[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return fallbackIndex;
}

function signatureFromInputs(
  orderedInputs: string[],
  values: Record<string, unknown>
): string {
  return orderedInputs
    .map((signal) => `${signal}:${normalizeBit(values[signal])}`)
    .join('|');
}

function normalizeBitRecord(values: Record<string, unknown>): Record<string, 0 | 1> {
  const normalized: Record<string, 0 | 1> = {};
  for (const key of Object.keys(values)) {
    normalized[normalizeIoSignalKey(key)] = normalizeBit(values[key]);
  }
  return normalized;
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function invertBit(value: 0 | 1): 0 | 1 {
  return value === 1 ? 0 : 1;
}

function normalizeBitSymbol(value: unknown): '0' | '1' | '-' {
  if (value === true || value === 1 || value === '1') return '1';
  if (value === false || value === 0 || value === '0') return '0';
  return '-';
}

function sortSignals(signals: string[]): string[] {
  return [...new Set(signals)].sort(compareCodepoint);
}

function looksLikeCounterSignal(signal: string): boolean {
  return /^q\d+$/i.test(signal) || /^count\d+$/i.test(signal);
}

function isInvertedRegisterOutput(signal: string): boolean {
  const normalized = normalizeIoSignalKey(signal);
  return normalized === 'qinv' || normalized === 'q_inv' || normalized === 'qn';
}

function readSignalSuffix(signal: string): number | null {
  const match = signal.match(/(\d+)$/);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIoMapping(ioRows: BringUpIoRow[]): IoMapping {
  return {
    inputs: ioRows
      .filter((row) => row.direction === 'in')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? row.id,
        port: row.port ?? 'out',
        label: row.label,
        pin: row.pin,
      })),
    outputs: ioRows
      .filter((row) => row.direction === 'out')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? row.id,
        port: row.port ?? 'in',
        label: row.label,
        pin: row.pin,
      })),
  };
}

function sanitizeIdentifier(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length === 0) return fallback;
  return normalized;
}
