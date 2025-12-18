// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import {
  createInitialFsState,
  createFolder,
  createFile,
  renameEntry,
  deleteEntry,
  getChildren,
  getPath,
  getFallbackFolderId,
  resolveFolderLink,
} from '../fsModel';

describe('fsModel', () => {
  describe('createInitialFsState', () => {
    it('creates initial state with home/desktop/documents structure', () => {
      const fs = createInitialFsState();

      expect(fs.folders.home).toBeDefined();
      expect(fs.folders.desktop).toBeDefined();
      expect(fs.folders.documents).toBeDefined();
      expect(fs.nextId).toBe(1);
      expect(fs.roots).toEqual(['home', 'desktop', 'documents']);
    });

    it('has correct home entries', () => {
      const fs = createInitialFsState();
      const homeEntries = fs.folders.home.entries;

      expect(homeEntries).toHaveLength(4);
      expect(homeEntries[0].name).toBe('Desktop');
      expect(homeEntries[1].name).toBe('Documents');
      expect(homeEntries[2].name).toBe('Downloads');
      expect(homeEntries[3].name).toBe('circuit.rblogic');
    });
  });

  describe('createFolder', () => {
    it('creates folder with deterministic ID', () => {
      const fs = createInitialFsState();
      const newFs = createFolder('home', 'Test Folder', fs);

      expect(newFs.nextId).toBe(2);
      expect(newFs.folders['folder-1']).toBeDefined();
      expect(newFs.folders['folder-1'].name).toBe('Test Folder');
      expect(newFs.folders['folder-1'].entries).toEqual([]);
    });

    it('adds folder entry to parent', () => {
      const fs = createInitialFsState();
      const newFs = createFolder('home', 'Test Folder', fs);

      const homeEntries = newFs.folders.home.entries;
      expect(homeEntries).toHaveLength(5);
      expect(homeEntries[4].id).toBe('folder-1');
      expect(homeEntries[4].name).toBe('Test Folder');
      expect(homeEntries[4].type).toBe('folder');
    });

    it('auto-suffixes duplicate names', () => {
      let fs = createInitialFsState();
      fs = createFolder('home', 'Test', fs);
      fs = createFolder('home', 'Test', fs);
      fs = createFolder('home', 'Test', fs);

      const homeEntries = fs.folders.home.entries;
      expect(homeEntries[4].name).toBe('Test');
      expect(homeEntries[5].name).toBe('Test (2)');
      expect(homeEntries[6].name).toBe('Test (3)');
    });

    it('rejects empty name', () => {
      const fs = createInitialFsState();
      expect(() => createFolder('home', '', fs)).toThrow('Invalid folder name');
      expect(() => createFolder('home', '   ', fs)).toThrow('Invalid folder name');
    });

    it('rejects names with forward slash', () => {
      const fs = createInitialFsState();
      expect(() => createFolder('home', 'test/folder', fs)).toThrow('Invalid folder name');
    });

    it('rejects names with backslash', () => {
      const fs = createInitialFsState();
      expect(() => createFolder('home', 'test\\folder', fs)).toThrow('Invalid folder name');
    });

    it('trims whitespace from names', () => {
      const fs = createInitialFsState();
      const newFs = createFolder('home', '  Test Folder  ', fs);

      const homeEntries = newFs.folders.home.entries;
      expect(homeEntries[4].name).toBe('Test Folder');
    });

    it('throws if parent folder does not exist', () => {
      const fs = createInitialFsState();
      expect(() => createFolder('nonexistent', 'Test', fs)).toThrow('Parent folder not found');
    });

    it('increments nextId correctly for multiple folders', () => {
      let fs = createInitialFsState();
      fs = createFolder('home', 'Folder 1', fs);
      expect(fs.nextId).toBe(2);

      fs = createFolder('home', 'Folder 2', fs);
      expect(fs.nextId).toBe(3);

      fs = createFolder('desktop', 'Folder 3', fs);
      expect(fs.nextId).toBe(4);
    });
  });

  describe('createFile', () => {
    it('creates file with deterministic ID', () => {
      const fs = createInitialFsState();
      const newFs = createFile('home', 'test.txt', fs);

      expect(newFs.nextId).toBe(2);
      const homeEntries = newFs.folders.home.entries;
      expect(homeEntries[4].id).toBe('file-1');
      expect(homeEntries[4].name).toBe('test.txt');
      expect(homeEntries[4].type).toBe('file');
    });

    it('auto-suffixes duplicate file names', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'test.txt', fs);
      fs = createFile('home', 'test.txt', fs);
      fs = createFile('home', 'test.txt', fs);

      const homeEntries = fs.folders.home.entries;
      expect(homeEntries[4].name).toBe('test.txt');
      expect(homeEntries[5].name).toBe('test.txt (2)');
      expect(homeEntries[6].name).toBe('test.txt (3)');
    });

    it('rejects empty file name', () => {
      const fs = createInitialFsState();
      expect(() => createFile('home', '', fs)).toThrow('Invalid file name');
    });

    it('rejects file names with / or \\', () => {
      const fs = createInitialFsState();
      expect(() => createFile('home', 'test/file.txt', fs)).toThrow('Invalid file name');
      expect(() => createFile('home', 'test\\file.txt', fs)).toThrow('Invalid file name');
    });

    it('trims whitespace from file names', () => {
      const fs = createInitialFsState();
      const newFs = createFile('home', '  test.txt  ', fs);

      const homeEntries = newFs.folders.home.entries;
      expect(homeEntries[4].name).toBe('test.txt');
    });

    it('throws if parent folder does not exist', () => {
      const fs = createInitialFsState();
      expect(() => createFile('nonexistent', 'test.txt', fs)).toThrow('Parent folder not found');
    });
  });

  describe('renameEntry', () => {
    it('renames file successfully', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'old.txt', fs);

      const newFs = renameEntry('file-1', 'new.txt', fs);

      const homeEntries = newFs.folders.home.entries;
      const renamedFile = homeEntries.find((e) => e.id === 'file-1');
      expect(renamedFile?.name).toBe('new.txt');
    });

    it('renames folder successfully', () => {
      let fs = createInitialFsState();
      fs = createFolder('home', 'Old Folder', fs);

      const newFs = renameEntry('folder-1', 'New Folder', fs);

      const homeEntries = newFs.folders.home.entries;
      const renamedFolder = homeEntries.find((e) => e.id === 'folder-1');
      expect(renamedFolder?.name).toBe('New Folder');
      expect(newFs.folders['folder-1'].name).toBe('New Folder');
    });

    it('prevents renaming root folders', () => {
      const fs = createInitialFsState();

      expect(() => renameEntry('home', 'Not Home', fs)).toThrow('Cannot rename root folder');
      expect(() => renameEntry('desktop', 'Not Desktop', fs)).toThrow('Cannot rename root folder');
      expect(() => renameEntry('documents', 'Not Documents', fs)).toThrow('Cannot rename root folder');
    });

    it('auto-suffixes duplicate rename target', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'file1.txt', fs);
      fs = createFile('home', 'file2.txt', fs);

      const newFs = renameEntry('file-2', 'file1.txt', fs);

      const homeEntries = newFs.folders.home.entries;
      const renamedFile = homeEntries.find((e) => e.id === 'file-2');
      expect(renamedFile?.name).toBe('file1.txt (2)');
    });

    it('rejects empty name', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'test.txt', fs);

      expect(() => renameEntry('file-1', '', fs)).toThrow('Invalid name');
      expect(() => renameEntry('file-1', '   ', fs)).toThrow('Invalid name');
    });

    it('rejects names with / or \\', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'test.txt', fs);

      expect(() => renameEntry('file-1', 'bad/name.txt', fs)).toThrow('Invalid name');
      expect(() => renameEntry('file-1', 'bad\\name.txt', fs)).toThrow('Invalid name');
    });

    it('trims whitespace from new name', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'test.txt', fs);

      const newFs = renameEntry('file-1', '  renamed.txt  ', fs);

      const homeEntries = newFs.folders.home.entries;
      const renamedFile = homeEntries.find((e) => e.id === 'file-1');
      expect(renamedFile?.name).toBe('renamed.txt');
    });

    it('throws if entry does not exist', () => {
      const fs = createInitialFsState();
      expect(() => renameEntry('nonexistent', 'new name', fs)).toThrow('Entry not found');
    });
  });

  describe('deleteEntry', () => {
    it('deletes file from parent', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'test.txt', fs);

      const newFs = deleteEntry('file-1', fs);

      const homeEntries = newFs.folders.home.entries;
      expect(homeEntries.find((e) => e.id === 'file-1')).toBeUndefined();
    });

    it('deletes folder and its entries', () => {
      let fs = createInitialFsState();
      fs = createFolder('home', 'Test Folder', fs);

      const newFs = deleteEntry('folder-1', fs);

      const homeEntries = newFs.folders.home.entries;
      expect(homeEntries.find((e) => e.id === 'folder-1')).toBeUndefined();
      expect(newFs.folders['folder-1']).toBeUndefined();
    });

    it('cascades delete for nested folder subtree', () => {
      let fs = createInitialFsState();
      fs = createFolder('home', 'Parent', fs);
      fs = createFolder('folder-1', 'Child', fs);
      fs = createFile('folder-2', 'grandchild.txt', fs);

      const newFs = deleteEntry('folder-1', fs);

      expect(newFs.folders['folder-1']).toBeUndefined();
      expect(newFs.folders['folder-2']).toBeUndefined();
      const homeEntries = newFs.folders.home.entries;
      expect(homeEntries.find((e) => e.id === 'folder-1')).toBeUndefined();
    });

    it('prevents deleting root folders', () => {
      const fs = createInitialFsState();

      expect(() => deleteEntry('home', fs)).toThrow('Cannot delete root folder');
      expect(() => deleteEntry('desktop', fs)).toThrow('Cannot delete root folder');
      expect(() => deleteEntry('documents', fs)).toThrow('Cannot delete root folder');
    });

    it('throws if entry does not exist', () => {
      const fs = createInitialFsState();
      expect(() => deleteEntry('nonexistent', fs)).toThrow('Entry not found');
    });

    it('deletes existing entry from initial state', () => {
      const fs = createInitialFsState();

      // Delete 'notes' from desktop
      const newFs = deleteEntry('notes', fs);

      const desktopEntries = newFs.folders.desktop.entries;
      expect(desktopEntries.find((e) => e.id === 'notes')).toBeUndefined();
    });
  });

  describe('getChildren', () => {
    it('returns entries for existing folder', () => {
      const fs = createInitialFsState();
      const children = getChildren('home', fs);

      expect(children).toHaveLength(4);
      expect(children[0].name).toBe('Desktop');
      expect(children[1].name).toBe('Documents');
      expect(children[2].name).toBe('Downloads');
      expect(children[3].name).toBe('circuit.rblogic');
    });

    it('returns empty array for nonexistent folder', () => {
      const fs = createInitialFsState();
      const children = getChildren('nonexistent', fs);

      expect(children).toEqual([]);
    });

    it('returns empty array for empty folder', () => {
      let fs = createInitialFsState();
      fs = createFolder('home', 'Empty', fs);

      const children = getChildren('folder-1', fs);

      expect(children).toEqual([]);
    });
  });

  describe('getPath', () => {
    it('returns single segment for root folder', () => {
      const fs = createInitialFsState();
      const path = getPath('home', fs);

      expect(path).toEqual([{ id: 'home', name: 'Home' }]);
    });

    it('returns correct path for nested folder', () => {
      const fs = createInitialFsState();
      const path = getPath('reports', fs);

      expect(path).toEqual([
        { id: 'home', name: 'Home' },
        { id: 'documents', name: 'Documents' },
        { id: 'reports', name: 'Reports' },
      ]);
    });

    it('returns correct path for desktop subfolder', () => {
      const fs = createInitialFsState();
      const path = getPath('project1', fs);

      expect(path).toEqual([
        { id: 'home', name: 'Home' },
        { id: 'desktop', name: 'Desktop' },
        { id: 'project1', name: 'Project Files' },
      ]);
    });
  });

  describe('getFallbackFolderId', () => {
    it('returns parent folder ID when folder deleted', () => {
      const fs = createInitialFsState();
      const fallback = getFallbackFolderId('desktop', fs);

      expect(fallback).toBe('home');
    });

    it('returns home when root folder deleted', () => {
      const fs = createInitialFsState();
      const fallback = getFallbackFolderId('home', fs);

      expect(fallback).toBe('home');
    });

    it('returns home when nested folder deleted', () => {
      const fs = createInitialFsState();
      const fallback = getFallbackFolderId('project1', fs);

      expect(fallback).toBe('desktop');
    });
  });

  describe('resolveFolderLink', () => {
    it('resolves desktop-link to desktop', () => {
      expect(resolveFolderLink('desktop-link')).toBe('desktop');
    });

    it('resolves documents-link to documents', () => {
      expect(resolveFolderLink('documents-link')).toBe('documents');
    });

    it('resolves downloads-link to downloads', () => {
      expect(resolveFolderLink('downloads-link')).toBe('downloads');
    });

    it('returns same ID for non-link folders', () => {
      expect(resolveFolderLink('home')).toBe('home');
      expect(resolveFolderLink('desktop')).toBe('desktop');
      expect(resolveFolderLink('project1')).toBe('project1');
    });
  });

  describe('immutability', () => {
    it('createFolder does not mutate original state', () => {
      const fs = createInitialFsState();
      const originalNextId = fs.nextId;
      const originalHomeEntries = fs.folders.home.entries.length;

      createFolder('home', 'Test', fs);

      expect(fs.nextId).toBe(originalNextId);
      expect(fs.folders.home.entries.length).toBe(originalHomeEntries);
    });

    it('createFile does not mutate original state', () => {
      const fs = createInitialFsState();
      const originalNextId = fs.nextId;
      const originalHomeEntries = fs.folders.home.entries.length;

      createFile('home', 'test.txt', fs);

      expect(fs.nextId).toBe(originalNextId);
      expect(fs.folders.home.entries.length).toBe(originalHomeEntries);
    });

    it('renameEntry does not mutate original state', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'test.txt', fs);
      const originalName = fs.folders.home.entries.find((e) => e.id === 'file-1')?.name;

      renameEntry('file-1', 'renamed.txt', fs);

      const currentName = fs.folders.home.entries.find((e) => e.id === 'file-1')?.name;
      expect(currentName).toBe(originalName);
    });

    it('deleteEntry does not mutate original state', () => {
      let fs = createInitialFsState();
      fs = createFile('home', 'test.txt', fs);
      const originalLength = fs.folders.home.entries.length;

      deleteEntry('file-1', fs);

      expect(fs.folders.home.entries.length).toBe(originalLength);
    });
  });
});
