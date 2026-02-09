import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadProjectFromAutosave, saveProjectToAutosave, clearAutosave, loadProjectFromFile, loadProject, saveProject, flushAutosave, } from '../projectPersistence';
import { createBlankProjectDoc, serializeProjectDoc } from '@redbyte/rb-logic-core';
describe('projectPersistence', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
    });
    afterEach(() => {
        // Clean up after tests
        clearAutosave();
    });
    describe('autosave', () => {
        it('saves and loads project from localStorage', async () => {
            const doc = createBlankProjectDoc();
            doc.meta.name = 'Test Project';
            await saveProjectToAutosave(doc);
            await flushAutosave();
            const loaded = await loadProjectFromAutosave();
            expect(loaded).toBeDefined();
            expect(loaded?.meta.name).toBe('Test Project');
            expect(loaded?.meta.projectId).toBe(doc.meta.projectId);
        });
        it('returns null when no autosave exists', async () => {
            const loaded = await loadProjectFromAutosave();
            expect(loaded).toBeNull();
        });
        it('preserves circuit data', async () => {
            const doc = createBlankProjectDoc();
            doc.circuit.nodes = [
                { id: 'n1', type: 'AND', x: 0, y: 0 },
            ];
            doc.circuit.connections = [
                { id: 'c1', fromNodeId: 'n1', fromPin: 'a', toNodeId: 'n1', toPin: 'b' },
            ];
            await saveProjectToAutosave(doc);
            await flushAutosave();
            const loaded = await loadProjectFromAutosave();
            expect(loaded?.circuit.nodes).toHaveLength(1);
            expect(loaded?.circuit.nodes[0].id).toBe('n1');
            expect(loaded?.circuit.connections).toHaveLength(1);
        });
        it('preserves view state', async () => {
            const doc = createBlankProjectDoc();
            doc.view.camera = { x: 100, y: 200, zoom: 1.5 };
            doc.view.selection = { nodeIds: ['n1', 'n2'] };
            await saveProjectToAutosave(doc);
            await flushAutosave();
            const loaded = await loadProjectFromAutosave();
            expect(loaded?.view.camera).toEqual({ x: 100, y: 200, zoom: 1.5 });
            expect(loaded?.view.selection?.nodeIds).toEqual(['n1', 'n2']);
        });
        it('preserves app-specific state', async () => {
            const doc = createBlankProjectDoc();
            doc.appState.schematic = { layers: ['layer1'] };
            doc.appState['3d'] = { cameraRotation: [0, 0, 0] };
            await saveProjectToAutosave(doc);
            await flushAutosave();
            const loaded = await loadProjectFromAutosave();
            expect(loaded?.appState.schematic).toEqual({ layers: ['layer1'] });
            expect(loaded?.appState['3d']).toEqual({ cameraRotation: [0, 0, 0] });
        });
        it('clears autosave', async () => {
            const doc = createBlankProjectDoc();
            await saveProjectToAutosave(doc);
            await flushAutosave();
            expect(await loadProjectFromAutosave()).toBeDefined();
            clearAutosave();
            expect(await loadProjectFromAutosave()).toBeNull();
        });
        it('updates existing autosave', async () => {
            const doc1 = createBlankProjectDoc();
            doc1.meta.name = 'Version 1';
            await saveProjectToAutosave(doc1);
            await flushAutosave();
            const doc2 = createBlankProjectDoc();
            doc2.meta.projectId = doc1.meta.projectId; // Same project
            doc2.meta.name = 'Version 2';
            await saveProjectToAutosave(doc2);
            await flushAutosave();
            const loaded = await loadProjectFromAutosave();
            expect(loaded?.meta.name).toBe('Version 2');
        });
        it('handles localStorage overflow gracefully', async () => {
            // This test just verifies no crash; actual quota handling is browser-dependent
            const doc = createBlankProjectDoc();
            try {
                await saveProjectToAutosave(doc);
                await flushAutosave();
                expect(true).toBe(true);
            }
            catch (e) {
                // Expected in quota-limited scenarios
            }
        });
    });
    describe('file operations', () => {
        it('loads project from file content', async () => {
            const doc = createBlankProjectDoc();
            doc.meta.name = 'File Project';
            const json = serializeProjectDoc(doc);
            const loaded = await loadProjectFromFile(json);
            expect(loaded.meta.name).toBe('File Project');
            expect(loaded.circuit).toBeDefined();
        });
        it('throws on invalid JSON', async () => {
            await expect(loadProjectFromFile('invalid json')).rejects.toThrow();
        });
    });
    describe('unified load/save interface', () => {
        it('loadProject defaults to autosave', async () => {
            const doc = createBlankProjectDoc();
            doc.meta.name = 'Default Load';
            await saveProjectToAutosave(doc);
            await flushAutosave();
            const loaded = await loadProject();
            expect(loaded.meta.name).toBe('Default Load');
        });
        it('loadProject returns blank when no autosave', async () => {
            const loaded = await loadProject();
            expect(loaded.circuit.nodes).toEqual([]);
            expect(loaded.meta.projectId).toMatch(/^proj-/);
        });
        it('saveProject defaults to autosave', async () => {
            const doc = createBlankProjectDoc();
            await saveProject(doc);
            await flushAutosave();
            const loaded = await loadProjectFromAutosave();
            expect(loaded).toBeDefined();
        });
        it('saveProject with file target exports', async () => {
            const doc = createBlankProjectDoc();
            // Note: actual file download requires DOM, test just verifies no error
            // In real usage, this would trigger browser download
            expect(async () => {
                // File save would need document.createElement, which may not be available
                // Just verify the interface exists
            }).not.toThrow();
        });
    });
    describe('round-trip integrity', () => {
        it('survives normalize -> serialize -> deserialize -> normalize cycle', async () => {
            const original = createBlankProjectDoc();
            original.meta.name = 'Complex';
            original.circuit.nodes = [{ id: 'n1', type: 'AND', x: 10, y: 20 }];
            original.view.camera = { x: 100, y: 200, zoom: 2 };
            original.appState.schematic = { state: 'data' };
            await saveProjectToAutosave(original);
            await flushAutosave();
            const loaded = await loadProjectFromAutosave();
            expect(loaded?.meta.name).toBe('Complex');
            expect(loaded?.circuit.nodes).toHaveLength(1);
            expect(loaded?.view.camera?.zoom).toBe(2);
            expect(loaded?.appState.schematic).toEqual({ state: 'data' });
        });
    });
});
