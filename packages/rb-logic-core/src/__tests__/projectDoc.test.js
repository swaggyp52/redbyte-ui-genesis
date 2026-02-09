import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION, createDefaultMeta, createEmptyCircuit, createBlankProjectDoc, normalizeProjectDoc, serializeProjectDoc, deserializeProjectDoc, updateProjectDocTimestamp, } from '../projectDoc';
describe('RBProjectDoc', () => {
    describe('createBlankProjectDoc', () => {
        it('creates a valid blank project', () => {
            const doc = createBlankProjectDoc();
            expect(doc.meta).toBeDefined();
            expect(doc.meta.schemaVersion).toBe(SCHEMA_VERSION);
            expect(doc.meta.projectId).toMatch(/^proj-/);
            expect(doc.circuit).toBeDefined();
            expect(doc.circuit.nodes).toEqual([]);
            expect(doc.circuit.connections).toEqual([]);
            expect(doc.view).toBeDefined();
            expect(doc.appState).toEqual({});
        });
    });
    describe('createDefaultMeta', () => {
        it('creates meta with required fields', () => {
            const meta = createDefaultMeta();
            expect(meta.schemaVersion).toBe(SCHEMA_VERSION);
            expect(meta.appVersion).toBeTruthy();
            expect(meta.projectId).toMatch(/^proj-/);
            expect(meta.createdAt).toBeTruthy();
            expect(meta.updatedAt).toBeTruthy();
            expect(new Date(meta.createdAt)).toBeInstanceOf(Date);
        });
    });
    describe('createEmptyCircuit', () => {
        it('creates empty circuit with valid structure', () => {
            const circuit = createEmptyCircuit();
            expect(circuit.schemaVersion).toBe('1.0');
            expect(circuit.nodes).toEqual([]);
            expect(circuit.connections).toEqual([]);
            expect(circuit.customChips).toEqual([]);
        });
    });
    describe('normalizeProjectDoc', () => {
        it('fills in defaults for partial doc', () => {
            const partial = {
                meta: { name: 'Test' },
            };
            const normalized = normalizeProjectDoc(partial);
            expect(normalized.meta.schemaVersion).toBe(SCHEMA_VERSION);
            expect(normalized.meta.name).toBe('Test');
            expect(normalized.meta.projectId).toMatch(/^proj-/);
            expect(normalized.circuit).toEqual(createEmptyCircuit());
            expect(normalized.view).toEqual({});
            expect(normalized.appState).toEqual({});
        });
        it('preserves existing fields', () => {
            const doc = createBlankProjectDoc();
            doc.meta.name = 'My Project';
            doc.circuit.nodes = [{ id: 'n1', type: 'PowerSource', x: 0, y: 0 }];
            const normalized = normalizeProjectDoc(doc);
            expect(normalized.meta.name).toBe('My Project');
            expect(normalized.circuit.nodes).toHaveLength(1);
            expect(normalized.circuit.nodes[0].id).toBe('n1');
        });
        it('handles invalid input gracefully', () => {
            const normalized = normalizeProjectDoc(null);
            expect(normalized.meta).toBeDefined();
            expect(normalized.circuit).toBeDefined();
            expect(normalized.circuit.nodes).toEqual([]);
        });
        it('removes undefined view fields', () => {
            const normalized = normalizeProjectDoc({
                view: {
                    camera: undefined,
                    selection: undefined,
                },
            });
            expect(normalized.view.camera).toBeUndefined();
            expect(normalized.view.selection).toBeUndefined();
        });
    });
    describe('serializeProjectDoc', () => {
        it('produces valid JSON string', () => {
            const doc = createBlankProjectDoc();
            const json = serializeProjectDoc(doc);
            expect(typeof json).toBe('string');
            const parsed = JSON.parse(json);
            expect(parsed.meta).toBeDefined();
            expect(parsed.circuit).toBeDefined();
        });
        it('maintains deterministic ordering', () => {
            const doc1 = createBlankProjectDoc();
            doc1.meta.updatedAt = '2025-01-01T00:00:00Z';
            doc1.appState = { 'schematic': { x: 1 }, '3d': { y: 2 } };
            const doc2 = createBlankProjectDoc();
            doc2.meta.updatedAt = '2025-01-01T00:00:00Z';
            doc2.appState = { '3d': { y: 2 }, 'schematic': { x: 1 } };
            // Note: JSON.stringify doesn't guarantee order, but our implementation is ordered
            const json1 = serializeProjectDoc(doc1);
            const json2 = serializeProjectDoc(doc2);
            // Both should deserialize to equivalent structures
            const parsed1 = deserializeProjectDoc(json1);
            const parsed2 = deserializeProjectDoc(json2);
            expect(parsed1.appState).toEqual(parsed2.appState);
        });
        it('excludes undefined view fields', () => {
            const doc = createBlankProjectDoc();
            doc.view.camera = undefined;
            doc.view.selection = undefined;
            const json = serializeProjectDoc(doc);
            const parsed = JSON.parse(json);
            expect(parsed.view.camera).toBeUndefined();
            expect(parsed.view.selection).toBeUndefined();
        });
    });
    describe('deserializeProjectDoc', () => {
        it('deserializes valid JSON to doc', () => {
            const original = createBlankProjectDoc();
            const json = serializeProjectDoc(original);
            const deserialized = deserializeProjectDoc(json);
            expect(deserialized.meta.schemaVersion).toBe(SCHEMA_VERSION);
            expect(deserialized.circuit.nodes).toEqual(original.circuit.nodes);
        });
        it('throws on invalid JSON', () => {
            expect(() => deserializeProjectDoc('not json')).toThrow();
        });
        it('throws on non-object JSON', () => {
            expect(() => deserializeProjectDoc('"string"')).toThrow();
            expect(() => deserializeProjectDoc('null')).toThrow();
        });
        it('normalizes deserialized data', () => {
            const partial = JSON.stringify({
                meta: { name: 'Test' },
            });
            const doc = deserializeProjectDoc(partial);
            expect(doc.meta.schemaVersion).toBe(SCHEMA_VERSION);
            expect(doc.meta.projectId).toMatch(/^proj-/);
            expect(doc.circuit.nodes).toEqual([]);
        });
    });
    describe('updateProjectDocTimestamp', () => {
        it('updates the updatedAt field', async () => {
            const doc = createBlankProjectDoc();
            const original = doc.meta.updatedAt;
            // Small delay to ensure timestamp changes (millisecond precision)
            await new Promise(r => setTimeout(r, 2));
            const updated = updateProjectDocTimestamp(doc);
            expect(updated.meta.updatedAt).not.toBe(original);
            expect(new Date(updated.meta.updatedAt)).toBeInstanceOf(Date);
            expect(updated.meta.updatedAt >= original).toBe(true);
        });
        it('preserves all other fields', () => {
            const doc = createBlankProjectDoc();
            doc.meta.name = 'Test';
            doc.circuit.nodes = [{ id: 'n1', type: 'AND', x: 0, y: 0 }];
            const updated = updateProjectDocTimestamp(doc);
            expect(updated.meta.name).toBe('Test');
            expect(updated.circuit.nodes).toHaveLength(1);
            expect(updated.meta.projectId).toBe(doc.meta.projectId);
        });
        it('does not mutate original doc', () => {
            const doc = createBlankProjectDoc();
            const originalTime = doc.meta.updatedAt;
            updateProjectDocTimestamp(doc);
            expect(doc.meta.updatedAt).toBe(originalTime);
        });
    });
    describe('Round-trip serialization', () => {
        it('survives serialize -> deserialize -> serialize cycle', () => {
            const original = createBlankProjectDoc();
            original.meta.name = 'Complex Project';
            original.circuit.nodes = [{ id: 'n1', type: 'AND', x: 10, y: 20 }];
            original.view.camera = { x: 100, y: 200, zoom: 1.5 };
            original.appState.schematic = { someState: 'value' };
            const json1 = serializeProjectDoc(original);
            const deserialized = deserializeProjectDoc(json1);
            const json2 = serializeProjectDoc(deserialized);
            expect(JSON.parse(json1)).toEqual(JSON.parse(json2));
            expect(deserialized.meta.name).toBe(original.meta.name);
            expect(deserialized.circuit.nodes).toEqual(original.circuit.nodes);
            expect(deserialized.view.camera).toEqual(original.view.camera);
        });
    });
});
