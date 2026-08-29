// @vitest-environment jsdom

/**
 * Scale performance measurements for the Design hierarchy fixtures and the
 * pure query helpers. performance.now is allowed in tests only (repo
 * determinism invariant applies to fixtures/components, not measurements).
 *
 * Ceilings are deliberately GENEROUS — this is a regression tripwire for
 * accidental O(n^2) work, not a benchmark. Actual numbers are logged so real
 * measurements land in the test output/report.
 */

import { describe, expect, it } from 'vitest';
import {
  SCALE_FIXTURE_INSTANCES_PER_MODULE,
  SCALE_FIXTURE_MODULE_COUNT,
  SCALE_TREE_BRANCHING,
  SCALE_TREE_INSTANCE_COUNT,
  expandPath,
  makeScaleHierarchy,
  makeScaleInstanceTree,
  neighborhood,
  searchInstances,
  type ScaleInstanceTree,
} from '../fixtures/scaleFixtures';

const GENERATION_CEILING_MS = 1500;
const SEARCH_CEILING_MS = 150;
const NEIGHBORHOOD_CEILING_MS = 150;
const EXPAND_CEILING_MS = 50;

function timed<T>(label: string, run: () => T): { result: T; elapsedMs: number } {
  const start = performance.now();
  const result = run();
  const elapsedMs = performance.now() - start;
  console.log(`[scalePerf] ${label}: ${elapsedMs.toFixed(2)}ms`);
  return { result, elapsedMs };
}

describe('scale fixture generation', () => {
  it(`generates the ${SCALE_FIXTURE_MODULE_COUNT}-module / 1,000-instance workspace under ${GENERATION_CEILING_MS}ms`, () => {
    const { result, elapsedMs } = timed(
      `makeScaleHierarchy(${SCALE_FIXTURE_MODULE_COUNT}, ${SCALE_FIXTURE_INSTANCES_PER_MODULE})`,
      () => makeScaleHierarchy(SCALE_FIXTURE_MODULE_COUNT, SCALE_FIXTURE_INSTANCES_PER_MODULE),
    );
    expect(result.hierarchy.modules).toHaveLength(SCALE_FIXTURE_MODULE_COUNT);
    expect(result.instanceCount).toBe(
      SCALE_FIXTURE_MODULE_COUNT * SCALE_FIXTURE_INSTANCES_PER_MODULE,
    );
    expect(result.topCircuit.connections).toHaveLength(result.instanceCount - 1);
    expect(elapsedMs).toBeLessThan(GENERATION_CEILING_MS);
  });

  it(`generates the ${SCALE_TREE_INSTANCE_COUNT}-instance synthetic tree under ${GENERATION_CEILING_MS}ms`, () => {
    const { result, elapsedMs } = timed(
      `makeScaleInstanceTree(${SCALE_TREE_INSTANCE_COUNT}, ${SCALE_TREE_BRANCHING})`,
      () => makeScaleInstanceTree(SCALE_TREE_INSTANCE_COUNT, SCALE_TREE_BRANCHING),
    );
    expect(result.instanceCount).toBe(SCALE_TREE_INSTANCE_COUNT);
    expect(result.records).toHaveLength(SCALE_TREE_INSTANCE_COUNT);
    expect(elapsedMs).toBeLessThan(GENERATION_CEILING_MS);
  });
});

describe('query helpers on the 10k tree', () => {
  // Built once; queries below measure query cost only.
  const tree: ScaleInstanceTree = makeScaleInstanceTree(
    SCALE_TREE_INSTANCE_COUNT,
    SCALE_TREE_BRANCHING,
  );

  it(`searchInstances over 10k records stays under ${SEARCH_CEILING_MS}ms`, () => {
    const { result, elapsedMs } = timed("searchInstances(tree, 'treeMod07')", () =>
      searchInstances(tree, 'treeMod07'),
    );
    expect(result.length).toBeGreaterThan(0);
    // A hit may match by instance name, hierarchical path, or module name.
    expect(
      result.every(
        (record) =>
          record.instanceName.toLowerCase().includes('treemod07') ||
          record.path.toLowerCase().includes('treemod07') ||
          record.moduleName.toLowerCase().includes('treemod07'),
      ),
    ).toBe(true);
    expect(elapsedMs).toBeLessThan(SEARCH_CEILING_MS);
  });

  it(`worst-case search (term matching every record) stays under ${SEARCH_CEILING_MS}ms`, () => {
    const { result, elapsedMs } = timed("searchInstances(tree, 'treemod')", () =>
      searchInstances(tree, 'treemod'),
    );
    expect(result).toHaveLength(SCALE_TREE_INSTANCE_COUNT);
    expect(elapsedMs).toBeLessThan(SEARCH_CEILING_MS);
  });

  it(`neighborhood radius 2 around a mid-tree record stays under ${NEIGHBORHOOD_CEILING_MS}ms`, () => {
    const seed = tree.records[Math.floor(tree.records.length / 2)];
    const { result, elapsedMs } = timed(`neighborhood(tree, '${seed.path}', 2)`, () =>
      neighborhood(tree, seed.path, 2),
    );
    expect(result.paths.has(seed.path)).toBe(true);
    expect(result.paths.size).toBeGreaterThan(1);
    expect(elapsedMs).toBeLessThan(NEIGHBORHOOD_CEILING_MS);
  });

  it(`wide neighborhood (radius 6 from a root instance) stays under ${NEIGHBORHOOD_CEILING_MS}ms`, () => {
    const { result, elapsedMs } = timed(`neighborhood(tree, '${tree.rootPaths[0]}', 6)`, () =>
      neighborhood(tree, tree.rootPaths[0], 6),
    );
    expect(result.paths.size).toBeGreaterThan(1000);
    expect(elapsedMs).toBeLessThan(NEIGHBORHOOD_CEILING_MS);
  });

  it(`expandPath on the deepest record stays under ${EXPAND_CEILING_MS}ms`, () => {
    const deepest = tree.records[tree.records.length - 1];
    const { result, elapsedMs } = timed(`expandPath(tree, deepest depth=${deepest.depth})`, () =>
      expandPath(tree, deepest.path),
    );
    expect(result).not.toBeNull();
    expect(result![result!.length - 1]).toBe(deepest.path);
    expect(elapsedMs).toBeLessThan(EXPAND_CEILING_MS);
  });
});
