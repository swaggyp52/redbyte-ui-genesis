// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '../store';

describe('Window Layout Actions', () => {
  beforeEach(() => {
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
  });

  describe('snapWindow', () => {
    it('snaps window to left half of desktop', () => {
      const { createWindow, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      snapWindow(win.id, 'left', desktopBounds);

      const state = useWindowStore.getState();
      const snapped = state.windows.find((w) => w.id === win.id);

      expect(snapped?.bounds.x).toBe(0);
      expect(snapped?.bounds.y).toBe(0);
      expect(snapped?.bounds.width).toBe(960);
      expect(snapped?.bounds.height).toBe(1080);
      expect(snapped?.mode).toBe('normal');
    });

    it('snaps window to right half of desktop', () => {
      const { createWindow, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      snapWindow(win.id, 'right', desktopBounds);

      const state = useWindowStore.getState();
      const snapped = state.windows.find((w) => w.id === win.id);

      expect(snapped?.bounds.x).toBe(960);
      expect(snapped?.bounds.y).toBe(0);
      expect(snapped?.bounds.width).toBe(960);
      expect(snapped?.bounds.height).toBe(1080);
      expect(snapped?.mode).toBe('normal');
    });

    it('snaps window to top half of desktop', () => {
      const { createWindow, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      snapWindow(win.id, 'top', desktopBounds);

      const state = useWindowStore.getState();
      const snapped = state.windows.find((w) => w.id === win.id);

      expect(snapped?.bounds.x).toBe(0);
      expect(snapped?.bounds.y).toBe(0);
      expect(snapped?.bounds.width).toBe(1920);
      expect(snapped?.bounds.height).toBe(540);
      expect(snapped?.mode).toBe('normal');
    });

    it('snaps window to bottom half of desktop', () => {
      const { createWindow, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      snapWindow(win.id, 'bottom', desktopBounds);

      const state = useWindowStore.getState();
      const snapped = state.windows.find((w) => w.id === win.id);

      expect(snapped?.bounds.x).toBe(0);
      expect(snapped?.bounds.y).toBe(540);
      expect(snapped?.bounds.width).toBe(1920);
      expect(snapped?.bounds.height).toBe(540);
      expect(snapped?.mode).toBe('normal');
    });

    it('exits maximized mode when snapping', () => {
      const { createWindow, toggleMaximize, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      toggleMaximize(win.id);
      expect(useWindowStore.getState().windows.find((w) => w.id === win.id)?.mode).toBe('maximized');

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      snapWindow(win.id, 'left', desktopBounds);

      const state = useWindowStore.getState();
      const snapped = state.windows.find((w) => w.id === win.id);
      expect(snapped?.mode).toBe('normal');
    });

    it('no-ops when window is minimized', () => {
      const { createWindow, toggleMinimize, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const originalBounds = { ...win.bounds };
      toggleMinimize(win.id);

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      snapWindow(win.id, 'left', desktopBounds);

      const state = useWindowStore.getState();
      const minimized = state.windows.find((w) => w.id === win.id);

      expect(minimized?.bounds).toEqual(originalBounds);
      expect(minimized?.mode).toBe('minimized');
    });

    it('no-ops when window does not exist', () => {
      const { snapWindow } = useWindowStore.getState();
      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };

      const beforeState = useWindowStore.getState();
      snapWindow('nonexistent-id', 'left', desktopBounds);
      const afterState = useWindowStore.getState();

      expect(afterState).toEqual(beforeState);
    });
  });

  describe('centerWindow', () => {
    it('centers window on desktop with default dimensions', () => {
      const { createWindow, centerWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      centerWindow(win.id, desktopBounds);

      const state = useWindowStore.getState();
      const centered = state.windows.find((w) => w.id === win.id);

      expect(centered?.bounds.x).toBe(760); // (1920 - 400) / 2
      expect(centered?.bounds.y).toBe(390); // (1080 - 300) / 2
      expect(centered?.bounds.width).toBe(400);
      expect(centered?.bounds.height).toBe(300);
      expect(centered?.mode).toBe('normal');
    });

    it('exits maximized mode when centering', () => {
      const { createWindow, toggleMaximize, centerWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      toggleMaximize(win.id);
      expect(useWindowStore.getState().windows.find((w) => w.id === win.id)?.mode).toBe('maximized');

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      centerWindow(win.id, desktopBounds);

      const state = useWindowStore.getState();
      const centered = state.windows.find((w) => w.id === win.id);
      expect(centered?.mode).toBe('normal');
    });

    it('no-ops when window is minimized', () => {
      const { createWindow, toggleMinimize, centerWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const originalBounds = { ...win.bounds };
      toggleMinimize(win.id);

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      centerWindow(win.id, desktopBounds);

      const state = useWindowStore.getState();
      const minimized = state.windows.find((w) => w.id === win.id);

      expect(minimized?.bounds).toEqual(originalBounds);
      expect(minimized?.mode).toBe('minimized');
    });

    it('no-ops when window does not exist', () => {
      const { centerWindow } = useWindowStore.getState();
      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };

      const beforeState = useWindowStore.getState();
      centerWindow('nonexistent-id', desktopBounds);
      const afterState = useWindowStore.getState();

      expect(afterState).toEqual(beforeState);
    });
  });

  describe('Layout contract validation', () => {
    it('layout commands do not change z-index', () => {
      const { createWindow, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });
      const originalZIndex = win.zIndex;

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      snapWindow(win.id, 'left', desktopBounds);

      const state = useWindowStore.getState();
      const snapped = state.windows.find((w) => w.id === win.id);
      expect(snapped?.zIndex).toBe(originalZIndex);
    });

    it('layout commands do not change focus state', () => {
      const { createWindow, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });
      const originalFocused = win.focused;

      const desktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };
      snapWindow(win.id, 'left', desktopBounds);

      const state = useWindowStore.getState();
      const snapped = state.windows.find((w) => w.id === win.id);
      expect(snapped?.focused).toBe(originalFocused);
    });

    it('snap commands work with non-zero desktop offsets', () => {
      const { createWindow, snapWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const desktopBounds = { x: 100, y: 50, width: 1800, height: 1000 };
      snapWindow(win.id, 'left', desktopBounds);

      const state = useWindowStore.getState();
      const snapped = state.windows.find((w) => w.id === win.id);

      expect(snapped?.bounds.x).toBe(100);
      expect(snapped?.bounds.y).toBe(50);
      expect(snapped?.bounds.width).toBe(900);
      expect(snapped?.bounds.height).toBe(1000);
    });

    it('center command works with non-zero desktop offsets', () => {
      const { createWindow, centerWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      const desktopBounds = { x: 100, y: 50, width: 1800, height: 1000 };
      centerWindow(win.id, desktopBounds);

      const state = useWindowStore.getState();
      const centered = state.windows.find((w) => w.id === win.id);

      expect(centered?.bounds.x).toBe(800); // 100 + (1800 - 400) / 2
      expect(centered?.bounds.y).toBe(400); // 50 + (1000 - 300) / 2
    });
  });
});
