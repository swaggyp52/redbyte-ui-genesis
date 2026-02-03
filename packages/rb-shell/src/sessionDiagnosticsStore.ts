// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { useWindowStore } from '@redbyte/rb-windowing';
import { usePersistenceStore, checkForRecovery } from './persistenceStore';
import { useClassroomModeStore } from '@redbyte/rb-apps';

export type DiagnosticEventType = 'error' | 'rejection' | 'warning' | 'info';

export interface DiagnosticEvent {
  id: string;
  timestamp: number;
  type: DiagnosticEventType;
  message: string;
  details?: string;
}

interface SessionDiagnosticsState {
  events: DiagnosticEvent[];
  lastAction: string | null;
  recordAction: (action: string) => void;
  logEvent: (event: Omit<DiagnosticEvent, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

const BUILD_SHA = (import.meta.env as any)?.VITE_BUILD_SHA ?? 'dev';
const BUILD_DATE = (import.meta.env as any)?.VITE_BUILD_DATE ?? new Date().toISOString();

export const useSessionDiagnosticsStore = create<SessionDiagnosticsState>((set) => ({
  events: [],
  lastAction: null,
  recordAction: (action) => set({ lastAction: action }),
  logEvent: (event) => set((state) => ({
    events: [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ...event,
      },
      ...state.events,
    ].slice(0, 200),
  })),
  clear: () => set({ events: [], lastAction: null }),
}));

export interface DiagnosticsSnapshot {
  timestamp: string;
  build: { sha: string; date: string };
  browser: { userAgent: string; platform: string; language: string };
  session: {
    lastAction: string | null;
    lastAutosaveAt: number | null;
    openWindows: Array<{ id: string; appId: string; title: string }>;
    safeMode: boolean;
    recoveryEntries: number;
  };
  events: DiagnosticEvent[];
}

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  const windowState = useWindowStore.getState();
  const persistence = usePersistenceStore.getState();
  const diagnostics = useSessionDiagnosticsStore.getState();
  const safeMode = useClassroomModeStore.getState().safeMode;

  const lastAutosaveAt = Object.values(persistence.windows)
    .map((w) => w.lastSavedAt ?? 0)
    .reduce((max, value) => (value > max ? value : max), 0) || null;

  const windows = windowState.windows.map((w) => ({
    id: w.id,
    appId: w.contentId,
    title: w.title,
  }));

  return {
    timestamp: new Date().toISOString(),
    build: { sha: BUILD_SHA, date: BUILD_DATE },
    browser: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
    },
    session: {
      lastAction: diagnostics.lastAction,
      lastAutosaveAt,
      openWindows: windows,
      safeMode,
      recoveryEntries: checkForRecovery().length,
    },
    events: diagnostics.events,
  };
}
