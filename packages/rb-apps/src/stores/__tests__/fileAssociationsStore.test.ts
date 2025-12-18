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
});
