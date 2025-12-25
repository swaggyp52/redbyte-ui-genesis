// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { FileSystemState, FileEntry } from '../apps/files/fsTypes';
import {
  createInitialFsState,
  createFolder as fsCreateFolder,
  createFile as fsCreateFile,
  renameEntry as fsRenameEntry,
  deleteEntry as fsDeleteEntry,
  getChildren as fsGetChildren,
  getPath as fsGetPath,
  resolveFolderLink as fsResolveFolderLink,
  getFallbackFolderId as fsGetFallbackFolderId,
} from '../apps/files/fsModel';

const STORAGE_KEY = 'rb:file-system';

/**
 * Gets current timestamp string for modified field.
 */
function getCurrentTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

interface FileSystemPersistenceEnvelope {
  version: 1;
  state: FileSystemState;
}

interface FileSystemActions {
  createFolder: (parentId: string, name: string) => void;
  createFile: (parentId: string, name: string, content?: string) => string;
  renameEntry: (id: string, newName: string) => void;
  deleteEntry: (id: string) => void;
  getChildren: (parentId: string) => FileEntry[];
  getPath: (folderId: string) => Array<{ id: string; name: string }>;
  resolveFolderLink: (id: string) => string;
  getFallbackFolderId: (deletedId: string) => string;
  getAllFiles: () => FileEntry[];
  getFile: (fileId: string) => FileEntry | null;
  updateFileContent: (fileId: string, content: string) => void;
  exportJson: () => string;
  importJson: (json: string) => void;
  resetAll: () => void;
}

type FileSystemStore = FileSystemState & FileSystemActions;

/**
 * Deterministic serialization of filesystem state.
 * Ensures stable JSON output for snapshots and diffs.
 */
function serializeState(envelope: FileSystemPersistenceEnvelope): string {
  // Sort folder keys and entries for deterministic output
  const sortedFolders: Record<string, any> = {};
  const folderKeys = Object.keys(envelope.state.folders).sort();

  for (const key of folderKeys) {
    const folder = envelope.state.folders[key];
    sortedFolders[key] = {
      ...folder,
      entries: [...folder.entries].sort((a, b) => a.id.localeCompare(b.id)),
    };
  }

  const sortedState: FileSystemState = {
    folders: sortedFolders,
    roots: [...envelope.state.roots].sort(),
    nextId: envelope.state.nextId,
  };

  const sortedEnvelope: FileSystemPersistenceEnvelope = {
    version: envelope.version,
    state: sortedState,
  };

  return JSON.stringify(sortedEnvelope);
}

/**
 * Load persisted state from localStorage with corruption fallback.
 * Returns null if no persisted state or if corrupted.
 */
function loadPersistedState(): FileSystemState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const envelope = JSON.parse(raw) as FileSystemPersistenceEnvelope;

    // Validate envelope structure
    if (envelope.version !== 1) return null;
    if (!envelope.state || typeof envelope.state !== 'object') return null;

    // Validate minimal shape
    if (!envelope.state.folders || typeof envelope.state.folders !== 'object') return null;
    if (!Array.isArray(envelope.state.roots)) return null;
    if (typeof envelope.state.nextId !== 'number') return null;

    return envelope.state;
  } catch {
    // JSON parse error or validation failure -> return null for fallback
    return null;
  }
}

/**
 * Persist state to localStorage (sync).
 */
function persistState(state: FileSystemState): void {
  if (typeof window === 'undefined') return;

  const envelope: FileSystemPersistenceEnvelope = {
    version: 1,
    state,
  };

  const json = serializeState(envelope);
  localStorage.setItem(STORAGE_KEY, json);
}

/**
 * Global filesystem store for Files app and search provider.
 * Provides centralized access to filesystem state with persistence.
 */
