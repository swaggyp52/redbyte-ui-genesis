// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Unified coordinate transform helpers

import type { Camera, ContentBounds } from './types.js';

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
 * Calculate camera position to fit bounds in view
 *
 * @param bounds - Content bounds in world space
 * @param viewportWidth - Viewport width in pixels
 * @param viewportHeight - Viewport height in pixels
 * @param marginPx - Margin around content (default 60px)
 * @param maxZoom - Maximum zoom level (default 4.0)
 */
export function fitToBounds(
  bounds: ContentBounds,
  viewportWidth: number,
  viewportHeight: number,
  marginPx: number = 60,
  maxZoom: number = 4.0
): Camera {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  // Empty content - return centered camera
  if (contentWidth === 0 || contentHeight === 0) {
    return { x: viewportWidth / 2, y: viewportHeight / 2, zoom: 1.0 };
  }

  // Calculate zoom to fit content with margin
  const availableWidth = viewportWidth - marginPx * 2;
  const availableHeight = viewportHeight - marginPx * 2;

  const scaleX = availableWidth / contentWidth;
  const scaleY = availableHeight / contentHeight;
  const zoom = Math.min(scaleX, scaleY, maxZoom, 4.0); // Enforce 4.0 max

  // Center content in viewport
  const contentCenterX = (bounds.minX + bounds.maxX) / 2;
  const contentCenterY = (bounds.minY + bounds.maxY) / 2;

  const x = viewportWidth / 2 - contentCenterX * zoom;
  const y = viewportHeight / 2 - contentCenterY * zoom;

  return { x, y, zoom };
}

/**
 * Snap value to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Convert browser client coordinates to element-local coordinates.
 * Use this before screenToWorld when working with pointer events.
 */
export function clientToLocal(
  clientX: number,
  clientY: number,
  rect: DOMRect
): { x: number; y: number } {
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

/**
 * Snap world coordinates to the nearest grid intersection.
 */
export function worldToGrid(
  worldX: number,
  worldY: number,
  gridSize: number
): { x: number; y: number } {
  return {
    x: Math.round(worldX / gridSize) * gridSize,
    y: Math.round(worldY / gridSize) * gridSize,
  };
}

/**
 * Grid coordinates are in world space — identity transform.
 * Exists for API completeness in the conversion chain.
 */
export function gridToWorld(
  gridX: number,
  gridY: number
): { x: number; y: number } {
  return { x: gridX, y: gridY };
}
