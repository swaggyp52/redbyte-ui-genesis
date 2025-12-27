// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Node, PortRef } from '@redbyte/rb-logic-core';
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
  onToggleSwitch?: (nodeId: string) => void; // Toggle switch state
  onNodeDoubleClick?: (nodeId: string) => void; // Double-click to drill into chip
  signals?: Map<string, 0 | 1>;
  chipMetadata?: ChipMetadata; // Metadata for custom chips
  wireStartPort?: PortRef; // Port where wire drawing started
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
  onToggleSwitch,
  onNodeDoubleClick,
  signals,
  chipMetadata,
  wireStartPort,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = React.useState({ x: node.position.x, y: node.position.y });
  const [hoveredPort, setHoveredPort] = React.useState<string | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  const screenX = (isDragging ? dragPosition.x : node.position.x) * camera.zoom + camera.x;
  const screenY = (isDragging ? dragPosition.y : node.position.y) * camera.zoom + camera.y;
  const size = 48 * camera.zoom;

  const isSwitch = node.type === 'Switch' || node.type === 'INPUT';
  const switchState = node.state?.isOn ?? 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragPosition({ x: node.position.x, y: node.position.y });

    onSelect(node.id, e.shiftKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSwitch && onToggleSwitch) {
      onToggleSwitch(node.id);
    } else if (onNodeDoubleClick) {
      onNodeDoubleClick(node.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = (e.clientX - dragStart.x) / camera.zoom;
    const dy = (e.clientY - dragStart.y) / camera.zoom;

    // Update local position immediately for smooth dragging
    setDragPosition({
      x: node.position.x + dx,
      y: node.position.y + dy,
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Commit the final position when drag ends
      onMove(node.id, dragPosition.x, dragPosition.y);
    }
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        // Commit the final position when drag ends
        onMove(node.id, dragPosition.x, dragPosition.y);
        setIsDragging(false);
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging, dragPosition, node.id, onMove]);

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
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Chip body - black box appearance */}
        <rect
          x={-size / 2}
          y={-chipHeight / 2}
          width={size}
          height={chipHeight}
          fill={chipColor}
          stroke={isSelected ? '#3b82f6' : isHovered ? '#8b5cf6' : '#475569'}
          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
          rx={6}
        />

        {/* Hover hint - double-click to drill down */}
        {isHovered && onNodeDoubleClick && (
          <text
            x={0}
            y={-chipHeight / 2 - 8}
            textAnchor="middle"
            fill="#8b5cf6"
            fontSize={9}
            fontWeight="500"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            Double-click to explore
          </text>
        )}

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
          const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === input.id;
          const isHovered = hoveredPort === input.id;
          const shouldGlow = isWireStart || (isHovered && wireStartPort);

          return (
            <g key={`input-${input.id}`}>
              {shouldGlow && (
                <circle
                  cx={-size / 2}
                  cy={yPos}
                  r={8}
                  fill="#00ffff"
                  opacity={0.4}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              <circle
                cx={-size / 2}
                cy={yPos}
                r={4}
                fill={isWireStart ? "#00ffff" : "#3b82f6"}
                stroke="#fff"
                strokeWidth={isHovered ? 2 : 1}
                style={{ cursor: 'crosshair' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPortClick?.(node.id, input.id);
                }}
                onMouseEnter={() => setHoveredPort(input.id)}
                onMouseLeave={() => setHoveredPort(null)}
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
          const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === output.id;
          const isHovered = hoveredPort === output.id;
          const shouldGlow = isWireStart || (isHovered && wireStartPort);

          return (
            <g key={`output-${output.id}`}>
              {shouldGlow && (
                <circle
                  cx={size / 2}
                  cy={yPos}
                  r={8}
                  fill="#00ffff"
                  opacity={0.4}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              <circle
                cx={size / 2}
                cy={yPos}
                r={4}
                fill={isWireStart ? "#00ffff" : outputSignal ? '#22c55e' : '#6b7280'}
                stroke="#fff"
                strokeWidth={isHovered ? 2 : 1}
                style={{ cursor: 'crosshair' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPortClick?.(node.id, output.id);
                }}
                onMouseEnter={() => setHoveredPort(output.id)}
                onMouseLeave={() => setHoveredPort(null)}
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
      onDoubleClick={handleDoubleClick}
      style={{ cursor: isDragging ? 'grabbing' : (isSwitch ? 'pointer' : 'grab') }}
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

      {/* Switch state indicator */}
      {isSwitch && (
        <circle
          cx={size / 3}
          cy={-size / 3}
          r={6}
          fill={switchState ? '#22c55e' : '#ef4444'}
          stroke="#fff"
          strokeWidth={1}
        />
      )}

      {/* Node label */}
      <text
        x={0}
        y={isSwitch ? 5 : 0}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize={Math.max(10, 12 * camera.zoom)}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.type}
      </text>

      {/* Switch hint */}
      {isSwitch && (
        <text
          x={0}
          y={size / 3}
          textAnchor="middle"
          fill="#64748b"
          fontSize={Math.max(6, 8 * camera.zoom)}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {switchState ? 'ON' : 'OFF'}
        </text>
      )}

      {/* Input port */}
      {!['PowerSource', 'Clock'].includes(node.type) && (() => {
        const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === 'in';
        const isHovered = hoveredPort === 'in';
        const shouldGlow = isWireStart || (isHovered && wireStartPort);

        return (
          <g>
            {shouldGlow && (
              <circle
                cx={-size / 2}
                cy={0}
                r={8}
                fill="#00ffff"
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <circle
              cx={-size / 2}
              cy={0}
              r={4}
              fill={isWireStart ? "#00ffff" : "#3b82f6"}
              stroke="#fff"
              strokeWidth={isHovered ? 2 : 1}
              style={{ cursor: 'crosshair' }}
              onClick={(e) => {
                e.stopPropagation();
                onPortClick?.(node.id, 'in');
              }}
              onMouseEnter={() => setHoveredPort('in')}
              onMouseLeave={() => setHoveredPort(null)}
            />
          </g>
        );
      })()}

      {/* Output port */}
      {!['Lamp'].includes(node.type) && (() => {
        const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === 'out';
        const isHovered = hoveredPort === 'out';
        const shouldGlow = isWireStart || (isHovered && wireStartPort);

        return (
          <g>
            {shouldGlow && (
              <circle
                cx={size / 2}
                cy={0}
                r={8}
                fill="#00ffff"
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <circle
              cx={size / 2}
              cy={0}
              r={4}
              fill={isWireStart ? "#00ffff" : isActive ? '#22c55e' : '#6b7280'}
              stroke="#fff"
              strokeWidth={isHovered ? 2 : 1}
              style={{ cursor: 'crosshair' }}
              onClick={(e) => {
                e.stopPropagation();
                onPortClick?.(node.id, 'out');
              }}
              onMouseEnter={() => setHoveredPort('out')}
              onMouseLeave={() => setHoveredPort(null)}
            />
          </g>
        );
      })()}
    </g>
  );
};
