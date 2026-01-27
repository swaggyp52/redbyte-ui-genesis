// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WindowState, type WindowBounds } from '@redbyte/rb-windowing';
import type { SnapAssistMode } from '@redbyte/rb-utils';
import { Icon, type IconName } from '@redbyte/rb-icons';
import { PortalProvider } from '@redbyte/rb-primitives';

type SnapTarget = 'left' | 'right' | 'maximize';

const SNAP_ENTER_PX = 24;
const SNAP_EXIT_PX = 48;
const SNAP_HOVER_MS = 250;

interface ShellWindowProps {
  state: WindowState;
  minSize?: { width: number; height: number };
  snapAssistMode?: SnapAssistMode;
  iconName?: IconName;
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onRestore: () => void;
  onMoveEnd?: (bounds: WindowBounds) => void;
  onResizeEnd?: (bounds: WindowBounds) => void;
  onSnapPreviewChange?: (windowId: string, target: SnapTarget | null) => void;
  onSnap?: (windowId: string, target: SnapTarget) => void;
  provenance?: {
    appId: string;
    resourceId?: string;
    tick?: number;
  };
  children?: React.ReactNode;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const ShellWindow: React.FC<ShellWindowProps> = ({
  state,
  minSize,
  snapAssistMode = 'manual',
  iconName,
  onClose,
  onFocus,
  onMove,
  onResize,
  onMinimize,
  onMaximize,
  onRestore,
  onMoveEnd,
  onResizeEnd,
  onSnapPreviewChange,
  onSnap,
  provenance,
  children,
}) => {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<ResizeDirection | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const boundsRef = useRef<HTMLDivElement>(null);
  const overlayRootRef = useRef<HTMLDivElement>(null);
  const dragBoundsRef = useRef<WindowBounds | null>(null);
  const lastBoundsRef = useRef<WindowBounds>(state.bounds);
  const snapPreviewRef = useRef<SnapTarget | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const pendingSnapTargetRef = useRef<SnapTarget | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number; shiftKey: boolean } | null>(null);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const hasResizedRef = useRef(false);

  const isMax = state.mode === 'maximized';
  const isMin = state.mode === 'minimized';

  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  useEffect(() => {
    return () => {
      clearSnapTimer();
    };
  }, []);

  useEffect(() => {
    lastBoundsRef.current = state.bounds;
  }, [state.bounds]);

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  useEffect(() => {
    resizingRef.current = Boolean(resizing);
  }, [resizing]);

  const clearSnapTimer = () => {
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
    pendingSnapTargetRef.current = null;
  };

  const updateSnapPreview = (target: SnapTarget | null) => {
    if (snapPreviewRef.current === target) return;
    snapPreviewRef.current = target;
    onSnapPreviewChange?.(state.id, target);
    if (target) {
      clearSnapTimer();
    }
  };

  const clearSnapPreview = () => {
    updateSnapPreview(null);
    clearSnapTimer();
  };

  const resolveSnapTarget = (x: number, y: number, threshold: number): SnapTarget | null => {
    const width = window.innerWidth;
    if (y <= threshold) return 'maximize';
    if (x <= threshold) return 'left';
    if (x >= width - threshold) return 'right';
    return null;
  };

  const handleSnapPreview = (x: number, y: number, shiftKey: boolean) => {
    if (snapAssistMode === 'off') {
      clearSnapPreview();
      return;
    }

    const activeTarget = snapPreviewRef.current;
    const enterTarget = resolveSnapTarget(x, y, SNAP_ENTER_PX);
    const exitTarget = resolveSnapTarget(x, y, SNAP_EXIT_PX);

    if (activeTarget) {
      if (snapAssistMode === 'manual' && !shiftKey) {
        clearSnapPreview();
        return;
      }
      if (exitTarget === activeTarget) {
        return;
      }
      clearSnapPreview();
    }

    if (snapAssistMode === 'manual') {
      if (shiftKey && enterTarget) {
        updateSnapPreview(enterTarget);
      } else {
        clearSnapPreview();
      }
      return;
    }

    if (snapAssistMode === 'auto') {
      if (!enterTarget) {
        clearSnapTimer();
        return;
      }
      if (pendingSnapTargetRef.current !== enterTarget) {
        clearSnapTimer();
        pendingSnapTargetRef.current = enterTarget;
        snapTimerRef.current = window.setTimeout(() => {
          if (!draggingRef.current || resizingRef.current) return;
          const pointer = lastPointerRef.current;
          if (!pointer) return;
          const currentTarget = resolveSnapTarget(pointer.x, pointer.y, SNAP_ENTER_PX);
          if (currentTarget === enterTarget) {
            updateSnapPreview(enterTarget);
          }
        }, SNAP_HOVER_MS);
      }
    }
  };

