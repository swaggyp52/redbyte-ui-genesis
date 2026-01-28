
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLabStore } from '../store';
import { produce } from 'immer';
import { LabGraph, LabNode } from '../types';

// Helper to run store actions in acts (though simple updates usually fine)
const actFn = (fn: () => void) => fn();

describe('Phase 4: FPGA Design Loader & Determinism', () => {
    beforeEach(() => {
        useLabStore.getState().reset();
    });

    it('Scenario: Load Preset, Simulate, Replay', async () => {
        const store = useLabStore.getState();

        // 1. Place FPGA
        const fpgaNode: LabNode = {
            id: 'fpga-1',
            type: 'fpga-basys3',
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            properties: {}
        };

        actFn(() => store.addNode(fpgaNode));

        // 2. Load Preset 'basys3-blink'
        actFn(() => store.loadFpgaPreset('fpga-1', 'basys3-blink'));

        // Verify state immediately
        let state = useLabStore.getState();
        expect(state.simulation.partStates['fpga-1'].preset).toBe('basys3-blink');
        expect(state.timeline.events.some(e => e.type === 'FPGA_LOAD_PRESET')).toBe(true);

        // 3. Run Simulation (should generate deterministic updates)
        actFn(() => store.runSimulationStep());
        actFn(() => store.runSimulationStep());
        actFn(() => store.runSimulationStep());

        state = useLabStore.getState();
        const tick3State = state.simulation.partStates['fpga-1'];
        expect(tick3State).toBeDefined();

        // 4. Export Capsule
        const freshState = useLabStore.getState();
        const capsule = {
            meta: {
                capsuleVersion: 'labcapsule.v1',
                createdAt: new Date().toISOString()
            },
            graph: freshState.graph,
            history: freshState.timeline,
            artifacts: {}
        };
        expect(capsule).toBeDefined();

        // 5. Replay
        actFn(() => store.reset());

        // Import logic
        const lastTick = capsule.history.events[capsule.history.events.length - 1].tick;
        useLabStore.setState({
            graph: capsule.graph,
            timeline: capsule.history,
            simulation: {
                playbackState: 'replay:paused',
                isRunning: false,
                playbackMode: 'replay',
                tick: lastTick, // Jump to end
                pinStates: {},
                partStates: {}, // Important: Replay clears part states initially, but they should be reconstructed if we had that logic.
                // For now, we are verifying timeline events.
                replayScrubTick: 0,
                lastReconstructionMs: 0
            }
        });

        // Fast forward to end via scrub
        actFn(() => store.scrub(lastTick));

        state = useLabStore.getState();

        // Verify final state consistency
        // Note: deriveStateAtTick produces graph/pinStates. partStates are NOT fully reconstructed for visualization yet
        // but we can check if the events were replayed correctly in the timeline?
        // Actually, startLabSession loads the timeline.

        const replayState = useLabStore.getState();
        const replayEvents = replayState.timeline.events;

        const loadEvent = replayEvents.find(e => e.type === 'FPGA_LOAD_PRESET');
        expect(loadEvent).toBeDefined();
        expect(loadEvent?.presetId).toBe('basys3-blink');

        // Check strict determinism of the capsule (no 'ts' field)
        const eventJson = JSON.stringify(capsule.history.events);
        expect(eventJson).not.toContain('"ts":');
    });
});
