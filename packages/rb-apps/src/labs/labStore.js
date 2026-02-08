// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
import { LABS } from './labContent';
const PROGRESS_KEY = 'rb.labs.progress';
function loadProgress() {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    }
    catch {
        return {};
    }
}
function saveProgress(progress) {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    }
    catch { /* quota errors are non-fatal */ }
}
export const useLabStore = create((set, get) => ({
    currentStepIndex: 0,
    completedSteps: [],
    isPass: false,
    activeLabId: 'lab-1',
    studentName: '',
    studentId: '',
    labProgress: loadProgress(),
    getLabProgress: (labId) => {
        const progress = get().labProgress;
        return progress[labId] ?? { status: 'not-started', completedStepIndices: [], lastAccessedAt: 0 };
    },
    setActiveLab: (labId) => {
        const progress = get().labProgress;
        const existing = progress[labId];
        // Restore progress if available, otherwise start fresh
        const completedSteps = existing?.completedStepIndices ?? [];
        const currentStep = completedSteps.length > 0 ? Math.max(...completedSteps) + 1 : 0;
        // Update access time
        const updatedProgress = {
            ...progress,
            [labId]: {
                status: (completedSteps.length > 0 ? 'in-progress' : 'not-started'),
                completedStepIndices: completedSteps,
                lastAccessedAt: Date.now(),
            },
        };
        saveProgress(updatedProgress);
        set({
            activeLabId: labId,
            currentStepIndex: currentStep,
            completedSteps,
            isPass: false,
            labProgress: updatedProgress,
        });
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
        const { completedSteps, activeLabId, labProgress } = get();
        if (completedSteps.includes(stepIndex))
            return;
        const newCompleted = [...completedSteps, stepIndex];
        const content = LABS[activeLabId] || LABS['lab-1'];
        const totalSteps = Array.isArray(content) ? content.length : content.steps.length;
        const isComplete = newCompleted.length >= totalSteps;
        const updatedProgress = {
            ...labProgress,
            [activeLabId]: {
                status: isComplete ? 'complete' : 'in-progress',
                completedStepIndices: newCompleted,
                lastAccessedAt: Date.now(),
            },
        };
        saveProgress(updatedProgress);
        set({ completedSteps: newCompleted, labProgress: updatedProgress });
    },
    resetLab: () => {
        const { activeLabId, labProgress } = get();
        const updatedProgress = {
            ...labProgress,
            [activeLabId]: { status: 'not-started', completedStepIndices: [], lastAccessedAt: Date.now() },
        };
        saveProgress(updatedProgress);
        set({ currentStepIndex: 0, completedSteps: [], isPass: false, labProgress: updatedProgress });
    },
    setPass: (pass) => {
        set({ isPass: pass });
    }
}));
