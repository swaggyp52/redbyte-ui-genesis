// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Deterministic scale fixtures for Design hierarchy/query work.
 *
 * Generates data in the CANONICAL hierarchy shape (projectHierarchy.ts):
 * ProjectHierarchyDocument with NativeVisualModuleDefinition modules
 * (id/name/displayName/ports/circuit) and instance Nodes carrying
 * config.{moduleDefinitionId, moduleName, instanceName, nativeVisualModule}
 * exactly as placeModuleInstance produces them.
 *
 * NO rendering, NO stores, NO wall-clock time, NO randomness — every call
 * with the same arguments produces byte-identical data (repo determinism
 * invariant). Timestamps are fixed constants.
 *
 * Pure query helpers (searchInstances / expandPath / neighborhood) operate
 * over a flattened ScaleInstanceTree projection so the same query surface
 * serves both the flat 100-module/1,000-instance workspace fixture and the
 * 10,000-instance synthetic tree.
 */

import type { Circuit, Connection, Node } from '@redbyte/rb-logic-core';
import {
  PROJECT_HIERARCHY_SCHEMA_VERSION,
  TOP_MODULE_ID,
  type ModulePort,
  type NativeVisualModuleDefinition,
  type ProjectHierarchyDocument,
} from '../../projectHierarchy';

/** Fixed timestamp for every generated document (determinism invariant). */
export const SCALE_FIXTURE_TIMESTAMP_ISO = '2026-01-01T00:00:00.000Z';

/** Standard workspace fixture: 100 modules x 10 instances = 1,000 instances. */
export const SCALE_FIXTURE_MODULE_COUNT = 100;
export const SCALE_FIXTURE_INSTANCES_PER_MODULE = 10;

/** Standard synthetic tree: 10,000 instances, 8-ary. */
export const SCALE_TREE_INSTANCE_COUNT = 10_000;
export const SCALE_TREE_BRANCHING = 8;
/** Module definition pool size backing the synthetic tree. */
export const SCALE_TREE_MODULE_POOL = 24;

export interface ScaleHierarchyFixture {
  hierarchy: ProjectHierarchyDocument;
  /** Top-module circuit holding every instance node (canonical shape). */
  topCircuit: Circuit;
  /** The instance-node subset of topCircuit.nodes, in placement order. */
  instanceNodes: Node[];
  moduleCount: number;
  instanceCount: number;
}

export interface ScaleInstanceRecord {
  /** Dot path from the top module, e.g. "top.treeMod03_41". */
  path: string;
  instanceName: string;
  moduleDefinitionId: string;
  moduleName: string;
  depth: number;
  parentPath: string | null;
  childPaths: string[];
  /** Canonical instance node (config.moduleDefinitionId / instanceName). */
  node: Node;
}

export interface ScaleInstanceTree {
  /** All records in deterministic creation (BFS) order. */
  records: ScaleInstanceRecord[];
  byPath: Map<string, ScaleInstanceRecord>;
  /** Paths of the depth-1 instances directly under the top module. */
  rootPaths: string[];
  /** Module definition pool the instances reference. */
  modules: NativeVisualModuleDefinition[];
  instanceCount: number;
  branching: number;
}

