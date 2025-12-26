// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Node } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';

export interface ChipMetadata {
  name: string;
  inputs: Array<{ id: string; name: string }>;
  outputs: Array<{ id: string; name: string }>;
  color?: string;
  layer?: number;
}

export interface NodeViewProps {
  node: Node;
  camera: Camera;
  isSelected: boolean;
  onSelect: (nodeId: string, addToSelection: boolean) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onPortClick?: (nodeId: string, portName: string) => void;
  signals?: Map<string, 0 | 1>;
  chipMetadata?: ChipMetadata; // Metadata for custom chips
}

const NODE_COLORS: Record<string, string> = {
  PowerSource: '#4ade80',
  Switch: '#60a5fa',
  Lamp: '#fbbf24',
  Wire: '#94a3b8',
  AND: '#c084fc',
  OR: '#f472b6',
  NOT: '#fb923c',
  NAND: '#a78bfa',
  XOR: '#ec4899',
  Clock: '#22d3ee',
  Delay: '#a3e635',
  FullAdder: '#818cf8',
  RSLatch: '#f87171',
  DFlipFlop: '#34d399',
  JKFlipFlop: '#fcd34d',
  Counter4Bit: '#e879f9',
};

export const NodeView: React.FC<NodeViewProps> = ({
  node,
  camera,
  isSelected,
  onSelect,
  onMove,
  onPortClick,
  signals,
  chipMetadata,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const screenX = node.position.x * camera.zoom + camera.x;
  const screenY = node.position.y * camera.zoom + camera.y;
  const size = 48 * camera.zoom;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });

    onSelect(node.id, e.shiftKey);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = (e.clientX - dragStart.x) / camera.zoom;
    const dy = (e.clientY - dragStart.y) / camera.zoom;

    onMove(node.id, node.position.x + dx, node.position.y + dy);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const color = NODE_COLORS[node.type] || '#94a3b8';
  const isActive = signals?.get(`${node.id}.out`) === 1;
  const isChip = !!chipMetadata;

  // Render custom chip with black-box appearance
  if (isChip && chipMetadata) {
    const chipColor = chipMetadata.color || '#1e293b'; // Dark slate for chips
    const chipHeight = size * 1.5; // Taller for chips with multiple ports
    const portSpacing = chipHeight / (Math.max(chipMetadata.inputs.length, chipMetadata.outputs.length) + 1);

    return (
      <g
        transform={`translate(${screenX}, ${screenY}) rotate(${node.rotation})`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Chip body - black box appearance */}
        <rect
          x={-size / 2}
          y={-chipHeight / 2}
          width={size}
          height={chipHeight}
          fill={chipColor}
          stroke={isSelected ? '#3b82f6' : '#475569'}
          strokeWidth={isSelected ? 3 : 2}
          rx={6}
        />

        {/* Chip icon - small circuit pattern */}
        <circle cx={0} cy={-chipHeight / 4} r={3} fill="#64748b" opacity={0.5} />
        <circle cx={-6} cy={chipHeight / 4} r={2} fill="#64748b" opacity={0.5} />
        <circle cx={6} cy={chipHeight / 4} r={2} fill="#64748b" opacity={0.5} />
        <line x1={0} y1={-chipHeight / 4 + 3} x2={-6} y2={chipHeight / 4 - 2} stroke="#64748b" strokeWidth={1} opacity={0.3} />
        <line x1={0} y1={-chipHeight / 4 + 3} x2={6} y2={chipHeight / 4 - 2} stroke="#64748b" strokeWidth={1} opacity={0.3} />

        {/* Chip label */}
        <text
          x={0}
          y={chipHeight / 2 + 12}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={Math.max(8, 10 * camera.zoom)}
          fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {chipMetadata.name}
        </text>

        {/* Layer badge */}
        {chipMetadata.layer !== undefined && (
          <text
            x={0}
            y={-chipHeight / 2 - 8}
            textAnchor="middle"
            fill="#64748b"
            fontSize={Math.max(7, 8 * camera.zoom)}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            L{chipMetadata.layer}
          </text>
        )}

        {/* Input ports */}
        {chipMetadata.inputs.map((input, i) => {
          const yPos = -chipHeight / 2 + portSpacing * (i + 1);
          return (
            <g key={`input-${input.id}`}>
              <circle
                cx={-size / 2}
                cy={yPos}
                r={4}
                fill="#3b82f6"
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: 'crosshair' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPortClick?.(node.id, input.id);
                }}
              />
              <text
                x={-size / 2 - 8}
                y={yPos}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#94a3b8"
                fontSize={Math.max(6, 8 * camera.zoom)}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {input.name}
              </text>
            </g>
          );
        })}

        {/* Output ports */}
        {chipMetadata.outputs.map((output, i) => {
          const yPos = -chipHeight / 2 + portSpacing * (i + 1);
          const outputSignal = signals?.get(`${node.id}.${output.id}`) === 1;
          return (
            <g key={`output-${output.id}`}>
              <circle
                cx={size / 2}
                cy={yPos}
                r={4}
                fill={outputSignal ? '#22c55e' : '#6b7280'}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: 'crosshair' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPortClick?.(node.id, output.id);
                }}
              />
              <text
                x={size / 2 + 8}
                y={yPos}
                textAnchor="start"
                dominantBaseline="middle"
                fill="#94a3b8"
                fontSize={Math.max(6, 8 * camera.zoom)}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {output.name}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  // Standard node rendering
  return (
    <g
      transform={`translate(${screenX}, ${screenY}) rotate(${node.rotation})`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Node body */}
      <rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        fill={isActive ? color : '#2a2a2a'}
        stroke={isSelected ? '#3b82f6' : color}
        strokeWidth={isSelected ? 3 : 1}
        rx={4}
      />

      {/* Node label */}
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize={Math.max(10, 12 * camera.zoom)}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.type}
      </text>

      {/* Input port */}
      {!['PowerSource', 'Clock'].includes(node.type) && (
        <circle
          cx={-size / 2}
          cy={0}
          r={4}
          fill="#3b82f6"
          stroke="#fff"
          strokeWidth={1}
          style={{ cursor: 'crosshair' }}
          onClick={(e) => {
            e.stopPropagation();
            onPortClick?.(node.id, 'in');
          }}
        />
      )}

      {/* Output port */}
      {!['Lamp'].includes(node.type) && (
        <circle
          cx={size / 2}
          cy={0}
          r={4}
          fill={isActive ? '#22c55e' : '#6b7280'}
          stroke="#fff"
          strokeWidth={1}
          style={{ cursor: 'crosshair' }}
          onClick={(e) => {
            e.stopPropagation();
            onPortClick?.(node.id, 'out');
          }}
        />
      )}
    </g>
  );
};
