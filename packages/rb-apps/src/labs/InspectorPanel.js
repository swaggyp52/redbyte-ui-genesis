import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState } from 'react';
import { useHardwareStore } from '../stores/hardwareStore';
import { loadCapsuleFromFS } from '../utils/traceFileUtils';
import { PanelLayout } from '../components/PanelLayout';
export const InspectorPanel = () => {
    const [capsule, setCapsule] = useState(null);
    const [error, setError] = useState(null);
    const disconnect = useHardwareStore((s) => s.disconnect);
    // For file picker (MVP: Text input for file path/ID)
    // Ideally use FS modal, but input is faster for MVP
    const [fileId, setFileId] = useState('');
    const handleLoad = async () => {
        setError(null);
        if (!fileId)
            return;
        const loaded = await loadCapsuleFromFS(fileId);
        if (loaded) {
            setCapsule(loaded);
        }
        else {
            setError('Failed to load. Check Filename/ID.');
        }
    };
    const handleWatchTrace = async () => {
        if (!capsule?.trace) {
            setError('No trace in capsule.');
            return;
        }
        // Safety: disconnect live hardware first
        disconnect();
    };
    return (_jsxs(PanelLayout, { className: "w-80 border-l border-gray-800 bg-gray-900", header: _jsx("div", { className: "flex items-center justify-between", children: _jsx("span", { className: "font-bold text-gray-100", children: "Inspector" }) }), bodyClassName: "p-4", children: [_jsxs("div", { className: "flex gap-2 mb-6", children: [_jsx("input", { type: "text", value: fileId, onChange: e => setFileId(e.target.value), placeholder: "Enter filename (e.g. lab1-evidence...)", className: "flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500" }), _jsx("button", { onClick: handleLoad, className: "bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded font-medium", children: "Load" })] }), error && (_jsx("div", { className: "p-3 bg-red-900/20 border border-red-900 rounded mb-4 text-xs text-red-400", children: error })), capsule ? (_jsxs("div", { className: "space-y-4 animate-fade-in", children: [_jsxs("div", { className: `p-4 rounded-lg border flex items-center justify-between ${capsule.result?.status === 'pass'
                            ? 'bg-green-900/20 border-green-800'
                            : 'bg-red-900/20 border-red-800'}`, children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] items-center text-gray-500 uppercase font-bold", children: "Status" }), _jsx("div", { className: `text-lg font-bold ${capsule.result?.status === 'pass' ? 'text-green-400' : 'text-red-400'}`, children: capsule.result?.status === 'pass' ? 'PASSED' : 'INCOMPLETE' })] }), _jsxs("div", { className: "text-xs text-gray-400 font-mono text-right", children: [new Date(capsule.timestamp).toLocaleTimeString(), _jsx("div", { className: "text-[10px] opacity-50", children: new Date(capsule.timestamp).toLocaleDateString() })] })] }), _jsxs("div", { className: "bg-gray-800/50 rounded-lg p-3 space-y-2", children: [_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-gray-500", children: "Lab ID" }), _jsx("span", { className: "text-gray-300 font-mono", children: capsule.labId })] }), _jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-gray-500", children: "Board" }), _jsx("span", { className: "text-gray-300 font-mono", children: capsule.deviceBoardId || 'N/A' })] }), _jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-gray-500", children: "Key" }), _jsx("span", { className: "text-gray-300 font-mono truncate max-w-[120px]", title: capsule.deviceKey, children: capsule.deviceKey || 'N/A' })] }), _jsxs("div", { className: "flex justify-between text-xs border-t border-gray-700 pt-2 mt-2", children: [_jsx("span", { className: "text-gray-500", children: "Trace Samples" }), _jsx("span", { className: "text-cyan-400 font-mono", children: capsule.trace?.samples.length || 0 })] })] }), _jsxs("button", { onClick: () => window.dispatchEvent(new CustomEvent('rb:load-replay', { detail: capsule.trace })), className: "w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-bold flex items-center justify-center gap-2", children: [_jsx("span", { children: "\u25B6" }), " Watch Replay"] }), _jsx("div", { className: "text-[10px] text-gray-500 text-center", children: "Click to load trace into player" })] })) : (_jsx("div", { className: "text-center py-8 text-gray-600 text-xs", children: "No evidence loaded." }))] }));
};
