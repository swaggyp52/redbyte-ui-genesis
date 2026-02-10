import { create } from 'zustand';
import { DIGIT_PATTERNS, segToNumber, createEmptyTruthTable } from '../types';
import { evaluateBoolExpr } from '../kmap';
import { recomputeDerived } from '../derive/recomputeDerived';
// ─── Factory helpers (unchanged) ──────────────────────────
export function createEmptyLabDoc() {
    const truthTable = [];
    for (let i = 0; i < 16; i++) {
        const b3 = (i >> 3) & 1;
        const b2 = (i >> 2) & 1;
        const b1 = (i >> 1) & 1;
        const b0 = i & 1;
        truthTable.push({
            b3, b2, b1, b0,
            seg: [1, 1, 1, 1, 1, 1, 1],
            isDontCare: i >= 10,
        });
    }
    const meta = {
        id: crypto.randomUUID(),
        name: 'Untitled Lab',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        useProByDefault: false,
    };
    const doc = {
        schemaVersion: 2,
        meta,
        truthTable,
        kMaps: {},
        expressions: {},
        results: {},
        circuitDesigner: createEmptyCircuitDesigner(),
    };
    // Initialize derived data in doc
    const derived = recomputeDerived(doc);
    return { ...doc, ...derived };
}
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
export function migrateV1toV2(v1Doc) {
    const doc = {
        schemaVersion: 2,
        meta: { ...v1Doc.meta, useProByDefault: false },
        truthTable: v1Doc.truthTable || [],
        kMaps: v1Doc.kMaps || {},
        expressions: v1Doc.expressions || {},
        results: v1Doc.results || {},
        circuitDesigner: createEmptyCircuitDesigner(),
    };
    // Recompute derived to ensure consistency
    const derived = recomputeDerived(doc);
    return { ...doc, ...derived };
}
export function validateSnapshotV2(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const doc = obj;
    if (doc.schemaVersion !== 2)
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
    if (!Array.isArray(doc.truthTable))
        return false;
    if (!doc.circuitDesigner || typeof doc.circuitDesigner !== 'object')
        return false;
    const cd = doc.circuitDesigner;
    if (!Array.isArray(cd.nodes))
        return false;
    if (!Array.isArray(cd.wires))
        return false;
    if (typeof doc.kMaps !== 'object')
        return false;
    if (typeof doc.expressions !== 'object')
        return false;
    if (typeof doc.results !== 'object')
        return false;
    return true;
}
export function serializeSnapshot(doc) {
    return JSON.stringify(doc);
}
export function serializeStoreSnapshot(doc, windows, events, eventSeq, ui) {
    const snapshot = {
        schemaVersion: 1,
        sessionId: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        doc,
        windows,
        events,
        eventSeq,
        ui: ui,
    };
    return JSON.stringify(snapshot);
}
export function deserializeSnapshot(json) {
    const parsed = JSON.parse(json);
    if (parsed.schemaVersion === 1)
        return migrateV1toV2(parsed);
    if (validateSnapshotV2(parsed))
        return parsed;
    console.warn('Invalid LabDoc snapshot, using empty v2 doc');
    return createEmptyLabDoc();
}
export function deserializeStoreSnapshot(json) {
    return JSON.parse(json);
}
export function validateSnapshotV1(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const snapshot = obj;
    if (snapshot.schemaVersion !== 1 && snapshot.schemaVersion !== 2)
        return false;
    if (typeof snapshot.sessionId !== 'string')
        return false;
    if (typeof snapshot.savedAt !== 'string')
        return false;
    if (!snapshot.doc || typeof snapshot.doc !== 'object')
        return false;
    if (!Array.isArray(snapshot.windows))
        return false;
    if (!Array.isArray(snapshot.events))
        return false;
    if (typeof snapshot.eventSeq !== 'number')
        return false;
    // Validate doc structure (loose — accept both v1 and v2 docs)
    const doc = snapshot.doc;
    if (!doc.meta || typeof doc.meta !== 'object')
        return false;
    if (!Array.isArray(doc.truthTable))
        return false;
    return true;
}
// ─── Store ────────────────────────────────────────────
const useLabStore = create((set, get) => ({
    doc: createEmptyLabDoc(),
    windows: [],
    events: [],
    eventSeq: 0,
    zCounter: 1,
    activeWindowId: undefined,
    simulationInput: 0,
    implMode: 'table',
    verilogCode: '',
    simulationMode: 'manual',
    currentStep: 0,
    validationResults: [],
    waveformHistory: [],
    hoveredInputRow: undefined,
    hoveredKmapCell: undefined,
    // ─── Core mutation: ALL doc changes flow through here ───
    updateDoc: (mutator, eventType, eventPayload) => {
        const state = get();
        const mutated = mutator(state.doc);
        // Recompute derived and merge into doc
        const derived = recomputeDerived(mutated);
        const nextDoc = { ...mutated, ...derived };
        const updates = { doc: nextDoc };
        if (eventType) {
            const evt = {
                id: `evt-${state.eventSeq}`,
                ts: new Date().toISOString(),
                type: eventType,
                payload: eventPayload,
            };
            let newEvents = [...state.events, evt];
            if (newEvents.length > 200)
                newEvents = newEvents.slice(-200);
            updates.events = newEvents;
            updates.eventSeq = state.eventSeq + 1;
        }
        set(updates);
    },
    // ─── Truth table ───
    setTableRow: (index, partial) => {
        get().updateDoc((doc) => ({
            ...doc,
            truthTable: doc.truthTable.map((row, i) => (i === index ? { ...row, ...partial } : row)),
        }), 'truthTable.edit', { row: index, changes: partial });
    },
    toggleDontCare: (index) => {
        get().updateDoc((doc) => ({
            ...doc,
            truthTable: doc.truthTable.map((row, i) => i === index
                ? { ...row, isDontCare: !row.isDontCare, seg: !row.isDontCare ? [1, 1, 1, 1, 1, 1, 1] : row.seg }
                : row),
        }), 'truthTable.toggleDontCare', { row: index });
    },
    fillStandardDigits: () => {
        get().updateDoc((doc) => ({
            ...doc,
            truthTable: doc.truthTable.map((row, i) => {
                if (i < 10)
                    return { ...row, seg: DIGIT_PATTERNS[i], isDontCare: false };
                return { ...row, isDontCare: true, seg: [1, 1, 1, 1, 1, 1, 1] };
            }),
        }), 'truthTable.fillStandardDigits', {});
    },
    // ─── K-Maps / Boolean expressions ───
    generateKMaps: () => {
        // Now a no-op trigger that just forces recompute through updateDoc
        get().updateDoc((doc) => doc, 'kmap.regenerate', {});
    },
    setBooleanExpr: (segmentName, expr) => {
        // User manually editing an expression — store it in doc.expressions
        get().updateDoc((doc) => ({
            ...doc,
            expressions: { ...doc.expressions, [segmentName]: expr },
        }), 'expression.edit', { segment: segmentName, expr });
    },
    // ─── Simulation ───
    setSimulationInput: (value) => {
        set({ simulationInput: value });
        get().emitEvent('sim.inputChange', { value });
    },
    // ─── Cross-view hover linking ───
    setHoveredInputRow: (row) => {
        set({ hoveredInputRow: row });
    },
    setHoveredKmapCell: (cell) => {
        set({ hoveredKmapCell: cell });
    },
    setSimulationMode: (mode) => {
        const updates = { simulationMode: mode };
        if (mode === 'step') {
            updates.currentStep = 0;
            updates.waveformHistory = [];
        }
        set(updates);
        get().emitEvent('sim.modeChange', { mode });
    },
    stepSimulation: () => {
        const state = get();
        if (state.currentStep >= 16)
            return;
        const input = state.currentStep;
        const actual = state.evalSeg(input);
        const sample = {
            time: input,
            inputs: [
                ((input >> 3) & 1),
                ((input >> 2) & 1),
                ((input >> 1) & 1),
                (input & 1),
            ],
            outputs: [
                ((actual >> 0) & 1),
                ((actual >> 1) & 1),
                ((actual >> 2) & 1),
                ((actual >> 3) & 1),
                ((actual >> 4) & 1),
                ((actual >> 5) & 1),
                ((actual >> 6) & 1),
            ],
        };
        set({
            waveformHistory: [...state.waveformHistory, sample],
            currentStep: state.currentStep + 1,
        });
        get().emitEvent('sim.step', { step: input });
    },
    resetSimulation: () => {
        set({ waveformHistory: [], currentStep: 0 });
        get().emitEvent('sim.reset', {});
    },
    runAllVectors: () => {
        const state = get();
        const results = [];
        const waveforms = [];
        for (let i = 0; i < 16; i++) {
            const actual = state.evalSeg(i);
            const row = state.doc.truthTable[i];
            const expected = row ? segToNumber(row.seg) : 0b1111111;
            const pass = i < 10 ? actual === expected : true;
            results.push({ input: i, expected, actual, pass });
            waveforms.push({
                time: i,
                inputs: [((i >> 3) & 1), ((i >> 2) & 1), ((i >> 1) & 1), (i & 1)],
                outputs: [
                    ((actual >> 0) & 1), ((actual >> 1) & 1),
                    ((actual >> 2) & 1), ((actual >> 3) & 1),
                    ((actual >> 4) & 1), ((actual >> 5) & 1),
                    ((actual >> 6) & 1),
                ],
            });
        }
        set({ validationResults: results, waveformHistory: waveforms, currentStep: 16 });
        get().emitEvent('sim.runAllVectors', { passCount: results.filter(r => r.pass).length, total: 16 });
    },
    evalSeg: (input) => {
        const state = get();
        if (state.implMode === 'verilogCase') {
            const regex = new RegExp(`4'b${input.toString(2).padStart(4, '0')}:\\s*seg\\s*=\\s*7'b([01]{7});`);
            const match = regex.exec(state.verilogCode);
            if (match)
                return parseInt(match[1], 2);
            return 0b1111111;
        }
        if (state.implMode === 'boolExpr') {
            let result = 0;
            const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
            for (let i = 0; i < segNames.length; i++) {
                const expr = state.doc.expressions[segNames[i]] || '';
                const val = evaluateBoolExpr(expr, input) ? 1 : 0;
                result |= val << i;
            }
            return result;
        }
        // Default: table mode — read directly from truth table
        const row = state.doc.truthTable[input];
        if (!row)
            return 0b1111111;
        return segToNumber(row.seg);
    },
    // ─── Verilog ───
    setVerilogCode: (code) => {
        set({ verilogCode: code });
        get().emitEvent('verilog.edit', {});
    },
    parseVerilogCase: (code) => {
        const regex = /4'b([01]{4}):\s*seg\s*=\s*7'b([01]{7});/g;
        const newTable = createEmptyTruthTable();
        let match;
        while ((match = regex.exec(code)) !== null) {
            const input = parseInt(match[1], 2);
            const seg = match[2].split('').map((s) => (parseInt(s) ? 1 : 0));
            newTable[input] = { ...newTable[input], seg, isDontCare: false };
        }
        get().updateDoc((doc) => ({ ...doc, truthTable: newTable }), 'verilog.import', { lineCount: newTable.filter(r => !r.isDontCare).length });
        set({ implMode: 'verilogCase', verilogCode: code });
    },
    generateVerilogFromExpr: () => {
        const state = get();
        const expressions = state.doc.expressions;
        let code = `module ssd_driver(\n  input [3:0] B,\n  output reg [6:0] seg\n);\n\nalways @(*) begin\n  seg = 7'b0000000;\n`;
        const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        for (let i = 0; i < segNames.length; i++) {
            const expr = expressions[segNames[i]] || '0';
            code += `  assign seg[${i}] = ${expr};\n`;
        }
        code += `end\n\nendmodule\n`;
        return code;
    },
    // ─── Circuit designer (existing, now goes through updateDoc) ───
    setDoc: (doc) => {
        if (doc.schemaVersion === 2) {
            const v2 = doc;
            const derived = recomputeDerived(v2);
            set({ doc: { ...v2, ...derived } });
        }
        else {
            const v2 = migrateV1toV2(doc);
            set({ doc: v2 });
        }
    },
    updateCircuitDesigner: (circuitDesigner) => {
        get().updateDoc((doc) => ({ ...doc, circuitDesigner }), 'circuit.update', { nodeCount: circuitDesigner.nodes.length, wireCount: circuitDesigner.wires.length });
    },
    // ─── Windows (unchanged) ───
    setWindows: (windows) => set({ windows }),
    bringToFront: (windowId) => {
        const state = get();
        const newZ = state.zCounter + 1;
        set({
            windows: state.windows.map(w => (w.id === windowId ? { ...w, z: newZ } : w)),
            zCounter: newZ,
            activeWindowId: windowId,
        });
    },
    openWindow: (pluginId, viewId, rect) => {
        const state = get();
        const newZ = state.zCounter + 1;
        const win = {
            id: crypto.randomUUID(),
            pluginId,
            viewId,
            x: rect?.x ?? 100,
            y: rect?.y ?? 100,
            w: rect?.w ?? 400,
            h: rect?.h ?? 300,
            z: newZ,
            minimized: false,
            maximized: false,
        };
        set({ windows: [...state.windows, win], zCounter: newZ, activeWindowId: win.id });
    },
    closeWindow: (windowId) => {
        const state = get();
        set({
            windows: state.windows.filter(w => w.id !== windowId),
            activeWindowId: state.activeWindowId === windowId ? undefined : state.activeWindowId,
        });
    },
    // ─── Events (unchanged) ───
    emitEvent: (type, payload) => {
        const state = get();
        const evt = { id: `evt-${state.eventSeq}`, ts: new Date().toISOString(), type, payload };
        let newEvents = [...state.events, evt];
        if (newEvents.length > 200)
            newEvents = newEvents.slice(-200);
        set({ events: newEvents, eventSeq: state.eventSeq + 1 });
    },
    // ─── Persistence ───
    hydrateFromSnapshot: (snapshot) => {
        if (!validateSnapshotV1(snapshot)) {
            console.warn('Invalid snapshot, skipping hydration');
            return;
        }
        // Auto-migrate v1 docs to v2
        let doc;
        const rawDoc = snapshot.doc;
        if (rawDoc.schemaVersion === 1 || !rawDoc.circuitDesigner) {
            doc = migrateV1toV2(rawDoc);
        }
        else {
            doc = rawDoc;
            // Ensure derived data is fresh
            const derived = recomputeDerived(doc);
            doc = { ...doc, ...derived };
        }
        const ui = snapshot.ui;
        set({
            doc,
            windows: snapshot.windows,
            events: snapshot.events,
            eventSeq: snapshot.eventSeq,
            simulationInput: ui?.simulationInput ?? 0,
            implMode: ui?.implMode ?? 'table',
            verilogCode: ui?.verilogCode ?? '',
        });
        get().emitEvent('session.hydrate', { docId: doc.meta.id, windowCount: snapshot.windows.length });
    },
    discardRecovery: () => set({ events: [], eventSeq: 0 }),
    exportJSON: () => {
        const state = get();
        return serializeStoreSnapshot(state.doc, state.windows, state.events, state.eventSeq, { simulationInput: state.simulationInput, implMode: state.implMode, verilogCode: state.verilogCode });
    },
    importJSON: (json) => {
        try {
            const parsed = JSON.parse(json);
            // Full snapshot?
            if (parsed.schemaVersion && parsed.windows && parsed.events) {
                get().hydrateFromSnapshot(parsed);
                return;
            }
            // Legacy: just a doc or partial export
            const doc = deserializeSnapshot(json);
            const derived = recomputeDerived(doc);
            set({ doc: { ...doc, ...derived } });
            get().emitEvent('doc.import', { docId: doc.meta.id });
        }
        catch (e) {
            console.error('Failed to import JSON:', e);
        }
    },
    reset: () => {
        const doc = createEmptyLabDoc();
        set({
            doc,
            simulationInput: 0,
            implMode: 'table',
            verilogCode: '',
            simulationMode: 'manual',
            currentStep: 0,
            windows: [],
            events: [],
            eventSeq: 0,
            zCounter: 1,
            activeWindowId: undefined,
            validationResults: [],
            waveformHistory: [],
        });
    },
}));
// Named export for views migrating from old store
export { useLabStore };
export default useLabStore;
