import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { useLabStore } from './store';
import { SevenSegmentDisplay } from './seven-segment';
export const TruthTableEditor = () => {
    const truthTable = useLabStore((s) => s.truthTable);
    const setTableRow = useLabStore((s) => s.setTableRow);
    const toggleDontCare = useLabStore((s) => s.toggleDontCare);
    const fillStandardDigits = useLabStore((s) => s.fillStandardDigits);
    const [selectedRow, setSelectedRow] = React.useState(0);
    const selectedSeg = truthTable[selectedRow]?.seg || [1, 1, 1, 1, 1, 1, 1];
    const toggleSegment = (segIndex) => {
        const row = truthTable[selectedRow];
        const newSeg = [...row.seg];
        newSeg[segIndex] = newSeg[segIndex] === 0 ? 1 : 0;
        setTableRow(selectedRow, { seg: newSeg });
    };
    return (_jsxs("div", { style: { padding: '20px' }, children: [_jsx("h2", { children: "Truth Table Editor" }), _jsx("button", { onClick: fillStandardDigits, style: { padding: '10px 20px', marginBottom: '20px', fontSize: '14px' }, children: "Fill Standard Digits (0-9)" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }, children: [_jsxs("div", { children: [_jsx("h3", { children: "Select Input (0-15)" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }, children: truthTable.map((row, i) => (_jsx("button", { onClick: () => setSelectedRow(i), style: {
                                        padding: '10px',
                                        backgroundColor: selectedRow === i ? '#0066cc' : '#ddd',
                                        color: selectedRow === i ? 'white' : 'black',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontWeight: selectedRow === i ? 'bold' : 'normal',
                                    }, children: i }, i))) }), _jsx("div", { style: { marginTop: '20px' }, children: _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: truthTable[selectedRow]?.isDontCare || false, onChange: () => toggleDontCare(selectedRow) }), ' Don\'t Care (inputs 10-15)'] }) })] }), _jsxs("div", { children: [_jsxs("h3", { children: ["Input: ", selectedRow, " (B3.B2.B1.B0)"] }), _jsx("div", { style: { marginBottom: '20px' }, children: _jsxs("p", { children: ["B3=", truthTable[selectedRow]?.b3, " B2=", truthTable[selectedRow]?.b2, " B1=", truthTable[selectedRow]?.b1, " B0=", truthTable[selectedRow]?.b0] }) }), _jsx("h4", { children: "Segments (click to toggle):" }), _jsx("div", { style: { marginBottom: '20px' }, children: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name, idx) => (_jsxs("button", { onClick: () => toggleSegment(idx), style: {
                                        padding: '8px 16px',
                                        margin: '4px',
                                        backgroundColor: selectedSeg[idx] === 0 ? '#00ff00' : '#ddd',
                                        color: selectedSeg[idx] === 0 ? 'black' : 'black',
                                        border: '1px solid #999',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                    }, children: ["seg_", name, " = ", selectedSeg[idx]] }, name))) }), _jsx("h4", { children: "Live Preview:" }), _jsx(SevenSegmentDisplay, { seg: selectedSeg, size: 80 })] })] })] }));
};
