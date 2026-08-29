// Copyright © 2026 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it } from 'vitest';
import type { Circuit, LogicValue } from './types';
import {
  BusRangeError,
  BusValidationError,
  BusWidthMismatchError,
  busBitPortRef,
  busBitRef,
  busForNode,
  busIndices,
  busIsDescending,
  busMemberNodeIds,
  busRangeLabel,
  busSlice,
  busWidth,
  busWordToBits,
  connectBuses,
  createBusBoundary,
  deleteBus,
  formatBusWordHex,
  normalizeBusDeclarations,
  parseVectorLabel,
  readBusWord,
  renameBus,
  synthesizeBusDeclarations,
  validateBusDeclarations,
} from './bus';

const emptyCircuit = (): Circuit => ({ nodes: [], connections: [] });

const legacyRipple = (): Circuit => ({
  nodes: [
    { id: 'a0', type: 'Switch', label: 'A[0]', position: { x: 0, y: 0 } },
    { id: 'a1', type: 'Switch', label: 'A[1]', position: { x: 0, y: 60 } },
    { id: 'a2', type: 'Switch', label: 'A[2]', position: { x: 0, y: 120 } },
    { id: 'a3', type: 'Switch', label: 'A[3]', position: { x: 0, y: 180 } },
    { id: 's0', type: 'Lamp', label: 'SUM[0]', position: { x: 400, y: 0 } },
    { id: 's1', type: 'Lamp', label: 'SUM[1]', position: { x: 400, y: 60 } },
    { id: 'carry', type: 'Lamp', label: 'CARRY', position: { x: 400, y: 240 } },
  ],
  connections: [],
});

describe('parseVectorLabel', () => {
  it('parses the canonical convention including suffixed labels', () => {
    expect(parseVectorLabel('A[3]')).toEqual({ baseName: 'A', bitIndex: 3 });
    expect(parseVectorLabel('SW[0] (A[0])')).toEqual({ baseName: 'SW', bitIndex: 0 });
    expect(parseVectorLabel('CARRY')).toBeNull();
    expect(parseVectorLabel(undefined)).toBeNull();
  });
});

describe('range helpers', () => {
  const descending = { name: 'A', left: 3, right: 0 };
  const ascending = { name: 'B', left: 0, right: 3 };

  it('computes width, order, indices, and display label', () => {
    expect(busWidth(descending)).toBe(4);
    expect(busIsDescending(descending)).toBe(true);
    expect(busIndices(descending)).toEqual([3, 2, 1, 0]);
    expect(busRangeLabel(descending)).toBe('A[3:0]');

    expect(busIsDescending(ascending)).toBe(false);
    expect(busIndices(ascending)).toEqual([0, 1, 2, 3]);
    expect(busRangeLabel(ascending)).toBe('B[0:3]');
  });
});

describe('createBusBoundary', () => {
  it('creates one labeled boundary node per bit plus the declaration', () => {
    const { circuit, bus, memberNodes } = createBusBoundary(emptyCircuit(), {
      name: 'A',
      direction: 'input',
      left: 3,
      right: 0,
    });
    expect(memberNodes).toHaveLength(4);
    expect(memberNodes.map((node) => node.label)).toEqual(['A[3]', 'A[2]', 'A[1]', 'A[0]']);
    expect(memberNodes.every((node) => node.type === 'INPUT')).toBe(true);
    expect(bus.bits.map((bit) => bit.index)).toEqual([0, 1, 2, 3]);
    expect(circuit.buses).toHaveLength(1);
    expect(validateBusDeclarations(circuit)).toEqual([]);
  });

  it('rejects invalid names, width-1 ranges, duplicates, and label conflicts', () => {
    expect(() =>
      createBusBoundary(emptyCircuit(), { name: '2bad', direction: 'input', left: 1, right: 0 })
    ).toThrow(BusValidationError);
    expect(() =>
      createBusBoundary(emptyCircuit(), { name: 'A', direction: 'input', left: 0, right: 0 })
    ).toThrow(BusValidationError);

    const first = createBusBoundary(emptyCircuit(), {
      name: 'A',
      direction: 'input',
      left: 1,
      right: 0,
    }).circuit;
    expect(() =>
      createBusBoundary(first, { name: 'A', direction: 'input', left: 3, right: 0 })
    ).toThrow(BusValidationError);

    expect(() =>
      createBusBoundary(legacyRipple(), { name: 'A', direction: 'output', left: 1, right: 0 })
    ).toThrow(BusValidationError);
  });
});

describe('bit tap and slice', () => {
  const { circuit, bus } = createBusBoundary(emptyCircuit(), {
    name: 'A',
    direction: 'input',
    left: 3,
    right: 0,
  });

  it('taps a single bit to a node and its carrying port', () => {
    const bit = busBitRef(bus, 2);
    expect(bit).not.toBeNull();
    const ref = busBitPortRef(bus, 2);
    expect(ref).toEqual({ nodeId: bit!.nodeId, portName: 'out' });
    expect(busBitPortRef(bus, 9)).toBeNull();
    expect(busForNode(circuit, bit!.nodeId)).toMatchObject({ index: 2 });
  });

  it('slices a declared range in declared order and rejects bad ranges', () => {
    const slice = busSlice(bus, 2, 1);
    expect(slice.map((bit) => bit.index)).toEqual([2, 1]);
    expect(() => busSlice(bus, 4, 0)).toThrow(BusRangeError);
    expect(() => busSlice(bus, 0, 2)).toThrow(BusRangeError);
  });
});

