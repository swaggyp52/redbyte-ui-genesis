
import { LabTransport, TransportStatus } from './types';
import { FpgaSimEngine } from '../fpga-sim/engine';

export class SimTransport implements LabTransport {
    private engine: FpgaSimEngine;
    private currentNodeId: string | null = null;
    private currentInputs: Record<string, 0 | 1> = {};

    constructor(defaultPreset: string = 'passthrough') {
        this.engine = new FpgaSimEngine(defaultPreset);
    }

    async connect(): Promise<void> {
        // Sim is always connected conceptually
        return Promise.resolve();
    }

    async disconnect(): Promise<void> {
        // No-op for sim
        return Promise.resolve();
    }

    getStatus(): TransportStatus {
        return {
            type: 'sim',
            connected: true
        };
    }

    pushInteraction(nodeId: string, pinId: string, value: number): void {
        // In sim, we just store this to feed into the next tick
        // We assume one active FPGA node for MVP-3
        this.currentNodeId = nodeId;
        this.currentInputs[pinId] = value as 0 | 1;
    }

    loadPreset(nodeId: string, presetId: string): void {
        this.currentNodeId = nodeId;
        this.engine.setPreset(presetId);
        // Reset inputs on preset load? Maybe not, switches stay physically set.
        // But we might want to ensure the engine re-evaluates.
    }

    // Special method for SimTransport to advance time
    tick(): void {
        // Sim engine is stateless between ticks except for its internal registers?
        // Actually FpgaSimEngine stores state.
        // We pass inputs to it.
        // But wait, the Store gathers inputs from `pinStates` usually.
        // The transport needs to receive the current state of buttons/switches.
        // `pushInteraction` only gives us *changes* or specific events.
        // 
        // Architecture Check:
        // In `store.ts`, we currently do:
        // 1. Gather all inputs from `state.simulation.pinStates`
        // 2. Call `engine.tick(inputs)`
        // 
        // Providing `pushInteraction` alone might drift if we don't know the full state.
        // However, the `SimTransport` memory of `currentInputs` creates a duplicate source of truth if we aren't careful.
        // 
        // Ideally:
        // `store.ts` shouldn't manage "SW0" state manually if the transport owns the device.
        // BUT "SW0" is a physical object on the user's screen (the LabNode).
        // So `pinStates` IS the source of truth for the physical switches.
        //
        // So `SimTransport` should probably accept a "syncInputs" or "tick(inputs)" call.
        // But `LabTransport` poll() implies we get outputs.
        //
        // Let's refine `tick` to accept inputs for SimTransport.
        // Real hardware transport won't 'tick', it just runs.
        // But real hardware transport needs to know Switch states too!
        // So `pushInteraction` is correct for "User flipped a switch".
        // The Transport sends that to the board.
    }

    // We implement `tick` to actually run the sim step
    // But we need the full input vector, or we rely on `pushInteraction` catching everything.
    // For robustness, `store.ts` usually iterates all pins.
    // Let's stick to the interface:
    // If we rely on `pushInteraction`, we need to init it correctly.
    // Or we provide a way to 'setAllInputs'.

    // For MVP-3 Sim, let's allow `tick` to take full inputs if needed, 
    // or we update `currentInputs` via pushInteraction.
    // Let's assume `store.ts` calls `pushInteraction` for every user action.
    // AND we probably need a sync mechanism for initial state or missed updates?
    // Actually, `store.ts` has `pinStates`.

    // Let's allow `tick` to take inputs purely for the Sim implementation detail.
    tickWithInputs(inputs: Record<string, 0 | 1>): void {
        // Update local memory
        this.currentInputs = { ...this.currentInputs, ...inputs };
        this.engine.tick(this.currentInputs);
    }

    poll(): Record<string, number> {
        // Return current outputs (LEDs) from engine
        const state = this.engine.getState();
        const outputs: Record<string, number> = {};

        if (this.currentNodeId) {
            for (const [key, val] of Object.entries(state.outputs)) {
                outputs[`${this.currentNodeId}:${key}`] = val;
            }
        }
        return outputs;
    }
}
