// Copyright © 2025 Connor Angiel — RedByte OS Genesis

import { useRef, useState, useCallback, useEffect } from 'react';
import { screenToWorld, clientToLocal, worldToGrid } from '@redbyte/rb-viewport';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseCanvasInputOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  camera: { x: number; y: number; zoom: number };
  circuitNodes: Array<{ id: string; position?: { x: number; y: number } }>;
  selectedNodeIds: Set<string>;
  onNodeMoveEnd: (nodeId: string, x: number, y: number) => void;
  onNodeSelect: (nodeId: string, addToSelection: boolean) => void;
  onPan: (dx: number, dy: number) => void;
  onClearSelection: () => void;
  onMarqueeChange?: (marquee?: { x1: number; y1: number; x2: number; y2: number }) => void;
  onMarqueeCommit?: (nodeIds: string[], addToSelection: boolean) => void;
  onWireCancel?: () => void;
  isSpacePressed: boolean;
  isReplayMode: boolean;
  interactionMode: string; // 'idle' | 'placing' | 'draggingNode' | 'boxSelecting' | 'wiring' | 'panning'
  setInteractionMode: (mode: string) => void;
  snapEnabled: boolean;
  gridSize: number;
}

export interface CanvasInputHandlers {
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => void;
  dragState: {
    isDragging: boolean;
    dragNodeId: string | null;
    dragPosition: { x: number; y: number } | null;
    dragDelta: { x: number; y: number } | null;
  };
}

// Internal state machine modes (not exposed to the store).
type InternalMode =
  | 'idle'
  | 'pending-drag'
  | 'dragging-node'
  | 'pending-box-select'
  | 'box-selecting'
  | 'panning';

interface MutableState {
  mode: InternalMode;
  dragStartScreen: { x: number; y: number };
  nodeStartWorld: { x: number; y: number };
  panLastScreen: { x: number; y: number };
  panVelocity: { x: number; y: number };
  dragNodeId: string | null;
  boxStartScreen: { x: number; y: number };
}

