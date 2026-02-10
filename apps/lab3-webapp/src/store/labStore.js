import { create } from 'zustand';
/**
 * Create an empty LabDoc with 16 truth table rows (4-bit input: 0000-1111)
 * Returns v2 format
 */
export function createEmptyLabDoc() {
    const truthTable = [];
    // Generate all 16 combinations of 4-bit input
    for (let i = 0; i < 16; i++) {
        const b3 = (i >> 3) & 1;
        const b2 = (i >> 2) & 1;
        const b1 = (i >> 1) & 1;
        const b0 = i & 1;
        truthTable.push({
            b3,
            b2,
            b1,
            b0,
            seg: [1, 1, 1, 1, 1, 1, 1], // All segments off (active-low)
            isDontCare: i >= 10, // 10-15 are don't cares for BCD
        });
    }
    const meta = {
        id: crypto.randomUUID(),
        name: 'Untitled Lab',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        useProByDefault: false,
    };
    return {
        schemaVersion: 2,
        meta,
        truthTable,
        kMaps: {},
        expressions: {},
        results: {},
        circuitDesigner: createEmptyCircuitDesigner(),
    };
}
/**
 * Create empty CircuitDesignerDoc
 */
export function createEmptyCircuitDesigner() {
    return {
        nodes: [],
        wires: [],
        view: { panX: 0, panY: 0, zoom: 1 },
        selection: null,
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            toolVersion: '1.0',
        },
    };
}
/**
 * Migrate v1 LabDoc to v2
 * Keeps all v1 fields, adds circuitDesigner + useProByDefault flag
 */
export function migrateV1toV2(v1Doc) {
    return {
        schemaVersion: 2,
        meta: {
            ...v1Doc.meta,
            useProByDefault: false, // Default to Classic for now
        },
        truthTable: v1Doc.truthTable || [],
        kMaps: v1Doc.kMaps || {},
        expressions: v1Doc.expressions || {},
        results: v1Doc.results || {},
        circuitDesigner: createEmptyCircuitDesigner(),
    };
}
/**
 * Validate v2 snapshot (strict)
 */
export function validateSnapshotV2(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const doc = obj;
    // Must be v2
    if (doc.schemaVersion !== 2)
        return false;
    // Check meta
    if (!doc.meta || typeof doc.meta !== 'object')
        return false;
    const meta = doc.meta;
    if (typeof meta.id !== 'string')
        return false;
    if (typeof meta.name !== 'string')
        return false;
    if (typeof meta.createdAt !== 'string')
        return false;
    if (typeof meta.updatedAt !== 'string')
        return false;
    // Check truthTable array
    if (!Array.isArray(doc.truthTable))
        return false;
    // Check circuitDesigner block
    if (!doc.circuitDesigner || typeof doc.circuitDesigner !== 'object')
        return false;
    const cd = doc.circuitDesigner;
    if (!Array.isArray(cd.nodes))
        return false;
    if (!Array.isArray(cd.wires))
        return false;
    // Check other v2 fields exist
    if (typeof doc.kMaps !== 'object')
        return false;
    if (typeof doc.expressions !== 'object')
        return false;
    if (typeof doc.results !== 'object')
        return false;
    return true;
}
/**
 * Serialize a LabDoc to JSON string (simple doc serialization for roundtrip)
 */
export function serializeSnapshot(doc) {
    return JSON.stringify(doc);
}
/**
 * Serialize full store state to JSON string (complete snapshot with metadata)
 */
export function serializeStoreSnapshot(doc, windows, events, eventSeq) {
    const snapshot = {
        schemaVersion: 1,
        sessionId: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        doc,
        windows,
        events,
        eventSeq,
    };
    return JSON.stringify(snapshot);
}
/**
 * Deserialize a LabDoc from JSON string + auto-upgrade v1 to v2
 */
export function deserializeSnapshot(json) {
    const parsed = JSON.parse(json);
    // If v1, migrate to v2
    if (parsed.schemaVersion === 1) {
        return migrateV1toV2(parsed);
    }
    // If v2, validate and return
    if (validateSnapshotV2(parsed)) {
        return parsed;
    }
    // If invalid, return empty v2 doc
    console.warn('Invalid LabDoc snapshot, using empty v2 doc');
    return {
        schemaVersion: 2,
        meta: {
            id: crypto.randomUUID(),
            name: 'Untitled Lab',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            useProByDefault: false,
        },
        truthTable: [],
        kMaps: {},
        expressions: {},
        results: {},
        circuitDesigner: createEmptyCircuitDesigner(),
    };
}
/**
 * Deserialize full store snapshot from JSON string (no validation)
 */
export function deserializeStoreSnapshot(json) {
    return JSON.parse(json);
}
/**
 * Validate a snapshot object (strict validation for v1)
 */
