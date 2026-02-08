import { describe, expect, it } from 'vitest';
import { computeWireNetIds } from '../tools/netHighlight';
describe('Net highlight resolution gate', () => {
    it('assigns the same netId to all wires connected through a shared port (fanout)', () => {
        const connections = [
            { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
            { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'or1', portName: 'a' } },
            { from: { nodeId: 'clk1', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
        ];
        const map = computeWireNetIds(connections);
        const netA = map.get('sw1.out-and1.a');
        const netB = map.get('sw1.out-or1.a');
        const netC = map.get('clk1.out-and1.b');
        expect(netA).toBeTruthy();
        expect(netB).toBeTruthy();
        expect(netC).toBeTruthy();
        expect(netA).toBe(netB);
        expect(netA).not.toBe(netC);
    });
    it('is deterministic across equivalent connection ordering', () => {
        const a = [
            { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'b', portName: 'in' } },
            { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'c', portName: 'in' } },
        ];
        const b = [...a].reverse();
        const mapA = computeWireNetIds(a);
        const mapB = computeWireNetIds(b);
        expect(mapA.get('a.out-b.in')).toBe(mapB.get('a.out-b.in'));
        expect(mapA.get('b.out-c.in')).toBe(mapB.get('b.out-c.in'));
    });
});
