import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useState, useMemo } from 'react';
export const WindowSwitcher = ({ windows, onSelect, onCancel, }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    // MRU ordering: lastFocusedAt DESC, tie-break windowId ASC
    const mruWindows = useMemo(() => {
        return [...windows].sort((a, b) => {
            // Primary: lastFocusedAt DESC (most recent first)
            const aTime = a.lastFocusedAt || 0;
            const bTime = b.lastFocusedAt || 0;
            if (bTime !== aTime)
                return bTime - aTime;
            // Tie-break: windowId ASC (stable sort)
            return a.id.localeCompare(b.id);
        });
    }, [windows]);
    // Reset selection when windows change
    useEffect(() => {
        setSelectedIndex(0);
    }, [mruWindows]);
    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            if (event.shiftKey) {
                // Shift+Tab: go to previous
                setSelectedIndex((prev) => (prev === 0 ? mruWindows.length - 1 : prev - 1));
            }
            else {
                // Tab: go to next
                setSelectedIndex((prev) => (prev === mruWindows.length - 1 ? 0 : prev + 1));
            }
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => (prev === mruWindows.length - 1 ? 0 : prev + 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => (prev === 0 ? mruWindows.length - 1 : prev - 1));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const selected = mruWindows[selectedIndex];
            if (!selected)
                return;
            onSelect(selected.id);
            return;
        }
    };
    const handleWindowClick = (windowId) => {
        onSelect(windowId);
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]", onClick: onCancel, onKeyDown: handleKeyDown, tabIndex: 0, children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[500px] p-4", onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { className: "text-sm font-semibold text-slate-400 mb-3 uppercase", children: "Switch Window" }), _jsxs("div", { className: "space-y-1 max-h-[400px] overflow-y-auto", children: [mruWindows.length === 0 && (_jsx("div", { className: "text-center text-slate-500 py-8", children: "No windows open" })), mruWindows.map((window, index) => (_jsxs("div", { "data-testid": `window-item-${window.id}`, "data-selected": index === selectedIndex, onClick: () => handleWindowClick(window.id), className: `
                flex items-center gap-3 px-3 py-2 rounded cursor-pointer
                ${index === selectedIndex
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}
              `, children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-sm", children: window.title }), _jsx("div", { className: "text-xs opacity-70", children: window.contentId })] }), window.mode === 'minimized' && (_jsx("div", { className: "text-xs px-2 py-0.5 bg-slate-700 rounded", children: "Minimized" }))] }, window.id)))] }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Tab" }), " / ", _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "\u2191\u2193" }), " Navigate", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Select", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) }));
};
