import { useEffect } from 'react';

/** GPU resources supplied as primitives are owned by their creating component. */
export function useOwnedSceneResource(resource: { dispose: () => void }): void {
  useEffect(() => () => resource.dispose(), [resource]);
}
