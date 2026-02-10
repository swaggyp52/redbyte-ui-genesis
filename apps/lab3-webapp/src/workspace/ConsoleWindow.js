import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, Search, Download, Copy, Check } from 'lucide-react';
import useLabStore from '../store/labStore';
/**
 * ConsoleWindow: Enhanced event log with filtering, export, and copy-to-clipboard
 */
export const ConsoleWindow = () => {
    const events = useLabStore((s) => s.events);
    const [searchFilter, setSearchFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [autoScroll, setAutoScroll] = useState(true);
    const [copiedId, setCopiedId] = useState(null);
    const scrollRef = useRef(null);
    // Auto-scroll to bottom on new events
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events, autoScroll]);
    // Get unique event types for filtering
    const eventTypes = useMemo(() => {
        const types = new Set();
        events.forEach((evt) => {
            types.add(evt.type);
        });
        return Array.from(types).sort();
    }, [events]);
    // Filter events by type and search
    const filteredEvents = useMemo(() => {
        return events.filter((evt) => {
            // Type filter
            if (typeFilter !== 'all' && evt.type !== typeFilter) {
                return false;
            }
            // Search filter
            const searchLower = searchFilter.toLowerCase();
            if (!searchLower)
                return true;
            const typeMatch = evt.type.toLowerCase().includes(searchLower);
            const payloadStr = JSON.stringify(evt.payload).toLowerCase();
            const payloadMatch = payloadStr.includes(searchLower);
            return typeMatch || payloadMatch;
        });
    }, [events, searchFilter, typeFilter]);
    const handleClearEvents = () => {
        useLabStore.getState().discardRecovery();
    };
    const handleExportLog = () => {
        const json = JSON.stringify(events, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab3-console-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const handleCopyEvent = (id, content) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };
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
    const getEventColor = (type) => {
        switch (type) {
            case 'set-table-row':
                return 'text-cyan-400';
            case 'fill-digits':
                return 'text-emerald-400';
            case 'set-expression':
                return 'text-blue-400';
            case 'import':
                return 'text-purple-400';
            case 'export':
                return 'text-amber-400';
            case 'error':
                return 'text-red-400';
            default:
                return 'text-slate-400';
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full gap-3", children: [_jsxs("div", { className: "flex gap-2 items-center", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx(Search, { size: 16, className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" }), _jsx("input", { type: "text", placeholder: "Search events...", value: searchFilter, onChange: (e) => setSearchFilter(e.target.value), className: "w-full bg-slate-700/50 border border-slate-600 rounded px-3 py-2 pl-9 text-sm font-tech text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all duration-200" })] }), _jsxs("button", { onClick: handleExportLog, className: "px-3 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 rounded border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 font-tech text-sm transition-all duration-200 flex items-center gap-2", title: "Export console log as JSON", children: [_jsx(Download, { size: 14 }), "Export"] }), _jsxs("button", { onClick: handleClearEvents, className: "px-3 py-2 bg-red-600/30 hover:bg-red-600/50 rounded border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 font-tech text-sm transition-all duration-200 flex items-center gap-2", title: "Clear all events", children: [_jsx(Trash2, { size: 14 }), "Clear"] })] }), eventTypes.length > 0 && (_jsxs("div", { className: "flex gap-1 overflow-x-auto pb-2", children: [_jsxs("button", { onClick: () => setTypeFilter('all'), className: `px-2 py-1 text-xs font-tech rounded border whitespace-nowrap transition-all duration-200 ${typeFilter === 'all'
                            ? 'bg-cyan-500/30 border-cyan-500/60 text-cyan-300'
                            : 'bg-slate-700/30 border-slate-600/30 text-slate-400 hover:border-slate-500'}`, children: ["All (", events.length, ")"] }), eventTypes.map((type) => {
                        const count = events.filter((e) => e.type === type).length;
                        return (_jsxs("button", { onClick: () => setTypeFilter(type), className: `px-2 py-1 text-xs font-tech rounded border whitespace-nowrap transition-all duration-200 ${typeFilter === type
                                ? `${getEventColor(type)} border-current/50 bg-slate-700/50`
                                : 'bg-slate-700/30 border-slate-600/30 text-slate-400 hover:border-slate-500'}`, children: [type, " (", count, ")"] }, type));
                    })] })), _jsxs("div", { className: "text-xs text-slate-500 font-tech", children: [filteredEvents.length, " / ", events.length, " events", typeFilter !== 'all' && ` | Filter: ${typeFilter}`] }), _jsx("div", { ref: scrollRef, className: "flex-1 overflow-y-auto bg-slate-900/30 rounded border border-slate-700/50 p-3 font-mono text-xs space-y-1", onScroll: (e) => {
                    const target = e.currentTarget;
                    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10;
                    setAutoScroll(isAtBottom);
                }, children: filteredEvents.length === 0 ? (_jsx("div", { className: "text-slate-500 text-center py-8", children: events.length === 0 ? 'No events logged yet' : 'No events match filter' })) : (filteredEvents.map((evt) => {
                    const eventContent = `[${formatTimestamp(evt.ts)}] ${evt.type}: ${formatPayload(evt.payload)}`;
                    return (_jsxs("div", { className: "text-slate-300 hover:bg-slate-700/30 px-2 py-1 rounded transition-colors duration-150 flex gap-2 group", children: [_jsxs("span", { className: "text-slate-600 flex-shrink-0", children: ["[", formatTimestamp(evt.ts), "]"] }), _jsxs("span", { className: `flex-shrink-0 font-semibold ${getEventColor(evt.type)}`, children: [evt.type, ":"] }), _jsx("span", { className: "text-slate-400 truncate flex-1", children: formatPayload(evt.payload) }), _jsx("button", { onClick: () => handleCopyEvent(evt.id, eventContent), className: "opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-slate-600/50 rounded", title: "Copy event to clipboard", children: copiedId === evt.id ? (_jsx(Check, { size: 12, className: "text-emerald-400" })) : (_jsx(Copy, { size: 12, className: "text-slate-500" })) })] }, evt.id));
                })) }), _jsx("button", { onClick: () => setAutoScroll(!autoScroll), className: `text-xs font-tech px-2 py-1 rounded border transition-all duration-200 ${autoScroll
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-700/30 border-slate-600/50 text-slate-500 hover:border-slate-500'}`, children: autoScroll ? '✓ Auto-scroll' : 'Auto-scroll off' })] }));
};
