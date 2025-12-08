import React, { useCallback, useEffect, useState, useRef } from 'react';
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

  const windows = useWindowStore((s) => s.getZOrderedWindows());
  const createWindow = useWindowStore((s) => s.createWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);

  const [bindings, setBindings] = useState<Record<string, WindowAppBinding>>({});
  const settings = useSettingsStore();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      applyTheme(document.documentElement, settings.themeVariant);
    }
  }, [settings.themeVariant]);

  const openWindow = useCallback(
    (appId: string, props?: any) => {
      const app = getApp(appId);
      if (!app) return null;

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
    [createWindow, focusWindow, windows]
  );

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
    if (!booted) return;

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
            <Component onOpenApp={openWindow} {...binding?.props} />
          </ShellWindow>
        );
      })}

      <ToastContainer />
    </div>
  );
};
