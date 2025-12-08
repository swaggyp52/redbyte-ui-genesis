// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Node } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';

export interface NodeViewProps {
  node: Node;
  camera: Camera;
  isSelected: boolean;
  onSelect: (nodeId: string, addToSelection: boolean) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onPortClick?: (nodeId: string, portName: string) => void;
  signals?: Map<string, 0 | 1>;
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
