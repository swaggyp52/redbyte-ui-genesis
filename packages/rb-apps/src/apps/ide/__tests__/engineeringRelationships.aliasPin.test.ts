import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildEngineeringRelationshipIndex } from '../engineeringRelationships';
import type { ProjectIoRow } from '../projectRuntime';

/**
 * P2.5H Wave Four — a board row may carry the board alias (LD0) or the package pin (U16).
 * The relation's board link names the package pin, so the constraint lines it reports are
 * the lines the package writes, not `PACKAGE_PIN LD0`.
 */
const CIRCUIT: Circuit = {
  nodes: [
    { id: 'sw0_node', type: 'INPUT', label: 'SW0', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
    { id: 'ld0_node', type: 'OUTPUT', label: 'LD0', position: { x: 200, y: 0 }, rotation: 0, config: {}, state: {} },
  ],
  connections: [{ from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } }],
};

function index(rows: ReadonlyArray<Record<string, unknown>>) {
  return buildEngineeringRelationshipIndex({
    ioRows: rows as unknown as ProjectIoRow[],
    circuit: CIRCUIT,
    hierarchy: null,
    scenarios: [],
    lastRun: null,
    constraintSets: null,
    isSequential: false,
  });
}

describe('engineeringRelationships — board link pin', () => {
  it('resolves an alias row to its package pin and writes the constraint lines with it', () => {
    const relation = index([
      { id: 'sw0', nodeId: 'sw0_node', label: 'SW0', pin: 'SW0', port: 'out', direction: 'in' },
      { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'LD0', port: 'in', direction: 'out' },
    ]).resolveField('ld0');
    expect(relation?.board?.pin).toBe('U16');
    expect(relation?.board?.resource?.alias).toBe('LD0');
    expect(relation?.board?.xdcLines.join('\n')).toContain('PACKAGE_PIN U16');
    expect(relation?.board?.xdcLines.join('\n')).not.toContain('PACKAGE_PIN LD0');
  });

  it('keeps a package-pin row as it is', () => {
    const relation = index([
      { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'U16', port: 'in', direction: 'out' },
    ]).resolveField('ld0');
    expect(relation?.board?.pin).toBe('U16');
    expect(relation?.board?.resource?.alias).toBe('LD0');
  });

  it('reports two rows on the same physical pin as a conflict however each was written', () => {
    // One row stores the package pin, the other the board alias; both drive U16.
    const built = index([
      { id: 'sw0', nodeId: 'sw0_node', label: 'SW0', pin: 'U16', port: 'out', direction: 'in' },
      { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'LD0', port: 'in', direction: 'out' },
    ]);
    expect(built.resolveField('ld0')?.board?.pin).toBe('U16');
    expect(built.resolveField('ld0')?.ambiguity.join(' ')).toContain('U16');
    expect(built.resolveField('ld0')?.ambiguity.join(' ')).toContain('sw0');
    expect(built.resolveField('sw0')?.ambiguity.join(' ')).toContain('ld0');
  });

  it('leaves an unknown pin untouched rather than inventing a resource', () => {
    const relation = index([
      { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'Z99', port: 'in', direction: 'out' },
    ]).resolveField('ld0');
    expect(relation?.board?.pin).toBe('Z99');
    expect(relation?.board?.resource).toBeNull();
  });
});
