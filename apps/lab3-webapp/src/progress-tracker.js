import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
export const ProgressTracker = ({ steps, className = '' }) => {
    return (_jsxs("div", { className: `bg-slate-900/50 border border-slate-700 rounded-xl p-6 ${className}`, children: [_jsxs("h3", { className: "font-tech-display text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-cyan-400 animate-pulse" }), "Lab Progress"] }), _jsx("div", { className: "space-y-3", children: steps.map((step, idx) => {
                    const isLast = idx === steps.length - 1;
                    return (_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsxs("div", { className: "flex-shrink-0 mt-0.5", children: [step.status === 'complete' && (_jsx(CheckCircle2, { size: 20, className: "text-emerald-400" })), step.status === 'in-progress' && (_jsx(Circle, { size: 20, className: "text-cyan-400 animate-pulse" })), step.status === 'incomplete' && (_jsx(Circle, { size: 20, className: "text-slate-600" })), step.status === 'error' && (_jsx(AlertCircle, { size: 20, className: "text-red-400" }))] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: `font-tech font-semibold text-sm ${step.status === 'complete' ? 'text-emerald-400' :
                                                    step.status === 'in-progress' ? 'text-cyan-400' :
                                                        step.status === 'error' ? 'text-red-400' :
                                                            'text-slate-500'}`, children: step.label }), step.description && (_jsx("div", { className: "font-digital text-xs text-slate-500 mt-1", children: step.description }))] }), step.status === 'complete' && (_jsx("span", { className: "px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-digital rounded-full border border-emerald-500/30", children: "\u2713" })), step.status === 'in-progress' && (_jsx("span", { className: "px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-digital rounded-full border border-cyan-500/30 pulse-active", children: "\u25CF" }))] }), !isLast && (_jsx("div", { className: `ml-2.5 mt-1 w-0.5 h-6 ${step.status === 'complete' ? 'bg-emerald-400/30' : 'bg-slate-700'}` }))] }, step.id));
                }) }), _jsxs("div", { className: "mt-6 pt-4 border-t border-slate-700", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("span", { className: "font-digital text-xs text-slate-400", children: "Overall Progress" }), _jsxs("span", { className: "font-tech text-sm font-bold text-cyan-400", children: [Math.round((steps.filter(s => s.status === 'complete').length / steps.length) * 100), "%"] })] }), _jsx("div", { className: "w-full h-2 bg-slate-800 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500 glow-box-cyan", style: {
                                width: `${(steps.filter(s => s.status === 'complete').length / steps.length) * 100}%`
                            } }) })] })] }));
};
// Hook to calculate progress
export function useLabProgress() {
    const truthTable = useLabStore((s) => s.truthTable);
    const kMaps = useLabStore((s) => s.kMaps);
    const validationResults = useLabStore((s) => s.validationResults);
    const verilogCode = useLabStore((s) => s.verilogCode);
    // Check if truth table is filled (at least 0-9)
    const truthTableFilled = truthTable
        .slice(0, 10)
        .every(row => row.seg.some(s => s === 0));
    // Check if K-maps exist
    const kMapsGenerated = Object.keys(kMaps).length > 0;
    // Check if simulation passed
    const simulationPassed = validationResults.length > 0 &&
        validationResults.filter(r => r.pass).length >= 10; // At least digits 0-9 correct
    // Check if Verilog exported
    const verilogExported = verilogCode.length > 50;
    const steps = [
        {
            id: 'truth-table',
            label: 'Truth Table',
            status: truthTableFilled ? 'complete' : 'incomplete',
            description: truthTableFilled ? 'All standard digits filled' : 'Fill patterns for digits 0-9',
        },
        {
            id: 'kmaps',
            label: 'K-Maps & Simplification',
            status: kMapsGenerated ? 'complete' : truthTableFilled ? 'in-progress' : 'incomplete',
            description: kMapsGenerated ? 'Boolean expressions generated' : 'Generate K-maps from truth table',
        },
        {
            id: 'simulation',
            label: 'Simulation & Validation',
            status: simulationPassed ? 'complete' : kMapsGenerated ? 'in-progress' : 'incomplete',
            description: simulationPassed ? `All tests passing` : 'Test all 16 input combinations',
        },
        {
            id: 'export',
            label: 'Export & Documentation',
            status: verilogExported ? 'complete' : simulationPassed ? 'in-progress' : 'incomplete',
            description: verilogExported ? 'Ready for Vivado' : 'Generate Verilog and PDF report',
        },
    ];
    return steps;
}
// Import useLabStore at top of file
import { useLabStore } from './store';
