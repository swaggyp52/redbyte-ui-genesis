import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../export/projectFormat';
import { createEmptyProjectHierarchy, createModuleFromSelection } from '../projectHierarchy';
import { generateHierarchicalVhdlProject } from '../hierarchicalVhdl';

describe('hierarchical VHDL handoff', () => {
  it('emits a structural top plus a reusable module source', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'INPUT', label: 'B', position: { x: 0, y: 100 } },
        { id: 'g1', type: 'XOR', position: { x: 200, y: 50 } },
        { id: 'g2', type: 'NOT', position: { x: 380, y: 50 } },
        { id: 'y', type: 'OUTPUT', label: 'Y', position: { x: 560, y: 50 } },
      ],
      connections: [
        { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g1', portName: 'a' } },
        { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g1', portName: 'b' } },
        { from: { nodeId: 'g1', portName: 'out' }, to: { nodeId: 'g2', portName: 'in' } },
        { from: { nodeId: 'g2', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } },
      ],
    };
    const created = createModuleFromSelection(circuit, createEmptyProjectHierarchy(), {
      moduleName: 'InvertXor',
      instanceName: 'logic0',
      selectedNodeIds: ['g1', 'g2'],
      nowIso: '2026-08-08T12:00:00.000Z',
    });
    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-08-08T12:00:00.000Z',
      updatedAt: '2026-08-08T12:00:00.000Z',
      name: 'VHDL fixture',
      circuit: created.circuit,
      hierarchy: created.hierarchy,
      ioMapping: {
        inputs: [
          { id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'V17' },
          { id: 'b', nodeId: 'b', port: 'out', label: 'B', pin: 'V16' },
        ],
        outputs: [{ id: 'y', nodeId: 'y', port: 'in', label: 'Y', pin: 'U16' }],
      },
      hdl: { top: 'hierarchy_top', sources: [] },
    };

    const output = generateHierarchicalVhdlProject(project);
    expect(output?.moduleSources.map((source) => source.path)).toEqual(['invert_xor.vhd']);
    expect(output?.topVhd).toContain('entity hierarchy_top is');
    expect(output?.topVhd).toContain('end entity hierarchy_top;');
    expect(output?.topVhd).toContain('logic0 : entity work.InvertXor');
    expect(output?.moduleSources[0]?.text).toContain('entity InvertXor is');
    expect(output?.moduleSources[0]?.text).toContain('xor');
  });
});
