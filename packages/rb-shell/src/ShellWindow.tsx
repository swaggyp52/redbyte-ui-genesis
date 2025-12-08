import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WindowState } from '@rb/rb-windowing';
import {
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon,
} from '@rb/rb-icons';

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
    const { bounds, zIndex } = state;
    const opacity = mounted ? 1 : 0;
    const transform = mounted ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)';
    const animating = 'transition-all duration-300 ease-out';
    return {
      position: 'absolute' as const,
      left: isMax ? 0 : bounds.x,
      top: isMax ? 0 : bounds.y,
      width: isMax ? '100%' : bounds.width,
      height: isMin ? 40 : isMax ? '100%' : bounds.height,
      zIndex,
      opacity,
      transform,
      transition: animating,
      background: 'rgba(5, 8, 15, 0.8)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
      backdropFilter: 'blur(18px)',
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
        className="flex h-10 items-center gap-2 px-3 text-sm select-none bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80"
        style={{ cursor: isMax ? 'default' : 'grab' }}
        onMouseDown={isMax ? undefined : startDrag}
      >
        <div className="font-semibold tracking-wide flex-1 truncate">{state.title}</div>
        {state.minimizable && (
          <button className="hover:text-cyan-300" onClick={onMinimize}>
            <WindowMinimizeIcon width={16} height={16} />
          </button>
        )}
        {state.maximizable && (
          <button className="hover:text-cyan-300" onClick={isMax ? onRestore : onMaximize}>
            <WindowMaximizeIcon width={16} height={16} />
          </button>
        )}
        <button className="hover:text-red-400" onClick={onClose}>
          <WindowCloseIcon width={16} height={16} />
        </button>
      </div>

      {!isMin && <div className="h-[calc(100%-40px)] bg-slate-950/40 text-white">{children}</div>}

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
