import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Classroom Edition Help Overlay
 *
 * 5-step quickstart + keyboard shortcuts cheat sheet
 * Toggleable via '?' key
 */
import { useEffect, useState } from 'react';
export const HelpOverlay = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('quickstart');
    // Listen for '?' key to toggle
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === '?' || e.key === '/') && !e.ctrlKey && !e.metaKey) {
                // Only toggle if not typing in an input
                const target = e.target;
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-gray-800 border border-gray-600 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "sticky top-0 bg-gray-900 border-b border-gray-600 p-6 flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-bold text-cyan-400", children: "RedByte Logic Playground" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-200 text-3xl leading-none", children: "\u00D7" })] }), _jsx("div", { className: "border-b border-gray-600 px-6", children: _jsxs("div", { className: "flex gap-4", children: [_jsx("button", { onClick: () => setActiveTab('quickstart'), className: `py-3 px-4 border-b-2 font-medium transition-colors ${activeTab === 'quickstart'
                                    ? 'border-cyan-400 text-cyan-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-300'}`, children: "Quickstart" }), _jsx("button", { onClick: () => setActiveTab('shortcuts'), className: `py-3 px-4 border-b-2 font-medium transition-colors ${activeTab === 'shortcuts'
                                    ? 'border-cyan-400 text-cyan-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-300'}`, children: "Keyboard Shortcuts" })] }) }), _jsxs("div", { className: "p-6 space-y-6", children: [activeTab === 'quickstart' && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-xl font-bold text-cyan-300 mb-4", children: "5-Step Quickstart" }), _jsxs("div", { className: "border-l-4 border-cyan-500 pl-4", children: [_jsx("h3", { className: "font-bold text-lg text-white mb-2", children: "1. Load an Example (or Start Blank)" }), _jsxs("p", { className: "text-gray-300 text-sm mb-3", children: ["Click ", _jsx("code", { className: "bg-gray-900 px-2 py-1 rounded", children: "Examples" }), " in the top menu to choose from 6 pre-built circuits, or start with an empty workspace."] }), _jsx("p", { className: "text-gray-400 text-xs italic", children: "Your work auto-saves every 3 seconds, so you won't lose progress!" })] }), _jsxs("div", { className: "border-l-4 border-blue-500 pl-4", children: [_jsx("h3", { className: "font-bold text-lg text-white mb-2", children: "2. Build Your Circuit" }), _jsxs("p", { className: "text-gray-300 text-sm mb-3", children: ["Drag components from the palette on the left. Connect them with wires. Use the", _jsx("code", { className: "bg-gray-900 px-2 py-1 rounded ml-1", children: "Delete" }), " key to remove selected items."] }), _jsx("p", { className: "text-gray-400 text-xs italic", children: "Pro tip: Right-click to pan the view. Scroll to zoom." })] }), _jsxs("div", { className: "border-l-4 border-purple-500 pl-4", children: [_jsx("h3", { className: "font-bold text-lg text-white mb-2", children: "3. Run a Simulation" }), _jsxs("p", { className: "text-gray-300 text-sm mb-3", children: ["Click ", _jsx("code", { className: "bg-gray-900 px-2 py-1 rounded", children: "Run" }), " to start simulating. Flip switches to change inputs. Watch lamps light up as outputs change."] }), _jsxs("p", { className: "text-gray-400 text-xs italic", children: ["Use ", _jsx("code", { className: "bg-gray-900 px-2 py-1 rounded", children: "Step" }), " to advance one tick at a time."] })] }), _jsxs("div", { className: "border-l-4 border-green-500 pl-4", children: [_jsx("h3", { className: "font-bold text-lg text-white mb-2", children: "4. Analyze Results" }), _jsxs("p", { className: "text-gray-300 text-sm mb-3", children: ["Switch to ", _jsx("code", { className: "bg-gray-900 px-2 py-1 rounded", children: "Analyze" }), " view to see signal traces over time. Click on nodes to add probes to the oscilloscope."] }), _jsx("p", { className: "text-gray-400 text-xs italic", children: "This helps you debug timing issues and verify logic correctness." })] }), _jsxs("div", { className: "border-l-4 border-yellow-500 pl-4", children: [_jsx("h3", { className: "font-bold text-lg text-white mb-2", children: "5. Export & Submit" }), _jsxs("p", { className: "text-gray-300 text-sm mb-3", children: ["Click ", _jsx("code", { className: "bg-gray-900 px-2 py-1 rounded", children: "Export" }), " to download your circuit as JSON. Submit it to your professor or LMS."] }), _jsx("p", { className: "text-gray-400 text-xs italic", children: "Your autosaved work is safe in the browser until you reset." })] })] })), activeTab === 'shortcuts' && (_jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "text-xl font-bold text-cyan-300 mb-4", children: "Keyboard Shortcuts" }), _jsx("div", { className: "space-y-3", children: [
                                        { key: 'Ctrl/Cmd+Z', action: 'Undo' },
                                        { key: 'Ctrl/Cmd+Y', action: 'Redo' },
                                        { key: 'Delete', action: 'Delete selected item' },
                                        { key: 'Ctrl/Cmd+S', action: 'Save project' },
                                        { key: 'Space', action: 'Play/Pause simulation' },
                                        { key: 'R', action: 'Reset simulation' },
                                        { key: 'S', action: 'Step one tick' },
                                        { key: '?', action: 'Toggle this help' },
                                        { key: 'Tab', action: 'Cycle perspectives' },
                                        { key: 'Right-Click + Drag', action: 'Pan view' },
                                        { key: 'Scroll', action: 'Zoom in/out' },
                                    ].map((item, i) => (_jsxs("div", { className: "flex items-start justify-between bg-gray-900/50 p-3 rounded border border-gray-700", children: [_jsx("code", { className: "bg-gray-800 px-3 py-1 rounded text-cyan-400 font-mono text-sm", children: item.key }), _jsx("span", { className: "text-gray-300 text-sm ml-4", children: item.action })] }, i))) })] }))] }), _jsxs("div", { className: "border-t border-gray-600 bg-gray-900 p-4 text-center text-sm text-gray-400", children: ["Press ", _jsx("code", { className: "bg-gray-800 px-2 py-1 rounded", children: "?" }), " anytime to open this help"] })] }) }));
};
