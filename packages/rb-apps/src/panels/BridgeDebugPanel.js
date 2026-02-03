import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { hardwareClient } from '../services/hardwareClient';
export const BridgeDebugPanel = () => {
    const [state, setState] = useState(hardwareClient.getState());
    const [isOpen, setIsOpen] = useState(false);
    useEffect(() => {
        return hardwareClient.subscribe(setState);
    }, []);
    // HIDE IN PRODUCTION
    if (import.meta.env.PROD)
        return null;
    if (!isOpen) {
        return (_jsx("button", { onClick: () => setIsOpen(true), className: "fixed bottom-1 right-1 bg-red-900/80 text-[10px] text-white p-1 rounded z-[9999] hover:bg-red-800", children: "BRIDGE DEBUG" }));
    }
    return (_jsxs("div", { className: "fixed bottom-1 right-1 w-[400px] h-[300px] bg-black/90 border border-red-500/30 text-xs font-mono text-green-400 p-2 overflow-auto z-[9999] shadow-2xl", children: [_jsxs("div", { className: "flex justify-between items-center border-b border-gray-800 pb-1 mb-2", children: [_jsx("span", { className: "font-bold text-white", children: "BRIDGE TRUTH PANEL" }), _jsx("button", { onClick: () => setIsOpen(false), className: "text-red-500 hover:text-red-400", children: "[X]" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-gray-500 uppercase tracking-widest text-[10px]", children: "Connection State" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${state.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}` }), _jsx("span", { className: "font-bold", children: state.status.toUpperCase() })] }), state.status === 'connected' && (_jsxs("div", { className: "ml-4 text-gray-400", children: ["WS Connected: ", state.ws ? 'YES' : 'NO'] }))] }), _jsxs("div", { children: [_jsxs("div", { className: "text-gray-500 uppercase tracking-widest text-[10px] flex justify-between", children: [_jsx("span", { children: "Discovered Devices" }), _jsxs("span", { children: [state.status === 'connected' ? state.devices.length : 0, " found"] })] }), state.status === 'connected' && state.devices.length > 0 ? (_jsx("div", { className: "space-y-1 mt-1", children: state.devices.map((d, i) => (_jsxs("div", { className: "bg-gray-900 p-1 rounded border border-gray-800", children: [_jsxs("div", { className: "text-white font-bold", children: [d.deviceId, " ", _jsxs("span", { className: "text-gray-500", children: ["(", d.boardModel, ")"] })] }), _jsxs("div", { className: "text-gray-500 text-[10px]", children: ["Port: ", _jsx("span", { className: "text-yellow-500", children: d.runtime?.port || d.status })] }), _jsxs("div", { className: "text-gray-600 text-[10px]", children: ["Target: ", d.toolchain || 'unknown'] })] }, i))) })) : (_jsx("div", { className: "text-red-500 italic", children: "No devices found in Truth Store." }))] }), _jsxs("div", { children: [_jsx("div", { className: "text-gray-500 uppercase tracking-widest text-[10px]", children: "Message Log" }), _jsx("div", { className: "text-gray-400 opacity-50", children: state.status === 'offline' && state.message })] })] })] }));
};
