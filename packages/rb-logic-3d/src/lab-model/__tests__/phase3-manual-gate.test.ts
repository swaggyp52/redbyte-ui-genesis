import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLabStore } from '../store';
import { PART_DEFINITIONS } from '../parts';

// Mock Date.now for deterministic timestamps in tests
const START_TIME = 1600000000000;
vi.spyOn(Date, 'now').mockReturnValue(START_TIME);

describe('MVP-3 Phase 3 Manual Gate (Integration Test)', () => {
    beforeEach(() => {
        useLabStore.getState().reset();
    });

    it('Scenario: Place Basys3, Interact, Export, Replay', async () => {
        // 1. Place Basys3
        const basysDef = PART_DEFINITIONS['fpga-basys3'];
        expect(basysDef).toBeDefined();

        useLabStore.getState().addNode({
            id: 'fpga-1',
            type: 'fpga-basys3',
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            properties: {}
        });

        const fpgaNode = useLabStore.getState().graph.nodes.find(n => n.id === 'fpga-1');
        expect(fpgaNode).toBeDefined();

        // 2. Click SW0, SW1, BTNC (setUserPinState)
        // Simulate User Interaction at T=0
        actFn(() => {
            useLabStore.getState().setUserPinState('fpga-1', 'SW0', 1);
            useLabStore.getState().setUserPinState('fpga-1', 'SW1', 1);
            useLabStore.getState().setUserPinState('fpga-1', 'BTN0', 1); // BTNC
        });

        // Verify Immediate State Update (Visuals)
        expect(useLabStore.getState().simulation.pinStates['fpga-1:SW0']).toBe(1);
        expect(useLabStore.getState().simulation.pinStates['fpga-1:SW1']).toBe(1);
        expect(useLabStore.getState().simulation.pinStates['fpga-1:BTN0']).toBe(1);

        // Verify Timeline Event
        const events = useLabStore.getState().timeline.events;
        expect(events.length).toBeGreaterThan(0);
        const lastEvent = events[events.length - 1];
        expect(lastEvent.type).toBe('SIM_PIN_DIFF');
        // @ts-ignore
        expect(lastEvent.source).toBe('user');
        // @ts-ignore
        expect(lastEvent.pinDiffs['fpga-1:BTN0']).toBe(1);

        // 3. Run for ~5 seconds (100 ticks @ 50ms)
        actFn(() => useLabStore.getState().toggleSimulation(true));

        for (let i = 0; i < 100; i++) {
            actFn(() => useLabStore.getState().runSimulationStep());
        }

        actFn(() => useLabStore.getState().toggleSimulation(false));

        const tickAfterRun = useLabStore.getState().simulation.tick;
        expect(tickAfterRun).toBeGreaterThanOrEqual(100);

        // Check if LEDs updated (if passthrough, SW0=1 maps to LED0=1)
        const led0State = useLabStore.getState().simulation.pinStates['fpga-1:LED0'];
        expect(led0State).toBe(1);

        // 4. Export Capsule (Capture current state)
        const freshState = useLabStore.getState();
        const snapshot = {
            meta: {
                capsuleVersion: 'labcapsule.v1',
                createdAt: new Date().toISOString()
            },
            graph: freshState.graph,
            history: freshState.timeline,
            artifacts: {}
        };

        // 5. Reset & Import (Replay)
        useLabStore.getState().reset();
        expect(useLabStore.getState().graph.nodes.length).toBe(0);

        // Import logic simulation (simplified applyCapsule)
        useLabStore.setState({
            graph: snapshot.graph,
            timeline: snapshot.history,
            simulation: {
                playbackState: 'replay:paused',
                isRunning: false,
                playbackMode: 'replay',
                tick: tickAfterRun, // Jump to end
                pinStates: {},
                replayScrubTick: 0,
                lastReconstructionMs: 0
            }
        });

        // 6. Scrub (Verify Determinism)
        // Scrub to 0
        actFn(() => useLabStore.getState().scrub(0));

        const replaySw0 = useLabStore.getState().simulation.pinStates['fpga-1:SW0'];
        expect(replaySw0).toBe(1);

        // Scrub to end
        actFn(() => useLabStore.getState().scrub(tickAfterRun));
        const replayLed0 = useLabStore.getState().simulation.pinStates['fpga-1:LED0'];
        expect(replayLed0).toBe(1);

        console.log('Test Passed: Determinism Maintained');
    });
});

// Simple wrapper for non-React environment if needed, mostly semantic here
function actFn(fn: () => void) {
    fn();
}
