import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Help Dock for PR4 - Learn Mode Integration
 *
 * Dockable Help panel that appears in Learn mode
 * - Shows current lesson/track
 * - Breadcrumb navigation
 * - "Back to lesson" button
 * - Load example integration with highlighting
 */
import { useState } from 'react';
const CONTROL_SECTIONS = {
    'circuit-controls': {
        title: 'Circuit Controls',
        summary: 'Build, wire, and inspect with precise input control.',
        items: [
            'Click switches to toggle inputs instantly',
            'W: Toggle wire tool, click ports to connect',
            'G: Toggle snap to grid (Alt to temporarily disable)',
            'F: Fit circuit to view, 0: Reset view',
            'Drag to move, Shift+Click to multi-select, Delete to remove',
            'Ctrl/Cmd+Z: Undo, Ctrl/Cmd+Shift+Z: Redo',
        ],
    },
    'schematic-controls': {
        title: 'Schematic Controls',
        summary: 'Inspect IEEE/ANSI symbols with clean pan/zoom.',
        items: [
            'Shift+Drag to pan, Scroll to zoom',
            'Drag nodes to reposition in schematic view',
            'F: Fit to view, 0: Reset view',
        ],
    },
    'scope-controls': {
        title: 'Scope Controls',
        summary: 'Inspect signals over time without losing data.',
        items: [
            'Pause Scroll keeps sampling while view stops auto-follow',
            'Wheel pan while paused to inspect history',
            'Clear resets the scope display only when you request it',
            'Time cursor shows current time; toggle if needed',
            'Trace labels show probe name and latest value',
        ],
    },
    '3d-controls': {
        title: '3D Controls',
        summary: 'See live signals with spatial context.',
        items: [
            'Click nodes to select (syncs to other views)',
            'Follow Selection keeps camera centered on selection',
            'Animate signal flow emphasizes active connections',
            'Use Fit to re-center the scene',
        ],
    },
    'code-controls': {
        title: 'Code Controls',
        summary: 'Export HDL output from your circuit.',
        items: [
            'Select Verilog or JSON formats from the dropdown',
            'LIB/XDC toggles include primitives or constraints',
            'Copy and Download export the current code view',
        ],
    },
};
const COMMON_SHORTCUTS = [
    'Layout: 1-5 single views, Shift+1-4 workflows, Shift+5 quad',
    'Probes: Right-click ports to toggle, Shift+P opens Probes tab',
    'Inspector: Use Add Probe on live signals to pin outputs',
];
const SAMPLE_LESSONS = [
    {
        id: 'intro-1',
        title: 'Your First Circuit',
        example: '01_wire-lamp',
        highlightComponents: ['Wire', 'Lamp'],
        content: (_jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-lg font-semibold text-white", children: "Welcome to RedByte Logic!" }), _jsx("p", { className: "text-sm text-gray-300", children: "Let's start with the simplest circuit: a wire connected to a lamp." }), _jsxs("div", { className: "bg-cyan-900/20 border border-cyan-700/30 rounded p-3", children: [_jsx("div", { className: "text-xs font-semibold text-cyan-400 mb-2", children: "\uD83C\uDFAF Learning Goals" }), _jsxs("ul", { className: "text-sm text-gray-300 space-y-1 list-disc list-inside", children: [_jsx("li", { children: "Understand signal flow" }), _jsx("li", { children: "See how wires carry electricity" }), _jsx("li", { children: "Use the Step button" })] })] }), _jsxs("div", { className: "bg-blue-900/20 border border-blue-700/30 rounded p-3", children: [_jsx("div", { className: "text-xs font-semibold text-blue-400 mb-2", children: "\uD83D\uDC49 Try This" }), _jsxs("ol", { className: "text-sm text-gray-300 space-y-2 list-decimal list-inside", children: [_jsx("li", { children: "Load the example below" }), _jsxs("li", { children: ["Click the ", _jsx("strong", { children: "Step" }), " button"] }), _jsx("li", { children: "Watch the lamp light up!" })] })] })] })),
    },
    {
        id: 'intro-2',
        title: 'Interactive Control',
        example: '02_switch-lamp',
        highlightComponents: ['Switch', 'Lamp'],
        content: (_jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-lg font-semibold text-white", children: "Adding a Switch" }), _jsx("p", { className: "text-sm text-gray-300", children: "Now let's add control! A switch lets you turn the circuit on and off." }), _jsxs("div", { className: "bg-cyan-900/20 border border-cyan-700/30 rounded p-3", children: [_jsx("div", { className: "text-xs font-semibold text-cyan-400 mb-2", children: "\uD83C\uDFAF Learning Goals" }), _jsxs("ul", { className: "text-sm text-gray-300 space-y-1 list-disc list-inside", children: [_jsx("li", { children: "Control signal flow" }), _jsx("li", { children: "Toggle switches interactively" }), _jsx("li", { children: "Understand binary: ON (1) and OFF (0)" })] })] }), _jsxs("div", { className: "bg-blue-900/20 border border-blue-700/30 rounded p-3", children: [_jsx("div", { className: "text-xs font-semibold text-blue-400 mb-2", children: "\uD83D\uDC49 Try This" }), _jsxs("ol", { className: "text-sm text-gray-300 space-y-2 list-decimal list-inside", children: [_jsx("li", { children: "Load the example" }), _jsx("li", { children: "Click the switch to toggle it" }), _jsx("li", { children: "Press Step to see the change" }), _jsx("li", { children: "Watch the lamp respond!" })] })] })] })),
    },
    {
        id: 'gates-1',
        title: 'Logic Gates: AND',
        example: '03_and-gate',
        highlightComponents: ['AND', 'Switch'],
        content: (_jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-lg font-semibold text-white", children: "The AND Gate" }), _jsxs("p", { className: "text-sm text-gray-300", children: ["An AND gate outputs 1 (HIGH) only when ", _jsx("strong", { children: "both" }), " inputs are 1."] }), _jsxs("div", { className: "bg-purple-900/20 border border-purple-700/30 rounded p-3", children: [_jsx("div", { className: "text-xs font-semibold text-purple-400 mb-2", children: "\uD83D\uDCCA Truth Table" }), _jsxs("table", { className: "text-xs text-gray-300 w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-gray-700", children: [_jsx("th", { className: "py-1 text-left", children: "A" }), _jsx("th", { className: "py-1 text-left", children: "B" }), _jsx("th", { className: "py-1 text-left", children: "Output" })] }) }), _jsxs("tbody", { className: "font-mono", children: [_jsxs("tr", { children: [_jsx("td", { children: "0" }), _jsx("td", { children: "0" }), _jsx("td", { className: "text-red-400", children: "0" })] }), _jsxs("tr", { children: [_jsx("td", { children: "0" }), _jsx("td", { children: "1" }), _jsx("td", { className: "text-red-400", children: "0" })] }), _jsxs("tr", { children: [_jsx("td", { children: "1" }), _jsx("td", { children: "0" }), _jsx("td", { className: "text-red-400", children: "0" })] }), _jsxs("tr", { children: [_jsx("td", { children: "1" }), _jsx("td", { children: "1" }), _jsx("td", { className: "text-green-400", children: "1" })] })] })] })] }), _jsxs("div", { className: "bg-blue-900/20 border border-blue-700/30 rounded p-3", children: [_jsx("div", { className: "text-xs font-semibold text-blue-400 mb-2", children: "\uD83D\uDC49 Experiment" }), _jsx("p", { className: "text-sm text-gray-300", children: "Try all 4 combinations of switch positions. Notice the lamp only lights when both switches are ON!" })] })] })),
    },
];
export const HelpDock = ({ visible, onClose, onLoadExample, width = 400, focusSection, }) => {
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
    const [isCollapsed, setIsCollapsed] = useState(false);
    if (!visible)
        return null;
    const focusedSection = focusSection ? CONTROL_SECTIONS[focusSection] : null;
    const currentLesson = SAMPLE_LESSONS[currentLessonIndex];
    const hasPrev = currentLessonIndex > 0;
    const hasNext = currentLessonIndex < SAMPLE_LESSONS.length - 1;
    const handleLoadExample = () => {
        if (currentLesson.example && onLoadExample) {
            onLoadExample(currentLesson.example, currentLesson.highlightComponents);
        }
    };
    if (isCollapsed) {
        return (_jsx("div", { className: "w-12 border-l border-gray-700 bg-gray-900 flex flex-col items-center py-4", children: _jsx("button", { onClick: () => setIsCollapsed(false), className: "p-2 rounded hover:bg-gray-800 transition-colors", title: "Expand Help", children: _jsx("span", { className: "text-xl", children: "\uD83D\uDCD6" }) }) }));
    }
    return (_jsxs("div", { className: "border-l border-gray-700 bg-gray-900 flex flex-col transition-all duration-200", style: { width: `${width}px` }, children: [_jsxs("div", { className: "h-12 border-b border-gray-700 bg-gray-850 px-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xl", children: "\uD83D\uDCD6" }), _jsxs("div", { className: "flex flex-col", children: [_jsx("div", { className: "text-xs text-gray-500", children: focusedSection ? 'Controls' : 'Learn Mode' }), _jsx("div", { className: "text-sm font-semibold text-white", children: focusedSection ? focusedSection.title : currentLesson.title })] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => setIsCollapsed(true), className: "px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm", title: "Collapse", children: "\u2192" }), onClose && (_jsx("button", { onClick: onClose, className: "px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm", title: "Close (Exit Learn Mode)", children: "\u2715" }))] })] }), _jsx("div", { className: "px-4 py-2 bg-cyan-900/10 border-b border-gray-700", children: _jsxs("div", { className: "text-xs text-cyan-400 flex items-center gap-1", children: [_jsx("span", { children: "\uD83D\uDCCD" }), focusedSection ? (_jsx("span", { children: focusedSection.title })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: "Track A" }), _jsx("span", { className: "text-gray-600", children: ">" }), _jsxs("span", { children: ["Lesson ", currentLessonIndex + 1, " of ", SAMPLE_LESSONS.length] })] }))] }) }), _jsx("div", { className: "flex-1 overflow-y-auto px-4 py-4", children: focusedSection ? (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-gray-300", children: focusedSection.summary }), _jsx("div", { className: "bg-gray-800/60 border border-gray-700 rounded p-3", children: _jsx("ul", { className: "text-sm text-gray-300 space-y-2 list-disc list-inside", children: focusedSection.items.map((item) => (_jsx("li", { children: item }, item))) }) }), _jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded p-3", children: [_jsx("div", { className: "text-xs font-semibold text-slate-300 uppercase mb-2", children: "Global Shortcuts" }), _jsx("ul", { className: "text-xs text-gray-300 space-y-1 list-disc list-inside", children: COMMON_SHORTCUTS.map((item) => (_jsx("li", { children: item }, item))) })] })] })) : (_jsxs(_Fragment, { children: [currentLesson.content, currentLesson.example && (_jsxs("button", { onClick: handleLoadExample, className: "w-full mt-4 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2", children: [_jsx("span", { className: "text-lg", children: "\u26A1" }), "Load Example"] }))] })) }), !focusedSection && (_jsxs("div", { className: "border-t border-gray-700 bg-gray-850 px-4 py-3 flex items-center justify-between", children: [_jsx("button", { onClick: () => setCurrentLessonIndex(Math.max(0, currentLessonIndex - 1)), disabled: !hasPrev, className: `px-3 py-1.5 rounded text-sm transition-all ${hasPrev
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`, children: "Previous" }), _jsxs("div", { className: "text-xs text-gray-400", children: [currentLessonIndex + 1, " / ", SAMPLE_LESSONS.length] }), _jsx("button", { onClick: () => setCurrentLessonIndex(Math.min(SAMPLE_LESSONS.length - 1, currentLessonIndex + 1)), disabled: !hasNext, className: `px-3 py-1.5 rounded text-sm transition-all ${hasNext
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`, children: "Next" })] }))] }));
};
