// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore, loadLayoutState, type PerspectiveId } from '../stores/layoutStore';

describe('Layout System', () => {
  beforeEach(() => {
    // Clear localStorage and reset store before each test
    localStorage.clear();
    useLayoutStore.getState().resetLayout();
  });

  // Test 1: Switching layout updates rendered view set
  it('should update active views when switching layouts', () => {
    // Start with build layout (circuit only)
    useLayoutStore.getState().setPerspective('build');
    expect(useLayoutStore.getState().activeViews).toEqual(['circuit']);
    expect(useLayoutStore.getState().splitScreenMode).toBe('single');

    // Switch to analyze (circuit + oscilloscope)
    useLayoutStore.getState().setPerspective('analyze');
    expect(useLayoutStore.getState().activeViews).toEqual(['circuit', 'oscilloscope']);
    expect(useLayoutStore.getState().splitScreenMode).toBe('horizontal');

    // Switch to quad (all four views)
    useLayoutStore.getState().setPerspective('quad');
    expect(useLayoutStore.getState().activeViews).toEqual(['circuit', 'schematic', '3d', 'oscilloscope']);
    expect(useLayoutStore.getState().splitScreenMode).toBe('quad');

    // Switch to scope-only (single view)
    useLayoutStore.getState().setPerspective('scope-only');
    expect(useLayoutStore.getState().activeViews).toEqual(['oscilloscope']);
    expect(useLayoutStore.getState().splitScreenMode).toBe('single');

    // Switch to code-only (single view)
    useLayoutStore.getState().setPerspective('code-only');
    expect(useLayoutStore.getState().activeViews).toEqual(['code']);
    expect(useLayoutStore.getState().splitScreenMode).toBe('single');
  });

  // Test 2: Persistence - set layout → reload → restores layout
  it('should persist layout preference to localStorage', () => {
    // Set to analyze layout
    useLayoutStore.getState().setPerspective('analyze');

    // Verify it was saved to localStorage
    const saved = localStorage.getItem('rb.playground.layout');
    expect(saved).toBeTruthy();

    const parsed = JSON.parse(saved!);
    expect(parsed.perspective).toBe('analyze');
  });

  it('should restore layout from localStorage on initialization', () => {
    // Manually set localStorage
    localStorage.setItem(
      'rb.playground.layout',
      JSON.stringify({
        perspective: 'explain',
        splitRatio: 0.6,
        schematicMiniEnabled: true,
      })
    );

    // Load state (simulating app initialization)
    const loaded = loadLayoutState();
    expect(loaded).toBeTruthy();
    expect(loaded?.perspective).toBe('explain');
    expect(loaded?.splitRatio).toBe(0.6);
  });

  // Test 3: Keyboard shortcut simulation
  it('should respond to simulated layout changes', () => {
    // Simulate pressing "1" key (circuit-only)
    useLayoutStore.getState().setPerspective('circuit-only');
    expect(useLayoutStore.getState().perspective).toBe('circuit-only');
    expect(useLayoutStore.getState().activeViews).toEqual(['circuit']);

    // Simulate pressing "3" key (scope-only)
    useLayoutStore.getState().setPerspective('scope-only');
    expect(useLayoutStore.getState().perspective).toBe('scope-only');
    expect(useLayoutStore.getState().activeViews).toEqual(['oscilloscope']);

    // Simulate pressing "5" key (code-only)
    useLayoutStore.getState().setPerspective('code-only');
    expect(useLayoutStore.getState().perspective).toBe('code-only');
    expect(useLayoutStore.getState().activeViews).toEqual(['code']);

    // Simulate pressing Shift+5 (quad)
    useLayoutStore.getState().setPerspective('quad');
    expect(useLayoutStore.getState().perspective).toBe('quad');
    expect(useLayoutStore.getState().activeViews).toEqual(['circuit', 'schematic', '3d', 'oscilloscope']);
  });
});
