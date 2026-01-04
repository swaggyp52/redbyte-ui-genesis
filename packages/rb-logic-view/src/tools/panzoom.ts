// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Camera } from '../useLogicViewStore';

export interface PanZoomHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
}

export interface PanZoomOptions {
  camera: Camera;
  onCameraChange: (camera: Partial<Camera>) => void;
  onPan?: (dx: number, dy: number) => void;
  onZoom?: (delta: number, centerX: number, centerY: number) => void;
  enabled?: boolean;
}

export function usePanZoomHandlers(options: PanZoomOptions): PanZoomHandlers {
  const { camera, onCameraChange, onPan, onZoom, enabled = true } = options;

  let isPanning = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enabled) return;

    // Middle mouse or space+left mouse for panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      isPanning = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!enabled || !isPanning) return;

    const dx = (e.clientX - lastMouseX) / camera.zoom;
    const dy = (e.clientY - lastMouseY) / camera.zoom;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (onPan) {
      onPan(dx, dy);
    } else {
      onCameraChange({
        x: camera.x + dx,
        y: camera.y + dy,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!enabled) return;

    if (isPanning) {
      isPanning = false;
      (e.currentTarget as HTMLElement).style.cursor = 'default';
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!enabled) return;

    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;

    const delta = e.ctrlKey ? -e.deltaY * 0.5 : -e.deltaY;

    if (onZoom) {
      onZoom(delta, centerX, centerY);
    } else {
      const oldZoom = camera.zoom;
      const newZoom = Math.max(0.25, Math.min(4, oldZoom * (1 + delta * 0.001)));
      const zoomFactor = newZoom / oldZoom;

      onCameraChange({
        x: centerX - (centerX - camera.x) * zoomFactor,
        y: centerY - (centerY - camera.y) * zoomFactor,
        zoom: newZoom,
      });
    }
  };

  return {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onWheel: handleWheel,
  };
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: (screenX - camera.x) / camera.zoom,
    y: (screenY - camera.y) / camera.zoom,
  };
}

/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: worldX * camera.zoom + camera.x,
    y: worldY * camera.zoom + camera.y,
  };
}

/**
 * Snap value to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Calculate camera position to fit all nodes in view
 */
export function calculateFitToView(
  nodes: Array<{ position: { x: number; y: number } }>,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 100,
  maxZoom: number = 2
): Camera {
  if (nodes.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // Calculate bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  });

  if (!isFinite(minX)) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // Add padding
  const boundsWidth = maxX - minX + padding * 2;
  const boundsHeight = maxY - minY + padding * 2;

  // Calculate zoom to fit
  const zoomX = viewportWidth / boundsWidth;
  const zoomY = viewportHeight / boundsHeight;
  const newZoom = Math.min(zoomX, zoomY, maxZoom);

  // Calculate center offset
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: viewportWidth / 2 - centerX * newZoom,
    y: viewportHeight / 2 - centerY * newZoom,
    zoom: newZoom,
  };
}
