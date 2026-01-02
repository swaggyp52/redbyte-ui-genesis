// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { TickEngine, Node, Connection } from '@redbyte/rb-logic-core';
import { useLogicViewStore, getGlobalViewStateStore } from './useLogicViewStore';
import { NodeView, type ChipMetadata } from './components/NodeView';
import { WireView } from './components/WireView';
import { Toolbar } from './components/Toolbar';
import { renderGrid } from './tools/grid';
import { snapToGrid } from './tools/panzoom';

export interface LogicCanvasProps {
  engine: TickEngine;
  circuit?: Circuit; // Optional: if provided, use this instead of polling engine
  width?: number;
  height?: number;
  showToolbar?: boolean;
  getChipMetadata?: (nodeType: string) => ChipMetadata | undefined;
  onNodeDoubleClick?: (nodeId: string) => void;
  onCircuitChange?: (circuit: Circuit) => void; // Callback to propagate circuit updates
  showHints?: boolean;
  onDismissHints?: () => void;
  // Milestone D: Determinism recording (optional, dev-only)
  onInputToggled?: (nodeId: string, portName: string, newValue: 0 | 1) => void;
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
  showHints = true,
  onDismissHints,
  onInputToggled,
}) => {
  const {
    camera,
    setCamera,
    pan,
    zoom: zoomFn,
    selection,
    selectNode,
    selectWire,
    clearSelection,
    snapToGrid: shouldSnap,
    toggleSnapToGrid,
    gridSize,
    editingState,
    startWire,
    endWire,
    selectMultipleNodes,
  } = useLogicViewStore();

  // Use external circuit if provided, otherwise poll from engine
  const [internalCircuit, setInternalCircuit] = React.useState(engine.getCircuit());
  const circuit = externalCircuit ?? internalCircuit;
  const [signals, setSignals] = React.useState<Map<string, 0 | 1>>(new Map());
  const svgRef = React.useRef<SVGSVGElement>(null);
  const lastSyncedSelection = React.useRef<Set<string>>(new Set());
  const lastCircuitNodeCount = React.useRef(0);

  // Invariant: controlled mode requires onCircuitChange callback
  if (process.env.NODE_ENV === 'development') {
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

  // Subscribe to engine updates with aggressive syncing (only if no external circuit provided)
  React.useEffect(() => {
    // If external circuit is provided, skip polling (parent handles updates)
    if (externalCircuit) {
      // Still sync signals for live updates
      const interval = setInterval(() => {
        setSignals(engine.getEngine().getAllSignals());
      }, 16);
      return () => clearInterval(interval);
    }

    // Otherwise, poll circuit from engine (legacy behavior)
    const syncCircuit = () => {
      const newCircuit = engine.getCircuit();
      setInternalCircuit(newCircuit);
      setSignals(engine.getEngine().getAllSignals());
    };

    // Immediate first sync
    syncCircuit();

    // Track intervals for cleanup
    let fastInterval: NodeJS.Timeout | null = null;
    let slowInterval: NodeJS.Timeout | null = null;
    let fastPollCount = 0;
    const maxFastPolls = 200; // 1 second of 5ms polling

    // Start with fast polling
    fastInterval = setInterval(() => {
      syncCircuit();
      fastPollCount++;

      // After initial burst, slow down to 60fps
      if (fastPollCount >= maxFastPolls && fastInterval) {
        clearInterval(fastInterval);
        fastInterval = null;
        // Start slow polling
        slowInterval = setInterval(syncCircuit, 16);
      }
    }, 5);

    // Cleanup both intervals on unmount
    return () => {
      if (fastInterval) clearInterval(fastInterval);
      if (slowInterval) clearInterval(slowInterval);
    };
  }, [engine, externalCircuit]);

  // Subscribe to global selection changes from other views
  React.useEffect(() => {
    const globalStore = getGlobalViewStateStore();
    if (!globalStore) return;

    const unsubscribe = globalStore.subscribe(
      (state: any) => {
        // Sync global selection to local selection
        const globalNodeIds = state.selectedNodeIds || new Set();

        // Check if this is different from what we last synced
        const lastSynced = lastSyncedSelection.current;
        const isDifferent =
          globalNodeIds.size !== lastSynced.size ||
          Array.from(globalNodeIds).some((id: string) => !lastSynced.has(id));

        if (isDifferent) {
          lastSyncedSelection.current = new Set(globalNodeIds);
          // Pass syncToGlobal: false to prevent circular updates
          selectMultipleNodes(Array.from(globalNodeIds), false);
        }
      }
    );

    return unsubscribe;
  }, [selectMultipleNodes]);

  // Non-passive wheel event listener for zooming (React 19 compatibility)
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.ctrlKey ? -e.deltaY * 0.5 : -e.deltaY;
      zoomFn(delta, e.clientX, e.clientY);
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [zoomFn]);

  // Mouse handlers for pan/zoom
  const [isPanning, setIsPanning] = React.useState(false);
  const [lastMouse, setLastMouse] = React.useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.shiftKey) {
      // Middle mouse or shift+click for panning
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0 && !e.shiftKey) {
      // Left click on background clears selection
      clearSelection();
    }
  };

  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      pan(dx, dy);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }

    // Track mouse position for wire preview
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleNodeMove = React.useCallback((nodeId: string, x: number, y: number) => {
    const newX = shouldSnap ? snapToGrid(x, gridSize) : x;
    const newY = shouldSnap ? snapToGrid(y, gridSize) : y;

    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) =>
        n.id === nodeId ? { ...n, position: { x: newX, y: newY } } : n
      ),
    };

    commitCircuit(updatedCircuit);
  }, [circuit, shouldSnap, gridSize, commitCircuit]);

  const handleToggleSwitch = React.useCallback((nodeId: string) => {
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
  }, [circuit, onInputToggled, commitCircuit]);

  const handlePortClick = React.useCallback((nodeId: string, portName: string) => {
    if (editingState.wireStartPort) {
      // End wire
      const newConnection: Connection = {
        from: editingState.wireStartPort,
        to: { nodeId, portName },
      };

      const updatedCircuit = {
        ...circuit,
        connections: [...circuit.connections, newConnection],
      };

      commitCircuit(updatedCircuit);
      endWire();
    } else {
      // Start wire
      startWire({ nodeId, portName });
    }
  }, [circuit, editingState.wireStartPort, commitCircuit, endWire, startWire]);

  const handleAddNode = React.useCallback((type: string) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type,
      position: {
        x: (-camera.x + width / 2) / camera.zoom,
        y: (-camera.y + height / 2) / camera.zoom,
      },
      rotation: 0,
      config: {},
    };

    const updatedCircuit = {
      ...circuit,
      nodes: [...circuit.nodes, newNode],
    };

    commitCircuit(updatedCircuit);
  }, [circuit, camera, width, height, commitCircuit]);

  const handleDelete = React.useCallback(() => {
    const updatedCircuit = {
      nodes: circuit.nodes.filter((n) => !selection.nodes.has(n.id)),
      connections: circuit.connections.filter(
        (c) =>
          !selection.nodes.has(c.from.nodeId) && !selection.nodes.has(c.to.nodeId)
      ),
    };

    commitCircuit(updatedCircuit);
    clearSelection();
  }, [circuit, selection.nodes, commitCircuit, clearSelection]);

  // Fit circuit to view
  const fitToView = React.useCallback(() => {
    if (circuit.nodes.length === 0) return;

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
  }, [circuit.nodes, width, height, setCamera]);

  // Reset view to default
  const resetView = React.useCallback(() => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  }, [setCamera]);

  // Keyboard handlers
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        clearSelection();
        if (editingState.wireStartPort) {
          endWire();
        }
      } else if (e.key === 'w' || e.key === 'W') {
        // W: Toggle wire tool (cancel wire mode if active)
        if (editingState.wireStartPort) {
          endWire();
        }
      } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd+F: Fit to view
        e.preventDefault();
        fitToView();
      } else if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd+R: Reset view
        e.preventDefault();
        resetView();
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd+0: Reset zoom to 100%
        e.preventDefault();
        setCamera({ ...camera, zoom: 1 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      {showToolbar && (
        <Toolbar
          engine={engine}
          onAddNode={handleAddNode}
          onDelete={handleDelete}
          snapToGrid={shouldSnap}
          onToggleSnap={toggleSnapToGrid}
        />
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
            <div><span className="text-cyan-400">Shift+Drag:</span> Pan view</div>
            <div><span className="text-cyan-400">Scroll:</span> Zoom</div>
            <div><span className="text-cyan-400">Ctrl/Cmd+F:</span> Fit to view</div>
            <div><span className="text-cyan-400">Ctrl/Cmd+R:</span> Reset view</div>
            <div><span className="text-cyan-400">Ctrl/Cmd+0:</span> Reset zoom</div>
            <div><span className="text-cyan-400">Delete/Backspace:</span> Remove selected</div>
            <div className="pt-2 border-t border-gray-700 text-gray-500">
              Selections sync across all views!
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
          cursor: isPanning ? 'grabbing' : editingState.wireStartPort ? 'crosshair' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Grid */}
        {renderGrid(camera, width, height, {
          size: gridSize,
          color: '#1a1a1a',
          majorLineInterval: 5,
          majorLineColor: '#2a2a2a',
        })}

        {/* Wires */}
        {circuit.connections.map((conn, idx) => {
          const wireId = `${conn.from.nodeId}.${conn.from.portName}-${conn.to.nodeId}.${conn.to.portName}`;
          const signal = signals.get(`${conn.from.nodeId}.${conn.from.portName}`);

          return (
            <WireView
              key={wireId}
              connection={conn}
              nodes={circuit.nodes}
              camera={camera}
              isSelected={selection.wires.has(wireId)}
              onSelect={selectWire}
              signal={signal}
            />
          );
        })}

        {/* Wire Preview - shows while drawing */}
        {editingState.wireStartPort && (() => {
          const startNode = circuit.nodes.find(n => n.id === editingState.wireStartPort!.nodeId);
          if (!startNode) return null;

          const startX = startNode.position.x * camera.zoom + camera.x;
          const startY = startNode.position.y * camera.zoom + camera.y;

          return (
            <line
              x1={startX}
              y1={startY}
              x2={mousePosition.x}
              y2={mousePosition.y}
              stroke="#00ffff"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.7"
              pointerEvents="none"
            />
          );
        })()}

        {/* Nodes */}
        {circuit.nodes.map((node) => (
          <NodeView
            key={node.id}
            node={node}
            camera={camera}
            isSelected={selection.nodes.has(node.id)}
            onSelect={selectNode}
            onMove={handleNodeMove}
            onPortClick={handlePortClick}
            onToggleSwitch={handleToggleSwitch}
            onNodeDoubleClick={onNodeDoubleClick}
            signals={signals}
            chipMetadata={getChipMetadata?.(node.type)}
            wireStartPort={editingState.wireStartPort}
          />
        ))}
      </svg>
    </div>
  );
};