export const useFileSystemStore = create<FileSystemStore>((set, get) => {
  // Load persisted state or fall back to default seed
  const persistedState = loadPersistedState();
  const initialState = persistedState || createInitialFsState();

  return {
    ...initialState,

    createFolder: (parentId, name) => {
      const fs = get();
      const newFs = fsCreateFolder(parentId, name, fs);
      set(newFs);
      persistState(newFs);
    },

    createFile: (parentId, name, content?) => {
      const fs = get();
      const newFs = fsCreateFile(parentId, name, fs, content);
      set(newFs);
      persistState(newFs);

      // Return the new file ID (format: file-{nextId})
      return `file-${fs.nextId}`;
    },

    renameEntry: (id, newName) => {
      const fs = get();
      const newFs = fsRenameEntry(id, newName, fs);
      set(newFs);
      persistState(newFs);
    },

    deleteEntry: (id) => {
      const fs = get();
      const newFs = fsDeleteEntry(id, fs);
      set(newFs);
      persistState(newFs);
    },

    getChildren: (parentId) => {
      const fs = get();
      return fsGetChildren(parentId, fs);
    },

    getPath: (folderId) => {
      const fs = get();
      return fsGetPath(folderId, fs);
    },

    resolveFolderLink: (id) => {
      return fsResolveFolderLink(id);
    },

    getFallbackFolderId: (deletedId) => {
      const fs = get();
      return fsGetFallbackFolderId(deletedId, fs);
    },

    getAllFiles: () => {
      const fs = get();
      const allFiles: FileEntry[] = [];

      // Recursively collect all files from all folders
      function collectFilesFromFolder(folderId: string): void {
        const folder = fs.folders[folderId];
        if (!folder) return;

        for (const entry of folder.entries) {
          if (entry.type === 'file') {
            allFiles.push(entry);
          } else if (entry.type === 'folder') {
            // Recurse into subfolder
            collectFilesFromFolder(entry.id);
          }
        }
      }

      // Start from all root folders
      for (const rootId of fs.roots) {
        collectFilesFromFolder(rootId);
      }

      return allFiles;
    },

    getFile: (fileId) => {
      const fs = get();

      // Search all folders for the file entry
      for (const folder of Object.values(fs.folders)) {
        const entry = folder.entries.find((e) => e.id === fileId && e.type === 'file');
        if (entry) {
          return entry;
        }
      }

      return null;
    },

    updateFileContent: (fileId, content) => {
      const fs = get();

      // Find the parent folder containing this file
      let parentFolderId: string | null = null;
      let fileEntry: FileEntry | null = null;

      for (const [folderId, folder] of Object.entries(fs.folders)) {
        const entry = folder.entries.find((e) => e.id === fileId && e.type === 'file');
        if (entry) {
          parentFolderId = folderId;
          fileEntry = entry;
          break;
        }
      }

      if (!parentFolderId || !fileEntry) {
        throw new Error(`File ${fileId} not found`);
      }

      const parentFolder = fs.folders[parentFolderId];
      const updatedEntry: FileEntry = {
        ...fileEntry,
        content,
        modified: getCurrentTimestamp(),
      };

      const updatedEntries = parentFolder.entries.map((e) =>
        e.id === fileId ? updatedEntry : e
      );

      const newFs: FileSystemState = {
        ...fs,
        folders: {
          ...fs.folders,
          [parentFolderId]: {
            ...parentFolder,
            entries: updatedEntries,
          },
        },
      };

      set(newFs);
      persistState(newFs);
    },

    exportJson: () => {
      const state = get();
      const envelope: FileSystemPersistenceEnvelope = {
        version: 1,
        state: {
          folders: state.folders,
          roots: state.roots,
          nextId: state.nextId,
        },
      };
      return serializeState(envelope);
    },

    importJson: (json: string) => {
      const envelope = JSON.parse(json) as FileSystemPersistenceEnvelope;

      // Validate envelope
      if (envelope.version !== 1) {
        throw new Error('Invalid persistence version');
      }
      if (!envelope.state || typeof envelope.state !== 'object') {
        throw new Error('Invalid state shape');
      }

      // Validate minimal schema
      if (!envelope.state.folders || typeof envelope.state.folders !== 'object') {
        throw new Error('Missing or invalid folders');
      }
      if (!Array.isArray(envelope.state.roots)) {
        throw new Error('Missing or invalid roots');
      }
      if (typeof envelope.state.nextId !== 'number') {
        throw new Error('Missing or invalid nextId');
      }

      // Replace state atomically
      set(envelope.state);
      persistState(envelope.state);
    },

    resetAll: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      const seed = createInitialFsState();
      set(seed);
    },
  };
});
