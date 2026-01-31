// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Unified Viewport Hook — Enforces consistent pan/zoom across all canvas views

import { useCallback, useState } from 'react';
import type { ViewportState, ViewportControls, ViewportOptions, ContentBounds } from './types.js';
import { fitToBounds } from './transforms.js';

const DEFAULT_MIN_ZOOM = 0.1;
const DEFAULT_MAX_ZOOM = 4.0;
const DEFAULT_ZOOM = 1.0;

export function useUnifiedViewport(options: ViewportOptions): ViewportControls {
  const { minZoom = DEFAULT_MIN_ZOOM, maxZoom = DEFAULT_MAX_ZOOM, defaultZoom = DEFAULT_ZOOM, containerWidth, containerHeight } = options;

  const [state, setState] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: defaultZoom,
  });

  const pan = useCallback((dx: number, dy: number) => {
    setState((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const zoom = useCallback(
    (deltaZoom: number, centerX: number, centerY: number) => {
      setState((prev) => {
        const newZoom = Math.max(minZoom, Math.min(maxZoom, prev.zoom + deltaZoom));
        const zoomRatio = newZoom / prev.zoom;

        // Cursor-centered zoom: adjust pan to keep cursor position fixed
        const dx = centerX - (centerX - prev.x) * zoomRatio;
        const dy = centerY - (centerY - prev.y) * zoomRatio;

        return {
          x: dx,
          y: dy,
          zoom: newZoom,
        };
      });
    },
    [minZoom, maxZoom]
  );

  const fitToContent = useCallback(
    (bounds: ContentBounds) => {
      const camera = fitToBounds(bounds, containerWidth, containerHeight, 60, maxZoom);
      setState({ x: camera.x, y: camera.y, zoom: camera.zoom });
    },
    [containerWidth, containerHeight, maxZoom]
  );

  const reset = useCallback(() => {
    setState({ x: 0, y: 0, zoom: defaultZoom });
  }, [defaultZoom]);

  const toScreenCoords = useCallback(
    (worldX: number, worldY: number) => ({
      x: worldX * state.zoom + state.x,
      y: worldY * state.zoom + state.y,
    }),
    [state]
  );

  const toWorldCoords = useCallback(
    (screenX: number, screenY: number) => ({
      x: (screenX - state.x) / state.zoom,
      y: (screenY - state.y) / state.zoom,
    }),
    [state]
  );

  return {
    state,
    pan,
    zoom,
    fitToContent,
    reset,
    toScreenCoords,
    toWorldCoords,
  };
}
