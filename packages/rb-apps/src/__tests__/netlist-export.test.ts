// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { netlistFromCircuit } from '../export/netlistExport';

describe('netlist export', () => {
  it('exports deterministic nodes and nets', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'lamp', type: 'Lamp', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        {
          id: 'switch',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
      ],
      connections: [
        { from: { nodeId: 'switch', portName: 'out' }, to: { nodeId: 'lamp', portName: 'in' } },
      ],
    };

    const netlist = netlistFromCircuit(circuit);
    expect(netlist.nodes).toHaveLength(2);
    expect(netlist.nets).toHaveLength(1);
    expect(netlist.nodes[0].id).toBe('lamp');
    expect(netlist.nodes[1].id).toBe('switch');
    expect(netlist.nets[0].from.nodeId).toBe('switch');
    expect(netlist.nets[0].to.nodeId).toBe('lamp');
  });

  it('produces stable digests across reorderings', () => {
    const circuitA: Circuit = {
      nodes: [
        {
          id: 'b',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
        { id: 'a', type: 'Lamp', position: { x: 0, y: 0 }, rotation: 0, config: {} },
      ],
      connections: [
        { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'a', portName: 'in' } },
      ],
    };

    const circuitB: Circuit = {
      nodes: [
        { id: 'a', type: 'Lamp', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        {
          id: 'b',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
      ],
      connections: [
        { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'a', portName: 'in' } },
      ],
    };

    const netlistA = netlistFromCircuit(circuitA);
    const netlistB = netlistFromCircuit(circuitB);
    expect(netlistA.circuitDigest).toBe(netlistB.circuitDigest);
  });
});
