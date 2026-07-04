// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  FULL_ADDER_LAB_ID,
  FULL_ADDER_SCRATCH_LAB,
  buildFullAdderTruthTableVectors,
  deriveFullAdderDesignChecklist,
  deriveFullAdderExportSummary,
  deriveFullAdderHardwareChecklist,
  isFullAdderLabProject,
  type LabProjectIoRow,
} from '../labTaskDefinition';
import { useProjectRuntime } from '../projectRuntime';
import type { RBProject } from '../../../export/projectFormat';

const FULL_ADDER_ROWS: LabProjectIoRow[] = [
  { id: 'A', nodeId: 'node_a', label: 'A', direction: 'in', pin: 'SW0', port: 'out', required: true },
  { id: 'B', nodeId: 'node_b', label: 'B', direction: 'in', pin: 'SW1', port: 'out', required: true },
  { id: 'Cin', nodeId: 'node_cin', label: 'Cin', direction: 'in', pin: 'SW2', port: 'out', required: true },
  { id: 'Sum', nodeId: 'node_sum', label: 'Sum', direction: 'out', pin: 'LD0', port: 'in', required: true },
  { id: 'Cout', nodeId: 'node_cout', label: 'Cout', direction: 'out', pin: 'LD1', port: 'in', required: true },
];

const FULL_ADDER_CIRCUIT: Circuit = {
  nodes: [
    { id: 'node_a', type: 'INPUT', label: 'A', x: 0, y: 0 },
    { id: 'node_b', type: 'INPUT', label: 'B', x: 0, y: 80 },
    { id: 'node_cin', type: 'INPUT', label: 'Cin', x: 0, y: 160 },
    { id: 'fa0', type: 'FullAdder', x: 240, y: 80 },
    { id: 'node_sum', type: 'OUTPUT', label: 'Sum', x: 480, y: 40 },
    { id: 'node_cout', type: 'OUTPUT', label: 'Cout', x: 480, y: 140 },
  ],
  connections: [
    { from: { nodeId: 'node_a', portName: 'out' }, to: { nodeId: 'fa0', portName: 'A' } },
    { from: { nodeId: 'node_b', portName: 'out' }, to: { nodeId: 'fa0', portName: 'B' } },
    { from: { nodeId: 'node_cin', portName: 'out' }, to: { nodeId: 'fa0', portName: 'Cin' } },
    { from: { nodeId: 'fa0', portName: 'Sum' }, to: { nodeId: 'node_sum', portName: 'in' } },
    { from: { nodeId: 'fa0', portName: 'Cout' }, to: { nodeId: 'node_cout', portName: 'in' } },
  ],
};

