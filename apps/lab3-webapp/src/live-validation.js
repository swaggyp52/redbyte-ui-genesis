import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLabStore } from './store';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
export const LiveValidation = () => {
    const validationErrors = useLabStore((s) => s.validationErrors);
    const booleanExpressions = useLabStore((s) => s.booleanExpressions);
    const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const hasErrors = Object.keys(validationErrors).length > 0;
    return (_jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-xl font-bold text-pink-400", children: "Live Expression Validation" }), hasErrors ? (_jsxs("div", { className: "flex items-center gap-2 text-pink-400", children: [_jsx(AlertCircle, { size: 20 }), _jsx("span", { className: "text-sm font-semibold", children: "Mismatches Found" })] })) : (_jsxs("div", { className: "flex items-center gap-2 text-emerald-400", children: [_jsx(CheckCircle2, { size: 20 }), _jsx("span", { className: "text-sm font-semibold", children: "All Valid" })] }))] }), _jsx("div", { className: "grid grid-cols-7 gap-2", children: SEGMENT_NAMES.map((segName) => {
                    const errors = validationErrors[segName] || [];
                    const expr = booleanExpressions[segName];
                    const hasError = errors.length > 0;
                    return (_jsxs("div", { className: `rounded border-2 p-3 transition-all ${hasError
                            ? 'bg-pink-900/20 border-pink-600 shadow-lg shadow-pink-600/50'
                            : 'bg-slate-700 border-emerald-600'}`, children: [_jsxs("div", { className: "text-center mb-2", children: [_jsx("div", { className: "text-2xl font-bold", children: segName.toUpperCase() }), _jsx("div", { className: `text-xs ${hasError ? 'text-pink-300' : 'text-emerald-300'}`, children: hasError ? '✗' : '✓' })] }), hasError && (_jsxs("div", { className: "text-xs text-pink-200 space-y-1 mt-2 border-t border-pink-700 pt-2 max-h-24 overflow-y-auto", children: [errors.slice(0, 3).map((err, idx) => (_jsx("div", { className: "font-mono text-pink-100", children: err }, idx))), errors.length > 3 && (_jsxs("div", { className: "text-pink-300 mt-1", children: ["+", errors.length - 3, " more"] }))] }))] }, segName));
                }) }), hasErrors && (_jsxs("div", { className: "bg-pink-900/20 border border-pink-700 rounded p-3 text-sm text-pink-200", children: [_jsx("p", { className: "font-semibold mb-1", children: "Validation Issues:" }), _jsx("p", { className: "text-xs text-pink-100", children: "Your boolean expressions don't match the truth table for inputs 0\u20139. Check the highlighted segments and update your expressions. These issues block you from exporting to Verilog until resolved." })] }))] }));
};
