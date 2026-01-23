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
import { PortalProvider } from '@redbyte/rb-primitives';

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
  const overlayRootRef = useRef<HTMLDivElement>(null);

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
      background: focused ? 'var(--rb-panel-2)' : 'var(--rb-panel)',
      border: focused ? '1px solid var(--rb-border-strong)' : '1px solid var(--rb-border)',
      borderRadius: isMax ? 0 : 'var(--rb-radius-lg)',
      overflow: 'hidden',
      boxShadow: focused
        ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(34, 211, 238, 0.15)'
        : 'var(--rb-shadow-sm)',
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
        className="flex h-10 items-center gap-3 px-3 text-sm select-none border-b transition-colors duration-200"
        style={{
          cursor: isMax ? 'default' : 'grab',
          background: state.focused ? 'var(--rb-panel-2)' : 'var(--rb-panel)',
          borderColor: state.focused ? 'var(--rb-border-strong)' : 'var(--rb-border)',
        }}
        onMouseDown={isMax ? undefined : startDrag}
        onDoubleClick={isMax ? onRestore : onMaximize}
        data-testid="window-title-bar"
      >
        <div
          className="flex-1 truncate font-semibold tracking-wide leading-none transition-colors duration-200 pointer-events-none"
          style={{ color: state.focused ? 'var(--rb-text)' : 'var(--rb-muted)' }}
          data-testid="window-title-text"
        >
          {state.title}
        </div>
        <div className="flex items-center gap-1">
          {state.minimizable && (
            <button
              className="h-7 w-7 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-white/10 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              style={{ color: 'var(--rb-muted)' }}
              onClick={onMinimize}
              title="Minimize"
              data-testid="window-minimize-button"
            >
              <WindowMinimizeIcon width={14} height={14} />
            </button>
          )}
          {state.maximizable && (
            <button
              className="h-7 w-7 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-white/10 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              style={{ color: 'var(--rb-muted)' }}
              onClick={isMax ? onRestore : onMaximize}
              title={isMax ? "Restore" : "Maximize"}
              data-testid="window-maximize-button"
            >
              <WindowMaximizeIcon width={14} height={14} />
            </button>
          )}
          <button
            className="h-7 w-7 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-red-500/30 hover:text-red-400 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            style={{ color: 'var(--rb-muted)' }}
            onClick={onClose}
            title="Close"
            data-testid="window-close-button"
          >
            <WindowCloseIcon width={14} height={14} />
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-40px)] overflow-hidden relative" style={{ background: 'var(--rb-bg)', color: 'var(--rb-text)' }}>
        <PortalProvider container={overlayRootRef.current}>
          {children}
        </PortalProvider>
        {/* Window-scoped portal target for modals and overlays */}
        <div
          ref={overlayRootRef}
          data-rb-window-overlay-root
          className="absolute inset-0 pointer-events-none z-50"
        />
      </div>

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
