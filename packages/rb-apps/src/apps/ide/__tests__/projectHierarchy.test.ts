import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { decodeRBProject, encodeRBProject, type RBProject } from '../../../export/projectFormat';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
  elaborateProjectHierarchy,
  placeModuleInstance,
} from '../projectHierarchy';

function circuitFixture(): Circuit {
  return {
    nodes: [
      { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'INPUT', label: 'B', position: { x: 0, y: 120 } },
      { id: 'cin', type: 'INPUT', label: 'CIN', position: { x: 0, y: 240 } },
      { id: 'xor1', type: 'XOR', position: { x: 220, y: 60 } },
      { id: 'xor2', type: 'XOR', position: { x: 430, y: 100 } },
      { id: 'sum', type: 'OUTPUT', label: 'SUM', position: { x: 650, y: 100 } },
    ],
    connections: [
      { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'xor1', portName: 'a' } },
      { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'xor1', portName: 'b' } },
      { from: { nodeId: 'xor1', portName: 'out' }, to: { nodeId: 'xor2', portName: 'a' } },
      { from: { nodeId: 'cin', portName: 'out' }, to: { nodeId: 'xor2', portName: 'b' } },
      { from: { nodeId: 'xor2', portName: 'out' }, to: { nodeId: 'sum', portName: 'in' } },
    ],
  };
}

describe('native visual project hierarchy', () => {
  it('extracts a connected selection, replaces it with an instance, and elaborates stable paths', () => {
    const created = createModuleFromSelection(circuitFixture(), createEmptyProjectHierarchy(), {
      moduleName: 'ParityStage',
      instanceName: 'parity0',
      selectedNodeIds: ['xor1', 'xor2'],
      nowIso: '2026-08-08T12:00:00.000Z',
    });

    expect(created.definition.ports.map((port) => port.direction)).toEqual([
      'input', 'input', 'input', 'output',
    ]);
    expect(created.circuit.nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'cin', 'parity0', 'sum']);
    expect(created.instance.config?.moduleDefinitionId).toBe(created.definition.id);

    const elaborated = elaborateProjectHierarchy(created.circuit, created.hierarchy);
    expect(elaborated.nodes.some((node) => node.id === 'parity0__xor1')).toBe(true);
    expect(elaborated.nodes.some((node) => node.id === 'parity0__xor2')).toBe(true);
    expect(elaborated.connections.some((connection) =>
      typeof connection.to !== 'string' && connection.to.nodeId === 'parity0__xor1'
    )).toBe(true);

    const reused = placeModuleInstance(created.circuit, created.definition, { x: 800, y: 220 }, 'parity1');
    expect(reused.instance.config?.instanceName).toBe('parity1');
    expect(reused.circuit.nodes).toHaveLength(created.circuit.nodes.length + 1);

    const moduleOutput = created.definition.ports.find((port) => port.direction === 'output')!;
    const moduleInput = created.definition.ports.find((port) => port.direction === 'input')!;
    const chainedCircuit: Circuit = {
      ...reused.circuit,
      connections: [
        ...reused.circuit.connections,
        {
          from: { nodeId: created.instance.id, portName: moduleOutput.name },
          to: { nodeId: reused.instance.id, portName: moduleInput.name },
        },
      ],
    };
    const chained = elaborateProjectHierarchy(chainedCircuit, created.hierarchy);
    const elaboratedIds = new Set(chained.nodes.map((node) => node.id));
    expect(chained.connections.every((connection) => {
      const fromId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
      const toId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
      return elaboratedIds.has(fromId) && elaboratedIds.has(toId);
    })).toBe(true);
    expect(chained.connections).toContainEqual({
      from: expect.objectContaining({ nodeId: `parity0__${moduleOutput.sourceBoundary.internalRefs[0].nodeId}` }),
      to: expect.objectContaining({ nodeId: `parity1__${moduleInput.sourceBoundary.internalRefs[0].nodeId}` }),
    });
  });

  it('round-trips hierarchy definitions and the active module in the project envelope', () => {
    const created = createModuleFromSelection(circuitFixture(), createEmptyProjectHierarchy(), {
      moduleName: 'ParityStage',
      instanceName: 'parity0',
      selectedNodeIds: ['xor1', 'xor2'],
      nowIso: '2026-08-08T12:00:00.000Z',
    });
    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-08-08T12:00:00.000Z',
      updatedAt: '2026-08-08T12:00:00.000Z',
      name: 'Hierarchy fixture',
      circuit: created.circuit,
      hierarchy: { ...created.hierarchy, activeModuleId: created.definition.id },
    };

    const decoded = decodeRBProject(encodeRBProject(project));
    expect(decoded.hierarchy?.activeModuleId).toBe(created.definition.id);
    expect(decoded.hierarchy?.modules[0]?.circuit.nodes.some((node) => node.id === 'xor1')).toBe(true);
  });
});
