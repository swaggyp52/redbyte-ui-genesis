import { useState, useCallback } from "react";
import { WindowManager } from "./WindowManager";
export function useWindowManager() {
    const [manager] = useState(() => new WindowManager());
    const [windows, setWindows] = useState([]);
    const sync = () => {
        setWindows([...manager.getWindows()]);
    };
    const createWindow = useCallback((opts) => {
        manager.createWindow(opts);
        sync();
    }, []);
    const closeWindow = useCallback((id) => {
        manager.closeWindow(id);
        sync();
    }, []);
    const focusWindow = useCallback((id) => {
        manager.focusWindow(id);
        sync();
    }, []);
    const moveWindow = useCallback((id, x, y) => {
        manager.moveWindow(id, x, y);
        sync();
    }, []);
    const resizeWindow = useCallback((id, w, h) => {
        manager.resizeWindow(id, w, h);
        sync();
    }, []);
    const minimizeWindow = useCallback((id) => {
        manager.minimizeWindow(id);
        sync();
    }, []);
    const maximizeWindow = useCallback((id) => {
        manager.maximizeWindow(id);
        sync();
    }, []);
    const restoreWindow = useCallback((id) => {
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
