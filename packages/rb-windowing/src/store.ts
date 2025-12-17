// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { WindowState, CreateWindowOptions, WindowId, WindowBounds } from './types';

interface WindowManagerState {
  windows: WindowState[];
  nextZIndex: number;
  snapToGrid: boolean;
  gridSize: number;
}

interface WindowManagerActions {
  createWindow: (opts: CreateWindowOptions) => WindowState;
  closeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  moveWindow: (id: WindowId, x: number, y: number) => void;
  resizeWindow: (id: WindowId, width: number, height: number) => void;
  toggleMinimize: (id: WindowId) => void;
  toggleMaximize: (id: WindowId) => void;
  restoreWindow: (id: WindowId) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  // Layout actions
  snapWindow: (id: WindowId, direction: 'left' | 'right' | 'top' | 'bottom', desktopBounds: WindowBounds) => void;
  centerWindow: (id: WindowId, desktopBounds: WindowBounds) => void;
  // Selectors
  getActiveWindows: () => WindowState[];
  getFocusedWindow: () => WindowState | null;
  getZOrderedWindows: () => WindowState[];
}

type WindowManagerStore = WindowManagerState & WindowManagerActions;

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export const useWindowStore = create<WindowManagerStore>((set, get) => ({
  // State
  windows: [],
  nextZIndex: 1,
  snapToGrid: false,
  gridSize: 20,

  // Actions
  createWindow: (opts) => {
    const state = get();
    const id = crypto.randomUUID();

    const defaultBounds = {
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    };

    let bounds: WindowBounds = {
      x: opts.x ?? defaultBounds.x,
      y: opts.y ?? defaultBounds.y,
      width: opts.width ?? defaultBounds.width,
      height: opts.height ?? defaultBounds.height,
    };

    // Apply snap-to-grid if enabled
    if (state.snapToGrid) {
      bounds = {
        x: snapToGrid(bounds.x, state.gridSize),
        y: snapToGrid(bounds.y, state.gridSize),
        width: snapToGrid(bounds.width, state.gridSize),
        height: snapToGrid(bounds.height, state.gridSize),
      };
    }

    const newWindow: WindowState = {
      id,
      title: opts.title ?? 'Untitled',
      bounds,
      mode: 'normal',
      zIndex: state.nextZIndex,
      focused: true,
      resizable: opts.resizable ?? true,
      minimizable: opts.minimizable ?? true,
      maximizable: opts.maximizable ?? true,
      contentId: opts.contentId,
    };

    set((state) => ({
      windows: [
        ...state.windows.map((w) => ({ ...w, focused: false })),
        newWindow,
      ],
      nextZIndex: state.nextZIndex + 1,
    }));

    return newWindow;
  },

  closeWindow: (id) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
    }));
  },

  focusWindow: (id) => {
    set((state) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window) return state;

      return {
        windows: state.windows.map((w) => ({
          ...w,
          focused: w.id === id,
          zIndex: w.id === id ? state.nextZIndex : w.zIndex,
        })),
        nextZIndex: state.nextZIndex + 1,
      };
    });
  },

  moveWindow: (id, x, y) => {
    set((state) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window || window.mode !== 'normal') return state;

      let newX = x;
      let newY = y;

      if (state.snapToGrid) {
        newX = snapToGrid(x, state.gridSize);
        newY = snapToGrid(y, state.gridSize);
      }

      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, bounds: { ...w.bounds, x: newX, y: newY } }
            : w
        ),
      };
    });
  },

  resizeWindow: (id, width, height) => {
    set((state) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window || !window.resizable || window.mode !== 'normal') return state;

      let newWidth = width;
      let newHeight = height;

      if (state.snapToGrid) {
        newWidth = snapToGrid(width, state.gridSize);
        newHeight = snapToGrid(height, state.gridSize);
      }

      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, bounds: { ...w.bounds, width: newWidth, height: newHeight } }
            : w
        ),
      };
    });
  },

  toggleMinimize: (id) => {
    set((state) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window || !window.minimizable) return state;

      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, mode: w.mode === 'minimized' ? 'normal' : 'minimized' }
            : w
        ),
      };
    });
  },

  toggleMaximize: (id) => {
    set((state) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window || !window.maximizable) return state;

      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, mode: w.mode === 'maximized' ? 'normal' : 'maximized' }
            : w
        ),
      };
    });
  },

  restoreWindow: (id) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, mode: 'normal' } : w
      ),
    }));
  },

  setSnapToGrid: (enabled) => {
    set({ snapToGrid: enabled });
  },

  setGridSize: (size) => {
    set({ gridSize: size });
  },

  // Layout actions
  snapWindow: (id, direction, desktopBounds) => {
    set((state) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window || window.mode === 'minimized') return state;

      let newBounds: WindowBounds;
      const halfWidth = desktopBounds.width / 2;
      const halfHeight = desktopBounds.height / 2;

      switch (direction) {
        case 'left':
          newBounds = {
            x: desktopBounds.x,
            y: desktopBounds.y,
            width: halfWidth,
            height: desktopBounds.height,
          };
          break;
        case 'right':
          newBounds = {
            x: desktopBounds.x + halfWidth,
            y: desktopBounds.y,
            width: halfWidth,
            height: desktopBounds.height,
          };
          break;
        case 'top':
          newBounds = {
            x: desktopBounds.x,
            y: desktopBounds.y,
            width: desktopBounds.width,
            height: halfHeight,
          };
          break;
        case 'bottom':
          newBounds = {
            x: desktopBounds.x,
            y: desktopBounds.y + halfHeight,
            width: desktopBounds.width,
            height: halfHeight,
          };
          break;
      }

      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, bounds: newBounds, mode: 'normal' as const }
            : w
        ),
      };
    });
  },

  centerWindow: (id, desktopBounds) => {
    set((state) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window || window.mode === 'minimized') return state;

      const defaultWidth = 400;
      const defaultHeight = 300;
      const centeredX = desktopBounds.x + (desktopBounds.width - defaultWidth) / 2;
      const centeredY = desktopBounds.y + (desktopBounds.height - defaultHeight) / 2;

      const newBounds: WindowBounds = {
        x: centeredX,
        y: centeredY,
        width: defaultWidth,
        height: defaultHeight,
      };

      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, bounds: newBounds, mode: 'normal' as const }
            : w
        ),
      };
    });
  },

  // Selectors
  getActiveWindows: () => {
    return get().windows.filter((w) => w.mode !== 'minimized');
  },

  getFocusedWindow: () => {
    return get().windows.find((w) => w.focused) || null;
  },

  getZOrderedWindows: () => {
    return [...get().windows].sort((a, b) => a.zIndex - b.zIndex);
  },
}));
