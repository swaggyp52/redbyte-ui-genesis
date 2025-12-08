// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
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
