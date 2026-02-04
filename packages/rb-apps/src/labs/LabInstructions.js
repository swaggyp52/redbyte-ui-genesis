import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState } from 'react';
import { useLabStore } from './labStore';
import { LABS } from './labContent';
import { useHardwareStore } from '../stores/hardwareStore';
import { getSignalMap } from './signalMap';
import { exportEvidenceCapsule } from '../utils/evidenceExport';
import { PanelLayout } from '../components/PanelLayout';
// Styled Markdown Renderer
const SimpleMarkdown = ({ content }) => {
    if (!content)
        return null;
    const lines = content.split('\n');
    return (_jsx("div", { className: "space-y-3 text-sm font-sans", children: lines.map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed)
                return _jsx("div", { className: "h-2" }, i);
            if (trimmed.startsWith('# ')) {
                return (_jsx("h1", { className: "text-xl font-black text-white tracking-widest uppercase mb-6 pb-2 border-b-2 border-cyan-500/30", children: trimmed.slice(2) }, i));
            }
            if (trimmed.startsWith('## ')) {
                return (_jsx("h2", { className: "text-sm font-bold text-cyan-400 tracking-wider mt-6 mb-3 uppercase", children: trimmed.slice(3) }, i));
            }
            if (trimmed.match(/^\d+\./)) {
                return (_jsxs("div", { className: "flex gap-3 ml-2 text-gray-300", children: [_jsx("span", { className: "font-mono text-cyan-600 font-bold select-none", children: trimmed.split(' ')[0] }), _jsx("span", { className: "flex-1 leading-relaxed", children: renderInline(trimmed.replace(/^\d+\.\s*/, '')) })] }, i));
            }
            if (trimmed.startsWith('* ')) {
                return (_jsxs("div", { className: "flex gap-3 ml-4 text-gray-400", children: [_jsx("span", { className: "text-cyan-800", children: "\u2022" }), _jsx("span", { className: "flex-1 leading-relaxed", children: renderInline(trimmed.slice(2)) })] }, i));
            }
            return (_jsx("p", { className: "text-gray-400 leading-relaxed", children: renderInline(trimmed) }, i));
        }) }));
};
function renderInline(text) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return _jsx("strong", { className: "text-cyan-400 font-bold", children: part.slice(2, -2) }, index);
        }
        return part;
    });
}
// Checkpoint Verification Card
const CheckpointVerifier = ({ signal, expected, stepIndex }) => {
    const ioSnapshot = useHardwareStore(s => s.ioSnapshot);
    const capabilities = useHardwareStore(s => s.capabilities);
    const markComplete = useLabStore(s => s.markComplete);
    const [error, setError] = useState(null);
    const handleVerify = () => {
        if (!ioSnapshot || !capabilities) {
            setError("HARDWARE DISCONNECTED");
            return;
        }
        const map = getSignalMap(capabilities.boardId);
        const loc = map[signal];
        if (!loc) {
            setError(`SIGNAL ${signal} NOT MAPPED`);
            return;
        }
        let observed = -1;
        if (loc.group === 'LED') {
            const val = typeof ioSnapshot.outputs.LED === 'number' ? ioSnapshot.outputs.LED : parseInt(String(ioSnapshot.outputs.LED), 2);
            observed = (val >> loc.bit) & 1;
        }
        else if (loc.group === 'SW') {
            const val = typeof ioSnapshot.inputs.SW === 'number' ? ioSnapshot.inputs.SW : parseInt(String(ioSnapshot.inputs.SW), 2);
            observed = (val >> loc.bit) & 1;
        }
        if (observed === expected) {
            markComplete(stepIndex);
            setError(null);
        }
        else {
            setError(`FAIL: EXPECTED ${expected}, OBSERVED ${observed}`);
        }
    };
    return (_jsxs("div", { className: "mt-4", children: [_jsx("button", { type: "button", onClick: handleVerify, className: "w-full py-2 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-400 text-[10px] font-black tracking-widest rounded border border-cyan-500/30 transition-all active:scale-[0.98]", children: "EXECUTE VERIFICATION" }), error && (_jsxs("div", { className: "mt-2 text-[9px] text-red-400 font-mono text-center uppercase tracking-tighter animate-pulse", children: ["\u26A0 ", error] }))] }));
};
// Student Identity Card
const StudentIdentity = () => {
    // Per-field selectors to avoid subscribing to the entire store (prevents render storms).
    const studentName = useLabStore((s) => s.studentName);
    const studentId = useLabStore((s) => s.studentId);
    const setStudentInfo = useLabStore((s) => s.setStudentInfo);
    return (_jsxs("div", { className: "p-4 bg-gray-950/50 border border-[#1a3a4a] rounded-lg mb-6 shadow-inner", children: [_jsx("div", { className: "text-[9px] font-black text-cyan-600 tracking-widest uppercase mb-3", children: "STUDENT IDENTITY" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-[8px] text-gray-500 uppercase font-bold", children: "Lab Member Name" }), _jsx("input", { type: "text", value: studentName, onChange: (e) => setStudentInfo(e.target.value, studentId), className: "bg-black/40 border border-[#1a2a3a] rounded px-2 py-1 text-xs text-cyan-300 outline-none focus:border-cyan-500/50 transition-colors", placeholder: "John Doe" })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-[8px] text-gray-500 uppercase font-bold", children: "University ID / SSN Reference" }), _jsx("input", { type: "text", value: studentId, onChange: (e) => setStudentInfo(studentName, e.target.value), className: "bg-black/40 border border-[#1a2a3a] rounded px-2 py-1 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-500/50 transition-colors", placeholder: "E12345678" })] })] })] }));
};
export const LabInstructions = () => {
    // Per-field selectors to avoid subscribing to the entire store (prevents render storms).
    const activeLabId = useLabStore((s) => s.activeLabId);
    const setActiveLab = useLabStore((s) => s.setActiveLab);
    const currentStepIndex = useLabStore((s) => s.currentStepIndex);
    const completedSteps = useLabStore((s) => s.completedSteps);
    const nextStep = useLabStore((s) => s.nextStep);
    const prevStep = useLabStore((s) => s.prevStep);
    const labs = Object.keys(LABS);
    const rawContent = LABS[activeLabId] || LABS['lab-1'];
    // Normalize content
    const isLabDefinition = !Array.isArray(rawContent);
    const steps = isLabDefinition ? rawContent.steps : rawContent;
    const labTitle = isLabDefinition ? rawContent.title : undefined;
    const step = steps[currentStepIndex];
    if (!step)
        return null;
    const isFirst = currentStepIndex === 0;
    const isLast = currentStepIndex === steps.length - 1;
    const isCompleted = completedSteps.includes(currentStepIndex);
    const handleExport = async () => {
        const ok = await exportEvidenceCapsule(`${activeLabId}-submission`);
        if (!ok)
            alert('Export failed. Check console.');
    };
    return (_jsx(PanelLayout, { className: "bg-[#081018]", header: _jsxs("div", { className: "bg-[#0a1520] border-b border-[#1a2a3a] -m-4 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-[9px] font-black text-gray-600 tracking-widest", children: "MODULE" }), _jsx("select", { value: activeLabId, onChange: (e) => setActiveLab(e.target.value), "aria-label": "Select lab module", className: "bg-transparent text-xs font-bold text-cyan-400 border-none outline-none cursor-pointer uppercase tracking-wider", children: labs.map(id => (_jsx("option", { value: id, className: "bg-[#0a1520]", children: id.replace('-', ' ') }, id))) })] }), _jsxs("div", { className: "text-[9px] font-mono text-gray-500", children: ["STEP ", _jsx("span", { className: "text-white", children: currentStepIndex + 1 }), " / ", steps.length] })] }), _jsx("div", { className: "w-full bg-[#05080a] h-1 rounded-full overflow-hidden border border-[#1a2a3a]/30", children: _jsx("div", { className: "bg-cyan-500 h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,255,255,0.5)]", style: { width: `${((currentStepIndex + 1) / steps.length) * 100}%` } }) })] }), children: _jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "flex-1", children: [isFirst && _jsx(StudentIdentity, {}), isFirst && _jsx(StudentIdentity, {}), isFirst && isLabDefinition && (_jsxs("div", { className: "mb-6 pb-4 border-b border-cyan-900/30", children: [_jsx("h1", { className: "text-lg font-black text-white uppercase tracking-widest", children: labTitle }), rawContent.objectives && (_jsx("ul", { className: "mt-4 space-y-2", children: rawContent.objectives.map((obj, i) => (_jsxs("li", { className: "flex gap-2 text-xs text-gray-300", children: [_jsx("span", { className: "text-cyan-500", children: "\u203A" }), obj] }, i))) }))] })), _jsxs("div", { className: "mb-4", children: [_jsx("h2", { className: "text-lg font-bold text-white mb-2", children: step.title }), step.description && !step.markdown && (_jsx("p", { className: "text-sm text-gray-400 mb-4", children: step.description }))] }), _jsx(SimpleMarkdown, { content: step.markdown }), step.checklist && (_jsxs("div", { className: "mt-6 space-y-3 bg-black/20 p-4 rounded border border-white/5", children: [_jsx("div", { className: "text-[10px] uppercase tracking-widest text-cyan-500 font-bold mb-2", children: "Requirement Checklist" }), step.checklist.map((item, i) => (_jsxs("div", { className: "flex gap-3 text-xs text-gray-300", children: [_jsx("div", { className: "w-4 h-4 rounded border border-gray-600 flex-shrink-0" }), _jsx("span", { children: item })] }, i)))] })), step.checkpoint && (_jsxs("div", { className: `mt-10 p-5 rounded-lg border transition-all duration-300 ${isCompleted
                                ? 'border-green-500/30 bg-green-500/5 shadow-[0_0_20px_rgba(0,255,100,0.05)]'
                                : 'border-cyan-500/30 bg-cyan-500/5'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("span", { className: `text-[9px] font-black tracking-widest uppercase ${isCompleted ? 'text-green-400' : 'text-cyan-500'}`, children: ["Checkpoint: ", isCompleted ? 'VERIFIED' : 'PENDING'] }), isCompleted && _jsx("span", { className: "text-green-500 text-xs", children: "\u2713" })] }), _jsxs("div", { className: "text-sm text-gray-300 leading-relaxed mb-4 italic", children: ["\"", step.checkpoint.description, "\""] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 mb-4", children: [_jsxs("div", { className: "p-2 bg-black/30 rounded border border-[#1a2a3a] text-center", children: [_jsx("div", { className: "text-[8px] text-gray-600 uppercase font-bold mb-1", children: "Target Signal" }), _jsx("div", { className: "text-xs font-mono text-cyan-400", children: step.checkpoint.signal })] }), _jsxs("div", { className: "p-2 bg-black/30 rounded border border-[#1a2a3a] text-center", children: [_jsx("div", { className: "text-[8px] text-gray-600 uppercase font-bold mb-1", children: "Expected State" }), _jsx("div", { className: "text-xs font-mono text-white", children: step.checkpoint.expectedValue === 1 ? 'HIGH (1)' : 'LOW (0)' })] })] }), !isCompleted && (_jsx(CheckpointVerifier, { signal: step.checkpoint.signal, expected: step.checkpoint.expectedValue, stepIndex: currentStepIndex }))] })), step.id === 'completion' && (_jsxs("div", { className: "mt-10 p-8 bg-cyan-950/10 border-2 border-dashed border-cyan-500/20 rounded-2xl text-center space-y-6", children: [_jsxs("div", { children: [_jsx("div", { className: "text-3xl mb-2 opacity-50", children: "\uD83C\uDFC6" }), _jsx("h3", { className: "text-lg font-black text-white tracking-widest uppercase", children: "LAB COMPLETE" }), _jsx("p", { className: "text-xs text-gray-500 max-w-[240px] mx-auto leading-relaxed", children: "All objectives verified. Generate your cryptographic evidence capsule for submission." })] }), _jsx("button", { type: "button", onClick: handleExport, className: "px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs tracking-widest rounded-lg shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all active:scale-95", children: "EXPORT EVIDENCE CAPSULE" })] }))] }), _jsxs("div", { className: "sticky bottom-0 bg-[#0a1520] border-t border-[#1a2a3a] flex items-center justify-between mt-auto pt-4 shadow-lg -mx-6 -mb-6 px-6 pb-6", children: [_jsx("button", { type: "button", onClick: prevStep, disabled: isFirst, className: `text-[9px] font-black tracking-widest uppercase transition-all ${isFirst ? 'text-gray-700 opacity-30' : 'text-gray-500 hover:text-white'}`, children: "\u2190 PREVIOUS" }), _jsx("div", { className: "flex gap-1", children: steps.map((_, idx) => (_jsx("div", { className: `w-1 h-1 rounded-full transition-all duration-300 ${idx === currentStepIndex ? 'w-4 bg-cyan-400' : (completedSteps.includes(idx) ? 'bg-green-600' : 'bg-gray-800')}` }, idx))) }), _jsx("button", { type: "button", onClick: nextStep, disabled: isLast, className: `text-[9px] font-black tracking-widest uppercase transition-all ${isLast ? 'text-gray-700 opacity-0' : 'text-cyan-500 hover:text-cyan-300'}`, children: "NEXT \u2192" })] })] }) }));
};
