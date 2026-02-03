import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useHardwareSessionStore } from '../stores/hardwareSessionStore';
export const TruthHUD = () => {
    const { bridge, devices, sessions } = useHardwareSessionStore();
    const [isExpanded, setIsExpanded] = useState(false);
    // Derive real latency from IO timestamp deltas
    const lastIoRef = useRef(null);
    const [latencyMs, setLatencyMs] = useState(null);
    useEffect(() => {
        const interval = setInterval(() => {
            // Find the most recent IO timestamp across all sessions
            let newest = null;
            for (const target of Object.keys(sessions)) {
                const s = sessions[target];
                if (s.lastIoAt && (newest === null || s.lastIoAt > newest)) {
                    newest = s.lastIoAt;
                }
            }
            if (newest && lastIoRef.current && newest !== lastIoRef.current) {
                setLatencyMs(newest - lastIoRef.current);
            }
            lastIoRef.current = newest;
        }, 1000);
        return () => clearInterval(interval);
    }, [sessions]);
    // Auto-boot if not already booted
    useEffect(() => {
        useHardwareSessionStore.getState().boot();
    }, []);
    const getStatusColor = (status) => {
        switch (status) {
            case 'online':
            case 'connected': return '#10b981'; // Emerald
            case 'connecting': return '#fbbf24'; // Amber
            case 'error': return '#ef4444'; // Red
            default: return '#6b7280'; // Gray
        }
    };
    const getTimeAgo = (ts) => {
        if (!ts)
            return 'never';
        const seconds = Math.floor((Date.now() - ts) / 1000);
        if (seconds < 1)
            return 'now';
        return `${seconds}s ago`;
    };
    return (_jsx("div", { className: "fixed top-4 right-4 z-[9999] pointer-events-auto", onMouseEnter: () => setIsExpanded(true), onMouseLeave: () => setIsExpanded(false), children: _jsxs("div", { className: "bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden transition-all duration-300", style: { width: isExpanded ? '280px' : '180px' }, children: [_jsxs("div", { className: "p-2 border-b border-white/5 flex items-center justify-between bg-white/5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 rounded-full animate-pulse", style: { backgroundColor: getStatusColor(bridge.status) } }), _jsx("span", { className: "text-[10px] font-black uppercase tracking-widest text-white/90", children: "Truth HUD" })] }), _jsx("span", { className: "text-[8px] font-mono text-white/30", children: bridge.version || 'v?.?.?' })] }), _jsxs("div", { className: "p-3 space-y-3", children: [_jsx("div", { className: "space-y-1", children: _jsxs("div", { className: "flex justify-between text-[9px] uppercase font-bold text-white/40", children: [_jsx("span", { children: "Bridge" }), _jsx("span", { style: { color: getStatusColor(bridge.status) }, children: bridge.status })] }) }), isExpanded && (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "text-[8px] uppercase font-bold text-white/20 mb-1", children: ["Discovered (", devices.length, ")"] }), devices.map(d => (_jsxs("div", { className: "flex justify-between items-center text-[9px] font-mono bg-white/5 px-2 py-1 rounded border border-white/5", children: [_jsx("span", { className: "text-white/70", children: d.target === 'basys3' ? 'FPGA' : 'UNO' }), _jsx("span", { className: "text-white/30", children: d.port })] }, d.port))), devices.length === 0 && _jsx("div", { className: "text-[9px] italic text-white/20", children: "No hardware found." })] })), _jsx("div", { className: "space-y-2 pt-1 border-t border-white/5", children: Object.keys(sessions).map(target => {
                                const session = sessions[target];
                                if (session.status === 'idle' && !isExpanded)
                                    return null;
                                return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex justify-between text-[9px] font-bold", children: [_jsx("span", { className: "uppercase text-white/50", children: target }), _jsx("span", { style: { color: getStatusColor(session.status) }, children: session.status })] }), session.status === 'connected' && (_jsxs("div", { className: "flex justify-between text-[8px] font-mono text-white/30 pl-2 border-l border-white/10", children: [_jsxs("span", { children: ["IO: ", getTimeAgo(session.lastIoAt)] }), _jsxs("span", { children: ["#", session.messageCount] })] }))] }, target));
                            }) })] }), _jsxs("div", { className: "px-3 py-2 bg-white/5 border-t border-white/5 flex justify-between items-center", children: [_jsx("span", { className: "text-[8px] uppercase font-black text-white/20", children: "Lab 0 Baseline" }), isExpanded && _jsxs("span", { className: "text-[8px] text-white/40", children: ["Lat: ", latencyMs != null ? `${latencyMs}ms` : '—'] })] })] }) }));
};
