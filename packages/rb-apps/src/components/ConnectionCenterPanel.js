import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Icon } from '@redbyte/rb-icons';
import { useHardwareSessionStore } from '../stores/hardwareSessionStore';
import { useCapabilitiesStore } from '../stores/capabilitiesStore';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';
/**
 * ConnectionCenterPanel: The single source of truth for Hardware/System status.
 * Reusable across Labs, Shell, and Diagnostics.
 *
 * PHASE 1 Task 1.6: Connection Stability Hardening
 * Enhanced with:
 * - "Connecting..." state with spinner
 * - "Reconnecting" state with retry indicator
 * - Error states with actionable messages
 * - Bridge offline/unavailable guidance
 */
export const ConnectionCenterPanel = () => {
    const { bridge, sessions, ensureSession, disconnect } = useHardwareSessionStore();
    const { hardware: hwCap, studentMode } = useCapabilitiesStore();
    const { hardwareSnapshots } = useLabWorkflowStore();
    const isBasys3Connected = sessions.basys3.status === 'connected';
    const isBasys3Connecting = sessions.basys3.status === 'connecting';
    const bridgeStatus = bridge.status;
    // PHASE 1.6: Helper to get actionable error messages
    const getErrorGuidance = (error) => {
        if (!error)
            return { message: '', action: '' };
        if (error.includes('Device not found')) {
            return {
                message: 'Board not detected',
                action: 'Check USB connection and power. Verify COM port.'
            };
        }
        if (error.includes('Connection refused') || error.includes('timeout')) {
            return {
                message: 'Connection timed out',
                action: 'Restart bridge agent or replug device.'
            };
        }
        if (error.includes('port') && error.includes('use')) {
            return {
                message: 'Port already in use',
                action: 'Close other applications using this port.'
            };
        }
        return { message: error, action: 'Check hardware connections and try again.' };
    };
    const errorGuidance = getErrorGuidance(sessions.basys3.error);
    return (_jsxs("div", { className: "flex flex-col gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-800 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2.5 h-2.5 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                    bridgeStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                                        'bg-red-500'}` }), _jsxs("span", { className: "text-xs font-black uppercase tracking-widest text-slate-400", children: ["Bridge: ", bridgeStatus === 'connecting' ? 'CONNECTING...' : bridgeStatus.toUpperCase()] })] }), bridgeStatus === 'online' && (_jsxs("span", { className: "text-[10px] font-mono text-slate-500", children: ["v", bridge.version || '1.0.0'] })), bridgeStatus === 'connecting' && (_jsx("span", { className: "text-[10px] text-amber-400 animate-pulse", children: "\u27F3 Handshaking..." })), bridgeStatus === 'disconnected' && (_jsx("span", { className: "text-[10px] text-red-400", children: "\u26A0 Offline" }))] }), bridgeStatus === 'disconnected' && (_jsx("div", { className: "bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1", children: _jsxs("div", { className: "flex items-start gap-2", children: [React.createElement(Icon, { name: 'browser', size: 14, className: 'text-red-400 mt-0.5' }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-xs font-bold text-red-300", children: "Bridge Agent Not Running" }), _jsxs("span", { className: "text-[10px] text-slate-400", children: ["Start RedByte Bridge or run: ", _jsx("code", { className: "bg-slate-950 px-1 py-0.5 rounded text-amber-400", children: "pnpm bridge:start" })] })] })] }) })), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex flex-col", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-bold text-white", children: "Basys 3 Board" }), isBasys3Connecting && (_jsx("span", { className: "text-[10px] text-amber-400 animate-pulse", children: "\u27F3" }))] }), _jsx("span", { className: "text-[10px] text-slate-500 font-mono", children: isBasys3Connected ? `Connected on ${sessions.basys3.port}` :
                                            isBasys3Connecting ? 'Connecting...' :
                                                'Not connected' })] }), _jsx("button", { onClick: () => isBasys3Connected ? disconnect('basys3') : ensureSession('basys3', 'COM7'), disabled: bridgeStatus !== 'online' || isBasys3Connecting, className: `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isBasys3Connected
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                    : isBasys3Connecting
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-wait'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'}`, children: isBasys3Connected ? 'Disconnect' :
                                    isBasys3Connecting ? 'Connecting...' :
                                        'Connect COM7' })] }), isBasys3Connected && (_jsxs("div", { className: "bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-2", children: [_jsxs("div", { className: "flex justify-between items-center text-[10px] text-slate-600 font-black uppercase tracking-tighter", children: [_jsx("span", { children: "Live I/O Heartbeat" }), _jsxs("span", { className: "text-indigo-400 flex items-center gap-1", children: [_jsx("span", { className: "w-1 h-1 bg-indigo-500 rounded-full animate-ping" }), "Active"] })] }), _jsxs("div", { className: "flex justify-between font-mono text-[11px] text-slate-300", children: [_jsx("span", { children: "Last Data:" }), _jsx("span", { children: sessions.basys3.lastIoAt ? new Date(sessions.basys3.lastIoAt).toLocaleTimeString() : 'Never' })] })] }))] }), _jsxs("div", { className: "pt-2 border-t border-slate-800", children: [_jsxs("div", { className: "flex justify-between items-end mb-2", children: [_jsx("span", { className: "text-[10px] font-black uppercase tracking-widest text-slate-500", children: "Collected Evidence" }), _jsxs("span", { className: "text-xs font-bold text-emerald-400", children: [hardwareSnapshots.length, " Snapshots"] })] }), !isBasys3Connected && (_jsx("div", { className: "py-8 text-center text-slate-600 italic text-xs", children: "Connect hardware to capture proofs." }))] }), sessions.basys3.error && (_jsxs("div", { className: "bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2", children: [_jsxs("div", { className: "flex items-start gap-2", children: [React.createElement(Icon, { name: 'browser', size: 14, className: 'text-red-400 mt-0.5' }), _jsxs("div", { className: "flex flex-col gap-1 flex-1", children: [_jsx("span", { className: "text-xs font-bold text-red-300", children: errorGuidance.message }), _jsx("span", { className: "text-[10px] text-slate-400 leading-relaxed", children: errorGuidance.action })] })] }), _jsx("button", { onClick: () => disconnect('basys3'), className: "w-full py-1.5 text-[10px] font-bold bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded border border-slate-700/50 transition-colors", children: "Clear Error & Retry" })] }))] }));
};
