// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { TickEngine, Node, Connection, Circuit } from '@redbyte/rb-logic-core';
import { useLogicViewStore, getGlobalViewStateStore, type LogicViewState } from './useLogicViewStore';
import { NodeView, type ChipMetadata, type NodeIoPresentation } from './components/NodeView';
import { WireView } from './components/WireView';
import { Minimap } from './components/Minimap';
import { Toolbar } from './components/Toolbar';
import { renderGrid } from './tools/grid';
import { isValidConnection, normalizeConnection, isInputPort } from './tools/wireValidation';
import { computeWireNetIds } from './tools/netHighlight';
import { findSmartSpawnPosition } from './tools/placement';
import { computeAlignmentGuides } from './tools/alignmentGuides';
import { trackRender, useUiTickStore } from '@redbyte/rb-utils';
import { CanvasHost, snapToGrid as snapPointToGrid, fitToBounds, clientToLocal } from '@redbyte/rb-viewport';
import { useCanvasInput } from './useCanvasInput';

export interface LogicCanvasProps {
  engine: TickEngine;
  circuit?: Circuit; // Optional: if provided, use this instead of polling engine
  width?: number;
  height?: number;
  showToolbar?: boolean;
  getChipMetadata?: (nodeType: string) => ChipMetadata | undefined;
  onNodeDoubleClick?: (nodeId: string) => void;
  onCircuitChange?: (circuit: Circuit) => void; // Callback to propagate circuit updates
  onSignalsUpdated?: (signals: Map<string, 0 | 1>, reason: 'input' | 'tick') => void; // Signal update notification
  showHints?: boolean;
  onDismissHints?: () => void;
  // Milestone D: Determinism recording (optional, dev-only)
  onInputToggled?: (nodeId: string, portName: string, newValue: 0 | 1) => void;
  // Probe toggling callback
  onProbeToggle?: (nodeId: string, portName: string, label: string) => void;
  probedPorts?: Set<string>; // Set of probed port keys (e.g., "nodeId.portName")
  probeWireHighlights?: Map<string, string[]>;
  mismatchWireHighlights?: Map<string, string[]> | null;
  mismatchNodeIds?: Set<string> | null;
  mismatchPortKeys?: Set<string> | null;
  debugSignals?: Map<string, 0 | 1> | null;
  debugTick?: number | null;
  highlightedPort?: { nodeId: string; portName: string } | null;
  highlightedPortKeys?: Set<string> | null;
  tracedNodeIds?: Set<string> | null;
  /** Optional callback (dev/advanced) to reflect net highlight across surfaces (e.g., 2D -> 3D). */
  onNetHighlightWiresChanged?: (wireIds: Set<string>) => void;
  isRunning?: boolean;
  isReplayMode?: boolean;
  tickRate?: number;
  tickCount?: number;
  nodeDiagnosticBadges?: Record<string, { error: number; warn: number; total: number }>;
  onNodeDiagnosticBadgeClick?: (nodeId: string) => void;
  ioPresentationMap?: Record<string, NodeIoPresentation>;
  presentationZoomMode?: 'dense' | 'classroom';
  onUndo?: () => void;
  onRedo?: () => void;
  /** Fired when the user clicks a port (after internal wiring logic). Use for path-tracing / fanin highlight. */
  onPortClick?: (nodeId: string, portName: string) => void;
  /** Fired when a wire attempt is rejected due to an invalid connection. The reason is the raw validation reason. */
  onConnectionRejected?: (reason: string) => void;
  /** Fired when Escape or right-click cancels explicit placement mode. */
  onPlacementCancel?: () => void;
  onWireContextMenu?: (input: {
    wireId: string;
    signalKey: string | null;
    clientX: number;
    clientY: number;
  }) => void;
  /** B1: Node IDs in topological evaluation order. When set, each node gets an evalSequence badge on hover. */
  nodeEvalOrder?: string[] | null;
  /** B1: Node IDs whose outputs changed on the last sim tick. Rendered with isHighlighted when set. */
  changedNodeIds?: Set<string> | null;
  /** Phase 3: per-node design issue severity for real-time canvas glow. */
  nodeIssueSeverities?: Map<string, 'error' | 'warn'>;
  /** Batch 1: explicit per-port issue severity for authoring feedback. */
  issuePortSeverities?: Map<string, 'error' | 'warn'> | null;
}

const BUILTIN_PORT_NAMES: Record<string, string[]> = {
  PowerSource: ['out'],
  Switch: ['out'],
  INPUT: ['out'],
  Lamp: ['in'],
  OUTPUT: ['in'],
  Wire: ['in', 'out'],
  AND: ['a', 'b', 'out'],
  OR: ['a', 'b', 'out'],
  XOR: ['a', 'b', 'out'],
  XNOR: ['a', 'b', 'out'],
  NAND: ['a', 'b', 'out'],
  NOR: ['a', 'b', 'out'],
  AND3: ['a', 'b', 'c', 'out'],
  OR3: ['a', 'b', 'c', 'out'],
  NAND3: ['a', 'b', 'c', 'out'],
  NOR3: ['a', 'b', 'c', 'out'],
  XOR3: ['a', 'b', 'c', 'out'],
  NOT: ['in', 'out'],
  Clock: ['out'],
  Delay: ['in', 'out'],
  DFlipFlop: ['D', 'CLK', 'Q', 'out'],
  JKFlipFlop: ['J', 'K', 'CLK', 'Q', 'out'],
  RSLatch: ['R', 'S', 'Q', 'Q_inv'],
  FullAdder: ['A', 'B', 'Cin', 'Sum', 'Cout'],
  Counter4Bit: ['CLK', 'Q0', 'Q1', 'Q2', 'Q3'],
};

const FIT_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function snapFitZoom(rawZoom: number): number {
  return FIT_ZOOM_STEPS.reduce((closest, candidate) =>
    Math.abs(candidate - rawZoom) < Math.abs(closest - rawZoom) ? candidate : closest
  );
}

function getBuiltinPortNames(nodeType: string): string[] | null {
  const ports = BUILTIN_PORT_NAMES[nodeType];
  return ports ? [...ports] : null;
}

function resolveConnectionEndpoints(connection: Connection): {
  fromNodeId: string;
  fromPortName: string;
  toNodeId: string;
  toPortName: string;
} {
  const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
  const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
  const fromPortName =
    typeof connection.from === 'string'
      ? connection.fromPort ?? connection.fromPin ?? 'out'
      : connection.from.portName ?? connection.from.port ?? 'out';
  const toPortName =
    typeof connection.to === 'string'
      ? connection.toPort ?? connection.toPin ?? 'in'
      : connection.to.portName ?? connection.to.port ?? 'in';
  return { fromNodeId, fromPortName, toNodeId, toPortName };
}

function toWireId(connection: Connection): string {
  const { fromNodeId, fromPortName, toNodeId, toPortName } = resolveConnectionEndpoints(connection);
  return `${fromNodeId}.${fromPortName}-${toNodeId}.${toPortName}`;
}

