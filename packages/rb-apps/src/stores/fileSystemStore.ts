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

interface FileSystemActions {
  createFolder: (parentId: string, name: string) => void;
  createFile: (parentId: string, name: string) => void;
  renameEntry: (id: string, newName: string) => void;
  deleteEntry: (id: string) => void;
  getChildren: (parentId: string) => FileEntry[];
  getPath: (folderId: string) => Array<{ id: string; name: string }>;
  resolveFolderLink: (id: string) => string;
  getFallbackFolderId: (deletedId: string) => string;
  getAllFiles: () => FileEntry[];
}

type FileSystemStore = FileSystemState & FileSystemActions;

/**
 * Global filesystem store for Files app and search provider.
 * Provides centralized access to filesystem state.
 */
export const useFileSystemStore = create<FileSystemStore>((set, get) => ({
  ...createInitialFsState(),

  createFolder: (parentId, name) => {
    const fs = get();
    const newFs = fsCreateFolder(parentId, name, fs);
    set(newFs);
  },

  createFile: (parentId, name) => {
    const fs = get();
    const newFs = fsCreateFile(parentId, name, fs);
    set(newFs);
  },

  renameEntry: (id, newName) => {
    const fs = get();
    const newFs = fsRenameEntry(id, newName, fs);
    set(newFs);
  },

  deleteEntry: (id) => {
    const fs = get();
    const newFs = fsDeleteEntry(id, fs);
    set(newFs);
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
}));
