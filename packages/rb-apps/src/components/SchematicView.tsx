// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useState, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import type { Circuit, Node, Connection, Signal, PortRef } from '@redbyte/rb-logic-core';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { useViewStateStore } from '../stores/viewStateStore';
import { useCircuitStore } from '../stores/circuitStore';
import { getPortPositions, findNearestPort, type PortPosition } from './schematic/SchematicPortDetector';
import { mark, measure, trackRender, useUiTickStore } from '@redbyte/rb-utils';

interface SchematicViewProps {
  circuit: Circuit;
  engine: CircuitEngine;
  isRunning: boolean;
  width?: number;
  height?: number;
  onCircuitChange?: (circuit: Circuit) => void;
  showHints?: boolean;
  onDismissHints?: () => void;
  onHelp?: () => void;
  probeWireHighlights?: Map<string, string[]>;
  mismatchWireHighlights?: Map<string, string[]> | null;
  mismatchNodeIds?: Set<string> | null;
  mismatchPortKeys?: Set<string> | null;
  debugSignals?: Map<string, 0 | 1> | null;
  debugTick?: number | null;
  isReplayMode?: boolean;
}

interface SchematicNode {
  id: string;
  x: number;
  y: number;
  type: string;
  symbol: string;
}

interface SchematicWire {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  signal: Signal;
  points: { x: number; y: number }[];
  probeColors?: string[];
  mismatchColors?: string[];
}

export const getSchematicViewBounds = (
  camera: { x: number; y: number; zoom: number },
  width: number,
  height: number,
  margin = 200
) => {
  const left = (-camera.x) / camera.zoom - margin;
  const top = (-camera.y) / camera.zoom - margin;
  const right = (width - camera.x) / camera.zoom + margin;
  const bottom = (height - camera.y) / camera.zoom + margin;
  return { left, top, right, bottom };
};

export const getVisibleSchematicNodes = (
  nodes: Array<{ id: string; x: number; y: number }>,
  bounds: ReturnType<typeof getSchematicViewBounds>
) =>
  nodes.filter((node) => {
    return (
      node.x >= bounds.left &&
      node.x <= bounds.right &&
      node.y >= bounds.top &&
      node.y <= bounds.bottom
    );
  });

/**
 * IEEE/ANSI standard logic gate symbols
 * 
 * GEOMETRY CONTRACT (must match SchematicPortDetector):
 * - All gates positioned at (x, y) origin
 * - Standard dimensions: 60x40 (width x height)
 * - Input legs: x=-10 to x=0, at y=10 and y=30 for dual-input gates
 * - Single input: x=-10 to x=0, at y=20
 * - Output leg: extends to x=60, at y=20
 * - Gate body: x=0 to x=~45 (varies by gate type)
 * 
 * This contract ensures wires connect to the correct port positions.
 */
