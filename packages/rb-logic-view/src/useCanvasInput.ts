// Copyright © 2025 Connor Angiel — RedByte OS Genesis

import { useRef, useState, useCallback } from 'react';
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
  onWireCancel?: () => void;
  isSpacePressed: boolean;
  isReplayMode: boolean;
  interactionMode: string; // 'idle' | 'placing' | 'dragging' | 'wiring' | 'panning'
  setInteractionMode: (mode: string) => void;
  snapEnabled: boolean;
  gridSize: number;
}

export interface CanvasInputHandlers {
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  dragState: {
    isDragging: boolean;
    dragNodeId: string | null;
    dragPosition: { x: number; y: number } | null;
  };
}

// Internal state machine modes (not exposed to the store).
type InternalMode = 'idle' | 'pending-drag' | 'dragging-node' | 'panning';

interface MutableState {
  mode: InternalMode;
  dragStartScreen: { x: number; y: number };
  nodeStartWorld: { x: number; y: number };
  panLastScreen: { x: number; y: number };
  dragNodeId: string | null;
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
    // selectedNodeIds — available for future multi-select extensions
    onNodeMoveEnd,
    onNodeSelect,
    onPan,
    onClearSelection,
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
    dragNodeId: null,
  });

  // Only dragPosition triggers re-renders (visual feedback).
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  // Ref to latest drag position for stable pointer-up callback.
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);

  // -------------------------------------------------------------------
  // Pointer Down
  // -------------------------------------------------------------------
  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Guard: replay mode or non-passthrough interaction modes
      if (isReplayMode) return;
      if (interactionMode !== 'idle' && interactionMode !== 'wiring') return;

      const s = stateRef.current;

      // ---- Middle-mouse or Space+Left → panning ----
      if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
        s.mode = 'panning';
        s.panLastScreen = { x: e.clientX, y: e.clientY };
        setInteractionMode('panning');
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

          onNodeSelect(nodeId, e.shiftKey);
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }

        // Background click
        if (interactionMode === 'wiring') {
          onWireCancel?.();
        } else {
          onClearSelection();
        }
      }
    },
    [
      isReplayMode,
      interactionMode,
      isSpacePressed,
      circuitNodes,
      onNodeSelect,
      onClearSelection,
      onWireCancel,
      setInteractionMode,
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
        s.panLastScreen = { x: e.clientX, y: e.clientY };
        return;
      }

      // ---- Pending drag → check threshold ----
      if (s.mode === 'pending-drag') {
        const dx = e.clientX - s.dragStartScreen.x;
        const dy = e.clientY - s.dragStartScreen.y;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
          s.mode = 'dragging-node';
          setInteractionMode('dragging');
        } else {
          return;
        }
        // Fall through to dragging-node to compute first position.
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

        dragPositionRef.current = { x: newX, y: newY };
        setDragPosition({ x: newX, y: newY });
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
      }

      if (s.mode === 'panning') {
        setInteractionMode('idle');
      }

      // Always reset internal mode.
      s.mode = 'idle';
      s.dragNodeId = null;
    },
    [onNodeMoveEnd, setInteractionMode],
  );

  // -------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------
  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    dragState: {
      isDragging: stateRef.current.mode === 'dragging-node',
      dragNodeId: stateRef.current.dragNodeId,
      dragPosition,
    },
  };
}
