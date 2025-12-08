import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext } from 'react';
import { useWindowManager } from '@rb/rb-windowing';
import { ShellWindow } from './ShellWindow';
import { getApp } from '@rb/rb-apps';
const ShellContext = createContext(null);
export const useShell = () => useContext(ShellContext);
export const Shell = ({ children }) => {
    const wm = useWindowManager();
    return (_jsx(ShellContext.Provider, { value: { createWindow: wm.createWindow }, children: _jsxs("div", { style: { position: 'relative', width: '100%', height: '100%' }, children: [wm.windows.map(win => {
                    const def = win.contentId ? getApp(win.contentId) : null;
                    const Content = def?.launch ?? null;
                    return (_jsx(ShellWindow, { state: win, onClose: () => wm.closeWindow(win.id), onFocus: () => wm.focusWindow(win.id), onMove: (x, y) => wm.moveWindow(win.id, x, y), onResize: (w, h) => wm.resizeWindow(win.id, w, h), onMinimize: () => wm.minimizeWindow(win.id), onMaximize: () => wm.maximizeWindow(win.id), onRestore: () => wm.restoreWindow(win.id), children: Content && _jsx(Content, {}) }, win.id));
                }), children] }) }));
};
