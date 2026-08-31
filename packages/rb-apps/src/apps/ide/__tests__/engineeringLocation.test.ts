import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { TOP_MODULE_ID, computeModulePath } from '../projectHierarchy';
import type { NativeVisualModuleDefinition } from '../projectHierarchy';
import {
  MAX_LOCATION_HISTORY,
  normalizeLocation,
  sameLocation,
  useEngineeringLocation,
} from '../engineeringLocation';

/**
 * P1-G — engineering-location history. Pure navigation state: Back/Forward/Up
 * over {mode, moduleId}. No second authority; the shell applies what these
 * return.
 */

beforeEach(() => {
  useEngineeringLocation.getState().reset({ mode: 'project', moduleId: TOP_MODULE_ID });
});

describe('engineeringLocation history', () => {
  it('normalizes module identity to Design only', () => {
    expect(normalizeLocation({ mode: 'verify', moduleId: 'mod_1' })).toEqual({
      mode: 'verify',
      moduleId: TOP_MODULE_ID,
    });
    expect(normalizeLocation({ mode: 'design', moduleId: 'mod_1' })).toEqual({
      mode: 'design',
      moduleId: 'mod_1',
    });
    expect(normalizeLocation({ mode: 'design', moduleId: '' })).toEqual({
      mode: 'design',
      moduleId: TOP_MODULE_ID,
    });
  });

  it('records visits and steps back through them', () => {
    const s = () => useEngineeringLocation.getState();
    s().visit({ mode: 'design', moduleId: TOP_MODULE_ID });
    s().visit({ mode: 'design', moduleId: 'mod_fa' });
    s().visit({ mode: 'verify', moduleId: TOP_MODULE_ID });

    expect(s().present).toEqual({ mode: 'verify', moduleId: TOP_MODULE_ID });
    expect(s().back()).toEqual({ mode: 'design', moduleId: 'mod_fa' });
    expect(s().back()).toEqual({ mode: 'design', moduleId: TOP_MODULE_ID });
    expect(s().back()).toEqual({ mode: 'project', moduleId: TOP_MODULE_ID });
    expect(s().back()).toBeNull();
  });

  it('steps forward after stepping back and re-applies redo', () => {
    const s = () => useEngineeringLocation.getState();
    s().visit({ mode: 'design', moduleId: 'mod_fa' });
    s().visit({ mode: 'verify', moduleId: TOP_MODULE_ID });
    s().back();
    expect(s().present).toEqual({ mode: 'design', moduleId: 'mod_fa' });
    expect(s().forward()).toEqual({ mode: 'verify', moduleId: TOP_MODULE_ID });
    expect(s().forward()).toBeNull();
  });

  it('a new visit after back clears the redo stack', () => {
    const s = () => useEngineeringLocation.getState();
    s().visit({ mode: 'design', moduleId: 'mod_fa' });
    s().visit({ mode: 'verify', moduleId: TOP_MODULE_ID });
    s().back(); // present = design/mod_fa, future = [verify]
    s().visit({ mode: 'hardware', moduleId: TOP_MODULE_ID });
    expect(s().future).toHaveLength(0);
    expect(s().forward()).toBeNull();
  });

  it('is idempotent when re-visiting the present', () => {
    const s = () => useEngineeringLocation.getState();
    s().visit({ mode: 'design', moduleId: 'mod_fa' });
    const beforePast = s().past.length;
    s().visit({ mode: 'design', moduleId: 'mod_fa' });
    // Module-only differences within the same mode are the same only when equal.
    expect(s().past.length).toBe(beforePast);
  });

  it('bounds history to MAX_LOCATION_HISTORY', () => {
    const s = () => useEngineeringLocation.getState();
    for (let i = 0; i < MAX_LOCATION_HISTORY + 20; i += 1) {
      s().visit({ mode: 'design', moduleId: `mod_${i}` });
    }
    expect(s().past.length).toBeLessThanOrEqual(MAX_LOCATION_HISTORY);
  });

  it('sameLocation compares mode + module', () => {
    expect(sameLocation({ mode: 'design', moduleId: 'a' }, { mode: 'design', moduleId: 'a' })).toBe(true);
    expect(sameLocation({ mode: 'design', moduleId: 'a' }, { mode: 'design', moduleId: 'b' })).toBe(false);
    expect(sameLocation({ mode: 'design', moduleId: 'a' }, { mode: 'verify', moduleId: 'a' })).toBe(false);
  });
});

describe('computeModulePath — drill trail', () => {
  const module = (id: string, circuit: Circuit): NativeVisualModuleDefinition => ({
    id,
    name: id,
    displayName: id,
    kind: 'native-visual',
    ports: [],
    circuit,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  });
  const instance = (defId: string): Circuit['nodes'][number] => ({
    id: `inst_${defId}`,
    type: defId,
    config: { moduleDefinitionId: defId },
  });

  it('returns [TOP] for the top module', () => {
    const top: Circuit = { nodes: [], connections: [] };
    expect(computeModulePath(top, [], TOP_MODULE_ID)).toEqual([TOP_MODULE_ID]);
  });

  it('resolves a two-level drill chain top → A → B', () => {
    const bCircuit: Circuit = { nodes: [], connections: [] };
    const aCircuit: Circuit = { nodes: [instance('B')], connections: [] };
    const top: Circuit = { nodes: [instance('A')], connections: [] };
    const modules = [module('A', aCircuit), module('B', bCircuit)];
    expect(computeModulePath(top, modules, 'B')).toEqual([TOP_MODULE_ID, 'A', 'B']);
    expect(computeModulePath(top, modules, 'A')).toEqual([TOP_MODULE_ID, 'A']);
  });

  it('falls back to [TOP, id] for an unreachable module', () => {
    const top: Circuit = { nodes: [], connections: [] };
    const modules = [module('Orphan', { nodes: [], connections: [] })];
    expect(computeModulePath(top, modules, 'Orphan')).toEqual([TOP_MODULE_ID, 'Orphan']);
  });
});
