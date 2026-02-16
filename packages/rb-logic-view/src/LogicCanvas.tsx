// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { TickEngine, Node, Connection, Circuit } from '@redbyte/rb-logic-core';
import { useLogicViewStore, getGlobalViewStateStore, type LogicViewState } from './useLogicViewStore';
import { NodeView, type ChipMetadata } from './components/NodeView';
import { WireView } from './components/WireView';
import { Toolbar } from './components/Toolbar';
import { renderGrid } from './tools/grid';
import { isValidConnection, normalizeConnection, isInputPort } from './tools/wireValidation';
import { computeWireNetIds } from './tools/netHighlight';
import { findSmartSpawnPosition } from './tools/placement';
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
  /** Optional callback (dev/advanced) to reflect net highlight across surfaces (e.g., 2D -> 3D). */
  onNetHighlightWiresChanged?: (wireIds: Set<string>) => void;
  isRunning?: boolean;
  isReplayMode?: boolean;
  tickRate?: number;
  tickCount?: number;
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
  onNetHighlightWiresChanged,
  isRunning = false,
  isReplayMode = false,
  tickRate = 0,
  tickCount = 0,
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
  const lastCircuitNodeCount = React.useRef(0);
  const lastFocusRequestId = React.useRef<number>(-1);
  const mouseRafPending = React.useRef<boolean>(false);

  // Stable refs for functions used in subscriptions (prevents infinite loops)
  const selectMultipleNodesRef = React.useRef(selectMultipleNodes);
  selectMultipleNodesRef.current = selectMultipleNodes;
  const focusNodeRef = React.useRef<((nodeId: string) => void) | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = React.useState<string | null>(null);
  const [showHud, setShowHud] = React.useState(true);
  const hudTimerRef = React.useRef<number | null>(null);
  const bumpHud = React.useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) {
      window.clearTimeout(hudTimerRef.current);
    }
    hudTimerRef.current = window.setTimeout(() => {
      setShowHud(false);
    }, 2400);
  }, []);

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

  // Auto-center and fit circuit in view when circuit changes
  React.useEffect(() => {
    const currentNodeCount = circuit.nodes.length;

    // Only auto-fit if the circuit has changed (different node count)
    if (currentNodeCount > 0 && currentNodeCount !== lastCircuitNodeCount.current) {
      lastCircuitNodeCount.current = currentNodeCount;

      // Calculate bounds
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      circuit.nodes.forEach((node) => {
        minX = Math.min(minX, node.position.x);
        maxX = Math.max(maxX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxY = Math.max(maxY, node.position.y);
      });

      if (!isFinite(minX)) return;

      // Add padding
      const padding = 100;
      const boundsWidth = maxX - minX + padding * 2;
      const boundsHeight = maxY - minY + padding * 2;

      // Calculate zoom to fit
      const zoomX = width / boundsWidth;
      const zoomY = height / boundsHeight;
      const newZoom = Math.min(zoomX, zoomY, 2); // Max zoom of 2x

      // Calculate center offset
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setCamera({
        x: width / 2 - centerX * newZoom,
        y: height / 2 - centerY * newZoom,
        zoom: newZoom,
      });
    }
  }, [circuit.nodes.length, width, height, setCamera]);

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
  const [isAltPressed, setIsAltPressed] = React.useState(false);
  const [hoveredPort, setHoveredPort] = React.useState<{ nodeId: string; portName: string } | null>(null);
  const [showFirstWireToast, setShowFirstWireToast] = React.useState(false);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });

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
    onWireCancel: endWire,
    isSpacePressed,
    isReplayMode,
    interactionMode,
    setInteractionMode,
    snapEnabled: shouldSnap && !isAltPressed,
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
      // Alt temporarily disables snap
      const snapEnabled = shouldSnap && !isAltPressed;
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
                x: snapEnabled ? snapPointToGrid(n.position.x + dx, gridSize) : n.position.x + dx,
                y: snapEnabled ? snapPointToGrid(n.position.y + dy, gridSize) : n.position.y + dy,
              },
            };
          }
          return n;
        }),
      };
      commitCircuit(updatedCircuit);
    });
  }, [circuit, shouldSnap, isAltPressed, gridSize, selection.nodes, commitCircuit, isReplayMode]);
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

  const handlePortClick = React.useCallback((nodeId: string, portName: string) => {
    if (isReplayMode) return;
    // Don't allow port interactions while panning or dragging
    if (interactionMode === 'panning' || interactionMode === 'dragging') return;

    if (interactionMode === 'wiring' && editingState.wireStartPort) {
      // End wire - validate connection first
      const from = editingState.wireStartPort;
      const to = { nodeId, portName };

      const validation = isValidConnection(from, to, circuit, getChipMetadata);

      if (!validation.valid) {
        // Invalid connection - just cancel the wire silently
        endWire();
        return;
      }

      // Normalize connection (output -> input)
      const normalizedConnection = normalizeConnection(from, to, circuit, getChipMetadata);

      const updatedCircuit = {
        ...circuit,
        connections: [...circuit.connections, normalizedConnection],
      };

      commitCircuit(updatedCircuit);
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
      startWire({ nodeId, portName }); // This sets interactionMode to 'wiring'
    }
  }, [circuit, editingState.wireStartPort, commitCircuit, endWire, startWire, getChipMetadata, isReplayMode, interactionMode]);

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
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      return;
    }

    let updatedCircuit = circuit;

    // Delete selected nodes (and their connections)
    if (selection.nodes.size > 0) {
      updatedCircuit = {
        nodes: circuit.nodes.filter((n) => !selection.nodes.has(n.id)),
        connections: circuit.connections.filter(
          (c) =>
            !selection.nodes.has(c.from.nodeId) && !selection.nodes.has(c.to.nodeId)
        ),
      };
    }

    // Delete selected wires
    if (selection.wires.size > 0) {
      updatedCircuit = {
        ...updatedCircuit,
        connections: updatedCircuit.connections.filter((c) => {
          const wireId = `${c.from.nodeId}.${c.from.portName}-${c.to.nodeId}.${c.to.portName}`;
          return !selection.wires.has(wireId);
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
    setCamera(newCamera);
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
    };
  }, []);

  // CanvasHost wheel handler
  const handleWheelActive = React.useCallback((e: WheelEvent) => {
    const delta = e.ctrlKey ? -e.deltaY * 0.5 : -e.deltaY;
    zoomFn(delta, e.clientX, e.clientY);
  }, [zoomFn]);

  // CanvasHost keyboard handlers
  const handleKeyDownActive = React.useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      // Space: Enable pan mode
      e.preventDefault(); // Prevent page scroll
      setIsSpacePressed(true);
    } else if (e.key === 'Alt') {
      // Alt: Temporarily disable snap
      setIsAltPressed(true);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDeleteRef.current();
    } else if (e.key === 'Escape') {
      clearSelectionRef.current();
      if (editingStateRef.current.wireStartPort) {
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
  }, [zoomFn]);

  const handleKeyUpActive = React.useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      // Space released: Disable pan mode
      setIsSpacePressed(false);
    } else if (e.key === 'Alt') {
      // Alt released: Re-enable snap
      setIsAltPressed(false);
    }
  }, []);

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
            <span className="font-mono">
              {selection.nodes.size}n / {selection.wires.size}w
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 uppercase tracking-wide">Mode</span>
            <span className="font-mono">{toolMode === 'wire' ? 'Wire' : 'Select'}</span>
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
            <div><span className="text-cyan-400">Alt (hold):</span> Disable snap while moving</div>
            <div><span className="text-cyan-400">Delete/Backspace:</span> Remove selected</div>
            <div className="pt-2 border-t border-gray-700 text-gray-500">
              Selections sync across all views!
            </div>
          </div>
        </div>
      )}

      {/* First Wire Toast */}
      {showFirstWireToast && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
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
        width={width}
        height={height}
        style={{
          background: '#0a0a0a',
          touchAction: 'none',
          cursor: interactionMode === 'panning' ? 'grabbing' : isSpacePressed ? 'grab' : (() => {
            if (canvasInput.dragState.isDragging) return 'grabbing';
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
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Grid — stable container prevents SVG reconciliation mismatch */}
        <g key="grid-layer">
          {renderGrid(camera, width, height, {
            size: gridSize,
            color: '#1a1a1a',
            majorLineInterval: 5,
            majorLineColor: '#2a2a2a',
          })}
        </g>

        {/* Wires — stable container */}
        <g key="wire-layer">
          {visibleConnections.map((conn) => {
            const fromNodeId = typeof conn.from === 'string' ? conn.from : conn.from.nodeId;
            const toNodeId = typeof conn.to === 'string' ? conn.to : conn.to.nodeId;
            const fromPortName = typeof conn.from === 'string'
              ? (conn.fromPin ?? conn.fromPort ?? 'out')
              : (conn.from.portName ?? conn.from.port ?? 'out');
            const toPortName = typeof conn.to === 'string'
              ? (conn.toPin ?? conn.toPort ?? 'in')
              : (conn.to.portName ?? conn.to.port ?? 'in');

            const wireId = `${fromNodeId}.${fromPortName}-${toNodeId}.${toPortName}`;
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
                isSelected={selection.wires.has(wireId)}
                isNetHighlighted={isNetHighlighted}
                onSelect={selectWire}
                onHover={setHoveredWireId}
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
            if (hoveredPort) {
              const validation = isValidConnection(
                editingState.wireStartPort,
                hoveredPort,
                circuit,
                getChipMetadata
              );
              isValid = validation.valid;
            }

            return (
              <line
                x1={startX}
                y1={startY}
                x2={mousePosition.x}
                y2={mousePosition.y}
                stroke={isValid ? "#00ffff" : "#ef4444"}
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
                pointerEvents="none"
              />
            );
          })()}
        </g>

        {/* Nodes — stable container */}
        <g key="node-layer">
          {visibleNodes.map((node) => (
            <NodeView
              key={node.id}
              node={node}
              camera={camera}
              isSelected={selection.nodes.has(node.id)}
              isHighlighted={node.id === highlightedNodeId}
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
              debugTick={debugTick}
              mismatchPortKeys={mismatchPortKeys}
              dragPosition={canvasInput.dragState.dragNodeId === node.id ? canvasInput.dragState.dragPosition : undefined}
            />
          ))}
        </g>

        {/* Switch Toggle Overlay Layer */}
        <g id="rb-switch-overlay" style={{ pointerEvents: 'none' }}>
          {visibleNodes
            .filter((node) => node.type === 'Switch' || node.type === 'INPUT')
            .filter((node) => node.position)
            .map((node) => {
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
                    onMouseDown={(e) => {
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
                    fill={switchState ? '#22c55e' : '#374151'}
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx={switchState ? toggleX + toggleWidth - 9 : toggleX + 9}
                    cy={toggleY + toggleHeight / 2}
                    r={6}
                    fill="#fff"
                    style={{ pointerEvents: 'none' }}
                  />
                  <text
                    x={0}
                    y={toggleY - 8}
                    textAnchor="middle"
                    fill={switchState ? '#22c55e' : '#9ca3af'}
                    fontSize={Math.max(9, 11 * camera.zoom)}
                    fontWeight="700"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {switchState ? 'ON' : 'OFF'}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>
      </div>
    </CanvasHost>
  );
};
