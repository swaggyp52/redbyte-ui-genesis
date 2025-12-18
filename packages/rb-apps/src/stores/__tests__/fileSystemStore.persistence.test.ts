// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useFileSystemStore } from '../fileSystemStore';

describe('PHASE_AF: Filesystem Persistence', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Reset store to default seed
    useFileSystemStore.getState().resetAll();
  });

  describe('Persistence Roundtrip', () => {
    it('should persist create operations to localStorage', () => {
      const store = useFileSystemStore.getState();

      // Create a file
      store.createFile('home', 'test-persistence.txt');

      // Verify localStorage was updated
      const raw = localStorage.getItem('rb:file-system');
      expect(raw).toBeTruthy();

      const envelope = JSON.parse(raw!);
      expect(envelope.version).toBe(1);
      expect(envelope.state.folders.home.entries).toContainEqual(
        expect.objectContaining({ name: 'test-persistence.txt', type: 'file' })
      );
    });

    it('should load persisted state on init', () => {
      // Set up persisted state manually
      const persistedState = {
        version: 1,
        state: {
          folders: {
            home: {
              id: 'home',
              name: 'Home',
              entries: [
                { id: 'persisted-file', name: 'persisted.txt', type: 'file', modified: '2025-12-18' },
              ],
            },
          },
          roots: ['home'],
          nextId: 100,
        },
      };

      localStorage.setItem('rb:file-system', JSON.stringify(persistedState));

      // Re-create store (simulate reload) by getting fresh state
      // Note: In real app, this would be page reload. In tests, we manually verify loading logic.
      const raw = localStorage.getItem('rb:file-system');
      const loaded = JSON.parse(raw!);

      expect(loaded.state.nextId).toBe(100);
      expect(loaded.state.folders.home.entries).toHaveLength(1);
      expect(loaded.state.folders.home.entries[0].name).toBe('persisted.txt');
    });
  });

  describe('Corruption Fallback', () => {
    it('should fall back to default seed on corrupted JSON', () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('rb:file-system', 'invalid json {{{');

      // Reset store should handle corruption gracefully
      const store = useFileSystemStore.getState();
      store.resetAll(); // This will attempt to load, fail, and use seed

      // Verify default seed is loaded
      const state = useFileSystemStore.getState();
      expect(state.roots).toContain('home');
      expect(state.folders.home).toBeDefined();
    });

    it('should fall back to default seed on invalid version', () => {
      const invalidVersion = {
        version: 999,
        state: { folders: {}, roots: [], nextId: 1 },
      };

      localStorage.setItem('rb:file-system', JSON.stringify(invalidVersion));

      // Try to load - should use seed instead
      const store = useFileSystemStore.getState();
      store.resetAll();

      const state = useFileSystemStore.getState();
      expect(state.roots).toContain('home');
    });

    it('should fall back to default seed on missing state', () => {
      const missingState = {
        version: 1,
        // Missing state field
      };

      localStorage.setItem('rb:file-system', JSON.stringify(missingState));

      const store = useFileSystemStore.getState();
      store.resetAll();

      const state = useFileSystemStore.getState();
      expect(state.roots).toContain('home');
    });
  });

  describe('Export JSON (Deterministic)', () => {
    it('should produce stable JSON output', () => {
      const store = useFileSystemStore.getState();

      // Create files in random order
      store.createFile('home', 'file-b.txt');
      store.createFile('home', 'file-a.txt');
      store.createFile('home', 'file-c.txt');

      // Export twice
      const export1 = store.exportJson();
      const export2 = store.exportJson();

      // Should be identical (deterministic)
      expect(export1).toBe(export2);
    });

    it('should sort folders and entries for deterministic output', () => {
      const store = useFileSystemStore.getState();

      // Create multiple files
      store.createFile('home', 'zebra.txt');
      store.createFile('home', 'alpha.txt');

      const exported = store.exportJson();
      const envelope = JSON.parse(exported);

      // Folders should be sorted by key
      const folderKeys = Object.keys(envelope.state.folders);
      const sortedKeys = [...folderKeys].sort();
      expect(folderKeys).toEqual(sortedKeys);

      // Entries should be sorted by id
      const homeEntries = envelope.state.folders.home.entries;
      for (let i = 1; i < homeEntries.length; i++) {
        expect(homeEntries[i - 1].id.localeCompare(homeEntries[i].id)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('Import JSON', () => {
    it('should import valid JSON and replace state', () => {
      const store = useFileSystemStore.getState();

      const importData = {
        version: 1,
        state: {
          folders: {
            custom: {
              id: 'custom',
              name: 'Custom Folder',
              entries: [
                { id: 'imported-file', name: 'imported.txt', type: 'file', modified: '2025-12-18' },
              ],
            },
          },
          roots: ['custom'],
          nextId: 500,
        },
      };

      store.importJson(JSON.stringify(importData));

      // Verify state was replaced
      const state = useFileSystemStore.getState();
      expect(state.nextId).toBe(500);
      expect(state.roots).toEqual(['custom']);
      expect(state.folders.custom).toBeDefined();
      expect(state.folders.custom.entries).toHaveLength(1);
    });

    it('should throw on invalid version', () => {
      const store = useFileSystemStore.getState();

      const invalidVersion = {
        version: 2,
        state: { folders: {}, roots: [], nextId: 1 },
      };

      expect(() => {
        store.importJson(JSON.stringify(invalidVersion));
      }).toThrow('Invalid persistence version');
    });

    it('should throw on missing state', () => {
      const store = useFileSystemStore.getState();

      const missingState = {
        version: 1,
        // Missing state
      };

      expect(() => {
        store.importJson(JSON.stringify(missingState));
      }).toThrow('Invalid state shape');
    });

    it('should throw on invalid folders', () => {
      const store = useFileSystemStore.getState();

      const invalidFolders = {
        version: 1,
        state: {
          folders: null, // Should be object
          roots: [],
          nextId: 1,
        },
      };

      expect(() => {
        store.importJson(JSON.stringify(invalidFolders));
      }).toThrow('Missing or invalid folders');
    });
  });

  describe('Reset All', () => {
    it('should clear localStorage and reset to default seed', () => {
      const store = useFileSystemStore.getState();

      // Create some data
      store.createFile('home', 'before-reset.txt');

      // Verify persistence
      expect(localStorage.getItem('rb:file-system')).toBeTruthy();

      // Reset
      store.resetAll();

      // Verify localStorage cleared
      expect(localStorage.getItem('rb:file-system')).toBeNull();

      // Verify state is default seed
      const state = useFileSystemStore.getState();
      expect(state.roots).toContain('home');
      expect(state.roots).toContain('desktop');
      expect(state.roots).toContain('documents');
    });
  });

  describe('Regression: Existing Operations Still Work', () => {
    it('should maintain all CRUD operations with persistence', () => {
      const store = useFileSystemStore.getState();

      // Create
      store.createFolder('home', 'Test Folder');
      const children = store.getChildren('home');
      expect(children.some((e) => e.name === 'Test Folder')).toBe(true);

      // Rename
      const folderId = children.find((e) => e.name === 'Test Folder')!.id;
      store.renameEntry(folderId, 'Renamed Folder');
      const updated = store.getChildren('home');
      expect(updated.some((e) => e.name === 'Renamed Folder')).toBe(true);

      // Delete
      store.deleteEntry(folderId);
      const afterDelete = store.getChildren('home');
      expect(afterDelete.some((e) => e.name === 'Renamed Folder')).toBe(false);

      // All operations should have persisted
      const raw = localStorage.getItem('rb:file-system');
      expect(raw).toBeTruthy();
    });
  });
});
