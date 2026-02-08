import { describe, it, expect, beforeEach } from 'vitest';
import { useLabStore } from '../store';
describe('Phase 5: Transport Basic Verification', () => {
    beforeEach(() => {
        useLabStore.getState().reset();
    });
    it('Scenario 1: setUserPinState records events (Sim Mode)', () => {
        // Initial setup
        useLabStore.getState().addNode({
            id: 'fpga-1',
            type: 'fpga-basys3',
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            properties: {}
        });
        // Trigger action
        useLabStore.getState().setUserPinState('fpga-1', 'SW0', 1);
        // Assert on LATEST state
        const state = useLabStore.getState();
        const events = state.timeline.events.filter(e => e.type === 'SIM_PIN_DIFF');
        expect(events.length).toBe(1);
        expect(state.simulation.pinStates['fpga-1:SW0']).toBe(1);
    });
    it('Scenario 2: SimTransport updates pinStates on Simulation Step', () => {
        // Setup with counter preset
        useLabStore.getState().addNode({
            id: 'fpga-1',
            type: 'fpga-basys3',
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            properties: {}
        });
        // Use 'counter' directly as the underlying engine expects the raw key for now
        // OR fix the engine/transport to map it. Let's use 'counter' to verify logic first.
        useLabStore.getState().loadFpgaPreset('fpga-1', 'counter');
        // Input: BTN0 = 1
        useLabStore.getState().setUserPinState('fpga-1', 'BTN0', 1);
        // Run Step (requires simulation to be running)
        useLabStore.getState().toggleSimulation(true);
        useLabStore.getState().runSimulationStep();
        // Verify output LED0 = 1 (on rising edge of BTN0)
        const state = useLabStore.getState();
        const led0 = state.simulation.pinStates['fpga-1:LED0'];
        expect(led0).toBe(1);
        // Verify event recorded for sim output
        const simEvents = state.timeline.events.filter(e => e.source === 'engine' && e.type === 'SIM_PIN_DIFF');
        expect(simEvents.length).toBeGreaterThanOrEqual(1);
    });
    it('Scenario 3: Transport Switch maintains Determinism (Timeline)', () => {
        // 1. Setup in Sim Mode
        useLabStore.getState().addNode({
            id: 'fpga-1',
            type: 'fpga-basys3',
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            properties: {}
        });
        useLabStore.getState().setUserPinState('fpga-1', 'SW0', 1);
        // 2. Switch to Bridge
        useLabStore.getState().setTransport('bridge');
        let state = useLabStore.getState();
        expect(state.activeTransport.getStatus().type).toBe('bridge');
        // 3. User interaction still records to timeline even in Bridge mode
        useLabStore.getState().setUserPinState('fpga-1', 'SW1', 1);
        state = useLabStore.getState();
        // 2 SIM_PIN_DIFF events (SW0 in sim mode, SW1 in bridge mode)
        const userEvents = state.timeline.events.filter(e => e.source === 'user' && e.type === 'SIM_PIN_DIFF');
        expect(userEvents.length).toBe(2);
        // 4. Switch back to Sim
        useLabStore.getState().setTransport('sim');
        state = useLabStore.getState();
        expect(state.activeTransport.getStatus().type).toBe('sim');
        // 5. Sim still produces outputs after switch back
        useLabStore.getState().loadFpgaPreset('fpga-1', 'passthrough');
        useLabStore.getState().toggleSimulation(true);
        useLabStore.getState().runSimulationStep();
        state = useLabStore.getState();
        // LED0 should be 1 because SW0 was set to 1 in step 1
        expect(state.simulation.pinStates['fpga-1:LED0']).toBe(1);
        // LED1 should be 1 because SW1 was set to 1 in step 3
        expect(state.simulation.pinStates['fpga-1:LED1']).toBe(1);
    });
});
