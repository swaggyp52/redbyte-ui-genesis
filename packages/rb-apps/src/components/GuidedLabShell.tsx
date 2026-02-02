// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// GuidedLabShell.tsx: Responsive Tailwind-based shell for the 7-step workflow.

import React from 'react';
import { useLabWorkflowStore, type LabStep } from '../stores/useLabWorkflowStore';

interface StepItem {
    id: LabStep;
    label: string;
}

const STEPS: StepItem[] = [
    { id: 'selection', label: '1. Identity' },
    { id: 'specification', label: '2. Specification' },
    { id: 'design', label: '3. Design' },
    { id: 'simulation', label: '4. Simulation' },
    { id: 'hardware', label: '5. Hardware' },
    { id: 'verification', label: '6. Verification' },
    { id: 'report', label: '7. Export' },
];

export const GuidedLabShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentStep, completedSteps, setStep } = useLabWorkflowStore();

    return (
        <div className="flex h-full w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
            {/* Sidebar Stepper */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-md flex flex-col p-4">
                <div className="mb-8 px-2">
                    <h2 className="text-xl font-bold tracking-tight text-white">Lab Workflow</h2>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Step Status</p>
                </div>

                <nav className="flex-1 space-y-1">
                    {STEPS.map((step) => {
                        const isActive = currentStep === step.id;
                        const isCompleted = completedSteps.includes(step.id);
                        const isDisabled = !isCompleted && !isActive; // Simple logic for now

                        return (
                            <button
                                key={step.id}
                                onClick={() => !isDisabled && setStep(step.id)}
                                disabled={isDisabled}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : ''}
                  ${!isActive && isCompleted ? 'text-indigo-400 hover:bg-slate-800' : ''}
                  ${isDisabled ? 'text-slate-600 cursor-not-allowed opacity-50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                `}
                            >
                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : isCompleted ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                                {step.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Current Lab</p>
                    <p className="text-xs font-semibold truncate">Logic Lab Beta</p>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/20">
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-slate-500">LAB_SESSION_ID: 0x8F2</span>
                        <div className="h-4 w-px bg-slate-800" />
                        <span className="text-xs font-medium text-slate-400">Step: {STEPS.find(s => s.id === currentStep)?.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-green-500">HARDWARE ONLINE</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto custom-scrollbar p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};
