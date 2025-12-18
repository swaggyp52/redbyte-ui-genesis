// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { FileEntry } from './fsTypes';

export interface FileActionTarget {
  id: string;
  name: string;
  appId: string;
  /**
   * Deterministic predicate that determines if this target is eligible
   * for the given resource type and name.
   * Pure function: (resourceType, resourceName) → boolean
   */
  isEligible: (resourceType: 'file' | 'folder', resourceName: string) => boolean;
}

/**
 * Registry of apps that can receive file actions via open-with intents.
 * Single source of truth for "Open With" targets.
 * PHASE_Z: Now uses eligibility predicates based on resourceType + file extension.
 */
export const FILE_ACTION_TARGETS: FileActionTarget[] = [
  {
    id: 'logic-playground',
    name: 'Logic Playground',
    appId: 'logic-playground',
    isEligible: (type, name) => type === 'file' && name.endsWith('.rblogic'),
  },
  {
    id: 'text-viewer',
    name: 'Text Viewer',
    appId: 'text-viewer',
    isEligible: (type, name) =>
      type === 'file' && (name.endsWith('.txt') || name.endsWith('.md')),
  },
];

/**
 * Get all file action targets that are eligible for the given entry.
 * Uses deterministic eligibility predicates (resourceType + file extension).
 */
export function getFileActionTargets(entry: FileEntry): FileActionTarget[] {
  return FILE_ACTION_TARGETS.filter((target) =>
    target.isEligible(entry.type, entry.name)
  );
}

/**
 * Check if a file action is eligible for the given entry.
 * Returns false for folders (no file actions), true for files with available targets.
 */
export function isFileActionEligible(entry: FileEntry | null): boolean {
  if (!entry) return false;
  if (entry.type === 'folder') return false;
  return getFileActionTargets(entry).length > 0;
}

/**
 * Get the default file action target (Logic Playground).
 */
export function getDefaultFileActionTarget(): FileActionTarget | null {
  return FILE_ACTION_TARGETS.find((t) => t.id === 'logic-playground') || null;
}
