import { createStore } from "zustand/vanilla";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  id: string;
  title: string;
  appId: string;
  bounds: WindowBounds;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  focused: boolean;
}

export interface WindowingStore {
  windows: WindowState[];
  focusedWindowId: string | null;
  openWindow: (input: { appId: string; title: string; initialBounds?: Partial<WindowBounds> }) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, nextBounds: Partial<WindowBounds>) => void;
  resizeWindow: (id: string, nextBounds: Partial<WindowBounds>) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  getZOrderedWindows: () => WindowState[];
}

export interface WindowingConfig {
  snapToGrid?: number;
}

const defaultBounds: WindowBounds = {
  x: 120,
  y: 120,
  width: 640,
  height: 420,
};

const generateId = (): string => `win-${Math.random().toString(36).slice(2, 9)}`;

const applySnap = (value: number, snap?: number): number => {
  if (!snap) return value;
  return Math.round(value / snap) * snap;
};

const mergeBounds = (current: WindowBounds, next: Partial<WindowBounds>, snap?: number): WindowBounds => ({
  x: applySnap(next.x ?? current.x, snap),
  y: applySnap(next.y ?? current.y, snap),
  width: applySnap(next.width ?? current.width, snap),
  height: applySnap(next.height ?? current.height, snap),
});

export const createWindowingStore = (config?: WindowingConfig) =>
  createStore<WindowingStore>((set, get) => ({
    windows: [],
    focusedWindowId: null,
    openWindow: ({ appId, title, initialBounds }) => {
      const id = generateId();
      const bounds = mergeBounds(defaultBounds, initialBounds ?? {}, config?.snapToGrid);
      set((state) => {
        const nextZ = state.windows.reduce((acc, win) => Math.max(acc, win.zIndex), 0) + 1;
        const windows = state.windows.map((win) => ({ ...win, focused: false }));
        windows.push({
          id,
          title,
          appId,
          bounds,
          minimized: false,
          maximized: false,
          zIndex: nextZ,
          focused: true,
        });
        return { windows, focusedWindowId: id };
      });
      return id;
    },
    closeWindow: (id) => {
      set((state) => {
        const windows = state.windows.filter((w) => w.id !== id);
        const nextFocused = windows.length > 0 ? windows.reduce((prev, current) => (current.zIndex > prev.zIndex ? current : prev)) : null;
        return {
          windows: windows.map((w) => ({ ...w, focused: nextFocused?.id === w.id })),
          focusedWindowId: nextFocused?.id ?? null,
        };
      });
    },
    focusWindow: (id) => {
      set((state) => {
        const exists = state.windows.find((w) => w.id === id);
        if (!exists) return state;
        const nextZ = state.windows.reduce((acc, win) => Math.max(acc, win.zIndex), 0) + 1;
        const windows = state.windows.map((w) =>
          w.id === id
            ? { ...w, focused: true, zIndex: nextZ, minimized: false }
            : { ...w, focused: false },
        );
        return { windows, focusedWindowId: id };
      });
    },
    moveWindow: (id, nextBounds) => {
      set((state) => ({
        windows: state.windows.map((w) => (w.id === id ? { ...w, bounds: mergeBounds(w.bounds, nextBounds, config?.snapToGrid) } : w)),
      }));
    },
    resizeWindow: (id, nextBounds) => {
      set((state) => ({
        windows: state.windows.map((w) => (w.id === id ? { ...w, bounds: mergeBounds(w.bounds, nextBounds, config?.snapToGrid) } : w)),
      }));
    },
    toggleMinimize: (id) => {
      set((state) => ({
        windows: state.windows.map((w) =>
          w.id === id
            ? { ...w, minimized: !w.minimized, focused: w.minimized ? w.focused : false }
            : w,
        ),
        focusedWindowId: state.focusedWindowId === id ? null : state.focusedWindowId,
      }));
    },
    toggleMaximize: (id) => {
      set((state) => ({
        windows: state.windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)),
      }));
    },
    getZOrderedWindows: () => {
      return [...get().windows].sort((a, b) => a.zIndex - b.zIndex);
    },
  }));

export type WindowingStoreApi = ReturnType<typeof createWindowingStore>;
