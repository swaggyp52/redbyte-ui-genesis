// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { beforeEach, describe, expect, it } from 'vitest';
import { useWindowStore } from '../store';

describe('window store lifecycle', () => {
  beforeEach(() => {
    useWindowStore.setState((state) => ({
      ...state,
      windows: [],
      nextZIndex: 1,
      snapToGrid: false,
      gridSize: 20,
    }));
  });

  it('raises focused windows and keeps z-index unique', () => {
    const { createWindow, focusWindow, getFocusedWindow } = useWindowStore.getState();

    const first = createWindow({ contentId: 'one', title: 'One' });
    const second = createWindow({ contentId: 'two', title: 'Two' });

    expect(getFocusedWindow()?.id).toBe(second.id);

    focusWindow(first.id);

    const state = useWindowStore.getState();
    const focused = state.getFocusedWindow();
    expect(focused?.id).toBe(first.id);
    expect(new Set(state.windows.map((w) => w.zIndex)).size).toBe(state.windows.length);
    expect(focused?.zIndex).toBeGreaterThan(second.zIndex);
  });

  it('focuses the next top window when closing a focused window', () => {
    const { createWindow, focusWindow, closeWindow } = useWindowStore.getState();

    const a = createWindow({ contentId: 'a', title: 'A' });
    const b = createWindow({ contentId: 'b', title: 'B' });
    const c = createWindow({ contentId: 'c', title: 'C' });

    focusWindow(a.id);
    closeWindow(a.id);

    const state = useWindowStore.getState();
    expect(state.windows).toHaveLength(2);
    expect(state.getFocusedWindow()?.id).toBe(c.id);
    expect(state.windows.find((w) => w.id === b.id)?.focused).toBe(false);
  });

  it('keeps z-order stable when raising and closing windows', () => {
    const { createWindow, focusWindow, closeWindow } = useWindowStore.getState();

    const alpha = createWindow({ contentId: 'alpha', title: 'Alpha' });
    const beta = createWindow({ contentId: 'beta', title: 'Beta' });
    createWindow({ contentId: 'gamma', title: 'Gamma' });

    focusWindow(alpha.id);
    focusWindow(beta.id);

    let state = useWindowStore.getState();
    const zValues = state.windows.map((w) => w.zIndex);
    expect(new Set(zValues).size).toBe(state.windows.length);
    expect(state.getFocusedWindow()?.id).toBe(beta.id);

    closeWindow(beta.id);

    state = useWindowStore.getState();
    const remainingZ = state.windows.map((w) => w.zIndex);
    expect(new Set(remainingZ).size).toBe(state.windows.length);
    expect(state.getFocusedWindow()?.id).toBe(alpha.id);
    expect(state.getFocusedWindow()?.zIndex).toBe(Math.max(...remainingZ));
  });

  it('defocuses when minimizing and restores focus and order when unminimizing', () => {
    const { createWindow, toggleMinimize, getFocusedWindow } = useWindowStore.getState();

    const primary = createWindow({ contentId: 'primary', title: 'Primary' });
    const secondary = createWindow({ contentId: 'secondary', title: 'Secondary' });

    expect(getFocusedWindow()?.id).toBe(secondary.id);

    toggleMinimize(secondary.id);
    const minimizedState = useWindowStore.getState();
    expect(minimizedState.windows.find((w) => w.id === secondary.id)?.mode).toBe('minimized');
    expect(minimizedState.getFocusedWindow()?.id).toBe(primary.id);

    toggleMinimize(secondary.id);
    const restoredState = useWindowStore.getState();
    const restored = restoredState.windows.find((w) => w.id === secondary.id)!;
    expect(restored.mode).toBe('normal');
    expect(restored.focused).toBe(true);
    expect(restored.zIndex).toBeGreaterThan(primary.zIndex);
  });

  it('restores minimized windows to focus while defocusing others', () => {
    const { createWindow, toggleMinimize, focusWindow, getFocusedWindow } = useWindowStore.getState();

    const first = createWindow({ contentId: 'first', title: 'First' });
    const second = createWindow({ contentId: 'second', title: 'Second' });

    focusWindow(first.id);
    toggleMinimize(first.id);

    expect(getFocusedWindow()?.id).toBe(second.id);

    toggleMinimize(first.id);

    const state = useWindowStore.getState();
    const restored = state.windows.find((w) => w.id === first.id)!;
    const zValues = state.windows.map((w) => w.zIndex);
    expect(restored.focused).toBe(true);
    expect(state.windows.find((w) => w.id === second.id)?.focused).toBe(false);
    expect(restored.zIndex).toBe(Math.max(...zValues));
  });
});
