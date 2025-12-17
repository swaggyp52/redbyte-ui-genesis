// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '@redbyte/rb-windowing';

describe('Shell + Window lifecycle contract', () => {
  beforeEach(() => {
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
  });

  describe('Focus surface behavior', () => {
    it('creates new windows with focus', () => {
      const { createWindow } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      const state = useWindowStore.getState();
      const window = state.windows.find((w) => w.id === w1.id);

      expect(window?.focused).toBe(true);
    });

    it('unfocuses other windows when creating new window', () => {
      const { createWindow } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      const w2 = createWindow({
        title: 'Files',
        contentId: 'files',
      });

      const state = useWindowStore.getState();
      const window1 = state.windows.find((w) => w.id === w1.id);
      const window2 = state.windows.find((w) => w.id === w2.id);

      expect(window1?.focused).toBe(false);
      expect(window2?.focused).toBe(true);
    });

    it('maintains focus on minimized window (does not auto-unfocus)', () => {
      const { createWindow, toggleMinimize } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      toggleMinimize(w1.id);

      const state = useWindowStore.getState();
      const window = state.windows.find((w) => w.id === w1.id);

      expect(window?.mode).toBe('minimized');
      expect(window?.focused).toBe(true);
    });
  });

  describe('Minimized window behavior', () => {
    it('removes minimized windows from visible layout', () => {
      const { createWindow, toggleMinimize } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      toggleMinimize(w1.id);

      const state = useWindowStore.getState();
      const activeWindows = state.windows.filter((w) => w.mode !== 'minimized');

      expect(activeWindows.length).toBe(0);
    });

    it('restores minimized window to normal mode', () => {
      const { createWindow, toggleMinimize } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      toggleMinimize(w1.id);
      toggleMinimize(w1.id);

      const state = useWindowStore.getState();
      const window = state.windows.find((w) => w.id === w1.id);

      expect(window?.mode).toBe('normal');
    });
  });

  describe('Maximized window behavior', () => {
    it('sets window to maximized mode', () => {
      const { createWindow, toggleMaximize } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      toggleMaximize(w1.id);

      const state = useWindowStore.getState();
      const window = state.windows.find((w) => w.id === w1.id);

      expect(window?.mode).toBe('maximized');
    });

    it('restores maximized window to normal mode', () => {
      const { createWindow, toggleMaximize } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      toggleMaximize(w1.id);
      toggleMaximize(w1.id);

      const state = useWindowStore.getState();
      const window = state.windows.find((w) => w.id === w1.id);

      expect(window?.mode).toBe('normal');
    });

    it('uses restoreWindow to explicitly restore from maximized', () => {
      const { createWindow, toggleMaximize, restoreWindow } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      toggleMaximize(w1.id);
      restoreWindow(w1.id);

      const state = useWindowStore.getState();
      const window = state.windows.find((w) => w.id === w1.id);

      expect(window?.mode).toBe('normal');
    });
  });

  describe('Z-index ordering', () => {
    it('assigns incrementing z-index to new windows', () => {
      const { createWindow } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      const w2 = createWindow({
        title: 'Files',
        contentId: 'files',
      });

      const state = useWindowStore.getState();
      const window1 = state.windows.find((w) => w.id === w1.id);
      const window2 = state.windows.find((w) => w.id === w2.id);

      expect(window2!.zIndex).toBeGreaterThan(window1!.zIndex);
    });

    it('increases z-index when focusing window', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();

      const w1 = createWindow({
        title: 'Terminal',
        contentId: 'terminal',
      });

      const w2 = createWindow({
        title: 'Files',
        contentId: 'files',
      });

      focusWindow(w1.id);

      const state = useWindowStore.getState();
      const window1 = state.windows.find((w) => w.id === w1.id);
      const window2 = state.windows.find((w) => w.id === w2.id);

      expect(window1!.zIndex).toBeGreaterThan(window2!.zIndex);
    });

    it('maintains unique z-index for all windows', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();

      const w1 = createWindow({ title: 'A', contentId: 'a' });
      const w2 = createWindow({ title: 'B', contentId: 'b' });
      const w3 = createWindow({ title: 'C', contentId: 'c' });

      focusWindow(w1.id);
      focusWindow(w2.id);

      const state = useWindowStore.getState();
      const zIndices = state.windows.map((w) => w.zIndex);
      const uniqueZIndices = new Set(zIndices);

      expect(uniqueZIndices.size).toBe(zIndices.length);
    });
  });
});
