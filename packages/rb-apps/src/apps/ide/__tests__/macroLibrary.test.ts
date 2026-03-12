import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  deleteMacro,
  getInstantiationTemplate,
  saveMacro,
  updateMacro,
} from '../macros/MacroLibrary';

function buildFixtureCircuit(): Circuit {
  return {
    nodes: [
      {
        id: 'node-v2-1',
        type: 'INPUT',
        label: 'A',
        position: { x: 0, y: 0 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'node-v2-2',
        type: 'INPUT',
        label: 'B',
        position: { x: 0, y: 80 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'node-v2-3',
        type: 'AND',
        position: { x: 140, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'node-v2-4',
        type: 'NOT',
        position: { x: 280, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'node-v2-5',
        type: 'OUTPUT',
        label: 'Q',
        position: { x: 420, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      { from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'a' } },
      { from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'b' } },
      { from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-4', portName: 'in' } },
      { from: { nodeId: 'node-v2-4', portName: 'out' }, to: { nodeId: 'node-v2-5', portName: 'in' } },
    ],
  };
}

function buildLargeClusterCircuit(): Circuit {
  const logicNodes = Array.from({ length: 10 }, (_, offset) => {
    const index = offset + 3;
    return {
      id: `node-v2-${index}`,
      type: 'AND',
      label: `G${offset + 1}`,
      position: { x: 120 + offset * 60, y: 120 + (offset % 2) * 40 },
      rotation: 0,
      config: {},
      state: {},
    };
  });

  return {
    nodes: [
      {
        id: 'node-v2-1',
        type: 'INPUT',
        label: 'A',
        position: { x: 0, y: 100 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'node-v2-2',
        type: 'INPUT',
        label: 'B',
        position: { x: 0, y: 160 },
        rotation: 0,
        config: {},
        state: {},
      },
      ...logicNodes,
      {
        id: 'node-v2-13',
        type: 'OUTPUT',
        label: 'Q',
        position: { x: 760, y: 140 },
        rotation: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      { from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'a' } },
      { from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'b' } },
      { from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-4', portName: 'a' } },
      { from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-4', portName: 'b' } },
      { from: { nodeId: 'node-v2-4', portName: 'out' }, to: { nodeId: 'node-v2-5', portName: 'a' } },
      { from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-5', portName: 'b' } },
      { from: { nodeId: 'node-v2-5', portName: 'out' }, to: { nodeId: 'node-v2-6', portName: 'a' } },
      { from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-6', portName: 'b' } },
      { from: { nodeId: 'node-v2-6', portName: 'out' }, to: { nodeId: 'node-v2-7', portName: 'a' } },
      { from: { nodeId: 'node-v2-4', portName: 'out' }, to: { nodeId: 'node-v2-7', portName: 'b' } },
      { from: { nodeId: 'node-v2-7', portName: 'out' }, to: { nodeId: 'node-v2-8', portName: 'a' } },
      { from: { nodeId: 'node-v2-5', portName: 'out' }, to: { nodeId: 'node-v2-8', portName: 'b' } },
      { from: { nodeId: 'node-v2-8', portName: 'out' }, to: { nodeId: 'node-v2-9', portName: 'a' } },
      { from: { nodeId: 'node-v2-6', portName: 'out' }, to: { nodeId: 'node-v2-9', portName: 'b' } },
      { from: { nodeId: 'node-v2-9', portName: 'out' }, to: { nodeId: 'node-v2-10', portName: 'a' } },
      { from: { nodeId: 'node-v2-7', portName: 'out' }, to: { nodeId: 'node-v2-10', portName: 'b' } },
      { from: { nodeId: 'node-v2-10', portName: 'out' }, to: { nodeId: 'node-v2-11', portName: 'a' } },
      { from: { nodeId: 'node-v2-8', portName: 'out' }, to: { nodeId: 'node-v2-11', portName: 'b' } },
      { from: { nodeId: 'node-v2-11', portName: 'out' }, to: { nodeId: 'node-v2-12', portName: 'a' } },
      { from: { nodeId: 'node-v2-9', portName: 'out' }, to: { nodeId: 'node-v2-12', portName: 'b' } },
      { from: { nodeId: 'node-v2-12', portName: 'out' }, to: { nodeId: 'node-v2-13', portName: 'in' } },
    ],
  };
}

describe('MacroLibrary', () => {
  it('saves a selected cluster as a macro with detected boundary inputs and outputs', () => {
    const { library, macro } = saveMacro([], {
      circuit: buildFixtureCircuit(),
      selectedNodeIds: new Set(['node-v2-3', 'node-v2-4']),
      name: 'Inverted AND',
      description: 'Two-gate reusable cluster',
      createdAt: 1710000000000,
      idFactory: () => 'macro-inverted-and',
    });

    expect(library).toHaveLength(1);
    expect(macro.id).toBe('macro-inverted-and');
    expect(macro.inputs.map((entry) => entry.label)).toEqual(['A', 'B']);
    expect(macro.outputs.map((entry) => entry.label)).toEqual(['Q']);
    expect(macro.cluster.nodes).toHaveLength(2);
    expect(macro.cluster.connections).toHaveLength(1);
  });

  it('updates macro metadata immutably', () => {
    const { library, macro } = saveMacro([], {
      circuit: buildFixtureCircuit(),
      selectedNodeIds: new Set(['node-v2-3', 'node-v2-4']),
      name: 'Inverted AND',
      createdAt: 1710000000000,
      idFactory: () => 'macro-inverted-and',
    });

    const updated = updateMacro(library, macro.id, {
      description: 'Updated description',
      name: 'Inverted AND Cluster',
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]?.name).toBe('Inverted AND Cluster');
    expect(updated[0]?.description).toBe('Updated description');
    expect(library[0]?.name).toBe('Inverted AND');
  });

  it('instantiates a macro as unique gates and wires with an auto-incremented instance label', () => {
    const circuit = buildFixtureCircuit();
    const { macro } = saveMacro([], {
      circuit,
      selectedNodeIds: new Set(['node-v2-3', 'node-v2-4']),
      name: 'Inverted AND',
      createdAt: 1710000000000,
      idFactory: () => 'macro-inverted-and',
    });

    const template = getInstantiationTemplate([macro], 'macro-inverted-and', circuit, { x: 640, y: 200 }, {
      nextInstanceIndex: 1,
    });

    expect(template.instanceLabel).toBe('Inverted_AND_1');
    expect(template.nodes.map((node) => node.id)).toEqual(['node-v2-6', 'node-v2-7']);
    expect(template.connections).toEqual([
      {
        from: { nodeId: 'node-v2-6', portName: 'out' },
        to: { nodeId: 'node-v2-7', portName: 'in' },
      },
    ]);
  });

  it('deleting a macro does not mutate a previously instantiated circuit', () => {
    const circuit = buildFixtureCircuit();
    const { library, macro } = saveMacro([], {
      circuit,
      selectedNodeIds: new Set(['node-v2-3', 'node-v2-4']),
      name: 'Inverted AND',
      createdAt: 1710000000000,
      idFactory: () => 'macro-inverted-and',
    });

    const template = getInstantiationTemplate(library, macro.id, circuit, { x: 640, y: 200 }, {
      nextInstanceIndex: 1,
    });
    const nextCircuit: Circuit = {
      nodes: [...circuit.nodes, ...template.nodes],
      connections: [...circuit.connections, ...template.connections],
    };

    const withoutMacro = deleteMacro(library, macro.id);

    expect(withoutMacro).toEqual([]);
    expect(nextCircuit.nodes.map((node) => node.id)).toContain('node-v2-6');
    expect(nextCircuit.connections).toHaveLength(5);
  });

  it('keeps IDs unique and wires connected when inserting a large macro five times', () => {
    const baseCircuit = buildLargeClusterCircuit();
    const selectedNodeIds = new Set(Array.from({ length: 10 }, (_, offset) => `node-v2-${offset + 3}`));
    const { macro } = saveMacro([], {
      circuit: baseCircuit,
      selectedNodeIds,
      name: 'Large Cluster',
      createdAt: 1710000000000,
      idFactory: () => 'macro-large-cluster',
    });

    let expandedCircuit = baseCircuit;
    const insertedNodeIds: string[] = [];
    const startedAt = Date.now();

    for (let index = 1; index <= 5; index += 1) {
      const template = getInstantiationTemplate(
        [macro],
        macro.id,
        expandedCircuit,
        { x: 900 + index * 140, y: 120 + index * 16 },
        { nextInstanceIndex: index }
      );

      expect(template.nodes).toHaveLength(10);
      insertedNodeIds.push(...template.nodes.map((node) => node.id));
      expandedCircuit = {
        nodes: [...expandedCircuit.nodes, ...template.nodes],
        connections: [...expandedCircuit.connections, ...template.connections],
      };
    }

    const elapsedMs = Date.now() - startedAt;
    expect(elapsedMs).toBeLessThan(2000);

    const nodeIds = expandedCircuit.nodes.map((node) => node.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(new Set(insertedNodeIds).size).toBe(insertedNodeIds.length);

    const existingNodeIds = new Set(nodeIds);
    for (const connection of expandedCircuit.connections) {
      const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
      const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
      expect(existingNodeIds.has(fromNodeId)).toBe(true);
      expect(existingNodeIds.has(toNodeId)).toBe(true);
    }
  });
});