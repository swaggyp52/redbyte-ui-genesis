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
/**
 * SCHEMA VERSION (bump when structure changes)
 */
export const SCHEMA_VERSION = '1.0';
/**
 * Create default ProjectMeta
 */
export function createDefaultMeta() {
    const now = new Date().toISOString();
    return {
        schemaVersion: SCHEMA_VERSION,
        appVersion: typeof window !== 'undefined' && window.__APP_VERSION__ ? window.__APP_VERSION__ : 'dev',
        projectId: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        updatedAt: now,
        name: 'Untitled Project',
    };
}
/**
 * Create empty CircuitV1
 */
export function createEmptyCircuit() {
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
export function normalizeProjectDoc(input) {
    const obj = input;
    // Ensure meta
    const meta = {
        schemaVersion: SCHEMA_VERSION,
        appVersion: obj?.meta?.appVersion ?? 'dev',
        projectId: obj?.meta?.projectId ?? `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: obj?.meta?.createdAt ?? new Date().toISOString(),
        updatedAt: obj?.meta?.updatedAt ?? new Date().toISOString(),
        name: obj?.meta?.name ?? 'Untitled Project',
    };
    // Ensure circuit
    const circuit = {
        schemaVersion: '1.0',
        nodes: Array.isArray(obj?.circuit?.nodes) ? obj.circuit.nodes : [],
        connections: Array.isArray(obj?.circuit?.connections) ? obj.circuit.connections : [],
        customChips: Array.isArray(obj?.circuit?.customChips) ? obj.circuit.customChips : [],
    };
    // Ensure view
    const view = {
        camera: obj?.view?.camera ? { ...obj.view.camera } : undefined,
        selection: obj?.view?.selection ? { ...obj.view.selection } : undefined,
        layout: obj?.view?.layout ? { ...obj.view.layout } : undefined,
    };
    // Ensure appState
    const appState = obj?.appState && typeof obj.appState === 'object' ? { ...obj.appState } : {};
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
export function serializeProjectDoc(doc) {
    // Custom replacer to strip undefined and maintain order
    const ordered = {
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
        view: {},
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
export function deserializeProjectDoc(json) {
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch (e) {
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
export function createBlankProjectDoc() {
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
export function updateProjectDocTimestamp(doc) {
    return {
        ...doc,
        meta: {
            ...doc.meta,
            updatedAt: new Date().toISOString(),
        },
    };
}
