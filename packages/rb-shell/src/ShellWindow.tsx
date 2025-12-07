import React, { useState } from 'react';
import { WindowState } from '@rb/rb-windowing';
import {
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon
} from '@rb/rb-icons';

export const ShellWindow: React.FC<{
  state: WindowState;
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onRestore: () => void;
  children?: React.ReactNode;
}> = ({
  state,
  onClose,
  onFocus,
  onMove,
  onResize,
  onMinimize,
  onMaximize,
  onRestore,
  children
}) => {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);

  const startDrag = (e: React.MouseEvent) => {
    setDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
    onFocus();
  };

  const startResize = (e: React.MouseEvent) => {
    setResizing(true);
    setStart({ x: e.clientX, y: e.clientY });
    onFocus();
  };

  const endAll = () => {
    setDragging(false);
    setResizing(false);
    setStart(null);
  };

  const onMoveDrag = (e: React.MouseEvent) => {
    if (!dragging || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    onMove(state.bounds.x + dx, state.bounds.y + dy);
    setStart({ x: e.clientX, y: e.clientY });
  };

  const onResizeDrag = (e: React.MouseEvent) => {
    if (!resizing || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    onResize(state.bounds.width + dx, state.bounds.height + dy);
    setStart({ x: e.clientX, y: e.clientY });
  };

  const isMax = state.mode === 'maximized';
  const isMin = state.mode === 'minimized';

  const boundsStyle = {
    position: 'absolute' as const,
    left: isMax ? 0 : state.bounds.x,
    top: isMax ? 0 : state.bounds.y,
    width: isMax ? '100%' : state.bounds.width,
    height: isMin ? '32px' : isMax ? '100%' : state.bounds.height,
    zIndex: state.zIndex,
    border: '1px solid var(--rb-color-accent-500)',
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)'
  };

  return (
    <div
      style={boundsStyle}
      onMouseMove={dragging ? onMoveDrag : resizing ? onResizeDrag : undefined}
      onMouseUp={endAll}
      onMouseLeave={endAll}
    >
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          background: 'var(--rb-color-accent-700)',
          cursor: isMax ? 'default' : 'grab'
        }}
        onMouseDown={isMax ? undefined : startDrag}
      >
        <div style={{ flex: 1 }}>{state.title}</div>

        {state.minimizable && (
          <WindowMinimizeIcon width={16} height={16} onClick={onMinimize} />
        )}
        {state.maximizable && !isMax && (
          <WindowMaximizeIcon width={16} height={16} onClick={onMaximize} />
        )}
        {isMax && <WindowMaximizeIcon width={16} height={16} onClick={onRestore} />}
        <WindowCloseIcon width={16} height={16} onClick={onClose} />
      </div>

      {!isMin && (
        <div style={{ width: '100%', height: 'calc(100% - 32px)' }}>
          {children}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          bottom: 0,
          right: 0,
          cursor: 'nwse-resize',
          background: 'transparent'
        }}
        onMouseDown={startResize}
      />
    </div>
  );
};
