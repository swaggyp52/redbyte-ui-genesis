import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// LabSelectionScreen.tsx: Unified entry point for selecting a lab and setting student identity.
import { useState } from 'react';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';
import { AVAILABLE_LABS } from '../labs/LabRegistry';
export const LabSelectionScreen = () => {
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
    return (_jsxs("div", { className: "max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700", children: [_jsxs("section", { className: "text-center space-y-4", children: [_jsxs("h1", { className: "text-5xl font-extrabold tracking-tight text-white lg:text-6xl", children: ["RedByte ", _jsx("span", { className: "text-indigo-500", children: "Genesis" }), " Lab"] }), _jsx("p", { className: "text-lg text-slate-400 max-w-2xl mx-auto", children: "Select your lab assignment and verify your identity to begin." })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8 mt-12", children: [_jsxs("div", { className: "bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6", children: [_jsxs("div", { className: "flex items-center gap-4 mb-2", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30", children: _jsx("span", { className: "text-indigo-400 font-bold", children: "1" }) }), _jsx("h2", { className: "text-xl font-bold text-white uppercase tracking-wider text-sm", children: "Student Identity" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-bold text-slate-500 uppercase ml-1", children: "Full Name" }), _jsx("input", { type: "text", placeholder: "e.g. Connor Angiel", value: name, onChange: (e) => setName(e.target.value), className: "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-bold text-slate-500 uppercase ml-1", children: "Student ID/Email" }), _jsx("input", { type: "text", placeholder: "e.g. ca1234 or connor@redbyte.io", value: studentId, onChange: (e) => setStudentId(e.target.value), className: "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium" })] })] })] }), _jsxs("div", { className: "bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6", children: [_jsxs("div", { className: "flex items-center gap-4 mb-2", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30", children: _jsx("span", { className: "text-indigo-400 font-bold", children: "2" }) }), _jsx("h2", { className: "text-xl font-bold text-white uppercase tracking-wider text-sm", children: "Select Lab" })] }), _jsx("div", { className: "space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar", children: AVAILABLE_LABS.filter(l => !l.hidden).map((lab) => (_jsxs("button", { onClick: () => selectLab(lab.id), className: `w-full text-left p-4 rounded-2xl border transition-all duration-200 group
                  ${selectedLabId === lab.id
                                        ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'}
                `, children: [_jsxs("div", { className: "flex justify-between items-start mb-1", children: [_jsx("span", { className: `font-bold transition-colors ${selectedLabId === lab.id ? 'text-indigo-400' : 'text-white'}`, children: lab.title }), _jsx("span", { className: "text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter", children: lab.difficulty })] }), _jsx("p", { className: "text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium", children: lab.description })] }, lab.id))) })] })] }), _jsx("div", { className: "pt-8 flex justify-center", children: _jsx("button", { onClick: handleStart, disabled: !isFormValid, className: `px-12 py-4 rounded-2xl font-bold text-lg transition-all transform active:scale-95 shadow-2xl
            ${isFormValid
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:-translate-y-1 shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}
          `, children: "Initialize Lab Session" }) })] }));
};
