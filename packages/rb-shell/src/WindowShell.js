import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { memo } from 'react';
export const WindowShell = memo(({ title, focused = true, children, error, loading, onErrorReset, }) => {
    return (_jsxs("div", { className: "flex flex-col h-full w-full", style: {
            background: 'var(--rb-ui-bg)',
            color: 'var(--rb-ui-text)',
            overflow: 'hidden',
        }, children: [title && (_jsx("div", { className: "flex items-center justify-between h-9 px-3 border-b bg-surface-1", style: {
                    borderColor: focused ? 'var(--rb-ui-border-strong)' : 'var(--rb-ui-border)',
                    background: focused ? 'var(--rb-ui-surface-2)' : 'var(--rb-ui-surface-1)',
                }, children: _jsx("span", { className: "text-xs font-semibold truncate", style: { color: 'var(--rb-ui-text-2)' }, children: title }) })), _jsxs("div", { className: "flex-1 overflow-auto", style: {
                    display: 'flex',
                    flexDirection: 'column',
                }, children: [error && (_jsx("div", { className: "flex items-center justify-center flex-1 p-4", children: _jsxs("div", { className: "rounded p-4 max-w-sm text-center", style: {
                                border: '1px solid var(--rb-ui-danger)',
                                background: 'var(--rb-ui-surface-2)',
                            }, children: [_jsx("p", { className: "text-sm mb-2", style: { color: 'var(--rb-ui-danger)' }, children: error }), onErrorReset && (_jsx("button", { onClick: onErrorReset, className: "text-xs px-3 py-1 rounded transition-colors", style: {
                                        background: 'var(--rb-ui-surface-3)',
                                        color: 'var(--rb-ui-danger)',
                                    }, children: "Dismiss" }))] }) })), loading && !error && (_jsx("div", { className: "flex items-center justify-center flex-1", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full border-2 animate-spin", style: {
                                        borderColor: 'var(--rb-ui-border)',
                                        borderTopColor: 'var(--rb-ui-accent)',
                                    } }), _jsx("span", { className: "text-xs", style: { color: 'var(--rb-ui-text-2)' }, children: "Loading..." })] }) })), !error && !loading && children] })] }));
});
WindowShell.displayName = 'WindowShell';
