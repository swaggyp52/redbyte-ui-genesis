// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { beforeEach, describe, expect, it } from 'vitest';
import { loadLayoutState, useLayoutStore } from '../layoutStore';

describe('Playground Layout Store', () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.getState().resetLayout();
  });

  it('persists perspective selection to localStorage', () => {
    useLayoutStore.getState().setPerspective('debug');

    const raw = localStorage.getItem('rb.playground.layout');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.perspective).toBe('debug');
  });

  it('loads persisted layout state', () => {
    localStorage.setItem(
      'rb.playground.layout',
      JSON.stringify({ perspective: 'learn', splitRatio: 0.6, schematicMiniEnabled: false })
    );

    const loaded = loadLayoutState();
    expect(loaded?.perspective).toBe('learn');
    expect(loaded?.splitRatio).toBe(0.6);
    expect(loaded?.schematicMiniEnabled).toBe(false);
  });

  it('toggles schematic mini view layout', () => {
    const store = useLayoutStore.getState();
    store.setPerspective('schematic');

    expect(useLayoutStore.getState().splitScreenMode).toBe('vertical');
    expect(useLayoutStore.getState().activeViews).toEqual(['schematic', 'circuit']);

    store.toggleSchematicMini();

    expect(useLayoutStore.getState().splitScreenMode).toBe('single');
    expect(useLayoutStore.getState().activeViews).toEqual(['schematic']);
  });
});
