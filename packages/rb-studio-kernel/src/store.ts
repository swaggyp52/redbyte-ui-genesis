/**
 * A minimal external store: state, shallow-merge updates and change notification.
 * No framework and no dependency, so the kernel runs in a worker, a node test or any
 * view layer. React binds through `useSyncExternalStore` (see react.ts).
 */
export type Listener<T> = (state: T, previous: T) => void;

export interface Store<T> {
  getState(): T;
  /** Shallow-merges the patch; listeners run only when a top-level field changed identity. */
  setState(patch: Partial<T> | ((state: T) => Partial<T>)): void;
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    getState: () => state,
    setState(patch) {
      const partial = typeof patch === 'function' ? patch(state) : patch;
      let changed = false;
      for (const key of Object.keys(partial) as (keyof T)[]) {
        if (!Object.is(state[key], partial[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      const previous = state;
      state = { ...state, ...partial };
      for (const listener of [...listeners]) listener(state, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
