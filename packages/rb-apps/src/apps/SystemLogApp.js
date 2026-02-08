import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useMemo, useState } from 'react';
import { useSystemLogStore } from '../stores/systemLogStore';
import { Icon } from '@redbyte/rb-icons';
import { EmptyState } from '../components/EmptyState';
const levelStyles = {
    action: 'text-cyan-300',
    info: 'text-slate-300',
    warning: 'text-amber-300',
    error: 'text-red-300',
};
const SystemLogComponent = () => {
    const entries = useSystemLogStore((state) => state.entries);
    const markRead = useSystemLogStore((state) => state.markRead);
    const exportLog = useSystemLogStore((state) => state.exportLog);
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    useEffect(() => {
        markRead();
    }, [markRead]);
    const filtered = useMemo(() => {
        const lowered = query.trim().toLowerCase();
        return entries.filter((entry) => {
            if (filter !== 'all' && entry.level !== filter)
                return false;
            if (!lowered)
                return true;
            return (entry.message.toLowerCase().includes(lowered) ||
                entry.source.toLowerCase().includes(lowered) ||
                (entry.data ? JSON.stringify(entry.data).toLowerCase().includes(lowered) : false));
        });
    }, [entries, filter, query]);
    return (_jsxs("div", { className: "h-full flex flex-col bg-slate-950 text-slate-200", children: [_jsxs("div", { className: "px-5 py-4 border-b border-slate-800 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-lg font-semibold text-white", children: "System Log" }), _jsx("div", { className: "text-xs text-slate-500 uppercase tracking-[0.2em]", children: "Append-only audit surface" })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx("button", { onClick: exportLog, className: "px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-semibold hover:border-slate-500", children: "Export JSON" }) })] }), _jsxs("div", { className: "px-5 py-3 border-b border-slate-800 flex items-center gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Filter by source, message, or data...", className: "w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500", "aria-label": "Filter system log" }), _jsx("span", { className: "absolute right-3 top-2.5 text-slate-500", children: _jsx(Icon, { name: "search", size: 16 }) })] }), _jsx("div", { className: "flex items-center gap-1", children: ['all', 'action', 'info', 'warning', 'error'].map((level) => (_jsx("button", { onClick: () => setFilter(level), className: `px-2.5 py-1 rounded-md text-[11px] uppercase tracking-[0.12em] border ${filter === level
                                ? 'border-cyan-500 text-cyan-200 bg-cyan-500/10'
                                : 'border-slate-800 text-slate-400 hover:border-slate-600'}`, children: level }, level))) })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: filtered.length === 0 ? (_jsx("div", { className: "flex h-full items-center justify-center", children: _jsx(EmptyState, { icon: "log", title: "No log entries yet", description: "System activity will appear here as deterministic events.", action: (_jsx("button", { type: "button", onClick: exportLog, className: "px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-[11px] font-semibold hover:border-slate-500", children: "Export JSON" })) }) })) : (_jsx("div", { className: "divide-y divide-slate-900", children: filtered.map((entry) => (_jsxs("div", { className: "px-5 py-3 text-xs", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "text-slate-500 font-mono", children: ["#", entry.seq.toString().padStart(4, '0')] }), _jsx("span", { className: `font-semibold uppercase tracking-[0.12em] ${levelStyles[entry.level]}`, children: entry.level }), _jsx("span", { className: "text-slate-500 font-mono", children: entry.ts_wall }), _jsxs("span", { className: "text-slate-400", children: ["[", entry.source, "]"] })] }), _jsx("div", { className: "mt-1 text-slate-200", children: entry.message }), entry.data && (_jsx("pre", { className: "mt-2 whitespace-pre-wrap text-[11px] text-slate-500 bg-slate-900/60 border border-slate-800 rounded-md p-2", children: JSON.stringify(entry.data, null, 2) }))] }, entry.id))) })) })] }));
};
export const SystemLogApp = {
    manifest: {
        id: 'system-log',
        name: 'System Log',
        iconId: 'log',
        singleton: true,
        category: 'system',
        hidden: true,
        defaultSize: { width: 760, height: 520 },
        minSize: { width: 620, height: 420 },
    },
    component: SystemLogComponent,
};
