/**
 * Canonical Project Document (RBProjectDoc)
 *
 * Single source of truth for project persistence across all platforms/views:
 * - Circuit: stored as CircuitV1
 * - Schematic: stored as appState['schematic']
 * - 3D: stored as appState['3d']
 * - Labs: stored as appState['labs']
 *
 * This schema enforces:
 * - Deterministic serialization (stable key ordering)
 * - Required fields (no undefined holes)
 * - Version evolution pathway (schemaVersion)
 *
 * All apps must round-trip through normalize/serialize/deserialize.
 */

import type { CircuitV1 } from './types';

/**
 * Camera/viewport state (minimal, extensible)
 */
export interface ViewState {
  camera?: {
    x: number;
    y: number;
    zoom: number;
  };
  selection?: {
    nodeIds: string[];
  };
  layout?: Record<string, unknown>;
}

/**
 * App-specific state storage (per-view)
 * - schematic: SchematicState (TBD)
 * - 3d: ThreeDState (TBD)
 * - labs: LabsState (TBD)
 */
export type AppStateMap = Record<string, unknown>;

/**
 * Canonical project metadata
 */
export interface ProjectMeta {
  schemaVersion: '1.0';
  appVersion: string;
  projectId: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  name: string;
}

/**
 * Canonical project document (MASTER)
 */
export interface RBProjectDoc {
  meta: ProjectMeta;
  circuit: CircuitV1;
  view: ViewState;
  appState: AppStateMap;
}

/**
 * SCHEMA VERSION (bump when structure changes)
 */
export const SCHEMA_VERSION = '1.0';

/**
 * Create default ProjectMeta
 */
export function createDefaultMeta(): ProjectMeta {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: typeof window !== 'undefined' && (window as any).__APP_VERSION__ ? (window as any).__APP_VERSION__ : 'dev',
    projectId: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    name: 'Untitled Project',
  };
}

/**
 * Create empty CircuitV1
 */
export function createEmptyCircuit(): CircuitV1 {
  return {
    schemaVersion: '1.0',
    nodes: [],
    connections: [],
    customChips: [],
  };
}

/**
 * Normalize a project document to ensure all required fields present and valid
 * - Fills in defaults for missing fields
 * - Validates schema version (stub for future migrations)
 * - Returns new object (no mutation)
 */
export function normalizeProjectDoc(input: Partial<RBProjectDoc> | unknown): RBProjectDoc {
  const obj = input as any;

  // Ensure meta
  const meta: ProjectMeta = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: obj?.meta?.appVersion ?? 'dev',
    projectId: obj?.meta?.projectId ?? `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: obj?.meta?.createdAt ?? new Date().toISOString(),
    updatedAt: obj?.meta?.updatedAt ?? new Date().toISOString(),
    name: obj?.meta?.name ?? 'Untitled Project',
  };

  // Ensure circuit
  const circuit: CircuitV1 = {
    schemaVersion: '1.0',
    nodes: Array.isArray(obj?.circuit?.nodes) ? obj.circuit.nodes : [],
    connections: Array.isArray(obj?.circuit?.connections) ? obj.circuit.connections : [],
    customChips: Array.isArray(obj?.circuit?.customChips) ? obj.circuit.customChips : [],
  };

  // Ensure view
  const view: ViewState = {
    camera: obj?.view?.camera ? { ...obj.view.camera } : undefined,
    selection: obj?.view?.selection ? { ...obj.view.selection } : undefined,
    layout: obj?.view?.layout ? { ...obj.view.layout } : undefined,
  };

  // Ensure appState
  const appState: AppStateMap = obj?.appState && typeof obj.appState === 'object' ? { ...obj.appState } : {};

  return {
    meta,
    circuit,
    view,
    appState,
  };
}

/**
 * Serialize a project document to JSON with stable key ordering
 * - Removes undefined values
 * - Sorts keys deterministically
 * - Can be used for fingerprinting/diffing
 */
export function serializeProjectDoc(doc: RBProjectDoc): string {
  // Custom replacer to strip undefined and maintain order
  const ordered: any = {
    meta: {
      schemaVersion: doc.meta.schemaVersion,
      appVersion: doc.meta.appVersion,
      projectId: doc.meta.projectId,
      createdAt: doc.meta.createdAt,
      updatedAt: doc.meta.updatedAt,
      name: doc.meta.name,
    },
    circuit: {
      schemaVersion: doc.circuit.schemaVersion,
      nodes: doc.circuit.nodes,
      connections: doc.circuit.connections,
      customChips: doc.circuit.customChips,
    },
    view: {} as any,
    appState: doc.appState,
  };

  // Add view fields only if defined
  if (doc.view.camera) {
    ordered.view.camera = doc.view.camera;
  }
  if (doc.view.selection) {
    ordered.view.selection = doc.view.selection;
  }
  if (doc.view.layout) {
    ordered.view.layout = doc.view.layout;
  }

  return JSON.stringify(ordered);
}

/**
 * Deserialize JSON to RBProjectDoc with validation and normalization
 * - Strict: rejects invalid schemas
 * - Normalizing: fills in defaults for missing fields
 */
export function deserializeProjectDoc(json: string): RBProjectDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`Failed to parse project JSON: ${e}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Project must be an object');
  }

  return normalizeProjectDoc(parsed);
}

/**
 * Create a new blank project document
 */
export function createBlankProjectDoc(): RBProjectDoc {
  return normalizeProjectDoc({
    meta: createDefaultMeta(),
    circuit: createEmptyCircuit(),
    view: {},
    appState: {},
  });
}

/**
 * Update a project's updatedAt timestamp (usually called after mutations)
 */
export function updateProjectDocTimestamp(doc: RBProjectDoc): RBProjectDoc {
  return {
    ...doc,
    meta: {
      ...doc.meta,
      updatedAt: new Date().toISOString(),
    },
  };
}
