import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
export const ProgressTracker = ({ steps, activeStepId, nextStepId, onStepClick, className = '' }) => {
    const totalRequired = steps.filter((step) => !step.optional).length || 1;
    const completedRequired = steps.filter((step) => !step.optional && step.status === 'complete').length;
    return (_jsxs("div", { className: `bg-slate-900/50 border border-slate-700 rounded-xl p-6 ${className}`, children: [_jsxs("h3", { className: "font-tech-display text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-cyan-400 animate-pulse" }), "Lab Progress"] }), _jsx("div", { className: "space-y-3", children: steps.map((step, idx) => {
                    const isLast = idx === steps.length - 1;
                    const isActive = activeStepId === step.id;
                    const isNext = nextStepId === step.id;
                    const isClickable = !!onStepClick && !!step.tabId;
                    return (_jsxs("div", { className: "relative", children: [_jsxs("button", { type: "button", onClick: isClickable ? () => onStepClick?.(step) : undefined, className: `w-full text-left flex items-start gap-3 rounded-lg px-2 py-1 transition-all duration-200 ${isClickable ? 'hover:bg-slate-800/60' : ''} ${isActive ? 'bg-slate-800/70 ring-1 ring-cyan-500/40' : ''} ${isNext ? 'ring-1 ring-emerald-400/50 pulse-active' : ''}`, children: [_jsxs("div", { className: "flex-shrink-0 mt-0.5", children: [step.status === 'complete' && (_jsx(CheckCircle2, { size: 20, className: "text-emerald-400" })), step.status === 'in-progress' && (_jsx(Circle, { size: 20, className: "text-cyan-400 animate-pulse" })), step.status === 'incomplete' && (_jsx(Circle, { size: 20, className: "text-slate-600" })), step.status === 'error' && (_jsx(AlertCircle, { size: 20, className: "text-red-400" }))] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: `font-tech font-semibold text-sm ${step.status === 'complete' ? 'text-emerald-400' :
                                                    step.status === 'in-progress' ? 'text-cyan-400' :
                                                        step.status === 'error' ? 'text-red-400' :
                                                            'text-slate-500'}`, children: [step.label, step.optional && (_jsx("span", { className: "ml-2 text-[10px] text-slate-500 font-digital", children: "optional" }))] }), step.description && (_jsx("div", { className: "font-digital text-xs text-slate-500 mt-1", children: step.description }))] }), step.status === 'complete' && (_jsx("span", { className: "px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-digital rounded-full border border-emerald-500/30", children: "\u2713" })), step.status === 'in-progress' && (_jsx("span", { className: "px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-digital rounded-full border border-cyan-500/30 pulse-active", children: "\u25CF" }))] }), !isLast && (_jsx("div", { className: `ml-2.5 mt-1 w-0.5 h-6 ${step.status === 'complete' ? 'bg-emerald-400/30' : 'bg-slate-700'}` }))] }, step.id));
                }) }), _jsxs("div", { className: "mt-6 pt-4 border-t border-slate-700", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("span", { className: "font-digital text-xs text-slate-400", children: "Overall Progress" }), _jsxs("span", { className: "font-tech text-sm font-bold text-cyan-400", children: [Math.round((completedRequired / totalRequired) * 100), "%"] })] }), _jsx("div", { className: "w-full h-2 bg-slate-800 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500 glow-box-cyan", style: {
                                width: `${(completedRequired / totalRequired) * 100}%`
                            } }) })] })] }));
};
export function buildProgressSteps({ truthTable, kMaps, validationResults, verilogCode, lastExportAt, }) {
    const truthTableFilled = truthTable
        .slice(0, 10)
        .every(row => row.seg.some(s => s === 0));
    const kMapsGenerated = Object.keys(kMaps).length > 0;
    const requiredResults = validationResults.filter((r) => r.input < 10);
    const hasValidation = requiredResults.length > 0;
    const failedRequired = requiredResults.filter((r) => !r.pass);
    const validationStatus = hasValidation
        ? failedRequired.length > 0
            ? 'error'
            : 'complete'
        : kMapsGenerated
            ? 'in-progress'
            : 'incomplete';
    const verilogExported = verilogCode.length > 50;
    const exportComplete = !!lastExportAt;
    const steps = [
        {
            id: 'truth-table',
            label: 'Defined Truth Table (0-9)',
            status: truthTableFilled ? 'complete' : 'incomplete',
            description: truthTableFilled ? 'All standard digits filled' : 'Fill patterns for digits 0-9',
            tabId: 'table',
        },
        {
            id: 'kmaps',
            label: 'Derived K-Maps',
            status: kMapsGenerated ? 'complete' : truthTableFilled ? 'in-progress' : 'incomplete',
            description: kMapsGenerated ? 'Expressions generated' : 'Generate K-maps from truth table',
            tabId: 'kmaps',
        },
        {
            id: 'validation',
            label: 'Validated Vectors',
            status: validationStatus,
            description: hasValidation
                ? failedRequired.length > 0
                    ? `${failedRequired.length} vector${failedRequired.length === 1 ? '' : 's'} failed`
                    : 'All required vectors correct'
                : 'Run validation in simulator',
            tabId: 'simulator',
        },
        {
            id: 'verilog',
            label: 'Generated Verilog',
            status: verilogExported ? 'complete' : validationStatus === 'complete' ? 'in-progress' : 'incomplete',
            description: verilogExported ? 'Verilog ready to export' : 'Generate expressions or Verilog',
            tabId: 'verilog',
        },
        {
            id: 'export',
            label: 'Exported Circuit',
            status: exportComplete ? 'complete' : 'incomplete',
            description: exportComplete ? 'Export complete' : 'Optional export step',
            tabId: 'export',
            optional: true,
        },
    ];
    const nextStep = steps.find((step) => !step.optional && step.status === 'error')
        ?? steps.find((step) => !step.optional && step.status === 'incomplete')
        ?? steps.find((step) => !step.optional && step.status === 'in-progress');
    return { steps, nextStepId: nextStep?.id };
}
// Hook to calculate progress
export function useLabProgress() {
    const truthTable = useLabStore((s) => s.doc.truthTable);
    const kMaps = useLabStore((s) => s.doc.kMaps);
    const validationResults = useLabStore((s) => s.validationResults);
    const verilogCode = useLabStore((s) => s.verilogCode);
    const lastExportAt = useLabStore((s) => s.lastExportAt);
    return buildProgressSteps({ truthTable, kMaps, validationResults, verilogCode, lastExportAt });
}
import { useLabStore } from './store/labStore';
