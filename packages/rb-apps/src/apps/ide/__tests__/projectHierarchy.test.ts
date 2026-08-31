import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { decodeRBProject, encodeRBProject, type RBProject } from '../../../export/projectFormat';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
  elaborateProjectHierarchy,
  hierarchyCycleModules,
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

  describe('nested hierarchy', () => {
    // Leaf module Inv: A → NOT → NOT → Y (a two-gate identity buffer; modules
    // require at least two connected components).
    const buildInv = () => {
      const base: Circuit = {
        nodes: [
          { id: 'A', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
          { id: 'Y', type: 'OUTPUT', label: 'Y', position: { x: 400, y: 0 } },
          { id: 'n1', type: 'NOT', position: { x: 150, y: 0 } },
          { id: 'n2', type: 'NOT', position: { x: 280, y: 0 } },
        ],
        connections: [
          { from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'n1', portName: 'in' } },
          { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'in' } },
          { from: { nodeId: 'n2', portName: 'out' }, to: { nodeId: 'Y', portName: 'in' } },
        ],
      };
      return createModuleFromSelection(base, createEmptyProjectHierarchy(), {
        moduleName: 'Inv', instanceName: 'u_inv0', selectedNodeIds: ['n1', 'n2'],
        nowIso: '2026-08-08T12:00:00.000Z',
      });
    };

    // Middle module Double: two chained Inv instances (A → u_i0 → u_i1 → Y).
    const buildDouble = (invResult: ReturnType<typeof buildInv>) => {
      const inv = invResult.definition;
      let top: Circuit = { nodes: [
        { id: 'DA', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
        { id: 'DY', type: 'OUTPUT', label: 'Y', position: { x: 600, y: 0 } },
      ], connections: [] };
      const p0 = placeModuleInstance(top, inv, { x: 150, y: 0 }, 'u_i0');
      const p1 = placeModuleInstance(p0.circuit, inv, { x: 380, y: 0 }, 'u_i1');
      top = { nodes: p1.circuit.nodes, connections: [
        { from: { nodeId: 'DA', portName: 'out' }, to: { nodeId: p0.instance.id, portName: 'A' } },
        { from: { nodeId: p0.instance.id, portName: 'Y' }, to: { nodeId: p1.instance.id, portName: 'A' } },
        { from: { nodeId: p1.instance.id, portName: 'Y' }, to: { nodeId: 'DY', portName: 'in' } },
      ] };
      return createModuleFromSelection(top, invResult.hierarchy, {
        moduleName: 'Double', instanceName: 'u_double0', selectedNodeIds: [p0.instance.id, p1.instance.id],
        nowIso: '2026-08-08T12:00:00.000Z',
      });
    };

    it('flattens a 3-level hierarchy (top → Double → Inv) to primitive gates', () => {
      const inv = buildInv();
      const double = buildDouble(inv);
      // Final top: one Double instance between A and Y.
      let top: Circuit = { nodes: [
        { id: 'TA', type: 'INPUT', label: 'IN', position: { x: 0, y: 0 } },
        { id: 'TY', type: 'OUTPUT', label: 'OUT', position: { x: 600, y: 0 } },
      ], connections: [] };
      const placed = placeModuleInstance(top, double.definition, { x: 250, y: 0 }, 'u_top');
      top = { nodes: placed.circuit.nodes, connections: [
        { from: { nodeId: 'TA', portName: 'out' }, to: { nodeId: placed.instance.id, portName: 'A' } },
        { from: { nodeId: placed.instance.id, portName: 'Y' }, to: { nodeId: 'TY', portName: 'in' } },
      ] };
      const flat = elaborateProjectHierarchy(top, double.hierarchy);
      // Four NOT gates survive (two Inv instances × two NOTs), no module nodes.
      const nots = flat.nodes.filter((n) => n.type === 'NOT');
      expect(nots).toHaveLength(4);
      expect(flat.nodes.every((n) => !n.config?.moduleDefinitionId)).toBe(true);
      // Composed instance paths reach three levels deep.
      expect(nots.some((n) => String(n.config?.hierarchyPath).split('.').length >= 3)).toBe(true);
      // The top input reaches the first NOT and the second NOT reaches the top output.
      const feedsTop = flat.connections.some((c) => (typeof c.from !== 'string' && c.from.nodeId === 'TA'));
      const drivesTop = flat.connections.some((c) => (typeof c.to !== 'string' && c.to.nodeId === 'TY'));
      expect(feedsTop && drivesTop).toBe(true);
    });

    it('reports a cycle when a module would instantiate itself indirectly', () => {
      const inv = buildInv();
      const double = buildDouble(inv);
      // No cycle in the honest DAG.
      expect(hierarchyCycleModules(double.hierarchy)).toEqual([]);
      // Forge a cycle: make Inv's circuit contain a Double instance (Double → Inv → Double).
      const cyclic = {
        ...double.hierarchy,
        modules: double.hierarchy.modules.map((m) =>
          m.name === 'Inv'
            ? { ...m, circuit: { ...m.circuit, nodes: [...m.circuit.nodes, {
                id: 'nested_double', type: 'Double', label: 'u_d',
                config: { moduleDefinitionId: double.definition.id, moduleName: 'Double', instanceName: 'u_d' },
              }] } }
            : m,
        ),
      };
      const cycle = hierarchyCycleModules(cyclic);
      expect(cycle.length).toBeGreaterThan(0);
    });
  });
});
