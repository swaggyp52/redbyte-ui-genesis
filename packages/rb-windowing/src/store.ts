// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { WindowState, CreateWindowOptions, WindowId, WindowBounds } from './types';
import { assertWindowInvariants } from './invariants';

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
  setWindowTitle: (id: WindowId, title: string) => void;
  toggleMinimize: (id: WindowId) => void;
  toggleMaximize: (id: WindowId) => void;
  restoreWindow: (id: WindowId) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  // Layout actions
  snapWindow: (id: WindowId, direction: 'left' | 'right' | 'top' | 'bottom', desktopBounds: WindowBounds) => void;
  centerWindow: (id: WindowId, desktopBounds: WindowBounds) => void;
  // Session actions
  restoreSession: (windows: WindowState[], nextZIndex: number) => void;
  // Selectors
  getActiveWindows: () => WindowState[];
  getFocusedWindow: () => WindowState | null;
  getZOrderedWindows: () => WindowState[];
}

type WindowManagerStore = WindowManagerState & WindowManagerActions;

const LAYOUT_STORAGE_KEY = 'rb:window-layout';

interface WindowLayoutPersistedState {
  windows: WindowState[];
  nextZIndex: number;
}

interface WindowLayoutEnvelope {
  version: 1;
  state: WindowLayoutPersistedState;
}

/**
 * Deterministic serialization of window layout.
 * Ensures stable JSON output for snapshots and diffs.
 */
function serializeLayout(envelope: WindowLayoutEnvelope): string {
  // Sort windows by id for deterministic output
  const sortedWindows = [...envelope.state.windows].sort((a, b) => a.id.localeCompare(b.id));

  const sortedState: WindowLayoutPersistedState = {
    windows: sortedWindows,
    nextZIndex: envelope.state.nextZIndex,
  };

  const sortedEnvelope: WindowLayoutEnvelope = {
    version: envelope.version,
    state: sortedState,
  };

  return JSON.stringify(sortedEnvelope);
}

function saveSession(windows: WindowState[], nextZIndex: number): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const envelope: WindowLayoutEnvelope = {
      version: 1,
      state: { windows, nextZIndex },
    };
    const json = serializeLayout(envelope);
    localStorage.setItem(LAYOUT_STORAGE_KEY, json);
  } catch (error) {
    // Silently ignore localStorage errors (quota exceeded, etc.)
  }
}

export function loadSession(): WindowLayoutPersistedState | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;

    const envelope = JSON.parse(raw) as WindowLayoutEnvelope;

    // Validate envelope structure
    if (envelope.version !== 1) return null;
    if (!envelope.state || typeof envelope.state !== 'object') return null;
    if (!Array.isArray(envelope.state.windows)) return null;
    if (typeof envelope.state.nextZIndex !== 'number') return null;

    return envelope.state;
  } catch (error) {
    // JSON parse error or validation failure -> fallback
    return null;
  }
}

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

// Helper to wrap set() with invariant checks
function setWithInvariants(
  set: any,
  get: any,
  updater: any
): void {
  set(updater);
  // Check invariants after state update (dev-only)
  const state = get();
  assertWindowInvariants(state.windows);
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

    // Smart cascade positioning: If position not specified, cascade from existing windows
    const CASCADE_OFFSET = 30;
    const MAX_CASCADE = 8; // After 8 cascades, reset to start
    let defaultX = defaultBounds.x;
    let defaultY = defaultBounds.y;

    if (opts.x === undefined || opts.y === undefined) {
      // Count windows for same contentId to determine cascade offset
      const existingWindows = state.windows.filter(w => w.contentId === opts.contentId);
      const cascadeIndex = existingWindows.length % MAX_CASCADE;

      defaultX = defaultBounds.x + (cascadeIndex * CASCADE_OFFSET);
      defaultY = defaultBounds.y + (cascadeIndex * CASCADE_OFFSET);
    }

    let bounds: WindowBounds = {
      x: opts.x ?? defaultX,
      y: opts.y ?? defaultY,
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

    setWithInvariants(set, get, (state: WindowManagerState) => ({
      windows: [
        ...state.windows.map((w) => ({ ...w, focused: false })),
        newWindow,
      ],
      nextZIndex: state.nextZIndex + 1,
    }));

    return newWindow;
  },

  closeWindow: (id) => {
    setWithInvariants(set, get, (state: WindowManagerState) => ({
      windows: state.windows.filter((w) => w.id !== id),
    }));
  },

  focusWindow: (id) => {
    setWithInvariants(set, get, (state: WindowManagerState) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window) return state;

      return {
        windows: state.windows.map((w) => ({
          ...w,
          focused: w.id === id,
          zIndex: w.id === id ? state.nextZIndex : w.zIndex,
          lastFocusedAt: w.id === id ? Date.now() : w.lastFocusedAt, // PHASE_AC: track focus history
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

  setWindowTitle: (id, title) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, title } : w
      ),
    }));
  },

  toggleMinimize: (id) => {
    setWithInvariants(set, get, (state: WindowManagerState) => {
      const window = state.windows.find((w) => w.id === id);
      if (!window || !window.minimizable) return state;

      return {
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, mode: w.mode === 'minimized' ? 'normal' : 'minimized', focused: w.mode === 'minimized' ? w.focused : false }
            : w
        ),
      };
    });
  },

  toggleMaximize: (id) => {
    setWithInvariants(set, get, (state: WindowManagerState) => {
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
    setWithInvariants(set, get, (state: WindowManagerState) => ({
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
    setWithInvariants(set, get, (state: WindowManagerState) => {
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
    setWithInvariants(set, get, (state: WindowManagerState) => {
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

  // Session actions
  restoreSession: (windows, nextZIndex) => {
    set({ windows, nextZIndex });
    // Check invariants after restore
    if (process.env.NODE_ENV !== 'production') {
      assertWindowInvariants(get().windows);
    }
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

// Auto-persist session on window state changes
useWindowStore.subscribe((state) => {
  saveSession(state.windows, state.nextZIndex);
});
