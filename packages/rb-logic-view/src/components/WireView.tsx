import React from 'react';
import type { Connection, Node } from '@rb/rb-logic-core';
import type { Camera } from '../useLogicViewStore';

export interface WireViewProps {
  connection: Connection;
  nodes: Node[];
  camera: Camera;
  isSelected: boolean;
  onSelect: (wireId: string, addToSelection: boolean) => void;
  signal?: 0 | 1;
}

export const WireView: React.FC<WireViewProps> = ({
  connection,
  nodes,
  camera,
  isSelected,
  onSelect,
  signal,
}) => {
  const fromNode = nodes.find((n) => n.id === connection.from.nodeId);
  const toNode = nodes.find((n) => n.id === connection.to.nodeId);

  if (!fromNode || !toNode) return null;

  const wireId = `${connection.from.nodeId}.${connection.from.portName}-${connection.to.nodeId}.${connection.to.portName}`;

  // Calculate port positions (assuming ports are on the sides)
  const fromX = (fromNode.position.x + 24) * camera.zoom + camera.x; // Right side
  const fromY = fromNode.position.y * camera.zoom + camera.y;
  const toX = (toNode.position.x - 24) * camera.zoom + camera.x; // Left side
  const toY = toNode.position.y * camera.zoom + camera.y;

  // Create a curved path
  const midX = (fromX + toX) / 2;
  const path = `M ${fromX} ${fromY} Q ${midX} ${fromY}, ${midX} ${(fromY + toY) / 2} T ${toX} ${toY}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(wireId, e.shiftKey);
  };

  const strokeColor = signal === 1 ? '#22c55e' : '#6b7280';

  return (
    <g onClick={handleClick} style={{ cursor: 'pointer' }}>
      {/* Invisible wider path for easier clicking */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={10} />

      {/* Visible wire */}
      <path
        d={path}
        fill="none"
        stroke={isSelected ? '#3b82f6' : strokeColor}
        strokeWidth={isSelected ? 3 : 2}
        opacity={signal === 1 ? 1 : 0.5}
      />
    </g>
  );
};
