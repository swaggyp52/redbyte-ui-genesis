import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2 } from 'lucide-react';
import useLabStore from '../store/labStore';
/**
 * WindowManager: Main window management UI
 * Renders draggable, resizable windows with z-order management
 */
export const WindowManager = ({ registry }) => {
    const windows = useLabStore((s) => s.windows);
    const bringToFront = useLabStore((s) => s.bringToFront);
    const closeWindow = useLabStore((s) => s.closeWindow);
    const setWindows = useLabStore((s) => s.setWindows);
    const [dragState, setDragState] = useState(null);
    const [resizeState, setResizeState] = useState(null);
    const dragRef = useRef(null);
    // Handle mouse move for drag and resize
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (dragState) {
                const deltaX = e.clientX - dragState.startX;
                const deltaY = e.clientY - dragState.startY;
                const newX = dragState.startWindowX + deltaX;
                const newY = dragState.startWindowY + deltaY;
                setWindows(windows.map((win) => win.id === dragState.windowId
                    ? { ...win, x: newX, y: newY }
                    : win));
            }
            if (resizeState) {
                const deltaX = e.clientX - resizeState.startX;
                const deltaY = e.clientY - resizeState.startY;
                const newWidth = Math.max(300, resizeState.startWidth + deltaX);
                const newHeight = Math.max(200, resizeState.startHeight + deltaY);
                setWindows(windows.map((win) => win.id === resizeState.windowId
                    ? { ...win, w: newWidth, h: newHeight }
                    : win));
            }
        };
        const handleMouseUp = () => {
            setDragState(null);
            setResizeState(null);
        };
        if (dragState || resizeState) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragState, resizeState, windows, setWindows]);
    const handleHeaderMouseDown = (e, windowId) => {
        if (e.target.closest('button'))
            return; // Don't drag from buttons
        bringToFront(windowId);
        setDragState({
            windowId,
            startX: e.clientX,
            startY: e.clientY,
            startWindowX: windows.find((w) => w.id === windowId)?.x ?? 0,
            startWindowY: windows.find((w) => w.id === windowId)?.y ?? 0,
        });
    };
    const handleResizeMouseDown = (e, windowId) => {
        e.preventDefault();
        const windowState = windows.find((w) => w.id === windowId);
        if (!windowState)
            return;
        setResizeState({
            windowId,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: windowState.w,
            startHeight: windowState.h,
        });
    };
    const handleMinimize = (windowId) => {
        setWindows(windows.map((win) => win.id === windowId ? { ...win, minimized: !win.minimized } : win));
    };
    const handleMaximize = (windowId) => {
        const windowState = windows.find((w) => w.id === windowId);
        if (!windowState)
            return;
        if (windowState.maximized) {
            // Restore from maximized (would need to save prev rect, for now just toggle)
            setWindows(windows.map((win) => win.id === windowId
                ? { ...win, maximized: false, x: 100, y: 100, w: 600, h: 400 }
                : win));
        }
        else {
            // Maximize to full screen
            setWindows(windows.map((win) => win.id === windowId
                ? { ...win, maximized: true, x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - 60 }
                : win));
        }
    };
    // Sort windows by z-order
    const sortedWindows = [...windows].sort((a, b) => a.z - b.z);
    return (_jsx("div", { className: "absolute inset-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800", children: sortedWindows.map((windowState) => (_jsx(Window, { windowState: windowState, registry: registry, onHeaderMouseDown: (e) => handleHeaderMouseDown(e, windowState.id), onResizeMouseDown: (e) => handleResizeMouseDown(e, windowState.id), onMinimize: () => handleMinimize(windowState.id), onMaximize: () => handleMaximize(windowState.id), onClose: () => closeWindow(windowState.id), onFocus: () => bringToFront(windowState.id) }, windowState.id))) }));
};
/**
 * Individual Window component
 */
const Window = ({ windowState, registry, onHeaderMouseDown, onResizeMouseDown, onMinimize, onMaximize, onClose, onFocus, }) => {
    const view = registry.getView(windowState.pluginId, windowState.viewId);
    if (!view)
        return null;
    const Component = view.Component;
    return (_jsxs("div", { "data-window-id": windowState.id, className: "absolute bg-slate-800 border border-cyan-500/30 rounded-lg shadow-2xl flex flex-col", style: {
            left: `${windowState.x}px`,
            top: `${windowState.y}px`,
            width: `${windowState.w}px`,
            height: `${windowState.h}px`,
            zIndex: windowState.z,
            display: windowState.minimized ? 'none' : 'flex',
        }, onClick: onFocus, children: [_jsxs("div", { className: "window-header bg-gradient-to-r from-slate-700 to-slate-800 border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between cursor-move select-none group hover:bg-gradient-to-r hover:from-slate-600 hover:to-slate-700 transition-all duration-200 glow-box-cyan", onMouseDown: onHeaderMouseDown, children: [_jsxs("div", { className: "flex items-center gap-3 flex-1", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-cyan-400 group-hover:shadow-lg group-hover:shadow-cyan-400/50 transition-all duration-200" }), _jsx("span", { className: "font-tech font-semibold text-cyan-300 group-hover:text-cyan-200", children: view.title })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: (e) => {
                                    e.stopPropagation();
                                    onMinimize();
                                }, className: "p-1.5 hover:bg-slate-600/50 rounded transition-all duration-200 text-slate-400 hover:text-cyan-400", title: "Minimize", children: _jsx(Minus, { size: 16 }) }), _jsx("button", { onClick: (e) => {
                                    e.stopPropagation();
                                    onMaximize();
                                }, className: "p-1.5 hover:bg-slate-600/50 rounded transition-all duration-200 text-slate-400 hover:text-cyan-400", title: "Maximize", children: _jsx(Maximize2, { size: 16 }) }), _jsx("button", { onClick: (e) => {
                                    e.stopPropagation();
                                    onClose();
                                }, className: "p-1.5 hover:bg-red-600/50 rounded transition-all duration-200 text-slate-400 hover:text-red-400", title: "Close", children: _jsx(X, { size: 16 }) })] })] }), _jsx("div", { className: "flex-1 overflow-auto bg-slate-800/50 p-4", children: _jsx(Component, {}) }), _jsx("div", { className: "absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group hover:bg-cyan-500/30 transition-all duration-200", onMouseDown: onResizeMouseDown, title: "Resize", children: _jsx("div", { className: "absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-cyan-400 group-hover:border-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200" }) })] }));
};
