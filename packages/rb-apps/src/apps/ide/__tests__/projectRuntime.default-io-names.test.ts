import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useProjectRuntime } from '../projectRuntime';

const EMPTY: RBProject = {
  kind: 'rb-project',
  version: 1,
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
  name: 'Default names fixture',
  circuit: { nodes: [], connections: [] },
  ioMapping: { inputs: [], outputs: [] },
  vectors: [],
  meta: { projectId: 'rb-default-io-names-fixture' },
};

/**
 * Pins placed from the library get distinct default names. In rc.8 two Input Pins placed one after
 * the other were both "Input 1" (owner acceptance V5): the first kept its name while the default
 * counter for the second started again at 1.
 */
describe('default names of placed inputs and outputs', () => {
  beforeEach(() => {
    localStorage.clear();
    useCircuitStore.getState().reset();
    useProjectRuntime.getState().resetToActiveExample();
    useProjectRuntime.getState().loadFromProject(EMPTY);
    useProjectRuntime.getState().startBlankProject();
  });

  const labels = () => useProjectRuntime.getState().projectIoRows.map((row) => row.label);

  it('numbers library-placed pins in placement order', () => {
    useProjectRuntime.getState().addDesignNode('INPUT', { x: 120, y: 120 });
    useProjectRuntime.getState().addDesignNode('INPUT', { x: 120, y: 220 });
    useProjectRuntime.getState().addDesignNode('OUTPUT', { x: 420, y: 170 });
    expect(labels()).toEqual(['Input 1', 'Input 2', 'Output 1']);
  });

  it('keeps names unique around a name the student chose', () => {
    useProjectRuntime.getState().addDesignNode('INPUT', { x: 120, y: 120 });
    const circuit = structuredClone(useProjectRuntime.getState().circuit);
    circuit.nodes[0]!.label = 'Input 2';
    useProjectRuntime.getState().applyCircuitMutation(circuit);
    useProjectRuntime.getState().addDesignNode('INPUT', { x: 120, y: 220 });
    expect(labels()).toEqual(['Input 2', 'Input 1']);
  });

  it('never repeats a name still on the sheet after a deletion', () => {
    for (const y of [120, 220, 320]) useProjectRuntime.getState().addDesignIo('input', { x: 120, y });
    const circuit = structuredClone(useProjectRuntime.getState().circuit);
    const first = circuit.nodes.find((node) => node.label === 'Input 1')!;
    circuit.nodes = circuit.nodes.filter((node) => node.id !== first.id);
    useProjectRuntime.getState().applyCircuitMutation(circuit);
    useProjectRuntime.getState().addDesignIo('input', { x: 120, y: 420 });
    useProjectRuntime.getState().addDesignNode('INPUT', { x: 120, y: 520 });
    const names = labels();
    expect(new Set(names).size, names.join(', ')).toBe(names.length);
    expect(names).toEqual(['Input 2', 'Input 3', 'Input 4', 'Input 1']);
  });
});
