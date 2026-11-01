import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Store } from './store';

/**
 * The kernel's only React binding. Components subscribe to a selected slice; they re-render
 * when that slice changes, not when anything else in the store does.
 */
export function useStoreSelector<T, S>(store: Store<T>, selector: (state: T) => S, equals: (a: S, b: S) => boolean = Object.is): S {
  const cache = useRef<{ state: T; value: S } | null>(null);
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const cached = cache.current;
    if (cached && cached.state === state) return cached.value;
    const value = selector(state);
    if (cached && equals(cached.value, value)) {
      cache.current = { state, value: cached.value };
      return cached.value;
    }
    cache.current = { state, value };
    return value;
  }, [store, selector, equals]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
