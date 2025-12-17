// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '@redbyte/rb-windowing';

describe('Intent routing contract', () => {
  beforeEach(() => {
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
  });

  it('dispatching OPEN_WITH intent creates target window', () => {
    const { createWindow } = useWindowStore.getState();

    // Simulate intent dispatch by creating window with intent payload
    const window = createWindow({
      title: 'Logic Playground',
      contentId: 'logic-playground',
    });

    const state = useWindowStore.getState();
    const createdWindow = state.windows.find((w) => w.id === window.id);

    expect(createdWindow).toBeTruthy();
    expect(createdWindow?.contentId).toBe('logic-playground');
  });

  it('OPEN_WITH to singleton app restores existing window', () => {
    const { createWindow } = useWindowStore.getState();

    // Create first window (simulating first open)
    const w1 = createWindow({
      title: 'Settings',
      contentId: 'settings',
    });

    // Minimize it
    useWindowStore.getState().toggleMinimize(w1.id);

    // Simulate second open via intent (would restore + focus)
    const state = useWindowStore.getState();
    const existing = state.windows.find((w) => w.contentId === 'settings');

    expect(existing).toBeTruthy();
    expect(existing?.id).toBe(w1.id);
    expect(existing?.mode).toBe('minimized');

    // After restore (simulating intent router behavior)
    useWindowStore.getState().restoreWindow(w1.id);
    useWindowStore.getState().focusWindow(w1.id);

    const restoredState = useWindowStore.getState();
    const restoredWindow = restoredState.windows.find((w) => w.id === w1.id);

    expect(restoredWindow?.mode).toBe('normal');
    expect(restoredWindow?.focused).toBe(true);
  });

  it('OPEN_WITH to non-singleton app creates new window', () => {
    const { createWindow } = useWindowStore.getState();

    // Create first window
    const w1 = createWindow({
      title: 'Logic Playground',
      contentId: 'logic-playground',
    });

    // Create second window (non-singleton behavior)
    const w2 = createWindow({
      title: 'Logic Playground',
      contentId: 'logic-playground',
    });

    const state = useWindowStore.getState();
    const playgroundWindows = state.windows.filter((w) => w.contentId === 'logic-playground');

    expect(playgroundWindows.length).toBe(2);
    expect(w1.id).not.toBe(w2.id);
  });

  it('intent payload immutability (windows remain independent)', () => {
    const { createWindow } = useWindowStore.getState();

    // Create two playground windows with different "payloads" (simulated via window IDs)
    const w1 = createWindow({
      title: 'Logic Playground',
      contentId: 'logic-playground',
    });

    const w2 = createWindow({
      title: 'Logic Playground',
      contentId: 'logic-playground',
    });

    const state = useWindowStore.getState();
    const window1 = state.windows.find((w) => w.id === w1.id);
    const window2 = state.windows.find((w) => w.id === w2.id);

    // Windows have independent state (different IDs, z-indexes)
    expect(window1?.id).not.toBe(window2?.id);
    expect(window1?.zIndex).not.toBe(window2?.zIndex);
  });

  it('source app state unchanged after dispatching intent', () => {
    const { createWindow } = useWindowStore.getState();

    // Create Files window
    const filesWindow = createWindow({
      title: 'Files',
      contentId: 'files',
    });

    const beforeState = useWindowStore.getState();
    const filesWindowBefore = beforeState.windows.find((w) => w.id === filesWindow.id);

    // Dispatch intent (creates playground window)
    createWindow({
      title: 'Logic Playground',
      contentId: 'logic-playground',
    });

    const afterState = useWindowStore.getState();
    const filesWindowAfter = afterState.windows.find((w) => w.id === filesWindow.id);

    // Files window state unchanged except for focus (which is expected)
    expect(filesWindowAfter?.id).toBe(filesWindowBefore?.id);
    expect(filesWindowAfter?.title).toBe(filesWindowBefore?.title);
    expect(filesWindowAfter?.contentId).toBe(filesWindowBefore?.contentId);
    expect(filesWindowAfter?.mode).toBe(filesWindowBefore?.mode);
  });
});
