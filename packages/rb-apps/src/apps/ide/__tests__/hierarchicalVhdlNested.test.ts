import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../export/projectFormat';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
  placeModuleInstance,
  type ProjectHierarchyDocument,
} from '../projectHierarchy';
import { generateHierarchicalVhdlProject } from '../hierarchicalVhdl';

// A 2-NOT passthrough (A → n1 → n2 → Y); carving [n1,n2] yields a module with
// scalar ports A (in) and Y (out).
function twoNot(): Circuit {
  return {
    nodes: [
      { id: 'A', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
      { id: 'n1', type: 'NOT', position: { x: 120, y: 0 } },
      { id: 'n2', type: 'NOT', position: { x: 240, y: 0 } },
      { id: 'Y', type: 'OUTPUT', label: 'Y', position: { x: 360, y: 0 } },
    ],
    connections: [
      { from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'n1', portName: 'in' } },
      { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'in' } },
      { from: { nodeId: 'n2', portName: 'out' }, to: { nodeId: 'Y', portName: 'in' } },
    ],
  };
}

describe('hierarchical VHDL — nested module inside a definition', () => {
  it('emits a component instantiation for a module placed inside another module', () => {
    const leaf = createModuleFromSelection(twoNot(), createEmptyProjectHierarchy(), {
      moduleName: 'Leaf', instanceName: 'u_leaf', selectedNodeIds: ['n1', 'n2'],
      nowIso: '2026-08-30T00:00:00.000Z',
    });
    const mid = createModuleFromSelection(twoNot(), leaf.hierarchy, {
      moduleName: 'Mid', instanceName: 'u_mid', selectedNodeIds: ['n1', 'n2'],
      nowIso: '2026-08-30T00:00:00.000Z',
    });
    const leafDef = mid.hierarchy.modules.find((m) => m.name === 'Leaf')!;
    const midDef = mid.hierarchy.modules.find((m) => m.name === 'Mid')!;

    // Place a Leaf instance inside Mid's definition circuit.
    const placed = placeModuleInstance(midDef.circuit, leafDef, { x: 400, y: 0 }, 'u_leaf0');
    const hierarchy: ProjectHierarchyDocument = {
      ...mid.hierarchy,
      modules: mid.hierarchy.modules.map((m) => (m.id === midDef.id ? { ...m, circuit: placed.circuit } : m)),
    };

    const project: RBProject = {
      kind: 'rb-project', version: 1, createdAt: 'x', updatedAt: 'x', name: 'nested',
      circuit: mid.circuit, hierarchy,
      ioMapping: { inputs: [], outputs: [] },
      hdl: { top: 'top', sources: [] },
    };
    const out = generateHierarchicalVhdlProject(project);
    expect(out).not.toBeNull();

    const midSrc = out!.moduleSources.find((s) => s.entityName === 'Mid')?.text ?? '';
    // Mid must instantiate Leaf as a component, not drop it as an unknown gate.
    expect(midSrc).toMatch(/u_leaf0\s*:\s*entity work\.Leaf/);
    expect(midSrc).toMatch(/architecture structural of Mid/);

    // Leaf itself is primitive-only and keeps the gate-level body.
    const leafSrc = out!.moduleSources.find((s) => s.entityName === 'Leaf')?.text ?? '';
    expect(leafSrc).not.toMatch(/entity work\./);

    // Compile order is leaf-first: Leaf appears before Mid.
    const order = out!.moduleSources.map((s) => s.entityName);
    expect(order.indexOf('Leaf')).toBeLessThan(order.indexOf('Mid'));
  });
});
