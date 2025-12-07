import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppManifest } from '@rb/rb-apps';
import { WindowCloseIcon, WindowMaximizeIcon, WindowMinimizeIcon } from '@rb/rb-icons';
import { applyTheme, getActiveTheme, type TokenVariant } from '@rb/rb-theme';
import {
  createWindowingStore,
  selectZOrderedWindows,
  type WindowBounds,
  type WindowingStore,
  type WindowState,
} from '@rb/rb-windowing';
import { useStore } from 'zustand';
import { type StoreApi } from 'zustand/vanilla';

export interface Wallpaper {
  id: string;
  label: string;
  type: 'gradient' | 'image' | 'shader';
  value: string;
}

const DEFAULT_WALLPAPERS: Wallpaper[] = [
  {
    id: 'neon-circuit',
    label: 'Neon Circuit',
    type: 'gradient',
    value: 'radial-gradient(circle at 20% 20%, #0ff 0%, transparent 25%), radial-gradient(circle at 80% 0%, #8b5cf6 0%, transparent 35%), linear-gradient(135deg, #050816 0%, #0b1224 100%)',
  },
  {
    id: 'frost-grid',
    label: 'Frost Grid',
    type: 'shader',
    value: 'linear-gradient(120deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(173,216,230,0.15) 100%)',
  },
];

const NOISE_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" opacity="0.2"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
  );

const WALLPAPER_STORAGE_KEY = 'rb-shell:wallpaper';

const wallpaperToBackground = (wallpaper: Wallpaper): string => {
  if (wallpaper.type === 'image') {
    return `url(${wallpaper.value})`;
  }

  if (wallpaper.type === 'shader') {
    return `${wallpaper.value}, radial-gradient(circle at 10% 10%, rgba(255,255,255,0.08), transparent 40%), radial-gradient(circle at 90% 80%, rgba(255,255,255,0.05), transparent 40%)`;
  }

  return wallpaper.value;
};

const WindowingContext = createContext<StoreApi<WindowingStore> | null>(null);

export const useWindowingStore = (): StoreApi<WindowingStore> => {
  const store = useContext(WindowingContext);
  if (!store) {
    throw new Error('WindowingContext not found. Did you forget to render <Desktop />?');
  }

  return store;
};

export const useWindowing = <T,>(selector: (state: WindowingStore) => T, equalityFn?: (a: T, b: T) => boolean): T => {
  const store = useWindowingStore();
  return useStore(store, selector, equalityFn);
};

const useParallax = (disabled: boolean) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (disabled) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (event.clientX / innerWidth - 0.5) * 8;
      const y = (event.clientY / innerHeight - 0.5) * 8;
      setOffset({ x, y });
    };

    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, [disabled]);

  return offset;
};

interface WindowFrameProps {
  windowState: WindowState;
}

