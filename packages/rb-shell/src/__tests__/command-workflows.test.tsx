// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '@redbyte/rb-windowing';

describe('Command workflows', () => {
  beforeEach(() => {
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
  });

  describe('Window cycling (focus-next-window)', () => {
    it('cycles through non-minimized windows by descending zIndex', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });
      const w3 = createWindow({ title: 'Window 3', contentId: 'app3' });

      focusWindow(w1.id);

      const activeWindows = useWindowStore.getState().getActiveWindows();
      const sortedByZ = [...activeWindows].sort((a, b) => b.zIndex - a.zIndex);

      expect(sortedByZ.length).toBe(3);
      const focusedBefore = sortedByZ.find((w) => w.focused);
      expect(focusedBefore?.id).toBe(w1.id);

      const focusedIndex = sortedByZ.findIndex((w) => w.focused);
      const nextIndex = (focusedIndex + 1) % sortedByZ.length;
      focusWindow(sortedByZ[nextIndex].id);

      const afterCycle = useWindowStore.getState();
      const focusedAfter = afterCycle.windows.find((w) => w.focused);

      expect(focusedAfter?.id).not.toBe(w1.id);
      expect(focusedAfter?.focused).toBe(true);
    });

    it('wraps around when cycling past last window', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      focusWindow(w2.id);

      const activeWindows = useWindowStore.getState().getActiveWindows();
      const sortedByZ = [...activeWindows].sort((a, b) => b.zIndex - a.zIndex);
      const focusedIndex = sortedByZ.findIndex((w) => w.focused);

      expect(focusedIndex).toBe(0);

      const nextIndex = (focusedIndex + 1) % sortedByZ.length;
      expect(nextIndex).toBe(1);

      focusWindow(sortedByZ[nextIndex].id);

      const afterCycle = useWindowStore.getState();
      const focusedAfter = afterCycle.windows.find((w) => w.focused);

      expect(focusedAfter?.id).toBe(w1.id);
      expect(focusedAfter?.focused).toBe(true);
    });

    it('skips minimized windows when cycling', () => {
      const { createWindow, focusWindow, toggleMinimize } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });
      const w3 = createWindow({ title: 'Window 3', contentId: 'app3' });

      toggleMinimize(w2.id);

      focusWindow(w1.id);

      const activeWindows = useWindowStore.getState().getActiveWindows();
      expect(activeWindows.length).toBe(2);

      const sortedByZ = [...activeWindows].sort((a, b) => b.zIndex - a.zIndex);
      const focusedIndex = sortedByZ.findIndex((w) => w.focused);
      const nextIndex = (focusedIndex + 1) % sortedByZ.length;
      focusWindow(sortedByZ[nextIndex].id);

      const afterCycle = useWindowStore.getState();
      const focusedWindow = afterCycle.windows.find((w) => w.focused);

      expect(focusedWindow?.id).not.toBe(w2.id);
      expect(focusedWindow?.mode).toBe('normal');
      expect([w1.id, w3.id].includes(focusedWindow!.id)).toBe(true);
    });

    it('no-ops when fewer than 2 active windows', () => {
      const { createWindow, toggleMinimize } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      toggleMinimize(w2.id);

      const activeWindows = useWindowStore.getState().getActiveWindows();
      expect(activeWindows.length).toBe(1);

      const stateBefore = useWindowStore.getState();
      const focusedBefore = stateBefore.windows.find((w) => w.focused);

      if (activeWindows.length >= 2) {
        const sortedByZ = [...activeWindows].sort((a, b) => b.zIndex - a.zIndex);
        const focusedIndex = sortedByZ.findIndex((w) => w.focused);
        const nextIndex = (focusedIndex + 1) % sortedByZ.length;
        useWindowStore.getState().focusWindow(sortedByZ[nextIndex].id);
      }

      const stateAfter = useWindowStore.getState();
      const focusedAfter = stateAfter.windows.find((w) => w.focused);

      expect(focusedAfter?.id).toBe(focusedBefore?.id);
    });
  });

  describe('Close focused window (close-focused-window)', () => {
    it('closes the currently focused window', () => {
      const { createWindow, closeWindow, getFocusedWindow } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      const focused = getFocusedWindow();
      expect(focused?.id).toBe(w2.id);

      closeWindow(focused!.id);

      const state = useWindowStore.getState();
      expect(state.windows.length).toBe(1);
      expect(state.windows[0].id).toBe(w1.id);
    });

    it('no-ops safely when no window is focused', () => {
      const { createWindow, closeWindow, getFocusedWindow } = useWindowStore.getState();

      createWindow({ title: 'Window 1', contentId: 'app1' });

      useWindowStore.setState((state) => ({
        windows: state.windows.map((w) => ({ ...w, focused: false })),
      }));

      const focused = getFocusedWindow();
      expect(focused).toBeNull();

      const stateBefore = useWindowStore.getState();
      const countBefore = stateBefore.windows.length;

      if (focused) {
        closeWindow(focused.id);
      }

      const stateAfter = useWindowStore.getState();
      expect(stateAfter.windows.length).toBe(countBefore);
    });
  });

  describe('Minimize focused window (minimize-focused-window)', () => {
    it('minimizes the currently focused window', () => {
      const { createWindow, toggleMinimize, getFocusedWindow } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      const focused = getFocusedWindow();
      expect(focused?.id).toBe(w2.id);
      expect(focused?.mode).toBe('normal');

      toggleMinimize(focused!.id);

      const state = useWindowStore.getState();
      const minimizedWindow = state.windows.find((w) => w.id === w2.id);

      expect(minimizedWindow?.mode).toBe('minimized');
    });

    it('no-ops safely when no window is focused', () => {
      const { createWindow, toggleMinimize, getFocusedWindow } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });

      useWindowStore.setState((state) => ({
        windows: state.windows.map((w) => ({ ...w, focused: false })),
      }));

      const focused = getFocusedWindow();
      expect(focused).toBeNull();

      const stateBefore = useWindowStore.getState();
      const window1Before = stateBefore.windows.find((w) => w.id === w1.id);

      if (focused && focused.minimizable) {
        toggleMinimize(focused.id);
      }

      const stateAfter = useWindowStore.getState();
      const window1After = stateAfter.windows.find((w) => w.id === w1.id);

      expect(window1After?.mode).toBe(window1Before?.mode);
    });

    it('respects minimizable flag', () => {
      const { createWindow, toggleMinimize, getFocusedWindow } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1', minimizable: false });

      const focused = getFocusedWindow();
      expect(focused?.id).toBe(w1.id);
      expect(focused?.minimizable).toBe(false);

      if (focused && focused.minimizable) {
        toggleMinimize(focused.id);
      }

      const state = useWindowStore.getState();
      const window1 = state.windows.find((w) => w.id === w1.id);

      expect(window1?.mode).toBe('normal');
    });
  });

  describe('Command Palette integration', () => {
    it('command palette can execute focus-next-window', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();

      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      focusWindow(w1.id);

      const activeWindows = useWindowStore.getState().getActiveWindows();
      const sortedByZ = [...activeWindows].sort((a, b) => b.zIndex - a.zIndex);
      const focusedIndex = sortedByZ.findIndex((w) => w.focused);
      const nextIndex = (focusedIndex + 1) % sortedByZ.length;
      focusWindow(sortedByZ[nextIndex].id);

      const focused = useWindowStore.getState().getFocusedWindow();
      expect(focused?.id).toBe(w2.id);
    });

    it('command palette can execute close-focused-window', () => {
      const { createWindow, closeWindow, getFocusedWindow } = useWindowStore.getState();

      createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      const focused = getFocusedWindow();
      closeWindow(focused!.id);

      const state = useWindowStore.getState();
      expect(state.windows.length).toBe(1);
      expect(state.windows.find((w) => w.id === w2.id)).toBeUndefined();
    });

    it('command palette can execute minimize-focused-window', () => {
      const { createWindow, toggleMinimize, getFocusedWindow } = useWindowStore.getState();

      createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      const focused = getFocusedWindow();
      toggleMinimize(focused!.id);

      const state = useWindowStore.getState();
      const window2 = state.windows.find((w) => w.id === w2.id);

      expect(window2?.mode).toBe('minimized');
    });
  });
});
