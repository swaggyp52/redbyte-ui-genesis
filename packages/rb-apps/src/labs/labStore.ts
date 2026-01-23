// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { LABS } from './labContent';

interface LabState {
    currentStepIndex: number;
    completedSteps: number[]; // Array of completed step indices
    isPass: boolean; // Loop pass status (for visual feedback)

    activeLabId: string;
    studentName: string;
    studentId: string;

    // Actions
    setActiveLab: (labId: string) => void;
    nextStep: () => void;
    prevStep: () => void;
    markComplete: (stepIndex: number) => void;
    resetLab: () => void;
    setPass: (pass: boolean) => void;
    setStudentInfo: (name: string, id: string) => void;
}

export const useLabStore = create<LabState>((set, get) => ({
    currentStepIndex: 0,
    completedSteps: [],
    isPass: false,
    activeLabId: 'lab-1',
    studentName: '',
    studentId: '',

    setActiveLab: (labId) => {
        set({ activeLabId: labId, currentStepIndex: 0, completedSteps: [], isPass: false });
    },

    setStudentInfo: (name, id) => {
        set({ studentName: name, studentId: id });
    },

    nextStep: () => {
        const { currentStepIndex, activeLabId } = get();
        const content = LABS[activeLabId] || LABS['lab-1'];
        if (currentStepIndex < content.length - 1) {
            set({ currentStepIndex: currentStepIndex + 1 });
        }
    },

    prevStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) {
            set({ currentStepIndex: currentStepIndex - 1 });
        }
    },

    markComplete: (stepIndex: number) => {
        const { completedSteps } = get();
        if (!completedSteps.includes(stepIndex)) {
            set({ completedSteps: [...completedSteps, stepIndex] });
        }
    },

    resetLab: () => {
        set({ currentStepIndex: 0, completedSteps: [], isPass: false });
    },

    setPass: (pass: boolean) => {
        set({ isPass: pass });
    }
}));
