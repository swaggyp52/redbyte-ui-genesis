import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BookOpen } from 'lucide-react';
import useLabStore from '../store/labStore';
/**
 * OverviewView: Main Lab 3 overview and instructions
 */
export const OverviewView = () => {
    const doc = useLabStore((s) => s.doc);
    const setDoc = useLabStore((s) => s.setDoc);
    const handleTogglePro = () => {
        const docV2 = doc;
        const newUseProByDefault = !(docV2.meta?.useProByDefault ?? false);
        setDoc({
            ...docV2,
            meta: {
                ...docV2.meta,
                useProByDefault: newUseProByDefault,
            },
        });
    };
    const useProByDefault = doc.meta?.useProByDefault ?? false;
    return (_jsxs("div", { className: "space-y-4 p-4 overflow-y-auto h-full", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(BookOpen, { size: 24, className: "text-cyan-400" }), _jsx("h2", { className: "text-2xl font-bold text-cyan-300", children: "Lab 3: Seven-Segment Display Driver" })] }), _jsx("p", { className: "text-slate-300 leading-relaxed", children: "Design a 4-bit to 7-segment display decoder for digits 0\u20139 using active-low logic." }), _jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "font-tech font-bold text-emerald-400", children: "Objectives" }), _jsxs("ul", { className: "text-slate-300 text-sm space-y-1 ml-4", children: [_jsx("li", { children: "\u2713 Build and optimize a truth table" }), _jsx("li", { children: "\u2713 Derive Boolean expressions using K-maps" }), _jsx("li", { children: "\u2713 Simulate and validate your design" }), _jsx("li", { children: "\u2713 Export to Verilog or PDF" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "font-tech font-bold text-emerald-400", children: "Seven-Segment Display" }), _jsxs("div", { className: "bg-slate-700/30 border border-slate-600/50 rounded p-3 font-mono text-xs space-y-1 text-slate-300", children: [_jsx("div", { children: "seg[0] = 'a' (top)" }), _jsx("div", { children: "seg[1] = 'b' (top-right)" }), _jsx("div", { children: "seg[2] = 'c' (bottom-right)" }), _jsx("div", { children: "seg[3] = 'd' (bottom)" }), _jsx("div", { children: "seg[4] = 'e' (bottom-left)" }), _jsx("div", { children: "seg[5] = 'f' (top-left)" }), _jsx("div", { children: "seg[6] = 'g' (middle)" }), _jsx("div", { className: "pt-2", children: "Active-low: 0=lit, 1=off" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "font-tech font-bold text-emerald-400", children: "Circuit Designer" }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800/50 transition", children: [_jsx("input", { type: "checkbox", checked: useProByDefault, onChange: handleTogglePro, className: "w-4 h-4 cursor-pointer" }), _jsx("span", { className: "text-sm text-slate-300", children: "Use Circuit Designer (Pro) by default" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "font-tech font-bold text-emerald-400", children: "Windows" }), _jsx("p", { className: "text-center text-slate-400 text-sm", children: "Use the draggable windows in the workspace to navigate and edit." })] })] }));
};
