import React, { createContext, useContext } from 'react';
import { useWindowManager } from '@rb/rb-windowing';
import { ShellWindow } from './ShellWindow';
import { getApp } from '@rb/rb-apps';

interface ShellContextValue {
  createWindow: ReturnType<typeof useWindowManager>['createWindow'];
}

const ShellContext = createContext<ShellContextValue | null>(null);
export const useShell = () => useContext(ShellContext)!;

export const Shell: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const wm = useWindowManager();

  return (
    <ShellContext.Provider value={{ createWindow: wm.createWindow }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {wm.windows.map(win => {
          const def = win.contentId ? getApp(win.contentId) : null;
          const Content = def?.launch ?? null;

          return (
            <ShellWindow
              key={win.id}
              state={win}
              onClose={() => wm.closeWindow(win.id)}
              onFocus={() => wm.focusWindow(win.id)}
              onMove={(x, y) => wm.moveWindow(win.id, x, y)}
              onResize={(w, h) => wm.resizeWindow(win.id, w, h)}
              onMinimize={() => wm.minimizeWindow(win.id)}
              onMaximize={() => wm.maximizeWindow(win.id)}
              onRestore={() => wm.restoreWindow(win.id)}
            >
              {Content && <Content />}
            </ShellWindow>
          );
        })}
        {children}
      </div>
    </ShellContext.Provider>
  );
};
