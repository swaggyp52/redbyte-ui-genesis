// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WindowState } from '@redbyte/rb-windowing';
import {
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon,
} from '@redbyte/rb-icons';

interface ShellWindowProps {
  state: WindowState;
  minSize?: { width: number; height: number };
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onRestore: () => void;
  children?: React.ReactNode;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const ShellWindow: React.FC<ShellWindowProps> = ({
  state,
  minSize,
  onClose,
  onFocus,
  onMove,
  onResize,
  onMinimize,
  onMaximize,
  onRestore,
  children,
}) => {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<ResizeDirection | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const boundsRef = useRef<HTMLDivElement>(null);

  const isMax = state.mode === 'maximized';
  const isMin = state.mode === 'minimized';

  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const applySnap = (x: number, y: number) => {
    const threshold = 24;
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (y < threshold) {
      onMaximize();
      return;
    }

    if (x < threshold) {
      onResize(width / 2, height);
      onMove(0, 0);
      return;
    }

    if (width - (x + (state.bounds.width || 0)) < threshold) {
      onResize(width / 2, height);
      onMove(width / 2, 0);
    } else {
      onMove(x, y);
    }
  };

  const startDrag = (e: React.MouseEvent) => {
    if (isMax) return;
    setDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
    onFocus();
  };

  const endAll = () => {
    if (dragging && start) {
      applySnap(state.bounds.x, state.bounds.y);
    }
    setDragging(false);
    setResizing(null);
    setStart(null);
  };

  const onMoveDrag = (e: React.MouseEvent) => {
    if (!dragging || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    onMove(state.bounds.x + dx, state.bounds.y + dy);
    setStart({ x: e.clientX, y: e.clientY });
  };

  const startResize = (dir: ResizeDirection) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizing(dir);
    setStart({ x: e.clientX, y: e.clientY });
    onFocus();
  };

  const onResizeDrag = (e: React.MouseEvent) => {
    if (!resizing || !start || isMax || isMin) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    let { width, height, x, y } = state.bounds;
    const minW = minSize?.width ?? 320;
    const minH = minSize?.height ?? 240;

    if (resizing.includes('e')) {
      width = Math.max(minW, width + dx);
    }
    if (resizing.includes('s')) {
      height = Math.max(minH, height + dy);
    }
    if (resizing.includes('w')) {
      width = Math.max(minW, width - dx);
      x = x + dx;
    }
    if (resizing.includes('n')) {
      height = Math.max(minH, height - dy);
      y = y + dy;
    }

    onResize(width, height);
    onMove(x, y);
    setStart({ x: e.clientX, y: e.clientY });
  };

  const containerStyle = useMemo(() => {
    const { bounds, zIndex, focused } = state;
    const opacity = mounted ? 1 : 0;
    const transform = mounted ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)';
    const animating = 'transition-all duration-300 ease-out';
    return {
      position: 'absolute' as const,
      left: isMax ? 0 : bounds.x,
      top: isMax ? 0 : bounds.y,
      width: isMax ? '100%' : bounds.width,
      height: isMax ? '100%' : bounds.height,
      zIndex,
      opacity,
      transform,
      transition: animating,
      background: focused
        ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.97) 0%, rgba(15, 23, 42, 0.95) 50%, rgba(6, 182, 212, 0.02) 100%)'
        : 'rgba(15, 23, 42, 0.95)',
      border: focused ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(71, 85, 105, 0.3)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: focused
        ? '0 25px 70px rgba(6, 182, 212, 0.2), 0 10px 30px rgba(6, 182, 212, 0.1), 0 0 0 1px rgba(6, 182, 212, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
        : '0 15px 50px rgba(0, 0, 0, 0.5), 0 5px 20px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(24px)',
      display: isMin ? 'none' : 'block',
    } as React.CSSProperties;
  }, [state, isMax, isMin, mounted]);

  return (
    <div
      ref={boundsRef}
      style={containerStyle}
      onMouseMove={dragging ? onMoveDrag : resizing ? onResizeDrag : undefined}
      onMouseUp={endAll}
      onMouseLeave={endAll}
      onMouseDown={onFocus}
    >
      <div
        className={`flex h-11 items-center gap-2 px-4 text-sm select-none border-b transition-all duration-200 ${
          state.focused
            ? 'bg-gradient-to-r from-slate-800/95 via-slate-900/95 to-slate-800/95 border-cyan-500/30 shadow-[0_1px_10px_rgba(6,182,212,0.1)]'
            : 'bg-slate-900/70 border-slate-700/30'
        }`}
        style={{ cursor: isMax ? 'default' : 'grab' }}
        onMouseDown={isMax ? undefined : startDrag}
        onDoubleClick={isMax ? onRestore : onMaximize}
      >
        <div className={`font-semibold tracking-wide flex-1 truncate transition-colors duration-200 ${
          state.focused ? 'text-white drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]' : 'text-slate-400'
        }`}>
          {state.title}
        </div>
        <div className="flex items-center gap-1">
          {state.minimizable && (
            <button
              className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-cyan-300 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/20"
              onClick={onMinimize}
              title="Minimize"
            >
              <WindowMinimizeIcon width={14} height={14} />
            </button>
          )}
          {state.maximizable && (
            <button
              className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-cyan-300 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/20"
              onClick={isMax ? onRestore : onMaximize}
              title={isMax ? "Restore" : "Maximize"}
            >
              <WindowMaximizeIcon width={14} height={14} />
            </button>
          )}
          <button
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20"
            onClick={onClose}
            title="Close"
          >
            <WindowCloseIcon width={14} height={14} />
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-44px)] bg-slate-950/50 text-white overflow-hidden">{children}</div>

      {/* Resize handles */}
      {!isMax && !isMin && (
        <>
          <div className="resize-handle" style={{ cursor: 'nwse-resize', top: 0, left: 0 }} onMouseDown={startResize('nw')} />
          <div className="resize-handle" style={{ cursor: 'nesw-resize', top: 0, right: 0 }} onMouseDown={startResize('ne')} />
          <div className="resize-handle" style={{ cursor: 'nesw-resize', bottom: 0, left: 0 }} onMouseDown={startResize('sw')} />
          <div className="resize-handle" style={{ cursor: 'nwse-resize', bottom: 0, right: 0 }} onMouseDown={startResize('se')} />
          <div className="resize-edge" style={{ cursor: 'ew-resize', left: 0 }} onMouseDown={startResize('w')} />
          <div className="resize-edge" style={{ cursor: 'ew-resize', right: 0 }} onMouseDown={startResize('e')} />
          <div className="resize-edge" style={{ cursor: 'ns-resize', top: 0 }} onMouseDown={startResize('n')} />
          <div className="resize-edge" style={{ cursor: 'ns-resize', bottom: 0 }} onMouseDown={startResize('s')} />
        </>
      )}
    </div>
  );
};
