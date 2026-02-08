import { describe, it, expect } from 'vitest';
import { buildNetHistory, computeNetlist, sampleNetValue } from '../netlist';
const graph = {
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
        }
    ],
    net: {}
};
describe('net sampling', () => {
    it('builds deterministic net history from pin diffs', () => {
        const netlist = computeNetlist(graph);
        const netId = netlist.pinToNetId['nano-1:D13'];
        expect(netId).toBeDefined();
        const timeline = {
            events: [
                { type: 'SIM_PIN_DIFF', tick: 1, seq: 0, source: 'engine', pinDiffs: { 'nano-1:D13': 1 } },
                { type: 'SIM_PIN_DIFF', tick: 3, seq: 1, source: 'engine', pinDiffs: { 'nano-1:D13': 0 } }
            ],
            snapshots: []
        };
        const history = buildNetHistory(timeline, netlist);
        expect(history[netId]).toEqual([
            { tick: 1, value: 1 },
            { tick: 3, value: 0 }
        ]);
        const pinStates = { 'nano-1:D13': 0 };
        expect(sampleNetValue(netId, netlist, pinStates)).toBe(0);
    });
});
