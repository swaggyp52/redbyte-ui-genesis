import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildEngineeringRelationshipIndex, describeSignalRelationPath } from '../engineeringRelationships';
import type { ProjectIoRow } from '../projectRuntime';
import { studentPartName } from '../studentPartNames';

/**
 * The app bar names the parts a signal reaches. In rc.8 an unlabelled gate showed its internal id
 * ("SIGNAL B → node-v2-3/b", owner acceptance V4); it reads as its kind and place ("AND 1/b").
 */
const CIRCUIT: Circuit = {
  nodes: [
    { id: 'node-v2-1', type: 'INPUT', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
    { id: 'node-v2-2', type: 'INPUT', position: { x: 0, y: 100 }, rotation: 0, config: {}, state: {} },
    { id: 'node-v2-3', type: 'AND', position: { x: 200, y: 50 }, rotation: 0, config: {}, state: {} },
    { id: 'node-v2-4', type: 'AND', position: { x: 200, y: 150 }, rotation: 0, config: {}, state: {} },
    { id: 'node-v2-5', type: 'OUTPUT', position: { x: 400, y: 50 }, rotation: 0, config: {}, state: {} },
  ],
  connections: [
    { from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'a' } },
    { from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'b' } },
    { from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-5', portName: 'in' } },
  ],
};

const ROWS = [
  { id: 'a', nodeId: 'node-v2-1', label: 'A', pin: '', port: 'out', direction: 'in' },
  { id: 'b', nodeId: 'node-v2-2', label: 'B', pin: '', port: 'out', direction: 'in' },
  { id: 'output_1', nodeId: 'node-v2-5', label: 'Y', pin: 'U16', port: 'in', direction: 'out' },
] as unknown as ProjectIoRow[];

const index = buildEngineeringRelationshipIndex({
  ioRows: ROWS, circuit: CIRCUIT, hierarchy: null, scenarios: [], lastRun: null, constraintSets: null, isSequential: false,
});

describe('student names in the app bar', () => {
  it('names an unlabelled gate by its kind and place, never by its node id', () => {
    const b = describeSignalRelationPath(index.resolveField('b')!);
    const y = describeSignalRelationPath(index.resolveField('output_1')!);
    expect(b).toBe('B → AND 1/b');
    expect(y).toBe('Y ← AND 1/out · U16');
    expect(`${b} ${y}`).not.toMatch(/node-v\d/);
  });

  it('numbers parts of one kind in circuit order and keeps a label when there is one', () => {
    expect(studentPartName(CIRCUIT.nodes[3]!, 'node-v2-4', CIRCUIT)).toBe('AND 2');
    expect(studentPartName({ ...CIRCUIT.nodes[2]!, label: 'MASK' }, 'node-v2-3', CIRCUIT)).toBe('MASK');
    expect(studentPartName(CIRCUIT.nodes[2]!, 'node-v2-3')).toBe('AND gate');
  });
});
