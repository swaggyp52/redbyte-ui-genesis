// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { FileSystemState, FolderData, FileEntry } from './fsTypes';

/**
 * Creates the initial filesystem state with Home/Desktop/Documents structure.
 * Uses deterministic IDs starting from 1.
 */
export function createInitialFsState(): FileSystemState {
  return {
    folders: {
      home: {
        id: 'home',
        name: 'Home',
        entries: [
          { id: 'desktop-link', name: 'Desktop', type: 'folder', modified: '2025-12-16 10:00' },
          { id: 'documents-link', name: 'Documents', type: 'folder', modified: '2025-12-16 10:00' },
          { id: 'downloads-link', name: 'Downloads', type: 'folder', modified: '2025-12-16 10:00' },
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
  };
}

/**
 * Map folder link IDs to actual folders (used for navigation).
 */
const FOLDER_LINKS: Record<string, string> = {
  'desktop-link': 'desktop',
  'documents-link': 'documents',
  'downloads-link': 'downloads',
};

/**
 * Parent folder map for breadcrumb and navigation.
 */
const FOLDER_PARENTS: Record<string, string | null> = {
  home: null,
  desktop: 'home',
  documents: 'home',
  downloads: 'home',
  project1: 'desktop',
  reports: 'documents',
};

/**
 * Validates a name for file/folder operations.
 * Returns trimmed name or null if invalid.
 */
function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return null;
  if (trimmed.includes('/') || trimmed.includes('\\')) return null;
  return trimmed;
}

/**
 * Generates a unique name by auto-suffixing with " (2)", " (3)", etc.
 * if the base name already exists in the parent folder.
 */
function generateUniqueName(baseName: string, existingNames: string[]): string {
  const nameSet = new Set(existingNames);

  if (!nameSet.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (nameSet.has(`${baseName} (${counter})`)) {
    counter++;
  }

  return `${baseName} (${counter})`;
}

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

/**
 * Creates a new folder in the specified parent folder.
 * Returns new filesystem state with folder added.
 * Auto-suffixes name if duplicate exists.
 */
export function createFolder(
  parentId: string,
  name: string,
  fs: FileSystemState
): FileSystemState {
  const validName = validateName(name);
  if (!validName) {
    throw new Error('Invalid folder name: empty or contains / or \\');
  }

  const parent = fs.folders[parentId];
  if (!parent) {
    throw new Error(`Parent folder not found: ${parentId}`);
  }

  const existingNames = parent.entries.map((e) => e.name);
  const uniqueName = generateUniqueName(validName, existingNames);

  const newId = `folder-${fs.nextId}`;
  const timestamp = getCurrentTimestamp();

  const newEntry: FileEntry = {
    id: newId,
    name: uniqueName,
    type: 'folder',
    modified: timestamp,
  };

  const newFolder: FolderData = {
    id: newId,
    name: uniqueName,
    entries: [],
  };

  return {
    ...fs,
    folders: {
      ...fs.folders,
      [parentId]: {
        ...parent,
        entries: [...parent.entries, newEntry],
      },
      [newId]: newFolder,
    },
    nextId: fs.nextId + 1,
  };
}

/**
 * Creates a new file in the specified parent folder.
 * Returns new filesystem state with file added.
 * Auto-suffixes name if duplicate exists.
 */
export function createFile(
  parentId: string,
  name: string,
  fs: FileSystemState
): FileSystemState {
  const validName = validateName(name);
  if (!validName) {
    throw new Error('Invalid file name: empty or contains / or \\');
  }

  const parent = fs.folders[parentId];
  if (!parent) {
    throw new Error(`Parent folder not found: ${parentId}`);
  }

  const existingNames = parent.entries.map((e) => e.name);
  const uniqueName = generateUniqueName(validName, existingNames);

  const newId = `file-${fs.nextId}`;
  const timestamp = getCurrentTimestamp();

  const newEntry: FileEntry = {
    id: newId,
    name: uniqueName,
    type: 'file',
    modified: timestamp,
  };

  return {
    ...fs,
    folders: {
      ...fs.folders,
      [parentId]: {
        ...parent,
        entries: [...parent.entries, newEntry],
      },
    },
    nextId: fs.nextId + 1,
  };
}

/**
 * Renames an entry (file or folder).
 * Returns new filesystem state with entry renamed.
 * Auto-suffixes name if duplicate exists.
 * Throws if attempting to rename a root folder.
 */
export function renameEntry(
  id: string,
  newName: string,
  fs: FileSystemState
): FileSystemState {
  const validName = validateName(newName);
  if (!validName) {
    throw new Error('Invalid name: empty or contains / or \\');
  }

  // Prevent renaming root folders
  if (fs.roots.includes(id)) {
    throw new Error(`Cannot rename root folder: ${id}`);
  }

  // Find parent folder containing this entry
  let parentId: string | null = null;
  let entryIndex = -1;
  let targetEntry: FileEntry | null = null;

  for (const [folderId, folder] of Object.entries(fs.folders)) {
    const index = folder.entries.findIndex((e) => e.id === id);
    if (index !== -1) {
      parentId = folderId;
      entryIndex = index;
      targetEntry = folder.entries[index];
      break;
    }
  }

  if (!parentId || !targetEntry || entryIndex === -1) {
    throw new Error(`Entry not found: ${id}`);
  }

  const parent = fs.folders[parentId];
  const existingNames = parent.entries
    .filter((e, i) => i !== entryIndex)
    .map((e) => e.name);
  const uniqueName = generateUniqueName(validName, existingNames);

  const timestamp = getCurrentTimestamp();

  const updatedEntry: FileEntry = {
    ...targetEntry,
    name: uniqueName,
    modified: timestamp,
  };

  const updatedParent: FolderData = {
    ...parent,
    entries: parent.entries.map((e, i) => (i === entryIndex ? updatedEntry : e)),
  };

  const newFolders = {
    ...fs.folders,
    [parentId]: updatedParent,
  };

  // If renaming a folder, also update the folder's own name
  if (targetEntry.type === 'folder' && fs.folders[id]) {
    newFolders[id] = {
      ...fs.folders[id],
      name: uniqueName,
    };
  }

  return {
    ...fs,
    folders: newFolders,
  };
}

/**
 * Recursively collects all descendant folder IDs of a given folder.
 */
function collectDescendantFolders(folderId: string, fs: FileSystemState): string[] {
  const folder = fs.folders[folderId];
  if (!folder) return [];

  const descendants: string[] = [];

  for (const entry of folder.entries) {
    if (entry.type === 'folder') {
      descendants.push(entry.id);
      descendants.push(...collectDescendantFolders(entry.id, fs));
    }
  }

  return descendants;
}

/**
 * Deletes an entry (file or folder).
 * For folders, cascades delete to entire subtree.
 * Returns new filesystem state with entry removed.
 * Throws if attempting to delete a root folder.
 */
export function deleteEntry(id: string, fs: FileSystemState): FileSystemState {
  // Prevent deleting root folders
  if (fs.roots.includes(id)) {
    throw new Error(`Cannot delete root folder: ${id}`);
  }

  // Find parent folder containing this entry
  let parentId: string | null = null;
  let targetEntry: FileEntry | null = null;

  for (const [folderId, folder] of Object.entries(fs.folders)) {
    const entry = folder.entries.find((e) => e.id === id);
    if (entry) {
      parentId = folderId;
      targetEntry = entry;
      break;
    }
  }

  if (!parentId || !targetEntry) {
    throw new Error(`Entry not found: ${id}`);
  }

  const parent = fs.folders[parentId];
  const updatedParent: FolderData = {
    ...parent,
    entries: parent.entries.filter((e) => e.id !== id),
  };

  const newFolders = {
    ...fs.folders,
    [parentId]: updatedParent,
  };

  // If deleting a folder, cascade delete all descendants
  if (targetEntry.type === 'folder') {
    const descendantIds = collectDescendantFolders(id, fs);
    delete newFolders[id];
    for (const descendantId of descendantIds) {
      delete newFolders[descendantId];
    }
  }

  return {
    ...fs,
    folders: newFolders,
  };
}

/**
 * Gets all entries in a folder.
 */
export function getChildren(parentId: string, fs: FileSystemState): FileEntry[] {
  const folder = fs.folders[parentId];
  if (!folder) return [];
  return folder.entries;
}

/**
 * Computes breadcrumb path from root to current folder.
 * Returns array of {id, name} segments.
 */
export function getPath(
  folderId: string,
  fs: FileSystemState
): Array<{ id: string; name: string }> {
  const path: Array<{ id: string; name: string }> = [];
  let current: string | null = folderId;

  while (current !== null) {
    const folder = fs.folders[current];
    if (folder) {
      path.unshift({ id: folder.id, name: folder.name });
    }
    current = FOLDER_PARENTS[current] ?? null;
  }

  return path;
}

/**
 * Gets fallback folder ID when a folder is deleted.
 * Returns parent folder ID, or 'home' if no parent.
 */
export function getFallbackFolderId(deletedId: string, fs: FileSystemState): string {
  const parentId = FOLDER_PARENTS[deletedId];
  if (parentId && fs.folders[parentId]) {
    return parentId;
  }
  return 'home';
}

/**
 * Resolves folder links (e.g., 'desktop-link' -> 'desktop').
 */
export function resolveFolderLink(id: string): string {
  return FOLDER_LINKS[id] || id;
}
