// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';

interface OscilloscopeState {
  pauseScroll: boolean;
  showTimeCursor: boolean;
  timeWindowSec: number;
  showTickGuides: boolean;
  clearRequestId: number;
}

interface OscilloscopeActions {
  setPauseScroll: (enabled: boolean) => void;
  togglePauseScroll: () => void;
  setShowTimeCursor: (enabled: boolean) => void;
  toggleTimeCursor: () => void;
  setTimeWindowSec: (seconds: number) => void;
  setShowTickGuides: (enabled: boolean) => void;
  requestClear: () => void;
}

type OscilloscopeStore = OscilloscopeState & OscilloscopeActions;

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createOscilloscopeStore> | null = null;

function createOscilloscopeStore() {
  return create<OscilloscopeStore>((set) => ({
    pauseScroll: false,
    showTimeCursor: true,
    timeWindowSec: 10,
    showTickGuides: true,
    clearRequestId: 0,

    setPauseScroll: (enabled) => set({ pauseScroll: enabled }),
    togglePauseScroll: () => set((state) => ({ pauseScroll: !state.pauseScroll })),
    setShowTimeCursor: (enabled) => set({ showTimeCursor: enabled }),
    toggleTimeCursor: () => set((state) => ({ showTimeCursor: !state.showTimeCursor })),
    setTimeWindowSec: (seconds) =>
      set({ timeWindowSec: Math.max(1, Math.min(10, Math.round(seconds))) }),
    setShowTickGuides: (enabled) => set({ showTickGuides: enabled }),
    requestClear: () => set((state) => ({ clearRequestId: state.clearRequestId + 1 })),
  }));
}

export const useOscilloscopeStore: ReturnType<typeof createOscilloscopeStore> = ((...args: any[]) => {
  if (!_store) _store = createOscilloscopeStore();
  return (_store as any)(...args);
}) as any;

(useOscilloscopeStore as any).getState = () => {
  if (!_store) _store = createOscilloscopeStore();
  return (_store as any).getState();
};

(useOscilloscopeStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createOscilloscopeStore();
  return (_store as any).setState(...a);
};

(useOscilloscopeStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createOscilloscopeStore();
  return (_store as any).subscribe(...a);
};
