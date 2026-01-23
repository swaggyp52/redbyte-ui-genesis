// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { IOSnapshot, BoardCapabilities } from '../services/hardwareClient';
import { EXPERIMENTS, type Experiment, DEFAULT_EXPERIMENT } from './experiments';

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
    activeExperimentId: string;
    experimentState: any;
    autoRun: boolean;
}

interface SimStore extends SimState {
    setInputs: (inputs: Partial<SimState['inputs']>) => void;
    setExperiment: (experimentId: string) => void;
    setAutoRun: (enabled: boolean) => void;
    runTick: () => void;
    reset: () => void;
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
        { name: 'AN', width: 4, kind: 'led' }
    ]
};

export const useSimStore = create<SimStore>((set, get) => ({
    tick: 0,
    inputs: { SW: 0, BTN: 0 },
    outputs: { LED: 0, SEG: 0, AN: 0b1111, DP: 1 },
    capabilities: BASYS3_CAPS,
    activeExperimentId: DEFAULT_EXPERIMENT.id,
    experimentState: DEFAULT_EXPERIMENT.initialState,
    autoRun: false,

    setInputs: (newInputs) => {
        set(state => ({
            inputs: { ...state.inputs, ...newInputs }
        }));
        // Immediate update on interaction
        get().runTick();
    },

    setExperiment: (experimentId) => {
        const exp = EXPERIMENTS[experimentId];
        if (!exp) return;
        set({
            activeExperimentId: exp.id,
            experimentState: exp.initialState,
            outputs: { LED: 0, SEG: 0, AN: 0b1111, DP: 1 }, // Clear outputs
            tick: 0
        });
        // Run initial tick to set initial state outputs
        get().runTick();
    },

    setAutoRun: (enabled) => set({ autoRun: enabled }),

    reset: () => {
        const currentExp = EXPERIMENTS[get().activeExperimentId] || DEFAULT_EXPERIMENT;
        set({
            tick: 0,
            experimentState: currentExp.initialState,
            inputs: { SW: 0, BTN: 0 },
            outputs: { LED: 0, SEG: 0, AN: 0b1111, DP: 1 }
        });
        get().runTick();
    },

    runTick: () => {
        set(state => {
            const exp = EXPERIMENTS[state.activeExperimentId] || DEFAULT_EXPERIMENT;
            const result = exp.compute(state.inputs, state.tick, state.experimentState);

            return {
                tick: state.tick + 1,
                outputs: result.outputs,
                experimentState: result.nextState ?? state.experimentState
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
