// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Viewport Controls — Reusable Pan/Zoom/Fit for Circuit/Schematic/Board views
 *
 * Premium interaction contract:
 * - Space + drag = pan
 * - Mouse wheel = cursor-centered zoom
 * - F key = fit to content
 * - Shift+F = reset to default
 * - Consistent across all canvas views
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewportControls {
  state: ViewportState;
  pan: (dx: number, dy: number) => void;
  zoom: (deltaZoom: number, centerX: number, centerY: number) => void;
  fitToContent: (bounds: ContentBounds) => void;
  reset: () => void;
  toScreenCoords: (worldX: number, worldY: number) => { x: number; y: number };
  toWorldCoords: (screenX: number, screenY: number) => { x: number; y: number };
}

export interface ViewportOptions {
  minZoom?: number;
  maxZoom?: number;
  defaultZoom?: number;
  containerWidth: number;
  containerHeight: number;
}

const DEFAULT_MIN_ZOOM = 0.1;
const DEFAULT_MAX_ZOOM = 4.0;
const DEFAULT_ZOOM = 1.0;
const FIT_MARGIN = 40;

export function useViewportControls(options: ViewportOptions): ViewportControls {
  const { minZoom = DEFAULT_MIN_ZOOM, maxZoom = DEFAULT_MAX_ZOOM, defaultZoom = DEFAULT_ZOOM } = options;

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
      const contentWidth = bounds.maxX - bounds.minX;
      const contentHeight = bounds.maxY - bounds.minY;

      if (contentWidth === 0 || contentHeight === 0) {
        // No content, reset to center
        setState({ x: options.containerWidth / 2, y: options.containerHeight / 2, zoom: defaultZoom });
        return;
      }

      const availableWidth = options.containerWidth - FIT_MARGIN * 2;
      const availableHeight = options.containerHeight - FIT_MARGIN * 2;

      const scaleX = availableWidth / contentWidth;
      const scaleY = availableHeight / contentHeight;
      const newZoom = Math.min(scaleX, scaleY, maxZoom);

      // Center content in viewport
      const contentCenterX = (bounds.minX + bounds.maxX) / 2;
      const contentCenterY = (bounds.minY + bounds.maxY) / 2;

      const x = options.containerWidth / 2 - contentCenterX * newZoom;
      const y = options.containerHeight / 2 - contentCenterY * newZoom;

      setState({ x, y, zoom: newZoom });
    },
    [options.containerWidth, options.containerHeight, maxZoom, defaultZoom]
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

/**
 * Hook for keyboard shortcuts (F = fit, Shift+F = reset)
 */
export function useViewportKeyboard(viewport: ViewportControls, getContentBounds: () => ContentBounds) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (e.shiftKey) {
          viewport.reset();
        } else {
          const bounds = getContentBounds();
          viewport.fitToContent(bounds);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewport, getContentBounds]);
}

/**
 * Hook for mouse wheel zoom (cursor-centered)
 */
export function useViewportWheel(
  containerRef: React.RefObject<HTMLElement>,
  viewport: ViewportControls,
  zoomSpeed: number = 0.001
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      const deltaZoom = -e.deltaY * zoomSpeed;
      viewport.zoom(deltaZoom, centerX, centerY);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [containerRef, viewport, zoomSpeed]);
}

/**
 * Hook for space-to-pan drag
 */
export function useViewportPan(containerRef: React.RefObject<HTMLElement>, viewport: ViewportControls) {
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceDownRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        isPanningRef.current = false;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (spaceDownRef.current || e.button === 1) {
        // Space + click or middle mouse
        e.preventDefault();
        isPanningRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        viewport.pan(dx, dy);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [viewport]);
}
