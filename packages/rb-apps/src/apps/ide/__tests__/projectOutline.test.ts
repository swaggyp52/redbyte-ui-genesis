// Copyright (c) 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit, CompositeNodeDef } from '@redbyte/rb-logic-core';
import type { MacroDefinition } from '../macros/MacroLibrary';
import type { ProjectIoRow } from '../projectRuntime';
import { deriveProjectOutlineSummary } from '../projectOutline';

function makeCircuit(types: string[]): Circuit {
  return {
    nodes: types.map((type, i) => ({ id: `n${i}`, type })),
    connections: [],
  };
}

function makeMacro(
  id: string,
  name: string,
  inputs: number,
  outputs: number,
  description?: string,
): MacroDefinition {
  return {
    id,
    name,
    description,
    inputs: Array.from({ length: inputs }, (_, i) => ({ id: `in${i}`, label: `in${i}`, width: 1 } as any)),
    outputs: Array.from({ length: outputs }, (_, i) => ({ id: `out${i}`, label: `out${i}`, width: 1 } as any)),
    cluster: { nodes: [], connections: [] } as any,
    createdAt: 0,
  };
}

function makeComponent(name: string, ins: number, outs: number): CompositeNodeDef {
  const inputMapping: Record<string, string> = {};
  const outputMapping: Record<string, string> = {};
  for (let i = 0; i < ins; i++) inputMapping[`in${i}`] = `node.in${i}`;
  for (let i = 0; i < outs; i++) outputMapping[`out${i}`] = `node.out${i}`;
  return {
    name,
    description: `desc-${name}`,
    subcircuit: { nodes: [], connections: [] },
    inputMapping,
    outputMapping,
  };
}

function makeIo(id: string, direction: 'in' | 'out', pin = '', required = false): ProjectIoRow {
  return {
    id,
    nodeId: id,
    port: 'q',
    label: `label-${id}`,
    direction,
    pin,
    required,
  } as ProjectIoRow;
}

describe('deriveProjectOutlineSummary', () => {
  it('counts nodes, connections, and boundary inputs/outputs', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT' },
        { id: 'b', type: 'INPUT' },
        { id: 'c', type: 'AND' },
        { id: 'd', type: 'OUTPUT' },
      ],
      connections: [
        { id: 'c1', from: { nodeId: 'a', port: 'q' }, to: { nodeId: 'c', port: 'a' } } as any,
        { id: 'c2', from: { nodeId: 'b', port: 'q' }, to: { nodeId: 'c', port: 'b' } } as any,
        { id: 'c3', from: { nodeId: 'c', port: 'q' }, to: { nodeId: 'd', port: 'd' } } as any,
      ],
    };

    const outline = deriveProjectOutlineSummary({
      circuit,
      macros: [],
      customComponents: [],
      ioRows: [],
    });

    expect(outline.nodeCount).toBe(4);
    expect(outline.connectionCount).toBe(3);
    expect(outline.boundaryInputCount).toBe(2);
    expect(outline.boundaryOutputCount).toBe(1);
  });

  it('sorts node type breakdown by count desc then name asc', () => {
    const circuit = makeCircuit(['AND', 'AND', 'AND', 'OR', 'OR', 'NOT', 'INPUT']);
    const outline = deriveProjectOutlineSummary({
      circuit,
      macros: [],
      customComponents: [],
      ioRows: [],
    });

    expect(outline.nodeTypeBreakdown).toEqual([
      { type: 'AND', count: 3 },
      { type: 'OR', count: 2 },
      { type: 'INPUT', count: 1 },
      { type: 'NOT', count: 1 },
    ]);
  });

  it('maps macros with IO summary and trims description', () => {
    const outline = deriveProjectOutlineSummary({
      circuit: makeCircuit([]),
      macros: [
        makeMacro('m1', 'Adder', 2, 1, '  Full adder  '),
        makeMacro('m2', 'Decoder', 3, 8),
      ],
      customComponents: [],
      ioRows: [],
    });

    expect(outline.macros).toEqual([
      { id: 'm1', name: 'Adder', description: 'Full adder', ioSummary: '2 in · 1 out' },
      { id: 'm2', name: 'Decoder', description: '', ioSummary: '3 in · 8 out' },
    ]);
  });

  it('maps custom components using mapping cardinality', () => {
    const outline = deriveProjectOutlineSummary({
      circuit: makeCircuit([]),
      macros: [],
      customComponents: [makeComponent('ALU4', 4, 2), makeComponent('REG8', 1, 1)],
      ioRows: [],
    });

    expect(outline.customComponents).toEqual([
      { name: 'ALU4', description: 'desc-ALU4', ioSummary: '4 in · 2 out' },
      { name: 'REG8', description: 'desc-REG8', ioSummary: '1 in · 1 out' },
    ]);
  });

  it('splits IO rows by direction and reports mapped pins honestly', () => {
    const outline = deriveProjectOutlineSummary({
      circuit: makeCircuit([]),
      macros: [],
      customComponents: [],
      ioRows: [
        makeIo('a', 'in', 'SW0', true),
        makeIo('b', 'in', '', true),
        makeIo('c', 'in', '   '),
        makeIo('y', 'out', 'LD0'),
        makeIo('z', 'out', ''),
      ],
    });

    expect(outline.inputIoRows).toEqual([
      { id: 'a', label: 'label-a', pin: 'SW0', required: true },
      { id: 'b', label: 'label-b', pin: null, required: true },
      { id: 'c', label: 'label-c', pin: null, required: false },
    ]);
    expect(outline.outputIoRows).toEqual([
      { id: 'y', label: 'label-y', pin: 'LD0', required: false },
      { id: 'z', label: 'label-z', pin: null, required: false },
    ]);
  });

  it('handles empty project gracefully', () => {
    const outline = deriveProjectOutlineSummary({
      circuit: { nodes: [], connections: [] },
      macros: [],
      customComponents: [],
      ioRows: [],
    });

    expect(outline).toEqual({
      nodeCount: 0,
      connectionCount: 0,
      boundaryInputCount: 0,
      boundaryOutputCount: 0,
      nodeTypeBreakdown: [],
      macros: [],
      customComponents: [],
      inputIoRows: [],
      outputIoRows: [],
    });
  });
});
