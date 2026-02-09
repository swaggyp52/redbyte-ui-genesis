// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Connection, Node } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';

const getConnectionKey = (connection: Connection) => {
  const fromIsString = typeof connection.from === 'string';
  const toIsString = typeof connection.to === 'string';
  const fromNodeId = fromIsString ? connection.from : connection.from.nodeId;
  const toNodeId = toIsString ? connection.to : connection.to.nodeId;
  const fromPortName = fromIsString
    ? (connection.fromPin ?? connection.fromPort ?? 'out')
    : (connection.from.portName ?? connection.from.port ?? 'out');
  const toPortName = toIsString
    ? (connection.toPin ?? connection.toPort ?? 'in')
    : (connection.to.portName ?? connection.to.port ?? 'in');
  const wireId = `${fromNodeId}.${fromPortName}-${toNodeId}.${toPortName}`;

  return { fromNodeId, toNodeId, fromPortName, toPortName, wireId };
};

export interface WireViewProps {
  connection: Connection;
  nodes: Node[];
  camera: Camera;
  isSelected: boolean;
  isNetHighlighted?: boolean;
  onSelect: (wireId: string, addToSelection: boolean) => void;
  onHover?: (wireId: string | null) => void;
  signal?: 0 | 1;
  probeColors?: string[];
  mismatchColors?: string[];
}

const WireViewComponent: React.FC<WireViewProps> = ({
  connection,
  nodes,
  camera,
  isSelected,
  isNetHighlighted = false,
  onSelect,
  onHover,
  signal,
  probeColors,
  mismatchColors,
}) => {
  const { fromNodeId, toNodeId, fromPortName, toPortName, wireId } = getConnectionKey(connection);

  const fromNode = nodes.find((n) => n.id === fromNodeId);
  const toNode = nodes.find((n) => n.id === toNodeId);

  if (!fromNode || !toNode) return null;

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
  const isActive = signal === 1;
  const netHighlightColor = '#fbbf24'; // amber-400

  return (
    <g
      onClick={handleClick}
      onMouseEnter={() => onHover?.(wireId)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Invisible wider path for easier clicking */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={10} />

      {/* Net highlight glow (hover/select net) - stable group */}
      <g key={`${wireId}-net-highlight`}>
        {isNetHighlighted && !isSelected && (
          <path
            d={path}
            fill="none"
            stroke={netHighlightColor}
            strokeWidth={9}
            opacity={0.25}
            filter="blur(5px)"
          />
        )}
      </g>

      {/* Probe glow highlight - stable group */}
      <g key={`${wireId}-probes`}>
        {probeColors?.map((color, index) => (
          <path
            key={`${color}-${index}`}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={6}
            opacity={0.35}
            filter="blur(3px)"
          />
        ))}
      </g>

      {/* Mismatch glow highlight - stable group */}
      <g key={`${wireId}-mismatches`}>
        {mismatchColors?.map((color, index) => (
          <path
            key={`${color}-${index}`}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={7}
            opacity={0.45}
            filter="blur(3px)"
          />
        ))}
      </g>

      {/* Glow effect for active wires - stable group */}
      <g key={`${wireId}-active-glow`}>
        {isActive && !isSelected && (
          <path
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={6}
            opacity={0.3}
            filter="blur(3px)"
          />
        )}
      </g>

      {/* Glow effect for selected wires - stable group */}
      <g key={`${wireId}-selected-glow`}>
        {isSelected && (
          <path
            d={path}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={8}
            opacity={0.4}
            filter="blur(4px)"
          />
        )}
      </g>

      {/* Visible wire */}
      <path
        d={path}
        fill="none"
        stroke={isSelected ? '#3b82f6' : isNetHighlighted ? netHighlightColor : strokeColor}
        strokeWidth={isSelected ? 4 : 2}
        opacity={signal === 1 ? 1 : 0.5}
      />

      {/* Animated signal flow particles - stable group */}
      <g key={`${wireId}-particles`}>
        {isActive && (
          <>
            <circle key="particle-1" r="3" fill={strokeColor} opacity={0.9}>
              <animateMotion dur="1.5s" repeatCount="indefinite" path={path} />
            </circle>
            <circle key="particle-2" r="3" fill={strokeColor} opacity={0.9}>
              <animateMotion dur="1.5s" repeatCount="indefinite" path={path} begin="0.5s" />
            </circle>
            <circle key="particle-3" r="3" fill={strokeColor} opacity={0.9}>
              <animateMotion dur="1.5s" repeatCount="indefinite" path={path} begin="1s" />
            </circle>
          </>
        )}
      </g>
    </g>
  );
};

// Export WireView without custom memo comparison to avoid reconciliation issues
export const WireView = React.memo(WireViewComponent);
