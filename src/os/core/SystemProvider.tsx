import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { RBEvents } from "../../kernel/EventBus";

export type AppId =
  | "notes"
  | "terminal"
  | "settings"
  | "sysmon"
  | "files"
  | "sim"
  | "lab"
  | "scope"
  | "world3d"
  | "map2d"
  | "rstats"
  | "analyzer";

export interface AppDefinition {
  id: AppId;
  name: string;
  icon?: string;
}

export interface WindowInstance {
  id: string;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  isActive: boolean;
  snap?: "left" | "right" | "top" | "none";
  isMinimized: boolean;
  isMaximized: boolean;
  restoreBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface SystemContextValue {
  apps: AppDefinition[];
  windows: WindowInstance[];
  activeWindowId: string | null;
  openApp: (appId: AppId) => void;
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  moveWindow: (windowId: string, x: number, y: number) => void;
  resizeWindow: (
    windowId: string,
    size: { width: number; height: number }
  ) => void;
  applySnap: (
    windowId: string,
    mode: "left" | "right" | "top" | "none"
  ) => void;
  minimizeWindow: (windowId: string) => void;
  toggleMaximizeWindow: (windowId: string) => void;
}

const SystemContext = createContext<SystemContextValue | null>(null);

let windowCounter = 0;

export function SystemProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [zTop, setZTop] = useState(10);

  const apps: AppDefinition[] = useMemo(
    () => [
      { id: "notes", name: "Notes", icon: "📝" },
      { id: "terminal", name: "Terminal", icon: "❯" },
      { id: "settings", name: "Settings", icon: "⚙️" },
      { id: "sysmon", name: "System Monitor", icon: "📊" },
      { id: "files", name: "Files", icon: "📁" },
      { id: "sim", name: "Redstone Sim", icon: "🧪" },
      { id: "lab", name: "Redstone Lab", icon: "🧬" },
      { id: "scope", name: "Signal Scope", icon: "📈" },
      { id: "world3d", name: "3D World", icon: "🧊" },
      { id: "map2d", name: "World Map 2D", icon: "🗺️" },
      { id: "rstats", name: "Redstone Stats", icon: "📉" },
      { id: "analyzer", name: "Circuit Analyzer", icon: "📐" },
    ],
    []
  );

  const openApp = useCallback(
    (appId: AppId) => {
      const app = apps.find((a) => a.id === appId);
      if (!app) return;

      const id = `win-${++windowCounter}`;
      const newZ = zTop + 1;

      const largeApps: AppId[] = [
        "sim",
        "lab",
        "scope",
        "world3d",
        "map2d",
        "rstats",
        "analyzer",
      ];
      const defaultWidth = largeApps.includes(appId) ? 720 : 520;
      const defaultHeight = largeApps.includes(appId) ? 520 : 360;

      const newWindow: WindowInstance = {
        id,
        appId,
        title: app.name,
        x: 120 + (windowCounter % 4) * 40,
        y: 80 + (windowCounter % 4) * 30,
        width: defaultWidth,
        height: defaultHeight,
        z: newZ,
        isActive: true,
        snap: "none",
        isMinimized: false,
        isMaximized: false,
      };

      setWindows((prev) =>
        prev.map((w) => ({ ...w, isActive: false })).concat(newWindow)
      );
      setActiveWindowId(id);
      setZTop(newZ);

      RBEvents.emit({
        type: "window:opened",
        windowId: id,
        appId,
        title: app.name,
      });
    },
    [apps, zTop]
  );

  const closeWindow = useCallback((windowId: string) => {
    RBEvents.emit({ type: "window:closed", windowId });

    setWindows((prev) => {
      const filtered = prev.filter((w) => w.id !== windowId);
      if (filtered.length === 0) {
        setActiveWindowId(null);
        return filtered;
      }
      const topWindow = filtered.reduce((max, w) =>
        w.z > max.z ? w : max
      );
      setActiveWindowId(topWindow.id);
      return filtered;
    });
  }, []);

  const focusWindow = useCallback(
    (windowId: string) => {
      const newZ = zTop + 1;
      setZTop(newZ);
      setActiveWindowId(windowId);

      RBEvents.emit({ type: "window:focused", windowId });

      setWindows((prev) =>
        prev.map((w) =>
          w.id === windowId
            ? {
                ...w,
                z: newZ,
                isActive: true,
                isMinimized: false,
              }
            : { ...w, isActive: false }
        )
      );
    },
    [zTop]
  );

  const moveWindow = useCallback((windowId: string, x: number, y: number) => {
    RBEvents.emit({ type: "window:moved", windowId });

    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, x, y, snap: "none" } : w
      )
    );
  }, []);

  const resizeWindow = useCallback(
    (windowId: string, size: { width: number; height: number }) => {
      RBEvents.emit({ type: "window:resized", windowId });

      setWindows((prev) =>
        prev.map((w) =>
          w.id === windowId
            ? { ...w, width: size.width, height: size.height }
            : w
        )
      );
    },
    []
  );

  const applySnap = useCallback(
    (windowId: string, mode: "left" | "right" | "top" | "none") => {
      RBEvents.emit({ type: "window:snap", windowId, mode });

      setWindows((prev) =>
        prev.map((w) =>
          w.id === windowId ? { ...w, snap: mode, isMaximized: false } : w
        )
      );
    },
    []
  );

  const minimizeWindow = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId
          ? { ...w, isMinimized: true, isActive: false }
          : w
      )
    );
    setActiveWindowId((prev) => (prev === windowId ? null : prev));
  }, []);

  const toggleMaximizeWindow = useCallback((windowId: string) => {
    const viewportWidth = globalThis?.innerWidth ?? 1280;
    const viewportHeight = globalThis?.innerHeight ?? 720;

    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w;
        if (!w.isMaximized) {
          const restoreBounds = {
            x: w.x,
            y: w.y,
            width: w.width,
            height: w.height,
          };
          return {
            ...w,
            x: 0,
            y: 0,
            width: viewportWidth,
            height: viewportHeight,
            isMaximized: true,
            restoreBounds,
            snap: "none",
            isMinimized: false,
          };
        } else {
          if (!w.restoreBounds) {
            return {
              ...w,
              isMaximized: false,
            };
          }
          return {
            ...w,
            x: w.restoreBounds.x,
            y: w.restoreBounds.y,
            width: w.restoreBounds.width,
            height: w.restoreBounds.height,
            isMaximized: false,
            restoreBounds: undefined,
          };
        }
      })
    );

    setActiveWindowId(windowId);
  }, []);

  const value: SystemContextValue = {
    apps,
    windows,
    activeWindowId,
    openApp,
    closeWindow,
    focusWindow,
    moveWindow,
    resizeWindow,
    applySnap,
    minimizeWindow,
    toggleMaximizeWindow,
  };

  return (
    <SystemContext.Provider value={value}>{children}</SystemContext.Provider>
  );
}

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) {
    throw new Error("useSystem must be used inside SystemProvider");
  }
  return ctx;
}





