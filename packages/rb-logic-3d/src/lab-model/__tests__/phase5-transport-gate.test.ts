
import { describe, it, expect, beforeEach } from 'vitest';
import { useLabStore } from '../store';

describe('Phase 5: Transport Basic Verification', () => {
    beforeEach(() => {
        useLabStore.getState().reset();
    });

    it('Scenario 1: setUserPinState records events (Sim Mode)', () => {
        const store = useLabStore.getState();
        store.addNode({
            id: 'fpga-1',
            type: 'fpga-basys3',
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            properties: {}
        });

        // Event 1
        store.setUserPinState('fpga-1', 'SW0', 1);

        const events = store.timeline.events.filter(e => e.type === 'SIM_PIN_DIFF');
        expect(events.length).toBe(1);
    });

    it('Scenario 2: SimTransport updates pinStates on Simulation Step', () => {
        const store = useLabStore.getState();
        store.addNode({
            id: 'fpga-1',
            type: 'fpga-basys3',
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            properties: {}
        });
        store.loadFpgaPreset('fpga-1', 'basys3-counter');

        // Input: BTN0 = 1
        store.setUserPinState('fpga-1', 'BTN0', 1);

        // Run Step
        store.runSimulationStep();

        // Verify output LED0 = 1
        const led0 = store.simulation.pinStates['fpga-1:LED0'];
        if (led0 !== 1) {
            console.error('LED0 State:', led0, 'PinStates keys:', Object.keys(store.simulation.pinStates));
        }
        expect(led0).toBe(1);
    });
});
