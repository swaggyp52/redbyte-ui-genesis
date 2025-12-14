// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { Desktop } from './Desktop';
import { Dock } from './Dock';
import { ShellWindow } from './ShellWindow';
import { applyTheme } from '@redbyte/rb-theme';
import { useSettingsStore } from '@redbyte/rb-utils';
import { getApp, type RedByteApp } from '@redbyte/rb-apps';
import { useWindowStore } from '@redbyte/rb-windowing';
import BootScreen from './BootScreen';
import { ToastContainer } from './ToastContainer';
import './styles.css';

export interface ShellProps {
  children?: React.ReactNode;
}

interface WindowAppBinding {
  appId: string;
  props?: any;
}

export const Shell: React.FC<ShellProps> = () => {
  const [booted, setBooted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('rb:shell:booted') === '1';
  });

  const hasShownWelcomeRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const windowsRaw = useWindowStore((s) => s.windows);
  const windows = useMemo(() => {
    return [...windowsRaw].sort((a, b) => a.zIndex - b.zIndex);
  }, [windowsRaw]);
  const createWindow = useWindowStore((s) => s.createWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);

  const [bindings, setBindings] = useState<Record<string, WindowAppBinding>>({});
  const [recentAppIds, setRecentAppIds] = useState<string[]>([]);
  const [pinnedAppIds, setPinnedAppIds] = useState<string[]>(() => {
    if (typeof localStorage === 'undefined') return [];

    try {
      const raw = localStorage.getItem('rb:shell:pinnedApps');
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string');
      }
    } catch {}

    return [];
  });
  const settings = useSettingsStore();

  const recordRecentApp = useCallback((appId: string) => {
    if (appId === 'launcher') return;

    setRecentAppIds((prev) => {
      const next = [appId, ...prev.filter((id) => id !== appId)];
      return next.slice(0, 5);
    });
  }, []);

  const togglePinnedAppId = useCallback((appId: string) => {
    if (appId === 'launcher') return;

    setPinnedAppIds((prev) => {
      const exists = prev.includes(appId);
      const next = exists ? prev.filter((id) => id !== appId) : [appId, ...prev];

      try {
        localStorage.setItem('rb:shell:pinnedApps', JSON.stringify(next));
      } catch {}

      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      applyTheme(document.documentElement, settings.themeVariant);
    }
  }, [settings.themeVariant]);

  const openWindow = useCallback(
    (appId: string, props?: any) => {
      const app = getApp(appId);
      if (!app) return null;

      recordRecentApp(appId);

      if (app.manifest.singleton) {
        const existing = windows.find((w) => w.contentId === appId);
        if (existing) {
          focusWindow(existing.id);
          setBindings((prev) => ({ ...prev, [existing.id]: { appId, props } }));
          return existing.id;
        }
      }

      const state = createWindow({
        title: app.manifest.name,
        width: app.manifest.defaultSize?.width,
        height: app.manifest.defaultSize?.height,
        contentId: app.manifest.id,
      });

      setBindings((prev) => ({ ...prev, [state.id]: { appId, props } }));
      return state.id;
    },
    [createWindow, focusWindow, recordRecentApp, windows]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== 'k') return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') return;
      if (target?.isContentEditable) return;

      event.preventDefault();
      openWindow('launcher');
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openWindow]);

  const handleClose = useCallback(
    (id: string) => {
      closeWindow(id);
      setBindings((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [closeWindow]
  );

  useEffect(() => {
    if (!booted || hasInitializedRef.current) return;

    hasInitializedRef.current = true;

    try {
      localStorage.setItem('rb:shell:booted', '1');
    } catch {}

    if (!hasShownWelcomeRef.current) {
      hasShownWelcomeRef.current = true;

      const welcomeSeen = localStorage.getItem('rb-os:v1:welcomeSeen');

      if (welcomeSeen !== 'true') {
        const timer = setTimeout(() => openWindow('welcome'), 500);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  return (
    <div className="shell-container relative w-screen h-screen overflow-hidden bg-black text-white">
      <Desktop
        onOpenApp={openWindow}
        wallpaperId={settings.wallpaperId}
        themeVariant={settings.themeVariant}
      />

      <Dock onOpenApp={openWindow} />

      {windows.map((window) => {
        const binding = bindings[window.id];
        const app: RedByteApp | null = binding ? getApp(binding.appId) : getApp(window.contentId);
        if (!app) return null;
        const Component = app.component;

        return (
          <ShellWindow
            key={window.id}
            state={window}
            minSize={app.manifest.minSize}
            onClose={() => handleClose(window.id)}
            onFocus={() => focusWindow(window.id)}
            onMove={(x, y) => moveWindow(window.id, x, y)}
            onResize={(w, h) => resizeWindow(window.id, w, h)}
            onMinimize={() => toggleMinimize(window.id)}
            onMaximize={() => toggleMaximize(window.id)}
            onRestore={() => restoreWindow(window.id)}
          >
            <Component
              onOpenApp={openWindow}
              onClose={() => handleClose(window.id)}
              recentAppIds={app.manifest.id === 'launcher' ? recentAppIds : undefined}
              pinnedAppIds={app.manifest.id === 'launcher' ? pinnedAppIds : undefined}
              onTogglePin={app.manifest.id === 'launcher' ? togglePinnedAppId : undefined}
              {...binding?.props}
            />
          </ShellWindow>
        );
      })}

      <ToastContainer />
    </div>
  );
};
