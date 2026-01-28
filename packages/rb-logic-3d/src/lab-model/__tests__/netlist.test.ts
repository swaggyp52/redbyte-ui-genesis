import { describe, it, expect } from 'vitest';
import { computeNetlist } from '../netlist';
import type { LabGraph } from '../types';

const baseGraph = (): LabGraph => ({
  nodes: [
    {
      id: 'nano-1',
      type: 'arduino-nano',
      pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      properties: {}
    },
    {
      id: 'led-1',
      type: 'led-5mm',
      pose: { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      properties: {}
    }
  ],
  wires: [
    {
      id: 'w1',
      sourceNodeId: 'nano-1',
      sourcePinId: 'D13',
      targetNodeId: 'led-1',
      targetPinId: 'anode',
      color: 'green'
    },
    {
      id: 'w2',
      sourceNodeId: 'nano-1',
      sourcePinId: 'GND',
      targetNodeId: 'led-1',
      targetPinId: 'cathode',
      color: 'green'
    }
  ],
  net: {}
});

describe('computeNetlist', () => {
  it('produces stable net ids regardless of wire order', () => {
    const graphA = baseGraph();
    const graphB: LabGraph = { ...graphA, wires: [...graphA.wires].reverse() };

    const netlistA = computeNetlist(graphA);
    const netlistB = computeNetlist(graphB);

    const netA = netlistA.pinToNetId['nano-1:D13'];
    const netB = netlistB.pinToNetId['nano-1:D13'];

    expect(netA).toBeDefined();
    expect(netA).toEqual(netB);
    expect(netlistA.pinToNetId['nano-1:GND']).toEqual(netlistB.pinToNetId['nano-1:GND']);
  });

  it('groups breadboard rows on the same side when active', () => {
    const graph: LabGraph = {
      nodes: [
        {
          id: 'nano-1',
          type: 'arduino-nano',
          pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
          properties: {}
        },
        {
          id: 'bb-1',
          type: 'breadboard-half',
          pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
          properties: {}
        }
      ],
      wires: [
        {
          id: 'w1',
          sourceNodeId: 'nano-1',
          sourcePinId: 'D13',
          targetNodeId: 'bb-1',
          targetPinId: 'A1',
          color: 'green'
        }
      ],
      net: {}
    };

    const netlist = computeNetlist(graph);
    const netA1 = netlist.pinToNetId['bb-1:A1'];
    const netB1 = netlist.pinToNetId['bb-1:B1'];
    const netF1 = netlist.pinToNetId['bb-1:F1'];

    expect(netA1).toBeDefined();
    expect(netB1).toBeDefined();
    expect(netA1).toEqual(netB1);
    expect(netF1 === undefined || netF1 !== netA1).toBe(true);
  });
});
