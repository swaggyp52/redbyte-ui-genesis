
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLabStore } from '../store';
import { BridgeTransport } from '../transport/bridge-transport';
import { WebSocket as NodeWS } from 'ws';

// Mock the network URL to avoid actual connection attempts to localhost:4242
vi.mock('../transport/bridge-transport', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        BridgeTransport: class extends actual.BridgeTransport {
            constructor() {
                super('ws://localhost:4243'); // Use the test port
            }
        }
    };
});

describe('Phase 6: Store Hardware Mode Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.WebSocket = NodeWS as any;
        useLabStore.getState().reset();
    });

    it('should switch to bridge transport and handle interactions', async () => {
        const store = useLabStore;

        // Setup FPGA node
        store.getState().addNode({
            id: 'fpga-1',
            type: 'fpga-basys3',
            pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            properties: {}
        });

        // Initial state should be sim
        expect(store.getState().getTransportStatus().type).toBe('sim');

        // Switch to bridge
        store.getState().setTransport('bridge');
        expect(store.getState().getTransportStatus().type).toBe('bridge');

        const transport = store.getState().activeTransport as BridgeTransport;
        const connectSpy = vi.spyOn(transport, 'connect').mockImplementation(async () => {
            (transport as any).connected = true;
            return Promise.resolve();
        });
        const pushSpy = vi.spyOn(transport, 'pushInteraction');
        const pollSpy = vi.spyOn(transport, 'poll').mockReturnValue({
            'fpga-1:LED0': 1
        });

        await store.getState().activeTransport.connect();
        expect(store.getState().getTransportStatus().connected).toBe(true);

        // Interaction should be captured in event log AND pushed to transport
        store.getState().setUserPinState('fpga-1', 'SW0', 1);

        const events = store.getState().timeline.events;
        expect(events.length).toBeGreaterThan(0);
        // User interactions are recorded as SIM_PIN_DIFF with source: 'user'
        expect(events[events.length - 1].type).toBe('SIM_PIN_DIFF');
        expect(pushSpy).toHaveBeenCalledWith('fpga-1', 'SW0', 1);

        // Tick simulation to trigger poll integration
        store.getState().toggleSimulation(true);
        store.getState().runSimulationStep();

        // After tick, pinStates should reflect the polled hardware state
        const led0Value = store.getState().simulation.pinStates['fpga-1:LED0'];
        expect(led0Value).toBe(1);
    });
});
