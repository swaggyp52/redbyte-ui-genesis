// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// LabSpecificationView.tsx: Displays the lab's specification, requirements, and hardware constraints.

import React from 'react';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';
import { AVAILABLE_LABS } from './LabRegistry';

export const LabSpecificationView: React.FC = () => {
    const { selectedLabId, setStep, completeStep } = useLabWorkflowStore();
    const lab = AVAILABLE_LABS.find(l => l.id === selectedLabId);

    if (!lab) return <div>No lab selected.</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="border-b border-slate-800 pb-6">
                <h1 className="text-4xl font-black text-white">{lab.title} – Specification</h1>
                <p className="text-slate-400 mt-2 italic">Ref: {lab.specPath}</p>
            </header>

            <section className="space-y-6">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                    <h2 className="text-lg font-bold text-indigo-400 mb-3 uppercase tracking-wider">Objective</h2>
                    <p className="text-slate-300 leading-relaxed">
                        {lab.description}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">Target Hardware</h3>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                                <span className="text-2xl">⚡</span>
                            </div>
                            <div>
                                <p className="font-bold text-white">Xilinx Basys 3</p>
                                <p className="text-[10px] text-slate-500 font-mono">Artix-7 FPGA</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">IO Constraints</h3>
                        <ul className="text-xs space-y-2 text-slate-400 font-medium">
                            <li className="flex justify-between border-b border-slate-800/50 pb-1">
                                <span>Switches</span>
                                <span className="text-slate-200">SW0 - SW15</span>
                            </li>
                            <li className="flex justify-between border-b border-slate-800/50 pb-1">
                                <span>LEDs</span>
                                <span className="text-slate-200">LD0 - LD15</span>
                            </li>
                            <li className="flex justify-between">
                                <span>Segments</span>
                                <span className="text-slate-200">Digit 0-3</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2 text-amber-500">
                        <span className="text-xl">⚠️</span>
                        <h3 className="font-bold text-sm uppercase tracking-wide">Critical Requirements</h3>
                    </div>
                    <ul className="text-xs text-slate-400 list-disc ml-5 space-y-1">
                        <li>All logic must be synchronous unless specified.</li>
                        <li>Circuit must be fully documented using text annotations.</li>
                        <li>Simulation must pass all 10 base vectors before hardware testing.</li>
                    </ul>
                </div>
            </section>

            <footer className="pt-8 flex justify-between items-center">
                <button
                    onClick={() => setStep('selection')}
                    className="text-slate-500 hover:text-white text-sm font-bold transition-colors"
                >
                    ← Back to Selection
                </button>
                <button
                    onClick={() => {
                        completeStep('specification');
                        setStep('design');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2"
                >
                    Begin Design Phase
                    <span className="text-lg">→</span>
                </button>
            </footer>
        </div>
    );
};
