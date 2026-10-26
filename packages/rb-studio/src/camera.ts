import type { Box } from '@redbyte/rb-logic-view/scene';

/** screen = world * zoom + (x, y). One camera per view; never a global singleton. */
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function fitCamera(bounds: Box | null, width: number, height: number, margin = 56, maxZoom = 1.75): Camera {
  if (!bounds || width <= 0 || height <= 0) return { x: 0, y: 0, zoom: 1 };
  const w = Math.max(1, bounds.maxX - bounds.minX);
  const h = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = clampZoom(Math.min((width - margin * 2) / w, (height - margin * 2) / h, maxZoom));
  return {
    zoom,
    x: (width - w * zoom) / 2 - bounds.minX * zoom,
    y: (height - h * zoom) / 2 - bounds.minY * zoom,
  };
}

/**
 * A pane resize (a stage preset opening a lens) keeps the student's zoom and the world point
 * at the centre of the view; only the visible extent changes.
 */
export function recenterOnResize(camera: Camera, from: { width: number; height: number }, to: { width: number; height: number }): Camera {
  if (from.width <= 0 || from.height <= 0) return camera;
  return { zoom: camera.zoom, x: camera.x + (to.width - from.width) / 2, y: camera.y + (to.height - from.height) / 2 };
}

/** Zoom about a screen point so the world point under the pointer stays put. */
export function zoomAt(camera: Camera, factor: number, screenX: number, screenY: number): Camera {
  const zoom = clampZoom(camera.zoom * factor);
  const worldX = (screenX - camera.x) / camera.zoom;
  const worldY = (screenY - camera.y) / camera.zoom;
  return { zoom, x: screenX - worldX * zoom, y: screenY - worldY * zoom };
}

export function cameraTransform(camera: Camera): string {
  return `matrix(${camera.zoom} 0 0 ${camera.zoom} ${camera.x} ${camera.y})`;
}

export function visibleWorld(camera: Camera, width: number, height: number): Box {
  return {
    minX: -camera.x / camera.zoom,
    minY: -camera.y / camera.zoom,
    maxX: (width - camera.x) / camera.zoom,
    maxY: (height - camera.y) / camera.zoom,
  };
}

/** Level of detail changes only at thresholds, so labels re-render only when one is crossed. */
export type SheetLod = 'overview' | 'read' | 'edit' | 'detail';
/**
 * Which sheet text survives the 12px floor at this zoom. Secondary labels (pin names, part
 * types, state windows, margin pins) are drawn at 10.5–11.5 world px, so `all` waits for the
 * smallest of them, 10.5, to reach 12px; titles, value tags and boundary names are 12.5. A class
 * that would render below 12px is dropped, never shrunk.
 */
export const SECONDARY_TEXT_WORLD_PX = 10.5;
export const TITLE_TEXT_WORLD_PX = 12.5;
export type SheetTextTier = 'all' | 'titles' | 'none';
export function textTierForZoom(zoom: number): SheetTextTier {
  if (zoom * SECONDARY_TEXT_WORLD_PX >= 12) return 'all';
  if (zoom * TITLE_TEXT_WORLD_PX >= 12) return 'titles';
  return 'none';
}

export function lodForZoom(zoom: number): SheetLod {
  if (zoom < 0.5) return 'overview';
  if (zoom < 0.96) return 'read';
  if (zoom < 1.6) return 'edit';
  return 'detail';
}

// The camera belongs to the student and lasts for the browser session (contract: not saved
// with the project; a reload of the session keeps it, a new session starts fresh).
const KEY = 'rb.studio.camera.v1:';

export function recallCamera(projectId: string): Camera | null {
  try {
    const raw = sessionStorage.getItem(KEY + projectId);
    if (!raw) return null;
    const value = JSON.parse(raw) as Camera;
    return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.zoom) ? value : null;
  } catch {
    return null;
  }
}

export function rememberCamera(projectId: string, camera: Camera): void {
  try {
    sessionStorage.setItem(KEY + projectId, JSON.stringify(camera));
  } catch {
    // Storage unavailable: the camera simply is not remembered.
  }
}
