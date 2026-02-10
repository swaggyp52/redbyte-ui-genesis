import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useLabStore } from './store/labStore';
import { ChevronDown } from 'lucide-react';
const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const GRAY_CODE_LABELS = {
    rows: ['00', '01', '11', '10'], // B3B2
    cols: ['00', '01', '11', '10'], // B1B0
};
function getPositionToGrayCode(row, col) {
    return `${GRAY_CODE_LABELS.rows[row]}${GRAY_CODE_LABELS.cols[col]}`;
}
export const KMapViewer = () => {
    const [expandedSegment, setExpandedSegment] = useState('a');
    const kMaps = useLabStore((s) => s.doc.kMaps);
    const setBooleanExpr = useLabStore((s) => s.setBooleanExpr);
    const booleanExpressions = useLabStore((s) => s.doc.expressions);
    return (_jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6 space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsx("h3", { className: "text-xl font-bold text-emerald-400", children: "Karnaugh Maps" }) }), _jsx("div", { className: "space-y-3", children: SEGMENT_NAMES.map((segName) => (_jsx(KMapSegment, { segmentName: segName, isExpanded: expandedSegment === segName, onToggle: () => setExpandedSegment(expandedSegment === segName ? '' : segName), kmap: kMaps[segName], expr: booleanExpressions[segName], onExprChange: (newExpr) => setBooleanExpr(segName, newExpr) }, segName))) })] }));
};
const KMapSegment = ({ segmentName, isExpanded, onToggle, kmap, expr, onExprChange }) => {
    return (_jsxs("div", { className: "bg-slate-800 rounded border border-slate-700 overflow-hidden", children: [_jsxs("button", { onClick: onToggle, className: "w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors font-semibold", children: [_jsxs("span", { className: "text-lg", children: ["Segment ", segmentName.toUpperCase()] }), _jsx(ChevronDown, { size: 20, style: { transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' } })] }), isExpanded && (_jsxs("div", { className: "border-t border-slate-700 p-4 space-y-4", children: [_jsxs("div", { className: "inline-flex gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-400 ml-6 mb-1", children: "B1 B0" }), _jsxs("div", { className: "grid gap-1", style: { gridTemplateColumns: 'auto repeat(4, 1fr)' }, children: [_jsx("div", {}), GRAY_CODE_LABELS.cols.map((col) => (_jsx("div", { className: "text-xs text-slate-400 text-center font-mono w-8", children: col }, col))), GRAY_CODE_LABELS.rows.map((row, rowIdx) => (_jsxs(React.Fragment, { children: [_jsxs("div", { className: "text-xs text-slate-400 text-right font-mono w-6", children: ["B3B2 ", row] }), GRAY_CODE_LABELS.cols.map((col, colIdx) => {
                                                        const gridIndex = rowIdx * 4 + colIdx;
                                                        const cellValue = kmap.grid[gridIndex];
                                                        const cellLabel = getPositionToGrayCode(rowIdx, colIdx);
                                                        const bgColor = cellValue === 1
                                                            ? 'bg-emerald-600/40 border-emerald-500'
                                                            : cellValue === 'X'
                                                                ? 'bg-slate-700 border-slate-600'
                                                                : 'bg-slate-700 border-slate-600';
                                                        return (_jsx("div", { className: `w-8 h-8 flex items-center justify-center border ${bgColor} rounded text-xs font-bold cursor-default transition-colors hover:border-emerald-400`, title: `Input: ${cellLabel}`, children: cellValue === 'X' ? '—' : cellValue }, `${row}-${col}`));
                                                    })] }, row)))] })] }), _jsxs("div", { className: "text-xs text-slate-400 space-y-2 flex flex-col justify-center", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-emerald-600/40 border border-emerald-500 rounded" }), _jsx("span", { children: "Minterm (1)" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-slate-700 border border-slate-600 rounded" }), _jsx("span", { children: "Zero or Don't-Care" })] })] })] }), _jsxs("div", { className: "bg-slate-900 rounded p-3", children: [_jsx("label", { className: "block text-sm text-slate-300 mb-2", children: "Simplified Boolean Expression:" }), _jsx("input", { type: "text", value: expr, onChange: (e) => onExprChange(e.target.value), className: "w-full bg-slate-800 text-slate-50 border border-slate-700 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20", placeholder: "e.g., B3 + B2\u00B7B1 (use \u00B7 for AND, + for OR, ' for NOT)" }), _jsx("p", { className: "text-xs text-slate-400 mt-2", children: "Format: Use B3, B2, B1, B0 for inputs; \u00B7 for AND; + for OR; ' for NOT" })] })] }))] }));
};
