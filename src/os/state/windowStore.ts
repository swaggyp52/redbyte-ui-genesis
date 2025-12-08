import { create } from "zustand";

export type LayoutPreset = "free" | "columns" | "grid";

export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  id: number;
  appId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  isMaximized?: boolean;
  restoreBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface WindowStore {
  windows: WindowState[];
  layout: LayoutPreset;
  zCounter: number;

  openWindow: (opts: { appId: string; title: string }) => void;
  closeWindow: (id: number) => void;
  focusWindow: (id: number) => void;
  moveWindow: (id: number, x: number, y: number) => void;
  resizeWindow: (id: number, width: number, height: number) => void;
  maximizeWindow: (id: number, bounds: LayoutBounds) => void;
  restoreWindow: (id: number) => void;
  setLayout: (layout: LayoutPreset) => void;
  applyLayout: (bounds: LayoutBounds) => void;
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  layout: "free",
  zCounter: 1,

  openWindow: ({ appId, title }) => {
    set((state) => {
      const nextZ = state.zCounter + 1;
      const idx = state.windows.length;
      const baseX = 220 + idx * 32;
      const baseY = 80 + idx * 26;

      const win: WindowState = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        appId,
        title,
        x: baseX,
        y: baseY,
        width: 640,
        height: 360,
        z: nextZ,
      };

      return {
        windows: [...state.windows, win],
        zCounter: nextZ,
      };
    });
  },

  closeWindow: (id: number) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
    }));
  },

  focusWindow: (id: number) => {
    set((state) => {
      const nextZ = state.zCounter + 1;
      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, z: nextZ } : w
        ),
        zCounter: nextZ,
      };
    });
  },

  moveWindow: (id: number, x: number, y: number) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, x, y } : w
      ),
    }));
  },

  resizeWindow: (id: number, width: number, height: number) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, width, height } : w
      ),
    }));
  },

  maximizeWindow: (id: number, bounds: LayoutBounds) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== id) return w;
        return {
          ...w,
          restoreBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
          isMaximized: true,
          x: bounds.x + 24,
          y: bounds.y + 48,
          width: bounds.width - 48,
          height: bounds.height - 96,
        };
      }),
    }));
  },

  restoreWindow: (id: number) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== id || !w.restoreBounds) return w;
        return {
          ...w,
          x: w.restoreBounds.x,
          y: w.restoreBounds.y,
          width: w.restoreBounds.width,
          height: w.restoreBounds.height,
          isMaximized: false,
          restoreBounds: undefined,
        };
      }),
    }));
  },

  setLayout: (layout: LayoutPreset) => set({ layout }),

  applyLayout: (bounds: LayoutBounds) => {
    const { layout } = get();
    if (layout === "free") return;

    const { windows } = get();
    const count = windows.length;
    if (count === 0) return;

    const left = bounds.x;
    const top = bounds.y;
    const width = bounds.width;
    const height = bounds.height;

    let nextWindows: WindowState[] = [];

    if (layout === "columns") {
      const colWidth = width / count;
      nextWindows = windows.map((w, idx) => ({
        ...w,
        x: left + idx * colWidth,
        y: top + 16,
        width: colWidth,
        height: height - 32,
      }));
    } else if (layout === "grid") {
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const cellW = width / cols;
      const cellH = height / rows;

      nextWindows = windows.map((w, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        return {
          ...w,
          x: left + col * cellW,
          y: top + row * cellH,
          width: cellW,
          height: cellH,
        };
      });
    }

    set({ windows: nextWindows });
  },
}));
