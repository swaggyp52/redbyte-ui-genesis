// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  PROJECT_HIERARCHY_SCHEMA_VERSION,
  TOP_MODULE_ID,
  normalizeProjectHierarchy,
} from '../../projectHierarchy';
import {
  SCALE_FIXTURE_TIMESTAMP_ISO,
  expandPath,
  instanceTreeFromScaleHierarchy,
  makeScaleHierarchy,
  makeScaleInstanceTree,
  neighborhood,
  searchInstances,
} from '../fixtures/scaleFixtures';

describe('makeScaleHierarchy — canonical hierarchy shape', () => {
  it('produces a ProjectHierarchyDocument that survives canonical normalization unchanged in size', () => {
    const fixture = makeScaleHierarchy(4, 3);
    expect(fixture.hierarchy.schemaVersion).toBe(PROJECT_HIERARCHY_SCHEMA_VERSION);
    expect(fixture.hierarchy.topModuleId).toBe(TOP_MODULE_ID);
    expect(fixture.hierarchy.activeModuleId).toBe(TOP_MODULE_ID);
    expect(fixture.hierarchy.modules).toHaveLength(4);
    // Round-trip through the real normalizer: nothing should be dropped.
    const normalized = normalizeProjectHierarchy(fixture.hierarchy);
    expect(normalized.modules).toHaveLength(4);
    expect(normalized.modules.map((m) => m.name)).toEqual(
      fixture.hierarchy.modules.map((m) => m.name),
    );
  });

  it('modules carry ids, names, and 1-bit ports with boundary refs', () => {
    const fixture = makeScaleHierarchy(2, 1);
    const module = fixture.hierarchy.modules[0];
    expect(module.id).toBe('module-scalemod000');
    expect(module.name).toBe('ScaleMod000');
    expect(module.kind).toBe('native-visual');
    expect(module.ports.map((port) => `${port.direction}:${port.name}`)).toEqual([
      'input:A',
      'input:B',
      'output:Y',
    ]);
    for (const port of module.ports) {
      expect(port.width).toBe(1);
      expect(port.sourceBoundary.internalRefs.length).toBeGreaterThan(0);
    }
    expect(module.createdAt).toBe(SCALE_FIXTURE_TIMESTAMP_ISO);
  });

  it('instance nodes carry canonical config.moduleDefinitionId / instanceName', () => {
    const fixture = makeScaleHierarchy(3, 2);
    expect(fixture.instanceCount).toBe(6);
    expect(fixture.topCircuit.nodes).toHaveLength(6);
    const node = fixture.instanceNodes[0];
    expect(node.config?.moduleDefinitionId).toBe('module-scalemod000');
    expect(node.config?.moduleName).toBe('ScaleMod000');
    expect(node.config?.instanceName).toBe('scaleMod000U0');
    expect(node.config?.nativeVisualModule).toBe(true);
    expect(node.type).toBe('ScaleMod000');
    expect(node.label).toBe('scaleMod000U0');
  });

  it('chains instances with nested-shape connections only', () => {
    const fixture = makeScaleHierarchy(2, 2);
    expect(fixture.topCircuit.connections).toHaveLength(3);
    for (const connection of fixture.topCircuit.connections) {
      expect(typeof connection.from).toBe('object');
      expect(typeof connection.to).toBe('object');
      expect((connection.from as { nodeId: string }).nodeId).toBeTruthy();
      expect((connection.to as { portName: string }).portName).toBeTruthy();
    }
  });

  it('is deterministic: identical arguments produce deep-equal fixtures', () => {
    expect(makeScaleHierarchy(5, 4)).toEqual(makeScaleHierarchy(5, 4));
  });
});

describe('makeScaleInstanceTree — synthetic tree structure', () => {
  it('builds the requested number of instances with consistent parent/child links', () => {
    const tree = makeScaleInstanceTree(30, 3);
    expect(tree.instanceCount).toBe(30);
    expect(tree.records).toHaveLength(30);
    expect(tree.rootPaths).toHaveLength(3);
    for (const record of tree.records) {
      if (record.parentPath) {
        const parent = tree.byPath.get(record.parentPath);
        expect(parent).toBeDefined();
        expect(parent!.childPaths).toContain(record.path);
        expect(record.depth).toBe(parent!.depth + 1);
        expect(record.path.startsWith(`${record.parentPath}.`)).toBe(true);
      } else {
        expect(record.depth).toBe(1);
        expect(record.path.startsWith(`${TOP_MODULE_ID}.`)).toBe(true);
      }
      expect(record.node.config?.moduleDefinitionId).toBe(record.moduleDefinitionId);
      expect(record.node.config?.instanceName).toBe(record.instanceName);
    }
  });

  it('caps children at the branching factor', () => {
    const tree = makeScaleInstanceTree(50, 4);
    for (const record of tree.records) {
      expect(record.childPaths.length).toBeLessThanOrEqual(4);
    }
  });

  it('is deterministic: identical arguments produce deep-equal trees', () => {
    const first = makeScaleInstanceTree(25, 5);
    const second = makeScaleInstanceTree(25, 5);
    expect(second.records).toEqual(first.records);
    expect(second.rootPaths).toEqual(first.rootPaths);
  });
});

