import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { stableStringify } from '../../export/stableStringify';
import { compareCodepoint } from '../../export/codepointSort';
import { deriveVerifySchedule } from '../../fpga/boards/basys3/verifySchedule';
import { deriveIoSignalRoles } from './ioSignalRoles';
import { simulateExpectedIoRows } from './sim/simEngine';
import type { SimulatedExpectedIoRow } from './sim/simTypes';
import {
  getCanonicalIoSignalKey,
  getStudentFacingIoLabel,
  normalizeIoSignalKey,
} from './ioLabels';

export interface BringUpIoRow {
  id: string;
  nodeId?: string;
  label: string;
  port?: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}

export interface BringUpExpectedIoSignal {
  signal: string;
  direction: 'in' | 'out';
  pin: string;
  values: Array<{
    tick: number;
    expected: '0' | '1' | '-';
  }>;
}

export interface BringUpExpectedIoReport {
  schemaVersion: 'rb.expected-io.v1';
  board: 'basys3';
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
}

export interface BringUpArtifacts {
  bringupMarkdown: string;
  expectedIoJson: string;
  programAndTestTcl: string;
  expectedIo: BringUpExpectedIoReport;
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

  if (inputSignals.length === 0) return [];

  if (isSequentialDesign(params.circuit, inputSignals)) {
    const signalRoles = deriveIoSignalRoles(
      params.ioRows,
      deriveVerifySchedule(params.circuit, toIoMapping(params.ioRows))
    );
    return buildSequentialBringUpVectors(inputSignals, outputSignals, signalRoles);
  }

  return buildCombinationalBringUpVectors(
    inputSignals,
    outputSignals,
    params.existingVectors ?? []
  );
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
      direction: 'out' as const,
      pin: row.pin,
      values,
    };
  });

  return {
    schemaVersion: 'rb.expected-io.v1',
    board: 'basys3',
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
    .map((row) => `- ${getCanonicalIoSignalKey(row, input.ioRows)} -> ${row.pin}`);

  const lines = [
    '# Basys3 Bring-Up',
    `- Project: ${input.projectName}`,
    '- Board: Basys3 (xc7a35tcpg236-1)',
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

function buildSequentialBringUpVectors(
  inputSignals: string[],
  outputSignals: string[],
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'>
): TestVector[] {
  const vectors: TestVector[] = [];
  const semanticClockSignals = new Set(
    Object.entries(signalRoles)
      .filter(([, role]) => role === 'clock')
      .map(([signal]) => normalizeIoSignalKey(signal))
  );
  const clock =
    inputSignals.find((signal) => semanticClockSignals.has(normalizeIoSignalKey(signal))) ??
    inputSignals.find((signal) => CLOCK_ALIASES.has(signal)) ??
    inputSignals[0];
  const reset = inputSignals.find((signal) => RESET_ALIASES.has(signal));
  const enable = inputSignals.find((signal) => ENABLE_ALIASES.has(signal));

  let previousClock = 0;
  let counterValue = 0;
  const totalTicks = 18;

  for (let tick = 0; tick < totalTicks; tick++) {
    const inputs: Record<string, 0 | 1> = {};
    for (const signal of inputSignals) {
      inputs[signal] = 0;
    }

    const clockValue: 0 | 1 = tick % 2 === 0 ? 0 : 1;
    inputs[clock] = clockValue;
    if (reset) {
      inputs[reset] = tick < 2 ? 1 : 0;
    }
    if (enable) {
      inputs[enable] = tick >= 2 ? 1 : 0;
    }

    const resetActive = reset ? inputs[reset] === 1 : false;
    const enableActive = enable ? inputs[enable] === 1 : true;
    const risingEdge = previousClock === 0 && clockValue === 1;

    if (resetActive) {
      counterValue = 0;
    } else if (risingEdge && enableActive) {
      counterValue += 1;
    }

    const expected: Record<string, 0 | 1> = {};
    for (let index = 0; index < outputSignals.length; index++) {
      const signal = outputSignals[index];
      const bitIndex = inferCounterBitIndex(signal, index);
      expected[signal] = ((counterValue >> bitIndex) & 1) as 0 | 1;
    }

    vectors.push({
      id: `bringup-${String(tick + 1).padStart(2, '0')}`,
      tick,
      inputs,
      expected,
    });

    previousClock = clockValue;
  }

  return vectors;
}

function buildCombinationalBringUpVectors(
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

  return vectors;
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

function normalizeBitSymbol(value: unknown): '0' | '1' | '-' {
  if (value === true || value === 1 || value === '1') return '1';
  if (value === false || value === 0 || value === '0') return '0';
  return '-';
}

function sortSignals(signals: string[]): string[] {
  return [...new Set(signals)].sort(compareCodepoint);
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
