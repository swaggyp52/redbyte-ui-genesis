// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';

interface UiTickState {
  uiTick: number;
  running: boolean;
  start: () => void;
  stop: () => void;
}

let rafId: number | null = null;

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createUiTickStore> | null = null;

function createUiTickStore() {
  return create<UiTickState>((set, get) => ({
    uiTick: 0,
    running: false,
    start: () => {
      if (get().running || typeof window === 'undefined') return;
      set({ running: true });

      const targetDelta = 1000 / 30;
      let lastFrame = performance.now();

      const step = (now: number) => {
        if (!get().running) return;
        if (now - lastFrame >= targetDelta) {
          lastFrame = now;
          set((state) => ({ uiTick: state.uiTick + 1 }));
        }
        rafId = window.requestAnimationFrame(step);
      };

      rafId = window.requestAnimationFrame(step);
    },
    stop: () => {
      set({ running: false });
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  }));
}

export const useUiTickStore: ReturnType<typeof createUiTickStore> = ((...args: any[]) => {
  if (!_store) _store = createUiTickStore();
  return (_store as any)(...args);
}) as any;

(useUiTickStore as any).getState = () => {
  if (!_store) _store = createUiTickStore();
  return (_store as any).getState();
};

(useUiTickStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createUiTickStore();
  return (_store as any).setState(...a);
};

(useUiTickStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createUiTickStore();
  return (_store as any).subscribe(...a);
};

export const startUiTickSampler = () => {
  useUiTickStore.getState().start();
};
