// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useState, useRef } from 'react';
import type { Circuit, Node, Connection, Signal, PortRef } from '@redbyte/rb-logic-core';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { useViewStateStore } from '../stores/viewStateStore';
import { getPortPositions, findNearestPort, type PortPosition } from './schematic/SchematicPortDetector';

interface SchematicViewProps {
  circuit: Circuit;
  engine: CircuitEngine;
  isRunning: boolean;
  width?: number;
  height?: number;
  onCircuitChange?: (circuit: Circuit) => void;
}

interface SchematicNode {
  id: string;
  x: number;
  y: number;
  type: string;
  symbol: string;
}

interface SchematicWire {
  from: { x: number; y: number };
  to: { x: number; y: number };
  signal: Signal;
  points: { x: number; y: number }[];
}

/**
 * IEEE/ANSI standard logic gate symbols
 */
const GateSymbols: React.FC<{
  type: string;
  x: number;
  y: number;
  signal?: Signal;
}> = ({ type, x, y, signal }) => {
  const activeColor = signal === 1 ? '#22c55e' : '#6b7280';
  const strokeWidth = 2;

  switch (type) {
    case 'AND':
      return (
        <g transform={`translate(${x},${y})`}>
          <path
            d="M 0,0 L 0,40 L 20,40 A 20,20 0 0,0 20,0 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="45" cy="20" r="3" fill={activeColor} />
        </g>
      );

    case 'OR':
      return (
        <g transform={`translate(${x},${y})`}>
          <path
            d="M 0,0 Q 10,20 0,40 L 10,40 Q 35,30 40,20 Q 35,10 10,0 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="45" cy="20" r="3" fill={activeColor} />
        </g>
      );

    case 'NOT':
    case 'Inverter':
      return (
        <g transform={`translate(${x},${y})`}>
          <path
            d="M 0,0 L 0,40 L 30,20 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="35" cy="20" r="4" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <circle cx="42" cy="20" r="3" fill={activeColor} />
        </g>
      );

    case 'NAND':
      return (
        <g transform={`translate(${x},${y})`}>
          <path
            d="M 0,0 L 0,40 L 20,40 A 20,20 0 0,0 20,0 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="42" cy="20" r="4" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <circle cx="50" cy="20" r="3" fill={activeColor} />
        </g>
      );

    case 'NOR':
      return (
        <g transform={`translate(${x},${y})`}>
          <path
            d="M 0,0 Q 10,20 0,40 L 10,40 Q 35,30 40,20 Q 35,10 10,0 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="42" cy="20" r="4" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <circle cx="50" cy="20" r="3" fill={activeColor} />
        </g>
      );

    case 'XOR':
      return (
        <g transform={`translate(${x},${y})`}>
          <path
            d="M -5,0 Q 5,20 -5,40"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <path
            d="M 0,0 Q 10,20 0,40 L 10,40 Q 35,30 40,20 Q 35,10 10,0 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="45" cy="20" r="3" fill={activeColor} />
        </g>
      );

    case 'XNOR':
      return (
        <g transform={`translate(${x},${y})`}>
          <path
            d="M -5,0 Q 5,20 -5,40"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <path
            d="M 0,0 Q 10,20 0,40 L 10,40 Q 35,30 40,20 Q 35,10 10,0 Z"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx="42" cy="20" r="4" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <circle cx="50" cy="20" r="3" fill={activeColor} />
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
          <text x="20" y="25" textAnchor="middle" fontSize="10" fill={activeColor}>
            SW
          </text>
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
        </g>
      );

    case 'LED':
      return (
        <g transform={`translate(${x},${y})`}>
          <circle cx="20" cy="20" r="12" fill="none" stroke={activeColor} strokeWidth={strokeWidth} />
          <circle cx="20" cy="20" r="8" fill={signal === 1 ? activeColor : 'none'} opacity="0.6" />
          <text x="20" y="25" textAnchor="middle" fontSize="10" fill={activeColor}>
            LED
          </text>
        </g>
      );

    case 'Probe':
      return (
        <g transform={`translate(${x},${y})`}>
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
          <text x="25" y="23" textAnchor="middle" fontSize="9" fill={activeColor}>
            {type}
          </text>
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
}) => {
  const [signals, setSignals] = React.useState<Map<string, Signal>>(new Map());

  // Camera state for pan/zoom
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // Editing state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wireStartPort, setWireStartPort] = useState<PortRef | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // Get global selection state
  const { selectedNodeIds, selectNodes } = useViewStateStore();

  // Update signals in real-time
  React.useEffect(() => {
    if (!isRunning) {
      setSignals(new Map());
      return;
    }

    const interval = setInterval(() => {
      setSignals(engine.getAllSignals());
    }, 50);

    return () => clearInterval(interval);
  }, [isRunning, engine]);

  // Mouse handlers for pan/zoom
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
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

      if (onCircuitChange) {
        onCircuitChange(updatedCircuit);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(0.25, Math.min(4, camera.zoom * (1 + delta)));

    // Zoom towards cursor
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = newZoom / camera.zoom;
      const newX = mouseX - (mouseX - camera.x) * zoomFactor;
      const newY = mouseY - (mouseY - camera.y) * zoomFactor;

      setCamera({ x: newX, y: newY, zoom: newZoom });
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
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
      x: node.position.x,
      y: node.position.y,
      type: node.type,
      symbol: node.type,
    }));
  }, [circuit.nodes]);

  // Auto-center and fit circuit in view on load
  React.useEffect(() => {
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
  }, [circuit.nodes.length, width, height]);

  // Route wires between nodes
  const schematicWires = useMemo<SchematicWire[]>(() => {
    return circuit.connections.map((conn) => {
      const fromNode = schematicNodes.find((n) => n.id === conn.from.nodeId);
      const toNode = schematicNodes.find((n) => n.id === conn.to.nodeId);

      if (!fromNode || !toNode) {
        return {
          from: { x: 0, y: 0 },
          to: { x: 0, y: 0 },
          signal: 0,
          points: [],
        };
      }

      // Output port on right side, input port on left side
      const from = { x: fromNode.x + 60, y: fromNode.y + 20 };
      const to = { x: toNode.x - 10, y: toNode.y + 20 };

      const signalKey = `${conn.from.nodeId}.${conn.from.portName}`;
      const signal = signals.get(signalKey) ?? 0;

      return {
        from,
        to,
        signal,
        points: routeWire(from, to),
      };
    });
  }, [circuit.connections, schematicNodes, signals]);

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col overflow-hidden">
      {/* Compact header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700 shrink-0">
        <h2 className="text-sm font-semibold text-white">Schematic View</h2>
        <div className="text-xs text-gray-400">
          {circuit.nodes.length} components • {circuit.connections.length} connections
        </div>
      </div>

      {/* SVG canvas fills remaining space */}
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          width={width}
          height={height - 42}
          className="absolute inset-0 bg-gray-850"
          style={{ cursor: isPanning ? 'grabbing' : draggingNodeId ? 'move' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
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
          <g transform={`translate(${camera.x},${camera.y}) scale(${camera.zoom})`}>
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
              {schematicNodes.map((node) => {
                const nodeSignals = engine.getNodeOutputs(node.id);
                const outputSignal = Object.values(nodeSignals)[0] ?? 0;
                const isSelected = selectedNodeIds.has(node.id);

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

                    {/* Interactive hit-box */}
                    <rect
                      x={node.x - 5}
                      y={node.y - 5}
                      width="60"
                      height="50"
                      fill="transparent"
                      style={{ cursor: 'move' }}
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    />

                    <GateSymbols
                      type={node.type}
                      x={node.x}
                      y={node.y}
                      signal={isRunning ? outputSignal : undefined}
                    />

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
