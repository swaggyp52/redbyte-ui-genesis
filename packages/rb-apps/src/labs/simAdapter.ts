// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { IOSnapshot, BoardCapabilities } from '../services/hardwareClient';

interface SimState {
    tick: number;
    inputs: {
        SW: number;
        BTN: number;
    };
    outputs: {
        LED: number;
        SEG: number;
        AN: number;
        DP: number;
    };
    capabilities: BoardCapabilities;
}

interface SimStore extends SimState {
    setInputs: (inputs: Partial<SimState['inputs']>) => void;
    // For free play, we might want simple logic: SW -> LED
    // or just allow manual output setting for testing?
    // "One command sanity checklist" ... "toggle switches and see LEDs update"
    // implies we need *some* logic.
    // Let's implement a loopback mode: LED = SW, SEG = BTN (just to see something)
    runTick: () => void;

    // Explicitly set outputs (if we had a Logic Engine driving it)
    setOutputs: (outputs: Partial<SimState['outputs']>) => void;
}

// Default capabilities mimicking Basys3
const BASYS3_CAPS: BoardCapabilities = {
    boardId: 'basys3',
    boardName: 'Basys 3 (Simulated)',
    manufacturer: 'Digilent (Sim)',
    inputs: [
        { name: 'SW', width: 16, kind: 'switch' },
        { name: 'BTN', width: 5, kind: 'button' }
    ],
    outputs: [
        { name: 'LED', width: 16, kind: 'led' },
        { name: 'SEG', width: 8, kind: '7segment' },
        { name: 'AN', width: 4, kind: 'led' } // 'anode' is not in IOGroup kind union? 'led' is safe fallback or check type
    ]
};

export const useSimStore = create<SimStore>((set, get) => ({
    tick: 0,
    inputs: { SW: 0, BTN: 0 },
    outputs: { LED: 0, SEG: 0, AN: 0, DP: 0 },
    capabilities: BASYS3_CAPS,

    setInputs: (newInputs) => {
        set(state => ({
            inputs: { ...state.inputs, ...newInputs }
        }));
        // Auto-tick on input change for responsiveness
        get().runTick();
    },

    setOutputs: (newOutputs) => {
        set(state => ({
            outputs: { ...state.outputs, ...newOutputs }
        }));
    },

    runTick: () => {
        set(state => {
            const nextTick = state.tick + 1;

            // Simple Default Logic: LED follows SW exactly
            // This satisfies "Toggle switches and see LEDs update" for Free Play without a logic engine
            const ledState = state.inputs.SW;

            return {
                tick: nextTick,
                outputs: {
                    ...state.outputs,
                    LED: ledState
                }
            };
        });
    }
}));

// Adapter to match hardwareClient interface
export function getSimSnapshot(): IOSnapshot {
    const s = useSimStore.getState();
    return {
        timestamp: new Date().toISOString(),
        tick: s.tick,
        inputs: s.inputs,
        outputs: s.outputs
    };
}

export function getSimCapabilities(): BoardCapabilities {
    return useSimStore.getState().capabilities;
}

export function setSimInput(key: string, value: number) {
    useSimStore.getState().setInputs({ [key]: value });
}
