import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { at } from '../../../__tests__/helpers/productPath';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
  elaborateProjectHierarchy,
  moduleInstanceOutputSources,
} from '../projectHierarchy';

const NOW = '2026-10-28T00:00:00.000Z';
const endpoint = (value: unknown) => {
  const ref = value as { nodeId: string; portName: string };
  return `${ref.nodeId}.${ref.portName}`;
};

/** Y = A through three inverters: Leaf holds n2 and n3, Mid holds n1 and the Leaf instance. */
function nested() {
  const base: Circuit = {
    nodes: [
      { id: 'a', type: 'INPUT', label: 'SW0', ...at(0) },
      { id: 'n1', type: 'NOT', ...at(120) },
      { id: 'n2', type: 'NOT', ...at(240) },
      { id: 'n3', type: 'NOT', ...at(360) },
      { id: 'y', type: 'OUTPUT', label: 'LD0', ...at(480) },
    ],
    connections: [
      { id: 'c1', from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'n1', portName: 'in' } },
      { id: 'c2', from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'in' } },
      { id: 'c3', from: { nodeId: 'n2', portName: 'out' }, to: { nodeId: 'n3', portName: 'in' } },
      { id: 'c4', from: { nodeId: 'n3', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } },
    ],
  };
  const leaf = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Leaf', instanceName: 'u_leaf', selectedNodeIds: ['n2', 'n3'], nowIso: NOW });
  const mid = createModuleFromSelection(leaf.circuit, leaf.hierarchy, { moduleName: 'Mid', instanceName: 'u_mid', selectedNodeIds: ['n1', leaf.instance.id], nowIso: NOW });
  return { circuit: mid.circuit, hierarchy: mid.hierarchy, midId: mid.instance.id, leafId: leaf.instance.id };
}

describe('moduleInstanceOutputSources', () => {
  it('follows an instance output through a nested instance to the node elaboration connects in its place', () => {
    const { circuit, hierarchy, midId, leafId } = nested();
    const toY = circuit.connections.find((connection) => endpoint(connection.to) === 'y.in')!;
    const pin = endpoint(toY.from);
    expect(pin.startsWith(`${midId}.`), 'the top level wires the Mid instance to Y').toBe(true);

    const sources = moduleInstanceOutputSources(circuit, hierarchy);
    expect([...sources.keys()]).toEqual([pin]);
    // By hand: Mid's output is the Leaf instance's output, which is n3 inside it.
    expect(sources.get(pin)).toBe(`${midId}__${leafId}__n3.out`);
    // The same driver the elaborated design (the simulator's circuit) connects to Y.
    const elaborated = elaborateProjectHierarchy(circuit, hierarchy);
    const driverOfY = elaborated.connections.filter((connection) => endpoint(connection.to) === 'y.in').map((connection) => endpoint(connection.from));
    expect(driverOfY).toEqual([sources.get(pin)]);
  });

  it('is empty for a flat design', () => {
    const { circuit } = nested();
    expect(moduleInstanceOutputSources(circuit, createEmptyProjectHierarchy()).size).toBe(0);
  });
});
