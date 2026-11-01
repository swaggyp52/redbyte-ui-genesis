import { useCallback, useSyncExternalStore } from 'react';

/** The precise existing host operations used by this read-only circuit view. */
export interface SceneSelectionState {
  readonly selectedNodeIds: ReadonlySet<string>;
  selectNodes: (nodeIds: string[], additive?: boolean) => void;
  setHoveredNode: (nodeId: string | null) => void;
}
export interface SceneSelectionStore {
  getState: () => SceneSelectionState;
  subscribe?: (listener: () => void) => () => void;
}
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export function useSceneSelection(store?: SceneSelectionStore): ReadonlySet<string> {
  const subscribe = useCallback((listener: () => void) => store?.subscribe?.(listener) ?? (() => {}), [store]);
  const getSnapshot = useCallback(() => store?.getState().selectedNodeIds ?? EMPTY_SELECTION, [store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
