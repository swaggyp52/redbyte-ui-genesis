import { create } from "zustand";
import { AppRegistry } from "./apps";

type Win = {
  id: string;
  title: string;
  appId: string;
  component: React.ComponentType<any>;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

type Store = {
  windows: Win[];
  openWindow: (appId: string) => void;
  close: (winId: string) => void;
  focus: (winId: string) => void;
  update: (winId: string, data: Partial<Win>) => void;
};

export const useWindowManager = create<Store>((set, get) => ({
  windows: [],

  openWindow: (appId) =>
    set((state) => {
      const app = AppRegistry.find((a) => a.id === appId);
      if (!app) return state;

      const id = crypto.randomUUID();
      const win: Win = {
        id,
        title: app.title,
        appId,
        component: app.component,
        x: 160 + state.windows.length * 24,
        y: 90 + state.windows.length * 16,
        w: 560,
        h: 360,
        z: state.windows.length + 1,
      };

      return { windows: [...state.windows, win] };
    }),

  close: (winId) =>
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== winId),
    })),

  focus: (winId) =>
    set((state) => {
      const top = Math.max(0, ...state.windows.map((w) => w.z)) + 1;
      return {
        windows: state.windows.map((w) =>
          w.id === winId ? { ...w, z: top } : w
        ),
      };
    }),

  update: (winId, data) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === winId ? { ...w, ...data } : w
      ),
    })),
}));

