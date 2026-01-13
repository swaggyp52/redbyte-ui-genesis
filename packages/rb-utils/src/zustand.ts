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
  const lastStateRef = React.useRef<ExtractState<S> | undefined>(undefined);
  const lastSnapshotRef = React.useRef<U | undefined>(undefined);
  const selectorRef = React.useRef(selector);
  const equalityRef = React.useRef(equalityFn);

  // Always update refs to capture latest closures
  selectorRef.current = selector;
  equalityRef.current = equalityFn;

  const getSnapshot = React.useCallback(() => {
    const state = api.getState();
    if (state === lastStateRef.current && lastSnapshotRef.current !== undefined) {
      return lastSnapshotRef.current as U;
    }
    lastStateRef.current = state;
    const snapshot = selectorRef.current(state);
    
    // Apply equality check to prevent unnecessary updates
    if (lastSnapshotRef.current !== undefined && equalityRef.current(snapshot, lastSnapshotRef.current)) {
      return lastSnapshotRef.current as U;
    }
    
    lastSnapshotRef.current = snapshot;
    return snapshot;
  }, [api]);

  const getServerSnapshot = React.useCallback(() => {
    const state = api.getInitialState();
    if (state === lastStateRef.current && lastSnapshotRef.current !== undefined) {
      return lastSnapshotRef.current as U;
    }
    lastStateRef.current = state;
    const snapshot = selectorRef.current(state);
    lastSnapshotRef.current = snapshot;
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
