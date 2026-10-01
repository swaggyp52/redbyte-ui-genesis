import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { BufferGeometry, MeshStandardMaterial } from 'three';
import { CircuitEngine, type Signal } from '@redbyte/rb-logic-core';
import { use3DEngineSync } from '../hooks/use3DEngineSync';
import { useSceneSelection, type SceneSelectionState } from '../hooks/useSceneSelection';
import { useOwnedSceneResource } from '../hooks/useOwnedSceneResource';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('actual scene hook lifecycle', () => {
  it('keeps real engine signals, samples at20Hz, and cancels current frames on engine replacement and unmount', () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    let nextId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const request = vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    });
    const cancel = vi.fn((id: number) => { callbacks.delete(id); });
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);

    const engine = new CircuitEngine({ nodes: [], connections: [] });
    const input = new Map<string, Signal>([['a', 'X'], ['b', 'Z'], ['bus', 8]]);
    vi.spyOn(engine, 'getAllSignals').mockImplementation(() => input);
    const replacement = new CircuitEngine({ nodes: [], connections: [] });
    vi.spyOn(replacement, 'getAllSignals').mockReturnValue(new Map<string, Signal>([['a', 1]]));
    const { result, rerender, unmount } = renderHook(({ selectedEngine }) => use3DEngineSync(selectedEngine), {
      initialProps: { selectedEngine: engine },
    });
    try {
      expect(result.current).toEqual(input);
      expect(result.current).not.toBe(input);
      input.set('a', 1);
      expect(result.current.get('a')).toBe('X');
      act(() => {
        now += 50;
        const callback = callbacks.get(0);
        callbacks.delete(0);
        callback?.(now);
      });
      expect(result.current.get('a')).toBe(1);
      expect(result.current.get('b')).toBe('Z');
      expect(result.current.get('bus')).toBe(8);
      rerender({ selectedEngine: replacement });
      expect(cancel).toHaveBeenCalledWith(1);
      expect(result.current).toEqual(new Map([['a', 1]]));
      const lateCallback = callbacks.get(2);
      unmount();
      expect(cancel).toHaveBeenCalledWith(2);
      expect(callbacks.size).toBe(0);
      const requestCount = request.mock.calls.length;
      lateCallback?.(now + 50);
      expect(request).toHaveBeenCalledTimes(requestCount);
    } finally {
      unmount();
    }
  });

  it('cancels animation frame identifier zero', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const engine = new CircuitEngine({ nodes: [], connections: [] });
    const { unmount } = renderHook(() => use3DEngineSync(engine));
    unmount();
    expect(cancel).toHaveBeenCalledWith(0);
  });

  it('subscribes to the actual host store and removes that subscription on unmount', () => {
    const store = createStore<SceneSelectionState>((set) => ({
      selectedNodeIds: new Set<string>(),
      selectNodes: (ids, additive = false) => set(state => ({ selectedNodeIds: new Set(additive ? [...state.selectedNodeIds, ...ids] : ids) })),
      setHoveredNode: () => {},
    }));
    const actualSubscribe = store.subscribe;
    const unsubscribed = vi.fn();
    vi.spyOn(store, 'subscribe').mockImplementation(listener => {
      const unsubscribe = actualSubscribe(listener);
      return () => { unsubscribe(); unsubscribed(); };
    });
    const { result, unmount } = renderHook(() => useSceneSelection(store));
    try {
      expect(result.current.size).toBe(0);
      act(() => store.getState().selectNodes(['near']));
      expect([...result.current]).toEqual(['near']);
      act(() => store.getState().selectNodes(['far'], true));
      expect([...result.current]).toEqual(['near', 'far']);
    } finally {
      unmount();
    }
    expect(unsubscribed).toHaveBeenCalledOnce();
  });

  it('keeps unchanged native geometry alive across material changes and disposes each owned resource once', () => {
    const geometry = new BufferGeometry();
    const firstMaterial = new MeshStandardMaterial();
    const nextMaterial = new MeshStandardMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const firstDispose = vi.spyOn(firstMaterial, 'dispose');
    const nextDispose = vi.spyOn(nextMaterial, 'dispose');
    const { rerender, unmount } = renderHook(({ material }) => {
      useOwnedSceneResource(geometry);
      useOwnedSceneResource(material);
    }, { initialProps: { material: firstMaterial } });
    try {
      rerender({ material: nextMaterial });
      expect(firstDispose).toHaveBeenCalledOnce();
      expect(geometryDispose).not.toHaveBeenCalled();
      expect(nextDispose).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(nextDispose).toHaveBeenCalledOnce();
  });
});
