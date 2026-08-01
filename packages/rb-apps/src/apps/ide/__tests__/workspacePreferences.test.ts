import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS,
  IDE_COMMAND_IDS,
  REQUIRED_DESIGN_TOOLBAR_COMMAND_IDS,
} from '../ideCommandRegistry';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  WORKSPACE_DOCK_SIZE_LIMITS,
  WORKSPACE_PREFERENCES_STORAGE_KEY,
  createWorkspacePreferencesStore,
  parseWorkspacePreferences,
  readWorkspacePreferences,
  writeWorkspacePreferences,
  type WorkspacePreferencesStorage,
} from '../workspacePreferences';

class MemoryStorage implements WorkspacePreferencesStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('workspace preferences', () => {
  it('uses corruption-safe defaults for missing, malformed, or unknown schemas', () => {
    expect(parseWorkspacePreferences(null)).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(parseWorkspacePreferences('{not-json')).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(parseWorkspacePreferences(JSON.stringify({ version: 99 }))).toEqual(
      DEFAULT_WORKSPACE_PREFERENCES
    );
  });

  it('normalizes partial dock geometry, Design view, and ordered toolbar IDs', () => {
    const parsed = parseWorkspacePreferences(
      JSON.stringify({
        version: 1,
        activePresetId: null,
        surfaces: {
          design: {
            docks: {
              left: { visible: false, sizePx: 9_999 },
              bottom: { visible: true, sizePx: 1 },
            },
          },
        },
        design: {
          view: 'split',
          toolbarCommandIds: [
            IDE_COMMAND_IDS.fitDesignCanvas,
            IDE_COMMAND_IDS.fitDesignCanvas,
            'not a command',
          ],
        },
      })
    );

    expect(parsed.activePresetId).toBeNull();
    expect(parsed.surfaces.design.docks.left).toEqual({
      visible: false,
      sizePx: WORKSPACE_DOCK_SIZE_LIMITS.left.max,
    });
    expect(parsed.surfaces.design.docks.bottom).toEqual({
      visible: true,
      sizePx: WORKSPACE_DOCK_SIZE_LIMITS.bottom.min,
    });
    expect(parsed.surfaces.design.docks.right).toEqual(
      DEFAULT_WORKSPACE_PREFERENCES.surfaces.design.docks.right
    );
    expect(parsed.design.view).toBe('split');
    expect(parsed.design.toolbarCommandIds).toEqual([
      ...REQUIRED_DESIGN_TOOLBAR_COMMAND_IDS,
      IDE_COMMAND_IDS.fitDesignCanvas,
    ]);
  });

  it('persists presets, manual dock overrides, Design view, and toolbar order', () => {
    const storage = new MemoryStorage();
    const store = createWorkspacePreferencesStore(storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setDesignView('code');
    store.setDesignToolbarCommandIds([
      IDE_COMMAND_IDS.fitDesignCanvas,
      IDE_COMMAND_IDS.redoDesignEdit,
      IDE_COMMAND_IDS.undoDesignEdit,
      IDE_COMMAND_IDS.selectDesignTool,
    ]);
    store.applyPreset('board');
    store.setDock('design', 'right', { visible: false, sizePx: 333 });

    expect(store.getSnapshot().activePresetId).toBeNull();
    expect(store.getSnapshot().design.view).toBe('code');
    expect(store.getSnapshot().design.toolbarCommandIds).toEqual([
      IDE_COMMAND_IDS.fitDesignCanvas,
      IDE_COMMAND_IDS.redoDesignEdit,
      IDE_COMMAND_IDS.undoDesignEdit,
      IDE_COMMAND_IDS.selectDesignTool,
    ]);
    expect(store.getSnapshot().surfaces.design.docks.right).toEqual({
      visible: false,
      sizePx: 333,
    });
    expect(listener).toHaveBeenCalledTimes(4);

    const restored = createWorkspacePreferencesStore(storage).getSnapshot();
    expect(restored).toEqual(store.getSnapshot());
    expect(storage.values.has(WORKSPACE_PREFERENCES_STORAGE_KEY)).toBe(true);

    unsubscribe();
    store.reset();
    expect(listener).toHaveBeenCalledTimes(4);
    expect(store.getSnapshot()).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
  });

  it('keeps preferences usable when browser storage is unavailable', () => {
    const blockedStorage: WorkspacePreferencesStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readWorkspacePreferences(blockedStorage)).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(writeWorkspacePreferences(blockedStorage, DEFAULT_WORKSPACE_PREFERENCES)).toBe(false);

    const store = createWorkspacePreferencesStore(blockedStorage);
    expect(() => store.setDesignView('split')).not.toThrow();
    expect(store.getSnapshot().design.view).toBe('split');
  });

  it('restores the complete toolbar default deliberately', () => {
    const store = createWorkspacePreferencesStore(null);
    store.setDesignToolbarCommandIds([IDE_COMMAND_IDS.fitDesignCanvas]);
    expect(store.getSnapshot().design.toolbarCommandIds).toEqual([
      ...REQUIRED_DESIGN_TOOLBAR_COMMAND_IDS,
      IDE_COMMAND_IDS.fitDesignCanvas,
    ]);

    store.restoreDesignToolbarDefaults();
    expect(store.getSnapshot().design.toolbarCommandIds).toEqual(
      DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS
    );
  });
});
