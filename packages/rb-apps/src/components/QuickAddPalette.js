import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useEffect, useRef } from 'react';
import { REPLAY_LOCK_MESSAGE } from '../utils/replayLock';
import { PowerButtonIcon, SwitchIcon, InputPortIcon, OutputPortIcon, LampIcon, LogicAndIcon, LogicOrIcon, LogicNotIcon, LogicNandIcon, LogicNorIcon, LogicXorIcon, LogicXnorIcon, ClockIcon, DelayIcon, LatchIcon, FlipFlopIcon, AdderIcon, CounterIcon, } from '@redbyte/rb-icons';
const COMPONENTS = [
    { type: 'PowerSource', name: 'Power Source', keywords: ['power', 'on', 'high', 'constant'], Icon: PowerButtonIcon, color: '#4ade80' },
    { type: 'Switch', name: 'Switch', keywords: ['switch', 'toggle', 'input', 'button'], Icon: SwitchIcon, color: '#60a5fa' },
    { type: 'INPUT', name: 'Input', keywords: ['input', 'in', 'port'], Icon: InputPortIcon, color: '#60a5fa' },
    { type: 'Lamp', name: 'Lamp', keywords: ['lamp', 'light', 'led', 'output', 'indicator'], Icon: LampIcon, color: '#fbbf24' },
    { type: 'OUTPUT', name: 'Output', keywords: ['output', 'out', 'port'], Icon: OutputPortIcon, color: '#fbbf24' },
    { type: 'AND', name: 'AND Gate', keywords: ['and', 'gate', 'logic', 'all'], Icon: LogicAndIcon, color: '#c084fc' },
    { type: 'OR', name: 'OR Gate', keywords: ['or', 'gate', 'logic', 'any'], Icon: LogicOrIcon, color: '#f472b6' },
    { type: 'NOT', name: 'NOT Gate', keywords: ['not', 'inverter', 'gate', 'logic', 'negate'], Icon: LogicNotIcon, color: '#fb923c' },
    { type: 'NAND', name: 'NAND Gate', keywords: ['nand', 'gate', 'logic'], Icon: LogicNandIcon, color: '#a78bfa' },
    { type: 'NOR', name: 'NOR Gate', keywords: ['nor', 'gate', 'logic'], Icon: LogicNorIcon, color: '#f472b6' },
    { type: 'XOR', name: 'XOR Gate', keywords: ['xor', 'exclusive', 'gate', 'logic', 'different'], Icon: LogicXorIcon, color: '#ec4899' },
    { type: 'XNOR', name: 'XNOR Gate', keywords: ['xnor', 'gate', 'logic', 'same'], Icon: LogicXnorIcon, color: '#ec4899' },
    { type: 'Clock', name: 'Clock', keywords: ['clock', 'oscillator', 'timer', 'pulse'], Icon: ClockIcon, color: '#3B82F6' },
    { type: 'Delay', name: 'Delay', keywords: ['delay', 'buffer', 'wait'], Icon: DelayIcon, color: '#a3e635' },
    { type: 'RSLatch', name: 'RS Latch', keywords: ['rs', 'latch', 'memory', 'flip', 'flop'], Icon: LatchIcon, color: '#f87171' },
    { type: 'DFlipFlop', name: 'D Flip-Flop', keywords: ['d', 'flip', 'flop', 'memory', 'register'], Icon: FlipFlopIcon, color: '#34d399' },
    { type: 'JKFlipFlop', name: 'JK Flip-Flop', keywords: ['jk', 'flip', 'flop', 'memory'], Icon: FlipFlopIcon, color: '#fcd34d' },
    { type: 'FullAdder', name: 'Full Adder', keywords: ['adder', 'add', 'sum', 'arithmetic'], Icon: AdderIcon, color: '#818cf8' },
    { type: 'Counter4Bit', name: '4-Bit Counter', keywords: ['counter', 'count', '4bit', 'register'], Icon: CounterIcon, color: '#e879f9' },
];
export const QuickAddPalette = ({ isOpen, onClose, onSelectComponent, position, isReplayMode = false, }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const lockMessage = REPLAY_LOCK_MESSAGE;
    const filteredComponents = COMPONENTS.filter(comp => {
        const query = searchQuery.toLowerCase();
        return (comp.name.toLowerCase().includes(query) ||
            comp.keywords.some(k => k.includes(query)));
    });
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setSearchQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);
    const handleKeyDown = (e) => {
        if (isReplayMode) {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredComponents.length);
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredComponents.length) % filteredComponents.length);
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredComponents[selectedIndex]) {
                onSelectComponent(filteredComponents[selectedIndex].type);
                onClose();
            }
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };
    if (!isOpen)
        return null;
    const style = position
        ? { left: position.x, top: position.y }
        : { left: '50%', top: '20%', transform: 'translateX(-50%)' };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/50 z-[200]", onClick: onClose }), _jsx("div", { className: "fixed z-[201] w-full max-w-2xl", style: style, children: _jsxs("div", { className: "bg-gray-900 border-2 border-cyan-500 rounded-lg shadow-2xl overflow-hidden", children: [isReplayMode && (_jsx("div", { className: "px-4 py-2 text-xs text-orange-300 bg-orange-900/20 border-b border-orange-500/30", children: lockMessage })), _jsx("div", { className: "p-4 border-b border-gray-700", children: _jsx("input", { ref: inputRef, type: "text", placeholder: "Type to search components... (e.g., 'and', 'switch', 'memory')", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onKeyDown: handleKeyDown, className: "w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-cyan-500 text-white text-lg", disabled: isReplayMode, title: isReplayMode ? lockMessage : undefined }) }), _jsx("div", { className: "max-h-96 overflow-y-auto", title: isReplayMode ? lockMessage : undefined, children: filteredComponents.length === 0 ? (_jsxs("div", { className: "p-8 text-center text-gray-500", children: ["No components found for \"", searchQuery, "\""] })) : (_jsx("div", { children: filteredComponents.map((comp, index) => {
                                    const IconComponent = comp.Icon;
                                    const isSelected = index === selectedIndex;
                                    return (_jsx("div", { onClick: () => {
                                            if (isReplayMode)
                                                return;
                                            onSelectComponent(comp.type);
                                            onClose();
                                        }, className: `
                        p-4 cursor-pointer border-b border-gray-800 transition-colors
                        ${isSelected
                                            ? 'bg-cyan-600/20 border-l-4 border-l-cyan-400'
                                            : 'hover:bg-gray-800'}
                        ${isReplayMode ? 'pointer-events-none opacity-60' : ''}
                      `, children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg", style: {
                                                        backgroundColor: `${comp.color}20`,
                                                        color: comp.color,
                                                    }, children: _jsx(IconComponent, { className: "w-6 h-6" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-semibold text-white", children: comp.name }), _jsx("div", { className: "text-xs text-gray-400", children: comp.keywords.slice(0, 3).join(' • ') })] }), isSelected && (_jsx("div", { className: "text-xs text-cyan-400", children: "Press Enter" }))] }) }, comp.type));
                                }) })) }), _jsxs("div", { className: "p-2 bg-gray-850 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("kbd", { className: "bg-gray-700 px-1.5 py-0.5 rounded", children: "\u2191\u2193" }), " Navigate", _jsx("kbd", { className: "bg-gray-700 px-1.5 py-0.5 rounded ml-2", children: "Enter" }), " Select", _jsx("kbd", { className: "bg-gray-700 px-1.5 py-0.5 rounded ml-2", children: "Esc" }), " Close"] }), _jsxs("div", { className: "text-cyan-400", children: [filteredComponents.length, " component", filteredComponents.length !== 1 ? 's' : ''] })] })] }) })] }));
};
