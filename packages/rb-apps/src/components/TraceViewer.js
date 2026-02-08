import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useMemo } from 'react';
export const TraceViewer = ({ traces, circuit, currentTick, onSeekToTick, onClose, }) => {
    const [selectedTick, setSelectedTick] = useState(null);
    const [filter, setFilter] = useState('');
    const tickToShow = selectedTick ?? currentTick;
    const currentTrace = useMemo(() => {
        return traces.find((t) => t.tick === tickToShow);
    }, [traces, tickToShow]);
    const filteredChanges = useMemo(() => {
        if (!currentTrace)
            return [];
        return currentTrace.changedNodes.filter((nodeId) => {
            if (!filter)
                return true;
            const node = circuit.nodes.find((n) => n.id === nodeId);
            return node?.type.toLowerCase().includes(filter.toLowerCase()) ||
                nodeId.toLowerCase().includes(filter.toLowerCase());
        });
    }, [currentTrace, filter, circuit.nodes]);
    const stats = useMemo(() => {
        if (traces.length === 0)
            return null;
        const totalChanges = traces.reduce((sum, t) => sum + t.changedNodes.length, 0);
        return {
            totalTicks: traces.length,
            totalChanges,
            avgChangesPerTick: (totalChanges / traces.length).toFixed(1),
        };
    }, [traces]);
    const handleSeek = (tick) => {
        setSelectedTick(tick);
        if (onSeekToTick) {
            onSeekToTick(tick);
        }
    };
    if (traces.length === 0) {
        return (_jsx("div", { className: "h-full flex items-center justify-center bg-gray-900 text-gray-400", children: _jsxs("div", { className: "text-center p-8", children: [_jsx("svg", { className: "w-16 h-16 mx-auto mb-4 text-gray-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) }), _jsx("h3", { className: "text-lg font-semibold text-white mb-2", children: "No Trace Data" }), _jsx("p", { className: "text-sm", children: "Start the simulation to begin recording execution trace" })] }) }));
    }
    const tickRange = { min: traces[0].tick, max: traces[traces.length - 1].tick };
    return (_jsxs("div", { className: "h-full flex flex-col bg-gray-900", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-700", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-white", children: "Execution Trace" }), _jsxs("p", { className: "text-xs text-gray-400 mt-1", children: ["Viewing tick ", tickToShow, " of ", tickRange.max] })] }), onClose && (_jsx("button", { onClick: onClose, className: "px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-white", children: "Close" }))] }), stats && (_jsxs("div", { className: "px-4 py-2 bg-gray-850 border-b border-gray-700 flex items-center gap-6 text-xs", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-400", children: "Total Ticks:" }), ' ', _jsx("span", { className: "text-cyan-400 font-mono", children: stats.totalTicks })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-400", children: "Total Changes:" }), ' ', _jsx("span", { className: "text-cyan-400 font-mono", children: stats.totalChanges })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-400", children: "Avg Changes/Tick:" }), ' ', _jsx("span", { className: "text-cyan-400 font-mono", children: stats.avgChangesPerTick })] })] })), _jsxs("div", { className: "px-4 py-3 border-b border-gray-700 bg-gray-850", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("button", { onClick: () => handleSeek(Math.max(tickRange.min, tickToShow - 1)), disabled: tickToShow <= tickRange.min, className: "px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-gray-700 text-white", children: "\u25C0 Prev" }), _jsx("input", { type: "range", min: tickRange.min, max: tickRange.max, value: tickToShow, onChange: (e) => handleSeek(parseInt(e.target.value)), className: "flex-1", "aria-label": "Timeline tick position" }), _jsx("button", { onClick: () => handleSeek(Math.min(tickRange.max, tickToShow + 1)), disabled: tickToShow >= tickRange.max, className: "px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-gray-700 text-white", children: "Next \u25B6" })] }), _jsxs("div", { className: "text-xs text-gray-400 text-center", children: ["Tick ", tickToShow, " / ", tickRange.max] })] }), _jsxs("div", { className: "flex-1 overflow-auto p-4", children: [_jsx("div", { className: "mb-4", children: _jsx("input", { type: "text", value: filter, onChange: (e) => setFilter(e.target.value), placeholder: "Filter by node type or ID...", className: "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500", "aria-label": "Filter by node type or ID" }) }), currentTrace ? (_jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsxs("h3", { className: "text-sm font-semibold text-white mb-2", children: ["Changed Nodes (", filteredChanges.length, ")"] }), filteredChanges.length === 0 ? (_jsx("p", { className: "text-xs text-gray-500 italic", children: "No changes this tick" })) : (_jsx("div", { className: "space-y-2", children: filteredChanges.map((nodeId) => {
                                        const node = circuit.nodes.find((n) => n.id === nodeId);
                                        if (!node)
                                            return null;
                                        const signals = Object.entries(currentTrace.signals)
                                            .filter(([key]) => key.startsWith(nodeId + '.'))
                                            .map(([key, value]) => ({
                                            port: key.split('.')[1],
                                            value,
                                        }));
                                        const state = currentTrace.nodeStates[nodeId];
                                        return (_jsxs("div", { className: "p-3 bg-gray-800 rounded border border-gray-700", children: [_jsx("div", { className: "flex items-center justify-between mb-2", children: _jsxs("div", { children: [_jsx("span", { className: "text-sm font-semibold text-cyan-400", children: node.type }), _jsx("span", { className: "text-xs text-gray-500 ml-2 font-mono", children: nodeId })] }) }), signals.length > 0 && (_jsxs("div", { className: "mt-2", children: [_jsx("div", { className: "text-xs text-gray-400 mb-1", children: "Outputs:" }), _jsx("div", { className: "flex flex-wrap gap-2", children: signals.map(({ port, value }) => (_jsxs("div", { className: "flex items-center gap-1 text-xs", children: [_jsxs("span", { className: "text-gray-400", children: [port, ":"] }), _jsx("span", { className: `font-mono px-1.5 py-0.5 rounded ${value === 1
                                                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                                            : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'}`, children: value })] }, port))) })] })), state && Object.keys(state).length > 0 && (_jsxs("div", { className: "mt-2", children: [_jsx("div", { className: "text-xs text-gray-400 mb-1", children: "State:" }), _jsx("div", { className: "text-xs font-mono text-white", children: JSON.stringify(state, null, 2) })] }))] }, nodeId));
                                    }) }))] }) })) : (_jsxs("div", { className: "text-center text-gray-500 py-8", children: ["No trace data for tick ", tickToShow] }))] })] }));
};
