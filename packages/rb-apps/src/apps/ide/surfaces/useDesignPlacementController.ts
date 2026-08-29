import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import { findSmartSpawnPosition } from '@redbyte/rb-logic-view';

/**
 * useDesignPlacementController — the Design canvas placement interaction owner.
 *
 * Owns the click-to-arm / click-to-place state machine extracted from
 * DesignSurface: pending placement, the canvas ghost, commit (including the
 * Shift keep-placing repeat), and Escape/tool cancellation. Circuit mutation
 * still flows through the injected authorities (onRuntimeAddNode /
 * onRuntimeAddBoardIo / onRuntimeAddIo when the module is runtime-backed, the
 * circuit-store fallback otherwise) — this hook owns interaction state only,
 * never domain state.
 *
 * The parallel macro-insertion arm stays with its owner (DesignSurface): the
 * hook is told whether a macro arm is active, delegates macro canvas clicks
 * back out, and exposes clearPending/clearGhost so the macro path can
 * cross-cancel exactly as before.
 */

export interface PlacementBoardIoEntry {
  alias: string;
  kind: 'switch' | 'button' | 'clock' | 'reset' | 'led' | 'segment' | 'anode' | 'dp';
  direction: 'in' | 'out';
}

export interface PendingPlacementState {
  kind: 'node' | 'board-io';
  label: string;
  nodeType?: string;
  boardIoEntry?: PlacementBoardIoEntry;
}

export interface PlacementGhostState {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
}

const CANVAS_PLACEMENT_BLOCK_SELECTOR =
  '[data-blocks-canvas-placement="1"], [data-blocks-macro-placement="1"]';

export function isCanvasPlacementBlocked(target: HTMLElement | null): boolean {
  if (!target) return false;
  return Boolean(
    target.closest(CANVAS_PLACEMENT_BLOCK_SELECTOR) ||
      target.closest('[data-node-id]') ||
      target.closest('[data-port-id]') ||
      target.closest('[data-wire-id]') ||
      target.closest('[data-testid^="logic-wire-reconnect"]')
  );
}

export type PlacementCancelReason = 'cancel' | 'escape' | 'tool';

export interface DesignPlacementControllerParams {
  canvasHostRef: React.RefObject<HTMLDivElement | null>;
  camera: { x: number; y: number; zoom: number };
  canvasSize: { width: number; height: number };
  circuit: Circuit;
  interactionMode: string;
  setInteractionMode: (mode: 'idle' | 'placing') => void;
  /** True while the parallel macro-insertion arm is active. */
  isMacroArmActive: boolean;
  clearMacroArm: () => void;
  /** Macro canvas clicks are delegated back to the macro owner. */
  onMacroCanvasClick: (clientX: number, clientY: number) => void;
  isWireStartActive: boolean;
  endWire: () => void;
  toolMode: string;
  setSelectToolMode: () => void;
  clearWireFeedback: () => void;
  findExistingBoardNode: (entry: PlacementBoardIoEntry) => { nodeId: string } | undefined;
  selectNodes: (nodeIds: string[], additive: boolean) => void;
  notify: (message: string) => void;
  nodeTypeLabel: (nodeType: string) => string;
  predictNextNodeIds: (circuit: Circuit, count: number) => string[];
  onRuntimeAddNode?: (nodeType: string, position: { x: number; y: number }) => void;
  onRuntimeAddBoardIo?: (args: {
    alias: string;
    direction: 'in' | 'out';
    kind: PlacementBoardIoEntry['kind'];
    position: { x: number; y: number };
  }) => void;
  onRuntimeAddIo?: (direction: 'input' | 'output', position: { x: number; y: number }) => void;
  fallbackAddNode: (nodeType: string, position: { x: number; y: number }, options: { skipHistory: boolean }) => void;
  emitCircuitMutation: () => void;
  markReplayStale: () => void;
}

export interface DesignPlacementController {
  pendingPlacement: PendingPlacementState | null;
  placementGhost: PlacementGhostState | null;
  beginNodePlacement: (nodeType: string) => void;
  beginBoardIoPlacement: (entry: PlacementBoardIoEntry) => void;
  cancelPendingPlacement: (reason: PlacementCancelReason) => void;
  commitPendingPlacement: (clientX: number, clientY: number, options?: { keepPlacing?: boolean }) => void;
  updatePlacementGhost: (clientX: number, clientY: number) => void;
  handleCanvasPlacementClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleCanvasPlacementPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** Silent clears for the parallel macro arm's cross-cancel paths. */
  clearPending: () => void;
  clearGhost: () => void;
}

