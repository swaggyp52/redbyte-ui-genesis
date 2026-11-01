import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../export/projectFormat';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
  elaborateProjectHierarchy,
  modulePortVhdlType,
  modulePortWidth,
  placeModuleInstance,
} from '../projectHierarchy';
import { generateHierarchicalVhdlProject } from '../hierarchicalVhdl';
import { recomputeSimulationState, resetSimulationState } from '../sim/simEngine';
import type { SimulationIoRow } from '../sim/simTypes';

// A connected 2-bit module over bus members A[1:0] and Y[1:0]:
//   Y[0] = NOT(A[0]);  Y[1] = XOR(NOT(A[0]), A[1]).
// n0 → x1 keeps the selection one connected subcircuit; the shared bus at the
// boundary is what fuses A[0]/A[1] and Y[0]/Y[1] into vector module ports.
function buildInvBus() {
  const base: Circuit = {
    nodes: [
      { id: 'A0', type: 'INPUT', label: 'A[0]', position: { x: 0, y: 0 } },
      { id: 'A1', type: 'INPUT', label: 'A[1]', position: { x: 0, y: 60 } },
      { id: 'Y0', type: 'OUTPUT', label: 'Y[0]', position: { x: 340, y: 0 } },
      { id: 'Y1', type: 'OUTPUT', label: 'Y[1]', position: { x: 340, y: 60 } },
      { id: 'n0', type: 'NOT', position: { x: 150, y: 0 } },
      { id: 'x1', type: 'XOR', position: { x: 240, y: 60 } },
    ],
    connections: [
      { from: { nodeId: 'A0', portName: 'out' }, to: { nodeId: 'n0', portName: 'in' } },
      { from: { nodeId: 'n0', portName: 'out' }, to: { nodeId: 'Y0', portName: 'in' } },
      { from: { nodeId: 'n0', portName: 'out' }, to: { nodeId: 'x1', portName: 'a' } },
      { from: { nodeId: 'A1', portName: 'out' }, to: { nodeId: 'x1', portName: 'b' } },
      { from: { nodeId: 'x1', portName: 'out' }, to: { nodeId: 'Y1', portName: 'in' } },
    ],
  };
  return createModuleFromSelection(base, createEmptyProjectHierarchy(), {
    moduleName: 'InvBus', instanceName: 'u_inv', selectedNodeIds: ['n0', 'x1'],
    nowIso: '2026-08-30T00:00:00.000Z',
  });
}

