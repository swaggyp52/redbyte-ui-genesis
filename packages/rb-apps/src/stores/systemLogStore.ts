// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { stableStringify } from '../utils/digest';

export type SystemLogLevel = 'info' | 'action' | 'warning' | 'error';

export interface SystemLogEntry {
  id: string;
  seq: number;
  ts_wall: string;
  level: SystemLogLevel;
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

interface SystemLogState {
  entries: SystemLogEntry[];
  lastReadSeq: number;
}

interface SystemLogActions {
  addEntry: (entry: Omit<SystemLogEntry, 'id' | 'seq' | 'ts_wall'>) => SystemLogEntry;
  markRead: () => void;
  clear: () => void;
  exportLog: () => void;
}

type SystemLogStore = SystemLogState & SystemLogActions;

const STORAGE_KEY = 'rb:system-log:v1';
const READ_KEY = 'rb:system-log:last-read:v1';
const SEQ_KEY = 'rb:system-log:seq:v1';
const MAX_ENTRIES = 400;

let fallbackSeq = 1;

const getNextSeq = (): number => {
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
  } catch {
    const next = fallbackSeq;
    fallbackSeq += 1;
    return next;
  }
};

const loadEntries = (): SystemLogEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadLastRead = (): number => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const persist = (entries: SystemLogEntry[], lastReadSeq: number): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, stableStringify(entries));
    localStorage.setItem(READ_KEY, String(lastReadSeq));
  } catch {
    // Ignore persistence errors
  }
};

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createSystemLogStore> | null = null;

function createSystemLogStore() {
  return create<SystemLogStore>((set, get) => ({
    entries: loadEntries(),
    lastReadSeq: loadLastRead(),

    addEntry: (entry) => {
      const seq = getNextSeq();
      const payload: SystemLogEntry = {
        ...entry,
        id: `log-${seq}`,
        seq,
        ts_wall: new Date().toISOString(),
      };
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

export const useSystemLogStore: ReturnType<typeof createSystemLogStore> = ((...args: any[]) => {
  if (!_store) _store = createSystemLogStore();
  return (_store as any)(...args);
}) as any;

(useSystemLogStore as any).getState = () => {
  if (!_store) _store = createSystemLogStore();
  return (_store as any).getState();
};

(useSystemLogStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createSystemLogStore();
  return (_store as any).setState(...a);
};

(useSystemLogStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createSystemLogStore();
  return (_store as any).subscribe(...a);
};

export const logSystemEvent = (entry: Omit<SystemLogEntry, 'id' | 'seq' | 'ts_wall'>): SystemLogEntry => {
  if (!_store) _store = createSystemLogStore();
  return (_store as any).getState().addEntry(entry);
};

export const getUnreadCount = (): number => {
  if (!_store) _store = createSystemLogStore();
  const state = (_store as any).getState() as SystemLogState;
  return state.entries.filter((e) => e.seq > state.lastReadSeq).length;
};
