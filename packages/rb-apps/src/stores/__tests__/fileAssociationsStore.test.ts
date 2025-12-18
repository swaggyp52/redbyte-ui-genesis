// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, afterEach } from 'vitest';
import {
  useFileAssociationsStore,
  resolveDefaultTarget,
  loadFileAssociations,
} from '../fileAssociationsStore';
import type { FileActionTarget } from '../../apps/files/fileActionTargets';

describe('PHASE_AA: File Associations Store', () => {
  afterEach(() => {
    localStorage.clear();
    // Reset store to initial state
    const store = useFileAssociationsStore.getState();
    store.associations = {};
  });

  describe('Extension Normalization', () => {
    it('normalizes extension by removing leading dot', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', '.txt', 'text-viewer');

      // Should store as "txt" (normalized)
      expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');
      expect(store.getDefaultTarget('file', '.txt')).toBe('text-viewer');
    });

    it('normalizes extension to lowercase', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', 'TXT', 'text-viewer');

      // Should store as "txt" (normalized)
      expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');
      expect(store.getDefaultTarget('file', 'TXT')).toBe('text-viewer');
    });

    it('normalizes extension with both leading dot and uppercase', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', '.RBLOGIC', 'logic-playground');

      // Should store as "rblogic" (normalized)
      expect(store.getDefaultTarget('file', 'rblogic')).toBe('logic-playground');
      expect(store.getDefaultTarget('file', '.rblogic')).toBe('logic-playground');
      expect(store.getDefaultTarget('file', 'RBLOGIC')).toBe('logic-playground');
      expect(store.getDefaultTarget('file', '.RBLOGIC')).toBe('logic-playground');
    });
  });

  describe('Get/Set/Clear Operations', () => {
    it('returns null for unknown file type', () => {
      const store = useFileAssociationsStore.getState();

      expect(store.getDefaultTarget('file', 'unknown')).toBe(null);
    });

    it('sets and gets default target for file type', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', 'txt', 'text-viewer');

      expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');
    });

    it('clears default target for file type', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', 'txt', 'text-viewer');
      expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');

      store.clearDefaultTarget('file', 'txt');
      expect(store.getDefaultTarget('file', 'txt')).toBe(null);
    });

    it('supports multiple file types with different defaults', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', 'txt', 'text-viewer');
      store.setDefaultTarget('file', 'rblogic', 'logic-playground');
      store.setDefaultTarget('file', 'md', 'text-viewer');

      expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');
      expect(store.getDefaultTarget('file', 'rblogic')).toBe('logic-playground');
      expect(store.getDefaultTarget('file', 'md')).toBe('text-viewer');
    });

    it('overwrites existing default for same file type', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', 'txt', 'text-viewer');
      expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');

      store.setDefaultTarget('file', 'txt', 'other-viewer');
      expect(store.getDefaultTarget('file', 'txt')).toBe('other-viewer');
    });

    it('supports folder resource type', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('folder', 'project', 'ide');
      expect(store.getDefaultTarget('folder', 'project')).toBe('ide');
    });

    it('keeps file and folder defaults separate', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', 'txt', 'text-viewer');
      store.setDefaultTarget('folder', 'txt', 'folder-viewer');

      expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');
      expect(store.getDefaultTarget('folder', 'txt')).toBe('folder-viewer');
    });
  });

  describe('LocalStorage Persistence', () => {
    it('persists default target to localStorage on set', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', 'txt', 'text-viewer');

      const saved = localStorage.getItem('rb:file-associations');
      expect(saved).not.toBe(null);

      const parsed = JSON.parse(saved!);
      expect(parsed.associations.file.txt).toBe('text-viewer');
    });

    it('persists default target removal to localStorage on clear', () => {
      const store = useFileAssociationsStore.getState();

      store.setDefaultTarget('file', 'txt', 'text-viewer');
      store.clearDefaultTarget('file', 'txt');

      const saved = localStorage.getItem('rb:file-associations');
      expect(saved).not.toBe(null);

      const parsed = JSON.parse(saved!);
      expect(parsed.associations.file?.txt).toBe(undefined);
    });

    it('loads persisted defaults on store initialization', () => {
      // Manually set localStorage data
      const data = {
        associations: {
          file: {
            txt: 'text-viewer',
            rblogic: 'logic-playground',
          },
        },
      };
      localStorage.setItem('rb:file-associations', JSON.stringify(data));

      // Create new store instance (this happens on initial load)
      const loaded = loadFileAssociations();

      expect(loaded).not.toBe(null);
      expect(loaded!.associations.file.txt).toBe('text-viewer');
      expect(loaded!.associations.file.rblogic).toBe('logic-playground');
    });

    it('handles corrupted JSON in localStorage', () => {
      localStorage.setItem('rb:file-associations', '{invalid json}');

      const loaded = loadFileAssociations();

      // Should return null for corrupted data
      expect(loaded).toBe(null);
    });

    it('handles invalid schema in localStorage', () => {
      localStorage.setItem('rb:file-associations', JSON.stringify({ wrong: 'schema' }));

      const loaded = loadFileAssociations();

      // Should return null for invalid schema
      expect(loaded).toBe(null);
    });

    it('handles invalid associations object in localStorage', () => {
      localStorage.setItem('rb:file-associations', JSON.stringify({
        associations: 'not an object',
      }));

      const loaded = loadFileAssociations();

      // Should return null for invalid associations
      expect(loaded).toBe(null);
    });

    it('handles invalid file/folder value in localStorage', () => {
      localStorage.setItem('rb:file-associations', JSON.stringify({
        associations: {
          file: 'not an object',
        },
      }));

      const loaded = loadFileAssociations();

      // Should return null for invalid file value
      expect(loaded).toBe(null);
    });
  });

  describe('resolveDefaultTarget', () => {
    const mockTargets: FileActionTarget[] = [
      {
        id: 'text-viewer',
        name: 'Text Viewer',
        appId: 'text-viewer',
        isEligible: (type, name) => type === 'file' && name.endsWith('.txt'),
      },
      {
        id: 'logic-playground',
        name: 'Logic Playground',
        appId: 'logic-playground',
        isEligible: (type, name) => type === 'file' && name.endsWith('.rblogic'),
      },
    ];

    afterEach(() => {
      localStorage.clear();
      // Reset store
      const store = useFileAssociationsStore.getState();
      store.associations = {};
    });

    it('returns saved default if exists and is eligible', () => {
      const store = useFileAssociationsStore.getState();
      store.setDefaultTarget('file', 'txt', 'text-viewer');

      const result = resolveDefaultTarget('file', 'txt', mockTargets);

      expect(result).toBe('text-viewer');
    });

    it('falls back to first eligible target if no default saved', () => {
      // No default set
      const result = resolveDefaultTarget('file', 'txt', mockTargets);

      // Should return first eligible target (text-viewer is first in array)
      expect(result).toBe('text-viewer');
    });

    it('falls back to first eligible if saved default not in eligible list', () => {
      const store = useFileAssociationsStore.getState();
      store.setDefaultTarget('file', 'txt', 'unknown-viewer');

      const result = resolveDefaultTarget('file', 'txt', mockTargets);

      // Should fall back to first eligible target
      expect(result).toBe('text-viewer');
    });

    it('throws if eligibleTargets is empty', () => {
      expect(() => {
        resolveDefaultTarget('file', 'txt', []);
      }).toThrow('resolveDefaultTarget called with empty eligibleTargets');
    });

    it('normalizes extension before looking up default', () => {
      const store = useFileAssociationsStore.getState();
      store.setDefaultTarget('file', '.TXT', 'text-viewer');

      // Should normalize "txt" to "txt" and find the saved default
      const result = resolveDefaultTarget('file', 'txt', mockTargets);

      expect(result).toBe('text-viewer');
    });

    it('deterministically returns first eligible target when multiple targets available', () => {
      const multipleTargets: FileActionTarget[] = [
        {
          id: 'viewer-a',
          name: 'Viewer A',
          appId: 'viewer-a',
          isEligible: (type, name) => type === 'file' && name.endsWith('.txt'),
        },
        {
          id: 'viewer-b',
          name: 'Viewer B',
          appId: 'viewer-b',
          isEligible: (type, name) => type === 'file' && name.endsWith('.txt'),
        },
      ];

      // No default set - should always return first target
      const result1 = resolveDefaultTarget('file', 'txt', multipleTargets);
      const result2 = resolveDefaultTarget('file', 'txt', multipleTargets);
      const result3 = resolveDefaultTarget('file', 'txt', multipleTargets);

      expect(result1).toBe('viewer-a');
      expect(result2).toBe('viewer-a');
      expect(result3).toBe('viewer-a');
    });

    it('handles folder resource type', () => {
      const folderTargets: FileActionTarget[] = [
        {
          id: 'folder-viewer',
          name: 'Folder Viewer',
          appId: 'folder-viewer',
          isEligible: (type, name) => type === 'folder',
        },
      ];

      const result = resolveDefaultTarget('folder', 'project', folderTargets);

      expect(result).toBe('folder-viewer');
    });
  });

  describe('PHASE_AB: Store Helpers', () => {
    describe('listAssociations', () => {
      it('returns empty array when no associations exist', () => {
        const store = useFileAssociationsStore.getState();

        const associations = store.listAssociations();

        expect(associations).toEqual([]);
      });

      it('returns all associations in alphabetical order by extension', () => {
        const store = useFileAssociationsStore.getState();

        // Add associations in non-alphabetical order
        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.setDefaultTarget('file', 'rblogic', 'logic-playground');
        store.setDefaultTarget('file', 'md', 'text-viewer');

        const associations = store.listAssociations();

        // Should be sorted alphabetically by extension
        expect(associations).toEqual([
          { extension: 'md', targetId: 'text-viewer', resourceType: 'file' },
          { extension: 'rblogic', targetId: 'logic-playground', resourceType: 'file' },
          { extension: 'txt', targetId: 'text-viewer', resourceType: 'file' },
        ]);
      });

      it('includes both file and folder associations', () => {
        const store = useFileAssociationsStore.getState();

        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.setDefaultTarget('folder', 'proj', 'folder-viewer');

        const associations = store.listAssociations();

        expect(associations).toHaveLength(2);
        expect(associations.some((a) => a.resourceType === 'file')).toBe(true);
        expect(associations.some((a) => a.resourceType === 'folder')).toBe(true);
      });

      it('maintains stable ordering across multiple calls', () => {
        const store = useFileAssociationsStore.getState();

        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.setDefaultTarget('file', 'rblogic', 'logic-playground');

        const first = store.listAssociations();
        const second = store.listAssociations();

        expect(first).toEqual(second);
      });
    });

    describe('resetAll', () => {
      it('clears all associations', () => {
        const store = useFileAssociationsStore.getState();

        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.setDefaultTarget('file', 'rblogic', 'logic-playground');
        expect(store.listAssociations()).toHaveLength(2);

        store.resetAll();

        expect(store.listAssociations()).toEqual([]);
        expect(store.getDefaultTarget('file', 'txt')).toBe(null);
        expect(store.getDefaultTarget('file', 'rblogic')).toBe(null);
      });

      it('persists empty state to localStorage', () => {
        const store = useFileAssociationsStore.getState();

        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.resetAll();

        const saved = localStorage.getItem('rb:file-associations');
        expect(saved).not.toBe(null);

        const parsed = JSON.parse(saved!);
        expect(parsed.associations).toEqual({});
      });
    });

    describe('exportJson', () => {
      it('returns canonical JSON with stable key ordering', () => {
        const store = useFileAssociationsStore.getState();

        // Add in non-alphabetical order
        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.setDefaultTarget('file', 'rblogic', 'logic-playground');
        store.setDefaultTarget('file', 'md', 'text-viewer');

        const json = store.exportJson();
        const parsed = JSON.parse(json);

        // Keys should be sorted alphabetically
        expect(Object.keys(parsed.associations.file)).toEqual(['md', 'rblogic', 'txt']);
        expect(parsed.associations.file).toEqual({
          md: 'text-viewer',
          rblogic: 'logic-playground',
          txt: 'text-viewer',
        });
      });

      it('returns empty associations object when no associations exist', () => {
        const store = useFileAssociationsStore.getState();

        const json = store.exportJson();
        const parsed = JSON.parse(json);

        expect(parsed).toEqual({ associations: {} });
      });

      it('includes both file and folder associations', () => {
        const store = useFileAssociationsStore.getState();

        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.setDefaultTarget('folder', 'proj', 'folder-viewer');

        const json = store.exportJson();
        const parsed = JSON.parse(json);

        expect(parsed.associations.file).toBeDefined();
        expect(parsed.associations.folder).toBeDefined();
      });

      it('produces deterministic output across multiple calls', () => {
        const store = useFileAssociationsStore.getState();

        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.setDefaultTarget('file', 'rblogic', 'logic-playground');

        const first = store.exportJson();
        const second = store.exportJson();

        expect(first).toBe(second);
      });
    });

    describe('importJson', () => {
      it('successfully imports valid JSON', () => {
        const store = useFileAssociationsStore.getState();

        const json = JSON.stringify({
          associations: {
            file: {
              txt: 'text-viewer',
              rblogic: 'logic-playground',
            },
          },
        });

        const result = store.importJson(json);

        expect(result.success).toBe(true);
        expect(result.unknownTargets).toBe(undefined);
        expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');
        expect(store.getDefaultTarget('file', 'rblogic')).toBe('logic-playground');
      });

      it('normalizes extensions during import', () => {
        const store = useFileAssociationsStore.getState();

        const json = JSON.stringify({
          associations: {
            file: {
              '.TXT': 'text-viewer',
              RBLOGIC: 'logic-playground',
            },
          },
        });

        const result = store.importJson(json);

        expect(result.success).toBe(true);
        // Should be normalized to lowercase, no leading dot
        expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');
        expect(store.getDefaultTarget('file', 'rblogic')).toBe('logic-playground');
      });

      it('filters unknown targetIds', () => {
        const store = useFileAssociationsStore.getState();

        const json = JSON.stringify({
          associations: {
            file: {
              txt: 'text-viewer',
              unknown: 'nonexistent-app',
              rblogic: 'logic-playground',
            },
          },
        });

        const result = store.importJson(json);

        expect(result.success).toBe(true);
        expect(result.unknownTargets).toEqual(['nonexistent-app']);
        // Valid associations should be imported
        expect(store.getDefaultTarget('file', 'txt')).toBe('text-viewer');
        expect(store.getDefaultTarget('file', 'rblogic')).toBe('logic-playground');
        // Unknown association should not be imported
        expect(store.getDefaultTarget('file', 'unknown')).toBe(null);
      });

      it('rejects invalid JSON', () => {
        const store = useFileAssociationsStore.getState();

        const result = store.importJson('{invalid json}');

        expect(result.success).toBe(false);
        expect(result.unknownTargets).toBe(undefined);
      });

      it('rejects invalid schema (missing associations)', () => {
        const store = useFileAssociationsStore.getState();

        const result = store.importJson(JSON.stringify({ wrong: 'schema' }));

        expect(result.success).toBe(false);
      });

      it('rejects invalid schema (associations not an object)', () => {
        const store = useFileAssociationsStore.getState();

        const result = store.importJson(JSON.stringify({ associations: 'invalid' }));

        expect(result.success).toBe(false);
      });

      it('rejects invalid schema (file not an object)', () => {
        const store = useFileAssociationsStore.getState();

        const result = store.importJson(JSON.stringify({ associations: { file: 'invalid' } }));

        expect(result.success).toBe(false);
      });

      it('atomically replaces all associations', () => {
        const store = useFileAssociationsStore.getState();

        // Set initial associations
        store.setDefaultTarget('file', 'txt', 'text-viewer');
        store.setDefaultTarget('file', 'md', 'text-viewer');
        expect(store.listAssociations()).toHaveLength(2);

        // Import new associations (doesn't include 'md')
        const json = JSON.stringify({
          associations: {
            file: {
              rblogic: 'logic-playground',
            },
          },
        });

        store.importJson(json);

        // Old associations should be gone
        expect(store.getDefaultTarget('file', 'txt')).toBe(null);
        expect(store.getDefaultTarget('file', 'md')).toBe(null);
        // New association should be present
        expect(store.getDefaultTarget('file', 'rblogic')).toBe('logic-playground');
      });

      it('persists imported associations to localStorage', () => {
        const store = useFileAssociationsStore.getState();

        const json = JSON.stringify({
          associations: {
            file: {
              txt: 'text-viewer',
            },
          },
        });

        store.importJson(json);

        const saved = localStorage.getItem('rb:file-associations');
        expect(saved).not.toBe(null);

        const parsed = JSON.parse(saved!);
        expect(parsed.associations.file.txt).toBe('text-viewer');
      });
    });
  });
});
