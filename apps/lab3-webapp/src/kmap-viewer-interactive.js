import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { useLabStore } from './store';
import { ChevronDown, RefreshCw, Trash2, Lightbulb, Check } from 'lucide-react';
const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const GRAY_CODE_LABELS = {
    rows: ['00', '01', '11', '10'], // B3B2
    cols: ['00', '01', '11', '10'], // B1B0
};
const GROUP_COLORS = [
    'rgba(6, 182, 212, 0.3)', // cyan
    'rgba(16, 185, 129, 0.3)', // emerald
    'rgba(249, 115, 22, 0.3)', // orange
    'rgba(168, 85, 247, 0.3)', // purple
    'rgba(236, 72, 153, 0.3)', // pink
    'rgba(34, 197, 94, 0.3)', // green
    'rgba(234, 179, 8, 0.3)', // yellow
];
function getPositionToGrayCode(row, col) {
    return `${GRAY_CODE_LABELS.rows[row]}${GRAY_CODE_LABELS.cols[col]}`;
}
function grayCodeToDecimal(grayCode) {
    const b3 = parseInt(grayCode[0]);
    const b2 = parseInt(grayCode[1]);
    const b1 = parseInt(grayCode[2]);
    const b0 = parseInt(grayCode[3]);
    return (b3 << 3) | (b2 << 2) | (b1 << 1) | b0;
}
export const KMapViewerInteractive = () => {
    const [expandedSegment, setExpandedSegment] = useState('a');
    const kMaps = useLabStore((s) => s.kMaps);
    const generateKMaps = useLabStore((s) => s.generateKMaps);
    const setBooleanExpr = useLabStore((s) => s.setBooleanExpr);
    const booleanExpressions = useLabStore((s) => s.booleanExpressions);
    const handleRegenerateKMap = () => {
        generateKMaps();
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2", children: "Interactive Karnaugh Maps" }), _jsx("p", { className: "font-digital text-sm text-slate-400", children: "Group minterms to simplify boolean expressions" })] }), _jsxs("button", { onClick: handleRegenerateKMap, className: "px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-tech font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 glow-box-emerald", title: "Regenerate K-maps from truth table", children: [_jsx(RefreshCw, { size: 18 }), "Regenerate"] })] }), _jsxs("div", { className: "bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3", children: [_jsx(Lightbulb, { size: 20, className: "text-cyan-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { className: "font-digital text-sm text-cyan-300", children: [_jsx("strong", { children: "How to use:" }), " Click and drag to create rectangular groups of 1s. Groups must be power-of-2 sized (1, 2, 4, 8, or 16 cells). Larger groups = simpler expressions! Groups can wrap around edges."] })] })] }), _jsx("div", { className: "space-y-3", children: SEGMENT_NAMES.map((segName) => (_jsx(KMapSegmentInteractive, { segmentName: segName, isExpanded: expandedSegment === segName, onToggle: () => setExpandedSegment(expandedSegment === segName ? '' : segName), kmap: kMaps[segName], expr: booleanExpressions[segName], onExprChange: (newExpr) => setBooleanExpr(segName, newExpr) }, segName))) })] }));
};
const KMapSegmentInteractive = ({ segmentName, isExpanded, onToggle, kmap, expr, onExprChange, }) => {
    const [groups, setGroups] = useState([]);
    const [selecting, setSelecting] = useState(null);
    const [hoveredCells, setHoveredCells] = useState([]);
    const [editingExpr, setEditingExpr] = useState(false);
    const [localExpr, setLocalExpr] = useState(expr);
    useEffect(() => {
        setLocalExpr(expr);
    }, [expr]);
    const grid = kmap?.grid || Array(16).fill(0);
    const handleCellMouseDown = (row, col) => {
        const cellIndex = row * 4 + col;
        if (grid[cellIndex] !== 0) { // Only allow grouping 1s
            setSelecting({ startRow: row, startCol: col });
        }
    };
    const handleCellMouseMove = (row, col) => {
        if (selecting) {
            // Calculate rectangular selection
            const minRow = Math.min(selecting.startRow, row);
            const maxRow = Math.max(selecting.startRow, row);
            const minCol = Math.min(selecting.startCol, col);
            const maxCol = Math.max(selecting.startCol, col);
            const cells = [];
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    cells.push(r * 4 + c);
                }
            }
            setHoveredCells(cells);
        }
    };
    const handleCellMouseUp = () => {
        if (selecting && hoveredCells.length > 0) {
            // Validate group is valid (power of 2, all 1s)
            const allOnes = hoveredCells.every(idx => grid[idx] !== 0);
            const isPowerOf2 = [1, 2, 4, 8, 16].includes(hoveredCells.length);
            if (allOnes && isPowerOf2) {
                const newGroup = {
                    id: `group_${Date.now()}`,
                    cells: hoveredCells,
                    color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
                    term: generateBooleanTerm(hoveredCells),
                };
                setGroups([...groups, newGroup]);
                updateExpressionFromGroups([...groups, newGroup]);
            }
        }
        setSelecting(null);
        setHoveredCells([]);
    };
    const generateBooleanTerm = (cells) => {
        // Convert cell indices to boolean term
        // This is a simplified version - full version would need Gray code analysis
        const terms = [];
        // Find which bits are constant across all cells
        const firstCell = cells[0];
        const firstRow = Math.floor(firstCell / 4);
        const firstCol = firstCell % 4;
        const firstGray = getPositionToGrayCode(firstRow, firstCol);
        // Simplified: just return variables that change
        // Real implementation would analyze Gray code patterns
        return cells.length === 16 ? '1' :
            cells.length === 1 ? `term_${cells[0]}` :
                `group(${cells.length})`;
    };
    const updateExpressionFromGroups = (currentGroups) => {
        if (currentGroups.length === 0) {
            onExprChange('');
            return;
        }
        const terms = currentGroups.map(g => g.term).filter(Boolean);
        const newExpr = terms.join(' + ');
        onExprChange(newExpr);
        setLocalExpr(newExpr);
    };
    const deleteGroup = (groupId) => {
        const newGroups = groups.filter(g => g.id !== groupId);
        setGroups(newGroups);
        updateExpressionFromGroups(newGroups);
    };
    const getCellStyle = (row, col) => {
        const cellIndex = row * 4 + col;
        const value = grid[cellIndex];
        // Check if cell is in any group
        const inGroup = groups.find(g => g.cells.includes(cellIndex));
        const isHovered = hoveredCells.includes(cellIndex);
        let bg = value === 0 ? '#1e293b' : value === 1 ? '#0f766e' : '#475569';
        if (inGroup) {
            bg = inGroup.color;
        }
        if (isHovered) {
            bg = 'rgba(6, 182, 212, 0.5)';
        }
        return {
            backgroundColor: bg,
            border: inGroup ? `2px solid ${inGroup.color.replace('0.3', '0.8')}` : '1px solid #475569',
        };
    };
    const handleExprSave = () => {
        onExprChange(localExpr);
        setEditingExpr(false);
    };
    const handleAutoSimplify = () => {
        // Auto-generate optimal groups using Quine-McCluskey
        // This is a placeholder - full implementation would use proper algorithm
        const ones = grid.map((v, i) => ({ v, i })).filter(x => x.v !== 0).map(x => x.i);
        // Simple heuristic: group by size 8, 4, 2, 1
        const newGroups = [];
        let covered = new Set();
        // Try to cover with largest groups first
        for (const size of [8, 4, 2, 1]) {
            // Find all possible groups of this size
            // (This is simplified - real version would check all valid K-map groups)
        }
        setGroups(newGroups);
        updateExpressionFromGroups(newGroups);
    };
    return (_jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden", children: [_jsxs("button", { onClick: onToggle, className: "w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors", children: [_jsxs("span", { className: "font-tech-display text-lg font-bold text-emerald-400", children: ["Segment ", segmentName.toUpperCase()] }), _jsx(ChevronDown, { size: 20, className: "text-slate-400 transition-transform duration-200", style: { transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' } })] }), isExpanded && (_jsx("div", { className: "border-t border-slate-700 p-6 space-y-6", children: _jsxs("div", { className: "grid lg:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h4", { className: "font-tech font-semibold text-slate-300", children: "Karnaugh Map" }), _jsxs("button", { onClick: handleAutoSimplify, className: "px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white text-xs font-tech rounded transition-colors flex items-center gap-1", title: "Auto-generate optimal groups", children: [_jsx(Lightbulb, { size: 14 }), "Auto-Simplify"] })] }), _jsxs("div", { className: "inline-block bg-slate-950/50 p-4 rounded-lg border border-slate-700", children: [_jsx("div", { className: "text-xs text-slate-400 ml-10 mb-2 font-digital", children: "B1 B0 \u2192" }), _jsxs("div", { className: "grid gap-1", style: { gridTemplateColumns: 'auto repeat(4, 1fr)' }, children: [_jsx("div", { className: "text-xs text-slate-400 font-digital", children: "B3B2 \u2193" }), GRAY_CODE_LABELS.cols.map((col) => (_jsx("div", { className: "text-xs text-slate-400 text-center font-digital w-12", children: col }, col))), GRAY_CODE_LABELS.rows.map((row, rowIdx) => (_jsxs(React.Fragment, { children: [_jsx("div", { className: "text-xs text-slate-400 text-right font-digital flex items-center pr-2", children: row }), GRAY_CODE_LABELS.cols.map((col, colIdx) => {
                                                            const cellIndex = rowIdx * 4 + colIdx;
                                                            const cellValue = grid[cellIndex];
                                                            const decimalValue = grayCodeToDecimal(getPositionToGrayCode(rowIdx, colIdx));
                                                            return (_jsx("div", { className: "w-12 h-12 flex items-center justify-center cursor-pointer select-none transition-all duration-200 rounded font-tech-display font-bold", style: getCellStyle(rowIdx, colIdx), onMouseDown: () => handleCellMouseDown(rowIdx, colIdx), onMouseMove: () => handleCellMouseMove(rowIdx, colIdx), onMouseUp: handleCellMouseUp, title: `Input ${decimalValue} (${getPositionToGrayCode(rowIdx, colIdx)})`, children: cellValue === 'X' ? (_jsx("span", { className: "text-amber-400", children: "X" })) : cellValue === 1 ? (_jsx("span", { className: "text-emerald-400", children: "1" })) : (_jsx("span", { className: "text-slate-600", children: "0" })) }, `${rowIdx}-${colIdx}`));
                                                        })] }, row)))] })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("h4", { className: "font-tech font-semibold text-slate-300 mb-3", children: ["Groups (", groups.length, ")"] }), groups.length === 0 ? (_jsx("div", { className: "text-sm text-slate-500 font-digital italic", children: "No groups yet. Click and drag on the K-map to create groups." })) : (_jsx("div", { className: "space-y-2", children: groups.map((group) => (_jsxs("div", { className: "flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700", children: [_jsx("div", { className: "w-4 h-4 rounded", style: { backgroundColor: group.color.replace('0.3', '0.8') } }), _jsxs("div", { className: "flex-1 font-digital text-sm", children: [_jsx("div", { className: "text-slate-300", children: group.term }), _jsxs("div", { className: "text-xs text-slate-500", children: [group.cells.length, " cells"] })] }), _jsx("button", { onClick: () => deleteGroup(group.id), className: "p-1 hover:bg-red-700 text-red-400 hover:text-white rounded transition-colors", title: "Delete group", children: _jsx(Trash2, { size: 16 }) })] }, group.id))) }))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-tech font-semibold text-slate-300 mb-3", children: "Boolean Expression (SOP)" }), editingExpr ? (_jsxs("div", { className: "space-y-2", children: [_jsx("input", { type: "text", value: localExpr, onChange: (e) => setLocalExpr(e.target.value), className: "w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg font-digital text-emerald-400 focus:outline-none focus:border-cyan-500", placeholder: "e.g., B3'B2'B1' + B3B2B1" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { onClick: handleExprSave, className: "px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-tech rounded-lg transition-colors flex items-center gap-2", children: [_jsx(Check, { size: 16 }), "Save"] }), _jsx("button", { onClick: () => {
                                                                setEditingExpr(false);
                                                                setLocalExpr(expr);
                                                            }, className: "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-tech rounded-lg transition-colors", children: "Cancel" })] })] })) : (_jsx("div", { className: "p-4 bg-slate-950/50 border border-slate-700 rounded-lg cursor-pointer hover:border-cyan-500 transition-colors", onClick: () => setEditingExpr(true), children: _jsx("div", { className: "font-digital text-emerald-400", children: localExpr || _jsx("span", { className: "text-slate-500 italic", children: "Click to edit expression" }) }) }))] })] })] }) }))] }));
};
export const KMapViewer = KMapViewerInteractive;
