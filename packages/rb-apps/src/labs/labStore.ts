// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { LABS } from './labContent';

// ---------------------------------------------------------------------------
// Progress persistence (localStorage)
// ---------------------------------------------------------------------------

export interface LabProgressEntry {
    status: 'not-started' | 'in-progress' | 'complete';
    completedStepIndices: number[];
    lastAccessedAt: number;
}

const PROGRESS_KEY = 'rb.labs.progress';

function loadProgress(): Record<string, LabProgressEntry> {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

function saveProgress(progress: Record<string, LabProgressEntry>) {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch { /* quota errors are non-fatal */ }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface LabState {
    currentStepIndex: number;
    completedSteps: number[]; // Array of completed step indices
    isPass: boolean; // Loop pass status (for visual feedback)

    activeLabId: string;
    studentName: string;
    studentId: string;

    // Persisted progress across all labs
    labProgress: Record<string, LabProgressEntry>;
    getLabProgress: (labId: string) => LabProgressEntry;

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
    labProgress: loadProgress(),

    getLabProgress: (labId: string): LabProgressEntry => {
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
                status: (completedSteps.length > 0 ? 'in-progress' : 'not-started') as LabProgressEntry['status'],
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
    setHardwareVerified: (verified: boolean) => {
        set({ hardwareVerified: verified, isDirty: true });
    },

    // Data Safety
    isDirty: false,
    setIsDirty: (dirty: boolean) => set({ isDirty: dirty }),

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
        const { completedSteps, activeLabId, labProgress } = get();
        if (completedSteps.includes(stepIndex)) return;

        const newCompleted = [...completedSteps, stepIndex];
        const content = LABS[activeLabId] || LABS['lab-1'];
        const totalSteps = Array.isArray(content) ? content.length : content.steps.length;
        const isComplete = newCompleted.length >= totalSteps;

        const updatedProgress: Record<string, LabProgressEntry> = {
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
        const updatedProgress: Record<string, LabProgressEntry> = {
            ...labProgress,
            [activeLabId]: { status: 'not-started', completedStepIndices: [], lastAccessedAt: Date.now() },
        };
        saveProgress(updatedProgress);
        set({ currentStepIndex: 0, completedSteps: [], isPass: false, labProgress: updatedProgress });
    },

    setPass: (pass: boolean) => {
        set({ isPass: pass });
    }
}));
