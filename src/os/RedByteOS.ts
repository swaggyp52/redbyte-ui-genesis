import React from "react";
import { create } from "zustand";

export interface RedByteWindow {
  id: string;
  appId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  fullscreen: boolean;
}

export interface RedByteApp {
  id: string;
  name: string;
  icon: string;
  component: React.FC;
}

interface RedByteState {
  windows: RedByteWindow[];
  apps: Record<string, RedByteApp>;
  theme: string;

  openApp: (appId: string) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleFullscreen: (id: string) => void;
  setTheme: (theme: string) => void;
}

export const useRedByteOS = create<RedByteState>((set, get) => ({
  windows: [],
  apps: {},
  theme: "neon",

  openApp: (appId) => {
    const app = get().apps[appId];
    if (!app) return;

    const id = crypto.randomUUID();
    const maxZ = Math.max(0, ...get().windows.map(w => w.z));

    const win: RedByteWindow = {
      id,
      appId,
      title: app.name,
      x: 140 + Math.random() * 80,
      y: 120 + Math.random() * 40,
      width: 960,
      height: 600,
      z: maxZ + 1,
      minimized: false,
      fullscreen: false,
    };

    set(state => ({ windows: [...state.windows, win] }));
  },

  closeWindow: (id) =>
    set(state => ({
      windows: state.windows.filter(w => w.id !== id),
    })),

  focusWindow: (id) =>
    set(state => {
      if (!state.windows.length) return state;
      const maxZ = Math.max(...state.windows.map(w => w.z));
      return {
        windows: state.windows.map(w =>
          w.id === id ? { ...w, z: maxZ + 1 } : w
        ),
      };
    }),

  minimizeWindow: (id) =>
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, minimized: !w.minimized } : w
      ),
    })),

  toggleFullscreen: (id) =>
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, fullscreen: !w.fullscreen } : w
      ),
    })),

  setTheme: (theme) => set({ theme }),
}));