  const startDrag = (e: React.MouseEvent) => {
    if (isMax || isMin) return;
    draggingRef.current = true;
    setDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
    dragBoundsRef.current = { ...state.bounds };
    hasMovedRef.current = false;
    clearSnapPreview();
    onFocus();
  };

  const finishDrag = (shouldSnap: boolean) => {
    if (!draggingRef.current) return;
    const activeSnap = snapPreviewRef.current;
    draggingRef.current = false;
    setDragging(false);
    setStart(null);
    dragBoundsRef.current = null;
    if (shouldSnap && activeSnap && onSnap) {
      onSnap(state.id, activeSnap);
    } else if (hasMovedRef.current) {
      onMoveEnd?.(lastBoundsRef.current);
    }
    clearSnapPreview();
  };

  const finishResize = () => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    setResizing(null);
    setStart(null);
    dragBoundsRef.current = null;
    if (hasResizedRef.current) {
      onResizeEnd?.(lastBoundsRef.current);
    }
    clearSnapPreview();
  };

  const onMoveDrag = (e: React.MouseEvent) => {
    if (!draggingRef.current || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const currentBounds = dragBoundsRef.current ?? state.bounds;
    const nextBounds: WindowBounds = {
      ...currentBounds,
      x: currentBounds.x + dx,
      y: currentBounds.y + dy,
    };
    hasMovedRef.current = true;
    dragBoundsRef.current = nextBounds;
    lastBoundsRef.current = nextBounds;
    onMove(nextBounds.x, nextBounds.y);
    lastPointerRef.current = { x: e.clientX, y: e.clientY, shiftKey: e.shiftKey };
    handleSnapPreview(e.clientX, e.clientY, e.shiftKey);
    setStart({ x: e.clientX, y: e.clientY });
  };

  const startResize = (dir: ResizeDirection) => (e: React.MouseEvent) => {
    e.stopPropagation();
    resizingRef.current = true;
    setResizing(dir);
    setStart({ x: e.clientX, y: e.clientY });
    dragBoundsRef.current = { ...state.bounds };
    hasResizedRef.current = false;
    clearSnapPreview();
    onFocus();
  };

  const onResizeDrag = (e: React.MouseEvent) => {
    if (!resizingRef.current || !start || isMax || isMin || !resizing) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    const currentBounds = dragBoundsRef.current ?? state.bounds;
    let { width, height, x, y } = currentBounds;
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

    const nextBounds: WindowBounds = { x, y, width, height };
    hasResizedRef.current = true;
    dragBoundsRef.current = nextBounds;
    lastBoundsRef.current = nextBounds;
    onResize(width, height);
    onMove(x, y);
    setStart({ x: e.clientX, y: e.clientY });
  };

  const containerStyle = useMemo(() => {
    const { bounds, zIndex, focused } = state;
    const opacity = mounted ? 1 : 0;
    const transform = mounted ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(6px)';
    return {
      position: 'absolute' as const,
      left: isMax ? 0 : bounds.x,
      top: isMax ? 0 : bounds.y,
      width: isMax ? '100%' : bounds.width,
      height: isMax ? '100%' : bounds.height,
      zIndex,
      opacity,
      transform,
      transition:
        'opacity var(--rb-motion-fast) var(--rb-easing-out), transform var(--rb-motion-fast) var(--rb-easing-out), box-shadow 140ms var(--rb-easing-out), border-color 140ms var(--rb-easing-out), background-color 140ms var(--rb-easing-out)',
      background: focused ? 'var(--rb-surface-2)' : 'var(--rb-surface-1)',
      border: focused ? '1px solid var(--rb-border-strong)' : '1px solid var(--rb-border)',
      borderRadius: isMax ? 0 : 'var(--rb-radius-lg)',
      overflow: 'hidden',
      boxShadow: focused
        ? 'var(--rb-shadow-2), 0 0 0 1px var(--rb-accent-weak)'
        : 'var(--rb-shadow-1)',
      backdropFilter: 'blur(18px)',
      filter: focused ? 'saturate(1)' : 'saturate(0.92)',
      display: isMin ? 'none' : 'block',
    } as React.CSSProperties;
  }, [state, isMax, isMin, mounted]);

  return (
    <div
      ref={boundsRef}
      style={containerStyle}
      onMouseMove={dragging ? onMoveDrag : resizing ? onResizeDrag : undefined}
      onMouseUp={() => {
        if (draggingRef.current) finishDrag(true);
        if (resizingRef.current) finishResize();
      }}
      onMouseLeave={() => {
        if (draggingRef.current) finishDrag(false);
        if (resizingRef.current) finishResize();
      }}
      onMouseDown={onFocus}
    >
      <div
        className="flex h-11 items-center gap-3 px-3 text-sm select-none border-b"
        style={{
          cursor: isMax ? 'default' : 'grab',
          background: state.focused ? 'var(--rb-surface-2)' : 'var(--rb-surface-1)',
          borderColor: state.focused ? 'var(--rb-border-strong)' : 'var(--rb-border)',
          transition: 'background-color 140ms var(--rb-easing-out), border-color 140ms var(--rb-easing-out)',
        }}
        onMouseDown={isMax ? undefined : startDrag}
        onDoubleClick={isMax ? onRestore : onMaximize}
        data-testid="window-title-bar"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 pointer-events-none">
          {iconName && (
            <div
              className="h-8 w-8 rounded-md border flex items-center justify-center"
              style={{
                borderColor: state.focused ? 'var(--rb-border-strong)' : 'var(--rb-border)',
                background: 'var(--rb-surface-3)',
                color: state.focused ? 'var(--rb-text)' : 'var(--rb-muted)',
              }}
            >
              <Icon name={iconName} size={16} />
            </div>
          )}
          <div className="min-w-0">
            <div
              className="truncate font-semibold tracking-wide leading-tight"
              style={{ color: state.focused ? 'var(--rb-text)' : 'var(--rb-muted)' }}
              data-testid="window-title-text"
            >
              {state.title}
            </div>
            {provenance?.resourceId && (
              <div className="truncate text-[10px] font-mono" style={{ color: 'var(--rb-faint)' }}>
                {provenance.resourceId}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {state.minimizable && (
            <button
              className="rb-window-control h-7 w-7 rounded-md flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              onClick={onMinimize}
              title="Minimize"
              data-testid="window-minimize-button"
            >
              <Icon name="window-minimize" size={16} />
            </button>
          )}
          {state.maximizable && (
            <button
              className="rb-window-control h-7 w-7 rounded-md flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              onClick={isMax ? onRestore : onMaximize}
              title={isMax ? "Restore" : "Maximize"}
              data-testid="window-maximize-button"
            >
              <Icon name="window-maximize" size={16} />
            </button>
          )}
          <button
            className="rb-window-control h-7 w-7 rounded-md flex items-center justify-center hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/50 hover:text-red-300"
            onClick={onClose}
            title="Close"
            data-testid="window-close-button"
          >
            <Icon name="window-close" size={16} />
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-44px)] flex flex-col" style={{ background: 'var(--rb-surface-0)', color: 'var(--rb-text)' }}>
        <div className="flex-1 overflow-hidden relative">
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
        <div
          className="h-6 px-3 flex items-center justify-between text-[10px] font-mono tracking-wide border-t"
          style={{
            color: 'var(--rb-faint)',
            borderColor: 'var(--rb-border)',
            background: 'var(--rb-panel)',
            pointerEvents: 'none',
          }}
          data-testid="window-provenance"
        >
          <span>app:{provenance?.appId ?? state.contentId}</span>
          <span>resource:{provenance?.resourceId ?? 'none'}</span>
          <span>tick:{(provenance?.tick ?? 0).toString().padStart(4, '0')}</span>
        </div>
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
