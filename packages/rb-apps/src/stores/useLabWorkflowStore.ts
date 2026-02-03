// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// useLabWorkflowStore.ts: Zustand store for managing the 7-step guided lab workflow state.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { VectorResult } from '../components/SelfCheckVectorsTable';

export type LabStep =
    | 'selection'
    | 'specification'
    | 'design'
    | 'simulation'
    | 'hardware'
    | 'verification'
    | 'report';

const STEP_ORDER: LabStep[] = ['selection', 'specification', 'design', 'simulation', 'hardware', 'verification', 'report'];

export interface LabWorkflowState {
    currentStep: LabStep;
    completedSteps: LabStep[];
    selectedLabId: string | null;
    studentIdentity: { name: string; id: string } | null;
    verificationResults: VectorResult[];
    hardwareSnapshots: any[];

    // Actions
    setStep: (step: LabStep) => void;
    completeStep: (step: LabStep) => void;
    selectLab: (labId: string) => void;
    setIdentity: (name: string, id: string) => void;
    setVerificationResults: (results: VectorResult[]) => void;
    addHardwareSnapshot: (snapshot: any) => void;
    getMaxUnlockedStepIndex: () => number;
    reset: () => void;
}

export const useLabWorkflowStore = create<LabWorkflowState>()(
    devtools(
        immer((set, get) => ({
            currentStep: 'selection',
            completedSteps: [],
            selectedLabId: null,
            studentIdentity: null,
            verificationResults: [],
            hardwareSnapshots: [],

            setStep: (step) => set((state) => {
                const currentIndex = STEP_ORDER.indexOf(state.currentStep);
                const targetIndex = STEP_ORDER.indexOf(step);
                const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

                // Allow moving backward freely
                if (targetIndex < currentIndex) {
                    state.currentStep = step;
                    return;
                }

                // Disallow skipping steps unless logic allows
                const maxIndex = get().getMaxUnlockedStepIndex();
                if (targetIndex > maxIndex) {
                    if (!isTestEnv) {
                        console.warn(`[LabWorkflow] Blocked jump to ${step}: requirement not met.`);
                    }
                    return;
                }

                state.currentStep = step;
            }),

            completeStep: (step) => set((state) => {
                if (!state.completedSteps.includes(step)) {
                    state.completedSteps.push(step);
                }
            }),

            selectLab: (labId) => set((state) => {
                state.selectedLabId = labId;
            }),

            setIdentity: (name, id) => set((state) => {
                state.studentIdentity = { name, id };
            }),

            setVerificationResults: (results) => set((state) => {
                state.verificationResults = results;
            }),

            addHardwareSnapshot: (snapshot) => set((state) => {
                state.hardwareSnapshots.push(snapshot);
            }),

            getMaxUnlockedStepIndex: () => {
                const state = get();
                const lastCompletedIndex = state.completedSteps.length === 0
                    ? -1
                    : Math.max(...state.completedSteps.map((s: LabStep) => STEP_ORDER.indexOf(s)));
                return Math.min(STEP_ORDER.length - 1, lastCompletedIndex + 1);
            },

            reset: () => set((state) => {
                state.currentStep = 'selection';
                state.completedSteps = [];
                state.selectedLabId = null;
                state.studentIdentity = null;
                state.verificationResults = [];
                state.hardwareSnapshots = [];
            }),
        })),
        { name: 'LabWorkflowStore' }
    )
);
