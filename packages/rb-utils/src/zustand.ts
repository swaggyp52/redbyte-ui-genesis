import React from 'react';
import { createStore } from 'zustand/vanilla';
import type {
  ExtractState,
  Mutate,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
} from 'zustand/vanilla';

type ReadonlyStoreApi<T> = Pick<StoreApi<T>, 'getState' | 'getInitialState' | 'subscribe'>;

const identity = <T,>(arg: T) => arg;
const refEquality = <T,>(a: T, b: T) => a === b;

// DEV-only unstable snapshot detector
let unstableSnapshotCount = 0;
const MAX_UNSTABLE_LOGS = 3;

export function useStore<S extends ReadonlyStoreApi<unknown>>(api: S): ExtractState<S>;
export function useStore<S extends ReadonlyStoreApi<unknown>, U>(
  api: S,
  selector: (state: ExtractState<S>) => U,
  equalityFn?: (a: U, b: U) => boolean
): U;
export function useStore<S extends ReadonlyStoreApi<unknown>, U>(
  api: S,
  selector: (state: ExtractState<S>) => U = identity as (state: ExtractState<S>) => U,
  equalityFn: (a: U, b: U) => boolean = refEquality
): U {
  // Stable refs that persist across renders
  const selectorRef = React.useRef(selector);
  const equalityRef = React.useRef(equalityFn);
  const cacheRef = React.useRef<{
    lastState: ExtractState<S> | undefined;
    lastSnapshot: U | undefined;
    callCount: number;
  }>({ lastState: undefined, lastSnapshot: undefined, callCount: 0 });

  // Update refs on every render to capture latest closures
  selectorRef.current = selector;
  equalityRef.current = equalityFn;

  // Stable getSnapshot function that only depends on api
  const getSnapshot = React.useCallback((): U => {
    const state = api.getState();
    const cache = cacheRef.current;
    cache.callCount++;
    
    // Compute snapshot
    const snapshot = selectorRef.current(state);
    
    // First call or state changed
    if (cache.lastState !== state) {
      cache.lastState = state;
      
      // Check if equality function would consider these equal
      if (cache.lastSnapshot !== undefined && equalityRef.current(snapshot, cache.lastSnapshot)) {
        // Contents are equal, return cached reference
        if (import.meta.env.DEV && snapshot !== cache.lastSnapshot) {
          if (unstableSnapshotCount < MAX_UNSTABLE_LOGS) {
            unstableSnapshotCount++;
            console.warn('[SNAPSHOT EQUALITY SAVED] Using equality fn to prevent re-render', {
              selectorHint: selectorRef.current.toString().slice(0, 100),
            });
          }
        }
        return cache.lastSnapshot;
      }
      
      cache.lastSnapshot = snapshot;
      return snapshot;
    }
    
    // State hasn't changed - but getSnapshot was called again
    // This is the critical check: if we return a different reference, React will think state changed
    if (snapshot !== cache.lastSnapshot) {
      if (import.meta.env.DEV && unstableSnapshotCount < MAX_UNSTABLE_LOGS) {
        unstableSnapshotCount++;
        console.error('[UNSTABLE SNAPSHOT - SAME STATE, DIFFERENT SNAPSHOT]', {
          callCount: cache.callCount,
          selectorHint: selectorRef.current.toString().slice(0, 100),
          equalityCheckResult: equalityRef.current(snapshot, cache.lastSnapshot),
          hasEqualityFn: equalityRef.current !== refEquality,
        });
        console.trace('Unstable snapshot occurred here');
      }
      // This is the bug: we're about to return a different snapshot
      // Try to apply equality one more time
      if (cache.lastSnapshot !== undefined && equalityRef.current(snapshot, cache.lastSnapshot)) {
        return cache.lastSnapshot;
      }
      cache.lastSnapshot = snapshot;
    }
    
    return cache.lastSnapshot as U;
  }, [api]);

  const getServerSnapshot = React.useCallback((): U => {
    const state = api.getInitialState();
    const cache = cacheRef.current;
    
    if (state === cache.lastState && cache.lastSnapshot !== undefined) {
      return cache.lastSnapshot;
    }
    
    cache.lastState = state;
    const snapshot = selectorRef.current(state);
    cache.lastSnapshot = snapshot;
    return snapshot;
  }, [api]);

  const slice = React.useSyncExternalStore(api.subscribe, getSnapshot, getServerSnapshot);
  React.useDebugValue(slice);
  return slice;
}

export type UseBoundStore<S extends ReadonlyStoreApi<unknown>> = {
  (): ExtractState<S>;
  <U>(selector: (state: ExtractState<S>) => U, equalityFn?: (a: U, b: U) => boolean): U;
} & S;

type Create = {
  <T, Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>
  ): UseBoundStore<Mutate<StoreApi<T>, Mos>>;
  <T>(): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>
  ) => UseBoundStore<Mutate<StoreApi<T>, Mos>>;
};

const createImpl = <T, Mos extends [StoreMutatorIdentifier, unknown][] = []>(
  createState: StateCreator<T, [], Mos>
): UseBoundStore<Mutate<StoreApi<T>, Mos>> => {
  const api = createStore(createState);
  const useBoundStore: UseBoundStore<Mutate<StoreApi<T>, Mos>> = (selector?: any, equalityFn?: any) =>
    useStore(api, selector, equalityFn);
  Object.assign(useBoundStore, api);
  return useBoundStore;
};

export const create = ((createState?: StateCreator<any, [], any>) =>
  createState ? createImpl(createState) : createImpl) as Create;
