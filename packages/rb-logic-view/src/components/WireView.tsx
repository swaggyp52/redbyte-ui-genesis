// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Connection, Node } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';

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

      {/* Net highlight glow (hover/select net) */}
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

      {/* Probe glow highlight */}
      {probeColors?.map((color, index) => (
        <path
          key={`${wireId}-probe-${index}`}
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={6}
          opacity={0.35}
          filter="blur(3px)"
        />
      ))}

      {/* Mismatch glow highlight */}
      {mismatchColors?.map((color, index) => (
        <path
          key={`${wireId}-mismatch-${index}`}
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={7}
          opacity={0.45}
          filter="blur(3px)"
        />
      ))}

      {/* Glow effect for active wires */}
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

      {/* Glow effect for selected wires */}
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

      {/* Visible wire */}
      <path
        d={path}
        fill="none"
        stroke={isSelected ? '#3b82f6' : isNetHighlighted ? netHighlightColor : strokeColor}
        strokeWidth={isSelected ? 4 : 2}
        opacity={signal === 1 ? 1 : 0.5}
      />

      {/* Animated signal flow particles */}
      {isActive && (
        <>
          <circle r="3" fill={strokeColor} opacity={0.9}>
            <animateMotion dur="1.5s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="3" fill={strokeColor} opacity={0.9}>
            <animateMotion dur="1.5s" repeatCount="indefinite" path={path} begin="0.5s" />
          </circle>
          <circle r="3" fill={strokeColor} opacity={0.9}>
            <animateMotion dur="1.5s" repeatCount="indefinite" path={path} begin="1s" />
          </circle>
        </>
      )}
    </g>
  );
};

// Memoize WireView to prevent unnecessary re-renders
export const WireView = React.memo(WireViewComponent, (prevProps, nextProps) => {
  const prevProbeKey = (prevProps.probeColors ?? []).join('|');
  const nextProbeKey = (nextProps.probeColors ?? []).join('|');
  const prevMismatchKey = (prevProps.mismatchColors ?? []).join('|');
  const nextMismatchKey = (nextProps.mismatchColors ?? []).join('|');
  // Only re-render if relevant props change
  const prevFromNode = prevProps.nodes.find((n) => n.id === prevProps.connection.from.nodeId);
  const nextFromNode = nextProps.nodes.find((n) => n.id === nextProps.connection.from.nodeId);
  const prevToNode = prevProps.nodes.find((n) => n.id === prevProps.connection.to.nodeId);
  const nextToNode = nextProps.nodes.find((n) => n.id === nextProps.connection.to.nodeId);

  return (
    prevProps.connection.from.nodeId === nextProps.connection.from.nodeId &&
    prevProps.connection.from.portName === nextProps.connection.from.portName &&
    prevProps.connection.to.nodeId === nextProps.connection.to.nodeId &&
    prevProps.connection.to.portName === nextProps.connection.to.portName &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isNetHighlighted === nextProps.isNetHighlighted &&
    prevProps.signal === nextProps.signal &&
    prevProbeKey === nextProbeKey &&
    prevMismatchKey === nextMismatchKey &&
    prevProps.camera.x === nextProps.camera.x &&
    prevProps.camera.y === nextProps.camera.y &&
    prevProps.camera.zoom === nextProps.camera.zoom &&
    prevFromNode?.position.x === nextFromNode?.position.x &&
    prevFromNode?.position.y === nextFromNode?.position.y &&
    prevToNode?.position.x === nextToNode?.position.x &&
    prevToNode?.position.y === nextToNode?.position.y
  );
});
