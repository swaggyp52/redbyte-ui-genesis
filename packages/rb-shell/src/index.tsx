import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppManifest } from "@redbyte/rb-apps";
import { FilesIcon } from "@redbyte/rb-icons";
import { Button, Panel, Text } from "@redbyte/rb-primitives";
import { createWindowingStore, WindowState, WindowingStore, WindowingStoreApi } from "@redbyte/rb-windowing";
import { useStore } from "zustand";

export type WallpaperVariant = "neon-circuit" | "frost-grid";

interface NotificationItem {
  id: string;
  message: string;
  type?: "info" | "error";
}

interface NotificationContextValue {
  notify: (message: string, type?: NotificationItem["type"]) => void;
}

const WindowingContext = createContext<WindowingStoreApi | null>(null);
const NotificationContext = createContext<NotificationContextValue | null>(null);

const WALLPAPER_KEY = "rb-os:v1:wallpaper";

const wallpaperStyles: Record<WallpaperVariant, React.CSSProperties> = {
  "neon-circuit": {
    background: "radial-gradient(circle at 20% 20%, rgba(0,151,230,0.35), transparent 25%), radial-gradient(circle at 80% 30%, rgba(111,174,255,0.35), transparent 30%), linear-gradient(135deg, #0b1020 0%, #0e1328 50%, #111a36 100%)",
  },
  "frost-grid": {
    background: "linear-gradient(135deg, #f6fbff 0%, #dbe7f3 50%, #a6bfd6 100%)",
    maskImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.9), rgba(255,255,255,0.65))",
  },
};

const useWindowingStore = <T,>(selector: (state: WindowingStore) => T): T => {
  const store = useContext(WindowingContext);
  if (!store) {
    throw new Error("Windowing store not available");
  }
  return useStore<WindowingStore, T>(store, selector);
};

const useWallpaper = (initial: WallpaperVariant = "neon-circuit") => {
  const [current, setCurrent] = useState<WallpaperVariant>(() => {
    const persisted = typeof window !== "undefined" ? window.localStorage.getItem(WALLPAPER_KEY) : null;
    if (persisted === "neon-circuit" || persisted === "frost-grid") {
      return persisted;
    }
    return initial;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WALLPAPER_KEY, current);
    }
  }, [current]);

  return {
    current,
    style: wallpaperStyles[current],
    setWallpaper: setCurrent,
  };
};

const useKeyboardNavigation = (store: WindowingStoreApi): void => {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.altKey && event.key === "Tab") {
        event.preventDefault();
        const windows = store.getState().getZOrderedWindows();
        if (windows.length === 0) return;
        const focusedId = store.getState().focusedWindowId;
        const currentIndex = windows.findIndex((w) => w.id === focusedId);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? windows.length - 1 : currentIndex - 1)
          : (currentIndex + 1) % windows.length;
        store.getState().focusWindow(windows[nextIndex].id);
      }

      if (event.altKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const focusedId = store.getState().focusedWindowId;
        if (!focusedId) return;
        const delta = 15;
        const bounds: Partial<WindowState["bounds"]> = {};
        if (event.key === "ArrowUp") bounds.y = store.getState().windows.find((w) => w.id === focusedId)?.bounds.y - delta;
        if (event.key === "ArrowDown") bounds.y = store.getState().windows.find((w) => w.id === focusedId)?.bounds.y + delta;
        if (event.key === "ArrowLeft") bounds.x = store.getState().windows.find((w) => w.id === focusedId)?.bounds.x - delta;
        if (event.key === "ArrowRight") bounds.x = store.getState().windows.find((w) => w.id === focusedId)?.bounds.x + delta;
        store.getState().moveWindow(focusedId, bounds);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);
};

export interface DesktopProps {
  apps: AppManifest[];
  wallpaper?: WallpaperVariant;
  children?: React.ReactNode;
}