export function useDesignPlacementController(
  params: DesignPlacementControllerParams
): DesignPlacementController {
  const {
    canvasHostRef,
    camera,
    canvasSize,
    circuit,
    interactionMode,
    setInteractionMode,
    isMacroArmActive,
    clearMacroArm,
    onMacroCanvasClick,
    isWireStartActive,
    endWire,
    toolMode,
    setSelectToolMode,
    clearWireFeedback,
    findExistingBoardNode,
    selectNodes,
    notify,
    nodeTypeLabel,
    predictNextNodeIds,
    onRuntimeAddNode,
    onRuntimeAddBoardIo,
    onRuntimeAddIo,
    fallbackAddNode,
    emitCircuitMutation,
    markReplayStale,
  } = params;

  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacementState | null>(null);
  const [placementGhost, setPlacementGhost] = useState<PlacementGhostState | null>(null);

  const resolveCanvasPlacementPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasHostRef.current) return null;
      const rect = canvasHostRef.current.getBoundingClientRect();
      const worldPoint = {
        x: (clientX - rect.left - camera.x) / camera.zoom,
        y: (clientY - rect.top - camera.y) / camera.zoom,
      };
      return findSmartSpawnPosition(circuit.nodes as Node[], worldPoint);
    },
    [camera.x, camera.y, camera.zoom, canvasHostRef, circuit.nodes]
  );

  const beginPalettePlacement = useCallback(
    (placement: PendingPlacementState) => {
      if (isWireStartActive) {
        endWire();
      } else if (toolMode !== 'select') {
        setSelectToolMode();
      }
      if (isMacroArmActive) {
        clearMacroArm();
      }
      clearWireFeedback();
      setPendingPlacement(placement);
      setInteractionMode('placing');
    },
    [
      clearMacroArm,
      clearWireFeedback,
      endWire,
      isMacroArmActive,
      isWireStartActive,
      setInteractionMode,
      setSelectToolMode,
      toolMode,
    ]
  );

  const beginNodePlacement = useCallback(
    (nodeType: string) => {
      beginPalettePlacement({
        kind: 'node',
        label: nodeTypeLabel(nodeType),
        nodeType,
      });
    },
    [beginPalettePlacement, nodeTypeLabel]
  );

  const beginBoardIoPlacement = useCallback(
    (entry: PlacementBoardIoEntry) => {
      const existing = findExistingBoardNode(entry);
      if (existing) {
        if (existing.nodeId) {
          setSelectToolMode();
          selectNodes([existing.nodeId], false);
        }
        notify(`${entry.alias} already exists on canvas.`);
        return;
      }
      beginPalettePlacement({
        kind: 'board-io',
        label: entry.alias,
        boardIoEntry: entry,
      });
    },
    [beginPalettePlacement, findExistingBoardNode, notify, selectNodes, setSelectToolMode]
  );

  const cancelPendingPlacement = useCallback(
    (reason: PlacementCancelReason) => {
      if (!pendingPlacement) return;
      setPendingPlacement(null);
      setPlacementGhost(null);
      if (interactionMode === 'placing') {
        setInteractionMode('idle');
      }
      if (reason === 'escape') {
        notify(`Cancelled placing ${pendingPlacement.label} (Esc).`);
      } else if (reason === 'cancel') {
        notify(`Cancelled placing ${pendingPlacement.label}.`);
      }
    },
    [interactionMode, notify, pendingPlacement, setInteractionMode]
  );

  const commitPendingPlacement = useCallback(
    (clientX: number, clientY: number, options?: { keepPlacing?: boolean }) => {
      if (!pendingPlacement) return;
      const position = resolveCanvasPlacementPosition(clientX, clientY);
      if (!position) return;
      const keepPlacing = options?.keepPlacing === true;

      const nextNodeId = predictNextNodeIds(circuit, 1)[0] ?? null;
      if (pendingPlacement.kind === 'node' && pendingPlacement.nodeType) {
        if (onRuntimeAddNode) {
          markReplayStale();
          onRuntimeAddNode(pendingPlacement.nodeType, position);
        } else {
          fallbackAddNode(pendingPlacement.nodeType, position, { skipHistory: true });
          emitCircuitMutation();
        }
        notify(`${pendingPlacement.label} placed.`);
      } else if (pendingPlacement.kind === 'board-io' && pendingPlacement.boardIoEntry) {
        const entry = pendingPlacement.boardIoEntry;
        if (onRuntimeAddBoardIo) {
          onRuntimeAddBoardIo({
            alias: entry.alias,
            direction: entry.direction,
            kind: entry.kind,
            position,
          });
        } else if (onRuntimeAddIo) {
          onRuntimeAddIo(entry.direction === 'in' ? 'input' : 'output', position);
        } else {
          fallbackAddNode(entry.direction === 'in' ? 'INPUT' : 'OUTPUT', position, { skipHistory: true });
          emitCircuitMutation();
        }
        notify(`Added ${entry.alias} to canvas.`);
      }

      clearWireFeedback();
      if (!keepPlacing) {
        setPendingPlacement(null);
        setPlacementGhost(null);
      }
      if (!keepPlacing && interactionMode === 'placing') {
        setInteractionMode('idle');
      }
      if (nextNodeId) {
        queueMicrotask(() => {
          selectNodes([nextNodeId], false);
        });
      }
    },
    [
      circuit,
      clearWireFeedback,
      emitCircuitMutation,
      fallbackAddNode,
      interactionMode,
      markReplayStale,
      notify,
      onRuntimeAddBoardIo,
      onRuntimeAddIo,
      onRuntimeAddNode,
      pendingPlacement,
      predictNextNodeIds,
      resolveCanvasPlacementPosition,
      selectNodes,
      setInteractionMode,
    ]
  );

  const updatePlacementGhost = useCallback(
    (clientX: number, clientY: number) => {
      if (!pendingPlacement || isMacroArmActive || !canvasHostRef.current) return;
      const position = resolveCanvasPlacementPosition(clientX, clientY);
      if (!position) return;
      setPlacementGhost({
        screenX: position.x * camera.zoom + camera.x,
        screenY: position.y * camera.zoom + camera.y,
        worldX: position.x,
        worldY: position.y,
      });
    },
    [
      camera.x,
      camera.y,
      camera.zoom,
      canvasHostRef,
      isMacroArmActive,
      pendingPlacement,
      resolveCanvasPlacementPosition,
    ]
  );

  useEffect(() => {
    if (!pendingPlacement || isMacroArmActive || !canvasHostRef.current) {
      setPlacementGhost(null);
      return;
    }
    const rect = canvasHostRef.current.getBoundingClientRect();
    updatePlacementGhost(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [canvasHostRef, canvasSize.height, canvasSize.width, isMacroArmActive, pendingPlacement, updatePlacementGhost]);

  const handleCanvasPlacementClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (isCanvasPlacementBlocked(target)) return;
      if (isMacroArmActive) {
        event.preventDefault();
        event.stopPropagation();
        onMacroCanvasClick(event.clientX, event.clientY);
        return;
      }
      if (!pendingPlacement) return;
      event.preventDefault();
      event.stopPropagation();
      commitPendingPlacement(event.clientX, event.clientY, { keepPlacing: event.shiftKey });
    },
    [commitPendingPlacement, isMacroArmActive, onMacroCanvasClick, pendingPlacement]
  );

  const handleCanvasPlacementPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!pendingPlacement || isMacroArmActive) return;
      updatePlacementGhost(event.clientX, event.clientY);
    },
    [isMacroArmActive, pendingPlacement, updatePlacementGhost]
  );

  const clearPending = useCallback(() => {
    setPendingPlacement(null);
  }, []);

  const clearGhost = useCallback(() => {
    setPlacementGhost(null);
  }, []);

  return {
    pendingPlacement,
    placementGhost,
    beginNodePlacement,
    beginBoardIoPlacement,
    cancelPendingPlacement,
    commitPendingPlacement,
    updatePlacementGhost,
    handleCanvasPlacementClick,
    handleCanvasPlacementPointerMove,
    clearPending,
    clearGhost,
  };
}
