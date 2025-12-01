import { create } from 'zustand';
import type { AppId } from './apps';

let windowCounter = 1;

export interface WindowInstance {
  id: string;
  appId: AppId;
  title: string;
}

interface OSState {
  windows: WindowInstance[];
  focusedId: string | null;
  openApp: (appId: AppId) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  reset: () => void;
}

export const useOSStore = create<OSState>((set, get) => ({
  windows: [],
  focusedId: null,

  openApp: (appId) => {
    const id = 'win-' + windowCounter++;
    const title = appId.charAt(0).toUpperCase() + appId.slice(1);
    set((state) => ({
      windows: [...state.windows, { id, appId, title }],
      focusedId: id,
    }));
  },

  closeWindow: (id) => {
    set((state) => {
      const remaining = state.windows.filter((w) => w.id !== id);
      const newFocused =
        state.focusedId === id ? (remaining[remaining.length - 1]?.id ?? null) : state.focusedId;
      return {
        windows: remaining,
        focusedId: newFocused,
      };
    });
  },

  focusWindow: (id) => {
    const exists = get().windows.some((w) => w.id === id);
    if (!exists) return;
    set({ focusedId: id });
  },

  reset: () => {
    windowCounter = 1;
    set({ windows: [], focusedId: null });
  },
}));
