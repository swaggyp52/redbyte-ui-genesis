import { createStore, type StoreApi } from 'zustand/vanilla';

export type WindowId = string;

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowDescriptor {
  id: WindowId;
  title: string;
  appId?: string;
  bounds: WindowBounds;
  minimized?: boolean;
  maximized?: boolean;
}

export interface WindowState extends WindowDescriptor {
  restoreBounds?: WindowBounds;
}

export interface WindowingState {
  windows: WindowState[];
  focusedWindowId: WindowId | null;
  zOrder: WindowId[];
  snapToGrid: number | null;
}

export interface WindowingActions {
  open: (descriptor: WindowDescriptor) => void;
  close: (id: WindowId) => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, delta: { dx: number; dy: number }) => void;
  resize: (id: WindowId, dimensions: Partial<WindowBounds>) => void;
  toggleMinimize: (id: WindowId) => void;
  toggleMaximize: (id: WindowId) => void;
  setSnapToGrid: (size: number | null) => void;
}

export type WindowingStore = WindowingState & WindowingActions;

const snapValue = (value: number, grid: number | null): number => {
  if (!grid || grid <= 1) {
    return value;
  }

  return Math.round(value / grid) * grid;
};

const applySnap = (bounds: WindowBounds, grid: number | null): WindowBounds => ({
  x: snapValue(bounds.x, grid),
  y: snapValue(bounds.y, grid),
  width: snapValue(bounds.width, grid),
  height: snapValue(bounds.height, grid),
});

const defaultBounds: WindowBounds = {
  x: 80,
  y: 80,
  width: 480,
  height: 320,
};

export const createWindowingStore = (
  initialState: Partial<WindowingState> = {},
): StoreApi<WindowingStore> => {
  const initialWindows = initialState.windows ?? [];
  const initialZOrder = initialState.zOrder ?? initialWindows.map((window) => window.id);

  return createStore<WindowingStore>((set, get) => ({
    windows: initialWindows,
    zOrder: initialZOrder,
    focusedWindowId: initialState.focusedWindowId ?? null,
    snapToGrid: initialState.snapToGrid ?? null,
    open: (descriptor) => {
      set((state) => {
        const exists = state.windows.some((window) => window.id === descriptor.id);
        if (exists) {
          return state;
        }

        const windowState: WindowState = {
          ...descriptor,
          bounds: descriptor.bounds ?? defaultBounds,
          minimized: descriptor.minimized ?? false,
          maximized: descriptor.maximized ?? false,
        };

        return {
          ...state,
          windows: [...state.windows, windowState],
          zOrder: [...state.zOrder.filter((id) => id !== descriptor.id), descriptor.id],
          focusedWindowId: descriptor.id,
        };
      });
    },
    close: (id) => {
      set((state) => {
        const remaining = state.windows.filter((window) => window.id !== id);
        const remainingOrder = state.zOrder.filter((windowId) => windowId !== id);
        const focusedWindowId =
          state.focusedWindowId === id ? remainingOrder[remainingOrder.length - 1] ?? null : state.focusedWindowId;

        return {
          ...state,
          windows: remaining,
          zOrder: remainingOrder,
          focusedWindowId,
        };
      });
    },
    focus: (id) => {
      set((state) => {
        const exists = state.windows.some((window) => window.id === id);
        if (!exists) {
          return state;
        }

        return {
          ...state,
          focusedWindowId: id,
          zOrder: [...state.zOrder.filter((windowId) => windowId !== id), id],
        };
      });
    },
    move: (id, delta) => {
      set((state) => {
        const grid = state.snapToGrid;
        const windows = state.windows.map((window) => {
          if (window.id !== id) {
            return window;
          }

          const moved: WindowBounds = {
            ...window.bounds,
            x: window.bounds.x + delta.dx,
            y: window.bounds.y + delta.dy,
          };

          return { ...window, bounds: applySnap(moved, grid) };
        });

        return { ...state, windows };
      });
    },
    resize: (id, dimensions) => {
      set((state) => {
        const grid = state.snapToGrid;
        const windows = state.windows.map((window) => {
          if (window.id !== id) {
            return window;
          }

          const next: WindowBounds = applySnap(
            {
              ...window.bounds,
              ...dimensions,
            },
            grid,
          );

          return { ...window, bounds: next };
        });

        return { ...state, windows };
      });
    },
    toggleMinimize: (id) => {
      set((state) => {
        const windows = state.windows.map((window) =>
          window.id === id ? { ...window, minimized: !window.minimized } : window,
        );
        const focusedWindowId = state.focusedWindowId === id ? null : state.focusedWindowId;
        return { ...state, windows, focusedWindowId };
      });
    },
    toggleMaximize: (id) => {
      set((state) => {
        const windows = state.windows.map((window) => {
          if (window.id !== id) {
            return window;
          }

          if (!window.maximized) {
            const maxBounds: WindowBounds = { x: 0, y: 0, width: 1280, height: 720 };
            return { ...window, maximized: true, restoreBounds: window.bounds, bounds: maxBounds, minimized: false };
          }

          const restoreBounds = window.restoreBounds ?? window.bounds;
          return { ...window, maximized: false, bounds: restoreBounds };
        });

        return { ...state, windows, focusedWindowId: id };
      });
    },
    setSnapToGrid: (size) => {
      set((state) => ({ ...state, snapToGrid: size }));
    },
  }));
};

export const selectActiveWindows = (state: WindowingState): WindowState[] =>
  state.windows.filter((window) => !window.minimized);

export const selectFocusedWindow = (state: WindowingState): WindowState | null =>
  state.windows.find((window) => window.id === state.focusedWindowId) ?? null;

export const selectZOrderedWindows = (state: WindowingState): WindowState[] =>
  state.zOrder
    .map((id) => state.windows.find((window) => window.id === id))
    .filter((window): window is WindowState => Boolean(window));
