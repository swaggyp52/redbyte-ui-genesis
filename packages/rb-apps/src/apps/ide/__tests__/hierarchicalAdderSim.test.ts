import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
  elaborateProjectHierarchy,
  placeModuleInstance,
} from '../projectHierarchy';
import { recomputeSimulationState, resetSimulationState } from '../sim/simEngine';
import type { SimulationIoRow } from '../sim/simTypes';
import { createRBProject, decodeRBProject, encodeRBProject } from '../../../export/projectFormat';

// A FullAdder module built the real way (create-from-selection over gates).
function buildFullAdder() {
  const base: Circuit = {
    nodes: [
      { id: 'A', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
      { id: 'B', type: 'INPUT', label: 'B', position: { x: 0, y: 60 } },
      { id: 'CIN', type: 'INPUT', label: 'CIN', position: { x: 0, y: 120 } },
      { id: 'SUM', type: 'OUTPUT', label: 'SUM', position: { x: 500, y: 0 } },
      { id: 'COUT', type: 'OUTPUT', label: 'COUT', position: { x: 500, y: 120 } },
      { id: 'x1', type: 'XOR', position: { x: 160, y: 0 } },
      { id: 'x2', type: 'XOR', position: { x: 320, y: 0 } },
      { id: 'a1', type: 'AND', position: { x: 160, y: 120 } },
      { id: 'a2', type: 'AND', position: { x: 320, y: 120 } },
      { id: 'o1', type: 'OR', position: { x: 420, y: 120 } },
    ],
    connections: [
      { from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'x1', portName: 'a' } },
      { from: { nodeId: 'B', portName: 'out' }, to: { nodeId: 'x1', portName: 'b' } },
      { from: { nodeId: 'x1', portName: 'out' }, to: { nodeId: 'x2', portName: 'a' } },
      { from: { nodeId: 'CIN', portName: 'out' }, to: { nodeId: 'x2', portName: 'b' } },
      { from: { nodeId: 'x2', portName: 'out' }, to: { nodeId: 'SUM', portName: 'in' } },
      { from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'a1', portName: 'a' } },
      { from: { nodeId: 'B', portName: 'out' }, to: { nodeId: 'a1', portName: 'b' } },
      { from: { nodeId: 'CIN', portName: 'out' }, to: { nodeId: 'a2', portName: 'a' } },
      { from: { nodeId: 'x1', portName: 'out' }, to: { nodeId: 'a2', portName: 'b' } },
      { from: { nodeId: 'a1', portName: 'out' }, to: { nodeId: 'o1', portName: 'a' } },
      { from: { nodeId: 'a2', portName: 'out' }, to: { nodeId: 'o1', portName: 'b' } },
      { from: { nodeId: 'o1', portName: 'out' }, to: { nodeId: 'COUT', portName: 'in' } },
    ],
  };
  return createModuleFromSelection(base, createEmptyProjectHierarchy(), {
    moduleName: 'FullAdder', instanceName: 'u_fa0', selectedNodeIds: ['x1', 'x2', 'a1', 'a2', 'o1'],
    nowIso: '2026-08-08T12:00:00.000Z',
  });
}

// A 2-bit ripple-carry adder from two FullAdder instances + a carry chain.
function buildTwoBitAdder() {
  const fa = buildFullAdder();
  let top: Circuit = {
    nodes: [
      { id: 'A0', type: 'INPUT', label: 'A[0]', position: { x: 0, y: 0 } },
      { id: 'A1', type: 'INPUT', label: 'A[1]', position: { x: 0, y: 40 } },
      { id: 'B0', type: 'INPUT', label: 'B[0]', position: { x: 0, y: 80 } },
      { id: 'B1', type: 'INPUT', label: 'B[1]', position: { x: 0, y: 120 } },
      { id: 'S0', type: 'OUTPUT', label: 'SUM[0]', position: { x: 700, y: 0 } },
      { id: 'S1', type: 'OUTPUT', label: 'SUM[1]', position: { x: 700, y: 40 } },
      { id: 'CY', type: 'OUTPUT', label: 'CARRY', position: { x: 700, y: 80 } },
      { id: 'gnd', type: 'Ground', label: '0', position: { x: 0, y: 200 } },
    ],
    connections: [],
  };
  const p0 = placeModuleInstance(top, fa.definition, { x: 250, y: 0 }, 'u_fa0');
  const p1 = placeModuleInstance(p0.circuit, fa.definition, { x: 450, y: 0 }, 'u_fa1');
  const id0 = p0.instance.id;
  const id1 = p1.instance.id;
  top = {
    nodes: p1.circuit.nodes,
    connections: [
      { from: { nodeId: 'A0', portName: 'out' }, to: { nodeId: id0, portName: 'A' } },
      { from: { nodeId: 'B0', portName: 'out' }, to: { nodeId: id0, portName: 'B' } },
      { from: { nodeId: 'gnd', portName: 'out' }, to: { nodeId: id0, portName: 'CIN' } },
      { from: { nodeId: id0, portName: 'SUM' }, to: { nodeId: 'S0', portName: 'in' } },
      { from: { nodeId: 'A1', portName: 'out' }, to: { nodeId: id1, portName: 'A' } },
      { from: { nodeId: 'B1', portName: 'out' }, to: { nodeId: id1, portName: 'B' } },
      { from: { nodeId: id0, portName: 'COUT' }, to: { nodeId: id1, portName: 'CIN' } },
      { from: { nodeId: id1, portName: 'SUM' }, to: { nodeId: 'S1', portName: 'in' } },
      { from: { nodeId: id1, portName: 'COUT' }, to: { nodeId: 'CY', portName: 'in' } },
    ],
  };
  return { top, hierarchy: fa.hierarchy };
}

