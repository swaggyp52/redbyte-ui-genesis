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

export interface LabWorkflowState {
    currentStep: LabStep;
    completedSteps: LabStep[];
    selectedLabId: string | null;
    studentIdentity: { name: string; id: string } | null;
    verificationResults: VectorResult[];

    // Actions
    setStep: (step: LabStep) => void;
    completeStep: (step: LabStep) => void;
    selectLab: (labId: string) => void;
    setIdentity: (name: string, id: string) => void;
    setVerificationResults: (results: VectorResult[]) => void;
    reset: () => void;
}

export const useLabWorkflowStore = create<LabWorkflowState>()(
    devtools(
        immer((set) => ({
            currentStep: 'selection',
            completedSteps: [],
            selectedLabId: null,
            studentIdentity: null,
            verificationResults: [],

            setStep: (step) => set((state) => {
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
            reset: () => set((state) => {
                state.currentStep = 'selection';
                state.completedSteps = [];
                state.selectedLabId = null;
                state.studentIdentity = null;
                state.verificationResults = [];
            }),
        })),
        { name: 'LabWorkflowStore' }
    )
);