export function validateSnapshotV1(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const snapshot = obj;
    // Check schemaVersion
    if (snapshot.schemaVersion !== 1)
        return false;
    // Check required metadata
    if (typeof snapshot.sessionId !== 'string')
        return false;
    if (typeof snapshot.savedAt !== 'string')
        return false;
    // Check doc exists and has required fields
    if (!snapshot.doc || typeof snapshot.doc !== 'object')
        return false;
    const doc = snapshot.doc;
    if (doc.schemaVersion !== 1)
        return false;
    if (!doc.meta || typeof doc.meta !== 'object')
        return false;
    const meta = doc.meta;
    if (typeof meta.id !== 'string')
        return false;
    if (typeof meta.name !== 'string')
        return false;
    if (typeof meta.createdAt !== 'string')
        return false;
    if (typeof meta.updatedAt !== 'string')
        return false;
    // Check truthTable is an array
    if (!Array.isArray(doc.truthTable))
        return false;
    // Validate each truth table row
    for (const row of doc.truthTable) {
        if (!row || typeof row !== 'object')
            return false;
        const r = row;
        if (typeof r.b3 !== 'number' || (r.b3 !== 0 && r.b3 !== 1))
            return false;
        if (typeof r.b2 !== 'number' || (r.b2 !== 0 && r.b2 !== 1))
            return false;
        if (typeof r.b1 !== 'number' || (r.b1 !== 0 && r.b1 !== 1))
            return false;
        if (typeof r.b0 !== 'number' || (r.b0 !== 0 && r.b0 !== 1))
            return false;
        if (!Array.isArray(r.seg) || r.seg.length !== 7)
            return false;
        for (const bit of r.seg) {
            if (typeof bit !== 'number' || (bit !== 0 && bit !== 1))
                return false;
        }
        if (typeof r.isDontCare !== 'boolean')
            return false;
    }
    // Check other doc fields exist
    if (typeof doc.kMaps !== 'object')
        return false;
    if (typeof doc.expressions !== 'object')
        return false;
    if (typeof doc.results !== 'object')
        return false;
    // Check windows is an array
    if (!Array.isArray(snapshot.windows))
        return false;
    // Check events is an array
    if (!Array.isArray(snapshot.events))
        return false;
    // Check eventSeq is a number
    if (typeof snapshot.eventSeq !== 'number')
        return false;
    return true;
}
/**
 * Create the Zustand store
 */
const useLabStore = create((set, get) => ({
    doc: createEmptyLabDoc(),
    windows: [],
    events: [],
    eventSeq: 0,
    zCounter: 1,
    activeWindowId: undefined,
    setDoc: (doc) => {
        set({ doc });
    },
    updateCircuitDesigner: (circuitDesigner) => {
        const state = get();
        set({
            doc: {
                ...state.doc,
                circuitDesigner,
            },
        });
    },
    setWindows: (windows) => {
        set({ windows });
    },
    emitEvent: (type, payload) => {
        const state = get();
        const newEvent = {
            id: `evt-${state.eventSeq}`,
            ts: new Date().toISOString(),
            type,
            payload,
        };
        // Cap events at 200, removing oldest if needed
        let newEvents = [...state.events, newEvent];
        if (newEvents.length > 200) {
            newEvents = newEvents.slice(newEvents.length - 200);
        }
        set({
            events: newEvents,
            eventSeq: state.eventSeq + 1,
        });
    },
    hydrateFromSnapshot: (snapshot) => {
        // Validate snapshot
        if (!validateSnapshotV1(snapshot)) {
            console.warn('Invalid snapshot format, skipping hydration');
            return;
        }
        set({
            doc: snapshot.doc,
            windows: snapshot.windows,
            events: snapshot.events,
            eventSeq: snapshot.eventSeq,
        });
    },
    discardRecovery: () => {
        set({
            events: [],
            eventSeq: 0,
        });
    },
    bringToFront: (windowId) => {
        const state = get();
        const newZCounter = state.zCounter + 1;
        const updatedWindows = state.windows.map(win => win.id === windowId ? { ...win, z: newZCounter } : win);
        set({
            windows: updatedWindows,
            zCounter: newZCounter,
            activeWindowId: windowId,
        });
    },
    openWindow: (pluginId, viewId, rect) => {
        const state = get();
        const newZCounter = state.zCounter + 1;
        const newWindow = {
            id: crypto.randomUUID(),
            pluginId,
            viewId,
            x: rect?.x ?? 100,
            y: rect?.y ?? 100,
            w: rect?.w ?? 400,
            h: rect?.h ?? 300,
            z: newZCounter,
            minimized: false,
            maximized: false,
        };
        set({
            windows: [...state.windows, newWindow],
            zCounter: newZCounter,
            activeWindowId: newWindow.id,
        });
    },
    closeWindow: (windowId) => {
        const state = get();
        const updatedWindows = state.windows.filter(win => win.id !== windowId);
        set({
            windows: updatedWindows,
            activeWindowId: state.activeWindowId === windowId ? undefined : state.activeWindowId,
        });
    },
}));
export default useLabStore;
