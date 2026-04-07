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

type WireZoomBand = 'far' | 'medium' | 'near' | 'detail';

interface WireBandStyle {
  hitWidth: number;
  baseStroke: number;
  hoverStroke: number;
  selectedStroke: number;
  overlayStroke: number;
  glowStroke: number;
  netGlowStroke: number;
  probeGlowStroke: number;
  mismatchGlowStroke: number;
}

function resolveWireZoomBand(zoom: number): WireZoomBand {
  if (zoom < 0.5) return 'far';
  if (zoom < 1) return 'medium';
  if (zoom < 2) return 'near';
  return 'detail';
}

const WIRE_BAND_STYLES: Record<WireZoomBand, WireBandStyle> = {
  far: {
    hitWidth: 16,
    baseStroke: 1.4,
    hoverStroke: 2.1,
    selectedStroke: 2.8,
    overlayStroke: 1.1,
    glowStroke: 4.8,
    netGlowStroke: 6,
    probeGlowStroke: 4.4,
    mismatchGlowStroke: 4.8,
  },
  medium: {
    hitWidth: 14,
    baseStroke: 1.8,
    hoverStroke: 2.6,
    selectedStroke: 3.4,
    overlayStroke: 1.3,
    glowStroke: 5.6,
    netGlowStroke: 7.2,
    probeGlowStroke: 5.2,
    mismatchGlowStroke: 5.8,
  },
  near: {
    hitWidth: 12,
    baseStroke: 2.1,
    hoverStroke: 3,
    selectedStroke: 3.9,
    overlayStroke: 1.5,
    glowStroke: 6.2,
    netGlowStroke: 8,
    probeGlowStroke: 5.8,
    mismatchGlowStroke: 6.3,
  },
  detail: {
    hitWidth: 11,
    baseStroke: 2.4,
    hoverStroke: 3.3,
    selectedStroke: 4.2,
    overlayStroke: 1.6,
    glowStroke: 6.8,
    netGlowStroke: 8.6,
    probeGlowStroke: 6.2,
    mismatchGlowStroke: 6.8,
  },
};

export interface WireViewProps {
  connection: Connection;
  nodes: Node[];
  camera: Camera;
  presentationZoomMode?: 'dense' | 'classroom';
  isSelected: boolean;
  isHovered?: boolean;
  isBeingRewired?: boolean;
  isNetHighlighted?: boolean;
  onSelect: (wireId: string, addToSelection: boolean) => void;
  onHover?: (wireId: string | null) => void;
  onContextMenu?: (wireId: string, event: React.MouseEvent<SVGGElement>) => void;
  signal?: 0 | 1;
  probeColors?: string[];
  mismatchColors?: string[];
}

const WireViewComponent: React.FC<WireViewProps> = ({
  connection,
  nodes,
  camera,
  presentationZoomMode = 'dense',
  isSelected,
  isHovered = false,
  isBeingRewired = false,
  isNetHighlighted = false,
  onSelect,
  onHover,
  onContextMenu,
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

  const strokeColor = signal === 1 ? '#34d399' : '#8aa6c3';
  const hoverColor = '#9ed5ff';
  const isActive = signal === 1;
  const netHighlightColor = '#fbbf24'; // amber-400
  const zoomBand = resolveWireZoomBand(camera.zoom);
  const baseBandStyle = WIRE_BAND_STYLES[zoomBand];
  const wireScale = presentationZoomMode === 'classroom' ? 1.18 : 1;
  const bandStyle = {
    ...baseBandStyle,
    hitWidth: baseBandStyle.hitWidth * wireScale,
    baseStroke: baseBandStyle.baseStroke * wireScale,
    hoverStroke: baseBandStyle.hoverStroke * wireScale,
    selectedStroke: baseBandStyle.selectedStroke * wireScale,
    overlayStroke: baseBandStyle.overlayStroke * wireScale,
    glowStroke: baseBandStyle.glowStroke * wireScale,
    netGlowStroke: baseBandStyle.netGlowStroke * wireScale,
    probeGlowStroke: baseBandStyle.probeGlowStroke * wireScale,
    mismatchGlowStroke: baseBandStyle.mismatchGlowStroke * wireScale,
  };

  return (
    <g
      data-wire-id={wireId}
      data-wire-hovered={isHovered ? '1' : '0'}
      data-wire-selected={isSelected ? '1' : '0'}
      data-wire-being-rewired={isBeingRewired ? '1' : '0'}
      data-wire-zoom-band={zoomBand}
      onClick={handleClick}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(wireId, event);
      }}
      onMouseEnter={() => onHover?.(wireId)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: 'pointer', opacity: isBeingRewired ? 0.35 : undefined }}
    >
      {/* Invisible wider path for easier clicking */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={bandStyle.hitWidth} />

      {/* Net highlight glow (hover/select net) - stable group */}
      <g key={`${wireId}-net-highlight`}>
        {isNetHighlighted && !isSelected && (
          <path
            d={path}
            fill="none"
            stroke={netHighlightColor}
            strokeWidth={bandStyle.netGlowStroke}
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
            strokeWidth={bandStyle.probeGlowStroke}
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
            strokeWidth={bandStyle.mismatchGlowStroke}
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
            strokeWidth={bandStyle.glowStroke}
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
            strokeWidth={bandStyle.netGlowStroke}
            opacity={0.4}
            filter="blur(4px)"
          />
        )}
      </g>

      {/* Hover glow (distinct from net highlight) */}
      <g key={`${wireId}-hover-glow`}>
        {isHovered && !isSelected && (
          <path
            d={path}
            fill="none"
            stroke={hoverColor}
            strokeWidth={bandStyle.glowStroke}
            opacity={0.24}
            filter="blur(4px)"
          />
        )}
      </g>

      {/* Visible wire */}
      <path
        d={path}
        fill="none"
        stroke={
          isSelected
            ? '#3b82f6'
            : isHovered
              ? hoverColor
              : isNetHighlighted
                ? netHighlightColor
                : strokeColor
        }
        strokeWidth={
          isSelected
            ? bandStyle.selectedStroke
            : isHovered
              ? bandStyle.hoverStroke
              : bandStyle.baseStroke
        }
        opacity={signal === 1 ? 1 : 0.72}
      />

      {isSelected && (
        <path
          d={path}
          fill="none"
          stroke="#b7dbff"
          strokeWidth={bandStyle.overlayStroke}
          strokeDasharray="9 6"
          opacity={0.9}
        />
      )}

      {/* Ghost dash overlay when this wire is being replaced by a reconnect */}
      {isBeingRewired && (
        <path
          d={path}
          fill="none"
          stroke="#8ec7ff"
          strokeWidth={bandStyle.overlayStroke}
          strokeDasharray="6 5"
          opacity={0.55}
        />
      )}

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
