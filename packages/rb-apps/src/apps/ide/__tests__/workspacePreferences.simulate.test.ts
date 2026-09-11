import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIMULATE_LAYOUT,
  SIMULATE_EVIDENCE_FRACTION_MAX,
  SIMULATE_EVIDENCE_FRACTION_MIN,
  WORKSPACE_PREFERENCES_VERSION,
  createWorkspacePreferencesStore,
  normalizeWorkspacePreferences,
} from '../workspacePreferences';

/**
 * P2.5H Wave One — the Cases + evidence deck composition is a workspace
 * preference: one owner, clamped, persisted with the docks, reset in one step.
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

describe('workspace preferences — simulate deck layout', () => {
  it('defaults to a split deck at the default fraction', () => {
    const preferences = normalizeWorkspacePreferences({ version: WORKSPACE_PREFERENCES_VERSION });
    expect(preferences.simulate).toEqual(DEFAULT_SIMULATE_LAYOUT);
  });

  it('clamps the fraction and drops unknown maximize values', () => {
    const preferences = normalizeWorkspacePreferences({
      version: WORKSPACE_PREFERENCES_VERSION,
      simulate: { evidenceFraction: 2, evidenceCollapsed: 'yes', maximized: 'inspector' },
    });
    expect(preferences.simulate.evidenceFraction).toBe(SIMULATE_EVIDENCE_FRACTION_MAX);
    expect(preferences.simulate.evidenceCollapsed).toBe(false);
    expect(preferences.simulate.maximized).toBeNull();
    expect(
      normalizeWorkspacePreferences({ version: WORKSPACE_PREFERENCES_VERSION, simulate: { evidenceFraction: -1 } })
        .simulate.evidenceFraction
    ).toBe(SIMULATE_EVIDENCE_FRACTION_MIN);
  });

  it('persists a gesture and reads it back through a fresh store', () => {
    const storage = memoryStorage();
    const store = createWorkspacePreferencesStore(storage);
    store.setSimulateLayout({ evidenceFraction: 0.5, maximized: 'waveform' });
    expect(store.getSnapshot().simulate).toEqual({ evidenceFraction: 0.5, evidenceCollapsed: false, maximized: 'waveform' });
    const reopened = createWorkspacePreferencesStore(storage);
    expect(reopened.getSnapshot().simulate.evidenceFraction).toBe(0.5);
    expect(reopened.getSnapshot().simulate.maximized).toBe('waveform');
  });

  it('resets the deck layout without touching the docks', () => {
    const store = createWorkspacePreferencesStore(memoryStorage());
    store.setDock('verify', 'bottom', { sizePx: 260 });
    store.setSimulateLayout({ evidenceCollapsed: true, evidenceFraction: 0.25 });
    store.resetSimulateLayout();
    expect(store.getSnapshot().simulate).toEqual(DEFAULT_SIMULATE_LAYOUT);
    expect(store.getSnapshot().surfaces.verify.docks.bottom.sizePx).toBe(260);
  });
});