export const LogicCanvas: React.FC<LogicCanvasProps> = ({
  engine,
  circuit: externalCircuit,
  width = 800,
  height = 600,
  showToolbar = true,
  getChipMetadata,
  onNodeDoubleClick,
  onCircuitChange,
  onSignalsUpdated,
  showHints = true,
  onDismissHints,
  onInputToggled,
  onProbeToggle,
  probedPorts,
  probeWireHighlights,
  mismatchWireHighlights,
  mismatchNodeIds,
  mismatchPortKeys,
  debugSignals,
  debugTick,
  highlightedPort,
  highlightedPortKeys,
  tracedNodeIds,
  onNetHighlightWiresChanged,
  isRunning = false,
  isReplayMode = false,
  tickRate = 0,
  tickCount = 0,
  nodeDiagnosticBadges,
  onNodeDiagnosticBadgeClick,
  ioPresentationMap,
  presentationZoomMode = 'dense',
  onUndo,
  onRedo,
  onPortClick,
  onConnectionRejected,
  onPlacementCancel,
  onWireContextMenu,
  nodeEvalOrder,
  changedNodeIds,
  nodeIssueSeverities,
  issuePortSeverities,
}) => {
  trackRender('LogicCanvas');
  const uiTick = useUiTickStore((state) => state.uiTick);

  const camera = useLogicViewStore(useShallow((state) => state.camera));
  const rawSelection = useLogicViewStore(useShallow((state) => state.selection));
  // Guard: Ensure selection Sets exist and are valid Sets (prevent crash if store state is malformed/hydrated as keys)
  const selection = React.useMemo(() => ({
    nodes: rawSelection?.nodes instanceof Set ? rawSelection.nodes : new Set(),
    wires: rawSelection?.wires instanceof Set ? rawSelection.wires : new Set(),
  }), [rawSelection]);

  const editingState = useLogicViewStore(useShallow((state) => state.editingState));
  const snapToGridEnabled = useLogicViewStore((state) => state.snapToGrid);
  const toolMode = useLogicViewStore((state) => state.toolMode);
  const gridSize = useLogicViewStore((state) => state.gridSize);
  const interactionMode = useLogicViewStore((state) => state.interactionMode);

  // Get action functions separately (these are stable)
  const setCamera = useLogicViewStore((state) => state.setCamera);
  const pan = useLogicViewStore((state) => state.pan);
  const zoom = useLogicViewStore((state) => state.zoom);
  const selectNode = useLogicViewStore((state) => state.selectNode);
  const selectWire = useLogicViewStore((state) => state.selectWire);
  const clearSelection = useLogicViewStore((state) => state.clearSelection);
  const toggleSnapToGrid = useLogicViewStore((state) => state.toggleSnapToGrid);
  const startWire = useLogicViewStore((state) => state.startWire);
  const endWire = useLogicViewStore((state) => state.endWire);
  const selectMultipleNodes = useLogicViewStore((state) => state.selectMultipleNodes);
  const setToolMode = useLogicViewStore((state) => state.setToolMode);
  const setInteractionMode = useLogicViewStore((state) => state.setInteractionMode);
  const setEditingState = useLogicViewStore((state) => state.setEditingState);

  const zoomFn = zoom;
  const shouldSnap = snapToGridEnabled;

  // Use external circuit if provided, otherwise poll from engine
  const [internalCircuit, setInternalCircuit] = React.useState(engine.getCircuit());
  const circuit = externalCircuit ?? internalCircuit;
  const [hoveredWireId, setHoveredWireId] = React.useState<string | null>(null);
  const wireToNetId = React.useMemo(() => computeWireNetIds(circuit.connections), [circuit.connections]);
  const hoveredNetId = hoveredWireId ? wireToNetId.get(hoveredWireId) ?? null : null;
  const selectedNetIds = React.useMemo(() => {
    const ids = new Set<string>();
    selection.wires.forEach((wireId) => {
      const netId = wireToNetId.get(wireId);
      if (netId) ids.add(netId);
    });
    return ids;
  }, [selection.wires, wireToNetId]);

  const highlightNetIds = React.useMemo(() => {
    const ids = new Set<string>(selectedNetIds);
    if (hoveredNetId) ids.add(hoveredNetId);
    return ids;
  }, [hoveredNetId, selectedNetIds]);

  const highlightWireIds = React.useMemo(() => {
    if (!onNetHighlightWiresChanged) return null;
    if (highlightNetIds.size === 0) return new Set<string>();
    const result = new Set<string>();
    wireToNetId.forEach((netId, wireId) => {
      if (highlightNetIds.has(netId)) result.add(wireId);
    });
    return result;
  }, [highlightNetIds, onNetHighlightWiresChanged, wireToNetId]);

  const lastReportedHighlightRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (!onNetHighlightWiresChanged || !highlightWireIds) return;
    const prev = lastReportedHighlightRef.current;
    if (prev.size === highlightWireIds.size) {
      let same = true;
      for (const id of highlightWireIds) {
        if (!prev.has(id)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    lastReportedHighlightRef.current = highlightWireIds;
    onNetHighlightWiresChanged(new Set(highlightWireIds));
  }, [highlightWireIds, onNetHighlightWiresChanged]);
  const [signals, setSignals] = React.useState<Map<string, 0 | 1>>(new Map());
  const [signalsVersion, setSignalsVersion] = React.useState(0);
  const renderSignals = debugSignals ?? signals;
  const svgRef = React.useRef<SVGSVGElement>(null);
  const lastSyncedSelection = React.useRef<Set<string>>(new Set());
  const lastFocusRequestId = React.useRef<number>(-1);
  const mouseRafPending = React.useRef<boolean>(false);

  // Stable refs for functions used in subscriptions (prevents infinite loops)
  const selectMultipleNodesRef = React.useRef(selectMultipleNodes);
  selectMultipleNodesRef.current = selectMultipleNodes;
  const focusNodeRef = React.useRef<((nodeId: string) => void) | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = React.useState<string | null>(null);
  const [showHud, setShowHud] = React.useState(true);
  const hudTimerRef = React.useRef<number | null>(null);
  const wheelMomentumRef = React.useRef(0);
  const wheelRafRef = React.useRef<number | null>(null);
  const wheelAnchorRef = React.useRef({ x: 0, y: 0 });
  const wheelStepRef = React.useRef<(() => void) | null>(null);
  const handleMinimapPan = React.useCallback(
    (worldX: number, worldY: number) => {
      const cam = useLogicViewStore.getState().camera;
      setCamera({
        x: width / 2 - worldX * cam.zoom,
        y: height / 2 - worldY * cam.zoom,
      });
    },
    [width, height, setCamera]
  );
  const bumpHud = React.useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) {
      window.clearTimeout(hudTimerRef.current);
    }
    hudTimerRef.current = window.setTimeout(() => {
      setShowHud(false);
    }, 2400);
  }, []);

  const stopWheelMomentum = React.useCallback(() => {
    if (wheelRafRef.current !== null) {
      window.cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }
    wheelMomentumRef.current = 0;
  }, []);

  React.useEffect(() => {
    wheelStepRef.current = () => {
      const momentum = wheelMomentumRef.current;
      if (Math.abs(momentum) < 0.05) {
        stopWheelMomentum();
        return;
      }
      zoomFn(momentum, wheelAnchorRef.current.x, wheelAnchorRef.current.y);
      wheelMomentumRef.current *= 0.78;
      wheelRafRef.current = window.requestAnimationFrame(() => {
        wheelStepRef.current?.();
      });
    };
  }, [stopWheelMomentum, zoomFn]);

  const viewBounds = React.useMemo(() => {
    const margin = 200;
    const left = (-camera.x) / camera.zoom - margin;
    const top = (-camera.y) / camera.zoom - margin;
    const right = (width - camera.x) / camera.zoom + margin;
    const bottom = (height - camera.y) / camera.zoom + margin;
    return { left, top, right, bottom };
  }, [camera.x, camera.y, camera.zoom, width, height]);

  // Viewport culling is render-only; selection and interaction use the full circuit model.
  const visibleNodes = React.useMemo(
    () =>
      circuit.nodes.filter((node) => {
        if (!node.position) return false; // Skip nodes without position
        const x = node.position.x;
        const y = node.position.y;
        return x >= viewBounds.left && x <= viewBounds.right && y >= viewBounds.top && y <= viewBounds.bottom;
      }),
    [circuit.nodes, viewBounds]
  );

  const visibleNodeIds = React.useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleConnections = React.useMemo(
    () =>
      circuit.connections.filter((connection) => {
        const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return visibleNodeIds.has(fromNodeId) || visibleNodeIds.has(toNodeId);
      }),
    [circuit.connections, visibleNodeIds]
  );

  // Invariant: controlled mode requires onCircuitChange callback
  if (import.meta.env.DEV) {
    if (externalCircuit && !onCircuitChange) {
      throw new Error(
        'LogicCanvas: When circuit prop is provided (controlled mode), onCircuitChange callback is REQUIRED. ' +
        'This ensures circuit mutations propagate to the parent/store. ' +
        'Either provide onCircuitChange or remove the circuit prop to use internal state.'
      );
    }
  }

  /**
   * Centralized circuit mutation handler - ALL mutations MUST go through this
   * Ensures proper propagation to engine + parent/store
   */
  const commitCircuit = React.useCallback((nextCircuit: Circuit) => {
    // Update engine
    engine.setCircuit(nextCircuit);

    // Propagate to parent/store (controlled mode) or update internal state
    if (externalCircuit) {
      // Controlled mode: MUST have callback (enforced by dev invariant above)
      onCircuitChange!(nextCircuit);
    } else {
      // Uncontrolled mode: update internal state
      setInternalCircuit(nextCircuit);
    }
  }, [engine, externalCircuit, onCircuitChange]);

  // Sample engine state on UI ticks (keeps UI responsive without per-tick churn)
  React.useEffect(() => {
    if (!engine) return;

    if (!externalCircuit) {
      const nextCircuit = engine.getCircuit();
      setInternalCircuit(nextCircuit);
    }

    const newSignals = engine.getEngine().getAllSignals() as Map<string, 0 | 1>;
    setSignals(newSignals);
    setSignalsVersion(v => v + 1); // Bump version on tick updates too

    if (onSignalsUpdated) {
      onSignalsUpdated(newSignals, 'tick');
    }
  }, [engine, externalCircuit, uiTick, onSignalsUpdated]);

  const focusNode = React.useCallback(
    (nodeId: string) => {
      const target = circuit.nodes.find((node) => node.id === nodeId);
      if (!target) return;
      const nextZoom = Math.min(2, Math.max(camera.zoom, 1.1));
      setCamera({
        x: width / 2 - target.position.x * nextZoom,
        y: height / 2 - target.position.y * nextZoom,
        zoom: nextZoom,
      });
    },
    [camera.zoom, circuit.nodes, setCamera, width, height]
  );

  // Keep focusNode ref updated
  focusNodeRef.current = focusNode;

  // Subscribe to global selection changes from other views
  // Uses refs for callbacks to prevent re-subscription on every render
  React.useEffect(() => {
    const globalStore = getGlobalViewStateStore();
    if (!globalStore) return;

    const unsubscribe = globalStore.subscribe(
      (state: any) => {
        // Sync global selection to local selection
        const globalNodeIds = (state.selectedNodeIds || new Set()) as Set<string>;

        // Check if this is different from what we last synced
        const lastSynced = lastSyncedSelection.current;
        const isDifferent =
          globalNodeIds.size !== lastSynced.size ||
          Array.from(globalNodeIds).some((id: string) => !lastSynced.has(id));

        if (isDifferent) {
          lastSyncedSelection.current = new Set(globalNodeIds);
          // Pass syncToGlobal: false to prevent circular updates
          selectMultipleNodesRef.current(Array.from(globalNodeIds), false);
        }

        const nextHighlight = state.highlightedNodeId ?? null;
        setHighlightedNodeId(nextHighlight);

        if (
          typeof state.focusRequestId === 'number' &&
          state.focusRequestId !== lastFocusRequestId.current
        ) {
          lastFocusRequestId.current = state.focusRequestId;
          if (state.focusNodeId && focusNodeRef.current) {
            focusNodeRef.current(state.focusNodeId);
          }
        }
      }
    );

    return unsubscribe;
  }, []); // Empty deps - subscription is stable, uses refs for callbacks


  // Input state
  const [isSpacePressed, setIsSpacePressed] = React.useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [hoveredPort, setHoveredPort] = React.useState<{ nodeId: string; portName: string } | null>(null);
  const [showFirstWireToast, setShowFirstWireToast] = React.useState(false);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
  const [wireRewireDraft, setWireRewireDraft] = React.useState<{
    wireId: string;
    anchor: { nodeId: string; portName: string };
  } | null>(null);

  // Stable ref for handleNodeMove (defined below) so canvasInput doesn't re-create on every render
  const handleNodeMoveRef = React.useRef<(nodeId: string, x: number, y: number) => void>(() => {});

  // Unified canvas input controller (RC-P4)
  const canvasInput = useCanvasInput({
    svgRef,
    camera,
    circuitNodes: circuit.nodes,
    selectedNodeIds: selection.nodes,
    onNodeMoveEnd: React.useCallback((nodeId: string, x: number, y: number) => {
      handleNodeMoveRef.current(nodeId, x, y);
    }, []),
    onNodeSelect: selectNode,
    onPan: pan,
    onClearSelection: clearSelection,
    onMarqueeChange: (marquee) => setEditingState({ marquee }),
    onMarqueeCommit: (nodeIds, addToSelection) => {
      if (addToSelection) {
        const existing = Array.from(selection.nodes);
        const merged = Array.from(new Set([...existing, ...nodeIds]));
        selectMultipleNodes(merged);
      } else {
        selectMultipleNodes(nodeIds);
      }
      setEditingState({ marquee: undefined });
    },
    onWireCancel: endWire,
    onPlacementCancel,
    isSpacePressed,
    isReplayMode,
    interactionMode,
    setInteractionMode,
    snapEnabled: shouldSnap && !isCtrlPressed,
    gridSize,
  });

  // Track mouse position for wire preview (separate from drag handling)
  const handlePointerMoveForWirePreview = React.useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Delegate to unified input controller first
    canvasInput.onPointerMove(e);

    // Track mouse position for wire preview (throttled to RAF)
    if (svgRef.current && !mouseRafPending.current) {
      mouseRafPending.current = true;
      const clientX = e.clientX;
      const clientY = e.clientY;
      requestAnimationFrame(() => {
        mouseRafPending.current = false;
        if (svgRef.current) {
          const rect = svgRef.current.getBoundingClientRect();
          const local = clientToLocal(clientX, clientY, rect);
          setMousePosition(local);
        }
      });
    }
  }, [canvasInput.onPointerMove]);


  // Drag responsiveness optimization: batch node move updates with requestAnimationFrame
  const dragMoveRaf = React.useRef<number | null>(null);
  const lastDragArgs = React.useRef<{ nodeId: string; x: number; y: number } | null>(null);

  const handleNodeMove = React.useCallback((nodeId: string, x: number, y: number) => {
    if (isReplayMode) return;
    lastDragArgs.current = { nodeId, x, y };
    if (dragMoveRaf.current !== null) return;
    dragMoveRaf.current = window.requestAnimationFrame(() => {
      dragMoveRaf.current = null;
      const args = lastDragArgs.current;
      if (!args) return;
      const { nodeId, x, y } = args;
      // Ctrl temporarily disables snap
      const snapEnabled = shouldSnap && !isCtrlPressed;
      const newX = snapEnabled ? snapPointToGrid(x, gridSize) : x;
      const newY = snapEnabled ? snapPointToGrid(y, gridSize) : y;
      // Calculate delta for the dragged node
      const draggedNode = circuit.nodes.find(n => n.id === nodeId);
      if (!draggedNode) return;
      const dx = newX - draggedNode.position.x;
      const dy = newY - draggedNode.position.y;
      // If this node is selected and there are multiple selected nodes, move all of them
      const isNodeSelected = selection.nodes.has(nodeId);
      const hasMultipleSelected = selection.nodes.size > 1;
      const updatedCircuit = {
        ...circuit,
        nodes: circuit.nodes.map((n) => {
          // Move the dragged node
          if (n.id === nodeId) {
            return { ...n, position: { x: newX, y: newY } };
          }
          // If dragging a selected node and others are also selected, move them too
          if (isNodeSelected && hasMultipleSelected && selection.nodes.has(n.id)) {
            return {
              ...n,
              position: {
                // Keep multi-node movement as a single deterministic delta derived from the anchor.
                x: n.position.x + dx,
                y: n.position.y + dy,
              },
            };
          }
          return n;
        }),
      };
      commitCircuit(updatedCircuit);
    });
  }, [circuit, shouldSnap, isCtrlPressed, gridSize, selection.nodes, commitCircuit, isReplayMode]);
  handleNodeMoveRef.current = handleNodeMove;

  // Clean up RAF on unmount
  React.useEffect(() => {
    return () => {
      if (dragMoveRaf.current !== null) {
        window.cancelAnimationFrame(dragMoveRaf.current);
        dragMoveRaf.current = null;
      }
    };
  }, []);

  const handleToggleSwitch = React.useCallback((nodeId: string) => {
    if (isReplayMode) return;
    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) => {
        if (n.id === nodeId && (n.type === 'Switch' || n.type === 'INPUT')) {
          const currentState = n.state?.isOn ?? 0;
          const newValue = currentState ? 0 : 1;

          // Milestone D: Record input toggled event
          if (onInputToggled) {
            onInputToggled(nodeId, 'out', newValue);
          }

          return { ...n, state: { ...n.state, isOn: newValue } };
        }
        return n;
      }),
    };

    commitCircuit(updatedCircuit);

    // CRITICAL: Immediately recompute signals after input change
    // This makes toggles interactive without waiting for next UI tick
    const newSignals = engine.getEngine().getAllSignals() as Map<string, 0 | 1>;
    setSignals(newSignals);

    // Bump version to trigger scope/3D updates even when stopped
    setSignalsVersion(v => v + 1);

    // Notify parent (scope/3D can subscribe to this)
    if (onSignalsUpdated) {
      onSignalsUpdated(newSignals, 'input');
    }
  }, [circuit, onInputToggled, commitCircuit, isReplayMode, engine, onSignalsUpdated]);

  const getNodePortNames = React.useCallback(
    (node: Node): string[] => {
      const metadata = getChipMetadata?.(node.type);
      if (metadata) {
        return [
          ...metadata.inputs.map((input) => input.id),
          ...metadata.outputs.map((output) => output.id),
        ];
      }

      const builtinPorts = getBuiltinPortNames(node.type);
      if (builtinPorts) {
        return builtinPorts;
      }

      const ports: string[] = [];
      if (!['PowerSource', 'Clock'].includes(node.type)) ports.push('in');
      if (!['Lamp'].includes(node.type)) ports.push('out');
      return ports;
    },
    [getChipMetadata]
  );

  const validWireTargetKeys = React.useMemo(() => {
    const startPort = editingState.wireStartPort;
    if (!startPort) return null;

    const targets = new Set<string>();
    for (const node of circuit.nodes) {
      const ports = getNodePortNames(node);
      for (const portName of ports) {
        if (node.id === startPort.nodeId && portName === startPort.portName) continue;
        const candidate = { nodeId: node.id, portName };
        const validation = isValidConnection(startPort, candidate, circuit, getChipMetadata);
        if (validation.valid) {
          targets.add(`${node.id}:${portName}`);
        }
      }
    }

    return targets;
  }, [editingState.wireStartPort, circuit, getNodePortNames, getChipMetadata]);

  const hoveredWireTargetState = React.useMemo(() => {
    if (!editingState.wireStartPort || !hoveredPort) return null;
    if (!validWireTargetKeys) return null;
    return validWireTargetKeys.has(`${hoveredPort.nodeId}:${hoveredPort.portName}`)
      ? 'valid'
      : 'invalid';
  }, [editingState.wireStartPort, hoveredPort, validWireTargetKeys]);

  const handlePortClick = React.useCallback((nodeId: string, portName: string) => {
    if (isReplayMode) return;
    // Don't allow port interactions while panning or dragging
    if (interactionMode === 'panning' || interactionMode === 'draggingNode') return;

    if (interactionMode === 'wiring' && editingState.wireStartPort) {
      // End wire - validate connection first
      const from = editingState.wireStartPort;
      const to = { nodeId, portName };

      const validation = isValidConnection(from, to, circuit, getChipMetadata);

      if (!validation.valid) {
        onConnectionRejected?.(validation.reason ?? 'Connection not allowed');
        endWire();
        return;
      }

      // Normalize connection (output -> input)
      const normalizedConnection = normalizeConnection(from, to, circuit, getChipMetadata);

      const nextConnections = wireRewireDraft
        ? circuit.connections
            .filter((connection) => toWireId(connection) !== wireRewireDraft.wireId)
            .concat(normalizedConnection)
        : [...circuit.connections, normalizedConnection];

      const updatedCircuit = {
        ...circuit,
        connections: nextConnections,
      };

      commitCircuit(updatedCircuit);
      setWireRewireDraft(null);
      endWire(); // This sets interactionMode back to 'idle'

      // Show first-wire toast if this is the user's first wire
      const hasSeenFirstWireToast = localStorage.getItem('rb-logic-view:hasSeenFirstWireToast');
      if (!hasSeenFirstWireToast && circuit.connections.length === 0) {
        setShowFirstWireToast(true);
        localStorage.setItem('rb-logic-view:hasSeenFirstWireToast', 'true');
        // Auto-hide after 4 seconds
        setTimeout(() => setShowFirstWireToast(false), 4000);
      }
    } else if (interactionMode === 'idle') {
      // Start wire - only from idle state
      setWireRewireDraft(null);
      startWire({ nodeId, portName }); // This sets interactionMode to 'wiring'
    }

    // Notify parent after internal handling (used for fanin path tracing)
    onPortClick?.(nodeId, portName);
  }, [circuit, editingState.wireStartPort, commitCircuit, endWire, startWire, getChipMetadata, isReplayMode, interactionMode, wireRewireDraft, onPortClick, onConnectionRejected]);

  const beginWireReconnect = React.useCallback(
    (wireId: string, endpoint: 'from' | 'to') => {
      if (isReplayMode) return;
      const connection = circuit.connections.find((entry) => toWireId(entry) === wireId);
      if (!connection) return;

      const {
        fromNodeId,
        fromPortName,
        toNodeId,
        toPortName,
      } = resolveConnectionEndpoints(connection);
      const anchor =
        endpoint === 'from'
          ? { nodeId: toNodeId, portName: toPortName }
          : { nodeId: fromNodeId, portName: fromPortName };

      setWireRewireDraft({ wireId, anchor });
      startWire(anchor);
    },
    [circuit.connections, isReplayMode, startWire]
  );

  React.useEffect(() => {
    if (interactionMode === 'wiring') return;
    if (!wireRewireDraft) return;
    setWireRewireDraft(null);
  }, [interactionMode, wireRewireDraft]);

  const handleAddNode = React.useCallback((type: string) => {
    if (isReplayMode) return;

    // Calculate center of view in world coordinates
    const centerX = (-camera.x + width / 2) / camera.zoom;
    const centerY = (-camera.y + height / 2) / camera.zoom;

    // Use smart placement to find a free spot near center
    const position = findSmartSpawnPosition(circuit.nodes, { x: centerX, y: centerY });

    const newNode: Node = {
      id: `node_${Date.now()}`,
      type,
      position,
      rotation: 0,
      config: {},
    };

    const updatedCircuit = {
      ...circuit,
      nodes: [...circuit.nodes, newNode],
    };

    commitCircuit(updatedCircuit);
  }, [circuit, camera, width, height, commitCircuit, isReplayMode]);

  const handleDelete = React.useCallback(() => {
    if (isReplayMode) return;
    // Don't delete if focus is in input/textarea
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable)
    ) {
      return;
    }

    let updatedCircuit = circuit;

    // Delete selected nodes (and their connections)
    if (selection.nodes.size > 0) {
      updatedCircuit = {
        nodes: circuit.nodes.filter((n) => !selection.nodes.has(n.id)),
        connections: circuit.connections.filter(
          (connection) => {
            const { fromNodeId, toNodeId } = resolveConnectionEndpoints(connection);
            return !selection.nodes.has(fromNodeId) && !selection.nodes.has(toNodeId);
          }
        ),
      };
    }

    // Delete selected wires
    if (selection.wires.size > 0) {
      updatedCircuit = {
        ...updatedCircuit,
        connections: updatedCircuit.connections.filter((connection) => {
          return !selection.wires.has(toWireId(connection));
        }),
      };
    }

    // Only commit if something changed
    if (selection.nodes.size > 0 || selection.wires.size > 0) {
      commitCircuit(updatedCircuit);
      clearSelection();
    }
  }, [circuit, selection.nodes, selection.wires, commitCircuit, clearSelection, isReplayMode]);

  // Fit circuit to view
  const fitToView = React.useCallback(() => {
    if (circuit.nodes.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    circuit.nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y);
    });

    if (!isFinite(minX)) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }

    const newCamera = fitToBounds({ minX, maxX, minY, maxY }, width, height, 100, 2);
    setCamera({ ...newCamera, zoom: snapFitZoom(newCamera.zoom) });
  }, [circuit.nodes, width, height, setCamera]);

  // Reset view to default
  const resetView = React.useCallback(() => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  }, [setCamera]);

  // Refs for keyboard handler callbacks (stable references to avoid re-registering listeners)
  const handleDeleteRef = React.useRef(handleDelete);
  handleDeleteRef.current = handleDelete;
  const clearSelectionRef = React.useRef(clearSelection);
  clearSelectionRef.current = clearSelection;
  const endWireRef = React.useRef(endWire);
  endWireRef.current = endWire;
  const setToolModeRef = React.useRef(setToolMode);
  setToolModeRef.current = setToolMode;
  const setInteractionModeRef = React.useRef(setInteractionMode);
  setInteractionModeRef.current = setInteractionMode;
  const setEditingStateRef = React.useRef(setEditingState);
  setEditingStateRef.current = setEditingState;
  const toggleSnapToGridRef = React.useRef(toggleSnapToGrid);
  toggleSnapToGridRef.current = toggleSnapToGrid;
  const fitToViewRef = React.useRef(fitToView);
  fitToViewRef.current = fitToView;
  const resetViewRef = React.useRef(resetView);
  resetViewRef.current = resetView;
  const setCameraRef = React.useRef(setCamera);
  setCameraRef.current = setCamera;
  const cameraRef = React.useRef(camera);
  cameraRef.current = camera;
  const toolModeRef = React.useRef(toolMode);
  toolModeRef.current = toolMode;
  const editingStateRef = React.useRef(editingState);
  editingStateRef.current = editingState;


  React.useEffect(() => {
    bumpHud();
  }, [bumpHud, selection.nodes.size, selection.wires.size, toolMode, shouldSnap, isRunning, isReplayMode, tickRate]);

  React.useEffect(() => {
    const handleActivity = () => {
      bumpHud();
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [bumpHud]);

  React.useEffect(() => {
    return () => {
      if (hudTimerRef.current) {
        window.clearTimeout(hudTimerRef.current);
      }
      stopWheelMomentum();
    };
  }, [stopWheelMomentum]);

  // CanvasHost wheel handler
  const handleWheelActive = React.useCallback((e: WheelEvent) => {
    if (interactionMode === 'draggingNode' || interactionMode === 'boxSelecting') {
      return;
    }
    const delta = e.ctrlKey ? -e.deltaY * 0.45 : -e.deltaY * 0.9;
    wheelAnchorRef.current = { x: e.clientX, y: e.clientY };
    wheelMomentumRef.current = Math.max(-160, Math.min(160, wheelMomentumRef.current + delta * 0.18));
    if (wheelRafRef.current === null) {
      wheelRafRef.current = window.requestAnimationFrame(() => {
        wheelStepRef.current?.();
      });
    }
  }, [interactionMode]);

  // CanvasHost keyboard handlers
  const handleKeyDownActive = React.useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      // Space: Enable pan mode
      e.preventDefault(); // Prevent page scroll
      setIsSpacePressed(true);
    } else if (e.key === 'Control') {
      // Ctrl: Temporarily disable snap while held
      setIsCtrlPressed(true);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDeleteRef.current();
    } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      onUndo?.();
    } else if (
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
    ) {
      e.preventDefault();
      onRedo?.();
    } else if (e.key === 'Escape') {
      if (interactionMode === 'placing') {
        e.preventDefault();
        e.stopPropagation();
        onPlacementCancel?.();
        return;
      }
      clearSelectionRef.current();
      setEditingStateRef.current({ marquee: undefined });
      if (interactionMode === 'boxSelecting') {
        setInteractionModeRef.current('idle');
      }
      if (editingStateRef.current.wireStartPort) {
        setWireRewireDraft(null);
        endWireRef.current();
      }
    } else if (e.key === 'w' || e.key === 'W') {
      // W: Toggle wire mode
      if (editingStateRef.current.wireStartPort) {
        // Cancel active wire
        endWireRef.current();
      } else {
        // Toggle wire mode on/off
        setToolModeRef.current(toolModeRef.current === 'wire' ? 'select' : 'wire');
      }
    } else if (e.key === 'g' || e.key === 'G') {
      // G: Toggle snap to grid
      toggleSnapToGridRef.current();
    } else if (e.key === 'f' || e.key === 'F') {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+F: Fit to view
        e.preventDefault();
        fitToViewRef.current();
      } else {
        // F: Fit to view
        fitToViewRef.current();
      }
    } else if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
      // Ctrl/Cmd+R: Reset view
      e.preventDefault();
      resetViewRef.current();
    } else if (e.key === '0') {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+0: Reset zoom to 100%
        e.preventDefault();
        setCameraRef.current({ ...cameraRef.current, zoom: 1 });
      } else {
        // 0: Reset view
        resetViewRef.current();
      }
    }
  }, [interactionMode, onPlacementCancel, onRedo, onUndo, zoomFn]);

  const handleKeyUpActive = React.useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      // Space released: Disable pan mode
      setIsSpacePressed(false);
    } else if (e.key === 'Control') {
      // Ctrl released: Re-enable snap
      setIsCtrlPressed(false);
    }
  }, []);

  const selectedNodes = React.useMemo(
    () => circuit.nodes.filter((node) => selection.nodes.has(node.id) && node.position),
    [circuit.nodes, selection.nodes]
  );

  const selectionBoundsWorld = React.useMemo(
    () => computeSelectionBounds(selectedNodes),
    [selectedNodes]
  );

  const selectionBoundsScreen = React.useMemo(
    () => worldBoundsToScreen(selectionBoundsWorld, camera),
    [selectionBoundsWorld, camera]
  );

  const selectionCountLabel = `${selection.nodes.size} selected`;
  const activeDragDelta = canvasInput.dragState.dragDelta ?? { x: 0, y: 0 };
  const showSelectionBounds = Boolean(selectionBoundsScreen) && selection.nodes.size > 0;
  const showSelectionGhost =
    showSelectionBounds && interactionMode === 'draggingNode' && selection.nodes.size > 1;
  const selectionBadgeLayout = React.useMemo(() => {
    if (!selectionBoundsScreen) return null;
    const badgeHeight = 18;
    const countWidth = 96;
    const deltaWidth = 104;
    const margin = 6;
    const top = clampValue(selectionBoundsScreen.y - 24, margin, height - badgeHeight - margin);
    const countLeft = clampValue(selectionBoundsScreen.x + 6, margin, width - countWidth - margin);
    const deltaLeft = clampValue(
      selectionBoundsScreen.x + selectionBoundsScreen.width - (deltaWidth + margin),
      margin,
      width - deltaWidth - margin
    );

    return {
      top,
      countLeft,
      deltaLeft,
    };
  }, [selectionBoundsScreen, height, width]);
  const showSnapGuides =
    shouldSnap &&
    interactionMode === 'draggingNode' &&
    Boolean(canvasInput.dragState.dragPosition);

  const snapGuideScreen = React.useMemo(() => {
    if (!showSnapGuides || !canvasInput.dragState.dragPosition) return null;
    return {
      x: canvasInput.dragState.dragPosition.x * camera.zoom + camera.x,
      y: canvasInput.dragState.dragPosition.y * camera.zoom + camera.y,
    };
  }, [camera.x, camera.y, camera.zoom, canvasInput.dragState.dragPosition, showSnapGuides]);

  const alignmentGuides = React.useMemo(() => {
    const dragNodeId = canvasInput.dragState.dragNodeId;
    const dragPos = canvasInput.dragState.dragPosition;
    if (!dragNodeId || !dragPos || interactionMode !== 'draggingNode') {
      return { verticals: [], horizontals: [] };
    }
    return computeAlignmentGuides(dragNodeId, dragPos, circuit.nodes);
  }, [interactionMode, canvasInput.dragState.dragNodeId, canvasInput.dragState.dragPosition, circuit.nodes]);

  const selectedWireOverlay = React.useMemo(() => {
    const selectedWireIds = Array.from(selection.wires);
    if (selectedWireIds.length !== 1) return null;
    const wireId = selectedWireIds[0];
    if (!wireId) return null;

    const connection = circuit.connections.find((entry) => toWireId(entry) === wireId);
    if (!connection) return null;

    const { fromNodeId, fromPortName, toNodeId, toPortName } = resolveConnectionEndpoints(connection);
    const fromNode = circuit.nodes.find((node) => node.id === fromNodeId);
    const toNode = circuit.nodes.find((node) => node.id === toNodeId);
    if (!fromNode || !toNode) return null;
    if (!fromNode.position || !toNode.position) return null;

    return {
      wireId,
      from: {
        nodeId: fromNodeId,
        portName: fromPortName,
        x: (fromNode.position.x + 24) * camera.zoom + camera.x,
        y: fromNode.position.y * camera.zoom + camera.y,
      },
      to: {
        nodeId: toNodeId,
        portName: toPortName,
        x: (toNode.position.x - 24) * camera.zoom + camera.x,
        y: toNode.position.y * camera.zoom + camera.y,
      },
    };
  }, [camera.x, camera.y, camera.zoom, circuit.connections, circuit.nodes, selection.wires]);

  return (
    <CanvasHost
      id="playground-canvas"
      onWheelActive={handleWheelActive}
      onKeyDownActive={handleKeyDownActive}
      onKeyUpActive={handleKeyUpActive}
      preventPageScroll={true}
    >
      <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      {showToolbar && (
        <Toolbar
          engine={engine}
          onAddNode={handleAddNode}
          onDelete={handleDelete}
          snapToGrid={shouldSnap}
          onToggleSnap={toggleSnapToGrid}
          toolMode={toolMode}
          onToolModeChange={setToolMode}
          onFitToView={fitToView}
          onResetView={resetView}
        />
      )}

      {!showToolbar && showHud && (
        <div
          className="absolute top-3 right-3 z-20 bg-gray-900/80 border border-gray-700 rounded px-2.5 py-2 text-[10px] text-gray-300 space-y-1 pointer-events-none"
          data-testid="circuit-hud"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 uppercase tracking-wide">Selection</span>
            <span className="font-mono" data-testid="logic-selection-count">
              {selection.nodes.size}n / {selection.wires.size}w
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 uppercase tracking-wide">Mode</span>
            <span className="font-mono">{toolMode === 'wire' ? 'Wire' : 'Select'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 uppercase tracking-wide">State</span>
            <span className="font-mono">{interactionMode}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 uppercase tracking-wide">Zoom</span>
            <span className="font-mono" data-testid="logic-canvas-hud-zoom">
              {Math.round(camera.zoom * 100)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 uppercase tracking-wide">Snap</span>
            <span className="font-mono">{shouldSnap ? 'On' : 'Off'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 uppercase tracking-wide">Sim</span>
            <span
              className={`font-mono ${isReplayMode ? 'text-cyan-300' : isRunning ? 'text-green-400' : 'text-gray-400'
                }`}
            >
              {isReplayMode
                ? `Replay${tickRate ? ` ${tickRate}Hz` : ''}`
                : isRunning
                  ? `Running${tickRate ? ` ${tickRate}Hz` : ''}`
                  : 'Paused'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 uppercase tracking-wide">Tick</span>
            <span className="font-mono">{tickCount}</span>
          </div>
        </div>
      )}

      {/* Interaction Hints */}
      {!showToolbar && circuit.nodes.length === 0 && showHints && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-800/90 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 space-y-2 max-w-sm pointer-events-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-white">⚡ Circuit View</div>
              {onDismissHints && (
                <button
                  onClick={onDismissHints}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  title="Dismiss hints"
                >
                  ✕
                </button>
              )}
            </div>
            <div><span className="text-cyan-400">Drag from left panel:</span> Add components</div>
            <div><span className="text-cyan-400">Click port → Click port:</span> Connect wires</div>
            <div><span className="text-cyan-400">Drag nodes:</span> Move components</div>
            <div><span className="text-cyan-400">Space+Drag:</span> Pan view</div>
            <div><span className="text-cyan-400">Scroll:</span> Zoom</div>
            <div><span className="text-cyan-400">F:</span> Fit to view</div>
            <div><span className="text-cyan-400">0:</span> Reset view</div>
            <div><span className="text-cyan-400">G:</span> Toggle snap to grid</div>
            <div><span className="text-cyan-400">Ctrl (hold):</span> Disable snap while moving</div>
            <div><span className="text-cyan-400">Delete/Backspace:</span> Remove selected</div>
            <div className="pt-2 border-t border-gray-700 text-gray-500">
              Selections sync across all views!
            </div>
          </div>
        </div>
      )}

      {/* First Wire Toast */}
      {showFirstWireToast && (
        <div
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none"
          data-testid="logic-first-wire-toast"
        >
          <div className="bg-blue-600/90 border border-blue-500 rounded-lg px-4 py-3 text-sm text-white shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <div>
                <div className="font-semibold">First wire created!</div>
                <div className="text-blue-100 text-xs mt-1">
                  Press <span className="font-mono bg-blue-700/50 px-1 rounded">Delete</span> to remove wires, or right-click to cancel while drawing
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="rb-logic-canvas-svg"
        data-testid="logic-canvas-svg"
        data-interaction-mode={interactionMode}
        data-tool-mode={toolMode}
        data-wire-preview-active={editingState.wireStartPort ? '1' : '0'}
        width={width}
        height={height}
        style={{
          background: '#0a0a0a',
          touchAction: 'none',
          cursor: interactionMode === 'panning' ? 'grabbing' : isSpacePressed ? 'grab' : (() => {
            if (canvasInput.dragState.isDragging) return 'grabbing';
            if (interactionMode === 'placing') return 'copy';
            if (editingState.wireStartPort) {
              if (hoveredPort) {
                const validation = isValidConnection(
                  editingState.wireStartPort,
                  hoveredPort,
                  circuit,
                  getChipMetadata
                );
                return validation.valid ? 'crosshair' : 'not-allowed';
              }
              return 'crosshair';
            }
            return 'default';
          })(),
        }}
        onPointerDown={canvasInput.onPointerDown}
        onPointerMove={handlePointerMoveForWirePreview}
        onPointerUp={canvasInput.onPointerUp}
        onPointerCancel={canvasInput.onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Grid — stable container prevents SVG reconciliation mismatch */}
        <g key="grid-layer">
          {renderGrid(camera, width, height, {
            size: gridSize,
            color: '#142233',
            majorLineInterval: 5,
            majorLineColor: '#24405a',
          })}
        </g>

        {/* Wires — stable container */}
        <g key="wire-layer">
          {visibleConnections.map((conn) => {
            const { fromNodeId, fromPortName } = resolveConnectionEndpoints(conn);
            const wireId = toWireId(conn);
            const signal = renderSignals.get(`${fromNodeId}.${fromPortName}`);
            const probeColors = probeWireHighlights?.get(wireId);
            const mismatchColors = mismatchWireHighlights?.get(wireId);
            const netId = wireToNetId.get(wireId) ?? null;
            const isNetHighlighted =
              (hoveredNetId !== null && netId === hoveredNetId) ||
              (netId !== null && selectedNetIds.has(netId));

            return (
              <WireView
                key={wireId}
                connection={conn}
                nodes={circuit.nodes}
                camera={camera}
                presentationZoomMode={presentationZoomMode}
                isSelected={selection.wires.has(wireId)}
                isHovered={hoveredWireId === wireId}
                isNetHighlighted={isNetHighlighted}
                onSelect={selectWire}
                onHover={setHoveredWireId}
                onContextMenu={(clickedWireId, event) => {
                  selectWire(clickedWireId, false);
                  onWireContextMenu?.({
                    wireId: clickedWireId,
                    signalKey: `${fromNodeId}.${fromPortName}`,
                    clientX: event.clientX,
                    clientY: event.clientY,
                  });
                }}
                signal={signal}
                probeColors={probeColors}
                mismatchColors={mismatchColors}
              />
            );
          })}
        </g>

        {/* Wire Preview — stable container */}
        <g key="wire-preview-layer">
          {editingState.wireStartPort && (() => {
            const startNode = circuit.nodes.find(n => n.id === editingState.wireStartPort!.nodeId);
            if (!startNode || !startNode.position) return null;

            const startX = startNode.position.x * camera.zoom + camera.x;
            const startY = startNode.position.y * camera.zoom + camera.y;

            let isValid = true;
            let rejectionReason: string | undefined;
            if (hoveredPort) {
              const validation = isValidConnection(
                editingState.wireStartPort,
                hoveredPort,
                circuit,
                getChipMetadata
              );
              isValid = validation.valid;
              if (!isValid) rejectionReason = validation.reason;
            }

            return (
              <>
                <line
                  data-testid="logic-wire-preview"
                  x1={startX}
                  y1={startY}
                  x2={mousePosition.x}
                  y2={mousePosition.y}
                  stroke={isValid ? '#00ffff' : '#ef4444'}
                  strokeWidth="2"
                  strokeDasharray="8,6"
                  opacity="0.78"
                  pointerEvents="none"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="28"
                    dur="0.42s"
                    repeatCount="indefinite"
                  />
                </line>
                <circle
                  data-testid="logic-wire-preview-tip"
                  cx={mousePosition.x}
                  cy={mousePosition.y}
                  r="3"
                  fill={isValid ? '#2ec4b6' : '#ef4444'}
                  opacity="0.72"
                  pointerEvents="none"
                >
                  <animate attributeName="r" values="2.2;4.8;2.2" dur="0.42s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.52;0.95;0.52" dur="0.42s" repeatCount="indefinite" />
                </circle>
                {!isValid && rejectionReason && (() => {
                  const shortReason = rejectionReason.includes('itself') ? 'Same node'
                    : rejectionReason.includes('already exists') ? 'Already wired'
                    : rejectionReason.includes('input to input') ? 'Both inputs'
                    : rejectionReason.includes('output to output') ? 'Both outputs'
                    : 'Not allowed';
                  return (
                    <g
                      data-testid="logic-wire-rejection-hint"
                      style={{ pointerEvents: 'none' }}
                    >
                      <rect
                        x={mousePosition.x + 12}
                        y={mousePosition.y - 26}
                        width={100}
                        height={19}
                        rx={4}
                        fill="rgba(239,68,68,0.88)"
                      />
                      <text
                        x={mousePosition.x + 18}
                        y={mousePosition.y - 12}
                        fill="white"
                        fontSize="11"
                        fontFamily="sans-serif"
                      >
                        {shortReason}
                      </text>
                    </g>
                  );
                })()}
              </>
            );
          })()}
        </g>

        {/* Selected wire reconnect handles */}
        {selectedWireOverlay ? (
          <g key="wire-reconnect-layer" data-testid="logic-wire-reconnect-layer">
            {(['from', 'to'] as const).map((endpointKey) => {
              const endpoint = selectedWireOverlay[endpointKey];
              const activeRewire =
                wireRewireDraft?.wireId === selectedWireOverlay.wireId &&
                wireRewireDraft.anchor.nodeId === endpoint.nodeId &&
                wireRewireDraft.anchor.portName === endpoint.portName;
              return (
                <g
                  key={`${selectedWireOverlay.wireId}-${endpointKey}`}
                  data-testid={`logic-wire-reconnect-${endpointKey}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    beginWireReconnect(selectedWireOverlay.wireId, endpointKey);
                  }}
                  style={{ cursor: 'crosshair' }}
                >
                  <circle
                    cx={endpoint.x}
                    cy={endpoint.y}
                    r={10}
                    fill={activeRewire ? 'rgba(34, 197, 94, 0.26)' : 'rgba(142, 199, 255, 0.22)'}
                    stroke={activeRewire ? '#22c55e' : '#8ec7ff'}
                    strokeWidth={2}
                  />
                  <circle
                    cx={endpoint.x}
                    cy={endpoint.y}
                    r={4}
                    fill={activeRewire ? '#22c55e' : '#8ec7ff'}
                  />
                </g>
              );
            })}
          </g>
        ) : null}

        {/* Nodes — stable container */}
        <g key="node-layer">
          {visibleNodes.map((node) => (
            <NodeView
              key={node.id}
              node={node}
              camera={camera}
              presentationZoomMode={presentationZoomMode}
              isSelected={selection.nodes.has(node.id)}
              isHighlighted={node.id === highlightedNodeId || (tracedNodeIds?.has(node.id) ?? false) || (changedNodeIds?.has(node.id) ?? false)}
              isMismatchHighlighted={mismatchNodeIds?.has(node.id) ?? false}
              onSelect={selectNode}
              onMove={handleNodeMove}
              onPortClick={handlePortClick}
              onToggleSwitch={handleToggleSwitch}
              onNodeDoubleClick={onNodeDoubleClick}
              onProbeToggle={onProbeToggle}
              signals={renderSignals}
              chipMetadata={getChipMetadata?.(node.type)}
              wireStartPort={editingState.wireStartPort}
              onPortHover={(portName) => setHoveredPort({ nodeId: node.id, portName })}
              onPortLeave={() => setHoveredPort(null)}
              probedPorts={probedPorts}
              highlightedPort={highlightedPort}
              highlightedPortKeys={highlightedPortKeys}
              debugTick={debugTick}
              mismatchPortKeys={mismatchPortKeys}
              dragPosition={canvasInput.dragState.dragNodeId === node.id ? canvasInput.dragState.dragPosition : undefined}
              validWireTargets={validWireTargetKeys}
              hoveredWireTargetState={hoveredWireTargetState}
              diagnosticBadge={nodeDiagnosticBadges?.[node.id]}
              onDiagnosticBadgeClick={onNodeDiagnosticBadgeClick}
              ioPresentation={ioPresentationMap?.[node.id]}
              evalSequence={nodeEvalOrder ? (nodeEvalOrder.indexOf(node.id) >= 0 ? nodeEvalOrder.indexOf(node.id) + 1 : null) : null}
              issueGlow={nodeIssueSeverities?.get(node.id) ?? null}
              issuePortSeverities={issuePortSeverities}
            />
          ))}
        </g>

        {/* Box selection marquee */}
        {editingState.marquee && (() => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return null;

          const x1 = editingState.marquee.x1 - rect.left;
          const y1 = editingState.marquee.y1 - rect.top;
          const x2 = editingState.marquee.x2 - rect.left;
          const y2 = editingState.marquee.y2 - rect.top;

          const x = Math.min(x1, x2);
          const y = Math.min(y1, y2);
          const width = Math.abs(x2 - x1);
          const height = Math.abs(y2 - y1);

          if (width < 1 || height < 1) return null;

          return (
            <rect
              className="rb-logic-marquee"
              data-testid="logic-box-marquee"
              x={x}
              y={y}
              width={width}
              height={height}
              fill="rgba(34, 197, 94, 0.12)"
              stroke="#22c55e"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          );
        })()}

        {/* Selection bounds + group move ghost */}
        {showSelectionBounds && selectionBoundsScreen ? (
          <g key="selection-bounds-layer" data-testid="logic-selection-bounds-layer">
            <rect
              data-testid="logic-selection-bounds"
              x={selectionBoundsScreen.x}
              y={selectionBoundsScreen.y}
              width={selectionBoundsScreen.width}
              height={selectionBoundsScreen.height}
              fill="rgba(142, 199, 255, 0.07)"
              stroke="rgba(142, 199, 255, 0.8)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
            {showSelectionGhost ? (
              <rect
                data-testid="logic-selection-ghost"
                x={selectionBoundsScreen.x}
                y={selectionBoundsScreen.y}
                width={selectionBoundsScreen.width}
                height={selectionBoundsScreen.height}
                fill="rgba(46, 196, 182, 0.05)"
                stroke="rgba(46, 196, 182, 0.85)"
                strokeWidth={2}
                strokeDasharray="8 5"
                pointerEvents="none"
              />
            ) : null}
            <g data-testid="logic-selection-count-badge">
              <rect
                x={selectionBadgeLayout?.countLeft ?? selectionBoundsScreen.x + 6}
                y={selectionBadgeLayout?.top ?? selectionBoundsScreen.y - 24}
                width={96}
                height={18}
                rx={9}
                fill="rgba(9, 16, 24, 0.92)"
                stroke="rgba(142, 199, 255, 0.65)"
                strokeWidth={1}
                pointerEvents="none"
              />
              <text
                x={(selectionBadgeLayout?.countLeft ?? selectionBoundsScreen.x + 6) + 48}
                y={(selectionBadgeLayout?.top ?? selectionBoundsScreen.y - 24) + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#d9efff"
                fontFamily="IBM Plex Mono, Consolas, monospace"
                fontSize={10}
                pointerEvents="none"
              >
                {selectionCountLabel}
              </text>
            </g>
            {interactionMode === 'draggingNode' ? (
              <g data-testid="logic-selection-delta">
                <rect
                  x={selectionBadgeLayout?.deltaLeft ?? selectionBoundsScreen.x + selectionBoundsScreen.width - 110}
                  y={selectionBadgeLayout?.top ?? selectionBoundsScreen.y - 24}
                  width={104}
                  height={18}
                  rx={9}
                  fill="rgba(9, 16, 24, 0.92)"
                  stroke="rgba(46, 196, 182, 0.65)"
                  strokeWidth={1}
                  pointerEvents="none"
                />
                <text
                  x={(selectionBadgeLayout?.deltaLeft ?? selectionBoundsScreen.x + selectionBoundsScreen.width - 110) + 52}
                  y={(selectionBadgeLayout?.top ?? selectionBoundsScreen.y - 24) + 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#b9fff7"
                  fontFamily="IBM Plex Mono, Consolas, monospace"
                  fontSize={10}
                  pointerEvents="none"
                >
                  {`\u0394x ${activeDragDelta.x}  \u0394y ${activeDragDelta.y}`}
                </text>
              </g>
            ) : null}
          </g>
        ) : null}

        {/* Snap guides while dragging */}
        {showSnapGuides && snapGuideScreen ? (
          <g key="snap-guides-layer" data-testid="logic-snap-guides">
            <line
              data-testid="logic-snap-guide-x"
              x1={snapGuideScreen.x}
              y1={0}
              x2={snapGuideScreen.x}
              y2={height}
              stroke="rgba(46, 196, 182, 0.72)"
              strokeWidth={1}
              strokeDasharray="4 4"
              pointerEvents="none"
            />
            <line
              data-testid="logic-snap-guide-y"
              x1={0}
              y1={snapGuideScreen.y}
              x2={width}
              y2={snapGuideScreen.y}
              stroke="rgba(46, 196, 182, 0.72)"
              strokeWidth={1}
              strokeDasharray="4 4"
              pointerEvents="none"
            />
            <circle
              data-testid="logic-snap-indicator"
              cx={snapGuideScreen.x}
              cy={snapGuideScreen.y}
              r={3.5}
              fill="#2ec4b6"
              opacity={0.92}
              pointerEvents="none"
            />
          </g>
        ) : null}

        {/* Alignment guides — amber lines when dragged node aligns with another */}
        {alignmentGuides.verticals.length > 0 || alignmentGuides.horizontals.length > 0 ? (
          <g key="alignment-guides-layer">
            {alignmentGuides.verticals.map((worldX) => {
              const screenX = worldX * camera.zoom + camera.x;
              return (
                <line
                  key={`align-v-${worldX}`}
                  data-testid="logic-align-guide-x"
                  x1={screenX}
                  y1={0}
                  x2={screenX}
                  y2={height}
                  stroke="rgba(251,146,60,0.65)"
                  strokeWidth={1}
                  strokeDasharray="5 3"
                  pointerEvents="none"
                />
              );
            })}
            {alignmentGuides.horizontals.map((worldY) => {
              const screenY = worldY * camera.zoom + camera.y;
              return (
                <line
                  key={`align-h-${worldY}`}
                  data-testid="logic-align-guide-y"
                  x1={0}
                  y1={screenY}
                  x2={width}
                  y2={screenY}
                  stroke="rgba(251,146,60,0.65)"
                  strokeWidth={1}
                  strokeDasharray="5 3"
                  pointerEvents="none"
                />
              );
            })}
          </g>
        ) : null}

        {/* Switch Toggle Overlay Layer */}
        <g id="rb-switch-overlay" style={{ pointerEvents: 'none' }}>
          {visibleNodes
            .filter((node) => node.type === 'Switch' || node.type === 'INPUT')
            .filter((node) => node.position)
            .map((node) => {
              const ioPresentation = ioPresentationMap?.[node.id] ?? inferNodeIoPresentation(node);
              const ioKind = ioPresentation.kind;
              const ioLabel = (ioPresentation.label?.trim() || node.label || node.id).toUpperCase();
              const pinAlias = ioPresentation.pinAlias?.trim().toUpperCase() || '';
              const screenX = node.position!.x * camera.zoom + camera.x;
              const screenY = node.position!.y * camera.zoom + camera.y;
              const size = 48 * camera.zoom;
              const switchState = node.state?.isOn ?? 0;

              const toggleWidth = size * 0.75;
              const toggleHeight = 16;
              const toggleX = -toggleWidth / 2;
              const toggleY = -size / 2 - 22;
              const toggleHitWidth = size * 1.0;
              const toggleHitHeight = 28;
              const toggleHitX = -toggleHitWidth / 2;
              const toggleHitY = toggleY - (toggleHitHeight - toggleHeight) / 2;

              return (
                <g
                  key={`switch-toggle-${node.id}`}
                  data-testid={`switch-toggle-${node.id}-container`}
                  transform={`translate(${screenX}, ${screenY})`}
                  style={{ pointerEvents: 'auto' }}
                >
                  <rect
                    x={toggleHitX}
                    y={toggleHitY}
                    width={toggleHitWidth}
                    height={toggleHitHeight}
                    rx={toggleHitHeight / 2}
                    fill="transparent"
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    data-testid={`switch-toggle-${node.id}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!editingState.wireStartPort) {
                        handleToggleSwitch(node.id);
                      }
                    }}
                  />
                  <rect
                    x={toggleX}
                    y={toggleY}
                    width={toggleWidth}
                    height={toggleHeight}
                    rx={toggleHeight / 2}
                    fill={
                      ioKind === 'button'
                        ? switchState
                          ? '#0f5a7a'
                          : '#334155'
                        : ioKind === 'clock'
                          ? switchState
                            ? '#0ea5e9'
                            : '#334155'
                          : switchState
                            ? '#22c55e'
                            : '#374151'
                    }
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'none' }}
                  />
                  {ioKind === 'button' ? (
                    <rect
                      x={toggleX + toggleWidth * 0.3}
                      y={toggleY + 2}
                      width={toggleWidth * 0.4}
                      height={toggleHeight - 4}
                      rx={4}
                      fill="#f8fafc"
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : ioKind === 'clock' ? (
                    <text
                      x={0}
                      y={toggleY + toggleHeight / 2 + 0.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#f8fafc"
                      fontSize={Math.max(8, 9 * camera.zoom)}
                      fontWeight="700"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      CLK
                    </text>
                  ) : (
                    <circle
                      cx={switchState ? toggleX + toggleWidth - 9 : toggleX + 9}
                      cy={toggleY + toggleHeight / 2}
                      r={6}
                      fill="#fff"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  <text
                    x={0}
                    y={toggleY - 8}
                    textAnchor="middle"
                    fill={
                      ioKind === 'button'
                        ? switchState
                          ? '#7dd3fc'
                          : '#94a3b8'
                        : ioKind === 'clock'
                          ? switchState
                            ? '#7dd3fc'
                            : '#94a3b8'
                          : switchState
                            ? '#22c55e'
                            : '#9ca3af'
                    }
                    fontSize={Math.max(8, 10 * camera.zoom)}
                    fontWeight="700"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {ioKind === 'button'
                      ? switchState
                        ? 'PRESSED'
                        : 'BUTTON'
                      : ioKind === 'clock'
                        ? `${pinAlias || 'CLK'} ${switchState ? '1' : '0'}`
                        : `${ioLabel} ${switchState ? 'ON' : 'OFF'}`}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>
      {circuit && circuit.nodes.length > 0 && (
        <Minimap
          nodes={circuit.nodes}
          camera={camera}
          canvasWidth={width}
          canvasHeight={height}
          onClickPan={handleMinimapPan}
        />
      )}
      </div>
    </CanvasHost>
  );
};

interface SelectionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeSelectionBounds(nodes: Node[]): SelectionBounds | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const position = node.position;
    if (!position) continue;
    const halfSize = 24;
    minX = Math.min(minX, position.x - halfSize);
    minY = Math.min(minY, position.y - halfSize);
    maxX = Math.max(maxX, position.x + halfSize);
    maxY = Math.max(maxY, position.y + halfSize);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, minY, maxX, maxY };
}

function worldBoundsToScreen(bounds: SelectionBounds | null, camera: Camera) {
  if (!bounds) return null;
  const x = bounds.minX * camera.zoom + camera.x;
  const y = bounds.minY * camera.zoom + camera.y;
  const width = (bounds.maxX - bounds.minX) * camera.zoom;
  const height = (bounds.maxY - bounds.minY) * camera.zoom;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function clampValue(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function inferNodeIoPresentation(node: Node): NodeIoPresentation {
  const normalized = `${node.label ?? ''} ${node.id}`.trim().toUpperCase();
  const isInput = node.type === 'INPUT' || node.type === 'Switch';
  const isOutput = node.type === 'OUTPUT' || node.type === 'Lamp';

  if (isOutput && /\b(LD\d+|LED\d+)\b/.test(normalized)) {
    return {
      kind: 'led',
      label: extractAlias(normalized, /(LD\d+|LED\d+)/),
      pinAlias: extractAlias(normalized, /(LD\d+|LED\d+)/),
    };
  }
  if (isInput && /\b(CLK100MHZ|CLK|CLOCK)\b/.test(normalized)) {
    return {
      kind: 'clock',
      label: extractAlias(normalized, /(CLK100MHZ|CLK|CLOCK)/),
      pinAlias: 'CLK100MHZ',
    };
  }
  if (isInput && /\b(BTN[CUDLR]|BTN\d+)\b/.test(normalized)) {
    const alias = extractAlias(normalized, /(BTN[CUDLR]|BTN\d+)/);
    return {
      kind: 'button',
      label: alias,
      pinAlias: alias,
    };
  }
  if (isInput && /\b(SW\d+)\b/.test(normalized)) {
    const alias = extractAlias(normalized, /(SW\d+)/);
    return {
      kind: 'switch',
      label: alias,
      pinAlias: alias,
    };
  }
  if (isOutput) {
    return { kind: 'led', label: node.label ?? node.id };
  }
  if (isInput) {
    return { kind: 'switch', label: node.label ?? node.id };
  }
  return { kind: 'generic', label: node.label ?? node.id };
}

function extractAlias(source: string, pattern: RegExp): string {
  const match = pattern.exec(source);
  return match?.[1] ?? source;
}
