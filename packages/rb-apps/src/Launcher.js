import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useMemo, useRef, useState } from 'react';
export const Launcher = ({ apps = [], recentApps = [], pinnedApps = [], runningAppIds = [], onLaunch, onClose, onTogglePin, }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [query, setQuery] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    const selectedRef = useRef(null);
    const hasQuery = Boolean(query);
    const filteredApps = useMemo(() => {
        if (!hasQuery)
            return apps;
        const lowered = query.toLowerCase();
        return apps.filter((app) => app.name.toLowerCase().includes(lowered));
    }, [apps, hasQuery, query]);
    const hasSettings = useMemo(() => apps.some((app) => app.id === 'settings'), [apps]);
    const runningIds = useMemo(() => new Set(runningAppIds), [runningAppIds]);
    const pinnedList = useMemo(() => {
        const deduped = new Map();
        pinnedApps.forEach((app) => {
            if (app.id === 'launcher')
                return;
            if (hasQuery && !app.name.toLowerCase().includes(query.toLowerCase()))
                return;
            deduped.set(app.id, app);
        });
        return Array.from(deduped.values());
    }, [hasQuery, pinnedApps, query]);
    const pinnedIds = useMemo(() => new Set(pinnedList.map((app) => app.id)), [pinnedList]);
    const recentList = useMemo(() => {
        if (hasQuery)
            return [];
        const deduped = new Map();
        recentApps.forEach((app) => {
            if (app.id === 'launcher')
                return;
            if (pinnedIds.has(app.id))
                return;
            deduped.set(app.id, app);
        });
        return Array.from(deduped.values());
    }, [hasQuery, pinnedIds, recentApps]);
    const filteredAllApps = useMemo(() => {
        const recentIds = new Set(recentList.map((app) => app.id));
        return filteredApps.filter((app) => !pinnedIds.has(app.id) && !recentIds.has(app.id));
    }, [filteredApps, pinnedIds, recentList]);
    const showRecents = recentList.length > 0;
    const navigableApps = useMemo(() => {
        const combined = [...pinnedList];
        if (showRecents) {
            combined.push(...recentList);
        }
        combined.push(...filteredAllApps);
        return combined;
    }, [filteredAllApps, pinnedList, recentList, showRecents]);
    useEffect(() => {
        if (navigableApps.length === 0) {
            setSelectedIndex(0);
            return;
        }
        setSelectedIndex((prev) => {
            if (hasQuery)
                return 0;
            return Math.min(prev, navigableApps.length - 1);
        });
    }, [hasQuery, navigableApps.length]);
    useEffect(() => {
        selectedRef.current?.focus();
    }, [selectedIndex, navigableApps.length]);
    const handleLaunch = (id) => {
        onLaunch?.(id);
        if (onClose) {
            onClose();
        }
    };
    const handleKeyDown = (event) => {
        const { key, ctrlKey, metaKey, altKey, shiftKey } = event;
        const target = event.target;
        const tag = target?.tagName?.toLowerCase();
        const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
        if (key === '?' && !ctrlKey && !metaKey && !altKey) {
            event.preventDefault();
            setShowHelp((prev) => !prev);
            return;
        }
        if (key === 'Backspace') {
            if (query) {
                event.preventDefault();
                setQuery((prev) => prev.slice(0, -1));
            }
            return;
        }
        if ((ctrlKey || metaKey) && key === ',' && hasSettings && !altKey && !shiftKey) {
            if (isEditable)
                return;
            event.preventDefault();
            handleLaunch('settings');
            return;
        }
        if (key === 'Escape') {
            if (query) {
                event.preventDefault();
                setQuery('');
                return;
            }
            onClose?.();
            return;
        }
        if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
            setQuery((prev) => prev + key);
            return;
        }
        if (navigableApps.length === 0) {
            return;
        }
        if (key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, navigableApps.length - 1));
            return;
        }
        if (key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (key === 'Enter') {
            event.preventDefault();
            const selected = navigableApps[selectedIndex];
            if (selected) {
                handleLaunch(selected.id);
            }
        }
    };
    const renderAppButton = (app, index, isPinned) => {
        const isSelected = index === selectedIndex;
        return (_jsxs("div", { className: "flex items-center justify-between gap-2 p-2 rounded-md mb-0.5 transition-colors", style: {
                background: isSelected ? 'var(--rb-surface-2)' : 'transparent',
                border: isSelected ? '1px solid var(--rb-accent-border, var(--rb-border))' : '1px solid transparent',
            }, children: [_jsx("button", { type: "button", ref: isSelected ? selectedRef : undefined, tabIndex: isSelected ? 0 : -1, onClick: () => handleLaunch(app.id), className: "flex-1 text-left bg-transparent border-0 outline-none focus:outline-none cursor-pointer", "aria-current": isSelected ? 'true' : undefined, children: _jsxs("span", { className: "text-sm font-medium", style: { color: 'var(--rb-text)' }, children: [app.name, runningIds.has(app.id) && (_jsx("span", { className: "text-xs ml-2", style: { color: 'var(--rb-accent)' }, children: "(Running)" }))] }) }), onTogglePin && (_jsx("button", { type: "button", "aria-label": `${isPinned ? 'Unpin' : 'Pin'} ${app.name}`, onClick: (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onTogglePin(app.id);
                    }, tabIndex: isSelected ? 0 : -1, className: "text-[10px] px-1.5 py-0.5 rounded transition-colors", style: {
                        background: isPinned ? 'var(--rb-accent-muted)' : 'transparent',
                        border: isPinned ? '1px solid var(--rb-accent-border, var(--rb-border))' : '1px solid var(--rb-border)',
                        color: isPinned ? 'var(--rb-accent)' : 'var(--rb-text-3)',
                    }, children: isPinned ? 'Unpin' : 'Pin' }))] }, app.id));
    };
    return (_jsxs("div", { role: "dialog", "aria-label": "App Launcher", "aria-modal": "true", tabIndex: -1, onKeyDown: handleKeyDown, className: "p-4 h-full overflow-y-auto focus:outline-none", style: { background: 'var(--rb-surface-1)', color: 'var(--rb-text)' }, children: [_jsx("h2", { className: "text-base font-semibold mb-4", style: { color: 'var(--rb-text)' }, children: "App Launcher" }), showHelp && (_jsxs("div", { className: "mb-4 p-3 rounded-md", style: { background: 'var(--rb-surface-2)', border: '1px solid var(--rb-border)' }, children: [_jsx("h3", { className: "text-[10px] font-semibold uppercase tracking-wider mb-2", style: { color: 'var(--rb-text-3)' }, children: "Keyboard Shortcuts" }), _jsxs("ul", { className: "text-xs space-y-1", style: { color: 'var(--rb-text-2)' }, children: [_jsxs("li", { children: [_jsx("kbd", { className: "px-1 rounded", style: { background: 'var(--rb-surface-3)' }, children: "\u2191" }), " ", _jsx("kbd", { className: "px-1 rounded", style: { background: 'var(--rb-surface-3)' }, children: "\u2193" }), " Move selection"] }), _jsxs("li", { children: [_jsx("kbd", { className: "px-1 rounded", style: { background: 'var(--rb-surface-3)' }, children: "Enter" }), " Launch app"] }), _jsxs("li", { children: [_jsx("kbd", { className: "px-1 rounded", style: { background: 'var(--rb-surface-3)' }, children: "Esc" }), " Clear search / Close"] }), _jsxs("li", { children: [_jsx("kbd", { className: "px-1 rounded", style: { background: 'var(--rb-surface-3)' }, children: "?" }), " Toggle help"] })] })] })), query && (_jsxs("div", { className: "mb-4 px-2 py-1.5 rounded text-sm", style: { background: 'var(--rb-surface-2)', border: '1px solid var(--rb-accent)', color: 'var(--rb-text)' }, children: [_jsx("span", { className: "mr-2", style: { color: 'var(--rb-text-3)' }, children: "Search:" }), query] })), pinnedList.length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-[10px] font-semibold uppercase tracking-wider mb-2", style: { color: 'var(--rb-text-3)' }, children: "Pinned" }), pinnedList.map((app, index) => renderAppButton(app, index, true))] })), showRecents && (_jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-[10px] font-semibold uppercase tracking-wider mb-2", style: { color: 'var(--rb-text-3)' }, children: "Recent" }), recentList.map((app, index) => renderAppButton(app, index + pinnedList.length, false))] })), _jsxs("div", { children: [_jsx("h3", { className: "text-[10px] font-semibold uppercase tracking-wider mb-2", style: { color: 'var(--rb-text-3)' }, children: "All Apps" }), hasQuery && pinnedList.length === 0 && filteredAllApps.length === 0 && (_jsx("p", { className: "text-sm italic px-2", style: { color: 'var(--rb-text-3)' }, children: "No matches found" })), !hasQuery && apps.length === 0 && pinnedList.length === 0 && recentList.length === 0 && (_jsx("p", { className: "text-sm italic px-2", style: { color: 'var(--rb-text-3)' }, children: "No apps registered" })), filteredAllApps.map((app, index) => renderAppButton(app, index + pinnedList.length + (showRecents ? recentList.length : 0), pinnedIds.has(app.id))), hasSettings && (_jsx("div", { className: "mt-4 pt-4", style: { borderTop: '1px solid var(--rb-border)' }, children: _jsxs("button", { type: "button", title: "Open Settings (Ctrl+, / Cmd+,)", "aria-label": "Open Settings", onClick: () => handleLaunch('settings'), className: "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors", style: {
                                background: 'var(--rb-surface-2)',
                                border: '1px solid var(--rb-border)',
                                color: 'var(--rb-text-2)',
                            }, children: [_jsx("span", { children: "Open Settings" }), _jsx("span", { className: "text-xs", style: { color: 'var(--rb-text-3)' }, children: "Ctrl+," })] }) }))] })] }));
};
