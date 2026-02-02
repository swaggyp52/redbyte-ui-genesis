// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// GuidedLabShell.tsx: Responsive Tailwind-based shell for the 7-step workflow.

import React from 'react';
import { useLabWorkflowStore, type LabStep } from '../stores/useLabWorkflowStore';
import { useCapabilitiesStore } from '../stores/capabilitiesStore';

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
    const { currentStep, completedSteps, setStep, getMaxUnlockedStepIndex } = useLabWorkflowStore();
    const maxUnlockedIndex = getMaxUnlockedStepIndex();
    const bridgeOnline = useCapabilitiesStore(state => state.hardware.bridgeOnline);

    return (
        <div className="flex flex-col lg:flex-row h-full w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
            {/* Sidebar Stepper - Fixed Sidebar on Desktop, Top Bar on Mobile */}
            <aside className="w-full lg:w-64 border-b lg:border-r border-slate-800 bg-slate-900/50 backdrop-blur-md flex flex-col p-4 z-10 shrink-0">
                <div className="mb-4 lg:mb-8 px-2 flex justify-between items-center lg:block">
                    <div>
                        <h2 className="text-lg lg:text-xl font-bold tracking-tight text-white leading-tight">Lab Workflow</h2>
                        <p className="text-[10px] text-slate-400 mt-0.5 lg:mt-1 uppercase tracking-wider font-bold">Step Status</p>
                    </div>
                    {/* Progress Indicator for Mobile */}
                    <div className="lg:hidden flex items-center gap-1">
                        {STEPS.map(s => (
                            <div key={s.id} className={`w-1.5 h-1.5 rounded-full ${completedSteps.includes(s.id) ? 'bg-indigo-500' : currentStep === s.id ? 'bg-white' : 'bg-slate-700'}`} />
                        ))}
                    </div>
                </div>

                <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible no-scrollbar space-x-2 lg:space-x-0 lg:space-y-1 pb-2 lg:pb-0">
                    {STEPS.map((step, index) => {
                        const isActive = currentStep === step.id;
                        const isCompleted = completedSteps.includes(step.id);
                        const isDisabled = index > maxUnlockedIndex;

                        return (
                            <button
                                key={step.id}
                                onClick={() => !isDisabled && setStep(step.id)}
                                disabled={isDisabled}
                                className={`flex-shrink-0 lg:w-full flex items-center gap-3 px-3 py-2 lg:py-2.5 rounded-lg text-sm font-medium transition-all
                                  ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : ''}
                                  ${!isActive && isCompleted ? 'text-indigo-400 hover:bg-slate-800' : ''}
                                  ${isDisabled ? 'text-slate-600 cursor-not-allowed opacity-50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                                `}
                            >
                                <div className={`hidden lg:block w-2 h-2 rounded-full ${isActive ? 'bg-white' : isCompleted ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                                <span className="whitespace-nowrap">{step.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="hidden lg:block mt-auto p-4 bg-slate-800/40 rounded-xl border border-slate-700/30">
                    <p className="text-[10px] uppercase font-black text-slate-500 mb-2 tracking-tighter">Session Context</p>
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold truncate">Logic Lab Beta</p>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
                <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6 bg-slate-900/20 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <span className="hidden sm:inline text-[9px] font-mono text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">ID: 0x8F2</span>
                        <div className="hidden sm:block h-4 w-px bg-slate-800" />
                        <span className="text-xs font-bold text-slate-300">
                            Step {STEPS.findIndex(s => s.id === currentStep) + 1} of {STEPS.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {bridgeOnline ? (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-black text-green-500 uppercase tracking-tighter">Bridge Online</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter">Bridge Offline</span>
                            </div>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-auto custom-scrollbar">
                    <div className="p-4 lg:p-8 min-h-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};
