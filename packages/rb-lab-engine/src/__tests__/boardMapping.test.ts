
import { describe, it, expect } from 'vitest';
import { labReducer } from '../reducer/labReducer';
import { getSignalValue, getAvailableSignals } from '../signals/signalSemantics';
import type { LabActionV1, LabProject } from '@redbyte/rb-utils';

// Mock initial state
const initialProject: LabProject = {
    schemaVersion: '1.0',
    projectId: 'test-project',
    name: 'Test Project',
    description: 'Test',
    createdAt: '2026-02-02T10:00:00.000Z',
    updatedAt: '2026-02-02T10:00:00.000Z',
    circuit: {
        schemaVersion: '1.0',
        nodes: [
            { id: 'sw1', type: 'SWITCH', x: 0, y: 0, state: { output: 1 }, label: 'INPUT_A' },
            { id: 'gate1', type: 'AND', x: 100, y: 0, state: { output: 0 }, label: 'LOGIC' },
            { id: 'led1', type: 'LED', x: 200, y: 0, state: {}, label: 'OUTPUT_Z' }
        ],
        connections: []
    },
    simulation: {
        tickRate: 20,
        currentTick: 0,
        probes: [],
        breakpoints: []
    },
    boardMap: {
        boardProfileId: 'basys3',
        signalToPinMap: {},
        virtualIOState: { switches: [], buttons: [] }
    },
    labSpec: {
        schemaVersion: '1.0',
        id: 'test',
        title: 'Test Lab',
        objectives: [],
        checkpoints: []
    },
    evidence: { actions: [], snapshots: [] }
};

describe('Board Mapping Logic', () => {
    it('should persist signal mapping via reducer', () => {
        const action: LabActionV1 = {
            v: 1,
            t: 'board/mapSignal',
            p: { signal: 'INPUT_A', pin: 'SW0' }
        };

        const newState = labReducer(initialProject, action);

        expect(newState.boardMap?.signalToPinMap['INPUT_A']).toBe('SW0');
    });

    it('should extract correct signal values', () => {
        // Known High
        expect(getSignalValue(initialProject, 'INPUT_A')).toBe(true);
        // Known Low
        expect(getSignalValue(initialProject, 'LOGIC')).toBe(false);
        // Unknown (LED has no state)
        expect(getSignalValue(initialProject, 'OUTPUT_Z')).toBe(undefined);
        // Non-existent
        expect(getSignalValue(initialProject, 'INVALID')).toBe(undefined);
    });

    it('should classify signals correctly', () => {
        const { inputs, outputs } = getAvailableSignals(initialProject);

        // INPUT_A is SWITCH -> Input Capable
        expect(inputs.some(i => i.label === 'INPUT_A')).toBe(true);
        // GATE is AND -> Not Input Capable
        expect(inputs.some(i => i.label === 'LOGIC')).toBe(false);

        // All are Output Capable
        expect(outputs.some(o => o.label === 'INPUT_A')).toBe(true);
        expect(outputs.some(o => o.label === 'LOGIC')).toBe(true);
    });
});
