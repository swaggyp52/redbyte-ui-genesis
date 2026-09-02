import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
  placeModuleInstance,
  type ProjectHierarchyDocument,
} from '../projectHierarchy';
import type { IdeExampleIoRow } from '../examplesCatalog';

/**
 * Hierarchical 4-bit ripple-carry adder starter.
 *
 * One reusable `FullAdderCell` module (built the real way, from a gate selection)
 * instantiated four times as `u_fa0`…`u_fa3`, chained through the carry. The
 * top module owns the bused ports `A[3:0]`, `B[3:0]`, `SUM[3:0]` and `CARRY`.
 * This is the scale fixture for the hierarchy, bus and identity journeys
 * (`SUM[2]` → `u_fa2/SUM` → internal sum path → LD2/U19).
 *
 * Deterministic: fixed timestamps, fixed ids, fixed geometry.
 */
export interface HierarchicalRippleAdderFixture {
  readonly circuit: Circuit;
  readonly hierarchy: ProjectHierarchyDocument;
  readonly ioRows: IdeExampleIoRow[];
  readonly vectors: TestVector[];
}

const FIXTURE_ISO = '2026-09-01T00:00:00.000Z';
const STAGE_PITCH = 176;
const INPUT_X = 0;
const STAGE_X = 320;
const OUTPUT_X = 704;

const SWITCH_PINS = ['V17', 'V16', 'W16', 'W17', 'W15', 'V15', 'W14', 'W13'] as const;
const LED_PINS = ['U16', 'E19', 'U19', 'V19', 'W18'] as const;

function buildFullAdderModule() {
  const base: Circuit = {
    nodes: [
      { id: 'A', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
      { id: 'B', type: 'INPUT', label: 'B', position: { x: 0, y: 64 } },
      { id: 'CIN', type: 'INPUT', label: 'CIN', position: { x: 0, y: 128 } },
      { id: 'SUM', type: 'OUTPUT', label: 'SUM', position: { x: 512, y: 0 } },
      { id: 'COUT', type: 'OUTPUT', label: 'COUT', position: { x: 512, y: 128 } },
      { id: 'x1', type: 'XOR', label: 'x1', position: { x: 160, y: 0 } },
      { id: 'x2', type: 'XOR', label: 'x2', position: { x: 320, y: 0 } },
      { id: 'a1', type: 'AND', label: 'a1', position: { x: 160, y: 128 } },
      { id: 'a2', type: 'AND', label: 'a2', position: { x: 320, y: 128 } },
      { id: 'o1', type: 'OR', label: 'o1', position: { x: 416, y: 128 } },
    ],
    connections: [
      { id: 'fa-c0', from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'x1', portName: 'a' } },
      { id: 'fa-c1', from: { nodeId: 'B', portName: 'out' }, to: { nodeId: 'x1', portName: 'b' } },
      { id: 'fa-c2', from: { nodeId: 'x1', portName: 'out' }, to: { nodeId: 'x2', portName: 'a' } },
      { id: 'fa-c3', from: { nodeId: 'CIN', portName: 'out' }, to: { nodeId: 'x2', portName: 'b' } },
      { id: 'fa-c4', from: { nodeId: 'x2', portName: 'out' }, to: { nodeId: 'SUM', portName: 'in' } },
      { id: 'fa-c5', from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'a1', portName: 'a' } },
      { id: 'fa-c6', from: { nodeId: 'B', portName: 'out' }, to: { nodeId: 'a1', portName: 'b' } },
      { id: 'fa-c7', from: { nodeId: 'CIN', portName: 'out' }, to: { nodeId: 'a2', portName: 'a' } },
      { id: 'fa-c8', from: { nodeId: 'x1', portName: 'out' }, to: { nodeId: 'a2', portName: 'b' } },
      { id: 'fa-c9', from: { nodeId: 'a1', portName: 'out' }, to: { nodeId: 'o1', portName: 'a' } },
      { id: 'fa-c10', from: { nodeId: 'a2', portName: 'out' }, to: { nodeId: 'o1', portName: 'b' } },
      { id: 'fa-c11', from: { nodeId: 'o1', portName: 'out' }, to: { nodeId: 'COUT', portName: 'in' } },
    ],
  };
  return createModuleFromSelection(base, createEmptyProjectHierarchy(), {
    moduleName: 'FullAdderCell',
    instanceName: 'u_fa0',
    selectedNodeIds: ['x1', 'x2', 'a1', 'a2', 'o1'],
    nowIso: FIXTURE_ISO,
  });
}