const GateSymbols: React.FC<{
  type: string;
  x: number;
  y: number;
  signal?: Signal;
}> = ({ type, x, y, signal }) => {
  const activeColor = signal === 1 ? '#22c55e' : '#6b7280';
  const strokeWidth = 2;

  // Standard dimensions for gates: 60x40 roughly.
  // We want inputs to be accessible from the left (approx x=0)
  // And output to be at the right (approx x=60)

  // Helper for input legs
  const InputLegs = () => (
    <>
      <path d="M -10,10 L 0,10" stroke={activeColor} strokeWidth={strokeWidth} fill="none" />
      <path d="M -10,30 L 0,30" stroke={activeColor} strokeWidth={strokeWidth} fill="none" />
    </>
  );

  const SingleInputLeg = () => (
    <path d="M -10,20 L 0,20" stroke={activeColor} strokeWidth={strokeWidth} fill="none" />
  );

  switch (type) {
    case 'AND':
      return (
        <g transform={`translate(${x},${y})`}>
          <InputLegs />
          <path
            d="M 0,0 L 25,0 A 20,20 0 0,1 25,40 L 0,40 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          {/* Output leg */}
          <line x1="45" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'OR':
      return (
        <g transform={`translate(${x},${y})`}>
          <InputLegs />
          {/* OR shape: Curved back, pointed front */}
          <path
            d="M 0,0 Q 25,5 35,20 Q 25,35 0,40 Q 10,20 0,0 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <line x1="35" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'NOT':
    case 'Inverter':
      return (
        <g transform={`translate(${x},${y})`}>
          <SingleInputLeg />
          {/* Triangle */}
          <path
            d="M 0,0 L 0,40 L 32,20 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          {/* Bubble at tip - radius 4 */}
          <circle cx="36" cy="20" r="4" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <line x1="40" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'NAND':
      return (
        <g transform={`translate(${x},${y})`}>
          <InputLegs />
          {/* AND shape */}
          <path
            d="M 0,0 L 25,0 A 20,20 0 0,1 25,40 L 0,40 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          {/* Bubble */}
          <circle cx="49" cy="20" r="4" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <line x1="53" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'NOR':
      return (
        <g transform={`translate(${x},${y})`}>
          <InputLegs />
          <path
            d="M 0,0 Q 25,5 35,20 Q 25,35 0,40 Q 10,20 0,0 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          {/* Bubble */}
          <circle cx="39" cy="20" r="4" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <line x1="43" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'XOR':
      return (
        <g transform={`translate(${x},${y})`}>
          <InputLegs />
          {/* First curve (back input guard) */}
          <path
            d="M -5,0 Q 5,20 -5,40"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          {/* Main Body */}
          <path
            d="M 0,0 Q 25,5 35,20 Q 25,35 0,40 Q 10,20 0,0"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <line x1="35" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'XNOR':
      return (
        <g transform={`translate(${x},${y})`}>
          <InputLegs />
          <path
            d="M -5,0 Q 5,20 -5,40"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <path
            d="M 0,0 Q 25,5 35,20 Q 25,35 0,40 Q 10,20 0,0"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="39" cy="20" r="4" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <line x1="43" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'Switch':
      return (
        <g transform={`translate(${x},${y})`}>
          <rect
            x="0"
            y="10"
            width="40"
            height="20"
            rx="4"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="20" cy="20" r="6" fill={activeColor} />
          <text x="20" y="25" textAnchor="middle" fontSize="10" fill={activeColor} style={{ pointerEvents: 'none' }}>
            SW
          </text>
          <line x1="40" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'Clock':
      return (
        <g transform={`translate(${x},${y})`}>
          <rect
            x="0"
            y="10"
            width="40"
            height="20"
            rx="4"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <path
            d="M 8,20 L 8,25 L 16,25 L 16,15 L 24,15 L 24,25 L 32,25 L 32,20"
            fill="none"
            stroke={activeColor}
            strokeWidth={1.5}
          />
          <line x1="40" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    case 'LED':
      return (
        <g transform={`translate(${x},${y})`}>
          <SingleInputLeg />
          <circle cx="20" cy="20" r="12" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <circle cx="20" cy="20" r="8" fill={signal === 1 ? activeColor : 'none'} opacity="0.6" />
          <text x="20" y="25" textAnchor="middle" fontSize="10" fill={activeColor} style={{ pointerEvents: 'none' }}>
            LED
          </text>
        </g>
      );

    case 'Probe':
      return (
        <g transform={`translate(${x},${y})`}>
          <SingleInputLeg />
          <path
            d="M 10,20 L 30,20 M 20,10 L 20,30"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="20" cy="20" r="15" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );

    default:
      // Generic box for unknown components
      return (
        <g transform={`translate(${x},${y})`}>
          <InputLegs />
          <rect
            x="0"
            y="5"
            width="50"
            height="30"
            rx="4"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <text x="25" y="23" textAnchor="middle" fontSize="9" fill={activeColor} style={{ pointerEvents: 'none' }}>
            {type}
          </text>
          <line x1="50" y1="20" x2="60" y2="20" stroke={activeColor} strokeWidth={strokeWidth} />
        </g>
      );
  }
};

/**
 * Simple orthogonal wire routing
 */
const routeWire = (
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  points.push(from);

  // Manhattan routing (orthogonal)
  const midX = (from.x + to.x) / 2;

  // Route horizontally first, then vertically
  points.push({ x: midX, y: from.y });
  points.push({ x: midX, y: to.y });
  points.push(to);

  return points;
};

export const SchematicView: React.FC<SchematicViewProps> = ({
  circuit,
  engine,
  isRunning,
  width = 800,
  height = 600,
  onCircuitChange,
  showHints = true,
  onDismissHints,
  onHelp,
  probeWireHighlights,
  mismatchWireHighlights,
  mismatchNodeIds,
  mismatchPortKeys,
  debugSignals,
  debugTick,
  isReplayMode = false,
}) => {
  trackRender('SchematicView');
  const uiTick = useUiTickStore((state) => state.uiTick);
  const [signals, setSignals] = React.useState<Map<string, Signal>>(new Map());
  const renderSignals = debugSignals ?? signals;
  const updateCircuit = useCircuitStore((state) => state.updateCircuit);

  // Camera state for pan/zoom
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // Editing state - must be declared before useMemo hooks that reference hoveredNodeId
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wireStartPort, setWireStartPort] = useState<PortRef | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const debugPortValues = useMemo(() => {
    if (!debugSignals || !hoveredNodeId) return null;
    const entries = Array.from(debugSignals.entries())
      .filter(([key]) => key.startsWith(`${hoveredNodeId}.`))
      .map(([key, value]) => ({
        portName: key.slice(hoveredNodeId.length + 1),
        value,
      }))
      .sort((a, b) => a.portName.localeCompare(b.portName));
    return entries.length > 0 ? entries : null;
  }, [debugSignals, hoveredNodeId]);

  const mismatchPortsByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!mismatchPortKeys) return map;
    mismatchPortKeys.forEach((key) => {
      const [nodeId, portName] = key.split(':');
      if (!nodeId || !portName) return;
      const list = map.get(nodeId) ?? [];
      list.push(portName);
      map.set(nodeId, list);
    });
    return map;
  }, [mismatchPortKeys]);

  const isOutputPort = (portName: string) => /^(out|q|y)/i.test(portName);

  const svgRef = useRef<SVGSVGElement>(null);

  // Get global selection state (per-field selectors to avoid unstable object refs)
  // selector-ok: per-field selectors, stable refs, no object literals
  const selectedNodeIds = useViewStateStore((state) => state.selectedNodeIds);
  const selectNodes = useViewStateStore((state) => state.selectNodes);

  // Update signals on UI ticks
  React.useEffect(() => {
    if (debugSignals) return;
    if (!isRunning) {
      setSignals(new Map());
      return;
    }
    setSignals(engine.getAllSignals());
  }, [uiTick, isRunning, engine, debugSignals]);

  // Non-passive wheel event listener for zooming (React 19 compatibility)
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.max(0.25, Math.min(4, camera.zoom * (1 + delta)));

      // Zoom towards cursor
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = (mouseX - camera.x) / camera.zoom;
      const worldY = (mouseY - camera.y) / camera.zoom;

      setCamera({
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom,
        zoom: newZoom,
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [camera]);

  // Mouse handlers for pan/zoom
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isReplayMode) return;
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Middle mouse or shift+click for panning
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0) {
      // Left click on background clears selection
      selectNodes([], false);
      setWireStartPort(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isReplayMode) return;
    if (isPanning) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setCamera((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }

    if (draggingNodeId && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - camera.x) / camera.zoom - dragOffset.x;
      const y = (e.clientY - rect.top - camera.y) / camera.zoom - dragOffset.y;

      // Update node position
      const updatedCircuit = {
        ...circuit,
        nodes: circuit.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, position: { x, y } } : n
        ),
      };

      // Use store-based update instead of callback to avoid closure issues
      updateCircuit(updatedCircuit);
      // Also call the callback if provided for backward compatibility
      onCircuitChange?.(updatedCircuit);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (isReplayMode) return;
    e.stopPropagation();

    if (e.button === 0 && !e.shiftKey) {
      // Start dragging
      const node = circuit.nodes.find((n) => n.id === nodeId);
      if (node && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        setDraggingNodeId(nodeId);
        setDragOffset({
          x: mouseX - node.position.x,
          y: mouseY - node.position.y,
        });

        // Select the node
        selectNodes([nodeId], e.ctrlKey || e.metaKey);
      }
    }
  };

  // Layout nodes using circuit positions
  const schematicNodes = useMemo<SchematicNode[]>(() => {
    return circuit.nodes.map((node) => ({
      id: node.id,
      x: Number.isFinite(node.position?.x) ? node.position.x : 0,
      y: Number.isFinite(node.position?.y) ? node.position.y : 0,
      type: node.type,
      symbol: node.type,
    }));
  }, [circuit.nodes]);

  const viewBounds = useMemo(
    () => getSchematicViewBounds(camera, width, height),
    [camera, width, height]
  );

  // Viewport culling is render-only; interaction/selection always uses full schematicNodes.
  const visibleNodes = useMemo(
    () => getVisibleSchematicNodes(schematicNodes, viewBounds),
    [schematicNodes, viewBounds]
  );

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const fitToView = React.useCallback(() => {
    if (circuit.nodes.length === 0) return;

    // Guard: ensure dimensions are valid before calculating camera
    if (width === 0 || height === 0) return;

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    circuit.nodes.forEach((node) => {
      // Guard: ensure positions are finite
      if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) return;

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
  }, [circuit.nodes, width, height]);

  const resetView = React.useCallback(() => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  }, []);

  // Auto-center and fit circuit in view on load
  React.useEffect(() => {
    fitToView();
  }, [fitToView]);

  // Route wires between nodes
  const schematicWires = useMemo<SchematicWire[]>(() => {
    mark('schematic-wire-layout-start');
    const wires = circuit.connections
      .filter(
        (conn) => visibleNodeIds.has(conn.from.nodeId) || visibleNodeIds.has(conn.to.nodeId)
      )
      .map((conn) => {
        const wireId = `${conn.from.nodeId}.${conn.from.portName}-${conn.to.nodeId}.${conn.to.portName}`;
        const fromNode = schematicNodes.find((n) => n.id === conn.from.nodeId);
        const toNode = schematicNodes.find((n) => n.id === conn.to.nodeId);

        if (!fromNode || !toNode) {
          return {
            id: wireId,
            from: { x: 0, y: 0 },
            to: { x: 0, y: 0 },
            signal: 0,
            points: [],
          };
        }

        // Use port-aware positions
        // Output ports are on the right (x=60), input ports on the left (x=-10)
        const fromCircuitNode = circuit.nodes.find((n) => n.id === conn.from.nodeId);
        const toCircuitNode = circuit.nodes.find((n) => n.id === conn.to.nodeId);

        // Get all port positions for both nodes
        const fromPorts = fromCircuitNode ? getPortPositions(fromCircuitNode, fromNode.x, fromNode.y) : [];
        const toPorts = toCircuitNode ? getPortPositions(toCircuitNode, toNode.x, toNode.y) : [];

        // Find the specific ports for this connection
        const fromPort = fromPorts.find(p => p.portName === conn.from.portName);
        const toPort = toPorts.find(p => p.portName === conn.to.portName);

        // Fallback to generic positions if ports not found
        const from = fromPort ? { x: fromPort.x, y: fromPort.y } : { x: fromNode.x + 60, y: fromNode.y + 20 };
        const to = toPort ? { x: toPort.x, y: toPort.y } : { x: toNode.x - 10, y: toNode.y + 20 };

        const signalKey = `${conn.from.nodeId}.${conn.from.portName}`;
        const signal = renderSignals.get(signalKey) ?? 0;

        return {
          id: wireId,
          from,
          to,
          signal,
          points: routeWire(from, to),
          probeColors: probeWireHighlights?.get(wireId),
          mismatchColors: mismatchWireHighlights?.get(wireId),
        };
      });
    mark('schematic-wire-layout-end');
    measure('schematic-wire-layout', 'schematic-wire-layout-start', 'schematic-wire-layout-end');
    return wires;
  }, [
    circuit.connections,
    circuit.nodes,
    schematicNodes,
    visibleNodeIds,
    renderSignals,
    probeWireHighlights,
    mismatchWireHighlights,
  ]);

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col overflow-hidden">
      {/* Compact header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">Schematic View</h2>
          <div className="text-[10px] text-gray-500">IEEE/ANSI symbols</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" data-testid="schematic-micro-toolbar">
            <button
              onClick={fitToView}
              className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
              title="Fit to view"
              type="button"
            >
              F
            </button>
            <button
              onClick={resetView}
              className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
              title="Reset view"
              type="button"
            >
              0
            </button>
            {onHelp && (
              <button
                onClick={onHelp}
                className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
                title="Schematic controls"
                type="button"
              >
                ?
              </button>
            )}
          </div>
          <div className="text-xs text-gray-400">
            {circuit.nodes.length} components | {circuit.connections.length} connections
          </div>
        </div>
      </div>

      {/* SVG canvas fills remaining space */}
      <div className="flex-1 relative">
        {/* Interaction hints */}
        {circuit.nodes.length === 0 && showHints && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-gray-800/90 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 space-y-2 max-w-sm pointer-events-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-white">📐 Schematic View</div>
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
              <div><span className="text-cyan-400">Drag nodes:</span> Reposition components</div>
              <div><span className="text-cyan-400">Click node:</span> Select (syncs to all views)</div>
              <div><span className="text-cyan-400">Shift+Drag:</span> Pan view</div>
              <div><span className="text-cyan-400">Scroll:</span> Zoom</div>
              <div className="pt-2 border-t border-gray-700 text-gray-500">
                Add components in Circuit view to see them here!
              </div>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          width={width}
          height={height - 42}
          className="absolute inset-0 bg-gray-850"
          style={{ cursor: isPanning ? 'grabbing' : draggingNodeId ? 'move' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Grid pattern */}
          <defs>
            <pattern
              id="schematic-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="#374151" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#schematic-grid)" />

          {/* Camera transform group */}
          <g transform={`translate(${Number.isFinite(camera.x) ? camera.x : 0},${Number.isFinite(camera.y) ? camera.y : 0}) scale(${Number.isFinite(camera.zoom) ? camera.zoom : 1})`}>
            {/* Render wires */}
            <g className="wires">
              {schematicWires.map((wire, i) => {
                const pathData = wire.points
                  .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
                  .join(' ');

                const wireColor = isRunning
                  ? wire.signal === 1
                    ? '#22c55e'
                    : '#6b7280'
                  : '#9ca3af';

                return (
                  <g key={i}>
                    {wire.probeColors?.map((color, index) => (
                      <path
                        key={`${wire.id}-probe-${index}`}
                        d={pathData}
                        stroke={color}
                        strokeWidth="5"
                        opacity="0.25"
                        fill="none"
                      />
                    ))}
                    {wire.mismatchColors?.map((color, index) => (
                      <path
                        key={`${wire.id}-mismatch-${index}`}
                        d={pathData}
                        stroke={color}
                        strokeWidth="6"
                        opacity="0.35"
                        fill="none"
                      />
                    ))}
                    <path
                      d={pathData}
                      stroke={wireColor}
                      strokeWidth="2"
                      fill="none"
                      className="transition-colors duration-100"
                    />
                    {/* Connection dots */}
                    {wire.points.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r="2"
                        fill={wireColor}
                        className="transition-colors duration-100"
                      />
                    ))}
                  </g>
                );
              })}
            </g>

            {/* Render components */}
            <g className="components">
              {visibleNodes.map((node) => {
                const outputSignal =
                  renderSignals.get(`${node.id}.out`) ??
                  renderSignals.get(`${node.id}.in`) ??
                  0;
                const isSelected = selectedNodeIds.has(node.id);
                const isMismatchHighlighted = mismatchNodeIds?.has(node.id) ?? false;

                return (
                  <g key={node.id}>
                    {/* Selection highlight */}
                    {isSelected && (
                      <rect
                        x={node.x - 10}
                        y={node.y - 10}
                        width="70"
                        height="60"
                        rx="4"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        opacity="0.5"
                      />
                    )}
                    {isMismatchHighlighted && (
                      <rect
                        x={node.x - 12}
                        y={node.y - 12}
                        width="74"
                        height="64"
                        rx="6"
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2"
                        opacity="0.7"
                      />
                    )}

                    {/* Interactive hit-box */}
                    <rect
                      x={node.x - 5}
                      y={node.y - 5}
                      width="60"
                      height="50"
                      fill="transparent"
                      style={{ cursor: 'move' }}
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                      onMouseEnter={() => {
                        if (debugSignals) setHoveredNodeId(node.id);
                      }}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    />

                    <GateSymbols
                      type={node.type}
                      x={node.x}
                      y={node.y}
                      signal={outputSignal}
                    />

                    {mismatchPortsByNode.get(node.id)?.map((portName, index) => {
                      const outputSide = isOutputPort(portName);
                      const xPos = outputSide ? node.x + 58 : node.x - 8;
                      const yPos = node.y + 18 + index * 8;
                      return (
                        <circle
                          key={`${node.id}-${portName}`}
                          cx={xPos}
                          cy={yPos}
                          r={4}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth={2}
                          className="animate-pulse"
                          opacity={0.9}
                        />
                      );
                    })}

                    {debugSignals && hoveredNodeId === node.id && debugPortValues && (
                      <g transform={`translate(${node.x + 50}, ${node.y - 16})`}>
                        <rect
                          x={0}
                          y={0}
                          width={70}
                          height={Math.max(18, debugPortValues.length * 12 + 12)}
                          rx={4}
                          fill="#0f172a"
                          stroke="#22d3ee"
                          strokeWidth={1}
                          opacity={0.9}
                        />
                        <text
                          x={6}
                          y={10}
                          fontSize="9"
                          fill="#7dd3fc"
                          fontFamily="monospace"
                        >
                          t{debugTick ?? '-'}
                        </text>
                        {debugPortValues.map((entry, idx) => (
                          <text
                            key={`${entry.portName}-${idx}`}
                            x={6}
                            y={22 + idx * 11}
                            fontSize="9"
                            fill={entry.value === 1 ? '#22c55e' : '#9ca3af'}
                            fontFamily="monospace"
                          >
                            {entry.portName}: {entry.value}
                          </text>
                        ))}
                      </g>
                    )}

                    {/* Node label */}
                    <text
                      x={node.x + 25}
                      y={node.y - 8}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#9ca3af"
                      className="select-none pointer-events-none"
                    >
                      {node.type}
                    </text>
                  </g>
                );
              })}
            </g>
          </g> {/* End camera transform */}
        </svg>
      </div>

      {/* Compact legend */}
      <div className="px-3 py-2 bg-gray-800 border-t border-gray-700 shrink-0">
        <div className="text-xs text-gray-400 flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-green-500"></div>
            HIGH
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-gray-500"></div>
            LOW
          </span>
          <span className="text-gray-500">IEEE/ANSI symbols • Pan: Shift+Drag • Zoom: Scroll</span>
        </div>
      </div>
    </div>
  );
};
