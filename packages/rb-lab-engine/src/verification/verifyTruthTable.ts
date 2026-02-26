// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Truth Table Verifier - Declarative
 *
 * Verifies circuit behavior matches expected truth table.
 *
 * Supported schedules:
 * - combinational: drive inputs -> tick -> sample outputs
 * - clocked_macro: drive non-clock inputs -> [clk=0 tick, clk=1 tick, clk=0 tick] -> sample outputs
 */

import type {
  CheckpointFailure,
  CheckpointResult,
  LabProjectV1,
  TruthTableCheckpoint,
  VerifySchedule,
} from '@redbyte/rb-utils';
import { CLOCKED_MACRO_SEQUENCE } from '@redbyte/rb-utils';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { toLegacyCircuit } from '../adapters/circuitAdapter';

type FlatTruthRow = Record<string, number | boolean>;
type CanonicalTruthRow = {
  inputs?: Record<string, number | boolean>;
  outputs?: Record<string, number | boolean>;
};
type ExpectedTruthRow = FlatTruthRow | CanonicalTruthRow;
type ActualTruthRow = Record<string, number>;

const SEQUENTIAL_Q_TYPES = new Set([
  'DFlipFlop',
  'DLatch',
  'TFlipFlop',
  'JKFlipFlop',
  'RSLatch',
  'Counter4Bit',
]);

const INPUT_NODE_TYPES = new Set([
  'SWITCH',
  'Switch',
  'INPUT',
  'InputPin',
  'Clock',
  'PowerSource',
]);

const OUTPUT_STATE_NODE_TYPES = new Set(['OUTPUT', 'Lamp', 'LED']);

interface TruthTableContract {
  inputs: string[];
  outputs: string[];
  rows: ExpectedTruthRow[];
  schedule: VerifySchedule;
  clockSignal?: string;
}

export async function verifyTruthTable(
  project: LabProjectV1,
  checkpoint: TruthTableCheckpoint
): Promise<CheckpointResult> {
  const contract = resolveTruthTableContract(checkpoint);
  const { inputs, outputs, rows, schedule, clockSignal } = contract;

  if (schedule === 'clocked_macro') {
    if (!clockSignal || clockSignal.trim().length === 0) {
      return makeConfigFailure(
        'Checkpoint schedule=clocked_macro requires config.clockSignal.',
        rows
      );
    }

    const clockNode = findNodeBySignal(project, clockSignal);
    if (!clockNode) {
      return makeConfigFailure(
        `Clock signal "${clockSignal}" could not be resolved to a node label/id.`,
        rows
      );
    }
  }

  // Convert CircuitV1 to legacy circuit for simulation (temporary during migration)
  const legacyCircuit = toLegacyCircuit(project.circuit);
  const engine = new CircuitEngine(legacyCircuit);

  const actualTable: ActualTruthRow[] = [];
  const failures: CheckpointFailure[] = [];
  const resolvedClockNode = schedule === 'clocked_macro' && clockSignal
    ? findNodeBySignal(project, clockSignal)
    : undefined;

  for (let i = 0; i < rows.length; i++) {
    const expectedRow = rows[i];
    const actualRow: ActualTruthRow = {};

    for (const inputSignal of inputs) {
      if (schedule === 'clocked_macro' && inputSignal === clockSignal) continue;

      const inputValue = normalizeValue(getRowSignalValue(expectedRow, 'inputs', inputSignal));
      actualRow[inputSignal] = inputValue;

      const inputNode = findNodeBySignal(project, inputSignal);
      if (inputNode && INPUT_NODE_TYPES.has(inputNode.type)) {
        engine.setNodeValue(inputNode.id, inputValue);
      }
    }

    if (schedule === 'clocked_macro' && resolvedClockNode) {
      for (const clockValue of CLOCKED_MACRO_SEQUENCE) {
        engine.setNodeValue(resolvedClockNode.id, clockValue);
        engine.tick();
      }
    } else {
      engine.tick();
    }

    for (const outputSignal of outputs) {
      const outputNode = findNodeBySignal(project, outputSignal);
      if (!outputNode) {
        actualRow[outputSignal] = 0;
        continue;
      }

      if (OUTPUT_STATE_NODE_TYPES.has(outputNode.type)) {
        const raw = engine.getNodeState(outputNode.id)?.isOn;
        actualRow[outputSignal] = normalizeValue(raw);
        continue;
      }

      const portName = SEQUENTIAL_Q_TYPES.has(outputNode.type) ? 'Q' : 'out';
      const raw = engine.getNodeValue(outputNode.id, portName);
      actualRow[outputSignal] = normalizeValue(raw);
    }

    actualTable.push(actualRow);

    for (const outputSignal of outputs) {
      const expected = normalizeValue(getRowSignalValue(expectedRow, 'outputs', outputSignal));
      const actual = normalizeValue(actualRow[outputSignal]);

      if (expected !== actual) {
        failures.push({
          message: `Row ${i + 1}: expected ${outputSignal}=${expected}, got ${actual}`,
          jumpTarget: { type: 'table-row', row: i },
        });
      }
    }
  }

  const passed = failures.length === 0;
  const headline = passed
    ? '✓ Truth table matches'
    : `✗ ${failures.length} mismatch${failures.length > 1 ? 'es' : ''} found`;

  return {
    passed,
    headline,
    failures,
    evidence: {
      expected: rows,
      actual: actualTable,
      diff: failures.map((failure) => failure.message),
    },
  };
}

function resolveTruthTableContract(checkpoint: TruthTableCheckpoint): TruthTableContract {
  const config = (checkpoint.config ?? {}) as Partial<TruthTableCheckpoint['config']>;
  const spec = (checkpoint.spec ?? {}) as {
    inputs?: unknown;
    outputs?: unknown;
    expectedTable?: unknown;
    clockSignal?: unknown;
  };

  const inputs = toStringArray(config.inputs) ?? toStringArray(spec.inputs) ?? [];
  const outputs = toStringArray(config.outputs) ?? toStringArray(spec.outputs) ?? [];
  const rows = toRows(config.table) ?? toRows(spec.expectedTable) ?? [];
  const schedule = config.schedule ?? 'combinational';
  const clockSignal = typeof config.clockSignal === 'string'
    ? config.clockSignal
    : typeof spec.clockSignal === 'string'
      ? spec.clockSignal
      : undefined;

  return { inputs, outputs, rows, schedule, clockSignal };
}

function makeConfigFailure(message: string, expectedRows: ExpectedTruthRow[]): CheckpointResult {
  return {
    passed: false,
    headline: '✗ Truth table configuration error',
    failures: [{ message }],
    evidence: {
      expected: expectedRows,
      actual: [],
      diff: [message],
    },
  };
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toRows(value: unknown): ExpectedTruthRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is ExpectedTruthRow => !!entry && typeof entry === 'object');
}

function getRowSignalValue(
  row: ExpectedTruthRow,
  group: 'inputs' | 'outputs',
  signal: string
): number | boolean | undefined {
  if (!row || typeof row !== 'object') return undefined;

  const nested = (row as CanonicalTruthRow)[group];
  if (nested && typeof nested === 'object' && signal in nested) {
    return nested[signal];
  }

  return (row as FlatTruthRow)[signal];
}

function findNodeBySignal(
  project: LabProjectV1,
  signalName: string
): LabProjectV1['circuit']['nodes'][number] | undefined {
  return project.circuit.nodes.find((node) => node.label === signalName || node.id === signalName);
}

function normalizeValue(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  return 0;
}
