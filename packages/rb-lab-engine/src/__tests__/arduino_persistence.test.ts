import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { labReducer } from '../reducer/labReducer';
import { LabProjectV1, LabActionV1 } from '@redbyte/rb-utils';

// Minimal mock state
const mockProject: LabProjectV1 = {
    schemaVersion: '1.0',
    projectId: 'test-proj-1',
    name: 'Test Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    circuit: {
        schemaVersion: '1.0',
        nodes: [],
        connections: [],
    },
    simulation: {
        tickRate: 1,
        currentTick: 0,
        probes: [],
    },
    evidence: {
        actions: [],
        snapshots: [],
    },
};

describe('Sprint 2B: Arduino Instrument Persistence', () => {

    it('should persist Basys3 state when switching to Arduino and back', () => {
        let state = mockProject;

        // 1. Initialize Basys3 and map a signal
        state = labReducer(state, { v: 1, t: 'board/setProfile', p: { profileId: 'basys3' } });
        state = labReducer(state, { v: 1, t: 'board/mapSignal', p: { signal: 'output1', pin: 'LD0' } });

        expect(state.boardMap?.boardProfileId).toBe('basys3');
        expect(state.boardMap?.signalToPinMap['output1']).toBe('LD0');

        // 2. Switch to Arduino
        state = labReducer(state, { v: 1, t: 'board/setProfile', p: { profileId: 'arduino' } });

        expect(state.boardMap?.boardProfileId).toBe('arduino');
        // Basys3 mapping should be gone from active map
        expect(state.boardMap?.signalToPinMap['output1']).toBeUndefined();
        // But saved in persistence
        expect(state.savedBoards?.['basys3'].signalToPinMap['output1']).toBe('LD0');

        // 3. Map something on Arduino
        state = labReducer(state, { v: 1, t: 'board/mapSignal', p: { signal: 'sensor1', pin: 'A0' } });
        expect(state.boardMap?.signalToPinMap['sensor1']).toBe('A0');

        // 4. Switch back to Basys3
        state = labReducer(state, { v: 1, t: 'board/setProfile', p: { profileId: 'basys3' } });

        // Verify Basys3 mapping restored
        expect(state.boardMap?.boardProfileId).toBe('basys3');
        expect(state.boardMap?.signalToPinMap['output1']).toBe('LD0');
        expect(state.boardMap?.signalToPinMap['sensor1']).toBeUndefined();

        // Verify Arduino config persisted
        expect(state.savedBoards?.['arduino'].signalToPinMap['sensor1']).toBe('A0');
    });

    it('should record snapshots correctly with evidence/addSnapshot', () => {
        let state = mockProject;

        const snapshot = {
            timestamp: new Date().toISOString(),
            probes: {},
            tick: 100,
            probeValues: {},
            circuitHash: 'abc',
            projectHash: '123',
            boardState: { leds: [], switches: [] }
        };

        state = labReducer(state, { v: 1, t: 'evidence/addSnapshot', p: snapshot });

        expect(state.evidence.snapshots).toHaveLength(1);
        expect(state.evidence.snapshots[0].projectHash).toBe('123');
    });

});