describe('words', () => {
  const decl = { left: 3, right: 0 };

  it('collapses bits to a word and back', () => {
    const bits = busWordToBits(decl, 0xa);
    expect([...bits.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ]);
    const word = readBusWord(decl, bits);
    expect(word).toMatchObject({ value: 10, binary: '1010', hasUnknown: false, width: 4 });
    expect(formatBusWordHex(word)).toBe('0xA');
  });

  it('reports unknowns instead of inventing a value', () => {
    const bits = new Map<number, LogicValue | undefined>([
      [3, 1],
      [2, 'X'],
      [1, 0],
    ]);
    const word = readBusWord(decl, bits);
    expect(word.value).toBeNull();
    expect(word.hasUnknown).toBe(true);
    expect(word.binary).toBe('1X0X');
  });

  it('rejects words that do not fit the width', () => {
    expect(() => busWordToBits(decl, 16)).toThrow(BusRangeError);
    expect(() => busWordToBits(decl, -1)).toThrow(BusRangeError);
  });
});

describe('connectBuses', () => {
  const build = () => {
    let circuit = emptyCircuit();
    const a = createBusBoundary(circuit, { name: 'A', direction: 'input', left: 3, right: 0 });
    circuit = a.circuit;
    const y = createBusBoundary(circuit, { name: 'Y', direction: 'output', left: 3, right: 0 });
    circuit = y.circuit;
    return { circuit, a: a.bus, y: y.bus };
  };

  it('connects equal-width buses bit-for-bit and is idempotent', () => {
    const { circuit, a, y } = build();
    const connected = connectBuses(circuit, a.id, y.id);
    expect(connected.connections).toHaveLength(4);
    const again = connectBuses(connected, a.id, y.id);
    expect(again.connections).toHaveLength(4);
    const msbSource = busBitPortRef(a, 3)!;
    const msbTarget = busBitPortRef(y, 3)!;
    expect(
      connected.connections.some(
        (connection) =>
          typeof connection.from !== 'string' &&
          typeof connection.to !== 'string' &&
          connection.from.nodeId === msbSource.nodeId &&
          connection.to.nodeId === msbTarget.nodeId
      )
    ).toBe(true);
  });

  it('rejects width mismatches with both widths named', () => {
    let circuit = emptyCircuit();
    const a = createBusBoundary(circuit, { name: 'A', direction: 'input', left: 3, right: 0 });
    circuit = a.circuit;
    const y = createBusBoundary(circuit, { name: 'Y', direction: 'output', left: 1, right: 0 });
    circuit = y.circuit;
    try {
      connectBuses(circuit, a.bus.id, y.bus.id);
      expect.unreachable('expected width mismatch');
    } catch (error) {
      expect(error).toBeInstanceOf(BusWidthMismatchError);
      expect((error as BusWidthMismatchError).fromWidth).toBe(4);
      expect((error as BusWidthMismatchError).toWidth).toBe(2);
      expect((error as Error).message).toContain('A[3:0]');
      expect((error as Error).message).toContain('Y[1:0]');
    }
  });
});

describe('renameBus', () => {
  it('renames the declaration and every member label, preserving suffixes', () => {
    let { circuit, bus } = createBusBoundary(emptyCircuit(), {
      name: 'A',
      direction: 'input',
      left: 1,
      right: 0,
    });
    circuit = {
      ...circuit,
      nodes: circuit.nodes.map((node) =>
        node.label === 'A[0]' ? { ...node, label: 'A[0] (SW0)' } : node
      ),
    };
    const renamed = renameBus(circuit, bus.id, 'DATA');
    expect(renamed.buses?.[0].name).toBe('DATA');
    const labels = renamed.nodes.map((node) => node.label).sort();
    expect(labels).toEqual(['DATA[0] (SW0)', 'DATA[1]']);
    expect(validateBusDeclarations(renamed)).toEqual([]);
  });

  it('rejects renames that collide or are not identifiers', () => {
    let circuit = emptyCircuit();
    const a = createBusBoundary(circuit, { name: 'A', direction: 'input', left: 1, right: 0 });
    circuit = a.circuit;
    const b = createBusBoundary(circuit, { name: 'B', direction: 'input', left: 1, right: 0 });
    circuit = b.circuit;
    expect(() => renameBus(circuit, a.bus.id, 'B')).toThrow(BusValidationError);
    expect(() => renameBus(circuit, a.bus.id, 'not valid')).toThrow(BusValidationError);
  });
});

