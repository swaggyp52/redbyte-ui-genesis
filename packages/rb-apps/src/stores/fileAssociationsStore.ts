// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { FileActionTarget } from '../apps/files/fileActionTargets';
import { FILE_ACTION_TARGETS } from '../apps/files/fileActionTargets';

/**
 * File associations data model: resourceType → extension → targetId
 * Extensions are normalized (lowercase, no leading dot)
 */
interface FileAssociationsState {
  associations: {
    file?: Record<string, string>; // extension → targetId
    folder?: Record<string, string>; // extension → targetId
  };
}

export interface AssociationEntry {
  extension: string;
  targetId: string;
  resourceType: 'file' | 'folder';
}

export interface ImportResult {
  success: boolean;
  unknownTargets?: string[];
}

interface FileAssociationsActions {
  getDefaultTarget: (resourceType: 'file' | 'folder', extension: string) => string | null;
  setDefaultTarget: (resourceType: 'file' | 'folder', extension: string, targetId: string) => void;
  clearDefaultTarget: (resourceType: 'file' | 'folder', extension: string) => void;
  listAssociations: () => AssociationEntry[];
  resetAll: () => void;
  exportJson: () => string;
  importJson: (jsonString: string) => ImportResult;
}

type FileAssociationsStore = FileAssociationsState & FileAssociationsActions;

const STORAGE_KEY = 'rb:file-associations';

interface PersistedData {
  associations: FileAssociationsState['associations'];
}

/**
 * Normalize file extension: lowercase, no leading dot
 * Examples: ".txt" → "txt", "TXT" → "txt", "rblogic" → "rblogic"
 */
function normalizeExtension(extension: string): string {
  return extension.replace(/^\./, '').toLowerCase();
}

function saveAssociations(associations: FileAssociationsState['associations']): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const data: PersistedData = { associations };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // Silently ignore localStorage errors
  }
}

export function loadFileAssociations(): PersistedData | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.associations || typeof parsed.associations !== 'object') return null;

    // Validate structure: associations should have file/folder keys with string records
    const associations = parsed.associations;
    if (associations.file && typeof associations.file !== 'object') return null;
    if (associations.folder && typeof associations.folder !== 'object') return null;

    return parsed as PersistedData;
  } catch (error) {
    // Silently ignore corrupted data
    return null;
  }
}

function loadInitialState(): FileAssociationsState {
  const data = loadFileAssociations();
  if (!data) {
    return {
      associations: {},
    };
  }

  return {
    associations: data.associations,
  };
}