describe('guided full adder lab definition', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectRuntime.getState().replaceWithBlankProject();
  });

  it('defines the scratch lab contract and exact truth table', () => {
    expect(FULL_ADDER_SCRATCH_LAB.id).toBe(FULL_ADDER_LAB_ID);
    expect(FULL_ADDER_SCRATCH_LAB.inputs.map((signal) => signal.label)).toEqual(['A', 'B', 'Cin']);
    expect(FULL_ADDER_SCRATCH_LAB.outputs.map((signal) => signal.label)).toEqual(['Sum', 'Cout']);
    expect(FULL_ADDER_SCRATCH_LAB.truthTable).toEqual([
      { A: 0, B: 0, Cin: 0, Sum: 0, Cout: 0 },
      { A: 0, B: 0, Cin: 1, Sum: 1, Cout: 0 },
      { A: 0, B: 1, Cin: 0, Sum: 1, Cout: 0 },
      { A: 0, B: 1, Cin: 1, Sum: 0, Cout: 1 },
      { A: 1, B: 0, Cin: 0, Sum: 1, Cout: 0 },
      { A: 1, B: 0, Cin: 1, Sum: 0, Cout: 1 },
      { A: 1, B: 1, Cin: 0, Sum: 0, Cout: 1 },
      { A: 1, B: 1, Cin: 1, Sum: 1, Cout: 1 },
    ]);
  });

  it('builds eight Verify vectors keyed to live project IO rows', () => {
    const vectors = buildFullAdderTruthTableVectors(FULL_ADDER_ROWS);
    expect(vectors).toHaveLength(8);
    expect(vectors[0]).toEqual({
      tick: 0,
      inputs: { A: 0, B: 0, Cin: 0 },
      expected: { Sum: 0, Cout: 0 },
    });
    expect(vectors[7]).toEqual({
      tick: 7,
      inputs: { A: 1, B: 1, Cin: 1 },
      expected: { Sum: 1, Cout: 1 },
    });
  });

  it('derives Design checklist truth from real nodes and connections', () => {
    const ready = deriveFullAdderDesignChecklist(FULL_ADDER_CIRCUIT, FULL_ADDER_ROWS);
    expect(ready.readyForVerify).toBe(true);
    expect(ready.items.every((item) => item.complete)).toBe(true);

    const missingWire = deriveFullAdderDesignChecklist(
      { ...FULL_ADDER_CIRCUIT, connections: FULL_ADDER_CIRCUIT.connections.slice(0, 3) },
      FULL_ADDER_ROWS
    );
    expect(missingWire.readyForVerify).toBe(false);
    expect(missingWire.connectedOutputLabels).toEqual([]);
  });

  it('derives suggested pin mapping and conflict state', () => {
    const ready = deriveFullAdderHardwareChecklist(FULL_ADDER_ROWS);
    expect(ready.readyForExport).toBe(true);
    expect(ready.missingMappings).toEqual([]);

    const conflict = deriveFullAdderHardwareChecklist([
      ...FULL_ADDER_ROWS.slice(0, 1),
      { ...FULL_ADDER_ROWS[1], pin: 'SW0' },
      ...FULL_ADDER_ROWS.slice(2),
    ]);
    expect(conflict.readyForExport).toBe(false);
    expect(conflict.conflictingMappings.length).toBeGreaterThan(0);
  });

  it('applies suggested lab pins to runtime rows from an empty V2 document', () => {
    useProjectRuntime.getState().applyCircuitMutation(FULL_ADDER_CIRCUIT);
    const rowsBefore = useProjectRuntime.getState().projectIoRows;
    expect(rowsBefore).toHaveLength(5);
    expect(rowsBefore.every((row) => row.pin === '')).toBe(true);

    const expectedByLabel: Record<string, string> = {
      A: 'SW0',
      B: 'SW1',
      Cin: 'SW2',
      Sum: 'LD0',
      Cout: 'LD1',
    };
    useProjectRuntime.getState().setMappingPins(
      Object.fromEntries(rowsBefore.map((row) => [row.id, expectedByLabel[row.label] ?? '']))
    );

    const rowsAfter = useProjectRuntime.getState().projectIoRows;
    expect(Object.fromEntries(rowsAfter.map((row) => [row.label, row.pin]))).toEqual(expectedByLabel);
    expect(useProjectRuntime.getState().hardwareMappingV2.entries).toHaveLength(5);
  });

  it('summarizes export readiness without upgrading browser proof', () => {
    const designChecklist = deriveFullAdderDesignChecklist(FULL_ADDER_CIRCUIT, FULL_ADDER_ROWS);
    const hardwareChecklist = deriveFullAdderHardwareChecklist(FULL_ADDER_ROWS);
    const summary = deriveFullAdderExportSummary({
      rows: FULL_ADDER_ROWS,
      designChecklist,
      hardwareChecklist,
      verifyStatus: 'pass',
      packageReady: true,
      exportBlocked: false,
    });

    expect(summary.packageStatus).toBe('ready');
    expect(summary.blockerLabels).toEqual([]);
    expect(summary.evidenceBoundary).toMatch(/Browser E0/i);
  });

  it('restores lab metadata from imported RedByte project meta', () => {
    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
      name: 'Full Adder import',
      circuit: FULL_ADDER_CIRCUIT,
      ioMapping: {
        inputs: FULL_ADDER_ROWS.filter((row) => row.direction === 'in').map((row) => ({
          id: row.id,
          nodeId: row.nodeId!,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
        outputs: FULL_ADDER_ROWS.filter((row) => row.direction === 'out').map((row) => ({
          id: row.id,
          nodeId: row.nodeId!,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
      },
      vectors: buildFullAdderTruthTableVectors(FULL_ADDER_ROWS),
      meta: {
        labId: FULL_ADDER_LAB_ID,
      },
    };

    expect(isFullAdderLabProject(project)).toBe(true);
    useProjectRuntime.getState().loadFromProject(project);
    expect(useProjectRuntime.getState().activeLabTaskId).toBe(FULL_ADDER_LAB_ID);
  });
});