describe('searchInstances', () => {
  const tree = makeScaleInstanceTree(40, 4);

  it('matches instance names case-insensitively', () => {
    const hits = searchInstances(tree, 'TREEMOD00_0');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].instanceName).toBe('treeMod00_0');
  });

  it('matches module names (and descendants whose path contains the term)', () => {
    const hits = searchInstances(tree, 'TreeMod01');
    const directHits = tree.records.filter((record) => record.moduleName === 'TreeMod01');
    expect(directHits.length).toBeGreaterThan(0);
    for (const record of directHits) {
      expect(hits).toContain(record);
    }
    // Every hit matches by at least one searched field.
    expect(
      hits.every(
        (hit) =>
          hit.instanceName.toLowerCase().includes('treemod01') ||
          hit.path.toLowerCase().includes('treemod01') ||
          hit.moduleName.toLowerCase().includes('treemod01'),
      ),
    ).toBe(true);
  });

  it('returns nothing for empty or whitespace terms', () => {
    expect(searchInstances(tree, '')).toEqual([]);
    expect(searchInstances(tree, '   ')).toEqual([]);
  });

  it('returns nothing for unmatched terms', () => {
    expect(searchInstances(tree, 'zz-not-there')).toEqual([]);
  });

  it('works over the flat hierarchy fixture through instanceTreeFromScaleHierarchy', () => {
    const flat = instanceTreeFromScaleHierarchy(makeScaleHierarchy(3, 2));
    expect(flat.instanceCount).toBe(6);
    const hits = searchInstances(flat, 'scaleMod002');
    expect(hits).toHaveLength(2);
    expect(hits.every((hit) => hit.moduleName === 'ScaleMod002')).toBe(true);
  });
});

describe('expandPath', () => {
  const tree = makeScaleInstanceTree(40, 4);

  it('returns the ancestor chain from top to the record, inclusive', () => {
    const deep = tree.records.find((record) => record.depth === 3);
    expect(deep).toBeDefined();
    const chain = expandPath(tree, deep!.path);
    expect(chain).not.toBeNull();
    expect(chain![0]).toBe(TOP_MODULE_ID);
    expect(chain![chain!.length - 1]).toBe(deep!.path);
    expect(chain).toHaveLength(deep!.depth + 1);
    // Every hop is a strict path prefix of the next.
    for (let i = 1; i < chain!.length - 1; i += 1) {
      expect(chain![i + 1].startsWith(`${chain![i]}.`)).toBe(true);
    }
  });

  it('returns [top, path] for a depth-1 record', () => {
    const chain = expandPath(tree, tree.rootPaths[0]);
    expect(chain).toEqual([TOP_MODULE_ID, tree.rootPaths[0]]);
  });

  it('returns null for unknown paths', () => {
    expect(expandPath(tree, 'top.ghost')).toBeNull();
  });
});

describe('neighborhood', () => {
  const tree = makeScaleInstanceTree(40, 4);

  it('radius 0 returns only the seed record', () => {
    const seed = tree.records[5];
    const hood = neighborhood(tree, seed.path, 0);
    expect(hood.paths).toEqual(new Set([seed.path]));
    expect(hood.depthByPath.get(seed.path)).toBe(0);
  });

  it('radius 1 returns parent plus children', () => {
    const seed = tree.records.find((record) => record.parentPath && record.childPaths.length > 0);
    expect(seed).toBeDefined();
    const hood = neighborhood(tree, seed!.path, 1);
    expect(hood.paths).toEqual(new Set([seed!.path, seed!.parentPath!, ...seed!.childPaths]));
    expect(hood.depthByPath.get(seed!.parentPath!)).toBe(1);
  });

  it('radius 2 includes siblings (via the parent) and grandchildren', () => {
    const seed = tree.records.find((record) => record.parentPath && record.childPaths.length > 0)!;
    const parent = tree.byPath.get(seed.parentPath!)!;
    const hood = neighborhood(tree, seed.path, 2);
    for (const sibling of parent.childPaths) {
      expect(hood.paths.has(sibling)).toBe(true);
    }
    for (const childPath of seed.childPaths) {
      for (const grandchild of tree.byPath.get(childPath)!.childPaths) {
        expect(hood.paths.has(grandchild)).toBe(true);
        expect(hood.depthByPath.get(grandchild)).toBe(2);
      }
    }
  });

  it('returns an empty neighborhood for unknown paths', () => {
    const hood = neighborhood(tree, 'top.ghost', 3);
    expect(hood.paths.size).toBe(0);
    expect(hood.depthByPath.size).toBe(0);
  });

  it('floors negative and non-finite radii to 0', () => {
    const seed = tree.records[0];
    expect(neighborhood(tree, seed.path, -2).paths).toEqual(new Set([seed.path]));
    expect(neighborhood(tree, seed.path, Number.NaN).paths).toEqual(new Set([seed.path]));
  });
});