describe('hierarchical adder simulation', () => {
  it('computes A + B through elaborated FullAdder instances', () => {
    const { top, hierarchy } = buildTwoBitAdder();
    const flat = elaborateProjectHierarchy(top, hierarchy);
    // No module instances survive; only primitives and boundary nodes.
    expect(flat.nodes.every((n) => !n.config?.moduleDefinitionId)).toBe(true);

    const ioRows: SimulationIoRow[] = [
      { id: 'A0', nodeId: 'A0', label: 'A[0]', direction: 'in' },
      { id: 'A1', nodeId: 'A1', label: 'A[1]', direction: 'in' },
      { id: 'B0', nodeId: 'B0', label: 'B[0]', direction: 'in' },
      { id: 'B1', nodeId: 'B1', label: 'B[1]', direction: 'in' },
      { id: 'S0', nodeId: 'S0', label: 'SUM[0]', direction: 'out' },
      { id: 'S1', nodeId: 'S1', label: 'SUM[1]', direction: 'out' },
      { id: 'CY', nodeId: 'CY', label: 'CARRY', direction: 'out' },
    ];
    const reset = resetSimulationState(flat, ioRows);
    expect(reset.status).toBe('ok');
    if (reset.status !== 'ok') return;

    const bit = (v: number, i: number) => ((v >> i) & 1) as 0 | 1;
    const readOut = (sim: typeof reset.value, nodeId: string): 0 | 1 => {
      const v = sim.signals[nodeId] ?? sim.signals[`${nodeId}.in`] ?? sim.signals[`${nodeId}.out`] ?? 0;
      return v === 1 ? 1 : 0;
    };

    for (const [a, b] of [[0, 0], [1, 2], [3, 1], [2, 2], [3, 3]] as const) {
      let sim = { ...reset.value, inputs: { ...reset.value.inputs } };
      sim.inputs['A0'] = bit(a, 0); sim.inputs['A1'] = bit(a, 1);
      sim.inputs['B0'] = bit(b, 0); sim.inputs['B1'] = bit(b, 1);
      const settled = recomputeSimulationState(flat, ioRows, sim);
      expect(settled.status).toBe('ok');
      if (settled.status !== 'ok') return;
      const sum = readOut(settled.value, 'S0') + (readOut(settled.value, 'S1') << 1) + (readOut(settled.value, 'CY') << 2);
      expect(sum).toBe(a + b);
    }
  });

  it('survives save/reload with its hierarchy and re-simulates correctly', () => {
    const { top, hierarchy } = buildTwoBitAdder();
    const project = createRBProject({
      createdAt: '2026-08-30T00:00:00.000Z',
      name: '2-bit adder',
      circuit: top,
      hierarchy,
    });
    const reloaded = decodeRBProject(encodeRBProject(project));

    // Hierarchy and its FullAdder definition survive the round-trip.
    expect(reloaded.hierarchy?.modules.map((m) => m.name)).toContain('FullAdder');
    const fa = reloaded.hierarchy?.modules.find((m) => m.name === 'FullAdder');
    expect(fa?.ports.map((p) => p.name).sort()).toEqual(['A', 'B', 'CIN', 'COUT', 'SUM']);
    // Both instances survive at the top.
    const instances = reloaded.circuit.nodes.filter((n) => n.config?.moduleDefinitionId);
    expect(instances).toHaveLength(2);

    // The reloaded project still elaborates and adds correctly.
    const flat = elaborateProjectHierarchy(reloaded.circuit, reloaded.hierarchy);
    const ioRows: SimulationIoRow[] = [
      { id: 'A0', nodeId: 'A0', label: 'A[0]', direction: 'in' },
      { id: 'A1', nodeId: 'A1', label: 'A[1]', direction: 'in' },
      { id: 'B0', nodeId: 'B0', label: 'B[0]', direction: 'in' },
      { id: 'B1', nodeId: 'B1', label: 'B[1]', direction: 'in' },
      { id: 'S0', nodeId: 'S0', label: 'SUM[0]', direction: 'out' },
      { id: 'S1', nodeId: 'S1', label: 'SUM[1]', direction: 'out' },
      { id: 'CY', nodeId: 'CY', label: 'CARRY', direction: 'out' },
    ];
    const reset = resetSimulationState(flat, ioRows);
    expect(reset.status).toBe('ok');
    if (reset.status !== 'ok') return;
    let sim = { ...reset.value, inputs: { ...reset.value.inputs, A0: 1, A1: 1, B0: 1, B1: 0 } }; // 3 + 1
    const settled = recomputeSimulationState(flat, ioRows, sim);
    expect(settled.status).toBe('ok');
    if (settled.status !== 'ok') return;
    const read = (id: string): number => {
      const v = settled.value.signals[id] ?? settled.value.signals[`${id}.in`] ?? 0;
      return v === 1 ? 1 : 0;
    };
    expect(read('S0') + (read('S1') << 1) + (read('CY') << 2)).toBe(4);
  });
});
