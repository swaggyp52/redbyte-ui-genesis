import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Trash2, Search } from 'lucide-react';
import useLabStore from '../store/labStore';
/**
 * ConsoleWindow: Displays event log with search and clear functionality
 */
export const ConsoleWindow = () => {
    const events = useLabStore((s) => s.events);
    const [searchFilter, setSearchFilter] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollRef = useRef(null);
    // Auto-scroll to bottom on new events
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events, autoScroll]);
    const handleClearEvents = () => {
        useLabStore.getState().discardRecovery();
    };
    // Filter events by type or payload
    const filteredEvents = events.filter((evt) => {
        const searchLower = searchFilter.toLowerCase();
        const typeMatch = evt.type.toLowerCase().includes(searchLower);
        const payloadStr = JSON.stringify(evt.payload).toLowerCase();
        const payloadMatch = payloadStr.includes(searchLower);
        return typeMatch || payloadMatch;
    });
    const formatTimestamp = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    const formatPayload = (payload) => {
        if (!payload)
            return '';
        if (typeof payload === 'string')
            return payload;
        if (typeof payload === 'number')
            return `${payload}`;
        if (typeof payload === 'boolean')
            return `${payload}`;
        if (typeof payload === 'object') {
            const obj = payload;
            const entries = Object.entries(obj)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ');
            return entries;
        }
        return JSON.stringify(payload);
    };
    return (_jsxs("div", { className: "flex flex-col h-full gap-3", children: [_jsxs("div", { className: "flex gap-2 items-center", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx(Search, { size: 16, className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" }), _jsx("input", { type: "text", placeholder: "Filter events...", value: searchFilter, onChange: (e) => setSearchFilter(e.target.value), className: "w-full bg-slate-700/50 border border-slate-600 rounded px-3 py-2 pl-9 text-sm font-tech text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all duration-200" })] }), _jsxs("button", { onClick: handleClearEvents, className: "px-3 py-2 bg-red-600/30 hover:bg-red-600/50 rounded border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 font-tech text-sm transition-all duration-200 flex items-center gap-2", title: "Clear all events", children: [_jsx(Trash2, { size: 14 }), "Clear"] })] }), _jsxs("div", { className: "text-xs text-slate-500 font-tech", children: [filteredEvents.length, " / ", events.length, " events"] }), _jsx("div", { ref: scrollRef, className: "flex-1 overflow-y-auto bg-slate-900/30 rounded border border-slate-700/50 p-3 font-mono text-xs space-y-1", onScroll: (e) => {
                    const target = e.currentTarget;
                    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10;
                    setAutoScroll(isAtBottom);
                }, children: filteredEvents.length === 0 ? (_jsx("div", { className: "text-slate-500 text-center py-8", children: "No events yet" })) : (filteredEvents.map((evt) => (_jsxs("div", { className: "text-slate-300 hover:bg-slate-700/30 px-2 py-1 rounded transition-colors duration-150 flex gap-2", children: [_jsxs("span", { className: "text-slate-600 flex-shrink-0", children: ["[", formatTimestamp(evt.ts), "]"] }), _jsxs("span", { className: "text-cyan-400 flex-shrink-0", children: [evt.type, ":"] }), _jsx("span", { className: "text-slate-400 truncate", children: formatPayload(evt.payload) })] }, evt.id)))) }), _jsx("button", { onClick: () => setAutoScroll(!autoScroll), className: `text-xs font-tech px-2 py-1 rounded border transition-all duration-200 ${autoScroll
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-700/30 border-slate-600/50 text-slate-500 hover:border-slate-500'}`, children: autoScroll ? '✓ Auto-scroll' : 'Auto-scroll off' })] }));
};
