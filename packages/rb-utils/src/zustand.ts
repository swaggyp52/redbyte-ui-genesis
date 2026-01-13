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
  }>({ lastState: undefined, lastSnapshot: undefined });

  // Update refs on every render to capture latest closures
  selectorRef.current = selector;
  equalityRef.current = equalityFn;

  // Stable getSnapshot function that only depends on api
  const getSnapshot = React.useCallback((): U => {
    const state = api.getState();
    const cache = cacheRef.current;
    
    // Compute the new snapshot
    const newSnapshot = selectorRef.current(state);
    
    // Initialize on first call
    if (cache.lastState === undefined && cache.lastSnapshot === undefined) {
      cache.lastState = state;
      cache.lastSnapshot = newSnapshot;
      return newSnapshot;
    }
    
    // If state hasn't changed, MUST return the cached snapshot reference
    if (state === cache.lastState) {
      return cache.lastSnapshot;
    }
    
    // State changed - compute new snapshot and check equality
    cache.lastState = state;
    
    // If new snapshot is equal to previous (by equality fn), return cached ref
    if (cache.lastSnapshot !== undefined && equalityRef.current(newSnapshot, cache.lastSnapshot)) {
      return cache.lastSnapshot;
    }
    
    // Snapshot is different - update cache and return
    cache.lastSnapshot = newSnapshot;
    return newSnapshot;
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
