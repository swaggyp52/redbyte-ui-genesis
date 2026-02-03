// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { WindowState, type WindowBounds } from '@redbyte/rb-windowing';
import type { SnapAssistMode } from '@redbyte/rb-utils';
import { Icon, type IconName } from '@redbyte/rb-icons';
import { PortalProvider, GuardrailConfirmModal } from '@redbyte/rb-primitives';
import { getMaximizedBounds, TOPBAR_HEIGHT, DOCK_WIDTH, MIN_VISIBLE_SIDE } from './layout/layout-constants';
import { usePersistenceStore, type SaveStatus } from './persistenceStore';

type SnapTarget = 'left' | 'right' | 'maximize';

const SNAP_ENTER_PX = 24;
const SNAP_EXIT_PX = 48;
const SNAP_HOVER_MS = 250;
const THROTTLE_MS = 16; // ~60 FPS, throttle drag/resize calls

interface ShellWindowProps {
  state: WindowState;
  minSize?: { width: number; height: number };
  snapAssistMode?: SnapAssistMode;
  iconName?: IconName | string;
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

const ShellWindowComponent: React.FC<ShellWindowProps> = ({
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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
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

  // Throttling refs for drag/resize to prevent spamming onMove/onResize
  const lastMoveTimeRef = useRef<number>(0);
  const lastResizeTimeRef = useRef<number>(0);
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null);
  const pendingResizeRef = useRef<{ w: number; h: number } | null>(null);

  const isMax = state.mode === 'maximized';
  const isMin = state.mode === 'minimized';
  const saveStatus: SaveStatus = usePersistenceStore((s) => s.windows[state.id]?.status ?? 'clean');
  const hasUnsavedChanges = saveStatus === 'dirty' || saveStatus === 'saving' || saveStatus === 'error';

  const requestExport = useCallback(() => {
    if (typeof window === 'undefined') return;
    const detail = { windowId: state.id, appId: provenance?.appId };
    window.dispatchEvent(new CustomEvent('rb:export-request', { detail }));
  }, [state.id, provenance]);

  const handleCloseRequest = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  useEffect(() => {
    return () => { clearSnapTimer(); };
  }, []);

  useEffect(() => { lastBoundsRef.current = state.bounds; }, [state.bounds]);
  useEffect(() => { draggingRef.current = dragging; }, [dragging]);
  useEffect(() => { resizingRef.current = Boolean(resizing); }, [resizing]);

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
    if (target) clearSnapTimer();
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
    if (snapAssistMode === 'off') { clearSnapPreview(); return; }

    const activeTarget = snapPreviewRef.current;
    const enterTarget = resolveSnapTarget(x, y, SNAP_ENTER_PX);
    const exitTarget = resolveSnapTarget(x, y, SNAP_EXIT_PX);

    if (activeTarget) {
      if (snapAssistMode === 'manual' && !shiftKey) { clearSnapPreview(); return; }
      if (exitTarget === activeTarget) return;
      clearSnapPreview();
    }

    if (snapAssistMode === 'manual') {
      if (shiftKey && enterTarget) { updateSnapPreview(enterTarget); } else { clearSnapPreview(); }
      return;
    }

    if (snapAssistMode === 'auto') {
      if (!enterTarget) { clearSnapTimer(); return; }
      if (pendingSnapTargetRef.current !== enterTarget) {
        clearSnapTimer();
        pendingSnapTargetRef.current = enterTarget;
        snapTimerRef.current = window.setTimeout(() => {
          if (!draggingRef.current || resizingRef.current) return;
          const pointer = lastPointerRef.current;
          if (!pointer) return;
          const currentTarget = resolveSnapTarget(pointer.x, pointer.y, SNAP_ENTER_PX);
          if (currentTarget === enterTarget) updateSnapPreview(enterTarget);
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

    // Flush any pending move calls
    if (pendingMoveRef.current) {
      onMove(pendingMoveRef.current.x, pendingMoveRef.current.y);
      pendingMoveRef.current = null;
    }
    lastMoveTimeRef.current = 0;

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

    // Flush any pending resize/move calls
    if (pendingResizeRef.current) {
      onResize(pendingResizeRef.current.w, pendingResizeRef.current.h);
      pendingResizeRef.current = null;
    }
    if (pendingMoveRef.current) {
      onMove(pendingMoveRef.current.x, pendingMoveRef.current.y);
      pendingMoveRef.current = null;
    }
    lastResizeTimeRef.current = 0;
    lastMoveTimeRef.current = 0;

    if (hasResizedRef.current) onResizeEnd?.(lastBoundsRef.current);
    clearSnapPreview();
  };

  const onMoveDrag = (e: React.MouseEvent) => {
    if (!draggingRef.current || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const currentBounds = dragBoundsRef.current ?? state.bounds;
    let newX = currentBounds.x + dx;
    let newY = currentBounds.y + dy;

    // Clamp: never above TopBar
    if (newY < TOPBAR_HEIGHT) newY = TOPBAR_HEIGHT;

    // Clamp: keep at least MIN_VISIBLE_SIDE px visible horizontally
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const minX = DOCK_WIDTH - currentBounds.width + MIN_VISIBLE_SIDE;
    const maxX = vw - MIN_VISIBLE_SIDE;
    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;

    const nextBounds: WindowBounds = { ...currentBounds, x: newX, y: newY };
    hasMovedRef.current = true;
    dragBoundsRef.current = nextBounds;
    lastBoundsRef.current = nextBounds;

    // Throttle onMove to reduce system log spam and re-renders
    const now = Date.now();
    if (now - lastMoveTimeRef.current >= THROTTLE_MS) {
      onMove(nextBounds.x, nextBounds.y);
      lastMoveTimeRef.current = now;
    } else {
      pendingMoveRef.current = { x: nextBounds.x, y: nextBounds.y };
    }

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

    if (resizing.includes('e')) width = Math.max(minW, width + dx);
    if (resizing.includes('s')) height = Math.max(minH, height + dy);
    if (resizing.includes('w')) { width = Math.max(minW, width - dx); x = x + dx; }
    if (resizing.includes('n')) { height = Math.max(minH, height - dy); y = y + dy; }

    const nextBounds: WindowBounds = { x, y, width, height };
    hasResizedRef.current = true;
    dragBoundsRef.current = nextBounds;
    lastBoundsRef.current = nextBounds;

    // Throttle onResize and onMove to reduce system log spam and re-renders
    const now = Date.now();
    if (now - lastResizeTimeRef.current >= THROTTLE_MS) {
      onResize(width, height);
      onMove(x, y);
      lastResizeTimeRef.current = now;
    } else {
      pendingResizeRef.current = { w: width, h: height };
      pendingMoveRef.current = { x, y };
    }

    setStart({ x: e.clientX, y: e.clientY });
  };

  const containerStyle = useMemo(() => {
    const { bounds, zIndex, focused } = state;
    const opacity = mounted ? 1 : 0;
    const transform = mounted ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(4px)';
    const maxBounds = isMax ? getMaximizedBounds() : null;
    return {
      position: 'absolute' as const,
      left: maxBounds ? maxBounds.x : bounds.x,
      top: maxBounds ? maxBounds.y : bounds.y,
      width: maxBounds ? maxBounds.width : bounds.width,
      height: maxBounds ? maxBounds.height : bounds.height,
      zIndex,
      opacity,
      transform,
      transition: `opacity var(--rb-motion-normal) var(--rb-easing-out), transform var(--rb-motion-normal) var(--rb-easing-out)`,
      background: 'var(--rb-surface-1)',
      border: focused ? '1px solid var(--rb-border-strong)' : '1px solid var(--rb-border)',
      borderRadius: isMax ? 0 : 'var(--rb-radius-lg)',
      overflow: 'hidden',
      boxShadow: focused ? 'var(--rb-shadow-3)' : 'var(--rb-shadow-1)',
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
      onPointerDown={onFocus}
    >
      {/* Title bar - 36px */}
      <div
        className="flex h-9 items-center gap-2.5 px-3 text-sm select-none border-b"
        style={{
          cursor: isMax ? 'default' : 'grab',
          background: state.focused ? 'var(--rb-surface-2)' : 'var(--rb-surface-1)',
          borderColor: 'var(--rb-border)',
        }}
        onMouseDown={isMax ? undefined : startDrag}
        onDoubleClick={isMax ? onRestore : onMaximize}
        data-testid="window-title-bar"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pointer-events-none">
          {iconName && (
            <div
              className="h-6 w-6 rounded flex items-center justify-center"
              style={{
                background: 'var(--rb-surface-3)',
                color: state.focused ? 'var(--rb-text)' : 'var(--rb-text-2)',
              }}
            >
              <Icon name={iconName} size={14} />
            </div>
          )}
          <div
            className="truncate text-[13px] font-medium tracking-wide"
            style={{ color: state.focused ? 'var(--rb-text)' : 'var(--rb-text-2)' }}
            data-testid="window-title-text"
          >
            {state.title}
          </div>
          {saveStatus !== 'clean' && (
            <span
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              title={saveStatus === 'dirty' ? 'Unsaved changes' : saveStatus === 'saving' ? 'Saving...' : 'Save error'}
              style={{
                background:
                  saveStatus === 'dirty' ? 'var(--rb-amber, #F59E0B)'
                    : saveStatus === 'saving' ? 'var(--rb-accent, #3B82F6)'
                      : 'var(--rb-danger, #EF4444)',
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {state.minimizable && (
            <button
              type="button"
              className="rb-window-control h-6 w-6 rounded flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              onClick={onMinimize}
              title="Minimize"
              data-testid="window-minimize-button"
            >
              <Icon name="window-minimize" size={14} />
            </button>
          )}
          {state.maximizable && (
            <button
              type="button"
              className="rb-window-control h-6 w-6 rounded flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              onClick={isMax ? onRestore : onMaximize}
              title={isMax ? "Restore" : "Maximize"}
              data-testid="window-maximize-button"
            >
              <Icon name="window-maximize" size={14} />
            </button>
          )}
          <button
            type="button"
            className="rb-window-control h-6 w-6 rounded flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 hover:!bg-red-500/20 hover:!text-red-400"
            onClick={handleCloseRequest}
            title="Close"
            data-testid="window-close-button"
          >
            <Icon name="window-close" size={14} />
          </button>
        </div>
      </div>

      <GuardrailConfirmModal
        isOpen={showCloseConfirm}
        title="Close window with unsaved changes?"
        message="This window has unsaved changes that may be lost."
        lossItems={['Unsaved edits', 'Autosave recovery state']}
        confirmLabel="Close Anyway"
        confirmTone="warning"
        onConfirm={() => {
          setShowCloseConfirm(false);
          onClose();
        }}
        onCancel={() => setShowCloseConfirm(false)}
        onExport={requestExport}
        exportLabel="Export First"
      />

      {/* App content - fills remaining space */}
      <div
        className="flex-1 min-h-0 min-w-0 overflow-hidden relative"
        style={{
          height: 'calc(100% - 36px)',
          background: 'var(--rb-surface-0)',
          color: 'var(--rb-text)',
        }}
      >
        <PortalProvider container={overlayRootRef.current}>
          {children}
        </PortalProvider>
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

/**
 * ShellWindow - Render-Optimized Window Container
 *
 * Wrapped with React.memo to prevent unnecessary re-renders.
 * Only re-renders when:
 * - state object reference changes (window bounds, mode, focus, etc.)
 * - children change
 * - callback props change (if not stable)
 *
 * This prevents dragging one window from re-rendering all other windows.
 */
export const ShellWindow = React.memo(
  ShellWindowComponent,
  (prevProps, nextProps) => {
    // Deep equality check for state object (window bounds, mode, focus, etc.)
    const stateEqual =
      prevProps.state.id === nextProps.state.id &&
      prevProps.state.bounds.x === nextProps.state.bounds.x &&
      prevProps.state.bounds.y === nextProps.state.bounds.y &&
      prevProps.state.bounds.width === nextProps.state.bounds.width &&
      prevProps.state.bounds.height === nextProps.state.bounds.height &&
      prevProps.state.mode === nextProps.state.mode &&
      prevProps.state.focused === nextProps.state.focused &&
      prevProps.state.zIndex === nextProps.state.zIndex &&
      prevProps.state.title === nextProps.state.title;

    // Children equality (shallow)
    const childrenEqual = prevProps.children === nextProps.children;

    // If both state and children are equal, skip re-render
    return stateEqual && childrenEqual;
  }
);
