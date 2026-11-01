import { createRef, type RefCallback } from 'react';
import { Mesh } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { attachSceneMeshRef } from '../sceneRefs';

function disposeMesh(mesh: Mesh) {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
  else mesh.material.dispose();
}

describe('native mesh forwarding through actual React ref types', () => {
  it('forwards the real mesh into local and external object refs, and clears both', () => {
    const mesh = new Mesh();
    const localRef = createRef<Mesh>();
    const forwardedRef = createRef<Mesh>();
    try {
      expect(attachSceneMeshRef(mesh, forwardedRef, localRef)).toBeUndefined();
      expect(localRef.current).toBe(mesh);
      expect(forwardedRef.current).toBe(mesh);
      attachSceneMeshRef(null, forwardedRef, localRef);
      expect(localRef.current).toBeNull();
      expect(forwardedRef.current).toBeNull();
    } finally { disposeMesh(mesh); }
  });

  it('preserves the legacy callback mount/null notification contract', () => {
    const mesh = new Mesh();
    const localRef = createRef<Mesh>();
    const callback = vi.fn();
    try {
      expect(attachSceneMeshRef(mesh, callback, localRef)).toBeUndefined();
      attachSceneMeshRef(null, callback, localRef);
      expect(callback.mock.calls).toEqual([[mesh], [null]]);
      expect(localRef.current).toBeNull();
    } finally { disposeMesh(mesh); }
  });

  it('preserves a React19 callback cleanup and releases the local mesh at cleanup', () => {
    const mesh = new Mesh();
    const localRef = createRef<Mesh>();
    const cleanup = vi.fn();
    const received: Array<Mesh | null> = [];
    const callback: RefCallback<Mesh> = instance => { received.push(instance); return cleanup; };
    try {
      const forwardedCleanup = attachSceneMeshRef(mesh, callback, localRef);
      expect(received).toEqual([mesh]);
      expect(localRef.current).toBe(mesh);
      if (!forwardedCleanup) throw new Error('Actual React19 cleanup must be preserved');
      forwardedCleanup();
      expect(cleanup).toHaveBeenCalledOnce();
      expect(localRef.current).toBeNull();
      expect(received).toEqual([mesh]);
    } finally { disposeMesh(mesh); }
  });
});