export const Desktop: React.FC<DesktopProps> = ({ apps, wallpaper = "neon-circuit", children }) => {
  const store = useMemo(() => createWindowingStore(), []);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const wallpaperState = useWallpaper(wallpaper);

  useKeyboardNavigation(store);

  const notify = (message: string, type: NotificationItem["type"] = "info") => {
    const id = `note-${Math.random().toString(36).slice(2, 8)}`;
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  return (
    <WindowingContext.Provider value={store}>
      <NotificationContext.Provider value={{ notify }}>
        <div className="relative min-h-screen overflow-hidden" style={wallpaperState.style} data-wallpaper={wallpaperState.current}>
          <div className="absolute inset-0 opacity-80" aria-hidden />
          <div className="relative z-10 flex min-h-screen flex-col text-white">
            <Dock apps={apps} />
            <div className="flex-1">
              <WindowLayer />
              {children}
            </div>
            <Taskbar />
            <Notifications notifications={notifications} />
          </div>
        </div>
      </NotificationContext.Provider>
    </WindowingContext.Provider>
  );
};

const WindowLayer: React.FC = () => {
  const windows = useWindowingStore((state) => state.windows);
  const focusWindow = useWindowingStore((state) => state.focusWindow);
  const closeWindow = useWindowingStore((state) => state.closeWindow);
  const toggleMinimize = useWindowingStore((state) => state.toggleMinimize);
  const toggleMaximize = useWindowingStore((state) => state.toggleMaximize);

  return (
    <div className="relative z-0">
      {windows.map((win) => (
        <div
          key={win.id}
          role="dialog"
          aria-label={win.title}
          style={{
            position: "absolute",
            left: win.bounds.x,
            top: win.bounds.y,
            width: win.bounds.width,
            height: win.bounds.height,
            zIndex: win.zIndex,
            display: win.minimized ? "none" : "block",
          }}
          onMouseDown={() => focusWindow(win.id)}
          className={`rounded-lg border border-[color:var(--rb-color-surface-400,#152a56)] bg-[color:var(--rb-color-surface-200,#111a36)] text-[color:var(--rb-color-text-50,#f8fbff)] shadow-lg transition-transform duration-150 ${
            win.focused ? "ring-2 ring-[color:var(--rb-color-accent-400,#24b1ff)]" : ""
          }`}
        >
          <div className="flex items-center justify-between border-b border-[color:var(--rb-color-surface-400,#152a56)] px-3 py-2">
            <Text as="h3" className="text-sm font-medium">
              {win.title}
            </Text>
            <div className="flex items-center gap-2">
              <Button aria-label="Minimize window" variant="ghost" onClick={() => toggleMinimize(win.id)}>
                –
              </Button>
              <Button aria-label="Maximize window" variant="ghost" onClick={() => toggleMaximize(win.id)}>
                □
              </Button>
              <Button aria-label="Close window" variant="ghost" onClick={() => closeWindow(win.id)}>
                ✕
              </Button>
            </div>
          </div>
          <div className="p-4 text-xs text-[color:var(--rb-color-text-100,#e2e8f5)]">RedByte window content placeholder</div>
        </div>
      ))}
    </div>
  );
};

export interface DockProps {
  apps: AppManifest[];
}

export const Dock: React.FC<DockProps> = ({ apps }) => {
  const openWindow = useWindowingStore((state) => state.openWindow);
  return (
    <div role="toolbar" aria-label="Dock" className="flex items-center gap-3 p-4">
      {apps.map((app) => {
        const Icon = app.icon ?? FilesIcon;
        return (
          <Button key={app.id} aria-label={app.name} variant="ghost" onClick={() => openWindow({ appId: app.id, title: app.name })}>
            <Icon width={20} height={20} />
          </Button>
        );
      })}
    </div>
  );
};

export const Taskbar: React.FC = () => {
  const windows = useWindowingStore((state) => state.windows);
  const focusWindow = useWindowingStore((state) => state.focusWindow);
  const toggleMinimize = useWindowingStore((state) => state.toggleMinimize);
  const closeWindow = useWindowingStore((state) => state.closeWindow);
  return (
    <div role="toolbar" aria-label="Taskbar" className="flex items-center gap-2 border-t border-[color:var(--rb-color-surface-400,#152a56)] bg-[color:var(--rb-color-surface-100,#0e1328)] px-3 py-2">
      {windows.map((win) => (
        <Button
          key={win.id}
          variant="ghost"
          aria-pressed={win.focused}
          onClick={() => (win.minimized ? toggleMinimize(win.id) : focusWindow(win.id))}
          onContextMenu={(event) => {
            event.preventDefault();
            closeWindow(win.id);
          }}
        >
          {win.title}
        </Button>
      ))}
    </div>
  );
};

export interface NotificationsProps {
  notifications: NotificationItem[];
}

export const Notifications: React.FC<NotificationsProps> = ({ notifications }) => {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {notifications.map((note) => (
        <Panel
          key={note.id}
          role="status"
          className={`pointer-events-auto bg-[color:var(--rb-color-surface-200,#111a36)] ${note.type === "error" ? "border-red-400" : ""}`}
        >
          <Text>{note.message}</Text>
        </Panel>
      ))}
    </div>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("Notification context missing");
  return ctx;
};

export { createWindowingStore } from "@redbyte/rb-windowing";
