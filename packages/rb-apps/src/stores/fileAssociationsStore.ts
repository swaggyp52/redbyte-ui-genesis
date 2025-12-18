// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { FileActionTarget } from '../apps/files/fileActionTargets';

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

interface FileAssociationsActions {
  getDefaultTarget: (resourceType: 'file' | 'folder', extension: string) => string | null;
  setDefaultTarget: (resourceType: 'file' | 'folder', extension: string, targetId: string) => void;
  clearDefaultTarget: (resourceType: 'file' | 'folder', extension: string) => void;
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
