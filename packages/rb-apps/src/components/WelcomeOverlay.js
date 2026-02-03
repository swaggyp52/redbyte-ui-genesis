import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState } from 'react';
import { Icon } from '@redbyte/rb-icons';
const QUICK_START_EXAMPLES = [
    {
        id: '01_wire-lamp',
        title: 'Your First Circuit',
        description: 'Power source connected to a lamp - see electricity flow',
        difficulty: 'Beginner',
        time: '30 seconds',
    },
    {
        id: '02_and-gate',
        title: 'Logic Gates',
        description: 'Learn how AND gates work with switches and lamps',
        difficulty: 'Beginner',
        time: '2 minutes',
    },
    {
        id: '03_or-xor',
        title: 'Comparing Gates',
        description: 'See the difference between OR and XOR gates',
        difficulty: 'Intermediate',
        time: '3 minutes',
    },
];
const FEATURES = [
    { icon: 'grid', title: 'Drag & Drop', description: 'Build circuits by dragging components onto the canvas' },
    { icon: 'neon-wave', title: 'Live Simulation', description: 'Watch signals flow through your circuit in real-time' },
    { icon: 'circuit-board', title: 'Easy Wiring', description: 'Click port → Click port to connect components' },
    { icon: 'logic', title: 'Multiple Views', description: 'See your circuit in 2D, 3D, schematic, and oscilloscope' },
    { icon: 'document', title: 'Auto-Save', description: 'Your work is automatically saved and crash-protected' },
    { icon: 'terminal', title: 'Power User', description: 'Keyboard shortcuts for everything - press ? for help' },
];
export const WelcomeOverlay = ({ isOpen, onClose, onStartTutorial, onLoadExample, }) => {
    const [currentPage, setCurrentPage] = useState('welcome');
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300", children: _jsx("div", { className: "bg-gradient-to-br from-gray-900 to-gray-950 border-2 border-cyan-500 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden", children: currentPage === 'welcome' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "p-8 border-b border-gray-800 bg-gradient-to-r from-cyan-900/20 to-purple-900/20", children: [_jsx("h1", { className: "text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-2", children: "Welcome to Logic Playground" }), _jsx("p", { className: "text-gray-300 text-lg", children: "Build, simulate, and understand digital logic circuits - visually and interactively" })] }), _jsxs("div", { className: "p-8 overflow-y-auto max-h-[50vh]", children: [_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-8", children: FEATURES.map((feature, index) => (_jsxs("div", { className: "p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all", children: [_jsx("div", { className: "mb-2 text-cyan-300", children: _jsx(Icon, { name: feature.icon, size: 20 }) }), _jsx("h3", { className: "text-white font-semibold mb-1", children: feature.title }), _jsx("p", { className: "text-gray-400 text-sm", children: feature.description })] }, index))) }), _jsxs("div", { className: "bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-6", children: [_jsxs("h3", { className: "text-cyan-400 font-bold mb-3 flex items-center gap-2", children: [_jsx(Icon, { name: "lamp", size: 16 }), "Pro Tips"] }), _jsxs("ul", { className: "space-y-2 text-sm text-gray-300", children: [_jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-cyan-400", children: "\u2022" }), _jsxs("span", { children: ["Press ", _jsx("kbd", { className: "bg-gray-700 px-1.5 py-0.5 rounded text-xs", children: "Space" }), " to quickly add components anywhere"] })] }), _jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-cyan-400", children: "\u2022" }), _jsxs("span", { children: ["Use ", _jsx("kbd", { className: "bg-gray-700 px-1.5 py-0.5 rounded text-xs", children: "?" }), " to see all keyboard shortcuts"] })] }), _jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-cyan-400", children: "\u2022" }), _jsx("span", { children: "Click switches to toggle them, watch signals flow through wires" })] }), _jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-cyan-400", children: "\u2022" }), _jsx("span", { children: "Your circuits auto-save every 5 seconds - no manual saving needed!" })] })] })] })] }), _jsxs("div", { className: "p-6 border-t border-gray-800 bg-gray-900/50 flex gap-3", children: [onStartTutorial && (_jsx("button", { onClick: () => {
                                    onStartTutorial();
                                    onClose();
                                }, className: "flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-lg font-semibold text-white transition-all shadow-lg", children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Icon, { name: "book", size: 16 }), "Start Interactive Tutorial"] }) })), _jsx("button", { onClick: () => setCurrentPage('examples'), className: "flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all", children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Icon, { name: "document", size: 16 }), "Try an Example"] }) }), _jsx("button", { onClick: onClose, className: "px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold text-gray-300 transition-all", children: "Start Building" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "p-8 border-b border-gray-800", children: [_jsx("button", { onClick: () => setCurrentPage('welcome'), className: "text-cyan-400 hover:text-cyan-300 mb-4 flex items-center gap-2", children: "\u2190 Back" }), _jsx("h2", { className: "text-3xl font-bold text-white mb-2", children: "Quick Start Examples" }), _jsx("p", { className: "text-gray-400", children: "Load a pre-built circuit to see how it works" })] }), _jsx("div", { className: "p-8 overflow-y-auto max-h-[60vh]", children: _jsx("div", { className: "space-y-4", children: QUICK_START_EXAMPLES.map((example) => (_jsxs("div", { onClick: () => {
                                    if (onLoadExample) {
                                        onLoadExample(example.id);
                                        onClose();
                                    }
                                }, className: "p-6 bg-gray-800 rounded-lg border-2 border-gray-700 hover:border-cyan-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/20", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("h3", { className: "text-xl font-semibold text-white", children: example.title }), _jsxs("div", { className: "flex gap-2", children: [_jsx("span", { className: "px-2 py-1 bg-cyan-600/20 text-cyan-400 text-xs rounded", children: example.difficulty }), _jsx("span", { className: "px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded", children: example.time })] })] }), _jsx("p", { className: "text-gray-400", children: example.description })] }, example.id))) }) }), _jsx("div", { className: "p-6 border-t border-gray-800 bg-gray-900/50", children: _jsx("button", { onClick: onClose, className: "w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all", children: "Close" }) })] })) }) }));
};
