import type { Ref, RefObject } from 'react';
import type { Mesh } from 'three';

/** Native mesh forwarding, including actual React19 callback cleanup semantics. */
export function attachSceneMeshRef(mesh: Mesh | null, forwardedRef: Ref<Mesh>, localRef: RefObject<Mesh | null>) {
  localRef.current = mesh;
  if (typeof forwardedRef === 'function') {
    const cleanup = forwardedRef(mesh);
    if (typeof cleanup === 'function') return () => { localRef.current = null; cleanup(); };
  } else if (forwardedRef) {
    forwardedRef.current = mesh;
  }
}