const WindowFrame: React.FC<WindowFrameProps> = ({ windowState }) => {
  const store = useWindowingStore();
  const dragRef = useRef<{ mode: 'move' | 'resize'; lastX: number; lastY: number } | null>(null);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current) {
        return;
      }
      event.preventDefault();

      const dx = event.clientX - dragRef.current.lastX;
      const dy = event.clientY - dragRef.current.lastY;
      dragRef.current.lastX = event.clientX;
      dragRef.current.lastY = event.clientY;

      if (dragRef.current.mode === 'move') {
        store.getState().move(windowState.id, { dx, dy });
      } else {
        const dimensions: Partial<WindowBounds> = {
          width: Math.max(240, windowState.bounds.width + dx),
          height: Math.max(200, windowState.bounds.height + dy),
        };
        store.getState().resize(windowState.id, dimensions);
      }
    };

    const handleUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [store, windowState.id, windowState.bounds.width, windowState.bounds.height]);

  const startDrag = (event: React.PointerEvent, mode: 'move' | 'resize') => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragRef.current = { mode, lastX: event.clientX, lastY: event.clientY };
  };

  return (
    <div
      role="dialog"
      aria-label={`${windowState.title} window`}
      data-window-id={windowState.id}
      style={{
        position: 'absolute',
        top: windowState.bounds.y,
        left: windowState.bounds.x,
        width: windowState.bounds.width,
        height: windowState.bounds.height,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(12, 16, 32, 0.75)',
        backdropFilter: 'blur(8px)',
        color: '#e2e8f0',
        display: windowState.minimized ? 'none' : 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
        zIndex: 10 + selectZOrderedWindows(store.getState()).findIndex((win) => win.id === windowState.id),
      }}
    >
      <div
        role="toolbar"
        onPointerDown={(event) => startDrag(event, 'move')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          cursor: 'grab',
          userSelect: 'none',
          background: 'linear-gradient(90deg, rgba(139,92,246,0.25), rgba(0,255,255,0.15))',
        }}
      >
        <span style={{ fontWeight: 600 }}>{windowState.title}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            aria-label="Minimize window"
            onClick={() => store.getState().toggleMinimize(windowState.id)}
            style={controlButtonStyle}
          >
            <WindowMinimizeIcon />
          </button>
          <button
            aria-label="Maximize window"
            onClick={() => store.getState().toggleMaximize(windowState.id)}
            style={controlButtonStyle}
          >
            <WindowMaximizeIcon />
          </button>
          <button
            aria-label="Close window"
            onClick={() => store.getState().close(windowState.id)}
            style={controlButtonStyle}
          >
            <WindowCloseIcon />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, padding: 12 }}>
        <p style={{ margin: 0, color: '#cbd5e1' }}>Window content placeholder for {windowState.title}.</p>
      </div>
      <div
        aria-label="Resize handle"
        onPointerDown={(event) => startDrag(event, 'resize')}
        style={{
          width: 18,
          height: 18,
          alignSelf: 'flex-end',
          margin: 6,
          borderRadius: 6,
          cursor: 'nwse-resize',
          background: 'linear-gradient(135deg, rgba(0,255,255,0.5), rgba(139,92,246,0.5))',
        }}
      />
    </div>
  );
};

const controlButtonStyle: React.CSSProperties = {
  appearance: 'none',
  border: '1px solid rgba(226,232,240,0.25)',
  background: 'rgba(15,23,42,0.65)',
  color: 'inherit',
  borderRadius: 8,
  width: 30,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

export interface DesktopProps {
  children?: ReactNode;
  apps?: AppManifest[];
  wallpaper?: Wallpaper;
  wallpapers?: Wallpaper[];
  theme?: TokenVariant;
  storageKey?: string;
  store?: StoreApi<WindowingStore>;
}

const WindowLayer: React.FC = () => {
  const windows = useWindowing(selectZOrderedWindows);
  const active = windows.filter((window) => !window.minimized);

  return (
    <>
      {active.map((windowState) => (
        <WindowFrame key={windowState.id} windowState={windowState} />
      ))}
    </>
  );
};

export const Desktop: React.FC<DesktopProps> = ({
  children,
  apps = [],
  wallpaper,
  wallpapers,
  theme,
  storageKey = WALLPAPER_STORAGE_KEY,
  store,
}) => {
  const providedStore = useMemo<StoreApi<WindowingStore>>(
    () => store ?? createWindowingStore({ snapToGrid: 8 }),
    [store],
  );
  const [activeWallpaper, setActiveWallpaper] = useState<Wallpaper>(() => {
    const saved = storageKey && typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    const list = wallpapers ?? DEFAULT_WALLPAPERS;
    const found = list.find((entry) => entry.id === saved);
    return wallpaper ?? found ?? list[0];
  });

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parallax = useParallax(prefersReducedMotion);

  useEffect(() => {
    if (theme) {
      applyTheme(null, theme, { storageKey: 'rb-shell:theme' });
    } else {
      const existing = getActiveTheme();
      if (existing) {
        applyTheme(null, existing, { storageKey: 'rb-shell:theme' });
      }
    }
  }, [theme]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, activeWallpaper.id);
    } catch (error) {
      console.warn('rb-shell: unable to persist wallpaper', error);
    }
  }, [activeWallpaper.id, storageKey]);

  const wallpaperChoice = wallpaper ?? activeWallpaper;
  const availableWallpapers = wallpapers ?? DEFAULT_WALLPAPERS;
  const backgroundLayers = `${wallpaperToBackground(wallpaperChoice)}, url(${NOISE_DATA_URL})`;

  return (
    <WindowingContext.Provider value={providedStore}>
      <div
        role="application"
        aria-label="RedByte desktop"
        style={{
          position: 'relative',
          minHeight: '100vh',
          overflow: 'hidden',
          backgroundImage: backgroundLayers,
          backgroundSize: 'cover, 240px 240px',
          backgroundPosition: `${parallax.x}px ${parallax.y}px, center`,
          transition: prefersReducedMotion ? 'none' : 'background-position 120ms ease-out',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'soft-light' }} />
        <div style={{ padding: 16, display: 'flex', gap: 12 }}>
          <Dock apps={apps} />
          <select
            aria-label="Wallpaper chooser"
            value={wallpaperChoice.id}
            onChange={(event) => {
              const next = availableWallpapers.find((entry) => entry.id === event.target.value);
              if (next) {
                setActiveWallpaper(next);
              }
            }}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(15,23,42,0.65)',
              color: '#e2e8f0',
              minWidth: 160,
            }}
          >
            {availableWallpapers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ position: 'absolute', inset: 0 }}>
          <WindowLayer />
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
          <Taskbar />
        </div>
        {children}
      </div>
    </WindowingContext.Provider>
  );
};

