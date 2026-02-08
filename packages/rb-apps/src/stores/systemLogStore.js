// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
import { stableStringify } from '../utils/digest';
const STORAGE_KEY = 'rb:system-log:v1';
const READ_KEY = 'rb:system-log:last-read:v1';
const SEQ_KEY = 'rb:system-log:seq:v1';
const MAX_ENTRIES = 400;
let fallbackSeq = 1;
const getNextSeq = () => {
    if (typeof window === 'undefined') {
        const next = fallbackSeq;
        fallbackSeq += 1;
        return next;
    }
    try {
        const raw = localStorage.getItem(SEQ_KEY);
        const parsed = raw ? parseInt(raw, 10) : 1;
        const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
        localStorage.setItem(SEQ_KEY, String(next + 1));
        return next;
    }
    catch {
        const next = fallbackSeq;
        fallbackSeq += 1;
        return next;
    }
};
const loadEntries = () => {
    if (typeof window === 'undefined')
        return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const loadLastRead = () => {
    if (typeof window === 'undefined')
        return 0;
    try {
        const raw = localStorage.getItem(READ_KEY);
        const parsed = raw ? parseInt(raw, 10) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
    }
    catch {
        return 0;
    }
};
const persist = (entries, lastReadSeq) => {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.setItem(STORAGE_KEY, stableStringify(entries));
        localStorage.setItem(READ_KEY, String(lastReadSeq));
    }
    catch {
        // Ignore persistence errors
    }
};
// Session ID — stable per browser session
const SESSION_ID = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}`;
const LOG_LEVEL_COLORS = {
    info: '#3B82F6',
    action: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
};
function devLog(entry) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
        return;
    const color = LOG_LEVEL_COLORS[entry.level] ?? '#8B8B93';
    const prefix = `%c[${entry.level.toUpperCase()}]%c ${entry.source}:`;
    const args = [prefix, `color:${color};font-weight:bold`, 'color:inherit', entry.message];
    if (entry.data)
        args.push(entry.data);
    if (entry.perf)
        args.push(`(${entry.perf.durationMs}ms)`);
    if (entry.level === 'error') {
        console.error(...args);
    }
    else if (entry.level === 'warning') {
        console.warn(...args);
    }
    else {
        console.log(...args);
    }
}
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createSystemLogStore() {
    return create((set, get) => ({
        entries: loadEntries(),
        lastReadSeq: loadLastRead(),
        addEntry: (entry) => {
            const seq = getNextSeq();
            const payload = {
                ...entry,
                id: `log-${seq}`,
                seq,
                ts_wall: new Date().toISOString(),
                sessionId: entry.sessionId ?? SESSION_ID,
            };
            devLog(payload);
            const next = [payload, ...get().entries].slice(0, MAX_ENTRIES);
            set({ entries: next });
            persist(next, get().lastReadSeq);
            return payload;
        },
        markRead: () => {
            const latestSeq = get().entries[0]?.seq ?? 0;
            set({ lastReadSeq: latestSeq });
            persist(get().entries, latestSeq);
        },
        clear: () => {
            set({ entries: [] });
            persist([], get().lastReadSeq);
        },
        exportLog: () => {
            const payload = {
                schema_version: 'rb_system_log_v1',
                entries: get().entries,
            };
            const blob = new Blob([stableStringify(payload)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `rb-system-log-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        },
    }));
}
export const useSystemLogStore = ((...args) => {
    if (!_store)
        _store = createSystemLogStore();
    return _store(...args);
});
useSystemLogStore.getState = () => {
    if (!_store)
        _store = createSystemLogStore();
    return _store.getState();
};
useSystemLogStore.setState = (...a) => {
    if (!_store)
        _store = createSystemLogStore();
    return _store.setState(...a);
};
useSystemLogStore.subscribe = (...a) => {
    if (!_store)
        _store = createSystemLogStore();
    return _store.subscribe(...a);
};
export const logSystemEvent = (entry) => {
    if (!_store)
        _store = createSystemLogStore();
    return _store.getState().addEntry(entry);
};
export const getUnreadCount = () => {
    if (!_store)
        _store = createSystemLogStore();
    const state = _store.getState();
    return state.entries.filter((e) => e.seq > state.lastReadSeq).length;
};
