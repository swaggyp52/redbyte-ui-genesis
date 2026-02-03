import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { memo } from 'react';
export const WindowShell = memo(({ title, focused = true, children, error, loading, onErrorReset, }) => {
    return (_jsxs("div", { className: "flex flex-col h-full w-full", style: {
            background: 'var(--rb-surface-0)',
            color: 'var(--rb-text-base)',
            overflow: 'hidden',
        }, children: [title && (_jsx("div", { className: "flex items-center justify-between h-9 px-3 border-b bg-surface-1", style: {
                    borderColor: focused ? 'var(--rb-border-strong)' : 'var(--rb-border)',
                    background: focused ? 'var(--rb-surface-2)' : 'var(--rb-surface-1)',
                }, children: _jsx("span", { className: "text-xs font-semibold text-text-2 truncate", children: title }) })), _jsxs("div", { className: "flex-1 overflow-auto", style: {
                    display: 'flex',
                    flexDirection: 'column',
                }, children: [error && (_jsx("div", { className: "flex items-center justify-center flex-1 p-4", children: _jsxs("div", { className: "rounded border border-red-500/30 bg-red-500/10 p-4 max-w-sm text-center", children: [_jsx("p", { className: "text-sm text-red-400 mb-2", children: error }), onErrorReset && (_jsx("button", { onClick: onErrorReset, className: "text-xs px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors", children: "Dismiss" }))] }) })), loading && !error && (_jsx("div", { className: "flex items-center justify-center flex-1", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" }), _jsx("span", { className: "text-xs text-text-2", children: "Loading..." })] }) })), !error && !loading && children] })] }));
});
WindowShell.displayName = 'WindowShell';
