// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
import { tickFromPosition, positionFromTick, normalizeStimulusEvents, buildMismatchReport, digestCircuit, digestStimulus, } from '../recording/runRecordUtils';
import { indexStimulusByTick } from '../recording/runRecord';
describe('run record utils', () => {
    it('maps timeline position to ticks deterministically', () => {
        expect(tickFromPosition(0, 100, 50)).toBe(0);
        expect(tickFromPosition(50, 100, 50)).toBe(25);
        expect(tickFromPosition(100, 100, 50)).toBe(50);
    });
    it('maps ticks to timeline position deterministically', () => {
        expect(positionFromTick(0, 200, 100)).toBe(0);
        expect(positionFromTick(50, 200, 100)).toBe(100);
        expect(positionFromTick(100, 200, 100)).toBe(200);
    });
    it('normalizes stimulus events with stable sorting', () => {
        const events = [
            { tick: 5, type: 'input_toggled', nodeId: 'a', portName: 'out', value: 1 },
            { tick: 2, type: 'input_toggled', nodeId: 'b', portName: 'out', value: 0 },
            { tick: 5, type: 'input_toggled', nodeId: 'c', portName: 'out', value: 1 },
        ];
        const normalized = normalizeStimulusEvents(events);
        expect(normalized[0].nodeId).toBe('b');
        expect(normalized[1].nodeId).toBe('a');
        expect(normalized[2].nodeId).toBe('c');
    });
    it('updates indexed schedule after event edits', () => {
        const events = [
            { tick: 2, type: 'input_toggled', nodeId: 'a', portName: 'out', value: 1 },
            { tick: 4, type: 'input_toggled', nodeId: 'b', portName: 'out', value: 0 },
        ];
        const edited = [...events];
        edited[0] = { ...edited[0], tick: 6 };
        const normalized = normalizeStimulusEvents(edited);
        const byTick = indexStimulusByTick(normalized);
        expect(byTick.get(4)?.[0].nodeId).toBe('b');
        expect(byTick.get(6)?.[0].nodeId).toBe('a');
    });
    it('builds mismatch report with expected/actual diff', () => {
        const expected = [
            { tick: 1, values: { p1: 1, p2: 0 } },
            { tick: 2, values: { p1: 1, p2: 1 } },
        ];
        const actual = [
            { tick: 1, values: { p1: 1, p2: 0 } },
            { tick: 2, values: { p1: 0, p2: 1 } },
        ];
        const stimulus = [
            { tick: 1, type: 'input_toggled', nodeId: 'sw1', portName: 'out', value: 1 },
            { tick: 2, type: 'input_toggled', nodeId: 'sw2', portName: 'out', value: 0 },
        ];
        const report = buildMismatchReport(expected, actual, stimulus, 1);
        expect(report?.tick).toBe(2);
        expect(report?.probeIds).toContain('p1');
        expect(report?.expected.p1).toBe(1);
        expect(report?.actual.p1).toBe(0);
        expect(report?.recentStimulus).toHaveLength(1);
    });
    it('produces stable circuit digests across reorderings', () => {
        const circuitA = {
            nodes: [
                { id: 'b', type: 'Switch', position: { x: 0, y: 0 }, state: { isOn: 0 } },
                { id: 'a', type: 'Lamp', position: { x: 0, y: 0 } },
            ],
            connections: [
                { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'a', portName: 'in' } },
            ],
        };
        const circuitB = {
            nodes: [
                { id: 'a', type: 'Lamp', position: { x: 0, y: 0 } },
                { id: 'b', type: 'Switch', position: { x: 0, y: 0 }, state: { isOn: 0 } },
            ],
            connections: [
                { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'a', portName: 'in' } },
            ],
        };
        expect(digestCircuit(circuitA)).toBe(digestCircuit(circuitB));
    });
    it('produces stable stimulus digests across reorderings', () => {
        const events = [
            { tick: 2, type: 'input_toggled', nodeId: 'a', portName: 'out', value: 1 },
            { tick: 1, type: 'input_toggled', nodeId: 'b', portName: 'out', value: 0 },
        ];
        const digestA = digestStimulus(events);
        const digestB = digestStimulus([...events].reverse());
        expect(digestA).toBe(digestB);
    });
});
