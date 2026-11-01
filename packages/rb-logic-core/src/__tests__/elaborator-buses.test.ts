// Copyright © 2026 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it } from 'vitest';
import type { Circuit } from '../types';
import { createBusBoundary, synthesizeBusDeclarations } from '../bus';
import { elaborateCircuit } from '../ir';

const busPair = (): Circuit => {
  let circuit: Circuit = { nodes: [], connections: [] };
  circuit = createBusBoundary(circuit, { name: 'A', direction: 'input', left: 3, right: 0 }).circuit;
  circuit = createBusBoundary(circuit, { name: 'Y', direction: 'output', left: 3, right: 0 }).circuit;
  return circuit;
};

describe('elaborator: declared buses', () => {
  it('resolves complete declarations into IR bus ports with declared width', () => {
    const { ir } = elaborateCircuit(busPair());
    expect(ir.buses).toHaveLength(2);
    const a = ir.buses!.find((bus) => bus.name === 'A')!;
    expect(a.kind).toBe('input');
    expect(a.signalType.width).toBe(4);
    expect(a.left).toBe(3);
    expect(a.right).toBe(0);
    expect(a.bits.map((bit) => bit.index)).toEqual([3, 2, 1, 0]);
    // Every bit resolves to a real boundary port.
    const portIds = new Set(ir.ports.map((port) => port.id));
    expect(a.bits.every((bit) => portIds.has(bit.portId))).toBe(true);
  });

  it('diagnoses incomplete declarations as IR007 and omits them from ir.buses', () => {
    const circuit = busPair();
    const withoutOneMember: Circuit = {
      ...circuit,
      nodes: circuit.nodes.filter((node) => node.label !== 'A[2]'),
      buses: circuit.buses, // declaration still claims the missing bit
    };
    const { ir } = elaborateCircuit(withoutOneMember);
    expect(ir.buses?.map((bus) => bus.name)).toEqual(['Y']);
    const ir007 = ir.diagnostics.filter((diagnostic) => diagnostic.code === 'IR007');
    expect(ir007).toHaveLength(1);
    expect(ir007[0].severity).toBe('warning');
    expect(ir007[0].message).toContain('A[2]');
    // A missing bus bit degrades to scalars; it never blocks elaboration.
    expect(ir.isValid).toBe(true);
  });

  it('does not change the IR hash of a scalar circuit when declarations are added', () => {
    const scalar: Circuit = {
      nodes: [
        { id: 'a0', type: 'Switch', label: 'D[0]' },
        { id: 'a1', type: 'Switch', label: 'D[1]' },
        { id: 'y', type: 'Lamp', label: 'OUT' },
      ],
      connections: [],
    };
    const before = elaborateCircuit(scalar).ir;
    const after = elaborateCircuit(synthesizeBusDeclarations(scalar)).ir;
    expect(before.buses).toBeUndefined();
    expect(after.buses).toHaveLength(1);
    expect(after.irHash).toBe(before.irHash);
  });
});