export const useFileAssociationsStore = create<FileAssociationsStore>((set, get) => ({
  ...loadInitialState(),

  getDefaultTarget: (resourceType, extension) => {
    const normalized = normalizeExtension(extension);
    const typeAssociations = get().associations[resourceType];
    return typeAssociations?.[normalized] || null;
  },

  setDefaultTarget: (resourceType, extension, targetId) => {
    const normalized = normalizeExtension(extension);
    set((state) => {
      const newAssociations = {
        ...state.associations,
        [resourceType]: {
          ...state.associations[resourceType],
          [normalized]: targetId,
        },
      };
      saveAssociations(newAssociations);
      return {
        associations: newAssociations,
      };
    });
  },

  clearDefaultTarget: (resourceType, extension) => {
    const normalized = normalizeExtension(extension);
    set((state) => {
      const typeAssociations = { ...state.associations[resourceType] };
      delete typeAssociations[normalized];

      const newAssociations = {
        ...state.associations,
        [resourceType]: typeAssociations,
      };
      saveAssociations(newAssociations);
      return {
        associations: newAssociations,
      };
    });
  },

  listAssociations: () => {
    const state = get();
    const entries: AssociationEntry[] = [];

    // Collect from file associations
    if (state.associations.file) {
      Object.entries(state.associations.file).forEach(([extension, targetId]) => {
        entries.push({ extension, targetId, resourceType: 'file' });
      });
    }

    // Collect from folder associations
    if (state.associations.folder) {
      Object.entries(state.associations.folder).forEach(([extension, targetId]) => {
        entries.push({ extension, targetId, resourceType: 'folder' });
      });
    }

    // Sort alphabetically by extension for stable ordering
    return entries.sort((a, b) => a.extension.localeCompare(b.extension));
  },

  resetAll: () => {
    const emptyAssociations = {};
    set({ associations: emptyAssociations });
    saveAssociations(emptyAssociations);
  },

  exportJson: () => {
    const state = get();
    // Create canonical JSON with stable key ordering
    const canonical: PersistedData = { associations: {} };

    // Add file associations if present (sorted keys)
    if (state.associations.file && Object.keys(state.associations.file).length > 0) {
      const sortedFile: Record<string, string> = {};
      Object.keys(state.associations.file)
        .sort()
        .forEach((key) => {
          sortedFile[key] = state.associations.file![key];
        });
      canonical.associations.file = sortedFile;
    }

    // Add folder associations if present (sorted keys)
    if (state.associations.folder && Object.keys(state.associations.folder).length > 0) {
      const sortedFolder: Record<string, string> = {};
      Object.keys(state.associations.folder)
        .sort()
        .forEach((key) => {
          sortedFolder[key] = state.associations.folder![key];
        });
      canonical.associations.folder = sortedFolder;
    }

    return JSON.stringify(canonical);
  },

  importJson: (jsonString: string): ImportResult => {
    try {
      const parsed = JSON.parse(jsonString);

      // Validate schema
      if (!parsed || typeof parsed !== 'object') {
        return { success: false };
      }
      if (!parsed.associations || typeof parsed.associations !== 'object') {
        return { success: false };
      }

      const associations = parsed.associations;
      if (associations.file && typeof associations.file !== 'object') {
        return { success: false };
      }
      if (associations.folder && typeof associations.folder !== 'object') {
        return { success: false };
      }

      // Get all valid targetIds from FILE_ACTION_TARGETS
      const validTargetIds = new Set(FILE_ACTION_TARGETS.map((t) => t.id));
      const unknownTargets: string[] = [];
      const normalizedAssociations: FileAssociationsState['associations'] = {};

      // Process file associations
      if (associations.file) {
        const normalizedFile: Record<string, string> = {};
        Object.entries(associations.file).forEach(([ext, targetId]) => {
          if (typeof targetId !== 'string') return;

          const normalized = normalizeExtension(ext);
          if (validTargetIds.has(targetId)) {
            normalizedFile[normalized] = targetId;
          } else {
            unknownTargets.push(targetId);
          }
        });
        if (Object.keys(normalizedFile).length > 0) {
          normalizedAssociations.file = normalizedFile;
        }
      }

      // Process folder associations
      if (associations.folder) {
        const normalizedFolder: Record<string, string> = {};
        Object.entries(associations.folder).forEach(([ext, targetId]) => {
          if (typeof targetId !== 'string') return;

          const normalized = normalizeExtension(ext);
          if (validTargetIds.has(targetId)) {
            normalizedFolder[normalized] = targetId;
          } else if (!unknownTargets.includes(targetId)) {
            unknownTargets.push(targetId);
          }
        });
        if (Object.keys(normalizedFolder).length > 0) {
          normalizedAssociations.folder = normalizedFolder;
        }
      }

      // Atomically replace associations
      set({ associations: normalizedAssociations });
      saveAssociations(normalizedAssociations);

      return {
        success: true,
        unknownTargets: unknownTargets.length > 0 ? unknownTargets : undefined,
      };
    } catch (error) {
      // Invalid JSON
      return { success: false };
    }
  },
}));

/**
 * Resolve default target for a file type with deterministic fallback.
 * Pure function: (resourceType, extension, eligibleTargets[]) → targetId
 *
 * Returns saved default if it exists and is in eligibleTargets.
 * Falls back to first eligible target if no default or invalid default.
 * Throws if eligibleTargets is empty (caller violation - must guard with isFileActionEligible).
 *
 * @param resourceType - 'file' or 'folder'
 * @param extension - File extension (will be normalized)
 * @param eligibleTargets - List of eligible targets for this file type
 * @returns targetId - The resolved target ID
 * @throws Error if eligibleTargets is empty
 */
export function resolveDefaultTarget(
  resourceType: 'file' | 'folder',
  extension: string,
  eligibleTargets: FileActionTarget[]
): string {
  if (eligibleTargets.length === 0) {
    throw new Error('resolveDefaultTarget called with empty eligibleTargets - caller must guard with isFileActionEligible');
  }

  const normalized = normalizeExtension(extension);

  // Try to get saved default
  const savedDefault = useFileAssociationsStore.getState().getDefaultTarget(resourceType, normalized);

  // If saved default exists and is in eligibleTargets, use it
  if (savedDefault && eligibleTargets.some((t) => t.id === savedDefault)) {
    return savedDefault;
  }

  // Fallback to first eligible target (deterministic)
  return eligibleTargets[0].id;
}