export function buildHierarchicalRippleAdder(): HierarchicalRippleAdderFixture {
  const fa = buildFullAdderModule();
  let circuit: Circuit = {
    nodes: [
      ...[0, 1, 2, 3].flatMap((i) => [
        { id: `a${i}`, type: 'INPUT', label: `A[${i}]`, position: { x: INPUT_X, y: 16 + i * STAGE_PITCH } },
        { id: `b${i}`, type: 'INPUT', label: `B[${i}]`, position: { x: INPUT_X, y: 64 + i * STAGE_PITCH } },
        { id: `sum${i}`, type: 'OUTPUT', label: `SUM[${i}]`, position: { x: OUTPUT_X, y: 16 + i * STAGE_PITCH } },
      ]),
      { id: 'carry-out', type: 'OUTPUT', label: 'CARRY', position: { x: OUTPUT_X, y: 112 + 3 * STAGE_PITCH } },
      { id: 'gnd', type: 'Ground', label: '0', position: { x: INPUT_X + 96, y: 128 } },
    ],
    connections: [],
  };
  const instanceIds: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const placed = placeModuleInstance(circuit, fa.definition, { x: STAGE_X, y: 16 + i * STAGE_PITCH }, `u_fa${i}`);
    circuit = placed.circuit;
    instanceIds.push(placed.instance.id);
  }
  const connections: Circuit['connections'] = [];
  const wire = (id: string, from: { nodeId: string; portName: string }, to: { nodeId: string; portName: string }) => {
    connections.push({ id, from, to });
  };
  for (let i = 0; i < 4; i += 1) {
    const inst = instanceIds[i];
    wire(`a${i}-fa`, { nodeId: `a${i}`, portName: 'out' }, { nodeId: inst, portName: 'A' });
    wire(`b${i}-fa`, { nodeId: `b${i}`, portName: 'out' }, { nodeId: inst, portName: 'B' });
    wire(`fa${i}-sum`, { nodeId: inst, portName: 'SUM' }, { nodeId: `sum${i}`, portName: 'in' });
    if (i === 0) {
      wire('gnd-cin0', { nodeId: 'gnd', portName: 'out' }, { nodeId: inst, portName: 'CIN' });
    } else {
      wire(`carry${i - 1}`, { nodeId: instanceIds[i - 1], portName: 'COUT' }, { nodeId: inst, portName: 'CIN' });
    }
  }
  wire('carry-out', { nodeId: instanceIds[3], portName: 'COUT' }, { nodeId: 'carry-out', portName: 'in' });
  circuit = { nodes: circuit.nodes, connections };

  const ioRows: IdeExampleIoRow[] = [
    ...[0, 1, 2, 3].flatMap((i): IdeExampleIoRow[] => [
      { id: `a${i}`, nodeId: `a${i}`, port: 'out', label: `A[${i}] (SW${i * 2})`, direction: 'in', pin: SWITCH_PINS[i * 2], required: true },
      { id: `b${i}`, nodeId: `b${i}`, port: 'out', label: `B[${i}] (SW${i * 2 + 1})`, direction: 'in', pin: SWITCH_PINS[i * 2 + 1], required: true },
    ]),
    ...[0, 1, 2, 3].map((i): IdeExampleIoRow => ({
      id: `sum${i}`, nodeId: `sum${i}`, port: 'in', label: `SUM[${i}] (LD${i})`, direction: 'out', pin: LED_PINS[i], required: true,
    })),
    { id: 'carry-out', nodeId: 'carry-out', port: 'in', label: 'CARRY (LD4)', direction: 'out', pin: LED_PINS[4], required: true },
  ];

  const bit = (v: number, i: number) => ((v >> i) & 1) as 0 | 1;
  const vectors: TestVector[] = [
    [0, 0],
    [1, 1],
    [5, 3],
    [15, 1],
    [9, 6],
    [15, 15],
  ].map(([a, b], tick) => {
    const sum = a + b;
    return {
      tick,
      inputs: Object.fromEntries([0, 1, 2, 3].flatMap((i) => [[`a${i}`, bit(a, i)], [`b${i}`, bit(b, i)]])),
      expected: {
        sum0: bit(sum, 0),
        sum1: bit(sum, 1),
        sum2: bit(sum, 2),
        sum3: bit(sum, 3),
        'carry-out': bit(sum, 4),
      },
    };
  });

  return { circuit, hierarchy: fa.hierarchy, ioRows, vectors };
}
