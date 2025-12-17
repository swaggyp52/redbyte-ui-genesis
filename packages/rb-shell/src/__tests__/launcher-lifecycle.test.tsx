// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '@redbyte/rb-windowing';

describe('Launcher lifecycle contract', () => {
  beforeEach(() => {
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
  });

  it('restores and focuses launcher when invoked while minimized', () => {
    const { createWindow, toggleMinimize, restoreWindow, focusWindow } = useWindowStore.getState();

    const state = createWindow({
      title: 'Launcher',
      contentId: 'launcher',
      width: 640,
      height: 480,
    });

    toggleMinimize(state.id);

    expect(useWindowStore.getState().windows[0].mode).toBe('minimized');

    restoreWindow(state.id);
    focusWindow(state.id);

    const updated = useWindowStore.getState().windows[0];
    expect(updated.focused).toBe(true);
    expect(updated.mode).toBe('normal');
  });

  it('opens and focuses launcher when no window is focused', () => {
    const { createWindow, focusWindow } = useWindowStore.getState();

    const w1 = createWindow({
      title: 'Terminal',
      contentId: 'terminal',
    });

    focusWindow(w1.id);
    useWindowStore.setState((state) => ({
      windows: state.windows.map((w) => ({ ...w, focused: false })),
    }));

    const launcher = createWindow({
      title: 'Launcher',
      contentId: 'launcher',
    });

    const windows = useWindowStore.getState().windows;
    const launcherWindow = windows.find((w) => w.id === launcher.id);

    expect(launcherWindow?.focused).toBe(true);
  });
});
