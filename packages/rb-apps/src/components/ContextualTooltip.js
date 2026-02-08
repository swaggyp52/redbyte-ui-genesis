import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useState } from 'react';
const NODE_TOOLTIPS = {
    PowerSource: {
        title: 'Power Source',
        description: 'Constantly outputs a HIGH (1) signal',
        tips: ['Use this to test circuits', 'Acts as a constant TRUE value'],
    },
    Switch: {
        title: 'Switch',
        description: 'Click to toggle between ON and OFF',
        tips: ['Interactive input control', 'Click the node to flip state'],
        keyboardShortcut: 'Click node',
    },
    Lamp: {
        title: 'Lamp',
        description: 'Lights up when receiving a HIGH signal',
        tips: ['Visual output indicator', 'Glows green when active'],
    },
    AND: {
        title: 'AND Gate',
        description: 'Outputs HIGH only when ALL inputs are HIGH',
        tips: ['Logic: A AND B', 'Both inputs must be 1'],
    },
    OR: {
        title: 'OR Gate',
        description: 'Outputs HIGH when ANY input is HIGH',
        tips: ['Logic: A OR B', 'At least one input must be 1'],
    },
    NOT: {
        title: 'NOT Gate',
        description: 'Inverts the input signal',
        tips: ['Logic: NOT A', 'Outputs opposite of input'],
    },
    XOR: {
        title: 'XOR Gate',
        description: 'Outputs HIGH when inputs are DIFFERENT',
        tips: ['Logic: A XOR B', 'Exclusive OR - inputs must differ'],
    },
    Clock: {
        title: 'Clock',
        description: 'Oscillates between HIGH and LOW automatically',
        tips: ['Provides timing signal', 'Frequency set in properties'],
    },
    RSLatch: {
        title: 'RS Latch',
        description: 'Memory element - stores one bit of data',
        tips: ['S=Set, R=Reset', 'Remembers state', 'Basic memory building block'],
    },
    DFlipFlop: {
        title: 'D Flip-Flop',
        description: 'Stores input value on clock edge',
        tips: ['D=Data, CLK=Clock', 'Updates on clock rising edge', 'Synchronized memory'],
    },
};
export const ContextualTooltip = ({ nodeType, isWiring, selectedCount = 0, position, }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 300);
        return () => clearTimeout(timer);
    }, [nodeType, isWiring, selectedCount]);
    if (!visible)
        return null;
    let content = null;
    if (isWiring) {
        content = (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-cyan-400 mb-1", children: "\uD83D\uDD0C Wiring Mode" }), _jsx("div", { className: "text-sm text-gray-300 mb-2", children: "Click a port to complete the connection" }), _jsx("div", { className: "text-xs text-gray-400", children: "Press ESC to cancel" })] }));
    }
    else if (selectedCount > 1) {
        content = (_jsxs("div", { children: [_jsxs("div", { className: "font-bold text-cyan-400 mb-1", children: ["\uD83D\uDCE6 ", selectedCount, " Items Selected"] }), _jsxs("div", { className: "text-xs text-gray-400 space-y-1", children: [_jsx("div", { children: "\u2022 Press DELETE to remove" }), _jsx("div", { children: "\u2022 Drag to move together" }), _jsx("div", { children: "\u2022 Click background to deselect" })] })] }));
    }
    else if (nodeType && NODE_TOOLTIPS[nodeType]) {
        const tooltip = NODE_TOOLTIPS[nodeType];
        content = (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-cyan-400 mb-1", children: tooltip.title }), _jsx("div", { className: "text-sm text-gray-300 mb-2", children: tooltip.description }), tooltip.tips && (_jsx("div", { className: "text-xs text-gray-400 space-y-0.5", children: tooltip.tips.map((tip, i) => (_jsxs("div", { children: ["\u2022 ", tip] }, i))) })), tooltip.keyboardShortcut && (_jsx("div", { className: "mt-2 pt-2 border-t border-gray-700", children: _jsx("kbd", { className: "bg-gray-700 px-1.5 py-0.5 rounded text-xs", children: tooltip.keyboardShortcut }) }))] }));
    }
    if (!content)
        return null;
    return (_jsx("div", { className: "fixed z-[100] pointer-events-none", style: {
            left: position.x + 20,
            top: position.y,
        }, children: _jsxs("div", { className: "bg-gray-900 border-2 border-cyan-500/30 rounded-lg shadow-2xl p-3 max-w-xs animate-in fade-in slide-in-from-left-2 duration-200", children: [content, _jsx("div", { className: "absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-cyan-500/30" })] }) }));
};
