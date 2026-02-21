// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback } from 'react';
import type { Node } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';

const MINIMAP_W = 150;
const MINIMAP_H = 110;
const NODE_WORLD_RADIUS = 26;
const PADDING = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface MinimapProps {
  nodes: Node[];
  camera: Camera;
  canvasWidth: number;
  canvasHeight: number;
  onClickPan: (worldX: number, worldY: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  nodes,
  camera,
  canvasWidth,
  canvasHeight,
  onClickPan,
}) => {
  if (nodes.length === 0) return null;

  const positions = nodes
    .map((n) => n.position)
    .filter((p): p is { x: number; y: number } => p != null);

  if (positions.length === 0) return null;

  const rawMinX = Math.min(...positions.map((p) => p.x)) - NODE_WORLD_RADIUS - PADDING;
  const rawMaxX = Math.max(...positions.map((p) => p.x)) + NODE_WORLD_RADIUS + PADDING;
  const rawMinY = Math.min(...positions.map((p) => p.y)) - NODE_WORLD_RADIUS - PADDING;
  const rawMaxY = Math.max(...positions.map((p) => p.y)) + NODE_WORLD_RADIUS + PADDING;

  const circuitW = Math.max(1, rawMaxX - rawMinX);
  const circuitH = Math.max(1, rawMaxY - rawMinY);

  const scale = Math.min(MINIMAP_W / circuitW, MINIMAP_H / circuitH);

  const vpLeft = clamp((-camera.x / camera.zoom - rawMinX) * scale, 0, MINIMAP_W);
  const vpTop = clamp((-camera.y / camera.zoom - rawMinY) * scale, 0, MINIMAP_H);
  const vpRight = clamp(((canvasWidth - camera.x) / camera.zoom - rawMinX) * scale, 0, MINIMAP_W);
  const vpBottom = clamp(((canvasHeight - camera.y) / camera.zoom - rawMinY) * scale, 0, MINIMAP_H);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      const worldX = clickX / scale + rawMinX;
      const worldY = clickY / scale + rawMinY;
      onClickPan(worldX, worldY);
    },
    [scale, rawMinX, rawMinY, onClickPan]
  );

  return (
    <div
      className="rb-minimap"
      data-testid="ide-design-minimap"
      onClick={handleClick}
    >
      <svg width={MINIMAP_W} height={MINIMAP_H} style={{ display: 'block' }}>
        {nodes.map((node) => {
          if (!node.position) return null;
          const dotX = (node.position.x - rawMinX) * scale - 2;
          const dotY = (node.position.y - rawMinY) * scale - 2;
          return (
            <rect
              key={node.id}
              x={dotX}
              y={dotY}
              width={4}
              height={4}
              fill="rgba(142, 199, 255, 0.7)"
              rx={1}
            />
          );
        })}
        <rect
          x={vpLeft}
          y={vpTop}
          width={Math.max(0, vpRight - vpLeft)}
          height={Math.max(0, vpBottom - vpTop)}
          fill="none"
          stroke="rgba(46, 196, 182, 0.8)"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
};
