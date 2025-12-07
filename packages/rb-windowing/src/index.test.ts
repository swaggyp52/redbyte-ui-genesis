import { describe, expect, it } from 'vitest';
import {
  createWindowingStore,
  selectActiveWindows,
  selectFocusedWindow,
  selectZOrderedWindows,
  type WindowBounds,
} from './index';

const baseWindow = (id: string, bounds?: Partial<WindowBounds>) => ({
  id,
  title: id,
  bounds: { x: 0, y: 0, width: 200, height: 150, ...bounds },
});

describe('windowing store', () => {
  it('opens and focuses windows', () => {
    const store = createWindowingStore();

    store.getState().open(baseWindow('one'));
    store.getState().open(baseWindow('two'));

    expect(selectZOrderedWindows(store.getState()).map((window) => window.id)).toEqual(['one', 'two']);
    expect(store.getState().focusedWindowId).toBe('two');
  });

  it('focuses an existing window and updates z-order', () => {
    const store = createWindowingStore();
    store.getState().open(baseWindow('one'));
    store.getState().open(baseWindow('two'));

    store.getState().focus('one');

    expect(selectZOrderedWindows(store.getState()).map((window) => window.id)).toEqual(['two', 'one']);
    expect(selectFocusedWindow(store.getState())?.id).toBe('one');
  });

  it('moves windows with optional snapping', () => {
    const store = createWindowingStore({ snapToGrid: 10 });
    store.getState().open(baseWindow('one'));

    store.getState().move('one', { dx: 7, dy: 7 });

    expect(store.getState().windows[0].bounds.x).toBe(10);
    expect(store.getState().windows[0].bounds.y).toBe(10);
  });

  it('resizes windows respecting snapping', () => {
    const store = createWindowingStore({ snapToGrid: 8 });
    store.getState().open(baseWindow('one'));

    store.getState().resize('one', { width: 203, height: 141 });

    const window = store.getState().windows[0];
    expect(window.bounds.width).toBe(200);
    expect(window.bounds.height).toBe(144);
  });

  it('closes windows and re-focuses the previous entry', () => {
    const store = createWindowingStore();
    store.getState().open(baseWindow('one'));
    store.getState().open(baseWindow('two'));
    store.getState().open(baseWindow('three'));

    store.getState().close('three');

    expect(store.getState().focusedWindowId).toBe('two');
    expect(selectZOrderedWindows(store.getState()).map((window) => window.id)).toEqual(['one', 'two']);
  });

  it('toggles minimize and maximize states with restore bounds', () => {
    const store = createWindowingStore();
    store.getState().open(baseWindow('one', { width: 320, height: 240 }));

    store.getState().toggleMaximize('one');
    const maximized = store.getState().windows[0];
    expect(maximized.maximized).toBe(true);
    expect(maximized.bounds.width).toBe(1280);

    store.getState().toggleMaximize('one');
    const restored = store.getState().windows[0];
    expect(restored.maximized).toBe(false);
    expect(restored.bounds.width).toBe(320);

    store.getState().toggleMinimize('one');
    expect(selectActiveWindows(store.getState())).toHaveLength(0);
  });
});
