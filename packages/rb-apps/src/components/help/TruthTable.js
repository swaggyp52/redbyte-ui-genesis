import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * TruthTable - Standardized truth table component
 * Provides consistent styling for truth tables across lessons
 */
export const TruthTable = ({ headers, rows, highlightedCells, className = '' }) => {
    return (_jsxs("table", { className: `border-collapse my-2 w-full max-w-sm ${className}`, children: [_jsx("thead", { children: _jsx("tr", { children: headers.map((header, index) => (_jsx("th", { className: "border border-slate-600 px-2 py-2 bg-slate-800 text-gray-200", children: header }, index))) }) }), _jsx("tbody", { children: rows.map((row, rowIndex) => (_jsx("tr", { children: row.map((cell, cellIndex) => {
                        const cellKey = `${rowIndex}-${cellIndex}`;
                        const isHighlighted = highlightedCells?.has(cellKey);
                        return (_jsx("td", { className: `border border-slate-600 px-2 py-2 text-center ${isHighlighted ? 'bg-blue-950' : rowIndex % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900'}`, children: cell }, cellIndex));
                    }) }, rowIndex))) })] }));
};
