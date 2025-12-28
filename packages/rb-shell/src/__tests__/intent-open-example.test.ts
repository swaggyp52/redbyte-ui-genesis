// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import type { OpenExampleIntent } from '../intent-types';

/**
 * Tests for open-example intent routing behavior
 *
 * These tests verify the Shell correctly routes open-example intents:
 * - Reuses existing Playground window when available
 * - Creates new window when none exists
 * - Respects preferNewWindow routing hint
 */
describe('Shell open-example Intent Routing', () => {
  // Mock window state
  let windows: Array<{ id: string; appId: string }> = [];
  let bindings: Record<string, { appId: string; props: any }> = {};

  // Mock functions
  const mockFocusWindow = (id: string) => ({ focused: id });
  const mockOpenWindow = (appId: string, props: any) => {
    const newId = `window-${windows.length + 1}`;
    windows.push({ id: newId, appId });
    bindings[newId] = { appId, props };
    return newId;
  };

  const mockSetBindings = (updater: (prev: any) => any) => {
    bindings = updater(bindings);
  };

  beforeEach(() => {
    windows = [];
    bindings = {};
  });

  /**
   * Simplified version of Shell's dispatchIntent logic for open-example
   */
  const dispatchOpenExample = (
    intent: OpenExampleIntent,
    windows: typeof windows,
    bindings: typeof bindings
  ) => {
    const { targetAppId, exampleId } = intent.payload;
    const preferNewWindow = intent.routingHint?.preferNewWindow ?? false;

    // Find existing window with matching appId
    const existingWindow = windows.find((w) => w.appId === targetAppId);
    const targetWindowId = !preferNewWindow && existingWindow ? existingWindow.id : null;

    if (targetWindowId) {
      // Reuse existing window
      const binding = bindings[targetWindowId];
      if (binding) {
        mockSetBindings((prev) => ({
          ...prev,
          [targetWindowId]: { ...binding, props: { initialExampleId: exampleId } },
        }));
        return { action: 'reused', windowId: targetWindowId };
      }
    }

    // Create new window
    const newWindowId = mockOpenWindow(targetAppId, { initialExampleId: exampleId });
    return { action: 'created', windowId: newWindowId };
  };

  it('reuses existing Playground window and updates props with initialExampleId', () => {
    // Setup: existing Playground window
    const existingId = mockOpenWindow('logic', {});

    // Dispatch open-example intent
    const intent: OpenExampleIntent = {
      type: 'open-example',
      payload: {
        sourceAppId: 'help',
        targetAppId: 'logic',
        exampleId: '10_sr-latch',
      },
    };

    const result = dispatchOpenExample(intent, windows, bindings);

    // Should reuse existing window
    expect(result.action).toBe('reused');
    expect(result.windowId).toBe(existingId);

    // Should update props with initialExampleId
    expect(bindings[existingId].props).toEqual({
      initialExampleId: '10_sr-latch',
    });

    // Should not create new window
    expect(windows.length).toBe(1);
  });

  it('creates new Playground window when none exists', () => {
    // No existing windows
    expect(windows.length).toBe(0);

    // Dispatch open-example intent
    const intent: OpenExampleIntent = {
      type: 'open-example',
      payload: {
        sourceAppId: 'help',
        targetAppId: 'logic',
        exampleId: '11_d-flipflop',
      },
    };

    const result = dispatchOpenExample(intent, windows, bindings);

    // Should create new window
    expect(result.action).toBe('created');
    expect(windows.length).toBe(1);
    expect(windows[0].appId).toBe('logic');

    // Should set initialExampleId in props
    expect(bindings[result.windowId].props).toEqual({
      initialExampleId: '11_d-flipflop',
    });
  });

  it('creates new window when preferNewWindow is true even if one exists', () => {
    // Setup: existing Playground window
    const existingId = mockOpenWindow('logic', {});

    // Dispatch with preferNewWindow hint
    const intent: OpenExampleIntent = {
      type: 'open-example',
      payload: {
        sourceAppId: 'help',
        targetAppId: 'logic',
        exampleId: '05_simple-cpu',
      },
      routingHint: {
        preferNewWindow: true,
      },
    };

    const result = dispatchOpenExample(intent, windows, bindings);

    // Should create new window despite existing one
    expect(result.action).toBe('created');
    expect(windows.length).toBe(2);
    expect(result.windowId).not.toBe(existingId);

    // New window should have correct props
    expect(bindings[result.windowId].props).toEqual({
      initialExampleId: '05_simple-cpu',
    });
  });

  it('updates existing window props multiple times correctly', () => {
    // Setup: existing Playground window
    const existingId = mockOpenWindow('logic', { initialExampleId: '10_sr-latch' });

    // First update
    const intent1: OpenExampleIntent = {
      type: 'open-example',
      payload: {
        sourceAppId: 'help',
        targetAppId: 'logic',
        exampleId: '11_d-flipflop',
      },
    };

    dispatchOpenExample(intent1, windows, bindings);
    expect(bindings[existingId].props.initialExampleId).toBe('11_d-flipflop');

    // Second update
    const intent2: OpenExampleIntent = {
      type: 'open-example',
      payload: {
        sourceAppId: 'help',
        targetAppId: 'logic',
        exampleId: '04_4bit-counter',
      },
    };

    dispatchOpenExample(intent2, windows, bindings);
    expect(bindings[existingId].props.initialExampleId).toBe('04_4bit-counter');

    // Should still be only one window
    expect(windows.length).toBe(1);
  });
});
