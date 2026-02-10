import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useLabStore } from '../store/labStore';
export const ValidationPanel = () => {
    const doc = useLabStore((s) => s.doc);
    const validation = doc.results?.validation;
    if (!validation) {
        return null;
    }
    const { allErrors, canAdvance, message } = validation;
    const hasErrors = allErrors.some(e => e.severity === 'error');
    const blockingErrors = allErrors.filter(e => e.severity === 'error');
    const warnings = allErrors.filter(e => e.severity === 'warning');
    const infos = allErrors.filter(e => e.severity === 'info');
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: `border-l-4 rounded-lg p-4 flex items-start gap-3 ${hasErrors
                    ? 'bg-red-950/50 border-red-500/50'
                    : !canAdvance
                        ? 'bg-amber-950/50 border-amber-500/50'
                        : 'bg-emerald-950/50 border-emerald-500/50'}`, children: [_jsx("div", { className: "flex-shrink-0 mt-0.5", children: hasErrors ? (_jsx(AlertCircle, { className: "w-5 h-5 text-red-400" })) : canAdvance ? (_jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-400" })) : (_jsx(AlertTriangle, { className: "w-5 h-5 text-amber-400" })) }), _jsx("p", { className: `font-digital font-medium ${hasErrors ? 'text-red-300' : canAdvance ? 'text-emerald-300' : 'text-amber-300'}`, children: message })] }), allErrors.length > 0 && (_jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto", children: [blockingErrors.length > 0 && (_jsxs("details", { open: true, children: [_jsxs("summary", { className: "cursor-pointer font-tech font-semibold text-red-400 flex items-center gap-2 mb-2", children: [_jsx(AlertCircle, { size: 16 }), "Errors (", blockingErrors.length, ")"] }), _jsx("div", { className: "space-y-2 ml-6 pl-4 border-l border-red-500/30", children: blockingErrors.map((err, i) => (_jsx(ErrorItem, { error: err }, i))) })] })), warnings.length > 0 && (_jsxs("details", { children: [_jsxs("summary", { className: "cursor-pointer font-tech font-semibold text-amber-400 flex items-center gap-2 mb-2", children: [_jsx(AlertTriangle, { size: 16 }), "Warnings (", warnings.length, ")"] }), _jsx("div", { className: "space-y-2 ml-6 pl-4 border-l border-amber-500/30", children: warnings.map((err, i) => (_jsx(ErrorItem, { error: err }, i))) })] })), infos.length > 0 && (_jsxs("details", { children: [_jsxs("summary", { className: "cursor-pointer font-tech font-semibold text-cyan-400 flex items-center gap-2 mb-2", children: [_jsx(Info, { size: 16 }), "Info (", infos.length, ")"] }), _jsx("div", { className: "space-y-2 ml-6 pl-4 border-l border-cyan-500/30", children: infos.map((err, i) => (_jsx(ErrorItem, { error: err }, i))) })] }))] })), hasErrors && (_jsxs("div", { className: "bg-red-950/20 border border-red-500/30 rounded-lg p-4", children: [_jsxs("h4", { className: "font-tech font-semibold text-red-300 mb-2 flex items-center gap-2", children: [_jsx(AlertCircle, { size: 16 }), "How to Fix"] }), _jsxs("ul", { className: "space-y-1 list-disc list-inside font-digital text-sm text-red-200/80", children: [_jsx("li", { children: "Review errors above and fix each mismatch" }), _jsx("li", { children: "Start with the Truth Table \u2014 make sure digits 0-9 are correct" }), _jsx("li", { children: "Then create K-map groupings for each segment" }), _jsx("li", { children: "Finally, verify expressions match your groupings" })] })] })), _jsx("div", { className: "bg-slate-800/50 border border-slate-700 rounded-lg p-3", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx("div", { className: `w-3 h-3 rounded-full mt-1 flex-shrink-0 ${canAdvance ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}` }), _jsx("p", { className: "font-digital text-sm", children: canAdvance
                                ? '✅ You can advance to the next step!'
                                : '❌ Fix blocking errors before you can advance' })] }) })] }));
};
const ErrorItem = ({ error }) => {
    const severityColor = {
        error: 'text-red-300',
        warning: 'text-amber-300',
        info: 'text-cyan-300',
    }[error.severity];
    const severityBg = {
        error: 'bg-red-950/30',
        warning: 'bg-amber-950/30',
        info: 'bg-cyan-950/30',
    }[error.severity];
    return (_jsxs("div", { className: `${severityBg} rounded p-2 space-y-1`, children: [_jsxs("p", { className: `font-digital font-medium ${severityColor} text-sm`, children: [error.segment && `[${error.segment.toUpperCase()}]`, " ", error.message] }), error.guidance && (_jsxs("p", { className: "font-digital text-xs text-slate-400 italic pl-2 border-l border-slate-600", children: ["\uD83D\uDCA1 ", error.guidance] }))] }));
};
