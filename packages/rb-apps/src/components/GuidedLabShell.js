import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';
import { useCapabilitiesStore } from '../stores/capabilitiesStore';
const STEPS = [
    { id: 'selection', label: '1. Identity' },
    { id: 'specification', label: '2. Specification' },
    { id: 'design', label: '3. Design' },
    { id: 'simulation', label: '4. Simulation' },
    { id: 'hardware', label: '5. Hardware' },
    { id: 'verification', label: '6. Verification' },
    { id: 'report', label: '7. Export' },
];
export const GuidedLabShell = ({ children }) => {
    const { currentStep, completedSteps, setStep, getMaxUnlockedStepIndex } = useLabWorkflowStore();
    const maxUnlockedIndex = getMaxUnlockedStepIndex();
    const bridgeOnline = useCapabilitiesStore(state => state.hardware.bridgeOnline);
    return (_jsxs("div", { className: "flex flex-col lg:flex-row h-full w-full bg-slate-950 text-slate-100 font-sans overflow-hidden", children: [_jsxs("aside", { className: "w-full lg:w-64 border-b lg:border-r border-slate-800 bg-slate-900/50 backdrop-blur-md flex flex-col p-4 z-10 shrink-0", children: [_jsxs("div", { className: "mb-4 lg:mb-8 px-2 flex justify-between items-center lg:block", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg lg:text-xl font-bold tracking-tight text-white leading-tight", children: "Lab Workflow" }), _jsx("p", { className: "text-[10px] text-slate-400 mt-0.5 lg:mt-1 uppercase tracking-wider font-bold", children: "Step Status" })] }), _jsx("div", { className: "lg:hidden flex items-center gap-1", children: STEPS.map(s => (_jsx("div", { className: `w-1.5 h-1.5 rounded-full ${completedSteps.includes(s.id) ? 'bg-indigo-500' : currentStep === s.id ? 'bg-white' : 'bg-slate-700'}` }, s.id))) })] }), _jsx("nav", { className: "flex lg:flex-col overflow-x-auto lg:overflow-x-visible no-scrollbar space-x-2 lg:space-x-0 lg:space-y-1 pb-2 lg:pb-0", children: STEPS.map((step, index) => {
                            const isActive = currentStep === step.id;
                            const isCompleted = completedSteps.includes(step.id);
                            const isDisabled = index > maxUnlockedIndex;
                            return (_jsxs("button", { onClick: () => !isDisabled && setStep(step.id), disabled: isDisabled, className: `flex-shrink-0 lg:w-full flex items-center gap-3 px-3 py-2 lg:py-2.5 rounded-lg text-sm font-medium transition-all
                                  ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : ''}
                                  ${!isActive && isCompleted ? 'text-indigo-400 hover:bg-slate-800' : ''}
                                  ${isDisabled ? 'text-slate-600 cursor-not-allowed opacity-50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                                `, children: [_jsx("div", { className: `hidden lg:block w-2 h-2 rounded-full ${isActive ? 'bg-white' : isCompleted ? 'bg-indigo-500' : 'bg-slate-700'}` }), _jsx("span", { className: "whitespace-nowrap", children: step.label })] }, step.id));
                        }) }), _jsxs("div", { className: "hidden lg:block mt-auto p-4 bg-slate-800/40 rounded-xl border border-slate-700/30", children: [_jsx("p", { className: "text-[10px] uppercase font-black text-slate-500 mb-2 tracking-tighter", children: "Session Context" }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-bold truncate", children: "Logic Lab Beta" }), _jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" })] })] })] }), _jsxs("main", { className: "flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950", children: [_jsxs("header", { className: "h-14 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6 bg-slate-900/20 backdrop-blur-sm", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "hidden sm:inline text-[9px] font-mono text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded", children: "ID: 0x8F2" }), _jsx("div", { className: "hidden sm:block h-4 w-px bg-slate-800" }), _jsxs("span", { className: "text-xs font-bold text-slate-300", children: ["Step ", STEPS.findIndex(s => s.id === currentStep) + 1, " of ", STEPS.length] })] }), _jsx("div", { className: "flex items-center gap-2", children: bridgeOnline ? (_jsxs("div", { className: "flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" }), _jsx("span", { className: "text-[10px] font-black text-green-500 uppercase tracking-tighter", children: "Bridge Online" })] })) : (_jsxs("div", { className: "flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-red-500" }), _jsx("span", { className: "text-[10px] font-black text-red-500 uppercase tracking-tighter", children: "Bridge Offline" })] })) })] }), _jsx("div", { className: "flex-1 overflow-auto custom-scrollbar", children: _jsx("div", { className: "p-4 lg:p-8 min-h-full", children: children }) })] })] }));
};
