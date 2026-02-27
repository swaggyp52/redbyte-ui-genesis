// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Camera } from '../useLogicViewStore';

export interface GridConfig {
  size: number;
  color: string;
  majorLineInterval?: number;
  majorLineColor?: string;
}

type GridZoomBand = 'far' | 'medium' | 'near' | 'detail';

interface GridBandStyle {
  majorStroke: number;
  majorOpacity: number;
  minorStroke: number;
  minorOpacity: number;
  showMinorLines: boolean;
}

const GRID_BAND_STYLES: Record<GridZoomBand, GridBandStyle> = {
  far: {
    majorStroke: 1,
    majorOpacity: 0.22,
    minorStroke: 0.45,
    minorOpacity: 0,
    showMinorLines: false,
  },
  medium: {
    majorStroke: 1,
    majorOpacity: 0.24,
    minorStroke: 0.5,
    minorOpacity: 0.08,
    showMinorLines: true,
  },
  near: {
    majorStroke: 1.05,
    majorOpacity: 0.28,
    minorStroke: 0.55,
    minorOpacity: 0.11,
    showMinorLines: true,
  },
  detail: {
    majorStroke: 1.1,
    majorOpacity: 0.32,
    minorStroke: 0.62,
    minorOpacity: 0.14,
    showMinorLines: true,
  },
};

export function resolveGridZoomBand(zoom: number): GridZoomBand {
  if (zoom < 0.5) return 'far';
  if (zoom < 1) return 'medium';
  if (zoom < 2) return 'near';
  return 'detail';
}

/**
 * Render an infinite grid using SVG
 */
export function renderGrid(
  camera: Camera,
  width: number,
  height: number,
  config: GridConfig
): JSX.Element {
  const { size, color, majorLineInterval = 5, majorLineColor = '#444' } = config;
  const band = resolveGridZoomBand(camera.zoom);
  const bandStyle = GRID_BAND_STYLES[band];

  const lines: JSX.Element[] = [];

  // Calculate visible grid range
  const startX = Math.floor(-camera.x / (size * camera.zoom)) * size;
  const endX = Math.ceil((width - camera.x) / (size * camera.zoom)) * size;
  const startY = Math.floor(-camera.y / (size * camera.zoom)) * size;
  const endY = Math.ceil((height - camera.y) / (size * camera.zoom)) * size;

  // Vertical lines
  for (let x = startX; x <= endX; x += size) {
    const screenX = x * camera.zoom + camera.x;
    const isMajor = x % (size * majorLineInterval) === 0;
    if (!isMajor && !bandStyle.showMinorLines) continue;
    lines.push(
      <line
        key={`v-${x}`}
        x1={screenX}
        y1={0}
        x2={screenX}
        y2={height}
        stroke={isMajor ? majorLineColor : color}
        strokeWidth={isMajor ? bandStyle.majorStroke : bandStyle.minorStroke}
        opacity={isMajor ? bandStyle.majorOpacity : bandStyle.minorOpacity}
      />
    );
  }

  // Horizontal lines
  for (let y = startY; y <= endY; y += size) {
    const screenY = y * camera.zoom + camera.y;
    const isMajor = y % (size * majorLineInterval) === 0;
    if (!isMajor && !bandStyle.showMinorLines) continue;
    lines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={screenY}
        x2={width}
        y2={screenY}
        stroke={isMajor ? majorLineColor : color}
        strokeWidth={isMajor ? bandStyle.majorStroke : bandStyle.minorStroke}
        opacity={isMajor ? bandStyle.majorOpacity : bandStyle.minorOpacity}
      />
    );
  }

  return (
    <g
      data-testid="logic-grid-layer"
      data-grid-zoom-band={band}
      data-grid-minor-visible={bandStyle.showMinorLines ? '1' : '0'}
    >
      {lines}
    </g>
  );
}
