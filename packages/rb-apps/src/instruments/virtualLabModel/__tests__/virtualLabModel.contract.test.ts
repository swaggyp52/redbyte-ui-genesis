import { describe, expect, it } from 'vitest';
import { buildNetHistory, computeNetlist, sampleNetValue } from '../netlist';
import { PART_DEFINITIONS } from '../parts';
import type { LabEvent, LabGraph, LabNode, LabTimeline, LabWire } from '../types';

const node = (id: string, type: string): LabNode => ({
  id, type, properties: { label: id },
  pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
});
const wire = (id: string, sourceNodeId: string, sourcePinId: string, targetNodeId: string, targetPinId: string): LabWire => ({
  id, sourceNodeId, sourcePinId, targetNodeId, targetPinId, color: '#00ff00',
});
const freeze = (value: unknown): void => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
};

describe('retained virtual-instrument physical net contract', () => {
  it('keeps historical net IDs, pin sorting, and numeric source precedence without mutating input', () => {
    const graph: LabGraph = {
      nodes: [node('nano-1', 'arduino-nano'), node('led-1', 'led-5mm')],
      wires: [wire('w1', 'nano-1', 'D13', 'led-1', 'anode')], net: {},
    };
    const serialized = JSON.stringify(graph);
    freeze(graph);
    const netlist = computeNetlist(graph);
    const netId = netlist.pinToNetId['nano-1:D13'];
    expect(netId).toBe('net_2518fcb5');
    expect(netlist.nets.find((net) => net.id === netId)?.pins).toEqual([
      { nodeId: 'led-1', pinId: 'anode' }, { nodeId: 'nano-1', pinId: 'D13' },
    ]);
    expect(sampleNetValue(netId, netlist, { 'nano-1:D13': 2.5 })).toBe(2.5);
    expect(sampleNetValue(netId, netlist, { 'led-1:anode': 0, 'nano-1:D13': 2.5 })).toBe(0);
    expect(sampleNetValue('unknown', netlist, {})).toBe(0);
    expect(computeNetlist({ ...graph, nodes: [...graph.nodes].reverse(), wires: [...graph.wires].reverse() })).toEqual(netlist);
    expect(JSON.stringify(graph)).toBe(serialized);
  });

  it('connects each active breadboard row side and full rail separately while rejecting nonexistent pins', () => {
    const graph: LabGraph = {
      nodes: [node('nano', 'arduino-nano'), node('bb', 'breadboard-half'), node('unknown', 'unregistered-part')],
      wires: [
        wire('row-left', 'nano', 'D13', 'bb', 'A1'),
        wire('row-right', 'nano', 'D2', 'bb', 'F1'),
        wire('power', 'nano', '5V', 'bb', 'RAIL_TOP_1'),
        wire('ground', 'nano', 'GND', 'bb', 'RAIL_BOTTOM_30'),
        wire('invalid', 'nano', 'DOES_NOT_EXIST', 'bb', 'A1'),
        wire('missing-node', 'absent', 'D13', 'nano', 'D13'),
        wire('unknown-part', 'unknown', 'D13', 'nano', 'D13'),
      ], net: {},
    };
    const before = JSON.stringify(graph);
    const catalogBefore = JSON.stringify(PART_DEFINITIONS);
    freeze(graph);
    const { pinToNetId, nets } = computeNetlist(graph);
    for (const row of ['A', 'B', 'C', 'D', 'E']) expect(pinToNetId[`bb:${row}1`]).toBe(pinToNetId['nano:D13']);
    for (const row of ['F', 'G', 'H', 'I', 'J']) expect(pinToNetId[`bb:${row}1`]).toBe(pinToNetId['nano:D2']);
    expect(pinToNetId['bb:A1']).not.toBe(pinToNetId['bb:F1']);
    expect(pinToNetId['bb:A2']).toBeUndefined();
    for (let col = 1; col <= 30; col += 1) {
      expect(pinToNetId[`bb:RAIL_TOP_${col}`]).toBe(pinToNetId['nano:5V']);
      expect(pinToNetId[`bb:RAIL_BOTTOM_${col}`]).toBe(pinToNetId['nano:GND']);
    }
    expect(pinToNetId['nano:5V']).not.toBe(pinToNetId['nano:GND']);
    expect(pinToNetId['nano:DOES_NOT_EXIST']).toBeUndefined();
    expect(pinToNetId['absent:D13']).toBeUndefined();
    expect(pinToNetId['unknown:D13']).toBeUndefined();
    for (const net of nets) for (const pin of net.pins) {
      const part = graph.nodes.find((entry) => entry.id === pin.nodeId);
      expect(part && PART_DEFINITIONS[part.type]?.pins.some((entry) => entry.id === pin.pinId)).toBe(true);
    }
    expect(JSON.stringify(graph)).toBe(before);
    expect(JSON.stringify(PART_DEFINITIONS)).toBe(catalogBefore);
  });

  it('preserves sequence ordering, touched-net transitions, non-pin-event filtering, and the 2000-transition cap', () => {
    const graph: LabGraph = { nodes: [node('nano', 'arduino-nano')], wires: [], net: {} };
    const netlist = computeNetlist(graph);
    const netId = netlist.pinToNetId['nano:D13'];
    const timeline: LabTimeline = {
      events: [
        { type: 'SIM_PIN_DIFF', tick: 3, seq: 3, source: 'engine', pinDiffs: { 'nano:D13': 0 } },
        { type: 'SERIAL_OUTPUT', tick: 1, seq: 1, source: 'engine', text: 'not a signal' },
        { type: 'SIM_PIN_DIFF', tick: 2, seq: 2, source: 'engine', pinDiffs: { 'nano:D13': 2.5, 'absent:D13': 99 } },
        { type: 'SIM_PIN_DIFF', tick: 0, seq: 0, source: 'engine', pinDiffs: { 'nano:D13': 0 } },
        { type: 'SIM_PIN_DIFF', tick: 4, seq: 4, source: 'engine', pinDiffs: { 'nano:D13': 0 } },
      ], snapshots: [],
    };
    const before = JSON.stringify(timeline);
    freeze(timeline);
    const history = buildNetHistory(timeline, netlist);
    expect(history[netId]).toEqual([{ tick: 2, value: 2.5 }, { tick: 3, value: 0 }]);
    expect(history[netlist.pinToNetId['nano:GND']]).toEqual([]);
    expect(JSON.stringify(timeline)).toBe(before);

    const longTimeline: LabTimeline = {
      events: Array.from({ length: 2105 }, (_, seq): LabEvent => ({
        type: 'SIM_PIN_DIFF', tick: seq + 1, seq, source: 'engine', pinDiffs: { 'nano:D13': (seq + 1) % 2 },
      })), snapshots: [],
    };
    const capped = buildNetHistory(longTimeline, netlist)[netId];
    expect(capped).toHaveLength(2000);
    expect(capped[0]).toEqual({ tick: 106, value: 0 });
    expect(capped[1999]).toEqual({ tick: 2105, value: 1 });
  });
});
