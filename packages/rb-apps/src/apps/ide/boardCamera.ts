/**
 * Board document camera — pure geometry over the Basys3 board frame.
 *
 * The board view draws in a fixed native frame (viewBox "0 -48 620 308"). The
 * camera is a zoom factor and a pan of the view centre in board units; the
 * viewBox is derived from it, so the board itself never re-lays out. Zoom,
 * pan and fit are pure functions here; the workspace preferences own the
 * persisted camera and the Board surface owns the pointer/keyboard mechanics.
 */
import {
  BOARD_CAMERA_ZOOM_MAX,
  BOARD_CAMERA_ZOOM_MIN,
  DEFAULT_BOARD_CAMERA,
  type BoardCameraPreferences,
} from './workspacePreferences';

export interface BoardFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The native Basys3 board frame the view is drawn in. */
export const BASYS3_BOARD_FRAME: BoardFrame = Object.freeze({ x: 0, y: -48, width: 620, height: 308 });

export const BOARD_CAMERA_ZOOM_STEP = 1.25;

export function clampBoardZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_BOARD_CAMERA.zoom;
  return Math.min(BOARD_CAMERA_ZOOM_MAX, Math.max(BOARD_CAMERA_ZOOM_MIN, zoom));
}

/** The SVG viewBox for a camera: the frame scaled about its centre, then panned. */
export function computeBoardViewBox(camera: BoardCameraPreferences, frame: BoardFrame = BASYS3_BOARD_FRAME): string {
  const zoom = clampBoardZoom(camera.zoom);
  const width = frame.width / zoom;
  const height = frame.height / zoom;
  const centreX = frame.x + frame.width / 2 + camera.x;
  const centreY = frame.y + frame.height / 2 + camera.y;
  const round = (value: number) => Math.round(value * 100) / 100;
  return `${round(centreX - width / 2)} ${round(centreY - height / 2)} ${round(width)} ${round(height)}`;
}

/** Zoom by a factor, keeping the view centre. */
export function zoomBoardCamera(camera: BoardCameraPreferences, factor: number): BoardCameraPreferences {
  return { ...camera, zoom: clampBoardZoom(camera.zoom * factor) };
}

/** Pan by a screen delta expressed in board units of the current zoom. */
export function panBoardCamera(
  camera: BoardCameraPreferences,
  deltaX: number,
  deltaY: number,
  frame: BoardFrame = BASYS3_BOARD_FRAME
): BoardCameraPreferences {
  const zoom = clampBoardZoom(camera.zoom);
  // Keep the frame in view: the centre may not leave the frame.
  const limitX = frame.width / 2;
  const limitY = frame.height / 2;
  return {
    ...camera,
    x: Math.min(limitX, Math.max(-limitX, camera.x + deltaX / zoom)),
    y: Math.min(limitY, Math.max(-limitY, camera.y + deltaY / zoom)),
  };
}

/**
 * A camera that frames the given bounds (board units) with breathing room:
 * the bounds take about a third of the frame, never zoomed out below 1.
 */
export function fitBoardCameraToBounds(
  bounds: BoardFrame,
  frame: BoardFrame = BASYS3_BOARD_FRAME,
  share = 1 / 3
): BoardCameraPreferences {
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const zoom = clampBoardZoom(Math.max(1, Math.min((frame.width * share) / width, (frame.height * share) / height)));
  return {
    zoom,
    x: bounds.x + width / 2 - (frame.x + frame.width / 2),
    y: bounds.y + height / 2 - (frame.y + frame.height / 2),
  };
}

/** Below this zoom the resource labels give way to the board shape (semantic density). */
export const BOARD_LABEL_DENSITY_ZOOM = 0.85;

export function boardCameraDensity(camera: BoardCameraPreferences): 'normal' | 'compact' {
  return clampBoardZoom(camera.zoom) < BOARD_LABEL_DENSITY_ZOOM ? 'compact' : 'normal';
}

export function isDefaultBoardCamera(camera: BoardCameraPreferences): boolean {
  return camera.zoom === DEFAULT_BOARD_CAMERA.zoom && camera.x === DEFAULT_BOARD_CAMERA.x && camera.y === DEFAULT_BOARD_CAMERA.y;
}
