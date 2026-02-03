import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useState } from 'react';
import { checkForRecovery, acceptRecovery, discardRecovery } from './persistenceStore';
/**
 * Shown on shell load when autosave journal entries indicate
 * interrupted saves. Lets the user choose to recover or discard.
 */
export const RecoveryPrompt = ({ onRecover, onDiscard }) => {
    const [entries, setEntries] = useState([]);
    useEffect(() => {
        const found = checkForRecovery();
        setEntries(found);
    }, []);
    if (entries.length === 0)
        return null;
    const handleRecover = () => {
        const recovered = [];
        for (const entry of entries) {
            const data = acceptRecovery(entry.windowId);
            if (data !== null) {
                recovered.push({ windowId: entry.windowId, appId: entry.appId, data });
            }
        }
        onRecover(recovered);
    };
    const handleDiscard = () => {
        for (const entry of entries) {
            discardRecovery(entry.windowId);
        }
        onDiscard();
    };
    const age = (ts) => {
        const mins = Math.floor((Date.now() - ts) / 60000);
        if (mins < 1)
            return 'just now';
        if (mins < 60)
            return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)
            return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
        }, children: _jsxs("div", { style: {
                background: 'var(--rb-surface-2, #1e1e2e)',
                border: '1px solid var(--rb-border, #333)',
                borderRadius: 12,
                padding: '24px 28px',
                maxWidth: 440,
                width: '90%',
                color: 'var(--rb-text, #e4e4e7)',
                fontFamily: 'var(--rb-font-mono, monospace)',
            }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 600, marginBottom: 8 }, children: "Recover unsaved work?" }), _jsx("div", { style: { fontSize: 13, color: 'var(--rb-text-2, #a1a1aa)', marginBottom: 16 }, children: entries.length === 1
                        ? 'An unsaved session was found from a previous session that was interrupted.'
                        : `${entries.length} unsaved sessions were found from a previous session that was interrupted.` }), _jsx("div", { style: { marginBottom: 20 }, children: entries.map((entry) => (_jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            marginBottom: 4,
                            background: 'var(--rb-surface-1, #16161e)',
                            borderRadius: 6,
                            fontSize: 12,
                        }, children: [_jsx("span", { style: { color: 'var(--rb-text, #e4e4e7)' }, children: entry.appId ?? entry.windowId }), _jsxs("span", { style: { color: 'var(--rb-text-3, #71717a)', fontSize: 11 }, children: [age(entry.timestamp), entry.reason === 'interrupted' ? ' · interrupted' : ' · unsaved'] })] }, entry.windowId))) }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx("button", { onClick: handleDiscard, style: {
                                padding: '7px 16px',
                                borderRadius: 6,
                                border: '1px solid var(--rb-border, #333)',
                                background: 'transparent',
                                color: 'var(--rb-text-2, #a1a1aa)',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontFamily: 'inherit',
                            }, children: "Discard" }), _jsx("button", { onClick: handleRecover, style: {
                                padding: '7px 16px',
                                borderRadius: 6,
                                border: 'none',
                                background: 'var(--rb-accent, #3b82f6)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                            }, children: "Recover" })] })] }) }));
};