describe('vector module ports', () => {
  it('fuses bus-member boundaries into width-N module ports', () => {
    const inv = buildInvBus();
    const ports = inv.definition.ports;
    const a = ports.find((p) => p.name === 'A');
    const y = ports.find((p) => p.name === 'Y');
    expect(a).toBeDefined();
    expect(y).toBeDefined();
    expect(modulePortWidth(a!)).toBe(2);
    expect(modulePortWidth(y!)).toBe(2);
    expect(a!.range).toEqual({ left: 1, right: 0 });
    expect(a!.sourceBoundary.bits?.map((b) => b.index).sort()).toEqual([0, 1]);
    expect(modulePortVhdlType(a!)).toBe('STD_LOGIC_VECTOR(1 downto 0)');
    // The parent instance is wired per bit as A(0)/A(1), not the whole vector.
    const inConns = inv.circuit.connections.filter(
      (c) => typeof c.to !== 'string' && c.to.nodeId === inv.instance.id,
    );
    expect(inConns.map((c) => (typeof c.to !== 'string' ? c.to.portName : '')).sort()).toEqual(['A(0)', 'A(1)']);
  });

  it('declares a vector port in the generated module VHDL', () => {
    const inv = buildInvBus();
    const project: RBProject = {
      kind: 'rb-project', version: 1,
      createdAt: 'x', updatedAt: 'x', name: 'inv', circuit: inv.circuit, hierarchy: inv.hierarchy,
      ioMapping: {
        inputs: [
          { id: 'A0', nodeId: 'A0', port: 'out', label: 'A[0]', pin: 'V17' },
          { id: 'A1', nodeId: 'A1', port: 'out', label: 'A[1]', pin: 'V16' },
        ],
        outputs: [
          { id: 'Y0', nodeId: 'Y0', port: 'in', label: 'Y[0]', pin: 'U16' },
          { id: 'Y1', nodeId: 'Y1', port: 'in', label: 'Y[1]', pin: 'E19' },
        ],
      },
      hdl: { top: 'inv_top', sources: [] },
    };
    const out = generateHierarchicalVhdlProject(project);
    const moduleSrc = out?.moduleSources.find((s) => s.entityName === 'InvBus')?.text ?? '';
    expect(moduleSrc).toMatch(/A\s*:\s*(in|IN)\s+STD_LOGIC_VECTOR\(1 downto 0\)/);
    expect(moduleSrc).toMatch(/Y\s*:\s*(out|OUT)\s+STD_LOGIC_VECTOR\(1 downto 0\)/);
  });

  it('elaborates and simulates a vector-port module instance', () => {
    const inv = buildInvBus();
    // Top: bus A[1:0] → InvBus → bus Y[1:0], wired per bit.
    let top: Circuit = {
      nodes: [
        { id: 'TA0', type: 'INPUT', label: 'A[0]', position: { x: 0, y: 0 } },
        { id: 'TA1', type: 'INPUT', label: 'A[1]', position: { x: 0, y: 40 } },
        { id: 'TY0', type: 'OUTPUT', label: 'Y[0]', position: { x: 400, y: 0 } },
        { id: 'TY1', type: 'OUTPUT', label: 'Y[1]', position: { x: 400, y: 40 } },
      ],
      connections: [],
    };
    const placed = placeModuleInstance(top, inv.definition, { x: 200, y: 0 }, 'u_inv0');
    const id = placed.instance.id;
    top = {
      nodes: placed.circuit.nodes,
      connections: [
        { from: { nodeId: 'TA0', portName: 'out' }, to: { nodeId: id, portName: 'A(0)' } },
        { from: { nodeId: 'TA1', portName: 'out' }, to: { nodeId: id, portName: 'A(1)' } },
        { from: { nodeId: id, portName: 'Y(0)' }, to: { nodeId: 'TY0', portName: 'in' } },
        { from: { nodeId: id, portName: 'Y(1)' }, to: { nodeId: 'TY1', portName: 'in' } },
      ],
    };
    const flat = elaborateProjectHierarchy(top, inv.hierarchy);
    expect(flat.nodes.filter((n) => n.type === 'NOT')).toHaveLength(1);
    expect(flat.nodes.filter((n) => n.type === 'XOR')).toHaveLength(1);
    expect(flat.nodes.every((n) => !n.config?.moduleDefinitionId)).toBe(true);

    const ioRows: SimulationIoRow[] = [
      { id: 'TA0', nodeId: 'TA0', label: 'A[0]', direction: 'in' },
      { id: 'TA1', nodeId: 'TA1', label: 'A[1]', direction: 'in' },
      { id: 'TY0', nodeId: 'TY0', label: 'Y[0]', direction: 'out' },
      { id: 'TY1', nodeId: 'TY1', label: 'Y[1]', direction: 'out' },
    ];
    const reset = resetSimulationState(flat, ioRows);
    expect(reset.status).toBe('ok');
    if (reset.status !== 'ok') return;
    // A[0]=1, A[1]=1 → Y[0]=NOT(1)=0; Y[1]=XOR(0,1)=1.
    const sim = { ...reset.value, inputs: { ...reset.value.inputs, TA0: 1 as const, TA1: 1 as const } };
    const settled = recomputeSimulationState(flat, ioRows, sim);
    expect(settled.status).toBe('ok');
    if (settled.status !== 'ok') return;
    const read = (id2: string) => {
      const v = settled.value.signals[id2] ?? settled.value.signals[`${id2}.in`] ?? 0;
      return v === 1 ? 1 : 0;
    };
    expect(read('TY0')).toBe(0);
    expect(read('TY1')).toBe(1);
  });
});
