// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { useProjectRuntime } from '../projectRuntime';
import { elaborateProjectHierarchy, TOP_MODULE_ID } from '../projectHierarchy';

// Build a connected 2-NOT circuit and carve a module from its two gates.
function makeTwoNotCircuit(): Circuit {
  return {
    nodes: [
      { id: 'A', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
      { id: 'g1', type: 'NOT', position: { x: 120, y: 0 } },
      { id: 'g2', type: 'NOT', position: { x: 240, y: 0 } },
      { id: 'Y', type: 'OUTPUT', label: 'Y', position: { x: 360, y: 0 } },
    ],
    connections: [
      { from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'g1', portName: 'in' } },
      { from: { nodeId: 'g1', portName: 'out' }, to: { nodeId: 'g2', portName: 'in' } },
      { from: { nodeId: 'g2', portName: 'out' }, to: { nodeId: 'Y', portName: 'in' } },
    ],
  };
}

function carveModule(name: string): string {
  act(() => {
    useProjectRuntime.getState().applyCircuitMutation(makeTwoNotCircuit());
  });
  act(() => {
    useProjectRuntime.getState().createModuleFromSelection({
      moduleName: name, instanceName: `u_${name.toLowerCase()}`, selectedNodeIds: ['g1', 'g2'], portNames: {},
    });
  });
  const mod = useProjectRuntime.getState().hierarchy.modules.find((m) => m.name === name);
  if (!mod) throw new Error(`module ${name} not created`);
  return mod.id;
}

describe('projectRuntime.placeModuleInstance — nested authoring', () => {
  beforeEach(() => {
    act(() => useProjectRuntime.getState().replaceWithBlankProject());
  });

  it('places a module instance INSIDE another module definition', () => {
    const leafId = carveModule('Leaf');
    const midId = carveModule('Mid');

    // Drill into Mid, then place a Leaf instance inside it.
    act(() => useProjectRuntime.getState().setActiveModule(midId));
    let placed: unknown = null;
    act(() => {
      placed = useProjectRuntime.getState().placeModuleInstance(leafId, { x: 400, y: 0 }, 'u_leaf0');
    });
    expect(placed).not.toBeNull();

    const mid = useProjectRuntime.getState().hierarchy.modules.find((m) => m.id === midId)!;
    const nested = mid.circuit.nodes.filter((n) => n.config?.moduleDefinitionId === leafId);
    expect(nested).toHaveLength(1);
    expect(nested[0].config?.instanceName).toBe('u_leaf0');
  });

  it('flattens the nested hierarchy: top → Mid → Leaf → primitives', () => {
    const leafId = carveModule('Leaf');
    const midId = carveModule('Mid');
    act(() => useProjectRuntime.getState().setActiveModule(midId));
    act(() => useProjectRuntime.getState().placeModuleInstance(leafId, { x: 400, y: 0 }, 'u_leaf0'));

    // Back to top, clear the carve leftovers, place exactly one Mid instance.
    act(() => useProjectRuntime.getState().setActiveModule(TOP_MODULE_ID));
    act(() => useProjectRuntime.getState().applyCircuitMutation({ nodes: [], connections: [] }));
    act(() => useProjectRuntime.getState().placeModuleInstance(midId, { x: 100, y: 100 }, 'u_mid0'));

    const state = useProjectRuntime.getState();
    const flat = elaborateProjectHierarchy(state.circuit, state.hierarchy);
    // Mid's own 2 NOTs + Leaf's 2 NOTs, fully inlined.
    expect(flat.nodes.filter((n) => n.type === 'NOT')).toHaveLength(4);
    expect(flat.nodes.every((n) => !n.config?.moduleDefinitionId)).toBe(true);
  });

  it('rejects a placement that would create a cycle, leaving the project unchanged', () => {
    const leafId = carveModule('Leaf');
    const midId = carveModule('Mid');
    // Mid contains Leaf.
    act(() => useProjectRuntime.getState().setActiveModule(midId));
    act(() => useProjectRuntime.getState().placeModuleInstance(leafId, { x: 400, y: 0 }, 'u_leaf0'));

    // Now drill into Leaf and try to place Mid inside it → Leaf→Mid→Leaf cycle.
    act(() => useProjectRuntime.getState().setActiveModule(leafId));
    const before = JSON.stringify(
      useProjectRuntime.getState().hierarchy.modules.find((m) => m.id === leafId)!.circuit,
    );
    let placed: unknown = 'sentinel';
    act(() => {
      placed = useProjectRuntime.getState().placeModuleInstance(midId, { x: 400, y: 0 }, 'u_mid_bad');
    });
    expect(placed).toBeNull();
    const after = JSON.stringify(
      useProjectRuntime.getState().hierarchy.modules.find((m) => m.id === leafId)!.circuit,
    );
    expect(after).toBe(before);
  });

  it('nested placement is undoable as one edit', () => {
    const leafId = carveModule('Leaf');
    const midId = carveModule('Mid');
    act(() => useProjectRuntime.getState().setActiveModule(midId));
    act(() => useProjectRuntime.getState().placeModuleInstance(leafId, { x: 400, y: 0 }, 'u_leaf0'));
    expect(
      useProjectRuntime.getState().hierarchy.modules.find((m) => m.id === midId)!.circuit.nodes
        .some((n) => n.config?.moduleDefinitionId === leafId),
    ).toBe(true);
    act(() => useProjectRuntime.getState().undoProjectEdit());
    expect(
      useProjectRuntime.getState().hierarchy.modules.find((m) => m.id === midId)!.circuit.nodes
        .some((n) => n.config?.moduleDefinitionId === leafId),
    ).toBe(false);
  });
});
