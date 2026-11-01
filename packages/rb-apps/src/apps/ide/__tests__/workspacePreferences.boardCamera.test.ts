import { describe, expect, it } from 'vitest';
import {
  BOARD_CAMERA_ZOOM_MAX,
  BOARD_CAMERA_ZOOM_MIN,
  DEFAULT_BOARD_CAMERA,
  WORKSPACE_PREFERENCES_VERSION,
  createWorkspacePreferencesStore,
  normalizeWorkspacePreferences,
} from '../workspacePreferences';

/**
 * P2.5H Wave Two — the Board document camera (zoom + pan) is a workspace
 * preference beside the board layers: clamped, persisted, reset in one step.
 */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('workspace preferences — board camera', () => {
  it('defaults to the native frame', () => {
    expect(normalizeWorkspacePreferences({ version: WORKSPACE_PREFERENCES_VERSION }).board.camera).toEqual(DEFAULT_BOARD_CAMERA);
  });

  it('clamps zoom and pan and ignores garbage', () => {
    const camera = normalizeWorkspacePreferences({
      version: WORKSPACE_PREFERENCES_VERSION,
      board: { camera: { zoom: 99, x: 'left', y: -99999 } },
    }).board.camera;
    expect(camera.zoom).toBe(BOARD_CAMERA_ZOOM_MAX);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(-2000);
    expect(
      normalizeWorkspacePreferences({ version: WORKSPACE_PREFERENCES_VERSION, board: { camera: { zoom: 0.01 } } }).board.camera.zoom
    ).toBe(BOARD_CAMERA_ZOOM_MIN);
  });

  it('persists a camera move without touching the layers, and resets', () => {
    const storage = memoryStorage();
    const store = createWorkspacePreferencesStore(storage);
    store.setBoardLayer('labels', false);
    store.setBoardCamera({ zoom: 2, x: 120.44, y: -30 });
    expect(store.getSnapshot().board.camera).toEqual({ zoom: 2, x: 120.4, y: -30 });
    expect(store.getSnapshot().board.layers.labels).toBe(false);
    expect(createWorkspacePreferencesStore(storage).getSnapshot().board.camera.zoom).toBe(2);
    store.resetBoardCamera();
    expect(store.getSnapshot().board.camera).toEqual(DEFAULT_BOARD_CAMERA);
    expect(store.getSnapshot().board.layers.labels).toBe(false);
  });
});
