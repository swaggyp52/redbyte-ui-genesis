// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';

interface OscilloscopeState {
  pauseScroll: boolean;
  showTimeCursor: boolean;
  clearRequestId: number;
}

interface OscilloscopeActions {
  setPauseScroll: (enabled: boolean) => void;
  togglePauseScroll: () => void;
  setShowTimeCursor: (enabled: boolean) => void;
  toggleTimeCursor: () => void;
  requestClear: () => void;
}

type OscilloscopeStore = OscilloscopeState & OscilloscopeActions;

export const useOscilloscopeStore = create<OscilloscopeStore>((set) => ({
  pauseScroll: false,
  showTimeCursor: true,
  clearRequestId: 0,

  setPauseScroll: (enabled) => set({ pauseScroll: enabled }),
  togglePauseScroll: () => set((state) => ({ pauseScroll: !state.pauseScroll })),
  setShowTimeCursor: (enabled) => set({ showTimeCursor: enabled }),
  toggleTimeCursor: () => set((state) => ({ showTimeCursor: !state.showTimeCursor })),
  requestClear: () => set((state) => ({ clearRequestId: state.clearRequestId + 1 })),
}));
