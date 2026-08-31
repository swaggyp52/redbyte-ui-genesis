import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../export/projectFormat';
import { createEmptyProjectHierarchy, createModuleFromSelection } from '../projectHierarchy';
import { generateHierarchicalVhdlProject } from '../hierarchicalVhdl';

describe('hierarchical VHDL handoff', () => {
  it('emits a structural top plus a reusable module source', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'INPUT', label: 'B', position: { x: 0, y: 100 } },
        { id: 'g1', type: 'XOR', position: { x: 200, y: 50 } },
        { id: 'g2', type: 'NOT', position: { x: 380, y: 50 } },
        { id: 'y', type: 'OUTPUT', label: 'Y', position: { x: 560, y: 50 } },
      ],
      connections: [
        { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g1', portName: 'a' } },
        { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g1', portName: 'b' } },
        { from: { nodeId: 'g1', portName: 'out' }, to: { nodeId: 'g2', portName: 'in' } },
        { from: { nodeId: 'g2', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } },
      ],
    };
    const created = createModuleFromSelection(circuit, createEmptyProjectHierarchy(), {
      moduleName: 'InvertXor',
      instanceName: 'logic0',
      selectedNodeIds: ['g1', 'g2'],
      nowIso: '2026-08-08T12:00:00.000Z',
    });
    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-08-08T12:00:00.000Z',
      updatedAt: '2026-08-08T12:00:00.000Z',
      name: 'VHDL fixture',
      circuit: created.circuit,
      hierarchy: created.hierarchy,
      ioMapping: {
        inputs: [
          { id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'V17' },
          { id: 'b', nodeId: 'b', port: 'out', label: 'B', pin: 'V16' },
        ],
        outputs: [{ id: 'y', nodeId: 'y', port: 'in', label: 'Y', pin: 'U16' }],
      },
      hdl: { top: 'hierarchy_top', sources: [] },
    };

    const output = generateHierarchicalVhdlProject(project);
    expect(output?.moduleSources.map((source) => source.path)).toEqual(['invert_xor.vhd']);
    expect(output?.topVhd).toContain('entity hierarchy_top is');
    expect(output?.topVhd).toContain('end entity hierarchy_top;');
    expect(output?.topVhd).toContain('logic0 : entity work.InvertXor');
    expect(output?.moduleSources[0]?.text).toContain('entity InvertXor is');
    expect(output?.moduleSources[0]?.text).toContain('xor');
  });

  it('bit-selects vector top ports so a bus member wires to NAME(i), not the whole vector', () => {
    // A 2-bit ripple structure: two FullAdder instances, top buses A/B/SUM.
    const faGates = (p: string, x: number): Circuit['nodes'] => [
      { id: `${p}x1`, type: 'XOR', position: { x, y: 0 } },
      { id: `${p}x2`, type: 'XOR', position: { x: x + 80, y: 0 } },
      { id: `${p}a1`, type: 'AND', position: { x, y: 120 } },
      { id: `${p}a2`, type: 'AND', position: { x: x + 80, y: 120 } },
      { id: `${p}o1`, type: 'OR', position: { x: x + 160, y: 120 } },
    ];
    // Build one FullAdder module from a selection, reuse it for two instances.
    const base: Circuit = {
      nodes: [
        { id: 'A', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
        { id: 'B', type: 'INPUT', label: 'B', position: { x: 0, y: 60 } },
        { id: 'CIN', type: 'INPUT', label: 'CIN', position: { x: 0, y: 120 } },
        { id: 'SUM', type: 'OUTPUT', label: 'SUM', position: { x: 400, y: 0 } },
        { id: 'COUT', type: 'OUTPUT', label: 'COUT', position: { x: 400, y: 120 } },
        ...faGates('', 160),
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
    const created = createModuleFromSelection(base, createEmptyProjectHierarchy(), {
      moduleName: 'FullAdder',
      instanceName: 'u_fa0',
      selectedNodeIds: ['x1', 'x2', 'a1', 'a2', 'o1'],
      nowIso: '2026-08-08T12:00:00.000Z',
    });
    // Top: two bus members A[0..1], B[0..1], SUM[0..1] each wired to an instance.
    const top: Circuit = {
      nodes: [
        { id: 'A0', type: 'INPUT', label: 'A[0]', position: { x: 0, y: 0 } },
        { id: 'A1', type: 'INPUT', label: 'A[1]', position: { x: 0, y: 40 } },
        { id: 'B0', type: 'INPUT', label: 'B[0]', position: { x: 0, y: 80 } },
        { id: 'B1', type: 'INPUT', label: 'B[1]', position: { x: 0, y: 120 } },
        { id: 'S0', type: 'OUTPUT', label: 'SUM[0]', position: { x: 600, y: 0 } },
        { id: 'S1', type: 'OUTPUT', label: 'SUM[1]', position: { x: 600, y: 40 } },
        { id: 'gnd', type: 'Ground', label: '0', position: { x: 0, y: 200 } },
        created.instance,
        { ...created.instance, id: 'u_fa1', label: 'u_fa1', config: { ...created.instance.config, instanceName: 'u_fa1', label: 'u_fa1' } },
      ],
      connections: [
        { from: { nodeId: 'A0', portName: 'out' }, to: { nodeId: created.instance.id, portName: 'A' } },
        { from: { nodeId: 'B0', portName: 'out' }, to: { nodeId: created.instance.id, portName: 'B' } },
        { from: { nodeId: 'gnd', portName: 'out' }, to: { nodeId: created.instance.id, portName: 'CIN' } },
        { from: { nodeId: created.instance.id, portName: 'SUM' }, to: { nodeId: 'S0', portName: 'in' } },
        { from: { nodeId: 'A1', portName: 'out' }, to: { nodeId: 'u_fa1', portName: 'A' } },
        { from: { nodeId: 'B1', portName: 'out' }, to: { nodeId: 'u_fa1', portName: 'B' } },
        { from: { nodeId: created.instance.id, portName: 'COUT' }, to: { nodeId: 'u_fa1', portName: 'CIN' } },
        { from: { nodeId: 'u_fa1', portName: 'SUM' }, to: { nodeId: 'S1', portName: 'in' } },
      ],
    };
    const project: RBProject = {
      kind: 'rb-project', version: 1,
      createdAt: '2026-08-08T12:00:00.000Z', updatedAt: '2026-08-08T12:00:00.000Z',
      name: 'ripple', circuit: top, hierarchy: created.hierarchy,
      ioMapping: {
        inputs: [
          { id: 'A0', nodeId: 'A0', port: 'out', label: 'A[0]', pin: 'V17' },
          { id: 'A1', nodeId: 'A1', port: 'out', label: 'A[1]', pin: 'V16' },
          { id: 'B0', nodeId: 'B0', port: 'out', label: 'B[0]', pin: 'W16' },
          { id: 'B1', nodeId: 'B1', port: 'out', label: 'B[1]', pin: 'W17' },
        ],
        outputs: [
          { id: 'S0', nodeId: 'S0', port: 'in', label: 'SUM[0]', pin: 'U16' },
          { id: 'S1', nodeId: 'S1', port: 'in', label: 'SUM[1]', pin: 'E19' },
        ],
      },
      hdl: { top: 'ripple_top', sources: [] },
    };
    const top2 = generateHierarchicalVhdlProject(project)!.topVhd;
    // Vector top ports.
    expect(top2).toMatch(/A\s*:\s*IN\s+STD_LOGIC_VECTOR\(1 downto 0\)/i);
    expect(top2).toMatch(/SUM\s*:\s*OUT\s+STD_LOGIC_VECTOR\(1 downto 0\)/i);
    // Each instance gets its own bus BIT, not the whole vector.
    expect(top2).toContain('A => A(0)');
    expect(top2).toContain('A => A(1)');
    expect(top2).toContain('B => B(0)');
    expect(top2).toContain('B => B(1)');
    expect(top2).not.toContain('A => A\n');
    // Each SUM bit is driven separately (no multi-driver on the whole vector).
    expect(top2).toContain('SUM(0) <=');
    expect(top2).toContain('SUM(1) <=');
    // Carry chain: u_fa1.CIN comes from u_fa0's COUT signal, not a constant.
    expect(top2).toMatch(/u_fa1[\s\S]*CIN => n_[A-Za-z0-9_]*fa0[A-Za-z0-9_]*COUT/i);
  });
});