export interface DockProps {
  apps: AppManifest[];
}

export const Dock: React.FC<DockProps> = ({ apps }) => {
  const store = useWindowingStore();

  return (
    <div
      role="menubar"
      aria-label="Dock"
      style={{
        display: 'flex',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 14,
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {apps.map((app) => (
        <button
          key={app.id}
          role="menuitem"
          onClick={() =>
            store.getState().open({
              id: `${app.id}-${Date.now()}`,
              title: app.title,
              appId: app.id,
              bounds: app.defaultBounds ?? { x: 120, y: 120, width: 520, height: 360 },
            })
          }
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'linear-gradient(135deg, rgba(0,255,255,0.2), rgba(139,92,246,0.2))',
            color: '#e2e8f0',
            cursor: 'pointer',
          }}
        >
          {app.icon}
          <span style={{ marginLeft: 6 }}>{app.title}</span>
        </button>
      ))}
    </div>
  );
};

export const Taskbar: React.FC = () => {
  const store = useWindowingStore();
  const windows = useWindowing(selectZOrderedWindows);

  return (
    <div
      role="toolbar"
      aria-label="Taskbar"
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 14,
        background: 'rgba(12, 16, 32, 0.85)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {windows.map((window) => (
        <button
          key={window.id}
          aria-pressed={window.id === store.getState().focusedWindowId}
          onClick={() => {
            if (window.minimized) {
              store.getState().toggleMinimize(window.id);
            }
            store.getState().focus(window.id);
          }}
          onDoubleClick={() => store.getState().toggleMinimize(window.id)}
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.14)',
            background: window.id === store.getState().focusedWindowId ? 'rgba(0,255,255,0.18)' : 'rgba(30,41,59,0.8)',
            color: '#e2e8f0',
            minWidth: 120,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <strong style={{ display: 'block', fontWeight: 700 }}>{window.title}</strong>
          <small style={{ display: 'block', opacity: 0.8 }}>{window.appId ?? 'Generic App'}</small>
        </button>
      ))}
    </div>
  );
};

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
}

export interface NotificationsProps {
  items: NotificationItem[];
  onDismiss: (id: string) => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ items, onDismiss }) => (
  <div
    role="status"
    aria-label="Notifications"
    style={{
      position: 'fixed',
      top: 12,
      right: 12,
      display: 'grid',
      gap: 10,
      width: 320,
    }}
  >
    {items.map((item) => (
      <div
        key={item.id}
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          background: 'rgba(15,23,42,0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#e2e8f0',
          boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{item.title}</strong>
          <button
            aria-label={`Dismiss ${item.title}`}
            onClick={() => onDismiss(item.id)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>{item.message}</p>
      </div>
    ))}
  </div>
);
