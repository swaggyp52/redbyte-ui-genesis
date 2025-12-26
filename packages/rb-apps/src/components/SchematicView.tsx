// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import type { Circuit, Node, Connection, Signal } from '@redbyte/rb-logic-core';
import { CircuitEngine } from '@redbyte/rb-logic-core';

interface SchematicViewProps {
  circuit: Circuit;
  engine: CircuitEngine;
  isRunning: boolean;
  width?: number;
  height?: number;
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
}) => {
  const [signals, setSignals] = React.useState<Map<string, Signal>>(new Map());

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

  // Layout nodes in a simple grid-based layout
  const schematicNodes = useMemo<SchematicNode[]>(() => {
    // Use the circuit's existing positions but scale them for schematic view
    return circuit.nodes.map((node) => ({
      id: node.id,
      x: node.x * 0.8 + 100, // Scale and offset for better spacing
      y: node.y * 0.8 + 50,
      type: node.type,
      symbol: node.type,
    }));
  }, [circuit.nodes]);

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
    <div className="w-full h-full bg-gray-900 overflow-auto">
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Schematic View</h2>
          <div className="text-xs text-gray-400">
            {circuit.nodes.length} components • {circuit.connections.length} connections
          </div>
        </div>

        <svg
          width={Math.max(width, 1200)}
          height={Math.max(height, 800)}
          className="border border-gray-700 rounded bg-gray-850"
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

              return (
                <g key={node.id}>
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
                    className="select-none"
                  >
                    {node.type}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
          <div className="text-xs text-gray-300 space-y-1">
            <div className="font-semibold mb-2">Schematic View Features:</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-green-500"></div>
              <span>Active signal (logic HIGH)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gray-500"></div>
              <span>Inactive signal (logic LOW)</span>
            </div>
            <div className="mt-2 text-gray-400">
              IEEE/ANSI standard symbols with real-time signal visualization
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
