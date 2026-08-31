// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectRuntime } from '../projectRuntime';
import { TOP_MODULE_ID } from '../projectHierarchy';

/**
 * P1-C — create-module-from-selection works while drilled into a nested module,
 * not only at the top. The new module is added to the hierarchy, the active
 * module's circuit gets the instance in place of the selection, and the active
 * module's port internal-refs are re-derived so elaboration/sim stay valid.
 */

const rt = () => useProjectRuntime.getState();

function moduleInstanceCount(circuitNodes: { config?: Record<string, unknown> }[], moduleId: string): number {
  return circuitNodes.filter((node) => node.config?.moduleDefinitionId === moduleId).length;
}

describe('nested createModuleFromSelection', () => {
  beforeEach(() => {
    act(() => {
      rt().loadExample('half-adder');
    });
  });

  it('creates a module from a selection inside an open module, keeping sim valid', () => {
    const gates = rt().circuit.nodes.filter((n) => n.type === 'AND' || n.type === 'XOR').map((n) => n.id);
    expect(gates.length).toBe(2);
    let m1: string | null = null;
    act(() => {
      m1 = rt().createModuleFromSelection({ moduleName: 'Outer', instanceName: 'u_outer', selectedNodeIds: gates })?.definition.id ?? null;
    });
    expect(m1).toBeTruthy();
    expect(rt().hierarchy.modules).toHaveLength(1);
    expect(moduleInstanceCount(rt().circuit.nodes, m1!)).toBe(1);

    act(() => rt().setActiveModule(m1!));
    const outer = rt().hierarchy.modules.find((mod) => mod.id === m1)!;
    const innerGates = outer.circuit.nodes.filter((n) => n.type === 'AND' || n.type === 'XOR').map((n) => n.id);
    expect(innerGates.length).toBe(2);

    let m2: string | null = null;
    act(() => {
      m2 = rt().createModuleFromSelection({ moduleName: 'Inner', instanceName: 'u_inner', selectedNodeIds: innerGates })?.definition.id ?? null;
    });
    // The nested creation SUCCEEDS (returns the new module, not null).
    expect(m2).toBeTruthy();
    expect(m2).not.toBe(m1);
    expect(rt().hierarchy.modules.map((mod) => mod.name).sort()).toEqual(['Inner', 'Outer']);
    expect(rt().hierarchy.activeModuleId).toBe(m1);

    // M1 now instantiates M2; the top circuit is unchanged (no M2 there).
    const outerAfter = rt().hierarchy.modules.find((mod) => mod.id === m1)!;
    expect(moduleInstanceCount(outerAfter.circuit.nodes, m2!)).toBe(1);
    expect(moduleInstanceCount(rt().circuit.nodes, m2!)).toBe(0);

    // The simulation stayed runnable (no engine validation failure), and the
    // half-adder still computes: SW0=1, SW1=1 → LD0(carry)=1, LD1(sum)=0.
    act(() => {
      rt().actions.sim.setInput('sw0_node', 1);
      rt().actions.sim.setInput('sw1_node', 1);
    });
    const sim = rt().sim;
    const read = (id: string) => sim.signals[`${id}.out`] ?? sim.signals[id];
    expect(read('ld0_node')).toBe(1);
    expect(read('ld1_node')).toBe(0);
  });

  it('supports undo of the nested creation', () => {
    const gates = rt().circuit.nodes.filter((n) => n.type === 'AND' || n.type === 'XOR').map((n) => n.id);
    let m1: string | null = null;
    act(() => {
      m1 = rt().createModuleFromSelection({ moduleName: 'Outer', instanceName: 'u_outer', selectedNodeIds: gates })?.definition.id ?? null;
      rt().setActiveModule(m1!);
    });
    const outer = rt().hierarchy.modules.find((mod) => mod.id === m1)!;
    const innerGates = outer.circuit.nodes.filter((n) => n.type === 'AND' || n.type === 'XOR').map((n) => n.id);
    act(() => {
      rt().createModuleFromSelection({ moduleName: 'Inner', instanceName: 'u_inner', selectedNodeIds: innerGates });
    });
    expect(rt().hierarchy.modules).toHaveLength(2);
    act(() => rt().undoProjectEdit());
    expect(rt().hierarchy.modules).toHaveLength(1);
  });

  it('leaves top-level creation working (regression)', () => {
    expect(rt().hierarchy.activeModuleId).toBe(TOP_MODULE_ID);
    const gates = rt().circuit.nodes.filter((n) => n.type === 'AND' || n.type === 'XOR').map((n) => n.id);
    act(() => {
      rt().createModuleFromSelection({ moduleName: 'Combo', instanceName: 'u_combo', selectedNodeIds: gates });
    });
    expect(rt().hierarchy.modules).toHaveLength(1);
    expect(rt().hierarchy.modules[0].name).toBe('Combo');
  });
});