export interface ScaleNeighborhood {
  paths: Set<string>;
  /** Undirected parent/child hop distance from the seed path. */
  depthByPath: Map<string, number>;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** Mirrors projectHierarchy's slug(): node ids derive from instance names. */
function slugId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Small canonical module body: A xor B -> Y with boundary Switch/Lamp nodes. */
function makeModuleDefinition(moduleId: string, name: string, displayName: string): NativeVisualModuleDefinition {
  const ports: ModulePort[] = [
    {
      id: 'in-1',
      name: 'A',
      direction: 'input',
      width: 1,
      sourceBoundary: { internalRefs: [{ nodeId: 'x0', portName: 'a' }] },
    },
    {
      id: 'in-2',
      name: 'B',
      direction: 'input',
      width: 1,
      sourceBoundary: { internalRefs: [{ nodeId: 'x0', portName: 'b' }] },
    },
    {
      id: 'out-1',
      name: 'Y',
      direction: 'output',
      width: 1,
      sourceBoundary: { internalRefs: [{ nodeId: 'x0', portName: 'out' }] },
    },
  ];
  const circuit: Circuit = {
    nodes: [
      {
        id: 'boundary-in-1',
        type: 'Switch',
        position: { x: 0, y: 0 },
        config: { label: 'A', moduleBoundary: 'input', modulePortId: 'in-1' },
      },
      {
        id: 'boundary-in-2',
        type: 'Switch',
        position: { x: 0, y: 120 },
        config: { label: 'B', moduleBoundary: 'input', modulePortId: 'in-2' },
      },
      { id: 'x0', type: 'XOR', position: { x: 160, y: 60 }, config: {} },
      {
        id: 'boundary-out-1',
        type: 'Lamp',
        position: { x: 320, y: 60 },
        config: { label: 'Y', moduleBoundary: 'output', modulePortId: 'out-1' },
      },
    ],
    connections: [
      { from: { nodeId: 'boundary-in-1', portName: 'out' }, to: { nodeId: 'x0', portName: 'a' } },
      { from: { nodeId: 'boundary-in-2', portName: 'out' }, to: { nodeId: 'x0', portName: 'b' } },
      { from: { nodeId: 'x0', portName: 'out' }, to: { nodeId: 'boundary-out-1', portName: 'in' } },
    ],
  };
  return {
    id: moduleId,
    name,
    displayName,
    kind: 'native-visual',
    ports,
    circuit,
    createdAt: SCALE_FIXTURE_TIMESTAMP_ISO,
    updatedAt: SCALE_FIXTURE_TIMESTAMP_ISO,
  };
}

/** Canonical instance node, shaped exactly like placeModuleInstance output. */
function makeInstanceNode(
  definition: Pick<NativeVisualModuleDefinition, 'id' | 'name'>,
  instanceName: string,
  position: { x: number; y: number },
): Node {
  return {
    id: slugId(instanceName),
    type: definition.name,
    label: instanceName,
    position: { x: position.x, y: position.y },
    x: position.x,
    y: position.y,
    config: {
      moduleDefinitionId: definition.id,
      moduleName: definition.name,
      instanceName,
      label: instanceName,
      nativeVisualModule: true,
    },
  };
}

/**
 * Flat workspace at scale: `moduleCount` module definitions, each placed
 * `instancesPerModule` times in the top circuit. Consecutive instances are
 * chained Y -> A so the top circuit forms one connected graph for
 * neighborhood/trace queries. Deterministic for identical arguments.
 */
export function makeScaleHierarchy(
  moduleCount: number,
  instancesPerModule: number,
): ScaleHierarchyFixture {
  const safeModuleCount = Math.max(0, Math.floor(moduleCount));
  const safeInstancesPerModule = Math.max(0, Math.floor(instancesPerModule));

  const modules: NativeVisualModuleDefinition[] = [];
  for (let m = 0; m < safeModuleCount; m += 1) {
    const name = `ScaleMod${pad(m, 3)}`;
    modules.push(makeModuleDefinition(`module-${slugId(name)}`, name, `Scale Mod ${pad(m, 3)}`));
  }

  const instanceNodes: Node[] = [];
  let placementIndex = 0;
  for (let m = 0; m < safeModuleCount; m += 1) {
    const definition = modules[m];
    for (let k = 0; k < safeInstancesPerModule; k += 1) {
      // Canonical naming: camelCase(module name) + per-module usage index.
      const instanceName = `scaleMod${pad(m, 3)}U${k}`;
      instanceNodes.push(
        makeInstanceNode(definition, instanceName, {
          x: (placementIndex % 40) * 180,
          y: Math.floor(placementIndex / 40) * 140,
        }),
      );
      placementIndex += 1;
    }
  }

  const connections: Connection[] = [];
  for (let i = 0; i + 1 < instanceNodes.length; i += 1) {
    connections.push({
      from: { nodeId: instanceNodes[i].id, portName: 'Y' },
      to: { nodeId: instanceNodes[i + 1].id, portName: 'A' },
    });
  }

  return {
    hierarchy: {
      schemaVersion: PROJECT_HIERARCHY_SCHEMA_VERSION,
      topModuleId: TOP_MODULE_ID,
      activeModuleId: TOP_MODULE_ID,
      modules,
    },
    topCircuit: { nodes: [...instanceNodes], connections },
    instanceNodes,
    moduleCount: safeModuleCount,
    instanceCount: instanceNodes.length,
  };
}

/** Standard 100-module / 1,000-instance workspace fixture. */
export function makeStandardScaleHierarchy(): ScaleHierarchyFixture {
  return makeScaleHierarchy(SCALE_FIXTURE_MODULE_COUNT, SCALE_FIXTURE_INSTANCES_PER_MODULE);
}

/**
 * Synthetic instance tree: a complete `branching`-ary tree of
 * `totalInstances` canonical instance nodes rooted at the top module.
 * Instance i's parent is instance floor(i / branching) - 1 (the first
 * `branching` instances hang off top). Module definitions are assigned
 * round-robin from a fixed pool. Deterministic for identical arguments.
 */
export function makeScaleInstanceTree(
  totalInstances: number,
  branching: number,
): ScaleInstanceTree {
  const total = Math.max(0, Math.floor(totalInstances));
  const arity = Math.max(1, Math.floor(branching));

  const poolSize = Math.min(SCALE_TREE_MODULE_POOL, Math.max(1, total));
  const modules: NativeVisualModuleDefinition[] = [];
  for (let m = 0; m < poolSize; m += 1) {
    const name = `TreeMod${pad(m, 2)}`;
    modules.push(makeModuleDefinition(`module-${slugId(name)}`, name, `Tree Mod ${pad(m, 2)}`));
  }

  const records: ScaleInstanceRecord[] = [];
  const byPath = new Map<string, ScaleInstanceRecord>();
  const rootPaths: string[] = [];

  for (let i = 0; i < total; i += 1) {
    const parentOrdinal = Math.floor(i / arity) - 1;
    const parent = parentOrdinal >= 0 ? records[parentOrdinal] : null;
    const definition = modules[i % poolSize];
    const instanceName = `treeMod${pad(i % poolSize, 2)}_${i}`;
    const parentPath = parent ? parent.path : TOP_MODULE_ID;
    const path = `${parentPath}.${instanceName}`;
    const record: ScaleInstanceRecord = {
      path,
      instanceName,
      moduleDefinitionId: definition.id,
      moduleName: definition.name,
      depth: parent ? parent.depth + 1 : 1,
      parentPath: parent ? parent.path : null,
      childPaths: [],
      node: makeInstanceNode(definition, instanceName, {
        x: (i % 100) * 40,
        y: Math.floor(i / 100) * 40,
      }),
    };
    records.push(record);
    byPath.set(path, record);
    if (parent) {
      parent.childPaths.push(path);
    } else {
      rootPaths.push(path);
    }
  }

  return { records, byPath, rootPaths, modules, instanceCount: records.length, branching: arity };
}

/** Standard 10,000-instance synthetic tree. */
export function makeStandardScaleTree(): ScaleInstanceTree {
  return makeScaleInstanceTree(SCALE_TREE_INSTANCE_COUNT, SCALE_TREE_BRANCHING);
}

/**
 * Project a flat ScaleHierarchyFixture into the same tree shape (all
 * instances at depth 1 under top) so one query surface serves both fixtures.
 */
export function instanceTreeFromScaleHierarchy(fixture: ScaleHierarchyFixture): ScaleInstanceTree {
  const records: ScaleInstanceRecord[] = [];
  const byPath = new Map<string, ScaleInstanceRecord>();
  const rootPaths: string[] = [];
  for (const node of fixture.instanceNodes) {
    const config = node.config ?? {};
    const instanceName = typeof config.instanceName === 'string' ? config.instanceName : node.id;
    const path = `${TOP_MODULE_ID}.${instanceName}`;
    const record: ScaleInstanceRecord = {
      path,
      instanceName,
      moduleDefinitionId: typeof config.moduleDefinitionId === 'string' ? config.moduleDefinitionId : '',
      moduleName: typeof config.moduleName === 'string' ? config.moduleName : node.type,
      depth: 1,
      parentPath: null,
      childPaths: [],
      node,
    };
    records.push(record);
    byPath.set(path, record);
    rootPaths.push(path);
  }
  return {
    records,
    byPath,
    rootPaths,
    modules: fixture.hierarchy.modules,
    instanceCount: records.length,
    branching: records.length,
  };
}

/**
 * Case-insensitive substring search over instance name, path, and module
 * name. Empty/whitespace terms match nothing. Results keep the tree's
 * deterministic record order.
 */
export function searchInstances(tree: ScaleInstanceTree, term: string): ScaleInstanceRecord[] {
  const query = term.trim().toLowerCase();
  if (!query) return [];
  return tree.records.filter(
    (record) =>
      record.instanceName.toLowerCase().includes(query) ||
      record.path.toLowerCase().includes(query) ||
      record.moduleName.toLowerCase().includes(query),
  );
}

/**
 * Ancestor chain a tree UI must expand to reveal `path`: from the top module
 * down to the record itself, inclusive. Returns null for unknown paths.
 */
export function expandPath(tree: ScaleInstanceTree, path: string): string[] | null {
  const target = tree.byPath.get(path);
  if (!target) return null;
  const chain: string[] = [];
  let cursor: ScaleInstanceRecord | undefined = target;
  while (cursor) {
    chain.push(cursor.path);
    cursor = cursor.parentPath ? tree.byPath.get(cursor.parentPath) : undefined;
  }
  chain.push(TOP_MODULE_ID);
  chain.reverse();
  return chain;
}

/**
 * All records within `radius` undirected parent/child hops of `path`
 * (inclusive). Unknown paths yield an empty neighborhood. Radius is floored
 * at 0; non-finite radius is treated as 0.
 */
export function neighborhood(
  tree: ScaleInstanceTree,
  path: string,
  radius: number,
): ScaleNeighborhood {
  const seed = tree.byPath.get(path);
  const depthByPath = new Map<string, number>();
  if (!seed) return { paths: new Set(), depthByPath };

  const maxRadius = Number.isFinite(radius) ? Math.max(0, Math.floor(radius)) : 0;
  depthByPath.set(seed.path, 0);
  const queue: string[] = [seed.path];
  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    const currentDepth = depthByPath.get(currentPath)!;
    if (currentDepth >= maxRadius) continue;
    const current = tree.byPath.get(currentPath)!;
    const adjacent: string[] = current.parentPath
      ? [current.parentPath, ...current.childPaths]
      : [...current.childPaths];
    for (const nextPath of adjacent) {
      if (depthByPath.has(nextPath)) continue;
      depthByPath.set(nextPath, currentDepth + 1);
      queue.push(nextPath);
    }
  }

  return { paths: new Set(depthByPath.keys()), depthByPath };
}
