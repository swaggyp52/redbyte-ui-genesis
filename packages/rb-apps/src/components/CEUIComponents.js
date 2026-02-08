import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Classroom Edition UI Components
 *
 * - Reset Workspace Modal
 * - Example Gallery/Launcher
 * - Export/Submit Bundle Dialog
 */
import { useState, useCallback } from 'react';
import { getCEConfig } from '@redbyte/rb-utils';
import { OverlayRoot, OverlayPanel } from '@redbyte/rb-primitives';
import { clearAutosaveStorage } from '../utils/ceAutosave';
export const ResetWorkspaceModal = ({ isOpen, onConfirm, onCancel, }) => {
    const handleConfirm = () => {
        clearAutosaveStorage();
        onConfirm();
        // Reload page to reset app state
        window.location.reload();
    };
    if (!isOpen)
        return null;
    return (_jsx(OverlayRoot, { className: "bg-black/70 backdrop-blur-sm flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800/95 border border-gray-600 rounded-xl p-6 max-w-md shadow-2xl", children: [_jsx("h2", { className: "text-xl font-bold mb-4 text-cyan-400", children: "Reset Workspace?" }), _jsx("p", { className: "text-gray-300 mb-2", children: "This will:" }), _jsxs("ul", { className: "text-sm text-gray-400 mb-6 space-y-1.5", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-red-400", children: "\u2022" }), " Clear all saved circuits and state"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-red-400", children: "\u2022" }), " Close any open windows"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-red-400", children: "\u2022" }), " Return to a fresh workspace"] })] }), _jsx("p", { className: "text-sm text-gray-400 mb-6", children: _jsx("strong", { className: "text-white", children: "This action cannot be undone." }) }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: onCancel, className: "flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-700 rounded-lg transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-gray-500", children: "Cancel" }), _jsx("button", { onClick: handleConfirm, className: "flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-lg font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-500", children: "Reset" })] })] }) }));
};
export const ExampleGalleryModal = ({ isOpen, examples, onSelectExample, onClose, }) => {
    const [selectedWeek, setSelectedWeek] = useState('all');
    const filtered = selectedWeek === 'all' ? examples : examples.filter((e) => e.week === selectedWeek);
    if (!isOpen)
        return null;
    return (_jsx(OverlayRoot, { className: "bg-black/70 backdrop-blur-sm flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800/95 border border-gray-600 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-xl font-bold text-cyan-400", children: "Example Gallery" }), _jsx("button", { onClick: onClose, className: "w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/50", children: "\u00D7" })] }), _jsx("div", { className: "flex gap-2 mb-4", children: ['all', 0, 1, 2].map((week) => (_jsx("button", { onClick: () => setSelectedWeek(week), className: `px-4 py-1.5 text-sm rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${selectedWeek === week
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-[1.02]'}`, children: week === 'all' ? 'All' : `Week ${week}` }, week))) }), _jsx("div", { className: "flex-1 overflow-y-auto pr-1", children: _jsx("div", { className: "grid gap-3", children: filtered.map((example) => (_jsxs("button", { onClick: () => {
                                onSelectExample(example);
                                onClose();
                            }, className: "text-left p-4 bg-gray-700/80 hover:bg-gray-600 border border-gray-600 hover:border-cyan-500 rounded-lg transition-all duration-150 hover:scale-[1.01] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("h3", { className: "font-bold text-cyan-400", children: example.title }), _jsxs("span", { className: "text-xs bg-gray-800 px-2 py-1 rounded-md text-gray-400", children: ["Week ", example.week] })] }), _jsx("p", { className: "text-sm text-gray-300 mb-2", children: example.description }), _jsxs("p", { className: "text-xs text-gray-500", children: [example.circuit.nodes.length, " nodes \u2022", ' ', example.circuit.connections.length, " connections"] })] }, example.id))) }) })] }) }));
};
export const ExportBundleModal = ({ isOpen, circuit, exampleName, onClose, }) => {
    const [copied, setCopied] = useState(false);
    const generateBundle = useCallback(() => {
        const bundle = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            exampleName: exampleName || 'Circuit',
            circuit,
            metadata: {
                nodeCount: circuit.nodes.length,
                connectionCount: circuit.connections.length,
            },
        };
        return JSON.stringify(bundle, null, 2);
    }, [circuit, exampleName]);
    const handleDownload = () => {
        const bundle = generateBundle();
        const blob = new Blob([bundle], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `circuit-${exampleName || 'export'}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const handleCopy = () => {
        const bundle = generateBundle();
        navigator.clipboard.writeText(bundle).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    if (!isOpen)
        return null;
    return (_jsx(OverlayRoot, { className: "bg-black/70 backdrop-blur-sm flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800/95 border border-gray-600 rounded-xl p-6 max-w-md shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-xl font-bold text-cyan-400", children: "Export Circuit" }), _jsx("button", { onClick: onClose, className: "w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/50", children: "\u00D7" })] }), _jsx("div", { className: "mb-4 p-3 bg-gray-900/80 border border-gray-600 rounded-lg text-sm text-gray-300", children: _jsxs("p", { className: "font-mono break-all text-cyan-300", children: ["circuit-", exampleName || 'export', "-", Date.now(), ".json"] }) }), _jsx("p", { className: "text-sm text-gray-400 mb-6", children: "Download your circuit as a JSON bundle, or copy it to submit to your LMS or share." }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleCopy, className: `flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 ${copied
                                ? 'bg-green-600 text-white shadow-lg shadow-green-500/20 focus:ring-green-500/50'
                                : 'bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-500/50'}`, children: copied ? '✓ Copied!' : 'Copy JSON' }), _jsx("button", { onClick: handleDownload, className: "flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-500/50", children: "Download" })] }), _jsx("button", { onClick: onClose, className: "w-full mt-3 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-gray-500", children: "Close" })] }) }));
};
export const CEControlButton = ({ action, onClick, }) => {
    const config = getCEConfig();
    if (!config.enabled)
        return null;
    const labels = {
        reset: 'Reset',
        examples: 'Examples',
        export: 'Export',
    };
    const colors = {
        reset: 'bg-red-600 hover:bg-red-500 active:bg-red-700 focus:ring-red-500/50',
        examples: 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 focus:ring-cyan-500/50',
        export: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 focus:ring-blue-500/50',
    };
    return (_jsx("button", { onClick: onClick, className: `px-3 py-1.5 text-sm ${colors[action]} text-white rounded-md font-medium transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-2`, title: labels[action], children: labels[action] }));
};
