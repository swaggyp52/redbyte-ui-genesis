// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWindowStore, loadSession } from '../store';
import type { WindowState } from '../types';

describe('Session Restore', () => {
  beforeEach(() => {
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
    localStorage.clear();
  });

  describe('saveSession (via store subscription)', () => {
    it('persists windows to localStorage on createWindow', () => {
      const { createWindow } = useWindowStore.getState();
      createWindow({ title: 'Test Window', contentId: 'test-app' });

      const raw = localStorage.getItem('rb:window-session');
      expect(raw).toBeTruthy();

      const session = JSON.parse(raw!);
      expect(session.windows).toHaveLength(1);
      expect(session.windows[0].contentId).toBe('test-app');
      expect(session.windows[0].title).toBe('Test Window');
    });

    it('persists bounds and mode to localStorage', () => {
      const { createWindow } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app', x: 100, y: 200, width: 500, height: 400 });

      const raw = localStorage.getItem('rb:window-session');
      const session = JSON.parse(raw!);
      const saved = session.windows[0];

      expect(saved.bounds.x).toBe(100);
      expect(saved.bounds.y).toBe(200);
      expect(saved.bounds.width).toBe(500);
      expect(saved.bounds.height).toBe(400);
      expect(saved.mode).toBe('normal');
    });

    it('persists z-index ordering', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();
      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      focusWindow(w1.id);

      const raw = localStorage.getItem('rb:window-session');
      const session = JSON.parse(raw!);

      expect(session.windows).toHaveLength(2);
      expect(session.nextZIndex).toBeGreaterThan(2);
    });

    it('persists focused window state', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();
      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      focusWindow(w1.id);

      const raw = localStorage.getItem('rb:window-session');
      const session = JSON.parse(raw!);

      const savedW1 = session.windows.find((w: WindowState) => w.contentId === 'app1');
      const savedW2 = session.windows.find((w: WindowState) => w.contentId === 'app2');

      expect(savedW1.focused).toBe(true);
      expect(savedW2.focused).toBe(false);
    });

    it('persists minimized windows', () => {
      const { createWindow, toggleMinimize } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      toggleMinimize(win.id);

      const raw = localStorage.getItem('rb:window-session');
      const session = JSON.parse(raw!);

      expect(session.windows[0].mode).toBe('minimized');
    });

    it('persists maximized windows', () => {
      const { createWindow, toggleMaximize } = useWindowStore.getState();
      const win = createWindow({ title: 'Test', contentId: 'test-app' });

      toggleMaximize(win.id);

      const raw = localStorage.getItem('rb:window-session');
      const session = JSON.parse(raw!);

      expect(session.windows[0].mode).toBe('maximized');
    });

    it('updates localStorage on closeWindow', () => {
      const { createWindow, closeWindow } = useWindowStore.getState();
      const w1 = createWindow({ title: 'Window 1', contentId: 'app1' });
      const w2 = createWindow({ title: 'Window 2', contentId: 'app2' });

      closeWindow(w1.id);

      const raw = localStorage.getItem('rb:window-session');
      const session = JSON.parse(raw!);

      expect(session.windows).toHaveLength(1);
      expect(session.windows[0].contentId).toBe('app2');
    });
  });

  describe('loadSession', () => {
    it('returns null when localStorage is empty', () => {
      const session = loadSession();
      expect(session).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem('rb:window-session', 'invalid json{');
      const session = loadSession();
      expect(session).toBeNull();
    });

    it('returns null for invalid schema (missing windows)', () => {
      localStorage.setItem('rb:window-session', JSON.stringify({ nextZIndex: 5 }));
      const session = loadSession();
      expect(session).toBeNull();
    });

    it('returns null for invalid schema (missing nextZIndex)', () => {
      localStorage.setItem('rb:window-session', JSON.stringify({ windows: [] }));
      const session = loadSession();
      expect(session).toBeNull();
    });

    it('returns null for invalid schema (windows not an array)', () => {
      localStorage.setItem('rb:window-session', JSON.stringify({ windows: {}, nextZIndex: 1 }));
      const session = loadSession();
      expect(session).toBeNull();
    });

    it('loads valid session data', () => {
      const validSession = {
        windows: [
          {
            id: 'win-1',
            contentId: 'test-app',
            title: 'Test Window',
            bounds: { x: 100, y: 100, width: 400, height: 300 },
            mode: 'normal',
            zIndex: 1,
            focused: true,
            resizable: true,
            minimizable: true,
            maximizable: true,
          },
        ],
        nextZIndex: 2,
      };

      localStorage.setItem('rb:window-session', JSON.stringify(validSession));
      const session = loadSession();

      expect(session).not.toBeNull();
      expect(session!.windows).toHaveLength(1);
      expect(session!.windows[0].contentId).toBe('test-app');
      expect(session!.nextZIndex).toBe(2);
    });
  });

  describe('restoreSession action', () => {
    it('restores windows from persisted data', () => {
      const restoredWindows: WindowState[] = [
        {
          id: 'win-1',
          contentId: 'app1',
          title: 'Restored Window 1',
          bounds: { x: 50, y: 50, width: 600, height: 400 },
          mode: 'normal',
          zIndex: 1,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
        {
          id: 'win-2',
          contentId: 'app2',
          title: 'Restored Window 2',
          bounds: { x: 100, y: 100, width: 500, height: 350 },
          mode: 'minimized',
          zIndex: 2,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
      ];

      const { restoreSession } = useWindowStore.getState();
      restoreSession(restoredWindows, 3);

      const state = useWindowStore.getState();
      expect(state.windows).toHaveLength(2);
      expect(state.windows[0].contentId).toBe('app1');
      expect(state.windows[1].contentId).toBe('app2');
      expect(state.nextZIndex).toBe(3);
    });

    it('preserves bounds from restored session', () => {
      const restoredWindows: WindowState[] = [
        {
          id: 'win-1',
          contentId: 'test-app',
          title: 'Test',
          bounds: { x: 250, y: 150, width: 700, height: 500 },
          mode: 'normal',
          zIndex: 1,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
      ];

      const { restoreSession } = useWindowStore.getState();
      restoreSession(restoredWindows, 2);

      const state = useWindowStore.getState();
      const restored = state.windows[0];

      expect(restored.bounds.x).toBe(250);
      expect(restored.bounds.y).toBe(150);
      expect(restored.bounds.width).toBe(700);
      expect(restored.bounds.height).toBe(500);
    });

    it('preserves z-index ordering from restored session', () => {
      const restoredWindows: WindowState[] = [
        {
          id: 'win-1',
          contentId: 'app1',
          title: 'Window 1',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 5,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
        {
          id: 'win-2',
          contentId: 'app2',
          title: 'Window 2',
          bounds: { x: 50, y: 50, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 10,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
      ];

      const { restoreSession } = useWindowStore.getState();
      restoreSession(restoredWindows, 11);

      const state = useWindowStore.getState();
      expect(state.windows[0].zIndex).toBe(5);
      expect(state.windows[1].zIndex).toBe(10);
    });

    it('preserves focused window from restored session', () => {
      const restoredWindows: WindowState[] = [
        {
          id: 'win-1',
          contentId: 'app1',
          title: 'Window 1',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 1,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
        {
          id: 'win-2',
          contentId: 'app2',
          title: 'Window 2',
          bounds: { x: 50, y: 50, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 2,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
      ];

      const { restoreSession } = useWindowStore.getState();
      restoreSession(restoredWindows, 3);

      const state = useWindowStore.getState();
      const focused = state.windows.find((w) => w.focused);

      expect(focused).toBeTruthy();
      expect(focused!.contentId).toBe('app2');
    });

    it('preserves minimized windows', () => {
      const restoredWindows: WindowState[] = [
        {
          id: 'win-1',
          contentId: 'test-app',
          title: 'Minimized Window',
          bounds: { x: 100, y: 100, width: 400, height: 300 },
          mode: 'minimized',
          zIndex: 1,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
      ];

      const { restoreSession } = useWindowStore.getState();
      restoreSession(restoredWindows, 2);

      const state = useWindowStore.getState();
      expect(state.windows[0].mode).toBe('minimized');
    });

    it('preserves maximized windows', () => {
      const restoredWindows: WindowState[] = [
        {
          id: 'win-1',
          contentId: 'test-app',
          title: 'Maximized Window',
          bounds: { x: 100, y: 100, width: 400, height: 300 },
          mode: 'maximized',
          zIndex: 1,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
      ];

      const { restoreSession } = useWindowStore.getState();
      restoreSession(restoredWindows, 2);

      const state = useWindowStore.getState();
      expect(state.windows[0].mode).toBe('maximized');
    });
  });

  describe('Session restore integration', () => {
    it('restored windows can be manipulated after restore', () => {
      const restoredWindows: WindowState[] = [
        {
          id: 'win-1',
          contentId: 'test-app',
          title: 'Restored',
          bounds: { x: 100, y: 100, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 1,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
      ];

      const { restoreSession, moveWindow } = useWindowStore.getState();
      restoreSession(restoredWindows, 2);

      moveWindow('win-1', 200, 300);

      const state = useWindowStore.getState();
      expect(state.windows[0].bounds.x).toBe(200);
      expect(state.windows[0].bounds.y).toBe(300);
    });

    it('new windows can be created after session restore', () => {
      const restoredWindows: WindowState[] = [
        {
          id: 'win-1',
          contentId: 'app1',
          title: 'Restored',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 1,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
        },
      ];

      const { restoreSession, createWindow } = useWindowStore.getState();
      restoreSession(restoredWindows, 2);

      const newWin = createWindow({ title: 'New Window', contentId: 'app2' });

      const state = useWindowStore.getState();
      expect(state.windows).toHaveLength(2);
      expect(newWin.zIndex).toBeGreaterThan(1);
    });
  });
});
