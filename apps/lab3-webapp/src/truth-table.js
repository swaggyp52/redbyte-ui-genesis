import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { useLabStore } from './store';
import { SegmentDisplayEnhanced } from './basys-board';
import { Zap, Info } from 'lucide-react';
import useNewLabStore from './store/labStore';
export const TruthTableEditor = () => {
    const truthTable = useLabStore((s) => s.truthTable);
    const setTableRow = useLabStore((s) => s.setTableRow);
    const toggleDontCare = useLabStore((s) => s.toggleDontCare);
    const fillStandardDigits = useLabStore((s) => s.fillStandardDigits);
    const emitEvent = useNewLabStore((s) => s.emitEvent);
    const [selectedRow, setSelectedRow] = React.useState(0);
    const selectedSeg = truthTable[selectedRow]?.seg || [1, 1, 1, 1, 1, 1, 1];
    const toggleSegment = (segIndex) => {
        const row = truthTable[selectedRow];
        const newSeg = [...row.seg];
        newSeg[segIndex] = newSeg[segIndex] === 0 ? 1 : 0;
        setTableRow(selectedRow, { seg: newSeg });
        // Emit truthTable.updated event
        const segLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        emitEvent('truthTable.updated', {
            row: selectedRow,
            cell: segLetters[segIndex],
            value: newSeg[segIndex],
        });
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2", children: "Truth Table Editor" }), _jsx("p", { className: "font-digital text-sm text-slate-400", children: "Define segment patterns for each 4-bit input (0-15)" })] }), _jsxs("button", { onClick: fillStandardDigits, className: "px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-tech font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 glow-box-emerald group", children: [_jsx(Zap, { size: 18, className: "group-hover:animate-pulse" }), "Auto-Fill (0-9)"] })] }), _jsxs("div", { className: "bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3", children: [_jsx(Info, { size: 20, className: "text-cyan-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { className: "font-digital text-sm text-cyan-300", children: [_jsx("strong", { children: "Active-Low Logic:" }), " Segments light when set to ", _jsx("code", { className: "bg-slate-800 px-1 py-0.5 rounded", children: "0" }), ". Use \"Auto-Fill\" to populate standard digit patterns (0-9), then customize as needed."] })] })] }), _jsxs("div", { className: "grid lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: [_jsxs("h3", { className: "font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" }), "Select Input (0-15)"] }), _jsx("div", { className: "grid grid-cols-4 gap-2 mb-6", children: truthTable.map((row, i) => (_jsx("button", { onClick: () => setSelectedRow(i), className: `py-3 px-4 rounded-lg font-tech-display font-bold text-lg transition-all duration-200 ${selectedRow === i
                                        ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white glow-box-cyan shadow-lg scale-105'
                                        : row.seg.some(s => s === 0)
                                            ? 'bg-slate-800 text-emerald-400 hover:bg-slate-750 border border-emerald-500/30'
                                            : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`, title: `Input ${i}: ${row.b3}${row.b2}${row.b1}${row.b0}`, children: i }, i))) }), _jsxs("label", { className: "flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors", children: [_jsx("input", { type: "checkbox", checked: truthTable[selectedRow]?.isDontCare || false, onChange: () => toggleDontCare(selectedRow), className: "w-5 h-5 rounded accent-amber-500" }), _jsxs("div", { className: "flex-1", children: [_jsx("span", { className: "font-tech font-semibold text-amber-400", children: "Don't Care State" }), _jsx("p", { className: "font-digital text-xs text-slate-500 mt-1", children: "Mark unused inputs (10-15) as don't-care for simplification" })] })] }), _jsxs("div", { className: "mt-6 p-4 bg-slate-950/50 rounded-lg border border-slate-700", children: [_jsx("div", { className: "font-digital text-xs text-slate-400 mb-2", children: "Current Input:" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "font-tech-display text-3xl font-bold text-cyan-400 neon-cyan", children: selectedRow }), _jsxs("span", { className: "font-digital text-slate-500", children: ["= ", truthTable[selectedRow]?.b3, truthTable[selectedRow]?.b2, truthTable[selectedRow]?.b1, truthTable[selectedRow]?.b0] })] })] })] }), _jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: [_jsxs("h3", { className: "font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" }), "Segment Pattern"] }), _jsx("div", { className: "flex justify-center mb-6 p-6 bg-slate-950/50 rounded-lg", children: _jsx(SegmentDisplayEnhanced, { segments: selectedSeg, size: "large" }) }), _jsx("div", { className: "grid grid-cols-7 gap-2 mb-4", children: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((seg, i) => (_jsxs("button", { onClick: () => toggleSegment(i), className: `py-6 rounded-lg font-tech-display font-bold transition-all duration-200 ${selectedSeg[i] === 0
                                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white glow-box-emerald shadow-lg'
                                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700 border border-slate-600'}`, title: `Toggle segment ${seg.toUpperCase()} (${selectedSeg[i] === 0 ? 'ON' : 'OFF'})`, children: [_jsx("div", { className: "text-xl", children: seg }), _jsx("div", { className: "text-xs mt-1 opacity-75", children: selectedSeg[i] === 0 ? '0' : '1' })] }, seg))) }), _jsxs("div", { className: "p-4 bg-slate-950/50 rounded-lg border border-slate-700", children: [_jsx("div", { className: "font-digital text-xs text-slate-400 mb-2", children: "Active-Low Binary:" }), _jsx("code", { className: "font-digital text-emerald-400 text-lg", children: selectedSeg.map(s => s === 0 ? '0' : '1').join('') })] })] })] })] }));
};
