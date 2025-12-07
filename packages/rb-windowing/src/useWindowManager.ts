import { useState, useCallback } from "react";
import { WindowManager } from "./WindowManager";
import { CreateWindowOptions, WindowState } from "./types";

export function useWindowManager() {
  const [manager] = useState(() => new WindowManager());
  const [windows, setWindows] = useState<WindowState[]>([]);

  const sync = () => {
    setWindows([...manager.getWindows()]);
  };

  const createWindow = useCallback((opts: CreateWindowOptions) => {
    manager.createWindow(opts);
    sync();
  }, []);

  const closeWindow = useCallback((id: string) => {
    manager.closeWindow(id);
    sync();
  }, []);

  const focusWindow = useCallback((id: string) => {
    manager.focusWindow(id);
    sync();
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    manager.moveWindow(id, x, y);
    sync();
  }, []);

  const resizeWindow = useCallback((id: string, w: number, h: number) => {
    manager.resizeWindow(id, w, h);
    sync();
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    manager.minimizeWindow(id);
    sync();
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    manager.maximizeWindow(id);
    sync();
  }, []);

  const restoreWindow = useCallback((id: string) => {
    manager.restoreWindow(id);
    sync();
  }, []);

  return {
    windows,
    createWindow,
    closeWindow,
    focusWindow,
    moveWindow,
    resizeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
  };
}
