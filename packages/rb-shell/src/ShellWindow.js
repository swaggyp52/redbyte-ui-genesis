import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { WindowCloseIcon, WindowMaximizeIcon, WindowMinimizeIcon } from '@rb/rb-icons';
export const ShellWindow = ({ state, onClose, onFocus, onMove, onResize, onMinimize, onMaximize, onRestore, children }) => {
    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(false);
    const [start, setStart] = useState(null);
    const startDrag = (e) => {
        setDragging(true);
        setStart({ x: e.clientX, y: e.clientY });
        onFocus();
    };
    const startResize = (e) => {
        setResizing(true);
        setStart({ x: e.clientX, y: e.clientY });
        onFocus();
    };
    const endAll = () => {
        setDragging(false);
        setResizing(false);
        setStart(null);
    };
    const onMoveDrag = (e) => {
        if (!dragging || !start)
            return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        onMove(state.bounds.x + dx, state.bounds.y + dy);
        setStart({ x: e.clientX, y: e.clientY });
    };
    const onResizeDrag = (e) => {
        if (!resizing || !start)
            return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        onResize(state.bounds.width + dx, state.bounds.height + dy);
        setStart({ x: e.clientX, y: e.clientY });
    };
    const isMax = state.mode === 'maximized';
    const isMin = state.mode === 'minimized';
    const boundsStyle = {
        position: 'absolute',
        left: isMax ? 0 : state.bounds.x,
        top: isMax ? 0 : state.bounds.y,
        width: isMax ? '100%' : state.bounds.width,
        height: isMin ? '32px' : isMax ? '100%' : state.bounds.height,
        zIndex: state.zIndex,
        border: '1px solid var(--rb-color-accent-500)',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)'
    };
    return (_jsxs("div", { style: boundsStyle, onMouseMove: dragging ? onMoveDrag : resizing ? onResizeDrag : undefined, onMouseUp: endAll, onMouseLeave: endAll, children: [_jsxs("div", { style: {
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    background: 'var(--rb-color-accent-700)',
                    cursor: isMax ? 'default' : 'grab'
                }, onMouseDown: isMax ? undefined : startDrag, children: [_jsx("div", { style: { flex: 1 }, children: state.title }), state.minimizable && (_jsx(WindowMinimizeIcon, { width: 16, height: 16, onClick: onMinimize })), state.maximizable && !isMax && (_jsx(WindowMaximizeIcon, { width: 16, height: 16, onClick: onMaximize })), isMax && _jsx(WindowMaximizeIcon, { width: 16, height: 16, onClick: onRestore }), _jsx(WindowCloseIcon, { width: 16, height: 16, onClick: onClose })] }), !isMin && (_jsx("div", { style: { width: '100%', height: 'calc(100% - 32px)' }, children: children })), _jsx("div", { style: {
                    position: 'absolute',
                    width: 10,
                    height: 10,
                    bottom: 0,
                    right: 0,
                    cursor: 'nwse-resize',
                    background: 'transparent'
                }, onMouseDown: startResize })] }));
};
