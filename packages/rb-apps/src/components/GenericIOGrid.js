import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * GenericIOGrid - Capabilities-driven I/O visualization
 *
 * Renders inputs (switches, buttons) and outputs (LEDs) based on
 * board capabilities, without hardcoding any specific board layout.
 */
import { useCallback } from 'react';
// Parse binary string or number to get individual bit values
function getBitValue(value, bitIndex, width) {
    if (value === undefined)
        return false;
    if (typeof value === 'string') {
        // Binary string format: "0000000000000001" (MSB first)
        const idx = width - 1 - bitIndex;
        return value[idx] === '1';
    }
    // Numeric value
    return ((value >> bitIndex) & 1) === 1;
}
// Convert bit array to numeric value
function bitsToNumber(bits) {
    return bits.reduce((acc, bit, idx) => acc | (bit ? 1 << idx : 0), 0);
}
const IOBit = ({ kind, label, value, writable, onToggle }) => {
    const isInput = kind === 'switch' || kind === 'button';
    const isOutput = kind === 'led';
    // Base styles
    const baseClasses = 'flex flex-col items-center gap-1';
    // Indicator styles based on kind and value
    const getIndicatorStyle = () => {
        if (kind === 'led') {
            return value
                ? 'w-4 h-4 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]'
                : 'w-4 h-4 rounded-full bg-gray-700 border border-gray-600';
        }
        if (kind === 'switch') {
            return value
                ? 'w-3 h-6 rounded-sm bg-cyan-500 border border-cyan-400'
                : 'w-3 h-6 rounded-sm bg-gray-700 border border-gray-600';
        }
        if (kind === 'button') {
            return value
                ? 'w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-300'
                : 'w-5 h-5 rounded-full bg-gray-700 border-2 border-gray-600';
        }
        return 'w-4 h-4 bg-gray-600';
    };
    const handleClick = () => {
        if (writable && onToggle) {
            onToggle();
        }
    };
    return (_jsxs("div", { className: `${baseClasses} ${writable ? 'cursor-pointer hover:opacity-80' : ''}`, onClick: handleClick, title: `${label}: ${value ? 'ON' : 'OFF'}${writable ? ' (click to toggle)' : ''}`, children: [_jsx("div", { className: getIndicatorStyle() }), _jsx("span", { className: "text-[10px] text-gray-500 font-mono", children: label })] }));
};
const IOGroupRow = ({ group, values, isOutput, onToggleBit }) => {
    const bits = [];
    for (let i = group.width - 1; i >= 0; i--) {
        bits.push(getBitValue(values, i, group.width));
    }
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs font-semibold text-gray-300", children: group.name }), _jsxs("span", { className: "text-[10px] text-gray-500", children: ["(", group.width, "-bit)"] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: bits.map((value, idx) => {
                    const bitIndex = group.width - 1 - idx; // Convert back to LSB-indexed
                    const label = group.labels?.[idx] || `${group.name}[${bitIndex}]`;
                    return (_jsx(IOBit, { kind: group.kind, label: label, value: value, bitIndex: bitIndex, writable: isOutput && group.writable, onToggle: onToggleBit ? () => onToggleBit(bitIndex, value) : undefined }, bitIndex));
                }) })] }));
};
export const GenericIOGrid = ({ inputs, outputs, ioSnapshot, onSetOutput, readOnly = false, }) => {
    // Handle toggling an output bit
    const handleToggleOutputBit = useCallback((signal, width, bitIndex, currentValue) => {
        if (readOnly || !onSetOutput)
            return;
        // Get current value as number
        const currentRaw = ioSnapshot?.outputs[signal];
        let currentNum = 0;
        if (typeof currentRaw === 'string') {
            currentNum = parseInt(currentRaw, 2);
        }
        else if (typeof currentRaw === 'number') {
            currentNum = currentRaw;
        }
        // Toggle the bit
        const newValue = currentValue
            ? currentNum & ~(1 << bitIndex) // Clear bit
            : currentNum | (1 << bitIndex); // Set bit
        onSetOutput(signal, newValue);
    }, [ioSnapshot, onSetOutput, readOnly]);
    return (_jsxs("div", { className: "flex flex-col gap-4 p-4 bg-gray-900 rounded-lg", children: [inputs.length > 0 && (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-400 uppercase tracking-wide", children: "Inputs" }), _jsx("div", { className: "flex flex-col gap-4 pl-2", children: inputs.map((group) => (_jsx(IOGroupRow, { group: group, values: ioSnapshot?.inputs[group.name] }, group.name))) })] })), inputs.length > 0 && outputs.length > 0 && (_jsx("div", { className: "border-t border-gray-700" })), outputs.length > 0 && (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-400 uppercase tracking-wide", children: "Outputs" }), _jsx("div", { className: "flex flex-col gap-4 pl-2", children: outputs.map((group) => (_jsx(IOGroupRow, { group: group, values: ioSnapshot?.outputs[group.name], isOutput: true, onToggleBit: !readOnly && group.writable
                                ? (bitIndex, currentValue) => handleToggleOutputBit(group.name, group.width, bitIndex, currentValue)
                                : undefined }, group.name))) })] })), inputs.length === 0 && outputs.length === 0 && (_jsx("div", { className: "text-center text-gray-500 py-8", children: "No I/O capabilities defined" }))] }));
};
export default GenericIOGrid;
