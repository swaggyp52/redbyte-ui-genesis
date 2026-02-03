// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
import { LABS } from './labContent';
export const useLabStore = create((set, get) => ({
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
    setHardwareVerified: (verified) => {
        set({ hardwareVerified: verified, isDirty: true });
    },
    // Data Safety
    isDirty: false,
    setIsDirty: (dirty) => set({ isDirty: dirty }),
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
    markComplete: (stepIndex) => {
        const { completedSteps } = get();
        if (!completedSteps.includes(stepIndex)) {
            set({ completedSteps: [...completedSteps, stepIndex] });
        }
    },
    resetLab: () => {
        set({ currentStepIndex: 0, completedSteps: [], isPass: false });
    },
    setPass: (pass) => {
        set({ isPass: pass });
    }
}));
