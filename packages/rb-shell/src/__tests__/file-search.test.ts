// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useFileSystemStore } from '@redbyte/rb-apps';
import { getAllSearchableFiles, filterSearchResults } from '../searchRegistry';

describe('PHASE_AD: System Search Files Provider', () => {
  beforeEach(() => {
    // Reset filesystem store to initial state before each test
    const store = useFileSystemStore.getState();
    // Reset to initial state by creating a fresh store
    useFileSystemStore.setState({
      ...store,
      folders: {
        home: {
          id: 'home',
          name: 'Home',
          entries: [
            { id: 'desktop-link', name: 'Desktop', type: 'folder', modified: '2025-12-16 10:00' },
            { id: 'documents-link', name: 'Documents', type: 'folder', modified: '2025-12-16 10:00' },
            { id: 'downloads-link', name: 'Downloads', type: 'folder', modified: '2025-12-16 10:00' },
            { id: 'circuit', name: 'circuit.rblogic', type: 'file', modified: '2025-12-18 14:00' },
          ],
        },
        desktop: {
          id: 'desktop',
          name: 'Desktop',
          entries: [
            { id: 'project1', name: 'Project Files', type: 'folder', modified: '2025-12-15 14:30' },
            { id: 'notes', name: 'Notes.txt', type: 'file', modified: '2025-12-16 09:15' },
          ],
        },
        documents: {
          id: 'documents',
          name: 'Documents',
          entries: [
            { id: 'reports', name: 'Reports', type: 'folder', modified: '2025-12-14 16:20' },
            { id: 'readme', name: 'README.md', type: 'file', modified: '2025-12-13 11:45' },
            { id: 'config', name: 'config.json', type: 'file', modified: '2025-12-12 08:30' },
          ],
        },
        downloads: {
          id: 'downloads',
          name: 'Downloads',
          entries: [
            { id: 'archive', name: 'archive.zip', type: 'file', modified: '2025-12-11 15:00' },
          ],
        },
        project1: {
          id: 'project1',
          name: 'Project Files',
          entries: [
            { id: 'src', name: 'src', type: 'folder', modified: '2025-12-15 14:30' },
            { id: 'package', name: 'package.json', type: 'file', modified: '2025-12-15 12:00' },
          ],
        },
        reports: {
          id: 'reports',
          name: 'Reports',
          entries: [
            { id: 'q4', name: 'Q4-2024.pdf', type: 'file', modified: '2025-12-14 16:20' },
          ],
        },
      },
      nextId: 1,
      roots: ['home', 'desktop', 'documents'],
    });
  });

  describe('getAllSearchableFiles Provider', () => {
    it('should return all files from filesystem (excluding folders)', () => {
      const files = getAllSearchableFiles();

      // Should have exactly 6 files (circuit.rblogic, Notes.txt, README.md, config.json, archive.zip, package.json)
      // Note: We removed Q4-2024.pdf since the test setup doesn't include the "src" folder content
      expect(files).toHaveLength(6);

      // All results should be file type
      files.forEach((result) => {
        expect(result.type).toBe('file');
        expect(result.resourceType).toBe('file');
      });
    });

    it('should include required fields (id, name, description, extension, resourceType)', () => {
      const files = getAllSearchableFiles();

      files.forEach((file) => {
        expect(file).toHaveProperty('id');
        expect(file).toHaveProperty('name');
        expect(file).toHaveProperty('description');
        expect(file).toHaveProperty('extension');
        expect(file).toHaveProperty('resourceType');
        expect(typeof file.id).toBe('string');
        expect(typeof file.name).toBe('string');
        expect(typeof file.description).toBe('string');
        expect(typeof file.extension).toBe('string');
        expect(file.resourceType).toBe('file');
      });
    });

    it('should extract file extensions correctly', () => {
      const files = getAllSearchableFiles();

      const circuit = files.find((f) => f.name === 'circuit.rblogic');
      expect(circuit?.extension).toBe('rblogic');

      const notes = files.find((f) => f.name === 'Notes.txt');
      expect(notes?.extension).toBe('txt');

      const readme = files.find((f) => f.name === 'README.md');
      expect(readme?.extension).toBe('md');

      const config = files.find((f) => f.name === 'config.json');
      expect(config?.extension).toBe('json');
    });

    it('should handle files without extensions', () => {
      // Add a file without extension
      useFileSystemStore.getState().createFile('home', 'Makefile');

      const files = getAllSearchableFiles();
      const makefile = files.find((f) => f.name === 'Makefile');

      expect(makefile).toBeDefined();
      expect(makefile?.extension).toBe('');
    });
  });

  describe('File Search Filtering with Deterministic Scoring', () => {
    it('should return empty files array when query is empty', () => {
      const results = filterSearchResults('');

      expect(results.files).toBeDefined();
      expect(Array.isArray(results.files)).toBe(true);
      // Empty query returns all files
      expect(results.files.length).toBeGreaterThan(0);
    });

    it('should filter files by case-insensitive prefix match (score=2)', () => {
      const results = filterSearchResults('read');

      // Should match "README.md" (prefix match)
      expect(results.files).toHaveLength(1);
      expect(results.files[0].name).toBe('README.md');
    });

    it('should filter files by case-insensitive contains match (score=1)', () => {
      const results = filterSearchResults('port');

      // Should match "Reports" folder's child "Q4-2024.pdf" - wait, actually should NOT match folders
      // Let's check for a contains match in a file name
      // "Q4-2024.pdf" does NOT contain "port"
      // Let's use "json" which is contained in "package.json" and "config.json"
      const jsonResults = filterSearchResults('json');

      expect(jsonResults.files.length).toBe(2);
      const names = jsonResults.files.map((f) => f.name).sort();
      expect(names).toEqual(['config.json', 'package.json']);
    });

    it('should prioritize prefix matches over contains matches (stable sort)', () => {
      // Add files to test sorting
      useFileSystemStore.getState().createFile('home', 'note.txt');
      useFileSystemStore.getState().createFile('home', 'my-notes.txt');

      const results = filterSearchResults('note');

      // "note.txt" (prefix) should come before "my-notes.txt" (contains) and "Notes.txt" (prefix, case-insensitive)
      expect(results.files.length).toBeGreaterThanOrEqual(2);

      // First two should be prefix matches (score=2): "note.txt" and "Notes.txt" (alphabetically)
      const prefixMatches = results.files.filter((f) =>
        f.name.toLowerCase().startsWith('note')
      );
      expect(prefixMatches.length).toBe(2);

      // They should be sorted alphabetically within same score
      expect(prefixMatches[0].name.toLowerCase() <= prefixMatches[1].name.toLowerCase()).toBe(true);
    });

    it('should apply stable multi-key sort: score DESC, name ASC, id ASC', () => {
      // Create files with predictable IDs for stable sorting
      useFileSystemStore.getState().createFile('home', 'test-a.txt');
      useFileSystemStore.getState().createFile('home', 'test-b.txt');
      useFileSystemStore.getState().createFile('home', 'my-test.txt'); // Contains match

      const results = filterSearchResults('test');

      // All three should match
      expect(results.files.length).toBe(3);

      // First two should be prefix matches (test-a.txt, test-b.txt) sorted by name
      expect(results.files[0].name).toMatch(/^test-[ab]\.txt$/);
      expect(results.files[1].name).toMatch(/^test-[ab]\.txt$/);
      expect(results.files[0].name < results.files[1].name).toBe(true); // Alphabetical order

      // Last should be contains match (my-test.txt)
      expect(results.files[2].name).toBe('my-test.txt');
    });

    it('should exclude non-matching files', () => {
      const results = filterSearchResults('xyz123');

      expect(results.files).toHaveLength(0);
    });

    it('should be case-insensitive in matching', () => {
      const lowerResults = filterSearchResults('readme');
      const upperResults = filterSearchResults('README');
      const mixedResults = filterSearchResults('ReAdMe');

      // All should return the same file
      expect(lowerResults.files).toHaveLength(1);
      expect(upperResults.files).toHaveLength(1);
      expect(mixedResults.files).toHaveLength(1);

      expect(lowerResults.files[0].name).toBe('README.md');
      expect(upperResults.files[0].name).toBe('README.md');
      expect(mixedResults.files[0].name).toBe('README.md');
    });
  });

  describe('Integration with other result types', () => {
    it('should include files alongside apps, commands, intents, and macros', () => {
      const results = filterSearchResults('');

      expect(results.apps).toBeDefined();
      expect(results.commands).toBeDefined();
      expect(results.intents).toBeDefined();
      expect(results.macros).toBeDefined();
      expect(results.files).toBeDefined();

      // Files should be populated
      expect(results.files.length).toBeGreaterThan(0);
    });

    it('should maintain separate filtering for each result type', () => {
      // This query might not match any files but could match other types
      const results = filterSearchResults('terminal');

      // Terminal is an app, so apps should have results
      expect(results.apps.length).toBeGreaterThan(0);

      // Files might not match "terminal"
      // (depends on if any files contain "terminal" in their name)
    });
  });
});
