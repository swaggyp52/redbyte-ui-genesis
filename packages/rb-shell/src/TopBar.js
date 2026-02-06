import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import { Icon } from '@redbyte/rb-icons';
export const TopBar = React.memo(({ isRecording, modeLabel, tickCount, unreadCount = 0, onOpenLog, onOpenLauncher, onOpenSettings, onOpenDeterminism, }) => {
    return (_jsx("header", { role: "banner", "aria-label": "System Bar", className: "fixed top-0 left-0 right-0 z-50 pointer-events-none", children: _jsxs("div", { className: "h-8 px-3 flex items-center justify-between border-b", style: {
                background: 'var(--rb-ui-surface-1)',
                borderColor: 'var(--rb-ui-border)',
            }, children: [_jsx("div", { className: "flex items-center gap-2.5 pointer-events-auto", children: _jsxs("button", { className: "flex items-center gap-2 text-xs font-semibold tracking-wide transition-colors", onClick: onOpenLauncher, title: "Open Launcher (Ctrl/Cmd+K)", "aria-label": "Open Launcher", style: { color: 'var(--rb-ui-text)' }, children: [_jsx("div", { className: "h-5 w-5 rounded flex items-center justify-center", style: { background: 'var(--rb-ui-accent)' }, children: _jsx("span", { className: "text-[10px] font-bold text-white leading-none", children: "R" }) }), _jsx("span", { children: "RedByte" })] }) }), _jsx("div", { className: "flex items-center gap-2 pointer-events-auto", children: _jsxs("button", { onClick: onOpenDeterminism, className: "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider", style: {
                            background: isRecording
                                ? 'var(--rb-ui-accent-soft)'
                                : modeLabel === 'replay'
                                    ? 'var(--rb-ui-accent-soft)'
                                    : 'var(--rb-ui-surface-2)',
                            color: isRecording
                                ? 'var(--rb-ui-danger)'
                                : modeLabel === 'replay'
                                    ? 'var(--rb-ui-accent)'
                                    : 'var(--rb-ui-text-2)',
                        }, title: "Determinism Status", "aria-label": "Determinism Status", children: [isRecording && (_jsx("span", { className: "h-1.5 w-1.5 rounded-full animate-pulse", style: { background: 'var(--rb-ui-danger)' } })), _jsx("span", { children: isRecording ? 'REC' : modeLabel }), _jsxs("span", { style: { color: 'var(--rb-ui-text-3)' }, children: ["T", tickCount.toString().padStart(4, '0')] })] }) }), _jsxs("div", { className: "flex items-center gap-1 pointer-events-auto", children: [_jsxs("button", { onClick: onOpenLog, className: "relative h-6 px-2 rounded flex items-center gap-1.5 text-[11px] font-medium transition-colors", "aria-label": "Open System Log", title: "Open System Log", style: { color: 'var(--rb-ui-text-2)' }, children: [_jsx(Icon, { name: "log", size: 14 }), _jsx("span", { children: "Log" }), unreadCount > 0 && (_jsx("span", { className: "h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center", style: { background: 'var(--rb-ui-danger)' }, children: Math.min(unreadCount, 99) }))] }), onOpenSettings && (_jsx("button", { onClick: onOpenSettings, className: "h-6 w-6 rounded flex items-center justify-center transition-colors", "aria-label": "Open Settings", title: "Open Settings (Ctrl/Cmd+,)", style: { color: 'var(--rb-ui-text-3)' }, children: _jsx(Icon, { name: "settings", size: 14 }) }))] })] }) }));
});
TopBar.displayName = 'TopBar';
