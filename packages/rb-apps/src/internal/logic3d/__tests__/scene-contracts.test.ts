import { describe, expect, it } from 'vitest';
import { Mesh } from 'three';
import type { Signal } from '@redbyte/rb-logic-core';
import { copySceneSignals, isSceneSignalHigh, readSceneNodeMove } from '../sceneContracts';

describe('current scene signal and native object boundaries', () => {
  it('preserves X/Z and bus values independently of the engine cache', () => {
    const original = new Map<string, Signal>([['high', 1], ['low', 0], ['unknown', 'X'], ['floating', 'Z'], ['bus', 12]]);
    const projected = copySceneSignals(original);
    expect(projected).toEqual(original);
    expect(projected).not.toBe(original);
    expect(isSceneSignalHigh(projected.get('high'))).toBe(true);
    for (const id of ['low', 'unknown', 'floating', 'bus', 'missing']) expect(isSceneSignalHigh(projected.get(id))).toBe(false);
    original.set('unknown', 0);
    expect(projected.get('unknown')).toBe('X');
    projected.set('floating', 1);
    expect(original.get('floating')).toBe('Z');
  });

  it('maps the actual native transform target without mutating it or accepting invalid identity', () => {
    const mesh = new Mesh();
    mesh.position.set(3, 0.25, 5);
    mesh.userData.nodeId = 'gate1';
    const original = mesh.position.clone();
    expect(readSceneNodeMove(mesh)).toEqual({ nodeId: 'gate1', position: { x: 60, y: 100 } });
    expect(mesh.position.equals(original)).toBe(true);
    mesh.userData.nodeId = 7;
    expect(readSceneNodeMove(mesh)).toBeNull();
    expect(readSceneNodeMove(undefined)).toBeNull();
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
    else mesh.material.dispose();
  });
});
