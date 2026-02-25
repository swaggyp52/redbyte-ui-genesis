import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState } from 'react';
import { PowerButtonIcon, SwitchIcon, InputPortIcon, OutputPortIcon, LampIcon, LogicAndIcon, LogicOrIcon, LogicNotIcon, LogicNandIcon, LogicNorIcon, LogicXorIcon, LogicXnorIcon, ClockIcon, DelayIcon, LatchIcon, FlipFlopIcon, AdderIcon, CounterIcon, } from '@redbyte/rb-icons';
const COMPONENTS = [
    // Basic I/O
    { type: 'PowerSource', name: 'Power', description: 'Always ON - provides constant signal', Icon: PowerButtonIcon, category: 'Basic I/O', color: '#4ade80' },
    { type: 'Switch', name: 'Switch', description: 'Click to toggle ON/OFF', Icon: SwitchIcon, category: 'Basic I/O', color: '#60a5fa' },
    { type: 'INPUT', name: 'Input', description: 'External input port', Icon: InputPortIcon, category: 'Basic I/O', color: '#60a5fa' },
    { type: 'Lamp', name: 'Lamp', description: 'Lights up when signal is ON', Icon: LampIcon, category: 'Basic I/O', color: '#fbbf24' },
    { type: 'OUTPUT', name: 'Output', description: 'External output port', Icon: OutputPortIcon, category: 'Basic I/O', color: '#fbbf24' },
    // Logic Gates
    { type: 'AND', name: 'AND Gate', description: 'ON when both inputs are ON', Icon: LogicAndIcon, category: 'Logic Gates', color: '#c084fc' },
    { type: 'OR', name: 'OR Gate', description: 'ON when any input is ON', Icon: LogicOrIcon, category: 'Logic Gates', color: '#f472b6' },
    { type: 'NOT', name: 'NOT Gate', description: 'Inverts the input signal', Icon: LogicNotIcon, category: 'Logic Gates', color: '#fb923c' },
    { type: 'NAND', name: 'NAND Gate', description: 'NOT-AND - opposite of AND', Icon: LogicNandIcon, category: 'Logic Gates', color: '#a78bfa' },
    { type: 'NOR', name: 'NOR Gate', description: 'NOT-OR - opposite of OR', Icon: LogicNorIcon, category: 'Logic Gates', color: '#f472b6' },
    { type: 'XOR', name: 'XOR Gate', description: 'ON when inputs differ', Icon: LogicXorIcon, category: 'Logic Gates', color: '#ec4899' },
    { type: 'XNOR', name: 'XNOR Gate', description: 'ON when inputs match', Icon: LogicXnorIcon, category: 'Logic Gates', color: '#ec4899' },
    // Timing
    { type: 'Clock', name: 'Clock', description: 'Oscillates ON/OFF rhythmically', Icon: ClockIcon, category: 'Timing', color: '#3B82F6' },
    { type: 'Delay', name: 'Delay', description: 'Delays signal by one tick', Icon: DelayIcon, category: 'Timing', color: '#a3e635' },
    // Advanced
    { type: 'RSLatch', name: 'RS Latch', description: 'Memory cell - stores 1 bit', Icon: LatchIcon, category: 'Advanced', color: '#f87171' },
    { type: 'DLatch', name: 'D Latch', description: 'Level-sensitive latch, transparent when EN=1', Icon: LatchIcon, category: 'Advanced', color: '#fb923c' },
    { type: 'DFlipFlop', name: 'D Flip-Flop', description: 'Clocked memory element', Icon: FlipFlopIcon, category: 'Advanced', color: '#34d399' },
    { type: 'TFlipFlop', name: 'T Flip-Flop', description: 'Toggle flip-flop, Q flips on rising CLK when T=1', Icon: FlipFlopIcon, category: 'Advanced', color: '#a78bfa' },
    { type: 'JKFlipFlop', name: 'JK Flip-Flop', description: 'Advanced flip-flop', Icon: FlipFlopIcon, category: 'Advanced', color: '#fcd34d' },
    { type: 'FullAdder', name: 'Full Adder', description: 'Adds 3 binary digits', Icon: AdderIcon, category: 'Advanced', color: '#818cf8' },
    { type: 'Counter4Bit', name: '4-Bit Counter', description: 'Counts from 0 to 15', Icon: CounterIcon, category: 'Advanced', color: '#e879f9' },
];
const CATEGORIES = ['Basic I/O', 'Logic Gates', 'Timing', 'Advanced'];
export const ComponentPalette = ({ onAddNode, onDragStart }) => {
    const [selectedCategory, setSelectedCategory] = useState('Basic I/O');
    const [hoveredComponent, setHoveredComponent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const filteredComponents = COMPONENTS.filter(comp => {
        const matchesCategory = selectedCategory === 'All' || comp.category === selectedCategory;
        const matchesSearch = searchQuery === '' ||
            comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            comp.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });
    return (_jsxs("div", { className: "h-full flex flex-col bg-gray-900 border-r border-gray-700", children: [_jsxs("div", { className: "p-3 border-b border-gray-700", children: [_jsx("h3", { className: "text-sm font-bold text-cyan-400 mb-2", children: "Component Library" }), _jsx("input", { type: "text", placeholder: "Search components...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-cyan-500 text-white" })] }), _jsx("div", { className: "flex overflow-x-auto border-b border-gray-700 bg-gray-850", children: CATEGORIES.map(category => (_jsx("button", { onClick: () => setSelectedCategory(category), className: `px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${selectedCategory === category
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-400 hover:text-gray-300'}`, children: category }, category))) }), _jsx("div", { className: "flex-1 overflow-y-auto p-2", children: _jsx("div", { className: "grid grid-cols-1 gap-2", children: filteredComponents.map(comp => {
                        const IconComponent = comp.Icon;
                        const isHovered = hoveredComponent === comp.type;
                        return (_jsxs("div", { "data-testid": `palette-${comp.type.toLowerCase()}`, draggable: true, onDragStart: (e) => onDragStart(comp.type, e), onMouseEnter: () => setHoveredComponent(comp.type), onMouseLeave: () => setHoveredComponent(null), onClick: () => onAddNode(comp.type), className: `
                  relative p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${isHovered
                                ? 'border-cyan-400 bg-gray-800 shadow-lg shadow-cyan-500/20 scale-105'
                                : 'border-gray-700 bg-gray-850 hover:border-gray-600'}
                `, style: {
                                borderLeftColor: isHovered ? comp.color : undefined,
                                borderLeftWidth: isHovered ? '4px' : undefined,
                            }, children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md", style: {
                                                backgroundColor: `${comp.color}20`,
                                                color: comp.color,
                                            }, children: _jsx(IconComponent, { className: "w-5 h-5", style: {
                                                    filter: isHovered ? 'brightness(1.3)' : 'brightness(1)',
                                                    transition: 'filter 0.2s',
                                                } }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-semibold text-sm text-white mb-0.5", children: comp.name }), _jsx("div", { className: "text-xs text-gray-400 leading-tight", children: comp.description })] })] }), isHovered && (_jsx("div", { className: "absolute top-1 right-1 text-xs text-cyan-400 font-bold animate-pulse", children: "Drag or Click" }))] }, comp.type));
                    }) }) }), _jsx("div", { className: "p-2 border-t border-gray-700 bg-gray-850", children: _jsxs("div", { className: "text-xs text-gray-500 flex items-center gap-1", children: [_jsx(LampIcon, { className: "w-3 h-3 text-yellow-400" }), _jsx("span", { className: "text-gray-400", children: "Drag components onto canvas or click to add at center" })] }) })] }));
};