describe('deleteBus', () => {
  it('demotes members to scalars by default and can delete members', () => {
    const { circuit, bus } = createBusBoundary(emptyCircuit(), {
      name: 'A',
      direction: 'input',
      left: 1,
      right: 0,
    });
    const demoted = deleteBus(circuit, bus.id);
    expect(demoted.buses).toBeUndefined();
    expect(demoted.nodes).toHaveLength(2);

    const removed = deleteBus(circuit, bus.id, { deleteMembers: true });
    expect(removed.nodes).toHaveLength(0);
  });
});

describe('validateBusDeclarations', () => {
  it('flags missing members, bad types, drifted labels, and double claims', () => {
    const { circuit, bus } = createBusBoundary(emptyCircuit(), {
      name: 'A',
      direction: 'input',
      left: 2,
      right: 0,
    });
    const memberIds = bus.bits.map((bit) => bit.nodeId);
    const broken: Circuit = {
      ...circuit,
      nodes: circuit.nodes
        .filter((node) => node.id !== memberIds[0])
        .map((node) =>
          node.id === memberIds[1]
            ? { ...node, label: 'STALE[9]' }
            : node.id === memberIds[2]
              ? { ...node, type: 'Lamp' }
              : node
        ),
    };
    const codes = validateBusDeclarations(broken).map((diagnostic) => diagnostic.code);
    expect(codes).toContain('BUS002');
    expect(codes).toContain('BUS003');
    expect(codes).toContain('BUS004');

    const doubleClaim: Circuit = {
      ...circuit,
      buses: [
        bus,
        { id: 'bus-in-B', name: 'B', direction: 'input', left: 0, right: 0, bits: [{ index: 0, nodeId: memberIds[0] }] },
      ],
    };
    expect(validateBusDeclarations(doubleClaim).map((d) => d.code)).toContain('BUS005');
  });
});

describe('synthesizeBusDeclarations (legacy migration)', () => {
  it('promotes contiguous Base[N] groups and leaves scalars and sparse groups alone', () => {
    const migrated = synthesizeBusDeclarations(legacyRipple());
    const buses = migrated.buses ?? [];
    expect(buses.map((bus) => busRangeLabel(bus))).toEqual(['A[3:0]', 'SUM[1:0]']);
    const a = buses.find((bus) => bus.name === 'A')!;
    expect(a.direction).toBe('input');
    expect(a.bits.map((bit) => bit.nodeId)).toEqual(['a0', 'a1', 'a2', 'a3']);
    expect(validateBusDeclarations(migrated)).toEqual([]);
    // CARRY stays scalar; nothing invents a width-1 bus for it.
    expect(buses.some((bus) => bus.name === 'CARRY')).toBe(false);
  });

  it('skips non-contiguous groups and is idempotent and deterministic', () => {
    const sparse: Circuit = {
      nodes: [
        { id: 'd0', type: 'Switch', label: 'D[0]' },
        { id: 'd2', type: 'Switch', label: 'D[2]' },
      ],
      connections: [],
    };
    expect(synthesizeBusDeclarations(sparse).buses).toBeUndefined();

    const once = synthesizeBusDeclarations(legacyRipple());
    const twice = synthesizeBusDeclarations(once);
    expect(twice).toEqual(once);
  });

  it('never claims nodes already owned by a declared bus', () => {
    const migrated = synthesizeBusDeclarations(legacyRipple());
    const renamedDecl: Circuit = {
      ...migrated,
      buses: migrated.buses!.map((bus) =>
        bus.name === 'A' ? { ...bus, name: 'ADDEND' } : bus
      ),
    };
    const again = synthesizeBusDeclarations(renamedDecl);
    // The A[N]-labeled nodes are claimed by the renamed declaration; no new bus appears.
    expect(again.buses).toHaveLength(2);
  });
});

describe('normalizeBusDeclarations', () => {
  it('parses well-formed entries and drops garbage without throwing', () => {
    const parsed = normalizeBusDeclarations([
      {
        id: 'bus-in-A',
        name: 'A',
        direction: 'input',
        left: 3,
        right: 0,
        bits: [
          { index: 1, nodeId: 'a1' },
          { index: 0, nodeId: 'a0' },
          { index: 'bad', nodeId: 'x' },
        ],
      },
      { id: 'bus-in-A', name: 'A', direction: 'input', left: 1, right: 0, bits: [] },
      { id: 'nope', name: '9bad', direction: 'input', left: 1, right: 0, bits: [] },
      { id: 'nope2', name: 'B', direction: 'sideways', left: 1, right: 0, bits: [] },
      'not-an-object',
      null,
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].bits.map((bit) => bit.index)).toEqual([0, 1]);
    expect(normalizeBusDeclarations(undefined)).toEqual([]);
    expect(normalizeBusDeclarations('junk')).toEqual([]);
  });
});

describe('busMemberNodeIds', () => {
  it('reports the claimed scalar substrate', () => {
    const migrated = synthesizeBusDeclarations(legacyRipple());
    const claimed = busMemberNodeIds(migrated);
    expect(claimed.has('a0')).toBe(true);
    expect(claimed.has('carry')).toBe(false);
  });
});