const DRAG_THRESHOLD_PX = 3;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCanvasInput(options: UseCanvasInputOptions): CanvasInputHandlers {
  const {
    svgRef,
    camera,
    circuitNodes,
    selectedNodeIds,
    onNodeMoveEnd,
    onNodeSelect,
    onPan,
    onClearSelection,
    onMarqueeChange,
    onMarqueeCommit,
    onWireCancel,
    isSpacePressed,
    isReplayMode,
    interactionMode,
    setInteractionMode,
    snapEnabled,
    gridSize,
  } = options;

  // Mutable ref for state-machine internals (no re-renders during drag).
  const stateRef = useRef<MutableState>({
    mode: 'idle',
    dragStartScreen: { x: 0, y: 0 },
    nodeStartWorld: { x: 0, y: 0 },
    panLastScreen: { x: 0, y: 0 },
    panVelocity: { x: 0, y: 0 },
    dragNodeId: null,
    boxStartScreen: { x: 0, y: 0 },
  });

  // Only dragPosition triggers re-renders (visual feedback).
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null);
  // Ref to latest drag position for stable pointer-up callback.
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const panInertiaRafRef = useRef<number | null>(null);

  const stopPanInertia = useCallback(() => {
    if (panInertiaRafRef.current !== null) {
      cancelAnimationFrame(panInertiaRafRef.current);
      panInertiaRafRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------
  // Pointer Down
  // -------------------------------------------------------------------
  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      stopPanInertia();
      setDragDelta(null);
      // Guard: replay mode or non-passthrough interaction modes
      if (isReplayMode) return;
      if (interactionMode !== 'idle' && interactionMode !== 'wiring') return;

      const s = stateRef.current;

      // ---- Middle-mouse or Space+Left → panning ----
      if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
        s.mode = 'panning';
        s.panLastScreen = { x: e.clientX, y: e.clientY };
        s.panVelocity = { x: 0, y: 0 };
        setInteractionMode('panning');
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      // ---- Right-click while wiring → cancel wire ----
      if (e.button === 2 && interactionMode === 'wiring') {
        onWireCancel?.();
        return;
      }

      // ---- Left-click (not space) ----
      if (e.button === 0 && !isSpacePressed) {
        const target = e.target as Element;

        // If a port was clicked, let the port handler deal with it.
        if (target.closest('[data-port-id]')) return;
        // Wire clicks are handled by WireView. Treating them as background would
        // immediately enter pending box-select and clear wire selection on pointerup.
        if (target.closest('[data-wire-id]')) return;

        const nodeEl = target.closest('[data-node-id]');
        if (nodeEl) {
          const nodeId = nodeEl.getAttribute('data-node-id');
          if (!nodeId) return;

          const node = circuitNodes.find((n) => n.id === nodeId);
          if (!node || !node.position) return;

          s.mode = 'pending-drag';
          s.dragStartScreen = { x: e.clientX, y: e.clientY };
          s.nodeStartWorld = { x: node.position.x, y: node.position.y };
          s.dragNodeId = nodeId;
          setDragDelta({ x: 0, y: 0 });

          const isAlreadySelected = selectedNodeIds.has(nodeId);
          const preserveMultiSelection = isAlreadySelected && selectedNodeIds.size > 1 && !e.shiftKey;
          if (!preserveMultiSelection) {
            onNodeSelect(nodeId, e.shiftKey);
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }

        // Background click
        if (interactionMode === 'wiring') {
          onWireCancel?.();
        } else {
          s.mode = 'pending-box-select';
          s.boxStartScreen = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }
    },
    [
      isReplayMode,
      interactionMode,
      isSpacePressed,
      circuitNodes,
      selectedNodeIds,
      onNodeSelect,
      onClearSelection,
      onWireCancel,
      setInteractionMode,
      stopPanInertia,
    ],
  );

  // -------------------------------------------------------------------
  // Pointer Move
  // -------------------------------------------------------------------
  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const s = stateRef.current;

      // ---- Panning ----
      if (s.mode === 'panning') {
        const dx = e.clientX - s.panLastScreen.x;
        const dy = e.clientY - s.panLastScreen.y;
        onPan(dx, dy);
        s.panVelocity = { x: dx, y: dy };
        s.panLastScreen = { x: e.clientX, y: e.clientY };
        return;
      }

      // ---- Pending drag → check threshold ----
      if (s.mode === 'pending-drag') {
        const dx = e.clientX - s.dragStartScreen.x;
        const dy = e.clientY - s.dragStartScreen.y;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
          s.mode = 'dragging-node';
          setInteractionMode('draggingNode');
        } else {
          return;
        }
        // Fall through to dragging-node to compute first position.
      }

      if (s.mode === 'pending-box-select') {
        const dx = e.clientX - s.boxStartScreen.x;
        const dy = e.clientY - s.boxStartScreen.y;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
          s.mode = 'box-selecting';
          setInteractionMode('boxSelecting');
        } else {
          return;
        }
      }

      if (s.mode === 'box-selecting') {
        onMarqueeChange?.({
          x1: s.boxStartScreen.x,
          y1: s.boxStartScreen.y,
          x2: e.clientX,
          y2: e.clientY,
        });
        return;
      }

      // ---- Dragging node ----
      if (s.mode === 'dragging-node') {
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();

        const startLocal = clientToLocal(s.dragStartScreen.x, s.dragStartScreen.y, rect);
        const startWorld = screenToWorld(startLocal.x, startLocal.y, camera);

        const nowLocal = clientToLocal(e.clientX, e.clientY, rect);
        const nowWorld = screenToWorld(nowLocal.x, nowLocal.y, camera);

        const deltaX = nowWorld.x - startWorld.x;
        const deltaY = nowWorld.y - startWorld.y;

        let newX = s.nodeStartWorld.x + deltaX;
        let newY = s.nodeStartWorld.y + deltaY;

        if (snapEnabled) {
          const snapped = worldToGrid(newX, newY, gridSize);
          newX = snapped.x;
          newY = snapped.y;
        }

        const snappedDeltaX = newX - s.nodeStartWorld.x;
        const snappedDeltaY = newY - s.nodeStartWorld.y;

        dragPositionRef.current = { x: newX, y: newY };
        setDragPosition({ x: newX, y: newY });
        setDragDelta({ x: Math.round(snappedDeltaX), y: Math.round(snappedDeltaY) });
      }
    },
    [camera, svgRef, onPan, setInteractionMode, snapEnabled, gridSize],
  );

  // -------------------------------------------------------------------
  // Pointer Up
  // -------------------------------------------------------------------
  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const s = stateRef.current;

      if (s.mode === 'dragging-node' || s.mode === 'pending-drag') {
        e.currentTarget.releasePointerCapture(e.pointerId);

        const finalPos = dragPositionRef.current;
        if (s.mode === 'dragging-node' && s.dragNodeId !== null && finalPos !== null) {
          onNodeMoveEnd(s.dragNodeId, finalPos.x, finalPos.y);
        }

        setInteractionMode('idle');
        dragPositionRef.current = null;
        setDragPosition(null);
        setDragDelta(null);
      }

      if (s.mode === 'box-selecting' || s.mode === 'pending-box-select') {
        e.currentTarget.releasePointerCapture(e.pointerId);

        if (s.mode === 'pending-box-select') {
          onClearSelection();
        } else if (s.mode === 'box-selecting') {
          const svg = svgRef.current;
          if (svg) {
            const rect = svg.getBoundingClientRect();
            const startLocal = clientToLocal(s.boxStartScreen.x, s.boxStartScreen.y, rect);
            const endLocal = clientToLocal(e.clientX, e.clientY, rect);
            const startWorld = screenToWorld(startLocal.x, startLocal.y, camera);
            const endWorld = screenToWorld(endLocal.x, endLocal.y, camera);

            const minX = Math.min(startWorld.x, endWorld.x);
            const maxX = Math.max(startWorld.x, endWorld.x);
            const minY = Math.min(startWorld.y, endWorld.y);
            const maxY = Math.max(startWorld.y, endWorld.y);

            const selectedIds = circuitNodes
              .filter((node) => {
                const position = node.position;
                if (!position) return false;
                return (
                  position.x >= minX &&
                  position.x <= maxX &&
                  position.y >= minY &&
                  position.y <= maxY
                );
              })
              .map((node) => node.id);

            onMarqueeCommit?.(selectedIds, e.shiftKey);
          }
        }

        onMarqueeChange?.(undefined);
        setInteractionMode('idle');
      }

      if (s.mode === 'panning') {
        const { x: startVx, y: startVy } = s.panVelocity;
        if (Math.hypot(startVx, startVy) > 0.1) {
          let vx = startVx;
          let vy = startVy;
          stopPanInertia();
          const step = () => {
            vx *= 0.86;
            vy *= 0.86;
            if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) {
              panInertiaRafRef.current = null;
              return;
            }
            onPan(vx, vy);
            panInertiaRafRef.current = requestAnimationFrame(step);
          };
          panInertiaRafRef.current = requestAnimationFrame(step);
        }
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setInteractionMode('idle');
      }

      // Always reset internal mode.
      s.mode = 'idle';
      s.dragNodeId = null;
      s.panVelocity = { x: 0, y: 0 };
    },
    [
      onNodeMoveEnd,
      setInteractionMode,
      onPan,
      stopPanInertia,
      onClearSelection,
      onMarqueeChange,
      onMarqueeCommit,
      svgRef,
      camera,
      circuitNodes,
    ],
  );

  useEffect(() => {
    return () => {
      stopPanInertia();
    };
  }, [stopPanInertia]);

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const s = stateRef.current;
      if (s.mode === 'panning') {
        stopPanInertia();
        s.mode = 'idle';
        s.panVelocity = { x: 0, y: 0 };
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setInteractionMode('idle');
      }
    },
    [stopPanInertia, setInteractionMode],
  );

  // -------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------
  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    dragState: {
      isDragging: stateRef.current.mode === 'dragging-node',
      dragNodeId: stateRef.current.dragNodeId,
      dragPosition,
      dragDelta,
    },
  };
}

