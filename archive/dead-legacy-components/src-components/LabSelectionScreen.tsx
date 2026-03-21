// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// LabSelectionScreen.tsx: Unified entry point for selecting a lab and setting student identity.

import React, { useState } from 'react';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';
import { AVAILABLE_LABS, type LabDefinition } from '../labs/LabRegistry';

export const LabSelectionScreen: React.FC = () => {
    const { selectedLabId, selectLab, studentIdentity, setIdentity, setStep, completeStep } = useLabWorkflowStore();
    const [name, setName] = useState(studentIdentity?.name || '');
    const [studentId, setStudentId] = useState(studentIdentity?.id || '');

    const handleStart = () => {
        if (name && studentId && selectedLabId) {
            setIdentity(name, studentId);
            completeStep('selection');
            setStep('specification');
        }
    };

    const isFormValid = name.trim().length > 0 && studentId.trim().length > 0 && selectedLabId !== null;

    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="text-center space-y-4">
                <h1 className="text-5xl font-extrabold tracking-tight text-white lg:text-6xl">
                    RedByte <span className="text-indigo-500">Genesis</span> Lab
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                    Select your lab assignment and verify your identity to begin.
                </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                {/* Step 1: Identity */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                            <span className="text-indigo-400 font-bold">1</span>
                        </div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider text-sm">Student Identity</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Connor Angiel"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Student ID/Email</label>
                            <input
                                type="text"
                                placeholder="e.g. ca1234 or connor@redbyte.io"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* Step 2: Lab Selection */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                            <span className="text-indigo-400 font-bold">2</span>
                        </div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider text-sm">Select Lab</h2>
                    </div>

                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                        {AVAILABLE_LABS.filter(l => !l.hidden).map((lab) => (
                            <button
                                key={lab.id}
                                onClick={() => selectLab(lab.id)}
                                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 group
                  ${selectedLabId === lab.id
                                        ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                                    }
                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-bold transition-colors ${selectedLabId === lab.id ? 'text-indigo-400' : 'text-white'}`}>
                                        {lab.title}
                                    </span>
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                                        {lab.difficulty}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
                                    {lab.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="pt-8 flex justify-center">
                <button
                    onClick={handleStart}
                    disabled={!isFormValid}
                    className={`px-12 py-4 rounded-2xl font-bold text-lg transition-all transform active:scale-95 shadow-2xl
            ${isFormValid
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:-translate-y-1 shadow-indigo-600/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                        }
          `}
                >
                    Initialize Lab Session
                </button>
            </div>
        </div>
    );
};
