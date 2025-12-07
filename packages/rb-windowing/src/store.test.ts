import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from './store';

describe('@rb/rb-windowing store', () => {
  beforeEach(() => {
    // Reset store before each test
    useWindowStore.setState({
      windows: [],
      nextZIndex: 1,
      snapToGrid: false,
      gridSize: 20,
    });
  });

  describe('createWindow', () => {
    it('creates a window with default values', () => {
      const { createWindow } = useWindowStore.getState();
      const window = createWindow({ contentId: 'test-app' });

      expect(window).toMatchObject({
        title: 'Untitled',
        bounds: { x: 100, y: 100, width: 400, height: 300 },
        mode: 'normal',
        zIndex: 1,
        focused: true,
        resizable: true,
        minimizable: true,
        maximizable: true,
        contentId: 'test-app',
      });
      expect(window.id).toBeTruthy();
    });

    it('creates a window with custom values', () => {
      const { createWindow } = useWindowStore.getState();
      const window = createWindow({
        title: 'Custom Window',
        x: 200,
        y: 150,
        width: 600,
        height: 450,
        resizable: false,
        contentId: 'custom-app',
      });

      expect(window).toMatchObject({
        title: 'Custom Window',
        bounds: { x: 200, y: 150, width: 600, height: 450 },
        resizable: false,
        contentId: 'custom-app',
      });
    });

    it('increments zIndex for each new window', () => {
      const { createWindow } = useWindowStore.getState();

      const window1 = createWindow({ contentId: 'app1' });
      const window2 = createWindow({ contentId: 'app2' });
      const window3 = createWindow({ contentId: 'app3' });

      expect(window1.zIndex).toBe(1);
      expect(window2.zIndex).toBe(2);
      expect(window3.zIndex).toBe(3);
    });

    it('focuses new window and unfocuses others', () => {
      const { createWindow, windows } = useWindowStore.getState();

      createWindow({ contentId: 'app1' });
      createWindow({ contentId: 'app2' });

      const state = useWindowStore.getState();
      expect(state.windows[0].focused).toBe(false);
      expect(state.windows[1].focused).toBe(true);
    });

    it('snaps to grid when enabled', () => {
      const { createWindow, setSnapToGrid, setGridSize } = useWindowStore.getState();

      setSnapToGrid(true);
      setGridSize(50);

      const window = createWindow({
        contentId: 'app',
        x: 123,
        y: 456,
        width: 389,
        height: 271,
      });

      expect(window.bounds).toEqual({
        x: 100,  // 123 snapped to 50
        y: 450,  // 456 snapped to 50
        width: 400,  // 389 snapped to 50
        height: 250,  // 271 snapped to 50
      });
    });
  });

  describe('closeWindow', () => {
    it('removes a window from the store', () => {
      const { createWindow, closeWindow } = useWindowStore.getState();

      const window1 = createWindow({ contentId: 'app1' });
      const window2 = createWindow({ contentId: 'app2' });

      closeWindow(window1.id);

      const { windows } = useWindowStore.getState();
      expect(windows).toHaveLength(1);
      expect(windows[0].id).toBe(window2.id);
    });

    it('does nothing if window does not exist', () => {
      const { createWindow, closeWindow } = useWindowStore.getState();

      createWindow({ contentId: 'app1' });
      closeWindow('non-existent-id');

      const { windows } = useWindowStore.getState();
      expect(windows).toHaveLength(1);
    });
  });

  describe('focusWindow', () => {
    it('focuses a window and increases its zIndex', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();

      const window1 = createWindow({ contentId: 'app1' });
      const window2 = createWindow({ contentId: 'app2' });

      focusWindow(window1.id);

      const { windows } = useWindowStore.getState();
      const focused1 = windows.find((w) => w.id === window1.id);
      const focused2 = windows.find((w) => w.id === window2.id);

      expect(focused1?.focused).toBe(true);
      expect(focused2?.focused).toBe(false);
      expect(focused1?.zIndex).toBeGreaterThan(window2.zIndex);
    });

    it('unfocuses other windows', () => {
      const { createWindow, focusWindow } = useWindowStore.getState();

      const window1 = createWindow({ contentId: 'app1' });
      const window2 = createWindow({ contentId: 'app2' });
      const window3 = createWindow({ contentId: 'app3' });

      focusWindow(window1.id);

      const { windows } = useWindowStore.getState();
      expect(windows.filter((w) => w.focused)).toHaveLength(1);
      expect(windows.find((w) => w.id === window1.id)?.focused).toBe(true);
    });
  });

  describe('moveWindow', () => {
    it('moves a window to new position', () => {
      const { createWindow, moveWindow } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app' });
      moveWindow(window.id, 300, 250);

      const { windows } = useWindowStore.getState();
      expect(windows[0].bounds.x).toBe(300);
      expect(windows[0].bounds.y).toBe(250);
    });

    it('does not move maximized windows', () => {
      const { createWindow, moveWindow, toggleMaximize } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app' });
      toggleMaximize(window.id);
      moveWindow(window.id, 300, 250);

      const { windows } = useWindowStore.getState();
      expect(windows[0].bounds.x).toBe(100);  // Original position
      expect(windows[0].bounds.y).toBe(100);
    });

    it('snaps position to grid when enabled', () => {
      const { createWindow, moveWindow, setSnapToGrid, setGridSize } = useWindowStore.getState();

      setSnapToGrid(true);
      setGridSize(25);

      const window = createWindow({ contentId: 'app' });
      moveWindow(window.id, 137, 263);

      const { windows } = useWindowStore.getState();
      expect(windows[0].bounds.x).toBe(125);  // Snapped to 25
      expect(windows[0].bounds.y).toBe(275);  // Snapped to 25
    });
  });

  describe('resizeWindow', () => {
    it('resizes a window', () => {
      const { createWindow, resizeWindow } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app' });
      resizeWindow(window.id, 800, 600);

      const { windows } = useWindowStore.getState();
      expect(windows[0].bounds.width).toBe(800);
      expect(windows[0].bounds.height).toBe(600);
    });

    it('does not resize non-resizable windows', () => {
      const { createWindow, resizeWindow } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app', resizable: false });
      resizeWindow(window.id, 800, 600);

      const { windows } = useWindowStore.getState();
      expect(windows[0].bounds.width).toBe(400);  // Original size
      expect(windows[0].bounds.height).toBe(300);
    });

    it('snaps size to grid when enabled', () => {
      const { createWindow, resizeWindow, setSnapToGrid, setGridSize } = useWindowStore.getState();

      setSnapToGrid(true);
      setGridSize(100);

      const window = createWindow({ contentId: 'app' });
      resizeWindow(window.id, 723, 489);

      const { windows } = useWindowStore.getState();
      expect(windows[0].bounds.width).toBe(700);  // Snapped to 100
      expect(windows[0].bounds.height).toBe(500);  // Snapped to 100
    });
  });

  describe('toggleMinimize', () => {
    it('minimizes a normal window', () => {
      const { createWindow, toggleMinimize } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app' });
      toggleMinimize(window.id);

      const { windows } = useWindowStore.getState();
      expect(windows[0].mode).toBe('minimized');
    });

    it('restores a minimized window', () => {
      const { createWindow, toggleMinimize } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app' });
      toggleMinimize(window.id);
      toggleMinimize(window.id);

      const { windows } = useWindowStore.getState();
      expect(windows[0].mode).toBe('normal');
    });

    it('does not minimize non-minimizable windows', () => {
      const { createWindow, toggleMinimize } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app', minimizable: false });
      toggleMinimize(window.id);

      const { windows } = useWindowStore.getState();
      expect(windows[0].mode).toBe('normal');
    });
  });

  describe('toggleMaximize', () => {
    it('maximizes a normal window', () => {
      const { createWindow, toggleMaximize } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app' });
      toggleMaximize(window.id);

      const { windows } = useWindowStore.getState();
      expect(windows[0].mode).toBe('maximized');
    });

    it('restores a maximized window', () => {
      const { createWindow, toggleMaximize } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app' });
      toggleMaximize(window.id);
      toggleMaximize(window.id);

      const { windows } = useWindowStore.getState();
      expect(windows[0].mode).toBe('normal');
    });

    it('does not maximize non-maximizable windows', () => {
      const { createWindow, toggleMaximize } = useWindowStore.getState();

      const window = createWindow({ contentId: 'app', maximizable: false });
      toggleMaximize(window.id);

      const { windows } = useWindowStore.getState();
      expect(windows[0].mode).toBe('normal');
    });
  });

  describe('Selectors', () => {
    it('getActiveWindows returns non-minimized windows', () => {
      const { createWindow, toggleMinimize, getActiveWindows } = useWindowStore.getState();

      createWindow({ contentId: 'app1' });
      const window2 = createWindow({ contentId: 'app2' });
      createWindow({ contentId: 'app3' });

      toggleMinimize(window2.id);

      const active = getActiveWindows();
      expect(active).toHaveLength(2);
      expect(active.every((w) => w.mode !== 'minimized')).toBe(true);
    });

    it('getFocusedWindow returns the focused window', () => {
      const { createWindow, getFocusedWindow } = useWindowStore.getState();

      createWindow({ contentId: 'app1' });
      const window2 = createWindow({ contentId: 'app2' });

      const focused = getFocusedWindow();
      expect(focused?.id).toBe(window2.id);
    });

    it('getFocusedWindow returns null if no window is focused', () => {
      const { getFocusedWindow } = useWindowStore.getState();

      const focused = getFocusedWindow();
      expect(focused).toBeNull();
    });

    it('getZOrderedWindows returns windows sorted by zIndex', () => {
      const { createWindow, focusWindow, getZOrderedWindows } = useWindowStore.getState();

      const window1 = createWindow({ contentId: 'app1' });
      const window2 = createWindow({ contentId: 'app2' });
      const window3 = createWindow({ contentId: 'app3' });

      focusWindow(window1.id);  // Brings window1 to front (highest zIndex)

      const ordered = getZOrderedWindows();
      // Sorted ascending, so first has lowest zIndex, last has highest
      expect(ordered[0].zIndex).toBeLessThan(ordered[ordered.length - 1].zIndex);
      expect(ordered[ordered.length - 1].id).toBe(window1.id);  // window1 has highest zIndex
    });
  });

  describe('Grid settings', () => {
    it('setSnapToGrid enables/disables snap to grid', () => {
      const { setSnapToGrid } = useWindowStore.getState();

      setSnapToGrid(true);
      expect(useWindowStore.getState().snapToGrid).toBe(true);

      setSnapToGrid(false);
      expect(useWindowStore.getState().snapToGrid).toBe(false);
    });

    it('setGridSize changes grid size', () => {
      const { setGridSize } = useWindowStore.getState();

      setGridSize(50);
      expect(useWindowStore.getState().gridSize).toBe(50);

      setGridSize(10);
      expect(useWindowStore.getState().gridSize).toBe(10);
    });
  });
});
