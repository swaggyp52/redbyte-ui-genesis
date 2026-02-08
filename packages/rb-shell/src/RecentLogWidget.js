import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useMemo, useState } from 'react';
import { useSystemLogStore } from '@redbyte/rb-apps';
/* ─── Helpers ───────────────────────────────────────────────── */
const levelSymbol = {
    action: '\u2713',
    info: '\u2022',
    warning: '\u26A0',
    error: '\u2717',
};
const levelColor = {
    action: '#22c55e',
    info: '#94a3b8',
    warning: '#f59e0b',
    error: '#ef4444',
};
function formatEntry(entry) {
    const sym = levelSymbol[entry.level] ?? '\u2022';
    return `${sym} ${entry.message}`;
}
/* ─── Component ─────────────────────────────────────────────── */
export const RecentLogWidget = ({ onOpenLog, maxEntries = 3, }) => {
    const entries = useSystemLogStore((s) => s.entries);
    const recent = useMemo(() => entries.slice(0, maxEntries), [entries, maxEntries]);
    // Auto-fade: show when new entry arrives, fade after 5 seconds of inactivity
    const [visible, setVisible] = useState(false);
    const [hovered, setHovered] = useState(false);
    useEffect(() => {
        if (entries.length === 0)
            return;
        setVisible(true);
        const timer = setTimeout(() => {
            if (!hovered)
                setVisible(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, [entries.length, hovered]);
    if (recent.length === 0)
        return null;
    const opacity = visible || hovered ? 0.95 : 0.3;
    return (_jsx("div", { className: "fixed z-[19] transition-opacity duration-300", style: {
            bottom: 52, // above the TruthBar/Evidence Bar
            left: 60, // right of dock
            right: 12,
            opacity,
            pointerEvents: visible || hovered ? 'auto' : 'none',
        }, onMouseEnter: () => { setHovered(true); setVisible(true); }, onMouseLeave: () => setHovered(false), children: _jsxs("div", { style: {
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(8, 12, 20, 0.85)',
                border: '1px solid var(--rb-border, #333)',
                backdropFilter: 'blur(6px)',
                fontFamily: 'var(--rb-font-mono, monospace)',
                fontSize: 11,
                maxWidth: 700,
            }, children: [_jsx("div", { style: { display: 'flex', gap: 10, flex: 1, overflow: 'hidden' }, children: recent.map((entry) => (_jsx("span", { style: {
                            color: levelColor[entry.level] ?? '#94a3b8',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 200,
                        }, title: `[${entry.level}] ${entry.source}: ${entry.message}`, children: formatEntry(entry) }, entry.id))) }), _jsx("button", { type: "button", onClick: onOpenLog, style: {
                        fontSize: 10,
                        color: 'var(--rb-accent, #3b82f6)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                        padding: '2px 4px',
                    }, children: "View Full Log" })] }) }));
};
