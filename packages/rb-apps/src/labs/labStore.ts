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

    // Self-Check Evidence
    selfCheckResults?: any;
    setSelfCheckResults: (results: any) => void;

    // Hardware Verification
    hardwareVerified: boolean;
    setHardwareVerified: (verified: boolean) => void;

    // Data Safety
    isDirty: boolean;
    setIsDirty: (dirty: boolean) => void;
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

    setSelfCheckResults: (results) => {
        set({ selfCheckResults: results });
    },

    // Hardware Verification logic
    hardwareVerified: false,
    setHardwareVerified: (verified: boolean) => {
        set({ hardwareVerified: verified, isDirty: true });
    },

    // Data Safety
    isDirty: false,
    setIsDirty: (dirty: boolean) => set({ isDirty: dirty }),
    // TODO: Implement actual persistence logic here or in middleware

    nextStep: () => {
        const { currentStepIndex, activeLabId } = get();
        const content = LABS[activeLabId] || LABS['lab-1'];
        const totalSteps = Array.isArray(content) ? content.length : content.steps.length;
        if (currentStepIndex < totalSteps - 1) {
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
